import { z } from 'zod'
import { sql } from '../../utils/db'
import { requireUser } from '../../utils/auth'
import { ensureSchema } from '../../utils/schema'
import { normalizeInviteCode, listMembers } from '../../utils/family'

/** POST /api/family/join → 凭邀请码加入家庭组。 */
const bodySchema = z.object({
  code: z.string().min(4).max(10),
  nickname: z.string().trim().min(1).max(12),
})

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  await ensureSchema()
  const body = bodySchema.parse(await readBody(event))

  const rows = await sql()`
    select id, name, invite_code, owner_user_id
    from yiban_family_groups
    where invite_code = ${normalizeInviteCode(body.code)}
    limit 1
  `
  const group = rows[0] as Record<string, unknown> | undefined
  if (!group) throw createError({ statusCode: 404, statusMessage: '邀请码不对，请核对后再试' })

  const existing = await sql()`select 1 from yiban_family_members where user_id = ${user.id} limit 1`
  if (existing.length) throw createError({ statusCode: 409, statusMessage: '你已加入一个家庭组，先退出再加入新的' })

  try {
    await sql()`
      insert into yiban_family_members (group_id, user_id, nickname, role)
      values (${group.id}, ${user.id}, ${body.nickname}, 'member')
    `
  } catch (e) {
    if ((e as { code?: string }).code === '23505') {
      throw createError({ statusCode: 409, statusMessage: '你已加入一个家庭组，先退出再加入新的' })
    }
    throw e
  }

  return {
    group: { id: group.id, name: group.name, inviteCode: group.invite_code, ownerUserId: group.owner_user_id },
    me: { userId: user.id, nickname: body.nickname, role: 'member' },
    members: await listMembers(group.id as string),
  }
})
