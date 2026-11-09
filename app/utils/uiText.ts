export function errorText(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : ''
  return /\p{Script=Han}/u.test(message) ? message : fallback
}

const wordSegmenter = typeof Intl.Segmenter === 'function'
  ? new Intl.Segmenter('zh-CN', { granularity: 'word' })
  : undefined

export function countWords(text: string) {
  if (!wordSegmenter) return text.trim().split(/\s+/).filter(Boolean).length
  let count = 0
  for (const segment of wordSegmenter.segment(text)) {
    if (segment.isWordLike) count++
  }
  return count
}
