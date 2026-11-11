import { sql } from '../../utils/db'
import { requireUser } from '../../utils/auth'
import { ensureSchema } from '../../utils/schema'
import { toWire } from '../../utils/entries'

/** GET /api/entries?since=ISO → 服务端自 since 起变更的日记（不带 since 则全量）。 */
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  await ensureSchema()
  const since = String(getQuery(event).since || '')
  const rows = since
    ? await sql()`
        select client_id, text, preview_text, timezone, date_of_journal, date_modified, fields, tags, deleted_at, updated_at
        from yiban_entries
        where user_id = ${user.id} and updated_at > ${since}
        order by updated_at asc
        limit 2000
      `
    : await sql()`
        select client_id, text, preview_text, timezone, date_of_journal, date_modified, fields, tags, deleted_at, updated_at
        from yiban_entries
        where user_id = ${user.id}
        order by updated_at asc
        limit 2000
      `
  return { entries: rows.map(toWire), serverTime: new Date().toISOString() }
})
