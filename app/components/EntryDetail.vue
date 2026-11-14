<script setup lang="ts">
import {
  mdiStarOutline,
  mdiStar,
  mdiBookOutline,
  mdiShareOutline,
  mdiPencil,
  mdiDotsHorizontal,
  mdiContentDuplicate,
  mdiLabelOutline,
  mdiTrashCanOutline,
  mdiCloudUploadOutline,
  mdiMapMarkerOutline,
  mdiWeatherSunny,
  mdiEmoticonOutline,
  mdiAccountMultipleOutline,
} from '@mdi/js'
import type { FamilyTimelineEntry } from '~/utils/db'
import { exportJournalZip } from '~/utils/journalZip'
import { weatherLabel } from '~/utils/services'
import { errorText } from '~/utils/uiText'
import { familyAvatarColor, familyAvatarChar } from '~/utils/familyUi'

const props = defineProps<{ entry: FamilyTimelineEntry | null }>()
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
const { formatTemp } = useUnits()

// 家庭组（附加功能）：家人条目只读（无编辑/导出/删除），底部挂互动区
const { state: familyState } = useFamilySync()
const isFamily = computed(() => !!props.entry?.familyAuthor)
/** 互动区定位：家人条目 → (作者userId, 组合cloudId)；自己的共享日记 → (我的userId, cloudId) */
const socialTarget = computed(() => {
  const entry = props.entry
  if (!entry?.cloudId) return null
  if (entry.familyAuthor) return { owner: entry.familyAuthor.ownerUserId, clientId: entry.cloudId }
  const me = familyState.value.me?.userId
  if (entry.visibility === 'family' && me) return { owner: me, clientId: entry.cloudId }
  return null
})

onMounted(async () => {
  const tags = await listTags()
  const m: Record<number, string> = {}
  for (const t of tags) if (t.id != null) m[t.id] = t.title
  tagTitles.value = m
})

const fullDateStr = computed(() => {
  if (!props.entry) return ''
  const d = new Date(props.entry.dateOfJournal)
  const monthDay = new Intl.DateTimeFormat('zh-CN', { month: 'long', day: 'numeric' }).format(d)
  const weekday = new Intl.DateTimeFormat('zh-CN', { weekday: 'long' }).format(d)
  const time = new Intl.DateTimeFormat('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false }).format(d)
  return `${monthDay} · ${weekday} ${time}`
})

const entryTitle = computed(() => {
  if (!props.entry) return ''
  const text = (props.entry.text || props.entry.previewText || '').replace(/<[^>]*>/g, '').trim()
  const firstLine = text.split('\n')[0]?.replace(/^[#\s]+/, '').trim()
  return firstLine || ''
})

const hasHeadingInBody = computed(() => {
  if (!props.entry) return false
  const raw = (props.entry.text || '').trim()
  return /^<h[1-3][^>]*>/i.test(raw)
})

const menu = [
  { key: 'duplicate', label: '复制日记', icon: mdiContentDuplicate },
  { key: 'template', label: '存为模板', icon: mdiLabelOutline },
  { key: 'trash', label: '移到回收站', icon: mdiTrashCanOutline },
] as const

async function onMenu(key: typeof menu[number]['key'] | 'copy') {
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
  <div v-if="entry" class="jr-detail-container">
    <!-- 顶部状态栏与操作按钮 -->
    <div class="jr-detail-top-bar">
      <div class="jr-detail-date-wrap">
        <span class="jr-detail-date-str">{{ fullDateStr }}</span>
        <span class="jr-sync-badge">
          <span class="dot" />
          <span>{{ entry.familyAuthor ? '来自家人' : entry.synced ? '至本地与云端' : '已保存在本地' }}</span>
        </span>
      </div>

      <!-- 家人条目只读：无编辑/导出/删除等本地操作 -->
      <div v-if="!isFamily" class="jr-detail-actions">
        <button class="jr-detail-btn" :class="{ on: !!entry.favourite }" title="收藏" @click="emit('toggleFavourite')">
          <JrIcon :path="entry.favourite ? mdiStar : mdiStarOutline" :size="19" />
        </button>
        <button class="jr-detail-btn" title="编辑" @click="emit('edit')">
          <JrIcon :path="mdiPencil" :size="19" />
        </button>
        <button class="jr-detail-btn" title="分享与导出" :aria-expanded="exportOpen" @click="menuOpen = false; exportOpen = !exportOpen">
          <JrIcon :path="mdiShareOutline" :size="19" />
        </button>
        <button class="jr-detail-btn" title="更多" @click="exportOpen = false; menuOpen = !menuOpen">
          <JrIcon :path="mdiDotsHorizontal" :size="19" />
        </button>

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
    </div>

    <!-- 元数据 Chips 栏 -->
    <div class="jr-detail-chips-bar">
      <span v-if="entry.familyAuthor" class="jr-mchip" style="font-weight:600">
        <span class="jr-family-avatar" :style="{ background: familyAvatarColor(entry.familyAuthor.ownerUserId) }">{{ familyAvatarChar(entry.familyAuthor.ownerNickname) }}</span>
        <span>{{ entry.familyAuthor.ownerNickname }}</span>
      </span>
      <span v-else-if="entry.visibility === 'family'" class="jr-mchip" title="家人可见：他们可以评论或在文末追加段落">
        <JrIcon :path="mdiAccountMultipleOutline" :size="14" style="color:var(--jr-primary);vertical-align:-2px" />
        <span>共享给家人</span>
      </span>
      <span v-if="entry.address" class="jr-mchip" :title="entry.address">
        <JrIcon :path="mdiMapMarkerOutline" :size="14" style="color:var(--jr-primary);vertical-align:-2px" />
        <span>{{ entry.address.slice(0, 32) }}</span>
      </span>
      <span v-if="entry.weatherIcon" class="jr-mchip">
        <JrIcon :path="mdiWeatherSunny" :size="14" style="color:#F59E0B;vertical-align:-2px" />
        <span>{{ weatherLabel(entry.weatherDescription) }} {{ formatTemp(entry.weatherDegreeC) }}</span>
      </span>
      <span v-if="entry.sentiment" class="jr-mchip">
        <JrIcon :path="mdiEmoticonOutline" :size="14" style="color:#10B981;vertical-align:-2px" />
        <span>{{ { excited: '兴奋', happy: '开心', calm: '轻松惬意', 'so-so': '平淡', tired: '疲惫', sad: '难过', angry: '生气', anxious: '焦虑' }[entry.sentiment] || entry.sentiment }}</span>
      </span>
      <span v-for="t in (entry.tagWordIds || [])" :key="t" class="jr-mchip jr-mtag">
        #{{ tagTitles[t] || t }}
      </span>
    </div>

    <!-- 滚动正文区域 -->
    <div class="jr-detail-scroll">
      <h1 v-if="entryTitle && !hasHeadingInBody" class="jr-detail-title">{{ entryTitle }}</h1>
      <JournalBody :entry="entry" />
      <FamilySocial
        v-if="socialTarget"
        :entry-owner-user-id="socialTarget.owner"
        :entry-client-id="socialTarget.clientId"
      />
      <p v-if="actionStatus" class="jr-muted" role="status">{{ actionStatus }}</p>
    </div>
  </div>
  <div v-else class="jr-empty" style="margin:auto">
    <div class="big"><JrIcon :path="mdiBookOutline" :size="52" /></div>
    请从左侧选择一篇日记。
  </div>
</template>
