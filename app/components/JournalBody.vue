<script setup lang="ts">
import { renderJournal, journalFragment, journalHtml } from '~/utils/journalHtml'
import type { FamilyTimelineEntry, MediaFileV2 } from '~/utils/db'

const props = defineProps<{ entry: FamilyTimelineEntry }>()
const { listMediaFor } = useEntries()
const { urlForSync, prefetch, prefetchFamily, dispose } = useMediaResolver()
const html = ref('')

/**
 * 附件地址：本地有 blob 立刻可用；只有云端记录（别的设备同步下来的）才需要
 * 先批量换预签名地址 —— 所以先 await prefetch，再同步渲染。
 *
 * 家人条目（entry.familyAuthor）在本机没有媒体行：用 feed 带来的元数据造伪行。
 * 正文里的 data-media-id 是作者设备上的本地自增 id，这边对不上 ——
 * 按文档出现顺序 ↔ position 升序重映射（与保存时的插入顺序一致）；对不上的
 * 照旧走 renderJournal 的兜底（移除内嵌占位 + 附件按顺序补挂在末尾）。
 */
watch(() => [props.entry, props.entry.familyMedia] as const, async ([entry, familyMedia], _, onCleanup) => {
  let active = true
  onCleanup(() => { active = false })
  html.value = ''
  if (entry.familyAuthor && familyMedia?.length) {
    const pseudo: MediaFileV2[] = familyMedia.map((m, i) => ({
      id: 1_000_000 + i,
      linkedAccountId: '',
      createdAt: new Date(0),
      fileName: m.fileName,
      mimeType: m.mimeType,
      ext: '',
      position: m.position,
      uploaded: 1,
      remotePathname: m.pathname,
    }))
    await prefetchFamily(familyMedia.map(m => m.pathname))
    if (!active) return
    const idByPath = new Map(familyMedia.map((m, i) => [m.pathname, 1_000_000 + i] as const))
    const ordered = [...familyMedia].sort((a, b) => a.position - b.position)
    const fragment = journalFragment(entry.text)
    Array.from(fragment.querySelectorAll('[data-media-id]')).forEach((node, i) => {
      const m = ordered[i]
      const pseudoId = m ? idByPath.get(m.pathname) : undefined
      if (pseudoId != null) node.setAttribute('data-media-id', String(pseudoId))
    })
    html.value = renderJournal(journalHtml(fragment), pseudo, (row: MediaFileV2) => urlForSync(row))
    return
  }
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
