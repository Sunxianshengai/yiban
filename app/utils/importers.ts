import { strFromU8, unzipSync } from 'fflate'
import type { EntryV2 } from './db'
import { errorText } from './uiText'

export interface ImportedEntry {
  text: string
  date: Date
  favourite?: boolean
  tags?: string[]
  meta?: Partial<EntryV2>
  attachments?: File[]
}

export interface ParseResult {
  kind: string
  entries: ImportedEntry[]
  warnings?: string[]
}

type Data = Record<string, unknown>
type ResourceLookup = (stem: string, folder: string, archiveEntry: string) => File[]

const archiveLimit = 512 * 1024 * 1024
const attachmentLimit = 200 * 1024 * 1024
const importMimes: Record<string, string> = {
  jpeg: 'image/jpeg', jpg: 'image/jpeg', png: 'image/png', gif: 'image/gif', heic: 'image/heic',
  bmp: 'image/bmp', mp3: 'audio/mpeg', mp4: 'video/mp4', mov: 'video/quicktime',
}

const record = (value: unknown): Data => value && typeof value === 'object' && !Array.isArray(value) ? value as Data : {}
const list = (value: unknown): unknown[] => Array.isArray(value) ? value : []
const string = (value: unknown) => typeof value === 'string' ? value : ''
const number = (value: unknown) => typeof value === 'number' && Number.isFinite(value) ? value : undefined
const textTags = (value: unknown) => list(value).map(string).filter(tag => tag.trim())
const basename = (path: string) => path.replaceAll('\\', '/').split('/').pop() || ''
const extension = (name: string) => /\.([a-z0-9]+)$/i.exec(name)?.[1].toLowerCase() || ''
const filenameStem = (path: string) => basename(path).replace(/\.[^.]+$/, '')
const escapeHtml = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

function importDate(value: unknown) {
  const date = typeof value === 'number' || typeof value === 'string' ? new Date(value) : new Date(NaN)
  if (!Number.isFinite(+date)) throw new Error('日记日期无效')
  return date
}

function locationMeta(lat: unknown, lng: unknown) {
  const a = number(lat)
  const b = number(lng)
  return a != null && b != null && Math.abs(a) <= 90 && Math.abs(b) <= 180 ? { lat: a, lng: b } : {}
}

function collect(kind: string, rows: unknown[], convert: (row: unknown, warnings: string[]) => ImportedEntry, keepEmpty = false): ParseResult {
  const warnings: string[] = []
  const entries: ImportedEntry[] = []
  for (const [index, row] of rows.entries()) {
    try {
      const entry = convert(row, warnings)
      if (keepEmpty || entry.text.trim() || entry.attachments?.length) entries.push(entry)
    } catch (error) {
      warnings.push(`第 ${index + 1} 篇：${errorText(error, '无法读取日记')}。`)
    }
  }
  if (!entries.length) throw new Error(warnings[0] || '没有找到日记。')
  return { kind, entries, ...(warnings.length ? { warnings } : {}) }
}

export function mdToHtml(md: string): string {
  return escapeHtml(md.replace(/\r\n?/g, '\n'))
    .split(/\n{2,}/)
    .filter(para => para.trim())
    .map((para) => {
      const inline = para.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/\*(.+?)\*/g, '<i>$1</i>')
      const heading = /^(#{1,3}) (.+)$/.exec(inline)
      if (heading) return `<h${heading[1].length}>${heading[2]}</h${heading[1].length}>`
      return `<p>${inline.replace(/\n/g, '<br>')}</p>`
    })
    .join('')
}

function dayOneText(value: unknown) {
  return mdToHtml(string(value).replace(/!\[[^\]]*\]\(dayone-moment:\/\/[^)]*\)/g, '').trim())
}

function dayOneRows(data: Data) {
  const rows = list(data.entries)
  return rows.some(row => {
    const entry = record(row)
    return (typeof entry.creationDate === 'string' && typeof entry.text === 'string') || Array.isArray(entry.photos)
  }) ? rows : []
}

function parseDayOne(data: Data, archiveEntry?: string, lookup?: ResourceLookup): ParseResult {
  return collect('dayone', dayOneRows(data), (value, warnings) => {
    const row = record(value)
    const location = record(row.location)
    const ids = [...new Set(list(row.photos).map(photo => string(record(photo).md5)).filter(Boolean))]
    const attachments = archiveEntry && lookup ? ids.flatMap(id => lookup(id, 'photos', archiveEntry)) : []
    if (ids.length && attachments.length < ids.length) warnings.push('缺少部分 Day One 照片。请使用包含照片文件夹的原始 ZIP。')
    return {
      text: dayOneText(row.text), date: importDate(row.creationDate ?? row.date ?? Date.now()), favourite: row.starred === true, tags: textTags(row.tags), attachments,
      meta: { address: string(location.placeName), timezone: string(row.timeZone), ...locationMeta(location.latitude, location.longitude) },
    }
  })
}

export function parseImport(data: unknown): ParseResult {
  const root = record(data)
  if (dayOneRows(root).length) return parseDayOne(root)
  if (root.schemaVersion === 2 && root.encrypted) throw new Error('请先在原应用中解密旅程日记。')
  let rows: unknown[]
  let kind: string
  if (root.format === 'journey-replica-json' && Array.isArray(root.entries)) {
    kind = 'journey-replica'; rows = root.entries
  } else if (root.schemaVersion === 2 || root.date_journal != null) {
    kind = root.schemaVersion === 2 ? 'journey-v2' : 'journey-v1'; rows = [root]
  } else if (Array.isArray(root.journals)) {
    kind = 'journey-v1'; rows = root.journals
  } else if (Array.isArray(data)) {
    kind = 'generic-entries'; rows = data
  } else {
    throw new Error('无法识别日记的 JSON 结构。')
  }
  return collect(kind, rows, (value) => {
    const row = record(value)
    const body = string(row.text) || string(row.content)
    const location = record(row.location)
    const weather = record(row.weather)
    const music = record(row.music)
    return {
      text: row.type === 'markdown' ? mdToHtml(body) : body,
      date: importDate(row.date_journal ?? row.dateOfJournal ?? row.createdDate ?? row.date ?? Date.now()),
      favourite: !!(row.starred || row.favourite), tags: textTags(row.tags),
      meta: {
        timezone: string(row.timezone), address: string(row.address),
        ...locationMeta(location.lat ?? row.lat, location.lng ?? row.lng ?? row.lon),
        musicArtist: string(music.artist ?? row.music_artist ?? row.musicArtist), musicTitle: string(music.title ?? row.music_title ?? row.musicTitle),
        weatherId: number(weather.id ?? row.weatherId), weatherDegreeC: number(weather.degreeC ?? weather.degree_c ?? row.weatherDegreeC),
        weatherDescription: string(weather.description ?? row.weatherDescription), weatherIcon: string(weather.icon ?? row.weatherIcon),
        weatherPlace: string(weather.place ?? row.weatherPlace), activity: string(row.activity), sentiment: string(row.sentiment),
      },
    }
  })
}

function parseCsv(source: string) {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  for (let i = 0; i < source.length; i++) {
    const ch = source[i]
    if (ch === '"') {
      if (quoted && source[i + 1] === '"') { field += '"'; i++ }
      else if (quoted || !field) quoted = !quoted
      else field += ch
    } else if (quoted) field += ch
    else if (ch === ',') { row.push(field); field = '' }
    else if (ch === '\r' || ch === '\n') {
      if (ch === '\r' && source[i + 1] === '\n') i++
      row.push(field); rows.push(row); row = []; field = ''
    } else field += ch
  }
  if (quoted) throw new Error('CSV 字段的引号未闭合。')
  if (row.length || field) rows.push([...row, field])
  return rows
}

const daylioMood: Record<string, string> = { rad: 'excited', good: 'happy', meh: 'neutral', fugly: 'sad', awful: 'down' }
const months = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december']

function daylioDate(fields: Record<string, string>) {
  const date = (fields.full_date || fields.date || '').trim()
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date)
  const english = /^(?:[a-z]+,\s*)?([a-z]+)\s+(\d{1,2})(?:,?\s+(\d{4}))?$/i.exec(date)
  const time = /^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(am|pm)?$/i.exec((fields.time || '00:00').trim())
  if ((!iso && !english) || !time) throw new Error('日记日期或时间无效')
  const year = Number(iso?.[1] || english?.[3] || fields.year)
  const name = english?.[1].toLowerCase()
  const month = iso ? Number(iso[2]) - 1 : months.findIndex(month => month === name || month.slice(0, 3) === name)
  const day = Number(iso?.[3] || english?.[2])
  const hours = Number(time[1])
  const minutes = Number(time[2])
  const seconds = Number(time[3] || 0)
  const half = time[4]?.toLowerCase()
  if (!Number.isInteger(year) || month < 0 || (half && (hours < 1 || hours > 12)) || (!half && hours > 23) || minutes > 59 || seconds > 59) {
    throw new Error('日记日期或时间无效')
  }
  const result = new Date(year, month, day, half ? hours % 12 + (half === 'pm' ? 12 : 0) : hours, minutes, seconds)
  if (result.getMonth() !== month || result.getDate() !== day) throw new Error('日记日期无效')
  return result
}

function parseDaylio(source: string) {
  const [heading = [], ...rows] = parseCsv(source.replace(/^\uFEFF/, ''))
  const headers = heading.map(name => name.trim().toLowerCase())
  if (!headers.includes('mood') || !headers.includes('note') || !(headers.includes('date') || headers.includes('full_date'))) {
    throw new Error('该 CSV 缺少 Daylio 导出所需的列。')
  }
  return collect('daylio', rows.filter(row => row.some(Boolean)), (value) => {
    const fields = Object.fromEntries((value as string[]).map((field, i) => [headers[i], field]))
    const text = escapeHtml(fields.note || '').replace(/\r?\n/g, '<br>')
    const title = fields.note_title?.trim()
    return {
      text: (title ? `<h1>${escapeHtml(title)}</h1>` : '') + (text ? `<p>${text}</p>` : ''), date: daylioDate(fields),
      meta: { sentiment: daylioMood[(fields.mood || '').trim().toLowerCase()] },
    }
  }, true)
}

function xmlDocument(source: string) {
  const doc = new DOMParser().parseFromString(source, 'application/xml')
  if (doc.querySelector('parsererror')) throw new Error('XML 内容无效。')
  return doc
}

function parseEvernote(source: string) {
  const doc = xmlDocument(source)
  if (doc.documentElement.localName !== 'en-export') throw new Error('Evernote 导出文件结构无效。')
  return collect('evernote', Array.from(doc.documentElement.children).filter(node => node.localName === 'note'), (value, warnings) => {
    const note = value as Element
    const direct = (name: string) => Array.from(note.children).filter(node => node.localName === name)
    const get = (name: string) => direct(name)[0]?.textContent || ''
    const title = get('title')
    const body = get('content').replace(/^\s*<\?xml[^>]*\?>/i, '').replace(/<!DOCTYPE\s+en-note[^>]*>/i, '').replace(/<\/?en-note\b[^>]*>/gi, '').replace(/<en-media\b[^>]*>\s*(?:<\/en-media>)?/gi, '')
    const created = get('created').trim().replace(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/, '$1-$2-$3T$4:$5:$6Z')
    const attachments: File[] = []
    for (const [index, resource] of direct('resource').entries()) {
      const mime = resource.querySelector('mime')?.textContent?.trim() || ''
      const encoded = resource.querySelector('data')?.textContent?.replace(/\s/g, '') || ''
      const label = basename(resource.querySelector('file-name')?.textContent || '')
      if (!encoded || !/^(?:image|video|audio)\//.test(mime) || mime === 'image/svg+xml') {
        warnings.push(`已跳过不支持的 Evernote 附件：${label || index + 1}。`)
        continue
      }
      if (encoded.length > Math.ceil(attachmentLimit / 3) * 4) {
        warnings.push(`已跳过超过 200 MB 的 Evernote 附件：${label || index + 1}。`)
        continue
      }
      try {
        const decoded = Uint8Array.from(atob(encoded), char => char.charCodeAt(0))
        const ext = Object.keys(importMimes).find(key => importMimes[key] === mime) || mime.split('/')[1].replace(/[^a-z0-9]/gi, '')
        if (decoded.byteLength > attachmentLimit) throw new Error('附件超过 200 MB')
        attachments.push(new File([decoded], label || `attachment-${index + 1}.${ext}`, { type: mime }))
      } catch {
        warnings.push(`已跳过无效的 Evernote 附件：${label || index + 1}。`)
      }
    }
    return { text: (title ? `<h1>${escapeHtml(title)}</h1>` : '') + body, date: importDate(created), tags: direct('tag').map(node => node.textContent || '').filter(Boolean), attachments }
  })
}

function readPlist(node: Element): unknown {
  const children = Array.from(node.children)
  if (node.localName === 'dict') {
    const result: Data = Object.create(null)
    for (let i = 0; i + 1 < children.length; i += 2) {
      if (children[i].localName !== 'key') throw new Error('Day One 经典版的属性列表无效。')
      result[children[i].textContent || ''] = readPlist(children[i + 1])
    }
    return result
  }
  if (node.localName === 'array') return children.map(readPlist)
  if (node.localName === 'true' || node.localName === 'false') return node.localName === 'true'
  if (node.localName === 'integer' || node.localName === 'real') return Number(node.textContent)
  return node.textContent || ''
}

function classicEntry(source: string, attachments: File[]): ImportedEntry {
  const doc = xmlDocument(source)
  const node = doc.documentElement.firstElementChild
  if (doc.documentElement.localName !== 'plist' || node?.localName !== 'dict') throw new Error('Day One 经典版的属性列表无效。')
  const row = record(readPlist(node))
  const loc = record(row.Location)
  return {
    text: dayOneText(row['Entry Text']), date: importDate(row['Creation Date']), favourite: row.Starred === true,
    tags: textTags(row.Tags), attachments,
    meta: { address: string(loc['Place Name']), timezone: string(row['Time Zone']), ...locationMeta(loc.Latitude, loc.Longitude) },
  }
}

function safeZipPath(path: string) {
  return !path.startsWith('/') && !path.includes('\\') && !path.includes(':') && !path.includes('\0')
    && path.split('/').every(part => part && part !== '.' && part !== '..' && part !== '__MACOSX')
}

function parseThirdPartyZip(input: ArrayBuffer): ParseResult | null {
  let bytes = 0
  let count = 0
  const assetPaths = new Map<string, string[]>()
  const warnings: string[] = []
  const source = new Uint8Array(input)
  const files = unzipSync(source, { filter: item => {
    const path = item.name
    if (!safeZipPath(path)) return false
    bytes += item.originalSize
    if (++count > 20000 || bytes > archiveLimit) throw new Error('压缩包超过支持的导入大小。')
    const ext = extension(path)
    if (importMimes[ext] && /(?:^|\/)(?:photos|Resources)\/[^/]+$/i.test(path)) {
      if (item.originalSize > attachmentLimit) warnings.push(`已跳过超过 200 MB 的附件：${basename(path)}。`)
      else {
        const folder = path.split('/').at(-2)!.toLowerCase()
        const key = folder + '/' + filenameStem(path).toLowerCase()
        const names = assetPaths.get(key) || []
        names.push(path)
        assetPaths.set(key, names)
      }
    }
    return ext === 'json' || ext === 'doentry' || (ext === 'html' && /(?:^|\/)Entries\/[^/]+$/i.test(path))
  } })
  const paths = Object.keys(files)
  const read = (path: string) => strFromU8(files[path])
  const wanted = new Set<string>()
  const resolved = new Map<string, File>()
  const locate = (stem: string, folder: string, archiveEntry: string) => {
    const parent = archiveEntry.slice(0, archiveEntry.lastIndexOf('/') + 1)
    const root = parent.replace(/Entries\/$/i, '')
    const candidates = assetPaths.get(folder.toLowerCase() + '/' + stem.toLowerCase()) || []
    const preferred = candidates.filter(path => path.slice(0, path.lastIndexOf('/') + 1).toLowerCase() === (root + folder + '/').toLowerCase())
    return preferred.length ? preferred : candidates
  }
  const json = paths.filter(path => extension(path) === 'json').sort().flatMap(path => {
    try {
      const parsed = record(JSON.parse(read(path)))
      return dayOneRows(parsed).length ? [{ path, parsed }] : []
    } catch { return [] }
  })
  const classic = paths.filter(path => extension(path) === 'doentry')
  const apple = paths.filter(path => extension(path) === 'html').flatMap(path => {
    const template = document.createElement('template')
    template.innerHTML = read(path)
    const doc = template.content
    const heading = doc.querySelector('.pageHeader')?.textContent?.trim()
    const body = doc.querySelector('.bodyText')
    return heading && body && Number.isFinite(+new Date(heading)) ? [{ path, doc, heading, body }] : []
  })
  if (!json.length && !classic.length && !apple.length) return null

  for (const { path, parsed } of json) {
    for (const entry of dayOneRows(parsed)) {
      for (const photo of list(record(entry).photos)) {
        const md5 = string(record(photo).md5)
        if (md5) locate(md5, 'photos', path).forEach(name => wanted.add(name))
      }
    }
  }
  for (const path of classic) locate(filenameStem(path), 'photos', path).forEach(name => wanted.add(name))
  const appleAssets = (doc: ParentNode, path: string) => Array.from(doc.querySelectorAll('img[src]:not(.mediaPlayIcon), video source[src], audio source[src]'))
    .flatMap(node => {
      const name = basename(node.getAttribute('src') || '')
      return name ? locate(filenameStem(name), 'Resources', path).filter(asset => basename(asset).toLowerCase() === name.toLowerCase()) : []
    })
  for (const { doc, path } of apple) appleAssets(doc, path).forEach(name => wanted.add(name))
  if (wanted.size) {
    const assets = unzipSync(source, { filter: item => wanted.has(item.name) })
    for (const [path, bytes] of Object.entries(assets)) {
      const type = importMimes[extension(path)]
      resolved.set(path, new File([new Uint8Array(bytes)], basename(path), { type }))
      if (type === 'image/heic') warnings.push(`HEIC 附件 ${basename(path)} 已按原格式保留，浏览器可能无法预览。`)
    }
  }
  const getFiles = (paths: string[]) => [...new Set(paths)].flatMap(path => resolved.get(path) || [])
  const lookup: ResourceLookup = (stem, folder, path) => getFiles(locate(stem, folder, path))

  if (json.length) {
    const reports = json.map(({ path, parsed }) => parseDayOne(parsed, path, lookup))
    return { kind: 'dayone', entries: reports.flatMap(result => result.entries), warnings: [...warnings, ...reports.flatMap(result => result.warnings || [])] }
  }
  if (classic.length) {
    const result = collect('dayone-classic', classic, value => {
      const path = value as string
      return classicEntry(read(path), lookup(filenameStem(path), 'photos', path))
    })
    return { ...result, warnings: [...warnings, ...(result.warnings || [])] }
  }
  const result = collect('apple-journal', apple, value => {
    const { path, doc, heading, body } = value as typeof apple[number]
    const title = doc.querySelector('.title')?.textContent || ''
    const attachments = getFiles(appleAssets(doc, path))
    body.querySelectorAll('img, video, audio').forEach(node => node.remove())
    return { text: (title ? `<h1>${escapeHtml(title)}</h1>` : '') + body.innerHTML, date: importDate(heading), attachments }
  })
  return { ...result, warnings: [...warnings, ...(result.warnings || [])] }
}

export async function parseImportFile(file: File): Promise<ParseResult | null> {
  if (file.size > archiveLimit) throw new Error('导入文件超过 512 MB。')
  const ext = extension(file.name)
  if (ext === 'zip') return parseThirdPartyZip(await file.arrayBuffer())
  const source = await file.text()
  if (ext === 'json') return parseImport(JSON.parse(source))
  if (ext === 'csv') return parseDaylio(source)
  if (ext === 'enex') return parseEvernote(source)
  if (ext === 'doentry') return collect('dayone-classic', [source], value => classicEntry(value as string, []))
  throw new Error('不支持此导入文件类型。')
}
