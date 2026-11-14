import { sql } from '../../utils/db'
import { ensureSchema } from '../../utils/schema'
import { requireFamilyMember } from '../../utils/family'

/**
 * POST /api/family/leave → 退出家庭组。
 * 组主退出时：有其他成员就把组主转给最早加入的人；没人了就解散整组（级联清掉成员与互动记录）。
 */
export default defineEventHandler(async (event) => {
  const ctx = await requireFamilyMember(event)
  await ensureSchema()

  if (ctx.me.role === 'owner') {
    const others = await sql()`
      select user_id from yiban_family_members
      where group_id = ${ctx.group.id} and user_id <> ${ctx.user.id}
      order by joined_at asc limit 1
    `
    if (others.length) {
      const next = others[0] as { user_id: string }
      await sql()`update yiban_family_groups set owner_user_id = ${next.user_id} where id = ${ctx.group.id}`
      await sql()`update yiban_family_members set role = 'owner' where group_id = ${ctx.group.id} and user_id = ${next.user_id}`
    } else {
      await sql()`delete from yiban_family_groups where id = ${ctx.group.id}`
      return { ok: true, dissolved: true }
    }
  }

  await sql()`delete from yiban_family_members where group_id = ${ctx.group.id} and user_id = ${ctx.user.id}`
  return { ok: true, dissolved: false }
})
