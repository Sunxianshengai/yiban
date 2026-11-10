<script setup lang="ts">
import { mdiFilterVariant, mdiImageOutline, mdiBookOutline, mdiStarOutline, mdiTagOutline, mdiArrowLeft, mdiClose, mdiChevronDown, mdiCloudUploadOutline, mdiCloudOutline, mdiChevronRight, mdiPuzzleOutline, mdiAccountOutline, mdiCogOutline } from '@mdi/js'
import type { EntryV2, TagWordV2 } from '~/utils/db'
import { htmlToPreview } from '~/utils/db'
import { activities, journalActivity, journalSentiment, sentiments } from '~/utils/journalOptions'

definePageMeta({ alias: ['/search/results'], key: 'journal-search' })

const route = useRoute()
const router = useRouter()
const isMobile = useIsMobile()
const routeText = computed(() => String(route.query.query ?? route.query.q ?? ''))
const q = ref(routeText.value)
watch(routeText, value => { q.value = value })

const { entries, listTags, allMedia } = useEntries()
const membershipOpen = useMembershipDialog()
const tags = ref<TagWordV2[]>([])
const filtersOpen = ref(false)
// 移动端筛选行展开态（原版为行式 + 展开箭头）
const mExpand = ref<'tags' | 'activity' | 'sentiment' | null>(null)
const starredOnly = computed(() => 'favourite' in route.query || route.query.starred === '1')
type FilterKey = 'tags' | 'activity' | 'sentiment'
function selectedCodes(key: FilterKey) {
  return String(route.query[key] ?? '').split(',').map(value => value.trim()).filter(Boolean).map(Number).filter(Number.isFinite)
}
const activeTags = computed(() => selectedCodes('tags'))
const activeActivities = computed(() => selectedCodes('activity'))
const activeSentiments = computed(() => selectedCodes('sentiment'))
const hasFilters = computed(() => starredOnly.value || !!(activeTags.value.length || activeActivities.value.length || activeSentiments.value.length))
const needle = computed(() => q.value.trim().toLowerCase())
const searchText = computed(() => new Map(entries.value.map(entry => [entry.id, htmlToPreview(entry.text, Infinity).toLowerCase()])))

function search(update: Partial<Record<FilterKey | 'favourite', string | undefined>> = {}) {
  const query = { ...route.query, q: undefined, starred: undefined, query: q.value.trim() || undefined, favourite: starredOnly.value ? 'true' : undefined, ...update }
  return router.replace({ path: '/search/results', query })
}

function toggleFilter(key: FilterKey, code: number) {
  const selected = selectedCodes(key)
  const next = selected.includes(code) ? selected.filter(value => value !== code) : [...selected, code]
  return search({ [key]: next.join(',') || undefined })
}

const results = computed(() => {
  return entries.value.filter((e) => {
    if (starredOnly.value && !e.favourite) return false
    if (activeTags.value.length && !(e.tagWordIds || []).some((t) => activeTags.value.includes(t))) return false
    if (activeActivities.value.length) {
      const activity = journalActivity(e.activity)
      if (!activity || !activeActivities.value.includes(activity.code)) return false
    }
    if (activeSentiments.value.length) {
      const sentiment = journalSentiment(e.sentiment)
      if (!sentiment || !activeSentiments.value.includes(sentiment.code)) return false
    }
    if (!needle.value) return hasFilters.value
    return !!searchText.value.get(e.id)?.includes(needle.value)
  })
})

// Keep local filename search alongside entry results. The original's classified file types require Sync.
const fileResults = computed(() =>
  needle.value && !hasFilters.value ? mediaItems.value.filter((m) => m.fileName.toLowerCase().includes(needle.value)) : [],
)
const mediaItems = ref<{ id?: number; fileName: string; jId?: number }[]>([])
onMounted(async () => {
  const [rows, tagRows] = await Promise.all([allMedia(), listTags()])
  tags.value = tagRows
  mediaItems.value = rows.map(({ id, fileName, jId }) => ({ id, fileName, jId }))
})

// 移动端结果分组 + 全屏详情（与首页同构）
const groupedResults = computed(() => {
  const groups: { label: string; items: EntryV2[] }[] = []
  for (const e of results.value) {
    const d = new Date(e.dateOfJournal)
    const label = `${new Intl.DateTimeFormat('zh-CN', { month: 'long', day: 'numeric', year: 'numeric' }).format(d)} · ${new Intl.DateTimeFormat('zh-CN', { weekday: 'long' }).format(d)}`
    const last = groups[groups.length - 1]
    if (last && last.label === label) last.items.push(e)
    else groups.push({ label, items: [e] })
  }
  return groups
})
function timeOf(e: EntryV2) {
  return new Intl.DateTimeFormat('zh-CN', { hour: 'numeric', minute: '2-digit', hour12: false }).format(new Date(e.dateOfJournal))
}
const mobileDetail = ref<EntryV2 | null>(null)
const editorOpen = ref(false)
const editingId = ref<number | undefined>(undefined)
function editSelected(e: EntryV2) { editingId.value = e.id ?? undefined; editorOpen.value = true }
function open(e: EntryV2) {
  if (isMobile.value) mobileDetail.value = e
  else selected.value = e
}
async function onMobileDone() {
  editorOpen.value = false
  await refresh()
  if (mobileDetail.value) mobileDetail.value = entries.value.find(e => e.id === mobileDetail.value!.id) ?? null
}
const selected = ref<EntryV2 | null>(null)
function rowDate(e: EntryV2) {
  const d = new Date(e.dateOfJournal)
  const main = new Intl.DateTimeFormat('zh-CN', { month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }).format(d)
  return `${main} · ${new Intl.DateTimeFormat('zh-CN', { weekday: 'short' }).format(d)}`
}
async function onMobileFavourite() {
  const id = mobileDetail.value?.id
  if (id == null) return
  await useEntries().toggleFavourite(id)
  mobileDetail.value = entries.value.find(e => e.id === id) ?? null
}
</script>

<template>
  <!-- 移动端：全屏搜索页（返回 + 搜索框 + ✕ + 筛选器行 + 结果），证据 ui-structure.md §9 -->
  <template v-if="isMobile">
    <div class="msearch">
      <div class="mbar">
        <button class="ico" aria-label="返回" @click="router.back()"><JrIcon :path="mdiArrowLeft" :size="22" /></button>
        <input v-model="q" type="text" placeholder="搜索 Journey…" aria-label="搜索日记" @keyup.enter="search()" />
        <button class="ico" aria-label="关闭" @click="q = ''; search()"><JrIcon :path="mdiClose" :size="22" /></button>
      </div>

      <div class="fsec">筛选器</div>
      <div class="frow" @click="mExpand = mExpand === 'tags' ? null : 'tags'">
        <span class="fico" :style="{ color: 'var(--jr-primary)' }"><JrIcon :path="mdiTagOutline" :size="20" /></span>
        <span class="ft">标签</span>
        <span class="fc">{{ activeTags.length }}</span>
        <JrIcon class="fchev" :class="{ open: mExpand === 'tags' }" :path="mdiChevronDown" :size="20" />
      </div>
      <div v-if="mExpand === 'tags'" class="fdrop">
        <p v-if="!tags.length" class="jr-muted">暂无标签</p>
        <button v-for="tag in tags" :key="tag.id" type="button" class="fopt" :class="{ on: activeTags.includes(tag.id!) }" @click="toggleFilter('tags', tag.id!)">{{ tag.title }}</button>
      </div>
      <button type="button" class="frow" :class="{ on: starredOnly }" @click="search({ favourite: starredOnly ? undefined : 'true' })">
        <span class="fico" style="color:#e2a03f"><JrIcon :path="mdiStarOutline" :size="20" /></span>
        <span class="ft">已加星标</span>
      </button>
      <div class="frow" @click="mExpand = mExpand === 'activity' ? null : 'activity'">
        <span class="fico" style="color:#4c7d92"><JrIcon :path="mdiFilterVariant" :size="20" /></span>
        <span class="ft">活动</span>
        <span class="fc">{{ activeActivities.length }}</span>
        <JrIcon class="fchev" :class="{ open: mExpand === 'activity' }" :path="mdiChevronDown" :size="20" />
      </div>
      <div v-if="mExpand === 'activity'" class="fdrop">
        <button v-for="activity in activities" :key="activity.code" type="button" class="fopt" :class="{ on: activeActivities.includes(activity.code) }" @click="toggleFilter('activity', activity.code)">{{ activity.label }}</button>
      </div>
      <div class="frow" @click="mExpand = mExpand === 'sentiment' ? null : 'sentiment'">
        <span class="fico" style="color:#66bb6a"><JrIcon :path="mdiFilterVariant" :size="20" /></span>
        <span class="ft">情绪</span>
        <span class="fc">{{ activeSentiments.length }}</span>
        <JrIcon class="fchev" :class="{ open: mExpand === 'sentiment' }" :path="mdiChevronDown" :size="20" />
      </div>
      <div v-if="mExpand === 'sentiment'" class="fdrop">
        <button v-for="sentiment in sentiments" :key="sentiment.code" type="button" class="fopt" :class="{ on: activeSentiments.includes(sentiment.code) }" @click="toggleFilter('sentiment', sentiment.code)">{{ sentiment.label }}</button>
      </div>
      <button v-if="hasFilters" class="fclear" @click="search({ tags: undefined, activity: undefined, sentiment: undefined, favourite: undefined })">清除筛选</button>

      <template v-if="results.length">
        <div class="sec">条目</div>
        <template v-for="g in groupedResults" :key="g.label">
          <div class="ghead">{{ g.label }}</div>
          <button v-for="e in g.items" :key="e.id" class="mrow" @click="open(e)">
            <span class="time">{{ timeOf(e) }}</span>
            <span class="prev">{{ e.previewText || '无正文' }}</span>
            <span v-if="!e.synced" class="up"><JrIcon :path="mdiCloudUploadOutline" :size="16" /></span>
          </button>
        </template>
      </template>
      <div v-else-if="q || hasFilters" class="mempty2">
        <div class="big"><JrIcon :path="q ? mdiImageOutline : mdiBookOutline" :size="44" /></div>
        暂无日记。
      </div>

      <template v-if="fileResults.length">
        <div class="sec">附件结果</div>
        <button v-for="m in fileResults" :key="'f' + m.id" class="mrow" @click="open(entries.find(e => e.id === m.jId)!)">
          <span class="time">{{ m.fileName }}</span>
          <span class="prev">媒体附件 · 所属日记</span>
        </button>
      </template>

      <!-- 「我的」面板（证据 r05：搜索页下半 = 云服务/升级/插件/登录/设置） -->
      <div class="psec">服务</div>
      <NuxtLink class="prow" to="/cloud">
        <span class="fico" style="color:var(--jr-primary)"><JrIcon :path="mdiCloudOutline" :size="20" /></span>
        <span class="ft">云服务</span>
        <JrIcon class="fchev" :path="mdiChevronRight" :size="20" />
      </NuxtLink>
      <button type="button" class="prow" @click="membershipOpen = true">
        <span class="fico" style="color:#e2a03f"><JrIcon :path="mdiStarOutline" :size="20" /></span>
        <span class="ft">升级</span>
        <JrIcon class="fchev" :path="mdiChevronRight" :size="20" />
      </button>
      <NuxtLink class="prow" to="/addons">
        <span class="fico" style="color:#66bb6a"><JrIcon :path="mdiPuzzleOutline" :size="20" /></span>
        <span class="ft">插件</span>
        <JrIcon class="fchev" :path="mdiChevronRight" :size="20" />
      </NuxtLink>
      <NuxtLink class="prow" to="/cloud">
        <span class="fico" style="color:#5c6bc0"><JrIcon :path="mdiAccountOutline" :size="20" /></span>
        <span class="ft">登录 Journey</span>
        <JrIcon class="fchev" :path="mdiChevronRight" :size="20" />
      </NuxtLink>
      <NuxtLink class="prow" to="/settings">
        <span class="fico" style="color:#78909c"><JrIcon :path="mdiCogOutline" :size="20" /></span>
        <span class="ft">设置</span>
        <JrIcon class="fchev" :path="mdiChevronRight" :size="20" />
      </NuxtLink>
      <div style="height:24px" />
    </div>

    <EntryDetailMobile
      v-if="mobileDetail"
      :entry="mobileDetail"
      :has-prev="false"
      :has-next="false"
      @back="mobileDetail = null"
      @edit="editSelected(mobileDetail)"
      @toggle-favourite="onMobileFavourite"
    />
    <EntryEditor v-if="editorOpen" :entry-id="editingId" @done="onMobileDone" />
  </template>

  <!-- 桌面端（保持原样） -->
  <div v-else class="jr-content">
    <div class="jr-list-col">
      <div style="display:flex;align-items:center;gap:10px;margin:22px 0 0">
        <button class="jr-search" style="margin:0;padding:7px 12px;font-size:12px;font-weight:700;letter-spacing:.4px" :aria-expanded="filtersOpen" aria-controls="jr-search-filters" @click="filtersOpen = !filtersOpen">
          <JrIcon :path="mdiFilterVariant" :size="15" /> 筛选
        </button>
        <form class="jr-search" style="margin:0" @submit.prevent="search()"><input v-model="q" type="text" placeholder="搜索" aria-label="搜索日记" /></form>
      </div>
      <div v-show="filtersOpen" id="jr-search-filters" class="jr-search-filters">
        <details>
          <summary>标签</summary>
          <p v-if="!tags.length" class="jr-muted">暂无标签</p>
          <button v-for="tag in tags" :key="tag.id" type="button" class="jr-pop-item" :class="{ 'jr-on': activeTags.includes(tag.id!) }" :aria-pressed="activeTags.includes(tag.id!)" @click="toggleFilter('tags', tag.id!)">
            <JrIcon :path="mdiTagOutline" :size="17" /> {{ tag.title }}
          </button>
        </details>
        <button type="button" class="jr-pop-item" :class="{ 'jr-on': starredOnly }" :aria-pressed="starredOnly" @click="search({ favourite: starredOnly ? undefined : 'true' })">
          <JrIcon :path="mdiStarOutline" :size="17" /> 收藏
        </button>
        <details>
          <summary>活动</summary>
          <button v-for="activity in activities" :key="activity.code" type="button" class="jr-pop-item" :class="{ 'jr-on': activeActivities.includes(activity.code) }" :aria-pressed="activeActivities.includes(activity.code)" @click="toggleFilter('activity', activity.code)">
            <JrIcon :path="activity.icon" :size="17" /> {{ activity.label }}
          </button>
        </details>
        <details>
          <summary>心情</summary>
          <button v-for="sentiment in sentiments" :key="sentiment.code" type="button" class="jr-pop-item" :class="{ 'jr-on': activeSentiments.includes(sentiment.code) }" :aria-pressed="activeSentiments.includes(sentiment.code)" @click="toggleFilter('sentiment', sentiment.code)">
            <JrIcon :path="sentiment.icon" :size="17" :style="{ color: sentiment.color }" /> {{ sentiment.label }}
          </button>
        </details>
      </div>
      <button v-if="hasFilters" class="jr-chip" style="margin-top:12px" @click="search({ tags: undefined, activity: undefined, sentiment: undefined, favourite: undefined })">清除筛选</button>
      <h1 style="font-size:19px;margin:22px 0 10px">搜索结果</h1>
      <div v-if="!results.length" class="jr-empty">
        <div class="big"><JrIcon :path="q ? mdiImageOutline : mdiBookOutline" :size="46" /></div>
        暂无日记。
      </div>
      <div v-for="e in results" :key="e.id" class="jr-entry" :class="{ selected: selected?.id === e.id }" @click="open(e)">
        <div class="date">{{ rowDate(e) }}</div>
        <div class="preview">{{ e.previewText }}</div>
      </div>

      <template v-if="fileResults.length">
        <div class="jr-set-label" style="margin-top:20px">附件结果</div>
        <div v-for="m in fileResults" :key="'f' + m.id" class="jr-entry" @click="selected = entries.find(e => e.id === m.jId) ?? null">
          <div class="date">{{ m.fileName }}</div>
          <div class="preview">媒体附件 · 所属日记 {{ m.jId }}</div>
        </div>
      </template>
    </div>
    <div class="jr-detail-col" style="position:relative;display:flex;flex-direction:column">
      <div v-if="selected" class="jr-detail-body">
        <div class="jr-detail-head">
          <div class="day">{{ new Intl.DateTimeFormat('zh-CN', { day: '2-digit' }).format(selected.dateOfJournal) }}</div>
          <div class="when">
            <div class="d1">{{ new Intl.DateTimeFormat('zh-CN', { month: 'long', day: 'numeric', year: 'numeric' }).format(selected.dateOfJournal) }}</div>
            <div class="d2">{{ new Intl.DateTimeFormat('zh-CN', { weekday: 'long', hour: 'numeric', minute: '2-digit' }).format(selected.dateOfJournal) }}</div>
          </div>
        </div>
        <JournalBody :entry="selected" />
        <div class="jr-pop-row" style="justify-content:center">
          <button class="jr-btn jr-btn-primary" @click="editSelected(selected)">编辑</button>
          <NuxtLink class="jr-btn" :to="{ path: '/', query: { entry: selected.id } }">在时间线中打开</NuxtLink>
        </div>
      </div>
      <div v-else class="jr-empty" style="margin:auto">
        <div class="big"><JrIcon :path="mdiBookOutline" :size="46" /></div>
        请选择一篇日记。
      </div>
    </div>
    <EntryEditor v-if="editorOpen" :entry-id="editingId" @done="editorOpen = false; selected = null" />
  </div>
</template>

<style scoped>
.jr-search-filters { margin-top: 12px; padding: 4px 8px; border: 1px solid var(--jr-outline-variant); border-radius: 10px; }
.jr-search-filters summary { cursor: pointer; padding: 10px 12px; font-size: 14px; }
.jr-search-filters details .jr-pop-item, .jr-search-filters details p { padding-inline-start: 24px; }

/* ---- 移动搜索（证据 §9：标签/已加星标/活动/情绪行式 + 结果分组） ---- */
.msearch { padding: 8px 16px 0; }
.mbar { display: flex; align-items: center; gap: 6px; border-bottom: 1px solid var(--jr-outline-variant); padding: 6px 0 12px; }
.mbar input { flex: 1; border: 0; outline: 0; background: transparent; font-size: 17px; color: var(--jr-on-bg); font-family: inherit; }
.mbar .ico { display: flex; align-items: center; justify-content: center; width: 44px; height: 44px; border-radius: 50%; background: transparent; border: 0; color: var(--jr-on-bg); }
.fsec { font-size: 13px; color: var(--jr-on-surface-variant); margin: 16px 0 6px; }
.frow {
  display: flex; align-items: center; gap: 14px; width: 100%;
  background: transparent; border: 0; border-bottom: 1px solid var(--jr-outline-variant);
  padding: 16px 4px; font-size: 15.5px; font-weight: 600; font-family: inherit; color: var(--jr-on-bg);
  text-align: left;
}
.frow.on { color: var(--jr-primary); }
.frow .ft { flex: 1; }
.frow .fc { color: var(--jr-outline); font-weight: 400; }
.fchev { color: var(--jr-outline); transition: transform .2s ease; }
.fchev.open { transform: rotate(180deg); }
.fdrop { display: flex; flex-wrap: wrap; gap: 8px; padding: 12px 4px; border-bottom: 1px solid var(--jr-outline-variant); }
.fopt { background: var(--jr-surface-variant); border: 0; border-radius: 999px; padding: 7px 14px; font-size: 13px; color: var(--jr-on-surface-variant); font-family: inherit; }
.fopt.on { background: var(--jr-primary-container); color: var(--jr-on-primary-container); font-weight: 700; }
.fclear { margin: 14px 0 0; background: var(--jr-surface-variant); border: 0; border-radius: 999px; padding: 8px 16px; font-size: 13px; color: var(--jr-on-surface-variant); font-family: inherit; }
.sec { font-size: 13.5px; font-weight: 600; margin: 22px 0 8px; }
.ghead { text-align: center; font-size: 14px; font-weight: 700; margin: 16px 0 8px; }
.mrow {
  display: flex; flex-direction: column; align-items: flex-start; gap: 4px;
  width: 100%; border: 0; border-radius: 16px; padding: 14px 16px; margin-bottom: 10px;
  background: #e6f0f3; text-align: left; font-family: inherit; color: var(--jr-on-bg);
}
.mrow .time { font-weight: 800; font-size: 15px; }
.mrow .prev { font-size: 13.5px; color: var(--jr-on-surface-variant); overflow: hidden; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; }
.mrow .up { color: #e05a4e; }
.mempty2 { text-align: center; padding: 60px 0 30px; color: var(--jr-outline); }
.psec { font-size: 13px; color: var(--jr-on-surface-variant); margin: 26px 0 4px; }
.prow {
  display: flex; align-items: center; gap: 14px; width: 100%;
  background: transparent; border: 0; border-bottom: 1px solid var(--jr-outline-variant);
  padding: 16px 4px; font-size: 15.5px; font-weight: 600; font-family: inherit; color: var(--jr-on-bg);
  text-decoration: none; text-align: left;
}
.prow .ft { flex: 1; }
</style>
