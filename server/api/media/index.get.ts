import { sql } from '../../utils/db'
import { requireUser } from '../../utils/auth'
import { ensureSchema } from '../../utils/schema'

/** GET /api/media?since=ISO → 服务端自 since 起变更的附件清单（只给元数据，文件走预签名）。 */
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  await ensureSchema()
  const since = String(getQuery(event).since || '')
  const rows = since
    ? await sql()`
        select client_id, entry_client_id, pathname, file_name, mime_type, size_bytes, position, deleted_at, updated_at
        from yiban_media
        where user_id = ${user.id} and updated_at > ${since}
        order by updated_at asc
        limit 2000
      `
    : await sql()`
        select client_id, entry_client_id, pathname, file_name, mime_type, size_bytes, position, deleted_at, updated_at
        from yiban_media
        where user_id = ${user.id}
        order by updated_at asc
        limit 2000
      `
  return {
    media: rows.map((row) => ({
      clientId: row.client_id,
      entryClientId: row.entry_client_id,
      pathname: row.pathname,
      fileName: row.file_name,
      mimeType: row.mime_type,
      sizeBytes: Number(row.size_bytes ?? 0),
      position: Number(row.position ?? 0),
      deleted: row.deleted_at != null,
      updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at),
    })),
    serverTime: new Date().toISOString(),
  }
})
