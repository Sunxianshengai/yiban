<script setup lang="ts">
import { mdiFilterVariant, mdiImageOutline, mdiBookOutline } from '@mdi/js'
import type { EntryV2, TagWordV2 } from '~/utils/db'

const route = useRoute()
const q = ref(String(route.query.q || ''))
const { entries } = useEntries()
const tags = ref<TagWordV2[]>([])
const activeTags = ref<number[]>([])
const starredOnly = ref(false)

onMounted(async () => {
  tags.value = await useEntries().listTags()
})

const results = computed(() => {
  const needle = q.value.trim().toLowerCase()
  return entries.value.filter((e) => {
    if (starredOnly.value && !e.favourite) return false
    if (activeTags.value.length && !(e.tagWordIds || []).some((t) => activeTags.value.includes(t))) return false
    if (!needle) return false
    return (e.previewText || '').toLowerCase().includes(needle) || (e.text || '').toLowerCase().includes(needle)
  })
})

// fileResults: media file-name search (original has /search/fileResults route)
const fileResults = computed(() =>
  needle.value ? mediaItems.value.filter((m) => m.fileName.toLowerCase().includes(needle.value)) : [],
)
const mediaItems = ref<{ id?: number; fileName: string; mimeType: string; url?: string; jId?: number }[]>([])
onMounted(async () => {
  const rows = await useEntries().allMedia()
  mediaItems.value = rows.map((r) => ({ id: r.id, fileName: r.fileName, mimeType: r.mimeType, jId: r.jId, url: r.blob ? URL.createObjectURL(r.blob) : undefined }))
})

const selected = ref<EntryV2 | null>(null)
async function open(e: EntryV2) {
  const clone = { ...e }
  const { hydrateMediaHtml } = useEntries()
  clone.text = await hydrateMediaHtml(clone.text)
  selected.value = clone
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
        <button class="jr-search" style="margin:0;padding:7px 12px;font-size:12px;font-weight:700;letter-spacing:.4px">
          <JrIcon :path="mdiFilterVariant" :size="15" /> FILTERS
        </button>
        <div class="jr-search" style="margin:0"><input v-model="q" type="text" placeholder="Search" /></div>
      </div>
      <div class="jr-chips" style="margin:12px 0 0">
        <button class="jr-chip" :class="{ on: starredOnly }" @click="starredOnly = !starredOnly">★ starred</button>
        <button v-for="t in tags" :key="t.id" class="jr-chip" :class="{ on: activeTags.includes(t.id!) }" @click="activeTags.includes(t.id!) ? activeTags = activeTags.filter(x => x !== t.id) : activeTags.push(t.id!)">{{ t.title }}</button>
      </div>
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
        <div v-for="m in fileResults" :key="'f' + m.id" class="jr-entry">
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
        <div class="jr-detail-content" v-html="selected.text" />
      </div>
      <div v-else class="jr-empty" style="margin:auto">
        <div class="big"><JrIcon :path="mdiBookOutline" :size="46" /></div>
        No entries selected.
      </div>
    </div>
  </div>
</template>
