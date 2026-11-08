/**
 * Import format detection + mapping. Original supports Journey v1/v2, Day One,
 * Evernote, Daylio, Apple Journal (official [J20]); implemented here: own JSON,
 * Day One JSON, generic entries[] / Journey v1 journals[]. Remaining formats pending.
 */

export interface ImportedEntry {
  text: string
  date: Date
  favourite?: boolean
}

export interface ParseResult {
  kind: string
  entries: ImportedEntry[]
}

export function mdToHtml(md: string): string {
  const esc = md.replace(/&/g, '&amp;').replace(/</g, '&lt;')
  return esc
    .split(/\n{2,}/)
    .map((para) => {
      const line = para
        .replace(/^### (.*)$/m, '<h3>$1</h3>')
        .replace(/^## (.*)$/m, '<h2>$1</h2>')
        .replace(/^# (.*)$/m, '<h1>$1</h1>')
        .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
        .replace(/\*(.+?)\*/g, '<i>$1</i>')
        .replace(/\n/g, '<br>')
      return `<p>${line}</p>`
    })
    .join('')
}

export function parseImport(data: any): ParseResult {
  let rows: any[] = []
  let kind = 'unknown'
  if (data?.format === 'journey-replica-json' && Array.isArray(data.entries)) {
    kind = 'journey-replica'
    rows = data.entries
  } else if (Array.isArray(data?.entries) && data.entries[0]?.text !== undefined && (data.entries[0]?.creationDate || data.entries[0]?.photos !== undefined)) {
    kind = 'dayone'
    rows = data.entries
  } else if (Array.isArray(data?.journals) && data.journals[0]?.content !== undefined) {
    kind = 'journey-v1'
    rows = data.journals
  } else if (Array.isArray(data)) {
    kind = 'generic-entries'
    rows = data
  } else {
    throw new Error('unrecognized structure')
  }
  const entries: ImportedEntry[] = []
  for (const r of rows) {
    let text = ''
    let date: Date
    if (kind === 'dayone') {
      text = mdToHtml(String(r.text || ''))
      date = new Date(r.creationDate || r.date || Date.now())
      // Day One photo attachments (base64 in exports): pending, see feature matrix
    } else if (kind === 'journey-v1') {
      text = String(r.content || '')
      date = new Date(r.createdDate || r.date || r.dateOfJournal || Date.now())
    } else {
      text = String(r.text || r.content || '')
      date = new Date(r.dateOfJournal || r.date || Date.now())
    }
    if (!text.trim()) continue
    entries.push({ text, date, favourite: !!(r.starred || r.favourite) })
  }
  return { kind, entries }
}
