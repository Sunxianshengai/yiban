import { randomBytes } from 'node:crypto'
import { z } from 'zod'
import { requireUser } from '../../utils/auth'
import { hasDatabase, sql } from '../../utils/db'
import { ensureSchema } from '../../utils/schema'

const bodySchema = z.object({
  action: z.enum(['refreshCode', 'unbind', 'update']).default('update'),
  mergeWindowSec: z.number().int().min(0).max(3600).optional(),
  autoFamily: z.boolean().optional(),
})

export default defineEventHandler(async (event) => {
  if (!hasDatabase()) throw createError({ statusCode: 503, statusMessage: '数据库未配置' })
  const user = await requireUser(event)
  await ensureSchema()
  const body = bodySchema.parse(await readBody(event))
  const q = sql()

  if (body.action === 'refreshCode') {
    const code = `WX${randomBytes(2).toString('hex').toUpperCase()}`
    await q`
      insert into yiban_wecom_bindings (user_id, bind_code)
      values (${user.id}, ${code})
      on conflict (user_id) do update set bind_code = ${code}
    `
  } else if (body.action === 'unbind') {
    await q`
      update yiban_wecom_bindings
      set wecom_user_id = null, bound_at = null
      where user_id = ${user.id}
    `
  } else {
    if (body.mergeWindowSec !== undefined) {
      await q`
        update yiban_wecom_bindings
        set merge_window_sec = ${body.mergeWindowSec}
        where user_id = ${user.id}
      `
    }
    if (body.autoFamily !== undefined) {
      await q`
        update yiban_wecom_bindings
        set auto_family = ${body.autoFamily}
        where user_id = ${user.id}
      `
    }
  }

  const rows = await q`
    select bind_code, wecom_user_id, merge_window_sec, auto_family, bound_at
    from yiban_wecom_bindings
    where user_id = ${user.id}
    limit 1
  `
  const r = rows[0] as any
  return {
    binding: r ? {
      bindCode: r.bind_code as string,
      wecomUserId: (r.wecom_user_id as string | null) ?? null,
      mergeWindowSec: Number(r.merge_window_sec ?? 120),
      autoFamily: Boolean(r.auto_family),
      boundAt: r.bound_at ? new Date(r.bound_at).toISOString() : null,
    } : null,
  }
})
