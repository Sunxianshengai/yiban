import { z } from 'zod'
import { requireUser } from '../../utils/auth'
import { sql } from '../../utils/db'
import { iso } from '../../utils/entries'
import { ensureSchema } from '../../utils/schema'

const removalSchema = z.object({
  clientId: z.string().min(1).max(120),
  ownerUserId: z.uuid(),
  action: z.enum(['withdraw', 'trash']),
})

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const body = removalSchema.parse(await readBody(event))
  if (user.id !== body.ownerUserId) throw createError({ statusCode: 403, statusMessage: '只有作者可以撤回或删除。' })
  await ensureSchema()

  // 只改可见性／删除状态，避免覆盖其他设备较新的正文或附件。
  const rows = await sql()`
    update yiban_entries set
      fields = jsonb_set(fields, '{visibility}', '"private"'::jsonb),
      date_modified = greatest(now(), date_modified + interval '1 millisecond'),
      updated_at = now(),
      deleted_at = case when ${body.action} = 'trash' then now() else null end
    where user_id = ${user.id} and client_id = ${body.clientId} and deleted_at is null
      and fields->>'visibility' = 'family'
    returning date_modified
  `
  return { dateModified: iso(rows[0]?.date_modified) }
})
