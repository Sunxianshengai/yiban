import { randomBytes } from 'node:crypto'
import { requireUser } from '../../utils/auth'
import { hasDatabase, sql } from '../../utils/db'
import { ensureSchema } from '../../utils/schema'

function generateBindCode(): string {
  return `WX${randomBytes(2).toString('hex').toUpperCase()}`
}

export default defineEventHandler(async (event) => {
  if (!hasDatabase()) return { configured: false, binding: null }
  const user = await requireUser(event)
  await ensureSchema()
  const q = sql()
  let rows = await q`
    select bind_code, wecom_user_id, merge_window_sec, auto_family, bound_at
    from yiban_wecom_bindings
    where user_id = ${user.id}
    limit 1
  `
  if (!rows.length) {
    const code = generateBindCode()
    rows = await q`
      insert into yiban_wecom_bindings (user_id, bind_code)
      values (${user.id}, ${code})
      on conflict (user_id) do update set user_id = excluded.user_id
      returning bind_code, wecom_user_id, merge_window_sec, auto_family, bound_at
    `
  }
  const r = rows[0] as any
  return {
    configured: true,
    binding: {
      bindCode: r.bind_code as string,
      wecomUserId: (r.wecom_user_id as string | null) ?? null,
      mergeWindowSec: Number(r.merge_window_sec ?? 120),
      autoFamily: Boolean(r.auto_family),
      boundAt: r.bound_at ? new Date(r.bound_at).toISOString() : null,
    },
  }
})
