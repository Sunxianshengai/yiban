import type { EntryV2, MediaFileV2, TagWordV2 } from '~/utils/db'
import { db, miscDb, computeTokens, htmlToPreview, newCloudId } from '~/utils/db'
import { journalFragment, journalHtml, stripAttachmentUrls } from '~/utils/journalHtml'

/** Local journal key: empty linkedAccountId (cloud accounts use their id, per original). */
export const LOCAL = ''

/**
 * 删除墓碑（客户端）。
 *
 * moveToTrash 会把行从 entriesV2 里真正删掉，云端就再也看不到它了 ——
 * 所以删之前把 id 记进这个列表，同步时作为「已删除」推上去，别的设备才会一起删掉。
 * 放在 localStorage 而不是 Dexie：它只是一份待推送队列，不需要查询能力。
 */
const TOMBSTONE_KEY = 'jr.cloudTombstones'

export function listTombstones(): string[] {
  try {
    const raw = localStorage.getItem(TOMBSTONE_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : []
  } catch {
    return []
  }
}

export function addTombstone(clientId: string) {
  const list = listTombstones()
  if (!list.includes(clientId)) list.push(clientId)
  localStorage.setItem(TOMBSTONE_KEY, JSON.stringify(list))
}

export function clearTombstones(ids: string[]) {
  const drop = new Set(ids)
  localStorage.setItem(TOMBSTONE_KEY, JSON.stringify(listTombstones().filter(id => !drop.has(id))))
}

/**
 * 附件删除墓碑。和日记墓碑同理：本地把行删了，云端（和别的设备）不知道；
 * 不记下来的话，下次同步拉回未删除的元数据，会把刚删掉的附件重新插回来。
 */
const MEDIA_TOMBSTONE_KEY = 'jr.cloudMediaTombstones'

export function listMediaTombstones(): string[] {
  try {
    const raw = localStorage.getItem(MEDIA_TOMBSTONE_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : []
  } catch {
    return []
  }
}

export function addMediaTombstone(clientId: string) {
  const list = listMediaTombstones()
  if (!list.includes(clientId)) list.push(clientId)
  localStorage.setItem(MEDIA_TOMBSTONE_KEY, JSON.stringify(list))
}

export function clearMediaTombstones(ids: string[]) {
  const drop = new Set(ids)
  localStorage.setItem(MEDIA_TOMBSTONE_KEY, JSON.stringify(listMediaTombstones().filter(id => !drop.has(id))))
}

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
  const entries = useState<EntryV2[]>('jr.globalEntries', () => [])

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
      // 云端主键跟着这篇日记走，不用自增 id（每台设备都会从 1 开始，多设备同步会互相覆盖）
      cloudId: newCloudId(),
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
      if (id != null && !current) throw new Error('这篇日记已不存在。')
      const key = id ?? await db.entriesV2.add(deProxy(row))
      const media = await listMediaFor(key)
      const kept = media.filter(item => item.id == null || !removedIds.has(item.id))
      if (files.length && kept.length + files.length > 20) throw new Error('每篇日记最多可添加 20 个附件。')
      await db.mediaFilesV2.bulkDelete(media.flatMap(item => item.id != null && removedIds.has(item.id) ? [item.id] : []))
      let position = Math.max(-1, ...kept.map(item => item.position)) + 1
      for (const file of files) await attachMedia(key, file, position++)
      if (current) {
        await db.entriesV2.update(key, deProxy({
          ...row,
          // 编辑不能换身份：row 里是新造的 cloudId，必须保留原有的，
          // 否则每次保存云端都多一行"新日记"，别的设备还会把旧行拉回来变成重复
          cloudId: current.cloudId || row.cloudId,
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
      const { id: _id, externalId: _externalId, cloudId: _cloudId, ...rest } = row
      // 副本是独立日记：必须换新 cloudId，否则推送时会覆盖原日记的云端行
      const copyId = await db.entriesV2.add({ ...rest, cloudId: newCloudId(), dateOfJournal: now, dateModified: now, synced: 0, ...computeTokens(now) })
      const map = new Map<number, number>()
      for (const media of await listMediaFor(id)) {
        const { id: mediaId, externalId: _mediaExternalId, cloudId: _mediaCloudId, ...file } = media
        const copyMediaId = await db.mediaFilesV2.add({ ...file, cloudId: newCloudId(), jId: copyId, uploaded: 0 })
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
    return miscDb.templates.add({
      name: `日记 ${new Date(row.dateOfJournal).toLocaleDateString('zh-CN')}`,
      content: stripAttachmentUrls(row.text, new Set((await listMediaFor(id)).flatMap(file => file.id == null ? [] : [file.id]))),
      contentType: 'html',
      updatedAt: new Date(),
    })
  }

  /** Soft delete per original trashesV2 model; snapshot enables restore. Returns trash row id for in-place undo. */
  async function moveToTrash(id: number) {
    const row = await db.entriesV2.get(id)
    if (!row) return
    let trashId: number | undefined
    await db.transaction('rw', db.entriesV2, db.trashesV2, async () => {
      trashId = await db.trashesV2.add({ linkedAccountId: LOCAL, type: row.type || 'journal', snapshot: row })
      await db.entriesV2.delete(id)
    })
    // 记墓碑：否则云端那一条永远不会被删。
    // 必须用 cloudId —— 云端唯一键是 (user_id, client_id)，client_id 是 cloudId；
    // 本地自增 id 每台设备都从 1 开始，拿它当墓碑会删错别的设备上的日记。
    addTombstone(row.cloudId || String(id))
    await refresh()
    return trashId
  }

  async function listTrash() {
    return db.trashesV2.toArray()
  }

  async function restoreFromTrash(trashId: number) {
    const row = await db.trashesV2.get(trashId)
    if (!row?.snapshot) return
    const { snapshot } = row
    // 恢复 = 一次新编辑：dateModified 刷新到当下。云端行可能已按墓碑标删，
    // 旧时间戳推不上去（服务端只收更新的 date_modified），下次 pull 会把刚恢复的本地行删掉。
    const revived: EntryV2 = { ...snapshot, dateModified: new Date(), synced: 0 }
    await db.transaction('rw', db.entriesV2, db.trashesV2, async () => {
      await db.entriesV2.add(revived)
      await db.trashesV2.delete(trashId)
    })
    // 墓碑还没推出去就恢复了：撤掉，否则推送数组里 live 行和墓碑同键并存，
    // 墓碑排后面、时间又相同，服务端会留下"已删除"的那条。
    if (revived.cloudId) clearTombstones([revived.cloudId])
    await refresh()
  }

  // ---- media ----
  async function attachMedia(entryId: number, file: File, position: number) {
    const ext = (file.name.split('.').pop() || '').toLowerCase()
    const row: MediaFileV2 = {
      linkedAccountId: LOCAL,
      cloudId: newCloudId(),
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
    const media = await db.mediaFilesV2.get(id)
    await db.transaction('rw', db.entriesV2, db.mediaFilesV2, async () => {
      if (!media || media.jId == null) return
      const entry = await db.entriesV2.get(media.jId)
      if (!entry) return
      const text = stripAttachmentUrls(entry.text, new Set([id]))
      await db.entriesV2.update(media.jId, { text, previewText: htmlToPreview(text), dateModified: new Date(), synced: 0 })
      await db.mediaFilesV2.delete(id)
    })
    // 记附件墓碑：云端和别的设备也要知道这个附件没了，否则下次同步会被拉回来
    if (media?.cloudId) addMediaTombstone(media.cloudId)
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
