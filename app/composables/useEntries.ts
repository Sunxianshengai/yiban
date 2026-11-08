import type { EntryV2, MediaFileV2, TagWordV2 } from '~/utils/db'
import { db, miscDb, computeTokens, htmlToPreview } from '~/utils/db'

/** Local journal key: empty linkedAccountId (cloud accounts use their id, per original). */
export const LOCAL = ''

/** Strip Vue reactive proxies so IndexedDB structured clone never sees them (DataCloneError). */
function deProxy<T>(obj: T): T {
  if (obj == null || typeof obj !== 'object') return obj
  if (obj instanceof Date) return new Date(obj.getTime()) as unknown as T
  if (obj instanceof Blob) return obj
  if (Array.isArray(obj)) return obj.map((x) => deProxy(x)) as unknown as T
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) out[k] = deProxy(v)
  }
  return out as T
}

export function useEntries() {
  const entries = ref<EntryV2[]>([])

  async function refresh() {
    entries.value = await db.entriesV2.orderBy('dateOfJournal').reverse().toArray()
  }

  async function createEntry(text: string, date = new Date(), extra: Partial<EntryV2> = {}): Promise<number> {
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
      ...extra,
    }
    const id = await db.entriesV2.add(deProxy(row))
    await refresh()
    return id
  }

  async function updateEntry(id: number, text: string, date?: Date, extra: Partial<EntryV2> = {}) {
    const row = await db.entriesV2.get(id)
    if (!row) return
    const dj = date ?? row.dateOfJournal
    await db.entriesV2.update(id, deProxy({
      text: text.trim(),
      previewText: htmlToPreview(text),
      dateOfJournal: dj,
      dateModified: new Date(),
      synced: 0,
      ...computeTokens(dj),
      ...extra,
    }))
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

  /** Soft delete per original trashesV2 model; snapshot enables restore. */
  async function moveToTrash(id: number) {
    const row = await db.entriesV2.get(id)
    if (!row) return
    await db.transaction('rw', db.entriesV2, db.trashesV2, async () => {
      await db.trashesV2.add({ linkedAccountId: LOCAL, type: row.type || 'journal', snapshot: row })
      await db.entriesV2.delete(id)
    })
    await refresh()
  }

  async function listTrash() {
    return db.trashesV2.toArray()
  }

  async function restoreFromTrash(trashId: number) {
    const row = await db.trashesV2.get(trashId)
    if (!row?.snapshot) return
    const { snapshot } = row
    await db.transaction('rw', db.entriesV2, db.trashesV2, async () => {
      await db.entriesV2.add(snapshot)
      await db.trashesV2.delete(trashId)
    })
    await refresh()
  }

  // ---- media ----
  async function attachMedia(entryId: number, file: File, position: number) {
    const ext = (file.name.split('.').pop() || '').toLowerCase()
    const row: MediaFileV2 = {
      linkedAccountId: LOCAL,
      jId: entryId,
      createdAt: new Date(),
      fileMetadataDate: new Date(),
      fileName: file.name,
      mimeType: file.type || 'application/octet-stream',
      ext,
      position,
      uploaded: 0,
      blob: file,
    }
    return db.mediaFilesV2.add(row)
  }

  async function listMediaFor(entryId: number) {
    const rows = await db.mediaFilesV2.where('jId').equals(entryId).sortBy('position')
    return rows
  }

  async function allMedia() {
    return db.mediaFilesV2.orderBy('createdAt').reverse().toArray()
  }

  async function deleteMedia(id: number) {
    await db.mediaFilesV2.delete(id)
  }

  /** Resolve <img data-media-id> placeholders to object URLs for rendering. */
  async function hydrateMediaHtml(text: string): Promise<string> {
    const div = document.createElement('div')
    div.innerHTML = text
    const imgs = Array.from(div.querySelectorAll('img[data-media-id]'))
    if (!imgs.length) return text
    await Promise.all(
      imgs.map(async (img) => {
        const id = Number(img.getAttribute('data-media-id'))
        const row = await db.mediaFilesV2.get(id)
        if (row?.blob) {
          img.src = URL.createObjectURL(row.blob)
        } else {
          img.setAttribute('alt', row?.fileName || 'missing media')
        }
      }),
    )
    return div.innerHTML
  }

  // ---- tags ----
  async function listTags(): Promise<TagWordV2[]> {
    return db.tagWordsV2.orderBy('title').toArray()
  }

  async function ensureTag(title: string): Promise<TagWordV2> {
    const t = title.trim().toLowerCase()
    const existing = await db.tagWordsV2.where('title').equals(t).first()
    if (existing) return existing
    const id = await db.tagWordsV2.add({ linkedAccountId: LOCAL, title: t })
    return { id, linkedAccountId: LOCAL, title: t }
  }

  async function setEntryTags(entryId: number, tagIds: number[]) {
    await db.entriesV2.update(entryId, { tagWordIds: tagIds, synced: 0 })
    await refresh()
  }

  // ---- calendar ----
  async function entriesOn(year: number, month1based: number): Promise<EntryV2[]> {
    const mt = String(month1based).padStart(2, '0')
    const rows: EntryV2[] = []
    await db.entriesV2.each((e) => {
      if (e.yearToken === String(year) && e.monthToken === mt) rows.push(e)
    })
    return rows.sort((a, b) => +new Date(b.dateOfJournal) - +new Date(a.dateOfJournal))
  }

  async function throwbacks(): Promise<EntryV2[]> {
    const today = new Date()
    const rows: EntryV2[] = []
    await db.entriesV2.each((e) => {
      const d = new Date(e.dateOfJournal)
      if (d.getMonth() === today.getMonth() && d.getDate() === today.getDate() && d.getFullYear() < today.getFullYear()) rows.push(e)
    })
    return rows
  }

  onMounted(refresh)

  return {
    entries, refresh, createEntry, updateEntry, toggleFavourite, duplicateEntry, saveAsTemplate,
    moveToTrash, listTrash, restoreFromTrash,
    attachMedia, listMediaFor, allMedia, deleteMedia, hydrateMediaHtml,
    listTags, ensureTag, setEntryTags,
    entriesOn, throwbacks,
  }
}
