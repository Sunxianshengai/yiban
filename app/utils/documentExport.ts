import { strToU8, zipSync } from 'fflate'
import type { IRunOptions, ParagraphChild, Paragraph, Table } from 'docx'
import { db } from './db'
import type { MediaFileV2 } from './db'
import { journalFragment, renderJournal } from './journalHtml'
import { downloadJournalFile } from './journalZip'

type ExportFormat = 'docx' | 'epub' | 'pdf'
type TextStyle = Pick<IRunOptions, 'bold' | 'italics' | 'underline' | 'strike' | 'font' | 'color'>

const epubImages: Record<string, string> = {
  'image/jpeg': 'jpg', 'image/png': 'png', 'image/gif': 'gif', 'image/webp': 'webp',
}
const epubAudio: Record<string, string> = { 'audio/mpeg': 'mp3', 'audio/mp4': 'm4a' }
const primary = '#00687B'

async function entryData(id: number) {
  const [entry, media, allTags] = await db.transaction('r', db.entriesV2, db.mediaFilesV2, db.tagWordsV2, () => Promise.all([
    db.entriesV2.get(id),
    db.mediaFilesV2.where('jId').equals(id).sortBy('position'),
    db.tagWordsV2.toArray(),
  ]))
  if (!entry) throw new Error('Entry no longer exists.')
  const date = new Date(entry.dateOfJournal)
  const heading = new Intl.DateTimeFormat('en-US', { dateStyle: 'long', timeStyle: 'short' }).format(date)
  const tags = allTags.filter(tag => entry.tagWordIds?.includes(tag.id!)).map(tag => '#' + tag.title).join(' ')
  const lines = [entry.timezone, entry.address, tags].filter((value): value is string => Boolean(value))
  return { entry, heading, lines, media, fileName: 'journey-' + date.toISOString().slice(0, 10) + '-' + id }
}
type EntryData = Awaited<ReturnType<typeof entryData>>

function clearUnpackagedMedia(fragment: DocumentFragment, urls: Set<string>) {
  for (const element of fragment.querySelectorAll('img, video, audio, source, picture')) {
    if (element.tagName === 'PICTURE' || element.tagName === 'SOURCE') {
      element.replaceWith(...element.childNodes)
      continue
    }
    element.removeAttribute('srcset')
    element.removeAttribute('poster')
    if (!urls.has(element.getAttribute('src') || '')) {
      const label = element.getAttribute('alt') || element.getAttribute('aria-label')
      element.replaceWith(document.createTextNode(label || ''))
    }
  }
}

function renderedEntry(data: EntryData, assetUrls: Map<number, string>) {
  const template = document.createElement('template')
  template.innerHTML = renderJournal(data.entry.text, data.media, asset => assetUrls.get(asset.id!))
  clearUnpackagedMedia(template.content, new Set(assetUrls.values()))
  return template.content
}

function textColor(color: string) {
  const rgb = color.match(/^rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/)
  if (rgb) return rgb.slice(1).map(value => Number(value).toString(16).padStart(2, '0')).join('').toUpperCase()
  return /^#[0-9a-f]{6}$/i.test(color) ? color.slice(1).toUpperCase() : undefined
}

async function docxImage(row: MediaFileV2) {
  if (!row.blob || !row.mimeType.startsWith('image/') || row.mimeType === 'image/svg+xml') return
  const url = URL.createObjectURL(row.blob)
  try {
    const image = new Image()
    image.src = url
    await image.decode()
    const scale = Math.min(1, 560 / image.naturalWidth, 600 / image.naturalHeight)
    const width = Math.max(1, Math.round(image.naturalWidth * scale))
    const height = Math.max(1, Math.round(image.naturalHeight * scale))
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.drawImage(image, 0, 0, width, height)
    const png = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'))
    if (png) return { png: new Uint8Array(await png.arrayBuffer()), width, height }
  } catch {
    return
  } finally {
    URL.revokeObjectURL(url)
  }
}

async function exportDocx(data: EntryData) {
  const {
    Document: WordDocument, Packer, Paragraph, TextRun, ImageRun, Table, TableRow, TableCell,
    ExternalHyperlink, HeadingLevel, AlignmentType, LevelFormat, BorderStyle,
  } = await import('docx')
  const headings = [HeadingLevel.HEADING_1, HeadingLevel.HEADING_2, HeadingLevel.HEADING_3, HeadingLevel.HEADING_4, HeadingLevel.HEADING_5, HeadingLevel.HEADING_6]
  const alignments: Record<string, (typeof AlignmentType)[keyof typeof AlignmentType]> = {
    left: AlignmentType.LEFT, center: AlignmentType.CENTER, right: AlignmentType.RIGHT, justify: AlignmentType.JUSTIFIED,
  }
  const fragment = journalFragment(data.entry.text)
  fragment.querySelectorAll('[data-media-id]').forEach(node => node.remove())

  function inline(node: Node, style: TextStyle = {}): ParagraphChild[] {
    if (node.nodeType === Node.TEXT_NODE) return node.textContent ? [new TextRun({ text: node.textContent, ...style })] : []
    if (!(node instanceof HTMLElement)) return []
    const tag = node.tagName
    if (tag === 'BR') return [new TextRun({ break: 1 })]
    if (tag === 'IMG') return node.getAttribute('alt') ? [new TextRun({ text: node.getAttribute('alt') || '', italics: true })] : []
    const childStyle: TextStyle = { ...style }
    if (tag === 'B' || tag === 'STRONG' || /^(?:bold|[7-9]00)$/.test(node.style.fontWeight)) childStyle.bold = true
    if (tag === 'I' || tag === 'EM' || node.style.fontStyle === 'italic') childStyle.italics = true
    if (tag === 'U' || node.style.textDecoration.includes('underline')) childStyle.underline = {}
    if (['S', 'DEL', 'STRIKE'].includes(tag) || node.style.textDecoration.includes('line-through')) childStyle.strike = true
    if (tag === 'CODE' || tag === 'PRE') childStyle.font = 'Courier New'
    const color = textColor(node.style.color || node.getAttribute('color') || '')
    if (color) childStyle.color = color
    const children = Array.from(node.childNodes).flatMap(child => inline(child, childStyle))
    const href = node.getAttribute('href') || ''
    if (tag === 'A' && /^(?:https?:\/\/|mailto:)/i.test(href)) return [new ExternalHyperlink({ link: href, children })]
    return children
  }

  let listInstance = 0
  function wordList(element: HTMLElement, depth = 0): Paragraph[] {
    const ordered = element.tagName === 'OL'
    const instance = ++listInstance
    const level = Math.min(depth, 8)
    return Array.from(element.children).filter(child => child.tagName === 'LI').flatMap(item => {
      const children = Array.from(item.childNodes).filter(node => !(node instanceof HTMLElement && /^(UL|OL)$/.test(node.tagName))).flatMap(node => inline(node))
      const nested = Array.from(item.children).filter((child): child is HTMLElement => child instanceof HTMLElement && /^(UL|OL)$/.test(child.tagName))
      return [new Paragraph({ children, ...(ordered ? { numbering: { reference: 'journal-numbered', level, instance } } : { bullet: { level } }) }),
        ...nested.flatMap(child => wordList(child, depth + 1))]
    })
  }

  function blocks(container: ParentNode): (Paragraph | Table)[] {
    const output: (Paragraph | Table)[] = []
    let pending: ParagraphChild[] = []
    function flush() {
      if (pending.length) output.push(new Paragraph({ children: pending }))
      pending = []
    }
    for (const node of container.childNodes) {
      if (!(node instanceof HTMLElement)) {
        if (node.textContent?.trim() || pending.length) pending.push(...inline(node))
        continue
      }
      const tag = node.tagName
      if (!/^(P|H[1-6]|DIV|SECTION|ARTICLE|UL|OL|BLOCKQUOTE|HR|PRE|TABLE)$/.test(tag)) {
        pending.push(...inline(node))
        continue
      }
      flush()
      if (tag === 'UL' || tag === 'OL') output.push(...wordList(node))
      else if (node instanceof HTMLTableElement) {
        const rows = Array.from(node.rows).flatMap(row => row.cells.length ? [new TableRow({
          children: Array.from(row.cells, cell => new TableCell({
            columnSpan: cell.colSpan > 1 ? cell.colSpan : undefined,
            children: [new Paragraph({ children: Array.from(cell.childNodes).flatMap(child => inline(child, { bold: cell.tagName === 'TH' })) })],
          })),
        })] : [])
        if (rows.length) output.push(new Table({ rows }))
      } else if (tag === 'HR') output.push(new Paragraph({ border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: 'BFC8CB' } } }))
      else if (tag === 'DIV' || tag === 'SECTION' || tag === 'ARTICLE') output.push(...blocks(node))
      else {
        const options = tag === 'BLOCKQUOTE' ? { indent: { left: 360 } } : {}
        output.push(new Paragraph({
          ...options,
          children: inline(node, tag === 'BLOCKQUOTE' ? { italics: true } : {}),
          heading: /^H[1-6]$/.test(tag) ? headings[Number(tag.slice(1)) - 1] : undefined,
          alignment: alignments[node.style.textAlign],
          spacing: { after: 120 },
        }))
      }
    }
    flush()
    return output
  }

  const children: (Paragraph | Table)[] = [
    new Paragraph({ children: [new TextRun({ text: data.heading, color: primary.slice(1) })], heading: HeadingLevel.TITLE }),
    ...data.lines.map(line => new Paragraph({ text: line })),
    ...blocks(fragment),
  ]
  for (const row of data.media) {
    const image = await docxImage(row)
    if (image) children.push(new Paragraph({ children: [new ImageRun({
      type: 'png', data: image.png, transformation: { width: image.width, height: image.height },
      altText: { name: row.fileName, title: row.fileName, description: row.fileName },
    })] }))
    else children.push(new Paragraph({ children: [new TextRun({ text: 'Attachment: ' + row.fileName, italics: true })] }))
  }
  const document = new WordDocument({
    title: data.heading,
    numbering: { config: [{ reference: 'journal-numbered', levels: Array.from({ length: 9 }, (_, level) => ({
      level, format: LevelFormat.DECIMAL, text: '%' + (level + 1) + '.', alignment: AlignmentType.START,
      style: { paragraph: { indent: { left: 720 + level * 360, hanging: 360 } } },
    })) }] },
    sections: [{ children }],
  })
  await downloadJournalFile(await Packer.toBlob(document), data.fileName + '.docx')
}

const xml = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;')
const xhtmlNs = 'http://www.w3.org/1999/xhtml'
const epubNs = 'http://www.idpf.org/2007/ops'

function addEntryContent(target: Document, body: HTMLElement, data: EntryData, content: DocumentFragment) {
  const heading = target.createElementNS(xhtmlNs, 'h1')
  heading.textContent = data.heading
  body.append(heading)
  for (const line of data.lines) {
    const paragraph = target.createElementNS(xhtmlNs, 'p')
    paragraph.textContent = line
    paragraph.setAttribute('class', 'entry-meta')
    body.append(paragraph)
  }
  body.append(target.importNode(content, true))
}

async function exportEpub(data: EntryData) {
  const assets = new Map<number, string>()
  const manifest: string[] = []
  const files: Record<string, Uint8Array | [Uint8Array, { level: 0 }]> = {
    mimetype: [strToU8('application/epub+zip'), { level: 0 }],
    'META-INF/container.xml': strToU8('<?xml version="1.0" encoding="utf-8"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="EPUB/package.opf" media-type="application/oebps-package+xml"/></rootfiles></container>'),
  }
  let total = 0
  for (const row of data.media) {
    const ext = epubImages[row.mimeType] || epubAudio[row.mimeType]
    if (!ext || !row.blob || row.id == null) continue
    total += row.blob.size
    if (total > 512 * 1024 * 1024) throw new Error('EPUB media exceeds the 512 MB export limit.')
    const relative = 'media/' + row.id + '.' + ext
    assets.set(row.id, relative)
    manifest.push(`<item id="media-${row.id}" href="${relative}" media-type="${row.mimeType}"/>`)
    files['EPUB/' + relative] = [new Uint8Array(await row.blob.arrayBuffer()), { level: 0 }]
  }
  const lang = document.documentElement.lang || 'en'
  const book = document.implementation.createDocument(xhtmlNs, 'html')
  const root = book.documentElement
  root.setAttribute('lang', lang)
  root.setAttributeNS('http://www.w3.org/XML/1998/namespace', 'xml:lang', lang)
  const head = book.createElementNS(xhtmlNs, 'head')
  const title = book.createElementNS(xhtmlNs, 'title')
  title.textContent = data.heading
  const style = book.createElementNS(xhtmlNs, 'link')
  style.setAttribute('rel', 'stylesheet')
  style.setAttribute('href', 'entry.css')
  head.append(title, style)
  const body = book.createElementNS(xhtmlNs, 'body') as HTMLElement
  addEntryContent(book, body, data, renderedEntry(data, assets))
  root.append(head, body)
  const identifier = 'urn:uuid:' + crypto.randomUUID()
  const modified = new Date().toISOString().replace(/\.\d+Z$/, 'Z')
  const xmlTitle = xml(data.heading)
  const xmlLang = xml(lang)
  files['EPUB/entry.xhtml'] = strToU8('<?xml version="1.0" encoding="utf-8"?>' + new XMLSerializer().serializeToString(book))
  files['EPUB/nav.xhtml'] = strToU8(`<?xml version="1.0" encoding="utf-8"?><html xmlns="${xhtmlNs}" xmlns:epub="${epubNs}" lang="${xmlLang}" xml:lang="${xmlLang}"><head><title>Contents</title></head><body><nav epub:type="toc"><h1>Contents</h1><ol><li><a href="entry.xhtml">${xmlTitle}</a></li></ol></nav></body></html>`)
  files['EPUB/entry.css'] = strToU8('body{line-height:1.55}h1{color:#00687b}img{max-width:100%;height:auto}.entry-meta{font-size:.9em;color:#4b6269}td,th{border:1px solid #bfc8cb;padding:.3em}')
  files['EPUB/package.opf'] = strToU8(`<?xml version="1.0" encoding="utf-8"?><package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="book-id"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="book-id">${identifier}</dc:identifier><dc:title>${xmlTitle}</dc:title><dc:language>${xmlLang}</dc:language><meta property="dcterms:modified">${modified}</meta></metadata><manifest><item id="entry" href="entry.xhtml" media-type="application/xhtml+xml"/><item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/><item id="css" href="entry.css" media-type="text/css"/>${manifest.join('')}</manifest><spine><itemref idref="entry"/></spine></package>`)
  const result = zipSync(files)
  await downloadJournalFile(new Blob([new Uint8Array(result)], { type: 'application/epub+zip' }), data.fileName + '.epub')
}

async function printEntry(data: EntryData) {
  const assets = new Map<number, string>()
  for (const row of data.media) {
    if (row.id != null && row.blob && row.mimeType.startsWith('image/')) assets.set(row.id, URL.createObjectURL(row.blob))
  }
  const iframe = document.createElement('iframe')
  iframe.title = 'Journal print preview'
  iframe.setAttribute('aria-hidden', 'true')
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;'
  iframe.sandbox.add('allow-same-origin', 'allow-modals')
  let cleanupTimer: ReturnType<typeof setTimeout> | undefined
  function cleanup() {
    iframe.remove()
    for (const url of assets.values()) URL.revokeObjectURL(url)
    clearTimeout(cleanupTimer)
  }
  document.body.append(iframe)
  try {
    const frame = iframe.contentWindow
    const printDocument = iframe.contentDocument
    if (!frame || !printDocument) throw new Error('The print preview could not be opened.')
    printDocument.title = data.heading
    const style = printDocument.createElement('style')
    style.textContent = '@page{margin:18mm}body{color:#171c1e;font:12pt/1.5 system-ui}h1{color:#00687b;font-weight:600}img{display:block;max-width:100%;max-height:175mm;break-inside:avoid}table{border-collapse:collapse}th,td{border:1px solid #bfc8cb;padding:.3em .6em}.entry-meta{color:#4b6269;font-size:.88em}p{orphans:2;widows:2}'
    printDocument.head.append(style)
    addEntryContent(printDocument, printDocument.body, data, renderedEntry(data, assets))
    await Promise.allSettled(Array.from(printDocument.images, image => image.decode()))
    frame.addEventListener('afterprint', cleanup, { once: true })
    cleanupTimer = setTimeout(cleanup, 120000)
    frame.focus()
    frame.print()
  } catch (error) {
    cleanup()
    throw error
  }
}

export async function exportEntryDocument(id: number, format: ExportFormat) {
  const data = await entryData(id)
  if (format === 'docx') await exportDocx(data)
  else if (format === 'epub') await exportEpub(data)
  else await printEntry(data)
}
