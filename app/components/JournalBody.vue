<script setup lang="ts">
import { renderJournal } from '~/utils/journalHtml'
import type { EntryV2, MediaFileV2 } from '~/utils/db'

const props = defineProps<{ entry: EntryV2 }>()
const { listMediaFor } = useEntries()
const { urlForSync, prefetch, dispose } = useMediaResolver()
const html = ref('')

/**
 * 附件地址：本地有 blob 立刻可用；只有云端记录（别的设备同步下来的）才需要
 * 先批量换预签名地址 —— 所以先 await prefetch，再同步渲染。
 */
watch(() => props.entry, async (entry, _, onCleanup) => {
  let active = true
  onCleanup(() => { active = false })
  html.value = ''
  const media = entry.id == null ? [] : await listMediaFor(entry.id)
  await prefetch(media)
  if (!active) return
  html.value = renderJournal(entry.text, media, (row: MediaFileV2) => urlForSync(row))
}, { immediate: true })

onBeforeUnmount(dispose)
</script>

<template>
  <div class="jr-detail-content" v-html="html" />
</template>
