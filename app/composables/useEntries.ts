import type { EntryV2, MediaFileV2, TagWordV2 } from '~/utils/db'
import { db, miscDb, computeTokens, htmlToPreview } from '~/utils/db'
import { journalFragment, journalHtml, stripAttachmentUrls } from '~/utils/journalHtml'

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
    out[k] = deProxy(v)
  }
  return out as T
}

export function useEntries() {
  const entries = ref<EntryV2[]>([])

  async function refresh() {
    entries.value = await db.entriesV2.orderBy('dateOfJournal').reverse().toArray()
  }

  async function saveEntry(id: number | undefined, text: string, date: Date, extra: Partial<EntryV2>, files: File[], removed: number[]) {
    const now = new Date()
    const removedIds = new Set(removed)
    const clean = stripAttachmentUrls(text.trim(), removedIds)
    const row: EntryV2 = {
      linkedAccountId: LOCAL,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
      type: 'journal',
      favourite: 0,
      ...extra,
      text: clean,
      previewText: htmlToPreview(clean),
      dateOfJournal: date,
      dateModified: now,
      synced: 0,
      ...computeTokens(date),
    }
    const entryId = await db.transaction('rw', db.entriesV2, db.mediaFilesV2, async () => {
      const current = id == null ? undefined : await db.entriesV2.get(id)
      if (id != null && !current) throw new Error('This entry no longer exists.')
      const key = id ?? await db.entriesV2.add(deProxy(row))
      const media = await listMediaFor(key)
      const kept = media.filter(item => item.id == null || !removedIds.has(item.id))
      if (files.length && kept.length + files.length > 20) throw new Error('Each entry can have up to 20 attachments.')
      await db.mediaFilesV2.bulkDelete(media.flatMap(item => item.id != null && removedIds.has(item.id) ? [item.id] : []))
      let position = Math.max(-1, ...kept.map(item => item.position)) + 1
      for (const file of files) await attachMedia(key, file, position++)
      if (current) {
        await db.entriesV2.update(key, deProxy({
          ...row,
          linkedAccountId: current.linkedAccountId,
          timezone: current.timezone,
          type: current.type,
          favourite: current.favourite,
        }))
      }
      return key
    })
    await refresh()
    return entryId
  }

  async function toggleFavourite(id: number) {
    const row = await db.entriesV2.get(id)
    if (!row) return
    await db.entriesV2.update(id, { favourite: row.favourite ? 0 : 1 })
    await refresh()
  }

  async function duplicateEntry(id: number) {
    const duplicateId = await db.transaction('rw', db.entriesV2, db.mediaFilesV2, async () => {
      const row = await db.entriesV2.get(id)
      if (!row) return
      const now = new Date()
      const { id: _id, externalId: _externalId, ...rest } = row
      const copyId = await db.entriesV2.add({ ...rest, dateOfJournal: now, dateModified: now, synced: 0, ...computeTokens(now) })
      const map = new Map<number, number>()
      for (const media of await listMediaFor(id)) {
        const { id: mediaId, externalId: _mediaExternalId, ...file } = media
        const copyMediaId = await db.mediaFilesV2.add({ ...file, jId: copyId, uploaded: 0 })
        if (mediaId != null) map.set(mediaId, copyMediaId)
      }
      const fragment = journalFragment(row.text)
      for (const node of fragment.querySelectorAll('[data-media-id]')) {
        const replacement = map.get(Number(node.getAttribute('data-media-id')))
        if (replacement == null) node.remove()
        else node.setAttribute('data-media-id', String(replacement))
      }
      await db.entriesV2.update(copyId, { text: stripAttachmentUrls(journalHtml(fragment)) })
      return copyId
    })
    await refresh()
    return duplicateId
  }

  async function saveAsTemplate(id: number) {
    const row = await db.entriesV2.get(id)
    if (!row) return
    await miscDb.templates.add({
      name: `Entry ${new Date(row.dateOfJournal).toLocaleDateString('en-US')}`,
      content: stripAttachmentUrls(row.text, new Set((await listMediaFor(id)).flatMap(file => file.id == null ? [] : [file.id]))),
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
    const dates = new Map((await db.entriesV2.toArray()).map(e => [e.id, +new Date(e.dateOfJournal)]))
    return (await db.mediaFilesV2.toArray())
      .filter(row => dates.has(row.jId))
      .sort((a, b) => dates.get(b.jId)! - dates.get(a.jId)! || a.position - b.position)
  }

  async function deleteMedia(id: number) {
    await db.transaction('rw', db.entriesV2, db.mediaFilesV2, async () => {
      const media = await db.mediaFilesV2.get(id)
      if (!media || media.jId == null) return
      const entry = await db.entriesV2.get(media.jId)
      if (!entry) return
      const text = stripAttachmentUrls(entry.text, new Set([id]))
      await db.entriesV2.update(media.jId, { text, previewText: htmlToPreview(text), dateModified: new Date(), synced: 0 })
      await db.mediaFilesV2.delete(id)
    })
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
    entries, refresh, saveEntry, toggleFavourite, duplicateEntry, saveAsTemplate,
    moveToTrash, listTrash, restoreFromTrash,
    listMediaFor, allMedia, deleteMedia,
    listTags, ensureTag, setEntryTags,
    entriesOn, throwbacks,
  }
}
