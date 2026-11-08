import type { EntryV2 } from '~/utils/db'
import { db, miscDb, computeTokens, htmlToPreview } from '~/utils/db'

/** Local journal key: empty linkedAccountId (cloud accounts use their id, per original). */
const LOCAL = ''

export function useEntries() {
  const entries = ref<EntryV2[]>([])

  async function refresh() {
    entries.value = await db.entriesV2.orderBy('dateOfJournal').reverse().toArray()
  }

  async function createEntry(text: string, date = new Date()): Promise<number> {
    const now = new Date()
    const trimmed = text.trim()
    const row: EntryV2 = {
      linkedAccountId: LOCAL,
      text: trimmed,
      previewText: htmlToPreview(trimmed),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
      dateOfJournal: date,
      dateModified: now,
      synced: 0,
      type: 'journal',
      favourite: 0,
      ...computeTokens(date),
    }
    const id = await db.entriesV2.add(row)
    await refresh()
    return id
  }

  async function updateEntry(id: number, text: string, date?: Date) {
    const row = await db.entriesV2.get(id)
    if (!row) return
    const dj = date ?? row.dateOfJournal
    await db.entriesV2.update(id, {
      text: text.trim(),
      previewText: htmlToPreview(text),
      dateOfJournal: dj,
      dateModified: new Date(),
      synced: 0,
      ...computeTokens(dj),
    })
    await refresh()
  }

  async function toggleFavourite(id: number) {
    const row = await db.entriesV2.get(id)
    if (!row) return
    await db.entriesV2.update(id, { favourite: row.favourite ? 0 : 1 })
    await refresh()
  }

  async function duplicateEntry(id: number) {
    const row = await db.entriesV2.get(id)
    if (!row) return
    const now = new Date()
    const { id: _drop, ...rest } = row
    await db.entriesV2.add({
      ...rest,
      dateOfJournal: now,
      dateModified: now,
      synced: 0,
      ...computeTokens(now),
    })
    await refresh()
  }

  async function saveAsTemplate(id: number) {
    const row = await db.entriesV2.get(id)
    if (!row) return
    await miscDb.templates.add({
      name: `Entry ${new Date(row.dateOfJournal).toLocaleDateString('en-US')}`,
      content: row.text,
      contentType: 'html',
      updatedAt: new Date(),
    })
  }

  /** Soft delete per original trashesV2 model. */
  async function moveToTrash(id: number) {
    const row = await db.entriesV2.get(id)
    if (!row) return
    await db.transaction('rw', db.entriesV2, db.trashesV2, async () => {
      await db.trashesV2.add({ linkedAccountId: LOCAL, type: row.type || 'journal' })
      await db.entriesV2.delete(id)
    })
    await refresh()
  }

  onMounted(refresh)

  return { entries, refresh, createEntry, updateEntry, toggleFavourite, duplicateEntry, saveAsTemplate, moveToTrash }
}
