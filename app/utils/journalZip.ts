import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate'
import { db, computeTokens, htmlToPreview } from './db'
import type { EntryV2, MediaFileV2 } from './db'
import { journalFragment, journalHtml } from './journalHtml'
import type { ImportedEntry } from './importers'
import { journalActivity, journalSentiment } from './journalOptions'
import { saveDesktopDocument } from './desktopBridge'

const archiveLimit = 512 * 1024 * 1024
const attachmentMime: Record<string, string> = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', bmp: 'image/bmp', heic: 'image/heic',
  webp: 'image/webp', avif: 'image/avif', mp3: 'audio/mpeg', mp4: 'video/mp4', mov: 'video/quicktime',
  wav: 'audio/wav', ogg: 'audio/ogg', m4a: 'audio/mp4', webm: 'video/webm',
}

function portableText(html: string) {
  const fragment = journalFragment(html)
  fragment.querySelectorAll('[data-media-id]').forEach(node => node.remove())
  return journalHtml(fragment)
}

function extension(name: string) { return name.split('.').pop()?.toLowerCase() || '' }

export async function downloadJournalFile(blob: Blob, name: string) {
  const saved = await saveDesktopDocument(blob, name)
  if (saved != null) return saved
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = name
  anchor.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  return true
}

export async function exportJournalZip(entryId?: number) {
  const [entries, media, tags] = await db.transaction('r', db.entriesV2, db.mediaFilesV2, db.tagWordsV2, () => Promise.all([
    entryId == null ? db.entriesV2.toArray() : db.entriesV2.where('id').equals(entryId).toArray(),
    entryId == null ? db.mediaFilesV2.toArray() : db.mediaFilesV2.where('jId').equals(entryId).toArray(),
    db.tagWordsV2.toArray(),
  ]))
  if (!entries.length) throw new Error('没有可导出的日记。')
  const ids = new Set(entries.map(entry => entry.id))
  const assets = media.filter(row => ids.has(row.jId) && row.blob)
  if (assets.reduce((bytes, row) => bytes + row.blob!.size, 0) > archiveLimit) {
    throw new Error('压缩包超过 512 MB。请减少每次导出的日记数量。')
  }
  const tagTitles = new Map(tags.map(tag => [tag.id, tag.title]))
  const files: Record<string, Uint8Array> = Object.create(null)
  let lastStem = ''
  for (const entry of entries) {
    const stem = `${+new Date(entry.dateOfJournal)}-${String(entry.id).padStart(16, '0')}`
    lastStem = stem
    const photos: string[] = []
    const replicaMedia: Record<string, { name: string; mime: string }> = Object.create(null)
    for (const asset of assets.filter(row => row.jId === entry.id).sort((a, b) => a.position - b.position)) {
      const ext = asset.ext?.match(/^[a-z0-9]{1,12}$/i)?.[0].toLowerCase() || 'bin'
      const path = `${stem}-${String(asset.id).padStart(16, '0')}.${ext}`
      files[path] = new Uint8Array(await asset.blob!.arrayBuffer())
      photos.push(path)
      replicaMedia[path] = { name: asset.fileName, mime: asset.mimeType }
    }
    files[`${stem}.json`] = strToU8(JSON.stringify({
      id: stem, date_modified: +new Date(entry.dateModified), date_journal: +new Date(entry.dateOfJournal),
      timezone: entry.timezone, text: portableText(entry.text), preview_text: entry.previewText,
      mood: journalActivity(entry.activity)?.code ?? 0, lat: entry.lat ?? Number.MAX_VALUE, lon: entry.lng ?? Number.MAX_VALUE,
      address: entry.address || '', label: '', folder: '', sentiment: journalSentiment(entry.sentiment)?.code ?? 0,
      favourite: !!entry.favourite, music_title: entry.musicTitle || '', music_artist: entry.musicArtist || '',
      photos, weather: { id: entry.weatherId ?? -1, degree_c: entry.weatherDegreeC ?? Number.MAX_VALUE, description: entry.weatherDescription || '', icon: entry.weatherIcon || '', place: entry.weatherPlace || '' },
      tags: (entry.tagWordIds || []).flatMap(id => tagTitles.get(id) || []), type: 'html',
      replica: { activity: entry.activity, media: replicaMedia },
    }))
  }
  const zipped = zipSync(files, { level: 0 })
  const name = entryId == null ? `journey-multiple-${Date.now()}.zip` : `journey-single-${lastStem}.zip`
  return downloadJournalFile(new Blob([new Uint8Array(zipped)], { type: 'application/zip' }), name)
}

interface ImportedZipEntry {
  data: Partial<EntryV2>
  date: Date
  tags: string[]
  media: Omit<MediaFileV2, 'id' | 'jId' | 'linkedAccountId' | 'createdAt' | 'position' | 'uploaded'>[]
}

function validPath(path: string) {
  return !path.startsWith('/') && !path.includes('\\') && path.split('/').every(part => part && part !== '.' && part !== '..')
}

const string = (value: unknown) => typeof value === 'string' ? value : undefined
const number = (value: unknown) => typeof value === 'number' && Number.isFinite(value) ? value : undefined

function readBackup(file: ArrayBuffer) {
  let bytes = 0
  let count = 0
  const files = unzipSync(new Uint8Array(file), { filter: item => {
    if (!validPath(item.name)) return false
    bytes += item.originalSize
    if (++count > 20000 || bytes > archiveLimit) throw new Error('压缩包超过支持的备份大小。')
    return true
  } })
  const out: ImportedZipEntry[] = []
  const paths = Object.keys(files)
  function readEntry(raw: Record<string, any>, path: string, format: 'v1' | 'v2' | 'replica') {
    const date = new Date(raw.date_journal ?? raw.dateOfJournal)
    if (!Number.isFinite(+date)) throw new Error(`文件 ${path} 中的日记日期无效。`)
    const directory = path.slice(0, path.lastIndexOf('/') + 1)
    const stem = path.slice(directory.length, -5)
    const siblings = paths.filter(name => name.startsWith(directory) && !name.slice(directory.length).includes('/') && attachmentMime[extension(name)])
    const names = format === 'replica' && Array.isArray(raw.media) ? raw.media
      : format === 'v1' && Array.isArray(raw.photos) ? raw.photos.map((name: unknown) => typeof name === 'string' ? `${directory}${name}` : '')
        : siblings.filter(name => format === 'v2' || name.slice(directory.length).startsWith(stem))
    const media = [...new Set<string>(names.filter((name: unknown): name is string => typeof name === 'string' && validPath(name)))].flatMap(name => {
      const content = files[name]
      const ext = extension(name)
      const mime = string(raw.replica?.media?.[name.slice(directory.length)]?.mime) || attachmentMime[ext]
      if (!content || !mime || !/^(image|audio|video)\//.test(mime) || mime === 'image/svg+xml') return []
      return [{ fileName: string(raw.replica?.media?.[name.slice(directory.length)]?.name) || name.split('/').pop()!, mimeType: mime, ext, blob: new Blob([new Uint8Array(content)], { type: mime }) }]
    })
    const lat = number(raw.location?.lat ?? raw.lat)
    const lng = number(raw.location?.lng ?? raw.lng ?? raw.lon)
    out.push({
      date, tags: Array.isArray(raw.tags) ? raw.tags.filter((tag: unknown): tag is string => typeof tag === 'string' && !!tag.trim()) : [], media,
      data: {
        text: portableText(string(raw.text) || ''), timezone: string(raw.timezone), favourite: raw.favourite ? 1 : 0,
        address: string(raw.address), lat: lat != null && Math.abs(lat) <= 90 ? lat : undefined,
        lng: lng != null && Math.abs(lng) <= 180 ? lng : undefined,
        musicArtist: string(raw.music?.artist ?? raw.music_artist), musicTitle: string(raw.music?.title ?? raw.music_title),
        sentiment: journalSentiment(raw.sentiment)?.value ?? string(raw.sentiment),
        activity: journalActivity(raw.replica?.activity ?? raw.activity ?? raw.mood)?.value ?? string(raw.replica?.activity ?? raw.activity),
        weatherId: number(raw.weather?.id), weatherIcon: string(raw.weather?.icon ?? raw.weatherIcon),
        weatherDescription: string(raw.weather?.description), weatherDegreeC: number(raw.weather?.degreeC ?? raw.weather?.degree_c ?? raw.weatherDegreeC) === Number.MAX_VALUE ? undefined : number(raw.weather?.degreeC ?? raw.weather?.degree_c ?? raw.weatherDegreeC),
        weatherPlace: string(raw.weather?.place ?? raw.weatherPlace),
      },
    })
  }
  const manifest = files['manifest.json'] ? JSON.parse(strFromU8(files['manifest.json'])) : null
  if (manifest?.format === 'journey-replica-zip' && Array.isArray(manifest.entries)) {
    for (const raw of manifest.entries) {
      if (!Number.isInteger(raw.id) || !files[`entries/${raw.id}.html`]) throw new Error('备份缺少日记的 HTML 文件。')
      readEntry({ ...raw, text: strFromU8(files[`entries/${raw.id}.html`]) }, `entries/${raw.id}.json`, 'replica')
    }
  } else {
    for (const path of paths.filter(name => name.endsWith('.json') && !name.startsWith('__MACOSX/'))) {
      const raw = JSON.parse(strFromU8(files[path]!))
      if (raw?.schemaVersion === 2 && raw.encrypted) throw new Error('请先在原应用中解密旅程日记备份。')
      if (raw?.schemaVersion === 2) readEntry(raw, path, 'v2')
      else if (raw && typeof raw.id === 'string' && raw.date_journal != null && Array.isArray(raw.photos)) readEntry(raw, path, 'v1')
    }
  }
  if (!out.length) throw new Error('ZIP 中没有找到支持的旅程日记。')
  return out
}

export async function importJournalZip(file: File) {
  if (file.size > archiveLimit) throw new Error('压缩包超过 512 MB。')
  return writeImportedEntries(readBackup(await file.arrayBuffer()))
}

export function importJournalEntries(entries: ImportedEntry[]) {
  return writeImportedEntries(entries.map(row => ({
    date: row.date,
    tags: row.tags || [],
    data: { ...row.meta, text: portableText(row.text), favourite: row.favourite ? 1 : 0 },
    media: (row.attachments || []).map(file => ({ fileName: file.name, mimeType: file.type, ext: extension(file.name), blob: file })),
  })))
}

async function writeImportedEntries(entries: ImportedZipEntry[]) {
  await db.transaction('rw', db.entriesV2, db.mediaFilesV2, db.tagWordsV2, async () => {
    for (const row of entries) {
      const tagWordIds: number[] = []
      for (const title of new Set(row.tags.map(tag => tag.trim().toLowerCase()))) {
        const existing = await db.tagWordsV2.where('[linkedAccountId+title]').equals(['', title]).first()
        tagWordIds.push(existing?.id ?? await db.tagWordsV2.add({ title, linkedAccountId: '' }))
      }
      const { id: _id, externalId: _externalId, ...metadata } = row.data
      const id = await db.entriesV2.add({
        ...metadata, text: row.data.text || '', previewText: htmlToPreview(row.data.text || ''),
        timezone: row.data.timezone || 'UTC', dateOfJournal: row.date, dateModified: new Date(),
        linkedAccountId: '', synced: 0, type: 'journal', tagWordIds, ...computeTokens(row.date),
      })
      await db.mediaFilesV2.bulkAdd(row.media.map((media, position) => ({
        ...media, jId: id, linkedAccountId: '', position, uploaded: 0, createdAt: new Date(),
      })))
    }
  })
  return entries.length
}
