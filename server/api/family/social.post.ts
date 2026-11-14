import { z } from 'zod'
import { sql } from '../../utils/db'
import { ensureSchema } from '../../utils/schema'
import { requireFamilyMember } from '../../utils/family'
import { iso } from '../../utils/entries'

/**
 * POST /api/family/social
 * 在组内公共日记下评论（comment）或追加段落（contribution）。
 * 原文永远不可改 —— 互动是服务端追加记录，纯文本存储、前端转义渲染。
 * 目标条目必须仍是同组成员的「共享家人」条目，改回私有后立刻不能再互动。
 */
const bodySchema = z.object({
  entryOwnerUserId: z.string().min(1).max(64),
  entryClientId: z.string().min(1).max(120),
  kind: z.enum(['comment', 'contribution']),
  content: z.string().min(1),
})

export default defineEventHandler(async (event) => {
  const ctx = await requireFamilyMember(event)
  await ensureSchema()
  const body = bodySchema.parse(await readBody(event))
  const content = body.content.trim()
  if (!content) throw createError({ statusCode: 400, statusMessage: '内容不能为空' })
  const limit = body.kind === 'comment' ? 1000 : 20000
  if (content.length > limit) {
    throw createError({ statusCode: 400, statusMessage: body.kind === 'comment' ? '评论最长 1000 字' : '追加段落最长 20000 字' })
  }

  const entryRows = await sql()`
    select 1 from yiban_entries
    where user_id = ${body.entryOwnerUserId} and client_id = ${body.entryClientId}
      and deleted_at is null and fields->>'visibility' = 'family'
    limit 1
  `
  if (!entryRows.length) {
    throw createError({ statusCode: 404, statusMessage: '这条日记不在家庭共享里（可能已改回私有或被删除）' })
  }

  const rows = await sql()`
    insert into yiban_family_socials
      (group_id, entry_owner_user_id, entry_client_id, author_user_id, author_nickname, kind, content)
    values (${ctx.group.id}, ${body.entryOwnerUserId}, ${body.entryClientId}, ${ctx.user.id}, ${ctx.me.nickname}, ${body.kind}, ${content})
    returning id, created_at
  `
  const row = rows[0] as Record<string, unknown>
  return {
    social: {
      id: row.id,
      entryOwnerUserId: body.entryOwnerUserId,
      entryClientId: body.entryClientId,
      authorUserId: ctx.user.id,
      authorNickname: ctx.me.nickname,
      kind: body.kind,
      content,
      createdAt: iso(row.created_at),
    },
  }
})
