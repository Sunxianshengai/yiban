<script setup lang="ts">
import { mdiImageOutline, mdiClose } from '@mdi/js'
import type { EntryV2 } from '~/utils/db'

const { entries } = useEntries()
type LocatedEntry = EntryV2 & { id: number; lat: number; lng: number }
type AtlasPoint = { entry: LocatedEntry; x: number; y: number }
type AtlasGroup = { entries: LocatedEntry[]; x: number; y: number }

const minZoom = 3
const maxZoom = 16
// MapLibre uses 512px tiles and a default cluster radius of 50px.
const clusterRadius = 25
const compactCount = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 })
const entryDate = new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
const located = computed(() => entries.value.filter((entry): entry is LocatedEntry =>
  entry.id != null && typeof entry.lat === 'number' && Math.abs(entry.lat) <= 90
    && typeof entry.lng === 'number' && Math.abs(entry.lng) <= 180,
))

const mapEl = ref<HTMLElement | null>(null)
const areaEntries = shallowRef<LocatedEntry[]>([])
const selected = shallowRef<LocatedEntry | null>(null)
const tilesMissing = ref(false)
const mapError = ref(false)
let leaflet: typeof import('leaflet') | undefined
let map: any = null
let markerLayer: any = null
let disposed = false
let positioned = false

function longitudeNear(lng: number, center: number) {
  return lng + Math.round((center - lng) / 360) * 360
}

function groupAt(list: LocatedEntry[], zoom: number): AtlasGroup[] {
  const center = map.getCenter().lng
  const points: AtlasPoint[] = list.map(entry => {
    const { x, y } = map.project([entry.lat, longitudeNear(entry.lng, center)], zoom)
    return { entry, x, y }
  })
  const buckets = new Map<string, AtlasPoint[]>()
  for (const point of points) {
    const key = `${Math.floor(point.x / clusterRadius)},${Math.floor(point.y / clusterRadius)}`
    const bucket = buckets.get(key)
    if (bucket) bucket.push(point)
    else buckets.set(key, [point])
  }
  const claimed = new Set<AtlasPoint>()
  const groups: AtlasGroup[] = []
  for (const seed of points) {
    if (claimed.has(seed)) continue
    const col = Math.floor(seed.x / clusterRadius)
    const row = Math.floor(seed.y / clusterRadius)
    const members: LocatedEntry[] = []
    let x = 0
    let y = 0
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        for (const point of buckets.get(`${col + dx},${row + dy}`) || []) {
          if (claimed.has(point) || Math.hypot(point.x - seed.x, point.y - seed.y) > clusterRadius) continue
          claimed.add(point)
          members.push(point.entry)
          x += point.x
          y += point.y
        }
      }
    }
    groups.push({ entries: members, x: x / members.length, y: y / members.length })
  }
  return groups
}

function nextClusterZoom(group: AtlasGroup, zoom: number) {
  for (let next = zoom + 1; next < maxZoom; next++) {
    if (groupAt(group.entries, next).length > 1) return next
  }
  return null
}

function showEntries(group: AtlasGroup) {
  const single = group.entries.length === 1 ? group.entries[0] : undefined
  const inArea = single ? located.value.filter(entry => Math.abs(entry.lat - single.lat) <= 0.01
    && Math.abs(longitudeNear(entry.lng, single.lng) - single.lng) <= 0.01) : group.entries
  areaEntries.value = [...inArea].sort((a, b) => +new Date(b.dateOfJournal) - +new Date(a.dateOfJournal))
  selected.value = areaEntries.value.length === 1 ? areaEntries.value[0]! : null
}

function renderMarkers() {
  if (!map || !markerLayer || !leaflet) return
  markerLayer.clearLayers()
  const zoom = Math.round(map.getZoom())
  const center = map.getCenter().lng
  const bounds = map.getBounds().pad(0.1)
  const visible = located.value.filter(entry => bounds.contains([entry.lat, longitudeNear(entry.lng, center)]))
  for (const group of groupAt(visible, zoom)) {
    const count = group.entries.length
    const size = count >= 750 ? 80 : count >= 100 ? 60 : count > 1 ? 40 : 20
    const destinationZoom = count > 1 ? nextClusterZoom(group, zoom) : null
    const label = destinationZoom != null ? `Zoom in on ${count} entries`
      : count > 1 ? `Show ${count} entries in this area` : 'Show entry in this area'
    const centerPoint = map.unproject([group.x, group.y], zoom)
    const marker = leaflet.marker(centerPoint, {
      title: label,
      icon: leaflet.divIcon({
        className: `jr-atlas-point${count === 1 ? ' jr-atlas-point-single' : ''}`,
        html: compactCount.format(count),
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
      }),
    }).addTo(markerLayer)
    marker.getElement()?.setAttribute('aria-label', label)
    marker.on('click', () => {
      if (destinationZoom == null) showEntries(group)
      else {
        closeArea()
        map.setView(centerPoint, destinationZoom, { animate: !window.matchMedia('(prefers-reduced-motion: reduce)').matches })
      }
    })
  }
}

function closeArea() {
  areaEntries.value = []
  selected.value = null
}

function syncEntries() {
  if (!map) return
  if (!positioned && located.value.length) {
    const first = located.value[0]!
    positioned = true
    map.setView([first.lat, first.lng], minZoom, { animate: false })
  }
  if (areaEntries.value.length) {
    const byId = new Map(located.value.map(entry => [entry.id, entry]))
    areaEntries.value = areaEntries.value.flatMap(entry => byId.get(entry.id) || [])
    if (selected.value) selected.value = byId.get(selected.value.id) || null
  }
  renderMarkers()
}
watch(located, syncEntries)

async function renderMap() {
  try {
    const { default: L } = await import('leaflet')
    await import('leaflet/dist/leaflet.css')
    if (disposed || !mapEl.value) return
    leaflet = L
    map = L.map(mapEl.value, { minZoom, maxZoom, zoomControl: false }).setView([22.5, 114.1], minZoom)
    L.control.zoom({ position: 'bottomright' }).addTo(map)
    const tiles = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap contributors' })
    tiles.on('tileerror', () => { tilesMissing.value = true })
    tiles.on('tileload', () => { tilesMissing.value = false })
    tiles.addTo(map)
    markerLayer = L.layerGroup().addTo(map)
    map.on('moveend', renderMarkers)
    syncEntries()
  } catch {
    if (!disposed) mapError.value = true
  }
}
onMounted(renderMap)
onBeforeUnmount(() => {
  disposed = true
  map?.remove()
  map = null
  markerLayer = null
})
</script>

<template>
  <div class="jr-content" style="position:relative">
    <div ref="mapEl" class="jr-atlas-map" aria-label="Atlas map" />
    <p v-if="tilesMissing && located.length && !areaEntries.length" class="jr-atlas-tile-note" role="status">Map tiles unavailable. Journal locations are still available.</p>
    <section v-if="areaEntries.length" class="jr-atlas-panel" aria-label="Entries in this area">
      <header class="jr-atlas-area-head">
        <h2>{{ areaEntries.length }} {{ areaEntries.length === 1 ? 'entry' : 'entries' }} in this area</h2>
        <button class="jr-icon-btn" type="button" aria-label="Close area entries" @click="closeArea"><JrIcon :path="mdiClose" :size="20" /></button>
      </header>
      <div v-if="areaEntries.length > 1" class="jr-atlas-area-list">
        <button v-for="entry in areaEntries" :key="entry.id" type="button" class="jr-atlas-area-entry"
          :aria-pressed="selected?.id === entry.id" @click="selected = entry">
          <small>{{ entryDate.format(entry.dateOfJournal) }}</small>
          {{ entry.previewText || entry.address || 'Entry' }}
        </button>
      </div>
      <template v-if="selected">
        <div class="jr-detail-head">
          <div class="day">{{ new Intl.DateTimeFormat('en-US', { day: '2-digit' }).format(selected.dateOfJournal) }}</div>
          <div class="when">
            <div class="d1">{{ entryDate.format(selected.dateOfJournal) }}</div>
            <div class="d2">{{ selected.address || `${selected.lat}, ${selected.lng}` }}</div>
          </div>
        </div>
        <JournalBody :entry="selected" />
        <NuxtLink class="jr-btn" :to="{ path: '/', query: { entry: selected.id } }">Open in Timeline</NuxtLink>
      </template>
    </section>
    <div v-if="mapError || !located.length" class="jr-atlas-hint" role="status">
      <div class="big"><JrIcon :path="mdiImageOutline" :size="42" /></div>
      {{ mapError ? 'The map could not be opened.' : 'Only entries with a geo-tag appear here. Add a location in the editor (pin icon).' }}
    </div>
  </div>
</template>

<style scoped>
.jr-atlas-map { background: #e8dcc5; }
:deep(.jr-atlas-point) {
  display: grid;
  place-items: center;
  border-radius: 50%;
  background: var(--jr-primary);
  color: var(--jr-on-primary, white);
  font-size: 12px;
  font-weight: 600;
}
:deep(.jr-atlas-point-single) { font-size: 10px; }
:deep(.jr-atlas-point:focus-visible) { outline: 2px solid var(--jr-on-surface); outline-offset: 3px; }
.jr-atlas-panel { width: min(380px, calc(100% - 48px)); }
.jr-atlas-area-head { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 12px; }
.jr-atlas-area-head h2 { margin: 0; font-size: 15px; }
.jr-atlas-area-list { display: grid; gap: 4px; margin-bottom: 16px; }
.jr-atlas-area-entry { text-align: left; padding: 8px 10px; color: var(--jr-on-surface); background: transparent; border: 1px solid var(--jr-outline-variant); border-radius: 8px; }
.jr-atlas-area-entry small { display: block; color: var(--jr-on-surface-variant); }
.jr-atlas-area-entry[aria-pressed='true'] { background: var(--jr-secondary-container); color: var(--jr-on-secondary-container); }
.jr-atlas-tile-note { position: absolute; z-index: 2; top: 12px; left: 12px; margin: 0; padding: 6px 10px; background: var(--jr-surface); color: var(--jr-on-surface); border-radius: 8px; font-size: 12px; }
</style>
