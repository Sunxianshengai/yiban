<script setup lang="ts">
import { mdiBookmark, mdiHistory, mdiSortVariant, mdiCloudUploadOutline, mdiImageOutline, mdiCheck, mdiArrowDown, mdiArrowUp } from '@mdi/js'
import type { EntryV2 } from '~/utils/db'

const { entries, refresh, toggleFavourite, duplicateEntry, saveAsTemplate, moveToTrash, throwbacks, hydrateMediaHtml } = useEntries()

const editorOpen = ref(false)
const editing = ref<EntryV2 | null>(null)
const selected = ref<EntryV2 | null>(null)
const throwbackList = ref<EntryV2[]>([])
const throwbackLabel = ref('No throwback today')

onMounted(async () => {
  const tb = await throwbacks()
  throwbackList.value = tb
  if (tb.length) {
    const d = new Date(tb[0].dateOfJournal)
    throwbackLabel.value = `${d.getFullYear()} · ${new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric' }).format(d)}`
  }
})

// sort menu — faithful to menu-sort.png: "Entry Date" (with direction arrow) / "Last Modified"
const sortMenuOpen = ref(false)
const sortKey = ref<'entryDate' | 'lastModified'>('entryDate')
const sortDir = ref<'desc' | 'asc'>('desc')
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
const todayLabel = new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric' }).format(today)

async function selectEntry(e: EntryV2) {
  const clone = { ...e }
  clone.text = await hydrateMediaHtml(clone.text)
  selected.value = clone
}

function rowDate(e: EntryV2) {
  const d = new Date(e.dateOfJournal)
  const main = new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }).format(d)
  const wd = new Intl.DateTimeFormat('en-US', { weekday: 'short' }).format(d)
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
  if (selected.value) {
    const fresh = entries.value.find((x) => x.id === selected.value!.id)
    if (fresh) await selectEntry(fresh)
  }
}
function onDuplicate() {
  if (selected.value) {
    duplicateEntry(selected.value.id!)
    selected.value = null
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
</script>

<template>
  <button class="jr-fab" title="New entry" @click="openNew">
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6z" /></svg>
  </button>

  <div class="jr-content">
    <div class="jr-list-col">
      <template v-if="entries.length">
        <div class="jr-banner cloud">
          <JrIcon :path="mdiCloudUploadOutline" :size="26" style="color:#c96b60" />
          <div class="txt">
            <div class="t">Move to Cloud</div>
            <div class="d">It's free to sync your memories &amp; see them on any of the devices.</div>
          </div>
          <button class="act">CONTINUE</button>
        </div>
        <div class="jr-banner member">
          <div class="txt">
            <div class="t">Membership</div>
            <div class="d">You are using the free version of Journey. Upgrade to unlock now.</div>
          </div>
          <button class="act">UPGRADE</button>
        </div>
      </template>

      <div class="jr-stories-title">Stories</div>
      <div class="jr-stories">
        <button class="jr-story-card today">
          <span class="icon"><JrIcon :path="mdiBookmark" :size="22" /></span>
          <span class="t">Today</span>
          <span class="s">{{ todayLabel }}</span>
        </button>
        <button class="jr-story-card throwback">
          <span class="icon"><JrIcon :path="mdiHistory" :size="22" /></span>
          <span class="t">Throwback</span>
          <span class="s">{{ throwbackLabel }}</span>
        </button>
      </div>

      <div class="jr-entries-head">
        <span class="label">Entries</span>
        <button class="sort" title="Sort" @click="sortMenuOpen = !sortMenuOpen"><JrIcon :path="mdiSortVariant" :size="20" /></button>
        <div v-if="sortMenuOpen" class="jr-sort-menu">
          <button @click="pickSort('entryDate')">
            <JrIcon v-if="sortKey === 'entryDate'" :path="mdiCheck" :size="16" />
            <span style="width:16px" v-else />
            <span>Entry Date</span>
            <JrIcon v-if="sortKey === 'entryDate'" :path="sortDir === 'desc' ? mdiArrowDown : mdiArrowUp" :size="15" />
          </button>
          <button @click="pickSort('lastModified')">
            <JrIcon v-if="sortKey === 'lastModified'" :path="mdiCheck" :size="16" />
            <span style="width:16px" v-else />
            <span>Last Modified</span>
          </button>
        </div>
      </div>

      <div v-if="!sortedEntries.length" class="jr-empty">
        <div class="big"><JrIcon :path="mdiImageOutline" :size="46" /></div>
        No entries to display.
      </div>

      <div
        v-for="e in sortedEntries"
        :key="e.id"
        class="jr-entry"
        :class="{ selected: selected?.id === e.id }"
        @click="selectEntry(e)"
      >
        <div class="date">{{ rowDate(e) }}</div>
        <div class="preview">{{ e.previewText || 'No additional text' }}</div>
        <div class="meta">
          <span v-if="!e.synced" class="jr-status-icon" title="Pending upload">
            <JrIcon :path="mdiCloudUploadOutline" :size="17" />
          </span>
        </div>
      </div>
    </div>

    <div class="jr-detail-col" style="position:relative">
      <EntryDetail
        :entry="selected"
        @edit="openEdit"
        @toggle-favourite="selected && toggleFavourite(selected.id!)"
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
  </div>
</template>
