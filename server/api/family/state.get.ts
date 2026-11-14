import { sql } from '../../utils/db'
import { requireUser } from '../../utils/auth'
import { ensureSchema } from '../../utils/schema'
import { listMembers } from '../../utils/family'

/** GET /api/family/state → 我的组 + 成员列表 + 我的身份；没加入时返回 { group: null }。 */
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  await ensureSchema()
  const rows = await sql()`
    select g.id, g.name, g.invite_code, g.owner_user_id, m.nickname, m.role
    from yiban_family_members m
    join yiban_family_groups g on g.id = m.group_id
    where m.user_id = ${user.id}
    limit 1
  `
  const row = rows[0] as Record<string, unknown> | undefined
  if (!row) return { group: null }
  const members = await listMembers(row.id as string)
  return {
    group: { id: row.id, name: row.name, inviteCode: row.invite_code, ownerUserId: row.owner_user_id },
    me: { userId: user.id, nickname: row.nickname, role: row.role },
    members,
  }
})
