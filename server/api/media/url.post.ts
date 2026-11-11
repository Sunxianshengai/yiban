import { z } from 'zod'
import { sql } from '../../utils/db'
import { requireUser } from '../../utils/auth'
import { ensureSchema } from '../../utils/schema'
import { assertOwnPath, presignDownload } from '../../utils/blob'

/**
 * POST /api/media/url
 * 私有 Blob 不能直接开 URL（403）。这里按 pathname 换一次性 GET 地址。
 * 只允许取自己目录下的文件：别人拿到 pathname 也没用。
 */
const bodySchema = z.object({
  pathnames: z.array(z.string().min(1).max(600)).max(50).default([]),
})

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  await ensureSchema()
  const body = bodySchema.parse(await readBody(event))

  const urls: Record<string, string> = {}
  for (const pathname of body.pathnames) {
    assertOwnPath(user.id, pathname)
    // 只签发库里有记录、且未删除的附件
    const rows = await sql()`
      select 1 from yiban_media
      where user_id = ${user.id} and pathname = ${pathname} and deleted_at is null
      limit 1
    `
    if (!rows.length) continue
    urls[pathname] = await presignDownload(pathname)
  }
  return { urls, expiresInSeconds: 600 }
})
