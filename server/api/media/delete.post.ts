import { z } from 'zod'
import { sql } from '../../utils/db'
import { requireUser } from '../../utils/auth'
import { ensureSchema } from '../../utils/schema'

/**
 * POST /api/media/delete
 * 软删除附件记录。Blob 本体先留着（用户可能撤销删除），
 * 真删由后续清理任务处理 —— 避免误删后无法恢复。
 */
const bodySchema = z.object({
  clientIds: z.array(z.string().min(1).max(120)).max(200).default([]),
})

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  await ensureSchema()
  const body = bodySchema.parse(await readBody(event))
  if (body.clientIds.length) {
    await sql()`
      update yiban_media set deleted_at = now(), updated_at = now()
      where user_id = ${user.id} and client_id = any(${body.clientIds})
    `
  }
  return { ok: true, removed: body.clientIds.length }
})
