import { z } from 'zod'
import { sql } from '../../utils/db'
import { requireUser } from '../../utils/auth'
import { ensureSchema } from '../../utils/schema'
import { mediaPath, presignUpload } from '../../utils/blob'

/**
 * POST /api/media/upload-url
 * 登记一行 yiban_media，并返回一次性 PUT 地址。
 * 大文件由浏览器直传 Blob，不经过 Serverless 函数（函数有 4.5MB 请求体上限）。
 */
const bodySchema = z.object({
  mediaClientId: z.string().min(1).max(120),
  entryClientId: z.string().min(1).max(120),
  fileName: z.string().min(1).max(300),
  mimeType: z.string().min(1).max(200),
  sizeBytes: z.number().int().nonnegative().default(0),
  position: z.number().int().nonnegative().default(0),
})

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  await ensureSchema()
  const body = bodySchema.parse(await readBody(event))

  const ext = body.fileName.includes('.') ? body.fileName.split('.').pop() || '' : ''
  const pathname = mediaPath(user.id, body.entryClientId, body.mediaClientId, ext)

  await sql()`
    insert into yiban_media
      (user_id, client_id, entry_client_id, pathname, file_name, mime_type, size_bytes, position, deleted_at, updated_at)
    values
      (${user.id}, ${body.mediaClientId}, ${body.entryClientId}, ${pathname}, ${body.fileName},
       ${body.mimeType}, ${body.sizeBytes}, ${body.position}, null, now())
    on conflict (user_id, client_id) do update set
      entry_client_id = excluded.entry_client_id,
      pathname = excluded.pathname,
      file_name = excluded.file_name,
      mime_type = excluded.mime_type,
      size_bytes = excluded.size_bytes,
      position = excluded.position,
      deleted_at = null,
      updated_at = now()
  `

  const uploadUrl = await presignUpload(user.id, {
    pathname,
    contentType: body.mimeType,
    maxBytes: Math.max(body.sizeBytes, 1),
  })
  return { pathname, uploadUrl, expiresInSeconds: 900 }
})
