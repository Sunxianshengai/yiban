<script setup lang="ts">
import { mdiImageOutline, mdiClose } from '@mdi/js'
import type { EntryV2 } from '~/utils/db'

const { entries, refresh } = useEntries()
type LocatedEntry = EntryV2 & { id: number; lat: number; lng: number }
type AtlasPoint = { entry: LocatedEntry; x: number; y: number }
type AtlasGroup = { entries: LocatedEntry[]; x: number; y: number }

/**
 * Atlas — 原版实测（evidence/rea/atlas-v1.json + bundle 提取，2026-11-10）：
 * 引擎 MapLibre GL（.output/public/styles/maplibre-gl.css 在册）；
 * 底图为两个自定义 MapTiler 样式（明 02e457dd-…/暗 a94ac775-…，api.maptiler.com/maps/<id>/style.json?key=）；
 * 密钥走 secretKeys.mapTiler（IPC renderer->main:retrieve 取用户配置）——复刻版存 localStorage，不伪造密钥；
 * 无密钥时内联极简底图（零网络依赖），诚实提示。
 * 标记/聚类用 DOM Marker + 网格聚类（r=25px，512px 瓦片坐标系）：不依赖 WebGL/worker，
 * 无底图/受限网络下标记依然可交互（对齐原版"无密钥时仅见日记标记"的行为）。
 */
const STYLE_LIGHT_ID = '02e457dd-6f30-4d58-9156-f924def7b2d0'
const STYLE_DARK_ID = 'a94ac775-f3be-4aea-aa5a-028754a7aeb5'
const minZoom = 3
const maxZoom = 16
// MapLibre uses 512px tiles and a default cluster radius of 50px.
const clusterRadius = 25
const compactCount = new Intl.NumberFormat('zh-CN', { notation: 'compact', maximumFractionDigits: 1 })
const entryDate = new Intl.DateTimeFormat('zh-CN', { month: 'long', day: 'numeric', year: 'numeric' })
const located = computed(() => entries.value.filter((entry): entry is LocatedEntry =>
  entry.id != null && typeof entry.lat === 'number' && Math.abs(entry.lat) <= 90
    && typeof entry.lng === 'number' && Math.abs(entry.lng) <= 180,
))

const mapEl = ref<HTMLElement | null>(null)
const areaEntries = shallowRef<LocatedEntry[]>([])
const selected = shallowRef<LocatedEntry | null>(null)
const mapError = ref(false)
const styleFallback = ref(false)
let map: any = null
let maplib: any = null
let markers: any[] = []
let disposed = false
let positioned = false

function mapTilerKey() { return localStorage.getItem('jr.mapTilerKey') || '' }
// 无密钥时的内联极简样式：零网络依赖
const INLINE_STYLE = {
  version: 8 as const,
  sources: {},
  layers: [{ id: 'bg', type: 'background' as const, paint: { 'background-color': '#e8dcc5' } }],
}
function styleUrl() {
  const key = mapTilerKey()
  if (!key) { styleFallback.value = true; return INLINE_STYLE }
  styleFallback.value = false
  const dark = document.documentElement.dataset.theme === 'dark'
  const id = dark ? STYLE_DARK_ID : STYLE_LIGHT_ID
  return `https://api.maptiler.com/maps/${id}/style.json?key=${encodeURIComponent(key)}`
}

function longitudeNear(lng: number, center: number) {
  return lng + Math.round((center - lng) / 360) * 360
}

function groupAt(list: LocatedEntry[], zoom: number): AtlasGroup[] {
  const center = map.getCenter().lng
  const points: AtlasPoint[] = list.map(entry => {
    // MapLibre project 接受 [lng, lat]（Leaflet 是 [lat, lng]，迁移时注意顺序）
    const { x, y } = map.project([longitudeNear(entry.lng, center), entry.lat], zoom)
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
  // 包围盒法：成员经纬度跨度需要的最低缩放（不依赖 project 的可选 zoom 参数，纯数学）
  const lats = group.entries.map((e) => e.lat)
  const lngs = group.entries.map((e) => e.lng)
  const span = Math.max(
    (Math.max(...lngs) - Math.min(...lngs)) / 360,
    (Math.max(...lats) - Math.min(...lats)) / 180,
    1e-9,
  )
  // 像素跨距 = 512·2^z·span ≥ clusterRadius ⇒ z = log2(clusterRadius/(512·span))；+1 档安全余量
  const need = Math.ceil(Math.log2(clusterRadius / (512 * span))) + 1
  return Math.min(maxZoom - 1, Math.max(zoom + 1, need))
}

function showEntries(group: AtlasGroup) {
  const single = group.entries.length === 1 ? group.entries[0] : undefined
  const inArea = single ? located.value.filter(entry => Math.abs(entry.lat - single.lat) <= 0.01
    && Math.abs(longitudeNear(entry.lng, single.lng) - single.lng) <= 0.01) : group.entries
  areaEntries.value = [...inArea].sort((a, b) => +new Date(b.dateOfJournal) - +new Date(a.dateOfJournal))
  selected.value = areaEntries.value.length === 1 ? areaEntries.value[0]! : null
}

function closeArea() {
  areaEntries.value = []
  selected.value = null
}

function clearMarkers() {
  for (const m of markers) m.remove()
  markers = []
}

function renderMarkers() {
  if (!map || !maplib || disposed) return
  clearMarkers()
  const zoom = Math.round(map.getZoom())
  const center = map.getCenter().lng
  const b = map.getBounds()
  const latPad = (b.getNorth() - b.getSouth()) * 0.1
  const lngPad = (b.getEast() - b.getWest()) * 0.1
  const south = b.getSouth() - latPad
  const north = b.getNorth() + latPad
  const visible = located.value.filter((entry) => {
    const lng = longitudeNear(entry.lng, center)
    return entry.lat >= south && entry.lat <= north && lng >= b.getWest() - lngPad && lng <= b.getEast() + lngPad
  })
  for (const group of groupAt(visible, zoom)) {
    const count = group.entries.length
    const size = count >= 750 ? 80 : count >= 100 ? 60 : count > 1 ? 40 : 20
    const destinationZoom = count > 1 ? nextClusterZoom(group, zoom) : null
    const label = destinationZoom != null ? `放大查看 ${count} 篇日记`
      : count > 1 ? `查看此区域的 ${count} 篇日记` : '查看此区域的日记'
    const centerPoint = map.unproject([group.x, group.y], zoom)
    const el = document.createElement('div')
    el.className = `jr-atlas-point${count === 1 ? ' jr-atlas-point-single' : ''}`
    el.style.width = el.style.height = `${size}px`
    el.textContent = compactCount.format(count)
    el.setAttribute('aria-label', label)
    el.title = label
    const marker = new maplib.Marker({ element: el })
      .setLngLat([centerPoint.lng, centerPoint.lat])
      .addTo(map)
    markers.push(marker)
    el.addEventListener('click', (ev) => {
      ev.stopPropagation()
      if (destinationZoom == null) showEntries(group)
      else {
        closeArea()
        map.easeTo({ center: [centerPoint.lng, centerPoint.lat], zoom: destinationZoom, duration: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 300 })
      }
    })
  }
}

function syncEntries() {
  if (!map || !maplib || disposed) return
  if (!positioned && located.value.length) {
    const first = located.value[0]!
    positioned = true
    map.jumpTo({ center: [first.lng, first.lat], zoom: minZoom })
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
    const mod = await import('maplibre-gl')
    await import('maplibre-gl/dist/maplibre-gl.css')
    if (disposed || !mapEl.value) return
    // 注意：赋给组件级 maplib（组件内其他函数依赖它），不要在 renderMap 里用 const 遮蔽
    maplib = (mod as any).default ?? mod
    // 受管环境下内嵌 blob worker 会失效：显式指到 CSP worker 文件（在解析后的库对象上调用；
    // 失败只影响 canvas 瓦片管线——DOM 标记方案不依赖它）
    try {
      const workerUrl = (await import('maplibre-gl/dist/maplibre-gl-csp-worker.js?url')).default
      maplib.setWorkerUrl?.(workerUrl)
    } catch { /* ignore */ }
    map = new maplib.Map({
      container: mapEl.value,
      style: styleUrl(),
      minZoom,
      maxZoom,
      attributionControl: { compact: true },
    })
    ;(window as any).__atlasMap = map
    map.addControl(new maplib.NavigationControl({ showZoom: true, showCompass: false }), 'bottom-right')
    // 底图就绪与否都挂标记：样式 JSON 就绪即挂（幂等），受限网络下不等瓦片
    const start = () => {
      if (disposed || !map) return
      map.on('moveend', renderMarkers)
      syncEntries()
    }
    if (map.isStyleLoaded()) start()
    else {
      map.once('load', start)
      const poll = setInterval(() => {
        if (disposed || !map) { clearInterval(poll); return }
        if (map.getStyle()?.layers?.length) { clearInterval(poll); start(); return }
      }, 400)
    }
  } catch (error) {
    console.error('[atlas] map init failed', error)
    if (!disposed) mapError.value = true
  }
}
onMounted(async () => {
  await refresh()
  renderMap()
})
onBeforeUnmount(() => {
  disposed = true
  clearMarkers()
  map?.remove()
  map = null
  ;(window as any).__atlasMap = null
})
</script>

<template>
  <div class="jr-content" style="position:relative">
    <div ref="mapEl" class="jr-atlas-map" aria-label="日记地图" />
    <p v-if="styleFallback && located.length && !areaEntries.length" class="jr-atlas-tile-note" role="status">
      原版底图为 MapTiler 自定义样式，需在设置中填入你自己的 MapTiler 密钥；当前使用无密钥回退底图。
    </p>
    <section v-if="areaEntries.length" class="jr-atlas-panel" aria-label="此区域内的日记">
      <header class="jr-atlas-area-head">
        <h2>此区域内有 {{ areaEntries.length }} 篇日记</h2>
        <button class="jr-icon-btn" type="button" aria-label="关闭区域日记列表" @click="closeArea"><JrIcon :path="mdiClose" :size="20" /></button>
      </header>
      <div v-if="areaEntries.length > 1" class="jr-atlas-area-list">
        <button v-for="entry in areaEntries" :key="entry.id" type="button" class="jr-atlas-area-entry"
          :aria-pressed="selected?.id === entry.id" @click="selected = entry">
          <small>{{ entryDate.format(entry.dateOfJournal) }}</small>
          {{ entry.previewText || entry.address || '日记' }}
        </button>
      </div>
      <template v-if="selected">
        <div class="jr-detail-head">
          <div class="day">{{ new Intl.DateTimeFormat('zh-CN', { day: '2-digit' }).format(selected.dateOfJournal) }}</div>
          <div class="when">
            <div class="d1">{{ entryDate.format(selected.dateOfJournal) }}</div>
            <div class="d2">{{ selected.address || `${selected.lat}, ${selected.lng}` }}</div>
          </div>
        </div>
        <JournalBody :entry="selected" />
        <NuxtLink class="jr-btn" :to="{ path: '/', query: { entry: selected.id } }">在时间线中打开</NuxtLink>
      </template>
    </section>
    <div v-if="mapError || !located.length" class="jr-atlas-hint" role="status">
      <div class="big"><JrIcon :path="mdiImageOutline" :size="42" /></div>
      {{ mapError ? '无法打开地图。' : '地图仅显示带地点的日记。可在编辑器中添加地点。' }}
    </div>
  </div>
</template>

<style scoped>
.jr-atlas-map { background: #e8dcc5; }
:deep(.maplibregl-canvas) { outline: none; }
:deep(.jr-atlas-point) {
  display: grid;
  place-items: center;
  border-radius: 50%;
  background: var(--jr-primary);
  color: var(--jr-on-primary, white);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
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
