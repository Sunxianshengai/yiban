import { z } from 'zod'
import { sql } from '../../utils/db'
import { ensureSchema } from '../../utils/schema'
import { requireFamilyMember } from '../../utils/family'

/** POST /api/family/nickname → 改我在组里的昵称（旧评论上留的是当时的快照，不受影响）。 */
const bodySchema = z.object({
  nickname: z.string().trim().min(1).max(12),
})

export default defineEventHandler(async (event) => {
  const ctx = await requireFamilyMember(event)
  const body = bodySchema.parse(await readBody(event))
  await sql()`
    update yiban_family_members
    set nickname = ${body.nickname}
    where group_id = ${ctx.group.id} and user_id = ${ctx.user.id}
  `
  return { ok: true, nickname: body.nickname }
})
