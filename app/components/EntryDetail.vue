<script setup lang="ts">
import { mdiStarOutline, mdiStar, mdiBookOutline, mdiShareOutline, mdiPencil, mdiDotsHorizontal, mdiLinkVariant, mdiContentDuplicate, mdiLabelOutline, mdiTrashCanOutline, mdiCloudUploadOutline } from '@mdi/js'
import type { EntryV2 } from '~/utils/db'
import { exportJournalZip } from '~/utils/journalZip'
import { weatherLabel } from '~/utils/services'
import { errorText } from '~/utils/uiText'

const props = defineProps<{ entry: EntryV2 | null }>()
const emit = defineEmits<{
  (e: 'edit'): void
  (e: 'toggleFavourite'): void
  (e: 'duplicate'): void
  (e: 'saveAsTemplate'): void
  (e: 'trash'): void
}>()

const menuOpen = ref(false)
const exportOpen = ref(false)
const exporting = ref(false)
const actionStatus = ref('')
const router = useRouter()
const tagTitles = ref<Record<number, string>>({})
const { listTags } = useEntries()
onMounted(async () => {
  const tags = await listTags()
  const m: Record<number, string> = {}
  for (const t of tags) if (t.id != null) m[t.id] = t.title
  tagTitles.value = m
})

const day = computed(() => props.entry ? new Intl.DateTimeFormat('zh-CN', { day: '2-digit' }).format(props.entry.dateOfJournal) : '')
const d1 = computed(() => props.entry ? new Intl.DateTimeFormat('zh-CN', { month: 'long', day: 'numeric', year: 'numeric' }).format(props.entry.dateOfJournal) : '')
const d2 = computed(() => props.entry ? new Intl.DateTimeFormat('zh-CN', { weekday: 'long', hour: 'numeric', minute: '2-digit' }).format(props.entry.dateOfJournal) : '')

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
    const url = new URL(router.resolve({ path: '/', query: { entry: props.entry?.id } }).href, location.href).href
    try {
      await navigator.clipboard.writeText(url)
      actionStatus.value = '已复制日记链接。'
    } catch { actionStatus.value = url }
  }
}

watch(() => props.entry?.id, () => { menuOpen.value = false; exportOpen.value = false; actionStatus.value = '' })

async function downloadEntry(format: 'zip' | 'docx' | 'epub' | 'pdf') {
  const id = props.entry?.id
  if (id == null || exporting.value) return
  exporting.value = true
  actionStatus.value = ''
  try {
    if (format === 'zip') await exportJournalZip(id)
    else {
      const { exportEntryDocument } = await import('~/utils/documentExport')
      await exportEntryDocument(id, format)
      if (format === 'pdf') actionStatus.value = '请在打印窗口中选择「另存为 PDF」。'
    }
    exportOpen.value = false
  }
  catch (error) { actionStatus.value = errorText(error, '无法导出这篇日记。') }
  finally { exporting.value = false }
}
</script>

<template>
  <div v-if="entry" class="jr-detail-body">
    <div class="jr-detail-head">
      <div class="day">{{ day }}</div>
      <div class="when">
        <div class="d1">{{ d1 }}</div>
        <div class="d2">{{ d2 }}</div>
      </div>
      <div style="align-self:flex-start" title="仅保存在本机">
        <JrIcon :path="mdiCloudUploadOutline" :size="20" style="color:#e05a4e" />
      </div>
    </div>
    <div class="jr-detail-chips">
      <span v-if="entry.sentiment" class="jr-mchip">{{ { excited: '😆', happy: '😊', calm: '😌', 'so-so': '😐', tired: '😪', sad: '😢', angry: '😠', anxious: '😰' }[entry.sentiment] || entry.sentiment }} {{ entry.sentiment }}</span>
      <span v-if="entry.activity" class="jr-mchip">🏃 {{ entry.activity }}</span>
      <span v-if="entry.weatherIcon" class="jr-mchip">{{ { sun: '☀️', partly: '🌤', cloud: '☁️', fog: '🌫', rain: '🌧', snow: '🌨', storm: '⛈' }[entry.weatherIcon] }} {{ entry.weatherDegreeC != null ? entry.weatherDegreeC + '°C' : '' }} {{ entry.weatherPlace || weatherLabel(entry.weatherDescription) }}</span>
      <span v-if="entry.address" class="jr-mchip" :title="entry.address">📍 {{ entry.address.slice(0, 40) }}</span>
      <span v-for="t in (entry.tagWordIds || [])" :key="t" class="jr-mchip jr-mtag">#{{ tagTitles[t] || t }}</span>
    </div>
    <JournalBody :entry="entry" />
    <p v-if="actionStatus" class="jr-muted" role="status">{{ actionStatus }}</p>
  </div>
  <div v-else class="jr-empty" style="margin:auto">
    <div class="big"><JrIcon :path="mdiBookOutline" :size="52" /></div>
    请选择一篇日记。
  </div>

  <div v-if="entry" class="jr-detail-bar">
    <button :class="{ on: !!entry.favourite }" title="收藏" @click="emit('toggleFavourite')">
      <JrIcon :path="entry.favourite ? mdiStar : mdiStarOutline" :size="22" />
    </button>
    <button title="存为模板" @click="emit('saveAsTemplate')"><JrIcon :path="mdiBookOutline" :size="22" /></button>
    <button title="分享与导出" :aria-expanded="exportOpen" @click="menuOpen = false; exportOpen = !exportOpen"><JrIcon :path="mdiShareOutline" :size="22" /></button>
    <button title="编辑" @click="emit('edit')"><JrIcon :path="mdiPencil" :size="22" /></button>
    <button title="更多" @click="exportOpen = false; menuOpen = !menuOpen"><JrIcon :path="mdiDotsHorizontal" :size="22" /></button>
    <div v-if="exportOpen" class="jr-menu">
      <button :disabled="exporting" @click="downloadEntry('zip')">{{ exporting ? '正在导出…' : '导出为 ZIP' }}</button>
      <button :disabled="exporting" @click="downloadEntry('docx')">导出为 DOCX</button>
      <button :disabled="exporting" @click="downloadEntry('epub')">导出为 EPUB</button>
      <button :disabled="exporting" @click="downloadEntry('pdf')">打印或另存为 PDF</button>
      <button @click="exportOpen = false; onMenu('copy')">复制链接</button>
    </div>
    <div v-if="menuOpen" class="jr-menu">
      <button v-for="m in menu" :key="m.key" @click="onMenu(m.key)">
        <JrIcon :path="m.icon" :size="18" />
        <span :style="m.key === 'trash' ? 'color:var(--jr-error)' : ''">{{ m.label }}</span>
      </button>
    </div>
  </div>
</template>
