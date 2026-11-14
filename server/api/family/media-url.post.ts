import { z } from 'zod'
import { sql } from '../../utils/db'
import { ensureSchema } from '../../utils/schema'
import { requireFamilyMember, listMembers } from '../../utils/family'
import { presignDownload } from '../../utils/blob'

/**
 * POST /api/family/media-url
 * 家庭版的附件预签名 GET：只对「同组成员的、仍在共享家人（visibility=family）且未删除」的条目附件签发。
 * 路径形如 u/<ownerUserId>/<entryClientId>/<mediaClientId>.<ext>，逐段校验，越权路径直接跳过。
 */
const bodySchema = z.object({
  pathnames: z.array(z.string().min(1).max(600)).max(50).default([]),
})

export default defineEventHandler(async (event) => {
  const ctx = await requireFamilyMember(event)
  await ensureSchema()
  const body = bodySchema.parse(await readBody(event))
  const memberIds = new Set((await listMembers(ctx.group.id)).map(m => m.userId))

  const urls: Record<string, string> = {}
  for (const pathname of body.pathnames) {
    const m = pathname.match(/^u\/([0-9a-f-]{36})\/([^/]+)\//i)
    if (!m || !memberIds.has(m[1])) continue
    const ownerUserId = m[1]
    const entryClientId = decodeURIComponent(m[2])
    // 条目必须存在、未删除、且当前仍是「共享家人」——改回私有立刻拉黑所有附件
    const entryRows = await sql()`
      select 1 from yiban_entries
      where user_id = ${ownerUserId} and client_id = ${entryClientId}
        and deleted_at is null and fields->>'visibility' = 'family'
      limit 1
    `
    if (!entryRows.length) continue
    const mediaRows = await sql()`
      select 1 from yiban_media
      where user_id = ${ownerUserId} and pathname = ${pathname} and deleted_at is null
      limit 1
    `
    if (!mediaRows.length) continue
    urls[pathname] = await presignDownload(pathname)
  }
  return { urls, expiresInSeconds: 600 }
})
