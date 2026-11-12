<script setup lang="ts">
import { mdiBookmark, mdiHistory, mdiSortVariant, mdiCloudUploadOutline, mdiImageOutline, mdiCheck, mdiArrowDown, mdiArrowUp, mdiTrashCanOutline } from '@mdi/js'
import type { EntryV2 } from '~/utils/db'
import { WEATHER_EMOJI, weatherLabel } from '~/utils/services'

const { entries, refresh, toggleFavourite, duplicateEntry, saveAsTemplate, moveToTrash, restoreFromTrash, throwbacks, allMedia } = useEntries()
const route = useRoute()
const isMobile = useIsMobile()
const { formatTemp } = useUnits()

const editorOpen = ref(false)
const editing = ref<EntryV2 | null>(null)
const selected = ref<EntryV2 | null>(null)
const throwbackList = ref<EntryV2[]>([])
const throwbackLabel = ref('今天没有往日回忆')
const storiesOpen = ref(false)
const storiesStart = ref<'stats' | 'throwback'>('stats')
const membershipOpen = useMembershipDialog()
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
  const main = new Intl.DateTimeFormat('zh-CN', { month: 'long', day: 'numeric', year: 'numeric' }).format(d)
  return `${main} · ${new Intl.DateTimeFormat('zh-CN', { weekday: 'long' }).format(d)}`
}
function timeOf(e: EntryV2) {
  return new Intl.DateTimeFormat('zh-CN', { hour: 'numeric', minute: '2-digit', hour12: false }).format(new Date(e.dateOfJournal))
}

const today = new Date()
const todayLabel = new Intl.DateTimeFormat('zh-CN', { month: 'long', day: 'numeric', year: 'numeric' }).format(today)

function selectEntry(e: EntryV2) {
  selected.value = e
}

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
const deleteTarget = ref<EntryV2 | null>(null)
const snackbar = ref<{ text: string; trashId: number } | null>(null)
let snackTimer: ReturnType<typeof setTimeout> | undefined
function requestDelete() {
  deleteTarget.value = mobileDetail.value
}
async function doDelete() {
  const id = deleteTarget.value?.id
  deleteTarget.value = null
  if (id == null) return
  const trashId = await moveToTrash(id)
  mobileDetail.value = null
  if (trashId != null) {
    snackbar.value = { text: '已移到回收站', trashId }
    clearTimeout(snackTimer)
    snackTimer = setTimeout(() => { snackbar.value = null }, 6000)
  }
}
async function undoTrash() {
  const item = snackbar.value
  clearTimeout(snackTimer)
  snackbar.value = null
  if (item) await restoreFromTrash(item.trashId)
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

// Day One 条目行（ia-map listView；31a/50/60 证据）：按月分组 + 左日期块（周几+大日数字）+ 右摘要与时间
const monthGroups = computed(() => {
  const groups: Array<{ key: string; label: string; items: EntryV2[] }> = []
  for (const e of sortedEntries.value) {
    const d = new Date(e.dateOfJournal)
    const key = `${d.getFullYear()}-${d.getMonth()}`
    let g = groups[groups.length - 1]
    if (!g || g.key !== key) { g = { key, label: `${d.getFullYear()}年${d.getMonth() + 1}月`, items: [] }; groups.push(g) }
    g.items.push(e)
  }
  return groups
})
const dayNum = (e: EntryV2) => new Date(e.dateOfJournal).getDate()
const weekdayShort = (e: EntryV2) => new Intl.DateTimeFormat('zh-CN', { weekday: 'short' }).format(new Date(e.dateOfJournal)).replace('周', '')
const timeOnly = (e: EntryV2) => new Intl.DateTimeFormat('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(e.dateOfJournal))

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
async function onDone() {
  editorOpen.value = false
  editing.value = null
  await refresh()
  await loadThumbnails()
  if (selected.value) {
    const fresh = entries.value.find((x) => x.id === selected.value!.id)
    if (fresh) selectEntry(fresh)
  }
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
  <!-- 桌面布局（保持原样） -->
  <template v-if="!isMobile">
    <button class="jr-fab" title="新建日记" @click="openNew">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6z" /></svg>
    </button>

    <div class="jr-content">
      <div class="jr-list-col">
        <div class="jr-view-pills-row"><ViewPills /></div>
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

        <!-- Stories 卡已随 Day One 换皮退役（B2 决策：Day One 无此形态，统计由 JournalOverview 承载；StoriesOverlay 组件保留可恢复） -->

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

        <template v-for="group in monthGroups" :key="group.key">
          <div class="jr-month-head">{{ group.label }}</div>
          <div
            v-for="e in group.items"
            :key="e.id"
            class="jr-entry"
            :class="{ selected: selected?.id === e.id }"
            @click="selectEntry(e)"
          >
            <span class="jr-entry-dateblock" aria-hidden="true">
              <i>{{ weekdayShort(e) }}</i>
              <b>{{ dayNum(e) }}日</b>
            </span>
            <span class="jr-entry-main">
              <span class="preview">{{ e.previewText || '无正文' }}</span>
              <img v-if="thumbs[e.id!]" :src="thumbs[e.id!]" class="jr-row-thumb" />
              <span class="jr-entry-time">
                {{ timeOnly(e) }}
                <span v-if="e.weatherIcon" class="jr-entry-meta" :title="`${weatherLabel(e.weatherDescription)} ${formatTemp(e.weatherDegreeC)}`">{{ WEATHER_EMOJI[e.weatherIcon] || '☁️' }} {{ formatTemp(e.weatherDegreeC) }}</span>
                <span v-if="e.address" class="jr-entry-meta" :title="e.address">📍</span>
                <span v-if="e.favourite" class="jr-entry-meta" title="收藏">⭐</span>
                <span v-if="!e.synced" class="jr-status-icon" title="等待上传">
                  <JrIcon :path="mdiCloudUploadOutline" :size="15" />
                </span>
              </span>
            </span>
          </div>
        </template>
      </div>

      <div class="jr-detail-col" style="position:relative">
        <!-- Day One 右主区（ia-map journalOverview）：未选中条目时显示日记本概览（含 Streak），选中时显示详情 -->
        <JournalOverview v-if="!selected" :entries="entries" />
        <EntryDetail
          v-else
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
          :initial-meta="editing ? { address: editing.address, lat: editing.lat, lng: editing.lng, locationSource: editing.locationSource, adcode: editing.adcode, sentiment: editing.sentiment, activity: editing.activity, weatherIcon: editing.weatherIcon, weatherDegreeC: editing.weatherDegreeC, weatherDescription: editing.weatherDescription, weatherPlace: editing.weatherPlace, tagWordIds: editing.tagWordIds } : undefined"
          @done="onDone"
        />
      </div>

      <MembershipDialog v-if="membershipOpen" @close="membershipOpen = false" />
      <StoriesOverlay v-if="storiesOpen" :throwbacks="throwbackList" :start-kind="storiesStart" @close="storiesOpen = false" />
    </div>
  </template>

  <!-- 移动布局（对照 Journey Android 6.0.2，evidence/mobile-derived/ui-structure.md §2） -->
  <template v-else>
    <button class="jr-mfab" aria-label="新条目" @click="openNew">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6z" /></svg>
      <span>新条目</span>
    </button>

    <div class="jr-mfeed">
      <div class="sec">故事</div>
      <div class="mstories">
        <button class="card today" @click="storiesStart = 'stats'; storiesOpen = true">
          <span class="cico"><JrIcon :path="mdiBookmark" :size="20" /></span>
          <span class="ct">今天</span>
          <span class="cs">{{ todayLabel }}</span>
        </button>
        <button v-if="throwbackOn" class="card throwback" @click="storiesStart = 'throwback'; storiesOpen = true">
          <span class="cico"><JrIcon :path="mdiHistory" :size="20" /></span>
          <span class="ct">怀旧</span>
          <span class="cs">{{ throwbackList.length ? throwbackLabel : '没有怀旧今天' }}</span>
        </button>
      </div>

      <template v-if="entries.length">
        <div class="banner cloud">
          <JrIcon :path="mdiCloudUploadOutline" :size="22" style="color:#c96b60" />
          <div class="txt">
            <div class="t">移至云端</div>
            <div class="d">同步您的回忆并在任何设备上查看都是免费的。</div>
          </div>
        </div>
        <div class="banner member" @click="membershipOpen = true">
          <div class="txt">
            <div class="t">让我们升级吧！</div>
            <div class="d">加入数百万用户，创建一个更健康，更快乐的心态。</div>
          </div>
          <span class="chev">›</span>
        </div>
      </template>

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
        <button v-for="e in g.items" :key="e.id" class="mrow" @click="openMobileDetail(e)">
          <span class="time">{{ timeOf(e) }}</span>
          <span class="prev">{{ e.previewText || '无正文' }}</span>
          <span v-if="!e.synced" class="up" title="等待上传"><JrIcon :path="mdiCloudUploadOutline" :size="16" /></span>
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
      @trash="requestDelete"
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

    <div v-if="deleteTarget" class="mmask" @click.self="deleteTarget = null">
      <div class="mdlg" role="dialog" aria-modal="true" aria-label="删除日记">
        <JrIcon :path="mdiTrashCanOutline" :size="26" style="color:var(--jr-on-surface-variant)" />
        <div class="dlg-t">删除</div>
        <p>您想要删除这个日记条目吗？</p>
        <div class="dlg-btns">
          <button @click="deleteTarget = null">取消</button>
          <button class="danger" @click="doDelete">删除</button>
        </div>
      </div>
    </div>

    <div v-if="snackbar" class="msnack" role="status">
      <span>{{ snackbar.text }}</span>
      <button @click="undoTrash">撤销</button>
    </div>

    <MembershipDialog v-if="membershipOpen" @close="membershipOpen = false" />
    <StoriesOverlay v-if="storiesOpen" :throwbacks="throwbackList" :start-kind="storiesStart" @close="storiesOpen = false" />
  </template>
</template>

<style scoped>
/* ---- 移动首页（证据配色与布局） ---- */
.jr-mfab {
  position: fixed; right: 14px; bottom: calc(84px + env(safe-area-inset-bottom)); z-index: 90;
  display: flex; align-items: center; gap: 8px;
  background: #b2ebf2; color: #00344a; border: 0; border-radius: 999px;
  padding: 12px 18px; font-size: 15px; font-weight: 700;
  box-shadow: 0 3px 10px rgba(0, 60, 70, 0.25);
}
.jr-mfeed { padding: 6px 16px 0; }
.sec { font-size: 13.5px; font-weight: 600; margin: 8px 0 10px; }
.mstories { display: flex; gap: 14px; }
.mstories .card {
  flex: 1; display: flex; flex-direction: column; align-items: flex-start; gap: 4px;
  border: 0; border-radius: 16px; padding: 18px 14px; min-height: 118px;
  text-align: left; font-family: inherit;
}
.mstories .card.today { background: #e7e4f5; color: #1b1b33; }
.mstories .card.throwback { background: #b9bdc1; color: #fff; }
.mstories .cico { opacity: 0.85; }
.mstories .ct { font-size: 17px; font-weight: 800; }
.mstories .cs { font-size: 12.5px; opacity: 0.8; }
.banner {
  display: flex; align-items: center; gap: 12px;
  border-radius: 14px; padding: 14px; margin-top: 14px;
  background: #dcebee; width: 100%; text-align: left; border: 0; font-family: inherit;
}
.banner .txt { flex: 1; min-width: 0; }
.banner .t { font-weight: 800; font-size: 14.5px; }
.banner .d { font-size: 12.5px; color: var(--jr-on-surface-variant); margin-top: 2px; }
.banner.member .chev { font-size: 22px; color: var(--jr-on-surface-variant); }
.ehead { display: flex; align-items: center; margin: 20px 0 4px; position: relative; }
.ehead .label { font-size: 14px; font-weight: 600; flex: 1; text-align: left; }
.ehead .sort { background: transparent; border: 0; color: var(--jr-on-surface-variant); width: 38px; height: 38px; display: flex; align-items: center; justify-content: center; }
.msort { right: 0; top: 44px; }
.ghead { text-align: center; font-size: 14px; font-weight: 700; margin: 18px 0 8px; }
.mrow {
  display: flex; flex-direction: column; align-items: flex-start; gap: 4px;
  width: 100%; border: 0; border-radius: 16px; padding: 14px 16px; margin-bottom: 10px;
  background: #e6f0f3; text-align: left; font-family: inherit; color: var(--jr-on-bg);
}
.mrow .time { font-weight: 800; font-size: 15px; }
.mrow .prev { font-size: 13.5px; color: var(--jr-on-surface-variant); overflow: hidden; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; }
.mrow .up { color: #e05a4e; }
.mempty { text-align: center; padding: 60px 0 30px; color: var(--jr-outline); }
.mempty .t { font-size: 16px; margin: 14px 0 4px; color: var(--jr-on-surface-variant); }
.mempty .d { font-size: 13px; margin: 0; }
.mmask { position: fixed; inset: 0; z-index: 400; background: rgba(90, 100, 104, 0.55); display: flex; align-items: center; justify-content: center; }
.mdlg { width: min(320px, 84vw); background: #e6eaea; border-radius: 22px; padding: 22px 18px 14px; text-align: center; }
.mdlg .dlg-t { font-size: 20px; font-weight: 800; margin: 8px 0 6px; }
.mdlg p { font-size: 13.5px; color: var(--jr-on-surface-variant); margin: 0 0 16px; }
.mdlg .dlg-btns { display: flex; justify-content: center; gap: 26px; }
.mdlg .dlg-btns button { background: transparent; border: 0; color: var(--jr-primary); font-size: 15px; font-weight: 700; padding: 8px 6px; }
.mdlg .dlg-btns .danger { color: var(--jr-error); }
.msnack {
  position: fixed; left: 14px; right: 14px; bottom: calc(78px + env(safe-area-inset-bottom)); z-index: 380;
  display: flex; align-items: center; gap: 12px;
  background: #303638; color: #fff; border-radius: 10px; padding: 12px 16px;
  font-size: 13.5px; box-shadow: 0 4px 14px rgba(0, 0, 0, 0.3);
}
.msnack button { margin-left: auto; background: transparent; border: 0; color: #85d1e8; font-weight: 700; font-size: 13.5px; }
/* 深色主题:卡片与横幅走暗色 */
[data-theme="dark"] .mrow { background: #26333a; }
[data-theme="dark"] .mstories .card.today { background: #3a3552; color: #d9d4f2; }
[data-theme="dark"] .mstories .card.throwback { background: #3c4148; color: #cfd6da; }
[data-theme="dark"] .banner { background: #24363c; }
[data-theme="dark"] .banner .d { color: #9fb0b5; }
[data-theme="dark"] .mdlg { background: #2b3236; }
[data-theme="dark"] .mdlg p { color: #9fb0b5; }
</style>
