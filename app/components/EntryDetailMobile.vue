<script setup lang="ts">
import { mdiArrowLeft, mdiShareOutline, mdiStar, mdiStarOutline, mdiPencil, mdiDotsHorizontal, mdiChevronLeft, mdiChevronRight, mdiLinkVariant, mdiContentDuplicate, mdiLabelOutline, mdiTrashCanOutline, mdiCloudUploadOutline } from '@mdi/js'
import type { EntryV2 } from '~/utils/db'
import { weatherLabel } from '~/utils/services'

// 移动详情页对照原版(evidence/mobile-derived/ui-structure.md §4):
// 顶栏 返回+分享+收藏+编辑+更多;大日数字+日期星期时间+云状态;底部 ‹ › 前后篇
const props = defineProps<{ entry: EntryV2; hasPrev: boolean; hasNext: boolean }>()
const emit = defineEmits<{
  (e: 'back'): void
  (e: 'edit'): void
  (e: 'toggleFavourite'): void
  (e: 'duplicate'): void
  (e: 'saveAsTemplate'): void
  (e: 'trash'): void
  (e: 'prev'): void
  (e: 'next'): void
}>()

const menuOpen = ref(false)
const actionStatus = ref('')
const router = useRouter()
const tagTitles = ref<Record<number, string>>({})
const { listTags } = useEntries()
const { formatTemp } = useUnits()
onMounted(async () => {
  const tagList = await listTags()
  const m: Record<number, string> = {}
  for (const t of tagList) if (t.id != null) m[t.id] = t.title
  tagTitles.value = m
})

const day = computed(() => new Intl.DateTimeFormat('zh-CN', { day: '2-digit' }).format(props.entry.dateOfJournal))
const d1 = computed(() => new Intl.DateTimeFormat('zh-CN', { month: 'long', day: 'numeric', year: 'numeric' }).format(props.entry.dateOfJournal))
const d2 = computed(() => new Intl.DateTimeFormat('zh-CN', { weekday: 'long', hour: 'numeric', minute: '2-digit' }).format(props.entry.dateOfJournal))

const menu = [
  { key: 'copy', label: '复制链接', icon: mdiLinkVariant },
  { key: 'duplicate', label: '复制日记', icon: mdiContentDuplicate },
  { key: 'template', label: '存为模板', icon: mdiLabelOutline },
  { key: 'trash', label: '移到回收站', icon: mdiTrashCanOutline },
] as const

async function onMenu(key: typeof menu[number]['key']) {
  menuOpen.value = false
  if (key === 'duplicate') emit('duplicate')
  else if (key === 'template') emit('saveAsTemplate')
  else if (key === 'trash') emit('trash')
  else if (key === 'copy') {
    const url = new URL(router.resolve({ path: '/', query: { entry: props.entry.id } }).href, location.href).href
    try { await navigator.clipboard.writeText(url); actionStatus.value = '已复制日记链接。' }
    catch { actionStatus.value = url }
  }
}
watch(() => props.entry.id, () => { menuOpen.value = false; actionStatus.value = '' })
</script>

<template>
  <div class="jr-mdetail">
    <div class="bar">
      <button class="ico" aria-label="返回" @click="emit('back')"><JrIcon :path="mdiArrowLeft" :size="22" /></button>
      <span class="sp" />
      <button class="ico" aria-label="分享与导出" @click="onMenu('copy')"><JrIcon :path="mdiShareOutline" :size="22" /></button>
      <button class="ico" :aria-label="entry.favourite ? '取消收藏' : '收藏'" @click="emit('toggleFavourite')">
        <JrIcon :path="entry.favourite ? mdiStar : mdiStarOutline" :size="22" :style="entry.favourite ? 'color:#e2a03f' : ''" />
      </button>
      <button class="ico" aria-label="编辑" @click="emit('edit')"><JrIcon :path="mdiPencil" :size="22" /></button>
      <button class="ico" aria-label="更多" @click="menuOpen = !menuOpen"><JrIcon :path="mdiDotsHorizontal" :size="22" /></button>
      <div v-if="menuOpen" class="jr-menu" @click.stop>
        <button v-for="m in menu" :key="m.key" @click="onMenu(m.key)">
          <JrIcon :path="m.icon" :size="18" />
          <span :style="m.key === 'trash' ? 'color:var(--jr-error)' : ''">{{ m.label }}</span>
        </button>
      </div>
    </div>

    <div class="body">
      <div class="dayblock">
        <div class="day">{{ day }}</div>
        <div class="when">
          <div class="d1">{{ d1 }}</div>
          <div class="d2">{{ d2 }}</div>
        </div>
        <div v-if="!entry.synced" class="up" title="仅保存在本机">
          <JrIcon :path="mdiCloudUploadOutline" :size="18" />
        </div>
        <span v-if="entry.favourite" class="starmark" title="已收藏">
          <JrIcon :path="mdiStar" :size="16" />
        </span>
      </div>
      <div class="chips">
        <span v-if="entry.sentiment" class="chip">{{ { excited: '😆', happy: '😊', calm: '😌', 'so-so': '😐', tired: '😪', sad: '😢', angry: '😠', anxious: '😰' }[entry.sentiment] || entry.sentiment }}</span>
        <span v-if="entry.activity" class="chip">🏃 {{ entry.activity }}</span>
        <span v-if="entry.weatherIcon" class="chip">{{ { sun: '☀️', partly: '🌤', cloud: '☁️', fog: '🌫', rain: '🌧', snow: '🌨', storm: '⛈' }[entry.weatherIcon] }} {{ formatTemp(entry.weatherDegreeC) }} {{ entry.weatherPlace || weatherLabel(entry.weatherDescription) }}</span>
        <span v-if="entry.address" class="chip">📍 {{ entry.address.slice(0, 40) }}</span>
        <span v-for="t in (entry.tagWordIds || [])" :key="t" class="chip">#{{ tagTitles[t] || t }}</span>
      </div>
      <JournalBody :entry="entry" />
      <p v-if="actionStatus" class="note" role="status">{{ actionStatus }}</p>
    </div>

    <div class="pager">
      <button class="nav" :disabled="!hasPrev" aria-label="上一篇" @click="emit('prev')"><JrIcon :path="mdiChevronLeft" :size="26" /></button>
      <button class="nav" :disabled="!hasNext" aria-label="下一篇" @click="emit('next')"><JrIcon :path="mdiChevronRight" :size="26" /></button>
    </div>
  </div>
</template>

<style scoped>
.jr-mdetail { position: fixed; inset: 0; z-index: 200; background: var(--jr-bg); display: flex; flex-direction: column; }
.bar { display: flex; align-items: center; gap: 2px; padding: 10px 8px; background: var(--jr-secondary-container); position: relative; }
.bar .sp { flex: 1; }
.ico { display: flex; align-items: center; justify-content: center; width: 44px; height: 44px; border-radius: 50%; background: transparent; border: 0; color: var(--jr-on-bg); }
.ico:active { background: rgba(0, 60, 70, 0.12); }
.bar .jr-menu { right: 8px; top: 56px; }
.body { flex: 1; overflow-y: auto; padding: 16px 18px 90px; }
.dayblock { display: flex; gap: 14px; align-items: flex-start; }
.dayblock .day { font-size: 42px; line-height: 1; font-weight: 800; color: var(--jr-primary); }
.dayblock .when .d1 { font-weight: 700; font-size: 14.5px; }
.dayblock .when .d2 { font-size: 13px; color: var(--jr-on-surface-variant); }
.dayblock .up { color: #e05a4e; margin-left: auto; }
.starmark { color: #e2a03f; margin-left: auto; display: flex; }
.dayblock .up + .starmark { margin-left: 0; }
.chips { display: flex; flex-wrap: wrap; gap: 6px; margin: 12px 0 4px; }
.chip { background: var(--jr-surface-variant); border-radius: 999px; padding: 3px 10px; font-size: 12px; color: var(--jr-on-surface-variant); }
.note { font-size: 12px; color: var(--jr-outline); }
.pager { position: fixed; left: 0; right: 0; bottom: 0; display: flex; justify-content: space-between; padding: 8px 10px calc(8px + env(safe-area-inset-bottom)); pointer-events: none; }
.pager .nav { pointer-events: auto; background: transparent; border: 0; color: var(--jr-on-surface-variant); width: 48px; height: 48px; border-radius: 50%; display: flex; align-items: center; justify-content: center; }
.pager .nav:disabled { opacity: 0.3; }
</style>
