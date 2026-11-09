<script setup lang="ts">
import { mdiFilterVariant, mdiImageOutline, mdiBookOutline, mdiStarOutline, mdiTagOutline } from '@mdi/js'
import type { EntryV2, TagWordV2 } from '~/utils/db'
import { htmlToPreview } from '~/utils/db'
import { activities, journalActivity, journalSentiment, sentiments } from '~/utils/journalOptions'

definePageMeta({ alias: ['/search/results'], key: 'journal-search' })

const route = useRoute()
const router = useRouter()
const routeText = computed(() => String(route.query.query ?? route.query.q ?? ''))
const q = ref(routeText.value)
watch(routeText, value => { q.value = value })

const { entries, listTags, allMedia } = useEntries()
const tags = ref<TagWordV2[]>([])
const filtersOpen = ref(false)
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

const selected = ref<EntryV2 | null>(null)
function open(e: EntryV2) {
  selected.value = e
}
function rowDate(e: EntryV2) {
  const d = new Date(e.dateOfJournal)
  const main = new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }).format(d)
  return `${main} · ${new Intl.DateTimeFormat('en-US', { weekday: 'short' }).format(d)}`
}
</script>

<template>
  <div class="jr-content">
    <div class="jr-list-col">
      <div style="display:flex;align-items:center;gap:10px;margin:22px 0 0">
        <button class="jr-search" style="margin:0;padding:7px 12px;font-size:12px;font-weight:700;letter-spacing:.4px" :aria-expanded="filtersOpen" aria-controls="jr-search-filters" @click="filtersOpen = !filtersOpen">
          <JrIcon :path="mdiFilterVariant" :size="15" /> FILTERS
        </button>
        <form class="jr-search" style="margin:0" @submit.prevent="search()"><input v-model="q" type="text" placeholder="Search" aria-label="Search entries" /></form>
      </div>
      <div v-show="filtersOpen" id="jr-search-filters" class="jr-search-filters">
        <details>
          <summary>Tag</summary>
          <p v-if="!tags.length" class="jr-muted">No tags</p>
          <button v-for="tag in tags" :key="tag.id" type="button" class="jr-pop-item" :class="{ 'jr-on': activeTags.includes(tag.id!) }" :aria-pressed="activeTags.includes(tag.id!)" @click="toggleFilter('tags', tag.id!)">
            <JrIcon :path="mdiTagOutline" :size="17" /> {{ tag.title }}
          </button>
        </details>
        <button type="button" class="jr-pop-item" :class="{ 'jr-on': starredOnly }" :aria-pressed="starredOnly" @click="search({ favourite: starredOnly ? undefined : 'true' })">
          <JrIcon :path="mdiStarOutline" :size="17" /> Starred
        </button>
        <details>
          <summary>Activity</summary>
          <button v-for="activity in activities" :key="activity.code" type="button" class="jr-pop-item" :class="{ 'jr-on': activeActivities.includes(activity.code) }" :aria-pressed="activeActivities.includes(activity.code)" @click="toggleFilter('activity', activity.code)">
            <JrIcon :path="activity.icon" :size="17" /> {{ activity.label }}
          </button>
        </details>
        <details>
          <summary>Sentiment</summary>
          <button v-for="sentiment in sentiments" :key="sentiment.code" type="button" class="jr-pop-item" :class="{ 'jr-on': activeSentiments.includes(sentiment.code) }" :aria-pressed="activeSentiments.includes(sentiment.code)" @click="toggleFilter('sentiment', sentiment.code)">
            <JrIcon :path="sentiment.icon" :size="17" :style="{ color: sentiment.color }" /> {{ sentiment.label }}
          </button>
        </details>
      </div>
      <button v-if="hasFilters" class="jr-chip" style="margin-top:12px" @click="search({ tags: undefined, activity: undefined, sentiment: undefined, favourite: undefined })">Clear filters</button>
      <h1 style="font-size:19px;margin:22px 0 10px">Search Results</h1>
      <div v-if="!results.length" class="jr-empty">
        <div class="big"><JrIcon :path="q ? mdiImageOutline : mdiBookOutline" :size="46" /></div>
        No entries to display.
      </div>
      <div v-for="e in results" :key="e.id" class="jr-entry" :class="{ selected: selected?.id === e.id }" @click="open(e)">
        <div class="date">{{ rowDate(e) }}</div>
        <div class="preview">{{ e.previewText }}</div>
      </div>

      <template v-if="fileResults.length">
        <div class="jr-set-label" style="margin-top:20px">File Results</div>
        <div v-for="m in fileResults" :key="'f' + m.id" class="jr-entry" @click="selected = entries.find(e => e.id === m.jId) ?? null">
          <div class="date">{{ m.fileName }}</div>
          <div class="preview">media · attached to entry {{ m.jId }}</div>
        </div>
      </template>
    </div>
    <div class="jr-detail-col" style="position:relative;display:flex;flex-direction:column">
      <div v-if="selected" class="jr-detail-body">
        <div class="jr-detail-head">
          <div class="day">{{ new Intl.DateTimeFormat('en-US', { day: '2-digit' }).format(selected.dateOfJournal) }}</div>
          <div class="when">
            <div class="d1">{{ new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric' }).format(selected.dateOfJournal) }}</div>
            <div class="d2">{{ new Intl.DateTimeFormat('en-US', { weekday: 'long', hour: 'numeric', minute: '2-digit' }).format(selected.dateOfJournal) }}</div>
          </div>
        </div>
        <JournalBody :entry="selected" />
        <NuxtLink class="jr-btn" :to="{ path: '/', query: { entry: selected.id } }">Open in Timeline</NuxtLink>
      </div>
      <div v-else class="jr-empty" style="margin:auto">
        <div class="big"><JrIcon :path="mdiBookOutline" :size="46" /></div>
        No entries selected.
      </div>
    </div>
  </div>
</template>

<style scoped>
.jr-search-filters { margin-top: 12px; padding: 4px 8px; border: 1px solid var(--jr-outline-variant); border-radius: 10px; }
.jr-search-filters summary { cursor: pointer; padding: 10px 12px; font-size: 14px; }
.jr-search-filters details .jr-pop-item, .jr-search-filters details p { padding-inline-start: 24px; }
</style>
