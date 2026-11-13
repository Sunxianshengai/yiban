<script setup lang="ts">
import { mdiBookmark, mdiSortVariant, mdiCloudUploadOutline, mdiImageOutline, mdiCheck, mdiArrowDown, mdiArrowUp, mdiMapMarkerOutline, mdiStar, mdiStarOutline, mdiPlus, mdiWeatherSunny } from '@mdi/js'
import type { EntryV2 } from '~/utils/db'
import { WEATHER_EMOJI, weatherLabel } from '~/utils/services'

const { entries, refresh, toggleFavourite, duplicateEntry, saveAsTemplate, moveToTrash, throwbacks, allMedia } = useEntries()
const route = useRoute()
const isMobile = useIsMobile()
const { formatTemp } = useUnits()

const editorOpen = ref(false)
const inlineEditor = ref<{ discardChanges: () => Promise<boolean> } | null>(null)
const editing = ref<EntryV2 | null>(null)
const selected = ref<EntryV2 | null>(null)
const throwbackList = ref<EntryV2[]>([])
const throwbackLabel = ref('今天没有往日回忆')
const storiesOpen = ref(false)
const storiesStart = ref<'stats' | 'throwback'>('stats')
const throwbackOn = ref(localStorage.getItem('jr.throwback') !== '0')

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
const { prefetch: prefetchMedia, urlForSync: mediaUrl } = useMediaResolver()
let thumbsGeneration = 0
function releaseThumbnails() {
  for (const url of Object.values(thumbs.value)) if (url.startsWith('blob:')) URL.revokeObjectURL(url)
}
async function loadThumbnails() {
  const generation = ++thumbsGeneration
  const media = await allMedia()
  if (generation !== thumbsGeneration) return
  // 云端来的图片没有本地 blob，先换预签名地址，否则列表里就没缩略图
  await prefetchMedia(media.filter(m => m.mimeType.startsWith('image/')))
  if (generation !== thumbsGeneration) return
  const map: Record<number, string> = {}
  for (const m of media) {
    if (m.jId != null && m.mimeType.startsWith('image/') && map[m.jId] == null) {
      const url = mediaUrl(m)
      if (url) map[m.jId] = url
    }
  }
  oldThumbs = { ...thumbs.value }
  thumbs.value = map
  // 旧地址要等 DOM 换完再释放，否则会闪白
  queueMicrotask(() => {
    for (const url of Object.values(oldThumbs)) if (url.startsWith('blob:') && !Object.values(map).includes(url)) URL.revokeObjectURL(url)
    oldThumbs = {}
  })
}
let oldThumbs: Record<number, string> = {}
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

// 移动端按日分组（组头「2026年11月10日 · 周二」，证据 ui-structure.md §2）
const groupedEntries = computed(() => {
  const groups: { label: string; items: EntryV2[] }[] = []
  for (const e of sortedEntries.value) {
    const label = groupLabel(new Date(e.dateOfJournal))
    const last = groups[groups.length - 1]
    if (last && last.label === label) last.items.push(e)
    else groups.push({ label, items: [e] })
  }
  return groups
})
function groupLabel(d: Date) {
  // Day One 移动组头=月份制（40-mobile-main 证据："2026年11月"）
  return `${d.getFullYear()}年${d.getMonth() + 1}月`
}
function timeOf(e: EntryV2) {
  return new Intl.DateTimeFormat('zh-CN', { hour: 'numeric', minute: '2-digit', hour12: false }).format(new Date(e.dateOfJournal))
}

const today = new Date()
const todayLabel = new Intl.DateTimeFormat('zh-CN', { month: 'long', day: 'numeric', year: 'numeric' }).format(today)

async function selectEntry(e: EntryV2) {
  if (editorOpen.value && editing.value?.id === e.id) return
  if (!await closeInlineEditor()) return
  selected.value = e
}

async function closeInlineEditor() {
  if (!inlineEditor.value) return true
  if (!await inlineEditor.value.discardChanges()) return false
  editorOpen.value = false
  editing.value = null
  return true
}
onBeforeRouteLeave(closeInlineEditor)
onBeforeRouteUpdate(closeInlineEditor)

// 移动详情：全屏页 + 前后篇导航
const mobileDetail = ref<EntryV2 | null>(null)
const mdIndex = computed(() => mobileDetail.value ? sortedEntries.value.findIndex(e => e.id === mobileDetail.value!.id) : -1)
const mdHasPrev = computed(() => mdIndex.value > 0)
const mdHasNext = computed(() => mdIndex.value >= 0 && mdIndex.value < sortedEntries.value.length - 1)
function mdStep(delta: number) {
  const next = sortedEntries.value[mdIndex.value + delta]
  if (next) mobileDetail.value = next
}
function openMobileDetail(e: EntryV2) {
  mobileDetail.value = e
}
watch(() => route.query.entry, (target) => {
  const id = Number(target)
  if (id > 0 && isMobile.value) {
    const found = sortedEntries.value.find(e => e.id === id)
    if (found) mobileDetail.value = found
  }
})

// 删除 + 原地撤销（证据 §5：确认弹窗 → 底部 snackbar 撤销）
const deleteId = ref<number | null>(null)

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

const activeFilter = ref<'all' | 'media' | 'starred' | 'location'>('all')
const filteredEntries = computed(() => {
  return sortedEntries.value.filter(e => {
    if (activeFilter.value === 'media') return !!thumbs.value[e.id!]
    if (activeFilter.value === 'starred') return !!e.favourite
    if (activeFilter.value === 'location') return !!e.address || (e.lat != null && e.lng != null)
    return true
  })
})

// Day One 条目行（ia-map listView；31a/50/60 证据）：按月分组 + 左日期块（周几+大日数字）+ 右摘要与时间
const monthGroups = computed(() => {
  const groups: Array<{ key: string; label: string; items: EntryV2[] }> = []
  for (const e of filteredEntries.value) {
    const d = new Date(e.dateOfJournal)
    const key = `${d.getFullYear()}-${d.getMonth()}`
    let g = groups[groups.length - 1]
    if (!g || g.key !== key) { g = { key, label: `${d.getFullYear()}年${d.getMonth() + 1}月`, items: [] }; groups.push(g) }
    g.items.push(e)
  }
  return groups
})
const dayNum = (e: EntryV2) => new Date(e.dateOfJournal).getDate()
const weekdayShort = (e: EntryV2) => new Intl.DateTimeFormat('zh-CN', { weekday: 'short' }).format(new Date(e.dateOfJournal))
const timeOnly = (e: EntryV2) => new Intl.DateTimeFormat('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(e.dateOfJournal))

function entryTitle(e: EntryV2) {
  const text = (e.previewText || e.text || '').trim()
  const firstLine = text.split('\n')[0]?.replace(/^[#\s]+/, '').trim()
  return firstLine || '无标题日记'
}
function entrySnippet(e: EntryV2) {
  const text = (e.previewText || e.text || '').trim()
  const lines = text.split('\n').map(l => l.replace(/^[#\s]+/, '').trim()).filter(Boolean)
  if (lines.length > 1) return lines.slice(1).join(' ')
  return text || '无正文'
}

function openNew() {
  editing.value = null
  editorOpen.value = true
}
function openEdit() {
  const target = mobileDetail.value ?? selected.value
  if (target) {
    editing.value = target
    editorOpen.value = true
  }
}
async function onDone(savedId?: number) {
  const previousSelection = selected.value
  const activeId = !isMobile.value && savedId != null ? savedId : previousSelection?.id
  editorOpen.value = false
  editing.value = null
  await refresh()
  if (activeId != null && selected.value === previousSelection && !editorOpen.value) {
    selected.value = entries.value.find(e => e.id === activeId) ?? null
  }
  await loadThumbnails()
  if (mobileDetail.value) {
    mobileDetail.value = entries.value.find((x) => x.id === mobileDetail.value!.id) ?? null
  }
}
async function onDuplicate() {
  const source = mobileDetail.value ?? selected.value
  if (source) {
    const copy = await duplicateEntry(source.id!)
    await loadThumbnails()
    const fresh = entries.value.find(e => e.id === copy) ?? null
    if (isMobile.value) { mobileDetail.value = null; mobileDetail.value = fresh }
    else selected.value = fresh
  }
}
function onSaveTemplate() {
  const source = mobileDetail.value ?? selected.value
  if (source) saveAsTemplate(source.id!)
}
async function onTrash() {
  const source = mobileDetail.value ?? selected.value
  if (source) {
    await moveToTrash(source.id!)
    mobileDetail.value = null
    selected.value = null
  }
}
async function onFavourite() {
  const source = mobileDetail.value ?? selected.value
  const id = source?.id
  if (id == null) return
  await toggleFavourite(id)
  const fresh = entries.value.find(e => e.id === id) ?? null
  if (mobileDetail.value) mobileDetail.value = fresh
  selected.value = fresh
}
</script>

<template>
  <!-- 桌面时间线的右栏在概览、详情和编辑之间切换。 -->
  <template v-if="!isMobile">
    <div class="jr-content">
      <div class="jr-list-col">
        <div class="jr-mid-header">
          <ViewPills />
          <button class="jr-mid-add-btn" title="新建日记" @click="openNew">
            <JrIcon :path="mdiPlus" :size="18" />
          </button>
        </div>
        
        <div class="jr-filter-chips-row">
          <button class="jr-chip" :class="{ on: activeFilter === 'all' }" @click="activeFilter = 'all'">
            全部 ({{ entries.length }})
          </button>
          <button class="jr-chip" :class="{ on: activeFilter === 'media' }" @click="activeFilter = 'media'">
            <JrIcon :path="mdiImageOutline" :size="13" />
            <span>含照片</span>
          </button>
          <button class="jr-chip" :class="{ on: activeFilter === 'starred' }" @click="activeFilter = 'starred'">
            <JrIcon :path="mdiStarOutline" :size="13" />
            <span>收藏</span>
          </button>
        </div>

        <div v-if="!sortedEntries.length" class="jr-empty">
          <div class="big"><JrIcon :path="mdiImageOutline" :size="46" /></div>
          暂无日记。
        </div>

        <template v-for="group in monthGroups" :key="group.key">
          <div class="jr-month-head-row">
            <span class="jr-month-head">{{ group.label }}</span>
            <button class="jr-sort-btn" title="排序" @click="sortMenuOpen = !sortMenuOpen">
              <JrIcon :path="mdiSortVariant" :size="16" />
            </button>
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

          <div
            v-for="e in group.items"
            :key="e.id"
            class="jr-entry"
            :class="{ selected: (editorOpen ? editing : selected)?.id === e.id }"
            @click="selectEntry(e)"
          >
            <span class="jr-entry-dateblock" aria-hidden="true">
              <i>{{ weekdayShort(e) }}</i>
              <b>{{ dayNum(e) }}</b>
            </span>
            <span class="jr-entry-main">
              <span class="jr-entry-title-row">
                <span class="title">{{ entryTitle(e) }}</span>
                <span class="time">{{ timeOnly(e) }}</span>
              </span>
              <span class="preview">{{ entrySnippet(e) }}</span>
              <span class="jr-entry-time">
                <span v-if="e.weatherIcon" class="jr-entry-meta" :title="`${weatherLabel(e.weatherDescription)} ${formatTemp(e.weatherDegreeC)}`">
                  <JrIcon :path="mdiWeatherSunny" :size="13" />
                  <span>{{ formatTemp(e.weatherDegreeC) }}</span>
                </span>
                <span v-if="e.address" class="jr-entry-meta" :title="e.address">
                  <JrIcon :path="mdiMapMarkerOutline" :size="13" />
                  <span>{{ (e.address || '').slice(0, 8) }}</span>
                </span>
                <span v-if="e.favourite" class="jr-entry-meta" title="收藏" style="color:#F59E0B">
                  <JrIcon :path="mdiStar" :size="13" />
                </span>
                <span v-if="!e.synced" class="jr-status-icon" title="等待上传">
                  <JrIcon :path="mdiCloudUploadOutline" :size="14" />
                </span>
              </span>
            </span>
            <div v-if="thumbs[e.id!]" class="jr-row-polaroid">
              <img :src="thumbs[e.id!]" alt="" />
            </div>
          </div>
        </template>
      </div>

      <div class="jr-detail-col jr-timeline-detail">
        <EntryEditor
          v-if="editorOpen"
          ref="inlineEditor"
          inline
          :entry-id="editing?.id"
          :initial-text="editing?.text"
          :initial-date="editing ? new Date(editing.dateOfJournal) : undefined"
          :initial-meta="editing ? { address: editing.address, lat: editing.lat, lng: editing.lng, locationSource: editing.locationSource, adcode: editing.adcode, sentiment: editing.sentiment, activity: editing.activity, weatherIcon: editing.weatherIcon, weatherDegreeC: editing.weatherDegreeC, weatherDescription: editing.weatherDescription, weatherPlace: editing.weatherPlace, tagWordIds: editing.tagWordIds } : undefined"
          @done="onDone"
        />
        <EntryDetail
          v-else-if="selected"
          :entry="selected"
          @edit="openEdit"
          @toggle-favourite="onFavourite"
          @duplicate="onDuplicate"
          @save-as-template="onSaveTemplate"
          @trash="onTrash"
        />
        <JournalOverview v-else :entries="entries" />
      </div>

      <StoriesOverlay v-if="storiesOpen" :throwbacks="throwbackList" :start-kind="storiesStart" @close="storiesOpen = false" />
    </div>
  </template>

  <!-- 移动布局（对照 Journey Android 6.0.2，evidence/mobile-derived/ui-structure.md §2） -->
  <template v-else>
    <button class="jr-mfab" aria-label="新条目" @click="openNew">
      <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6z" /></svg>
    </button>

    <div class="jr-mfeed">
      <!-- Stories 卡已随 Day One 换皮退役（B2/M-204，移动侧同批） -->

      <div class="ehead">
        <span class="label">条目</span>
        <button class="sort" title="排序" aria-label="排序" @click="sortMenuOpen = !sortMenuOpen"><JrIcon :path="mdiSortVariant" :size="20" /></button>
        <div v-if="sortMenuOpen" class="jr-sort-menu msort">
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

      <div v-if="!sortedEntries.length" class="mempty">
        <div class="big"><JrIcon :path="mdiBookmark" :size="52" /></div>
        <p class="t">没有日记条目。</p>
        <p class="d">通过添加新的条目开始您的旅程。</p>
      </div>

      <template v-for="g in groupedEntries" :key="g.label">
        <div class="ghead">{{ g.label }}</div>
        <!-- Day One 移动条目卡（40-mobile-main）：左日期块+右摘要与时间，FAB 圆角方块 -->
        <button v-for="e in g.items" :key="e.id" class="mrow" @click="openMobileDetail(e)">
          <span class="jr-entry-dateblock" aria-hidden="true">
            <i>{{ weekdayShort(e) }}</i>
            <b>{{ dayNum(e) }}日</b>
          </span>
          <span class="jr-entry-main">
            <span class="prev">{{ e.previewText || '无正文' }}</span>
            <span class="mrow-time">
              {{ timeOf(e) }}
              <span v-if="!e.synced" class="up" title="等待上传"><JrIcon :path="mdiCloudUploadOutline" :size="14" /></span>
            </span>
          </span>
        </button>
      </template>

      <div style="height:96px" />
    </div>

    <EntryDetailMobile
      v-if="mobileDetail"
      :entry="mobileDetail"
      :has-prev="mdHasPrev"
      :has-next="mdHasNext"
      @back="mobileDetail = null"
      @edit="openEdit"
      @toggle-favourite="onFavourite"
      @duplicate="onDuplicate"
      @save-as-template="onSaveTemplate"
      @trash="deleteId = mobileDetail.id ?? null"
      @prev="mdStep(-1)"
      @next="mdStep(1)"
    />

    <EntryEditor
      v-if="editorOpen"
      :entry-id="editing?.id"
      :initial-text="editing?.text"
      :initial-date="editing ? new Date(editing.dateOfJournal) : undefined"
      :initial-meta="editing ? { address: editing.address, lat: editing.lat, lng: editing.lng, locationSource: editing.locationSource, adcode: editing.adcode, sentiment: editing.sentiment, activity: editing.activity, weatherIcon: editing.weatherIcon, weatherDegreeC: editing.weatherDegreeC, weatherDescription: editing.weatherDescription, weatherPlace: editing.weatherPlace, tagWordIds: editing.tagWordIds } : undefined"
      @done="onDone"
    />

    <MobileEntryTrash v-model="deleteId" @trashed="mobileDetail = null" @restored="loadThumbnails" />
    <StoriesOverlay v-if="storiesOpen" :throwbacks="throwbackList" :start-kind="storiesStart" @close="storiesOpen = false" />
  </template>
</template>

<style scoped>
/* ---- 移动首页（Day One 40-mobile-main 证据） ---- */
.jr-mfab {
  position: fixed; right: 18px; bottom: calc(22px + env(safe-area-inset-bottom)); z-index: 90;
  display: flex; align-items: center; justify-content: center;
  width: 56px; height: 56px;
  background: var(--jr-primary); color: var(--jr-on-primary); border: 0; border-radius: 14px;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.25);
}
.jr-mfeed { padding: 6px 16px 0; }
.ehead { display: flex; align-items: center; margin: 20px 0 4px; position: relative; }
.ehead .label { font-size: 14px; font-weight: 600; flex: 1; text-align: left; }
.ehead .sort { background: transparent; border: 0; color: var(--jr-on-surface-variant); width: 38px; height: 38px; display: flex; align-items: center; justify-content: center; }
.msort { right: 0; top: 44px; }
.ghead {
  text-align: left; font-size: 13px; font-weight: 600; color: var(--jr-on-surface-variant);
  background: var(--jr-surface-variant); margin: 14px -16px 8px; padding: 8px 16px;
}
.mrow {
  display: flex; gap: 10px; align-items: flex-start;
  width: 100%; border: 1px solid var(--jr-outline-variant); border-radius: 12px; padding: 12px 14px; margin-bottom: 10px;
  background: var(--jr-surface); text-align: left; font-family: inherit; color: var(--jr-on-bg);
}
.mrow .prev { font-size: 14px; line-height: 1.45; color: var(--jr-on-bg); overflow: hidden; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; }
.mrow .mrow-time { margin-top: 6px; display: flex; gap: 8px; align-items: center; font-size: 12px; color: var(--jr-on-surface-variant); }
.mrow .up { color: #e05a4e; }
.mempty { text-align: center; padding: 60px 0 30px; color: var(--jr-outline); }
.mempty .t { font-size: 16px; margin: 14px 0 4px; color: var(--jr-on-surface-variant); }
.mempty .d { font-size: 13px; margin: 0; }
[data-theme="dark"] .mrow { background: var(--jr-layer); }
</style>
