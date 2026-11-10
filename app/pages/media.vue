<script setup lang="ts">
import { mdiImageMultipleOutline, mdiChevronDown } from '@mdi/js'
import type { MediaFileV2 } from '~/utils/db'

const { allMedia, deleteMedia } = useEntries()
const items = ref<(MediaFileV2 & { url?: string })[]>([])
const filter = ref<'all' | 'image' | 'video' | 'audio'>('all')
const selectedId = ref<number | null>(null)
const error = ref('')
let loadGeneration = 0

async function load() {
  const generation = ++loadGeneration
  const rows = await allMedia()
  if (generation !== loadGeneration) return
  for (const item of items.value) if (item.url) URL.revokeObjectURL(item.url)
  items.value = rows.map((r) => ({ ...r, url: r.blob ? URL.createObjectURL(r.blob) : undefined }))
  if (selectedId.value && !items.value.some((i) => i.id === selectedId.value)) selectedId.value = null
}
onMounted(load)
onBeforeUnmount(() => {
  loadGeneration++
  for (const item of items.value) if (item.url) URL.revokeObjectURL(item.url)
})

async function remove(id: number) {
  if (!window.confirm('删除此媒体文件并移除日记中的引用？此操作不可撤销。')) return
  error.value = ''
  try { await deleteMedia(id); await load() }
  catch { error.value = '无法移除附件。' }
}

const shown = computed(() => items.value.filter((i) => filter.value === 'all' || i.mimeType.startsWith(filter.value)))
const selected = computed(() => shown.value.find((i) => i.id === selectedId.value) ?? null)
const filters = [
  { key: 'all', label: '全部' },
  { key: 'image', label: '图片' },
  { key: 'video', label: '视频' },
  { key: 'audio', label: '音频' },
] as const
function fmt(d?: Date) {
  return d ? new Intl.DateTimeFormat('zh-CN', { month: 'short', day: 'numeric', year: 'numeric' }).format(d) : ''
}
</script>

<template>
  <div class="jr-media-page">
    <header class="jr-media-toolbar">
      <button class="jr-cal-journal" type="button" title="选择日记本" @click="$router.push('/cloud')">
        <img src="/favicon.svg" alt=""> 旅程日记<JrIcon :path="mdiChevronDown" :size="16" />
      </button>
    </header>
    <div class="jr-media-split">
      <section class="jr-media-leading" aria-label="媒体库">
        <div class="jr-media-filters">
          <button v-for="f in filters" :key="f.key" class="jr-chip" :class="{ on: filter === f.key }" @click="filter = f.key">{{ f.label }}</button>
        </div>
        <p v-if="error" role="status">{{ error }}</p>
        <div v-if="!shown.length" class="jr-empty">
          <div class="big"><JrIcon :path="mdiImageMultipleOutline" :size="46" /></div>
          暂无媒体文件。
        </div>
        <div class="jr-media-grid">
          <div v-for="m in shown" :key="m.id" class="jr-media-card" :class="{ on: selectedId === m.id }" role="button" tabindex="0" @click="selectedId = m.id!" @keydown.enter="selectedId = m.id!">
            <img v-if="m.mimeType.startsWith('image/')" :src="m.url" class="jr-media-thumb" />
            <video v-else-if="m.mimeType.startsWith('video/')" :src="m.url" class="jr-media-thumb" />
            <div v-else class="jr-media-thumb jr-center">{{ m.ext.toUpperCase() }}</div>
            <div class="jr-media-meta">
              <span class="jr-media-name">{{ m.fileName }}</span>
              <span class="jr-muted">{{ fmt(m.createdAt) }}</span>
            </div>
          </div>
        </div>
      </section>
      <aside class="jr-media-detail" :class="{ 'has-media': selected }" aria-label="媒体详情">
        <template v-if="selected">
          <img v-if="selected.mimeType.startsWith('image/')" :src="selected.url" class="jr-media-preview" :alt="selected.fileName" />
          <video v-else-if="selected.mimeType.startsWith('video/')" :src="selected.url" class="jr-media-preview" controls />
          <audio v-else-if="selected.mimeType.startsWith('audio/')" :src="selected.url" controls style="width:100%" />
          <div class="jr-media-preview-fallback jr-center" v-else>{{ (selected.ext || '').toUpperCase() }}</div>
          <h2>{{ selected.fileName }}</h2>
          <p class="jr-muted">{{ fmt(selected.createdAt) }} · {{ selected.mimeType }}</p>
          <div class="jr-pop-row" style="justify-content:center">
            <NuxtLink class="jr-btn" :to="{ path: '/', query: { entry: selected.jId } }">打开所属条目</NuxtLink>
            <button class="jr-link-danger" @click="remove(selected.id!)">删除</button>
          </div>
        </template>
        <template v-else>
          <div class="big"><JrIcon :path="mdiImageMultipleOutline" :size="46" /></div>
          请选择一篇日记。
        </template>
      </aside>
    </div>
  </div>
</template>

<style scoped>
.jr-media-page { display: flex; flex-direction: column; height: 100%; }
.jr-media-toolbar { padding: 8px 14px; border-bottom: 1px solid var(--jr-outline-variant); background: var(--jr-surface); }
.jr-media-split { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); flex: 1; min-height: 0; }
.jr-media-leading { min-width: 0; overflow-y: auto; padding: 16px; border-right: 1px solid var(--jr-outline-variant); }
.jr-media-detail { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; padding: 24px; color: var(--jr-outline); text-align: center; overflow-y: auto; }
.jr-media-detail.has-media { color: var(--jr-on-surface); justify-content: flex-start; }
.jr-media-detail h2 { margin: 8px 0 0; font-size: 15px; color: var(--jr-on-surface); overflow-wrap: anywhere; }
.jr-media-preview { max-width: 100%; max-height: 50vh; border-radius: 10px; }
.jr-media-preview-fallback { width: 200px; height: 130px; background: #eef2f4; border-radius: 10px; }
.jr-media-card.on { border-color: var(--jr-primary); }
@media (max-width: 900px) {
  .jr-media-split { grid-template-columns: minmax(0, 1fr); }
  .jr-media-detail:not(.has-media) { display: none; }
}
</style>
