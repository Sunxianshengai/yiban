<script setup lang="ts">
import { mdiBookmark, mdiHistory, mdiSortVariant, mdiCloudUploadOutline, mdiImageOutline, mdiCheck, mdiArrowDown, mdiArrowUp } from '@mdi/js'
import type { EntryV2 } from '~/utils/db'
import { WEATHER_EMOJI, weatherLabel } from '~/utils/services'

const { entries, refresh, toggleFavourite, duplicateEntry, saveAsTemplate, moveToTrash, throwbacks, allMedia } = useEntries()
const route = useRoute()

const editorOpen = ref(false)
const editing = ref<EntryV2 | null>(null)
const selected = ref<EntryV2 | null>(null)
const throwbackList = ref<EntryV2[]>([])
const throwbackLabel = ref('今天没有往日回忆')
const storiesOpen = ref(false)
const storiesStart = ref<'stats' | 'throwback'>('stats')
const membershipOpen = useMembershipDialog()

onMounted(async () => {
  const tb = await throwbacks()
  throwbackList.value = tb
  if (tb.length) {
    const d = new Date(tb[0].dateOfJournal)
    throwbackLabel.value = `${d.getFullYear()} · ${new Intl.DateTimeFormat('zh-CN', { month: 'long', day: 'numeric' }).format(d)}`
  }
  await refresh()
  openLinkedEntry()
  await loadThumbnails()
})

const thumbs = ref<Record<number, string>>({})
let thumbsGeneration = 0
function releaseThumbnails() {
  for (const url of Object.values(thumbs.value)) URL.revokeObjectURL(url)
}
async function loadThumbnails() {
  const generation = ++thumbsGeneration
  const media = await allMedia()
  if (generation !== thumbsGeneration) return
  const map: Record<number, string> = {}
  for (const m of media) {
    if (m.jId != null && m.blob && m.mimeType.startsWith('image/') && map[m.jId] == null) {
      map[m.jId] = URL.createObjectURL(m.blob)
    }
  }
  releaseThumbnails()
  thumbs.value = map
}
onBeforeUnmount(() => { thumbsGeneration++; releaseThumbnails() })

// sort menu — faithful to menu-sort.png: "Entry Date" (with direction arrow) / "Last Modified"
const sortMenuOpen = ref(false)
const sortKey = ref<'entryDate' | 'lastModified'>(localStorage.getItem('jr.sortKey') === 'lastModified' ? 'lastModified' : 'entryDate')
const sortDir = ref<'desc' | 'asc'>(localStorage.getItem('jr.sortDir') === 'asc' ? 'asc' : 'desc')
watch([sortKey, sortDir], ([k, d]) => { localStorage.setItem('jr.sortKey', k); localStorage.setItem('jr.sortDir', d) })
const sortedEntries = computed(() => {
  const list = [...entries.value]
  list.sort((a, b) => {
    if (sortKey.value === 'lastModified') return +new Date(b.dateModified) - +new Date(a.dateModified)
    return sortDir.value === 'desc'
      ? +new Date(b.dateOfJournal) - +new Date(a.dateOfJournal)
      : +new Date(a.dateOfJournal) - +new Date(b.dateOfJournal)
  })
  return list
})
function pickSort(k: 'entryDate' | 'lastModified') {
  if (k === sortKey.value && k === 'entryDate') sortDir.value = sortDir.value === 'desc' ? 'asc' : 'desc'
  sortKey.value = k
  sortMenuOpen.value = false
}

const today = new Date()
const todayLabel = new Intl.DateTimeFormat('zh-CN', { month: 'long', day: 'numeric', year: 'numeric' }).format(today)

function selectEntry(e: EntryV2) {
  selected.value = e
}

function openLinkedEntry() {
  const target = Number(route.query.entry || route.hash.match(/^#entry=(\d+)$/)?.[1])
  if (target > 0) selected.value = entries.value.find(e => e.id === target) ?? null
}
watch([() => route.query.entry, () => route.hash], openLinkedEntry)

function rowDate(e: EntryV2) {
  const d = new Date(e.dateOfJournal)
  const main = new Intl.DateTimeFormat('zh-CN', { month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }).format(d)
  const wd = new Intl.DateTimeFormat('zh-CN', { weekday: 'short' }).format(d)
  return `${main} · ${wd}`
}

function openNew() {
  editing.value = null
  editorOpen.value = true
}
function openEdit() {
  if (selected.value) {
    editing.value = selected.value
    editorOpen.value = true
  }
}
async function onDone() {
  editorOpen.value = false
  editing.value = null
  await refresh()
  await loadThumbnails()
  if (selected.value) {
    const fresh = entries.value.find((x) => x.id === selected.value!.id)
    if (fresh) selectEntry(fresh)
  }
}
async function onDuplicate() {
  if (selected.value) {
    const copy = await duplicateEntry(selected.value.id!)
    await loadThumbnails()
    selected.value = entries.value.find(e => e.id === copy) ?? null
  }
}
function onSaveTemplate() {
  if (selected.value) saveAsTemplate(selected.value.id!)
}
async function onTrash() {
  if (selected.value) {
    await moveToTrash(selected.value.id!)
    selected.value = null
  }
}
async function onFavourite() {
  const id = selected.value?.id
  if (id == null) return
  await toggleFavourite(id)
  selected.value = entries.value.find(e => e.id === id) ?? null
}
</script>

<template>
  <button class="jr-fab" title="新建日记" @click="openNew">
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6z" /></svg>
  </button>

  <div class="jr-content">
    <div class="jr-list-col">
      <template v-if="entries.length">
        <div class="jr-banner cloud">
          <JrIcon :path="mdiCloudUploadOutline" :size="26" style="color:#c96b60" />
          <div class="txt">
            <div class="t">迁移到云端</div>
            <div class="d">同步日记后，即可在不同设备上查看。</div>
          </div>
          <button class="act">继续</button>
        </div>
        <div class="jr-banner member">
          <div class="txt">
            <div class="t">会员</div>
            <div class="d">你正在使用免费版。升级后可解锁更多功能。</div>
          </div>
          <button class="act" @click="membershipOpen = true">升级</button>
        </div>
      </template>

      <div class="jr-stories-title">回顾故事</div>
      <div class="jr-stories">
        <button class="jr-story-card today" @click="storiesStart = 'stats'; storiesOpen = true">
          <span class="icon"><JrIcon :path="mdiBookmark" :size="22" /></span>
          <span class="t">今天</span>
          <span class="s">{{ todayLabel }}</span>
        </button>
        <button class="jr-story-card throwback" @click="storiesStart = 'throwback'; storiesOpen = true">
          <span class="icon"><JrIcon :path="mdiHistory" :size="22" /></span>
          <span class="t">往日回忆</span>
          <span class="s">{{ throwbackLabel }}</span>
        </button>
      </div>

      <div class="jr-entries-head">
        <span class="label">日记</span>
        <button class="sort" title="排序" @click="sortMenuOpen = !sortMenuOpen"><JrIcon :path="mdiSortVariant" :size="20" /></button>
        <div v-if="sortMenuOpen" class="jr-sort-menu">
          <button @click="pickSort('entryDate')">
            <JrIcon v-if="sortKey === 'entryDate'" :path="mdiCheck" :size="16" />
            <span style="width:16px" v-else />
            <span>日记日期</span>
            <JrIcon v-if="sortKey === 'entryDate'" :path="sortDir === 'desc' ? mdiArrowDown : mdiArrowUp" :size="15" />
          </button>
          <button @click="pickSort('lastModified')">
            <JrIcon v-if="sortKey === 'lastModified'" :path="mdiCheck" :size="16" />
            <span style="width:16px" v-else />
            <span>最近修改</span>
          </button>
        </div>
      </div>

      <div v-if="!sortedEntries.length" class="jr-empty">
        <div class="big"><JrIcon :path="mdiImageOutline" :size="46" /></div>
        暂无日记。
      </div>

      <div
        v-for="e in sortedEntries"
        :key="e.id"
        class="jr-entry"
        :class="{ selected: selected?.id === e.id }"
        @click="selectEntry(e)"
      >
        <div class="date">{{ rowDate(e) }}</div>
        <div class="preview">{{ e.previewText || '无正文' }}</div>
        <img v-if="thumbs[e.id!]" :src="thumbs[e.id!]" class="jr-row-thumb" />
        <div class="meta">
          <span v-if="e.weatherIcon" :title="`${weatherLabel(e.weatherDescription)} ${e.weatherDegreeC ?? ''}°C`">{{ WEATHER_EMOJI[e.weatherIcon] || '☁️' }} {{ e.weatherDegreeC != null ? e.weatherDegreeC + '°C' : '' }}</span>
          <span v-if="e.address" :title="e.address">📍</span>
          <span v-if="e.favourite" title="收藏">⭐</span>
          <span v-if="!e.synced" class="jr-status-icon" title="等待上传">
            <JrIcon :path="mdiCloudUploadOutline" :size="17" />
          </span>
        </div>
      </div>
    </div>

    <div class="jr-detail-col" style="position:relative">
      <EntryDetail
        :entry="selected"
        @edit="openEdit"
        @toggle-favourite="onFavourite"
        @duplicate="onDuplicate"
        @save-as-template="onSaveTemplate"
        @trash="onTrash"
      />
      <EntryEditor
        v-if="editorOpen"
        :entry-id="editing?.id"
        :initial-text="editing?.text"
        :initial-date="editing ? new Date(editing.dateOfJournal) : undefined"
        :initial-meta="editing ? { address: editing.address, lat: editing.lat, lng: editing.lng, sentiment: editing.sentiment, activity: editing.activity, weatherIcon: editing.weatherIcon, weatherDegreeC: editing.weatherDegreeC, weatherPlace: editing.weatherPlace, tagWordIds: editing.tagWordIds } : undefined"
        @done="onDone"
      />
    </div>

    <MembershipDialog v-if="membershipOpen" @close="membershipOpen = false" />
    <StoriesOverlay v-if="storiesOpen" :throwbacks="throwbackList" :start-kind="storiesStart" @close="storiesOpen = false" />
  </div>
</template>
