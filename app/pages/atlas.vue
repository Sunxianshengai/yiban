<script setup lang="ts">
import { mdiImageOutline } from '@mdi/js'
import type { EntryV2 } from '~/utils/db'

const { entries } = useEntries()
const located = computed(() => entries.value.filter((e) => e.lat != null && e.lng != null))

const mapEl = ref<HTMLElement | null>(null)
let map: any = null
const markers: any[] = []
const selected = ref<EntryV2 | null>(null)

async function renderMap() {
  if (!mapEl.value || map) return
  const L = (await import('leaflet')).default
  await import('leaflet/dist/leaflet.css')
  map = L.map(mapEl.value).setView([22.5, 114.1], 3)
  // OpenStreetMap tiles (free, no key); original map provider unknown from static evidence
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap contributors' }).addTo(map)
  for (const e of located.value) {
    const m = L.marker([e.lat!, e.lng!]).addTo(map)
    m.on('click', async () => {
      const clone = { ...e }
      const { hydrateMediaHtml } = useEntries()
      clone.text = await hydrateMediaHtml(clone.text)
      selected.value = clone
    })
    markers.push(m)
  }
  if (!located.value.length) map.setView([22.5, 114.1], 2)
}
onMounted(async () => {
  await nextTick()
  setTimeout(renderMap, 50)
})
</script>

<template>
  <div class="jr-content" style="position:relative">
    <div ref="mapEl" class="jr-atlas-map" />
    <div v-if="selected" class="jr-atlas-panel">
      <div class="jr-detail-head">
        <div class="day">{{ new Intl.DateTimeFormat('en-US', { day: '2-digit' }).format(selected.dateOfJournal) }}</div>
        <div class="when">
          <div class="d1">{{ new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric' }).format(selected.dateOfJournal) }}</div>
          <div class="d2">{{ selected.address || `${selected.lat}, ${selected.lng}` }}</div>
        </div>
      </div>
      <div class="jr-detail-content" v-html="selected.text" />
      <button class="jr-btn" style="margin-top:10px" @click="selected = null">Close</button>
    </div>
    <div v-if="!located.length" class="jr-atlas-hint">
      <div class="big"><JrIcon :path="mdiImageOutline" :size="42" /></div>
      Only entries with a geo-tag appear here. Add a location in the editor (pin icon).
    </div>
  </div>
</template>
