<script setup lang="ts">
import { renderJournal } from '~/utils/journalHtml'
import type { EntryV2 } from '~/utils/db'

const props = defineProps<{ entry: EntryV2 }>()
const { listMediaFor } = useEntries()
const html = ref('')

watch(() => props.entry, async (entry, _, onCleanup) => {
  const urls: string[] = []
  let active = true
  onCleanup(() => {
    active = false
    for (const url of urls) URL.revokeObjectURL(url)
  })
  html.value = ''
  const media = entry.id == null ? [] : await listMediaFor(entry.id)
  if (!active) return
  html.value = renderJournal(entry.text, media, row => {
    if (!row.blob) return
    const url = URL.createObjectURL(row.blob)
    urls.push(url)
    return url
  })
}, { immediate: true })
</script>

<template>
  <div class="jr-detail-content" v-html="html" />
</template>
