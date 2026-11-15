import { sql } from '../../utils/db'
import { requireUser } from '../../utils/auth'
import { ensureSchema } from '../../utils/schema'
import { pushSchema, toWire } from '../../utils/entries'

/** POST /api/entries → 推送本地变更，返回服务端合并后的全量（客户端据此对齐）。 */
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  await ensureSchema()
  const body = pushSchema.parse(await readBody(event))

  if (body.family) {
    const { groupId, userId } = body.family
    if (user.id !== userId) throw createError({ statusCode: 403, statusMessage: '账号已切换，请重新打开小家。' })
    if (body.entries.length !== 1 || body.entries[0]?.fields.visibility !== 'family' || body.entries[0].deleted) {
      throw createError({ statusCode: 400, statusMessage: '每次只能发布一篇家庭日记。' })
    }
    const membership = await sql()`select 1 from yiban_family_members where user_id = ${user.id} and group_id = ${groupId}`
    if (!membership.length) throw createError({ statusCode: 403, statusMessage: '你已离开这个小家。' })
  }

  for (const entry of body.entries) {
    await sql()`
      insert into yiban_entries
        (user_id, client_id, text, preview_text, timezone, date_of_journal, date_modified, fields, tags, deleted_at, updated_at)
      values
        (${user.id}, ${entry.clientId}, ${entry.text}, ${entry.previewText}, ${entry.timezone},
         ${entry.dateOfJournal}, ${entry.dateModified}, ${JSON.stringify(entry.fields)}::jsonb,
         ${JSON.stringify(entry.tagTitles)}::jsonb,
         ${entry.deleted ? new Date().toISOString() : null}, now())
      on conflict (user_id, client_id) do update set
        text = excluded.text,
        preview_text = excluded.preview_text,
        timezone = excluded.timezone,
        date_of_journal = excluded.date_of_journal,
        date_modified = excluded.date_modified,
        fields = excluded.fields,
        tags = excluded.tags,
        deleted_at = excluded.deleted_at,
        updated_at = now()
      where yiban_entries.date_modified < excluded.date_modified
    `
  }

  const rows = body.family ? await sql()`
    select client_id, text, preview_text, timezone, date_of_journal, date_modified, fields, tags, deleted_at, updated_at
    from yiban_entries where user_id = ${user.id} and client_id = ${body.entries[0]!.clientId}
  ` : await sql()`
    select client_id, text, preview_text, timezone, date_of_journal, date_modified, fields, tags, deleted_at, updated_at
    from yiban_entries
    where user_id = ${user.id}
    order by updated_at asc
    limit 2000
  `
  return { entries: rows.map(toWire), serverTime: new Date().toISOString() }
})
