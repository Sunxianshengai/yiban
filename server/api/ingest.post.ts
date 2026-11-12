import { z } from 'zod'
import { sql, hasDatabase } from '../utils/db'
import { findUser, newClientId } from '../utils/auth'
import { ensureSchema } from '../utils/schema'
import { mediaPath, presignUpload } from '../utils/blob'

/**
 * POST /api/ingest —— 外部来源（微信桥接等）写入日记的服务入口。
 *
 * 鉴权：Bearer INGEST_TOKEN（Vercel 环境变量）+ INGEST_EMAIL 指定唯一归属账号。
 * 不走会话 cookie：网关是本机脚本，不是浏览器。
 * 照片由服务端经预签名 PUT 直传私有 Blob（本地无 OIDC 时此路径诚实 503，文字照常入库）。
 * 入库后的日记与手动写的完全同构：client_id 服务端生成，各设备「全部同步」时拉取。
 */

const photoSchema = z.object({
  fileName: z.string().min(1).max(300),
  mimeType: z.string().regex(/^image\//).max(200),
  dataBase64: z.string().min(1).max(14_000_000), // ~10MB 原始
})

const bodySchema = z.object({
  text: z.string().min(1).max(100_000),
  previewText: z.string().max(4_000).optional(),
  dateOfJournal: z.string().datetime().optional(),
  timezone: z.string().max(80).default('Asia/Shanghai'),
  tags: z.array(z.string().min(1).max(40)).max(10).default([]),
  photos: z.array(photoSchema).max(6).default([]),
  source: z.string().max(40).default('wechat'),
})

function unauthorized() {
  throw createError({ statusCode: 401, statusMessage: 'ingest token 无效' })
}

export default defineEventHandler(async (event) => {
  const token = process.env.INGEST_TOKEN || ''
  const email = process.env.INGEST_EMAIL || ''
  if (!token || !email) {
    throw createError({ statusCode: 503, statusMessage: '服务端未配置 INGEST_TOKEN / INGEST_EMAIL' })
  }
  if (!hasDatabase()) {
    throw createError({ statusCode: 503, statusMessage: '数据库未配置' })
  }
  const header = getHeader(event, 'authorization') || ''
  if (header !== `Bearer ${token}`) unauthorized()

  const user = await findUser(email)
  if (!user) throw createError({ statusCode: 404, statusMessage: 'INGEST_EMAIL 对应的账号不存在' })

  await ensureSchema()
  const body = bodySchema.parse(await readBody(event))

  await ensureSchema()

  const clientId = newClientId()
  const dateOfJournal = body.dateOfJournal ? new Date(body.dateOfJournal) : new Date()
  const now = new Date()
  // 外部来源的正文按纯文本段落处理（与 palClient.draftTextToHtml 同规则）
  const html = body.text
    .split(/\n+/).map(p => p.trim()).filter(Boolean)
    .map(p => `<p>${p.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>`)
    .join('')
  const preview = body.previewText?.trim() || body.text.replace(/\s+/g, ' ').trim().slice(0, 200)

  await sql()`
    insert into yiban_entries
      (user_id, client_id, text, preview_text, timezone, date_of_journal, date_modified, fields, tags, deleted_at, updated_at)
    values
      (${user.id}, ${clientId}, ${html}, ${preview}, ${body.timezone}, ${dateOfJournal.toISOString()},
       ${now.toISOString()}, ${JSON.stringify({ source: body.source })}::jsonb, ${JSON.stringify(body.tags)}::jsonb, null, now())
  `

  let uploaded = 0
  const mediaFailures: string[] = []
  for (const [position, photo] of body.photos.entries()) {
    try {
      const bytes = Buffer.from(photo.dataBase64, 'base64')
      const ext = (photo.fileName.includes('.') ? photo.fileName.split('.').pop()! : 'jpg').replace(/[^a-z0-9]/gi, '').slice(0, 8) || 'jpg'
      const pathname = mediaPath(user.id, clientId, newClientId(), ext)
      // 服务端签名后自传：本地无 OIDC 会抛错（诚实降级，正文不受影响）
      const uploadUrl = await presignUpload(user.id, {
        pathname, contentType: photo.mimeType, maxBytes: Math.max(bytes.length, 1),
      }, 5 * 60_000)
      const res = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'content-type': photo.mimeType },
        body: new Uint8Array(bytes),
      })
      if (!res.ok) throw new Error(`blob PUT ${res.status}`)
      await sql()`
        insert into yiban_media
          (user_id, client_id, entry_client_id, pathname, file_name, mime_type, size_bytes, position, deleted_at, updated_at)
        values
          (${user.id}, ${newClientId()}, ${clientId}, ${pathname}, ${photo.fileName}, ${photo.mimeType},
           ${bytes.length}, ${position}, null, now())
      `
      uploaded++
    } catch (e) {
      mediaFailures.push(`${photo.fileName}: ${(e as Error).message}`)
    }
  }

  return {
    ok: true,
    entryClientId: clientId,
    photosUploaded: uploaded,
    photosFailed: mediaFailures,
  }
})
