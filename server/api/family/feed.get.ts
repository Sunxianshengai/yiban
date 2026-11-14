import { sql } from '../../utils/db'
import { ensureSchema } from '../../utils/schema'
import { requireFamilyMember, listMembers, type FamilyMember } from '../../utils/family'
import { iso } from '../../utils/entries'

/**
 * GET /api/family/feed
 * 组内成员标为「共享家人」（fields->>'visibility'='family'）的条目 + 全部评论/追加段落。
 * 全量返回，不做增量：家庭规模小，每次全量刷新天然覆盖
 * 「撤回公共标记 / 删除条目」后客户端残留的一致性问题。
 * 私有日记永远不出现在这个接口里。
 */
export default defineEventHandler(async (event) => {
  const ctx = await requireFamilyMember(event)
  await ensureSchema()
  const members = await listMembers(ctx.group.id)
  const memberIds = members.map(m => m.userId)
  const nicknameById = new Map(members.map(m => [m.userId, m.nickname] as const))

  const entryRows = await sql()`
    select user_id, client_id, text, preview_text, timezone, date_of_journal, date_modified, fields
    from yiban_entries
    where user_id = any(${memberIds})
      and deleted_at is null
      and fields->>'visibility' = 'family'
    order by date_of_journal desc
    limit 500
  ` as Record<string, unknown>[]

  const entryClientIds = entryRows.map(r => r.client_id)
  const mediaRows = entryClientIds.length
    ? await sql()`
        select user_id, client_id, entry_client_id, pathname, file_name, mime_type, size_bytes, position
        from yiban_media
        where user_id = any(${memberIds})
          and entry_client_id = any(${entryClientIds})
          and deleted_at is null
        order by position asc
      ` as Record<string, unknown>[]
    : []

  const socialRows = await sql()`
    select id, entry_owner_user_id, entry_client_id, author_user_id, author_nickname, kind, content, created_at
    from yiban_family_socials
    where group_id = ${ctx.group.id}
    order by created_at asc
    limit 2000
  ` as Record<string, unknown>[]

  // 附件按条目归组：key = ownerUserId:entryClientId
  const mediaByEntry = new Map<string, Record<string, unknown>[]>()
  for (const row of mediaRows) {
    const key = `${row.user_id}:${row.entry_client_id}`
    const list = mediaByEntry.get(key) ?? []
    list.push({
      clientId: row.client_id,
      pathname: row.pathname,
      fileName: row.file_name,
      mimeType: row.mime_type,
      position: row.position,
    })
    mediaByEntry.set(key, list)
  }

  return {
    members,
    entries: entryRows.map(row => ({
      ownerUserId: row.user_id,
      ownerNickname: nicknameById.get(row.user_id) || '家人',
      clientId: row.client_id,
      text: row.text,
      previewText: row.preview_text,
      timezone: row.timezone,
      dateOfJournal: iso(row.date_of_journal),
      dateModified: iso(row.date_modified),
      fields: (row.fields ?? {}) as Record<string, unknown>,
      media: mediaByEntry.get(`${row.user_id}:${row.client_id}`) ?? [],
    })),
    socials: socialRows.map(row => ({
      id: row.id,
      entryOwnerUserId: row.entry_owner_user_id,
      entryClientId: row.entry_client_id,
      authorUserId: row.author_user_id,
      authorNickname: row.author_nickname,
      kind: row.kind,
      content: row.content,
      createdAt: iso(row.created_at),
    })),
    serverTime: new Date().toISOString(),
  }
})
