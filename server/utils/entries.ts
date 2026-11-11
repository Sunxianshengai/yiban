import { z } from 'zod'

/**
 * 日记同步的线上格式与校验。
 *
 * 设计取舍：
 * - 客户端用本地 Dexie 的 id 做 clientId，服务端另有 uuid 主键；两边靠 (user_id, client_id) 唯一键对齐。
 * - 冲突用「最后写入者胜」：只比较 dateModified，不做字段级合并 —— 单人多设备的日记场景够用，
 *   且行为可解释（界面会显示「本机更新」或「云端更新」）。
 * - 删除是软删除（deleted_at），别的设备才能拉到"已删除"这个事实，而不是被静默丢掉。
 * - 增量：客户端带 since（ISO 时间），只回传之后变动的行。
 */
export const entrySchema = z.object({
  clientId: z.string().min(1).max(120),
  text: z.string().default(''),
  previewText: z.string().default(''),
  timezone: z.string().default('UTC'),
  dateOfJournal: z.string(),
  dateModified: z.string(),
  fields: z.record(z.string(), z.unknown()).default({}),
  tagTitles: z.array(z.string()).default([]),
  deleted: z.boolean().default(false),
})

export const pushSchema = z.object({
  entries: z.array(entrySchema).max(500).default([]),
})

export function toWire(row: Record<string, unknown>) {
  return {
    clientId: row.client_id,
    text: row.text,
    previewText: row.preview_text,
    timezone: row.timezone,
    dateOfJournal: iso(row.date_of_journal),
    dateModified: iso(row.date_modified),
    fields: row.fields ?? {},
    tagTitles: row.tags ?? [],
    deleted: row.deleted_at != null,
    updatedAt: iso(row.updated_at),
  }
}

export function iso(value: unknown) {
  if (value == null) return ''
  return value instanceof Date ? value.toISOString() : String(value)
}
