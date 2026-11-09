import DOMPurify from 'dompurify'
import type { MediaFileV2 } from './db'

export function journalFragment(html: string) {
  return DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },
    FORBID_TAGS: ['form', 'style'],
    RETURN_DOM_FRAGMENT: true,
  })
}

export function journalHtml(fragment: DocumentFragment) {
  const container = document.createElement('template')
  container.content.append(fragment)
  return container.innerHTML
}

export function stripAttachmentUrls(html: string, removed: ReadonlySet<number> = new Set()) {
  const fragment = journalFragment(html)
  for (const node of fragment.querySelectorAll('[data-media-id]')) {
    if (removed.has(Number(node.getAttribute('data-media-id')))) node.remove()
    else {
      node.removeAttribute('src')
      node.removeAttribute('href')
    }
  }
  return journalHtml(fragment)
}

export function renderJournal(html: string, media: MediaFileV2[], urlFor: (row: MediaFileV2) => string | undefined, includeStandalone = true) {
  const fragment = journalFragment(html)
  const remaining = new Map(media.map(row => [row.id, row]))
  function renderMedia(row: MediaFileV2) {
    const url = urlFor(row)
    const kind = row.mimeType.split('/')[0]
    if (!url || !['image', 'audio', 'video'].includes(kind)) return document.createTextNode(row.fileName)
    if (kind === 'image') {
      const image = document.createElement('img')
      image.src = url
      image.alt = row.fileName
      if (row.id != null) image.dataset.mediaId = String(row.id)
      return image
    }
    const player = document.createElement(kind === 'audio' ? 'audio' : 'video')
    player.src = url
    player.controls = true
    player.preload = 'metadata'
    player.setAttribute('aria-label', row.fileName)
    if (row.id != null) player.dataset.mediaId = String(row.id)
    return player
  }
  const byId = new Map(remaining)
  for (const node of fragment.querySelectorAll('[data-media-id]')) {
    const id = Number(node.getAttribute('data-media-id'))
    const row = byId.get(id)
    if (row) {
      remaining.delete(id)
      node.replaceWith(renderMedia(row))
    } else node.remove()
  }
  for (const row of includeStandalone ? remaining.values() : []) {
    const paragraph = document.createElement('p')
    paragraph.append(renderMedia(row))
    fragment.append(paragraph)
  }
  return journalHtml(fragment)
}
