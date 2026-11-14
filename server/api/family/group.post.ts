import { z } from 'zod'
import { sql } from '../../utils/db'
import { requireUser } from '../../utils/auth'
import { ensureSchema } from '../../utils/schema'
import { newInviteCode, listMembers } from '../../utils/family'

/**
 * POST /api/family/group → 创建家庭组，创建者自动成为组主。
 * 一人一组；邀请码撞唯一索引就换一个再试。
 */
const bodySchema = z.object({
  name: z.string().trim().min(1).max(30).default('我的家庭'),
  nickname: z.string().trim().min(1).max(12),
})

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  await ensureSchema()
  const body = bodySchema.parse(await readBody(event))

  const existing = await sql()`select 1 from yiban_family_members where user_id = ${user.id} limit 1`
  if (existing.length) throw createError({ statusCode: 409, statusMessage: '你已加入一个家庭组，先退出再创建新的' })

  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const rows = await sql()`
        insert into yiban_family_groups (name, invite_code, owner_user_id)
        values (${body.name}, ${newInviteCode()}, ${user.id})
        returning id, name, invite_code, owner_user_id
      `
      const g = rows[0] as Record<string, unknown>
      await sql()`
        insert into yiban_family_members (group_id, user_id, nickname, role)
        values (${g.id}, ${user.id}, ${body.nickname}, 'owner')
      `
      return {
        group: { id: g.id, name: g.name, inviteCode: g.invite_code, ownerUserId: g.owner_user_id },
        me: { userId: user.id, nickname: body.nickname, role: 'owner' },
        members: await listMembers(g.id as string),
      }
    } catch (e) {
      if ((e as { code?: string }).code === '23505' && attempt < 4) continue
      throw e
    }
  }
  throw createError({ statusCode: 500, statusMessage: '创建失败，请重试' })
})
