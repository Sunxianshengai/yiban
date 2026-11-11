<script setup lang="ts">
import { mdiClose, mdiMapMarkerOutline } from '@mdi/js'
import type { EntryV2 } from '~/utils/db'
import { getAmapJsKey, loadAmap, toAmapLngLat } from '~/utils/amap'

const { entries, refresh } = useEntries()
const isMobile = useIsMobile()

type LocatedEntry = EntryV2 & { id: number; lat: number; lng: number }
type AtlasPoint = { entry: LocatedEntry; lng: number; lat: number }

/**
 * 地图册 — 高德 JS API 2.0。
 *
 * 契约（用户 2026-11-11 决策）：
 * - 手机端全屏地图，点聚合点放大，点单个地点从底部弹出日记列表；一个地点多篇日记可逐篇打开。
 * - 桌面/Windows 地图 + 右侧详情面板，点标记直接预览日记，再进完整详情。
 * - 聚合用 AMap.MarkerCluster（官方点聚合插件）。
 * - 断网或地图加载失败 → 显示已保存的地点列表，仍可打开日记。
 * - 未记录地点的日记不出现在地图上。
 * - 坐标：GPS(WGS-84) 记录显示前转 GCJ-02；高德搜索返回的坐标直接用；来源不明的旧记录按原值显示并提示可重选。
 * - 首版以中国大陆为主；海外旧记录只在列表里打开（世界地图需单独申请权限）。
 */

// 中国大陆大致范围：超出范围的记录不上图，避免在世界地图未开通时把点标到空白处
const CHINA = { minLng: 72, maxLng: 138, minLat: 0.8, maxLat: 56 }

const located = computed(() => entries.value.filter((entry): entry is LocatedEntry =>
  entry.id != null && typeof entry.lat === 'number' && Math.abs(entry.lat) <= 90
    && typeof entry.lng === 'number' && Math.abs(entry.lng) <= 180,
))

function inChinaLatLng(lat: number, lng: number) {
  return lng >= CHINA.minLng && lng <= CHINA.maxLng && lat >= CHINA.minLat && lat <= CHINA.maxLat
}

/** 上图的点：坐标已转成高德坐标系（GCJ-02），并限制在中国大陆范围内 */
const points = computed<AtlasPoint[]>(() => {
  const out: AtlasPoint[] = []
  for (const entry of located.value) {
    const [lng, lat] = toAmapLngLat(entry.lat, entry.lng, entry.locationSource)
    if (!inChinaLatLng(lat, lng)) continue
    out.push({ entry, lng, lat })
  }
  return out
})

/** 列表可打开的全部地点（含海外）：地图不可用时用它兜底 */
const overseasCount = computed(() => located.value.length - points.value.length)

const mapEl = ref<HTMLElement | null>(null)
const areaEntries = shallowRef<LocatedEntry[]>([])
const selected = shallowRef<LocatedEntry | null>(null)
const sheetOpen = ref(false)
/** 地图不可用（无密钥/加载失败/断网）→ 退回地点列表 */
const mapUnavailable = ref(false)
const mapNote = ref('')
const loading = ref(true)
let map: any = null
let cluster: any = null
let disposed = false
let AMapNS: any = null

const dayFmt = new Intl.DateTimeFormat('zh-CN', { month: 'long', day: 'numeric', year: 'numeric' })

function isDark() {
  return document.documentElement.dataset.theme === 'dark'
}

function pointDom(count: number | null, active = false) {
  const div = document.createElement('div')
  div.className = 'jr-atlas-point' + (count == null ? ' jr-atlas-point-single' : '')
  if (active) div.classList.add('jr-atlas-point-active')
  if (count != null) {
    div.textContent = String(count)
    const size = count < 10 ? 30 : count < 100 ? 38 : count < 1000 ? 46 : 54
    div.style.width = `${size}px`
    div.style.height = `${size}px`
    div.style.fontSize = `${count < 100 ? 13 : 12}px`
  }
  return div
}

function openPlace(list: LocatedEntry[]) {
  if (!list.length) return
  areaEntries.value = [...list].sort((a, b) => +new Date(b.dateOfJournal) - +new Date(a.dateOfJournal))
  selected.value = areaEntries.value[0] ?? null
  sheetOpen.value = true
}

function closeSheet() {
  sheetOpen.value = false
  areaEntries.value = []
  selected.value = null
}

function openById(id: number) {
  const entry = located.value.find((e) => e.id === id)
  if (entry) openPlace([entry])
}

/** 同一个点上的多篇日记（同一坐标 ±0.00002°）；MarkerCluster 每点带 extData.entryId */
function entriesNear(lng: number, lat: number) {
  return located.value.filter((e) => {
    const [x, y] = toAmapLngLat(e.lat, e.lng, e.locationSource)
    return Math.abs(x - lng) < 0.0002 && Math.abs(y - lat) < 0.0002
  })
}

/** 地图不可用时：按地点分组列出全部已保存地点 */
const fallbackGroups = computed(() => {
  const buckets = new Map<string, LocatedEntry[]>()
  for (const entry of located.value) {
    const key = `${entry.address || ''}|${entry.lat.toFixed(4)}|${entry.lng.toFixed(4)}`
    const list = buckets.get(key)
    if (list) list.push(entry)
    else buckets.set(key, [entry])
  }
  return [...buckets.values()]
    .map((list) => ({ list: list.sort((a, b) => +new Date(b.dateOfJournal) - +new Date(a.dateOfJournal)), entry: list[0]! }))
    .sort((a, b) => +new Date(b.entry.dateOfJournal) - +new Date(a.entry.dateOfJournal))
})

function placeLabel(entry: EntryV2) {
  return entry.address || `${entry.lat!.toFixed(4)}, ${entry.lng!.toFixed(4)}`
}

function buildCluster() {
  if (!AMapNS || !map) return
  if (cluster) {
    try { cluster.setMap(null) } catch { /* noop */ }
    cluster = null
  }
  const list = points.value
  if (!list.length) return
  const Ctor = AMapNS.MarkerCluster || AMapNS.MarkerClusterer
  if (!Ctor) return
  const data = list.map((p) => ({
    lnglat: [p.lng, p.lat] as [number, number],
    extData: { entryId: p.entry.id, lng: p.lng, lat: p.lat },
  }))
  cluster = new Ctor(map, data, {
    gridSize: 60,
    maxZoom: 16,
    averageCenter: true,
    renderClusterMarker: (context: any) => {
      const count = Number(context?.count ?? 0)
      const div = pointDom(count)
      context.marker.setContent(div)
      context.marker.setOffset(new AMapNS.Pixel(-div.offsetWidth / 2, -div.offsetHeight / 2))
      context.marker.setTitle(`${count} 篇日记`)
    },
    renderMarker: (context: any) => {
      const ext = context?.data?.[0]?.extData || {}
      const div = pointDom(null)
      context.marker.setContent(div)
      context.marker.setOffset(new AMapNS.Pixel(-10, -10))
      context.marker.setExtData(ext)
      const hit = located.value.find((e) => e.id === ext.entryId)
      if (hit) context.marker.setTitle(placeLabel(hit))
      context.marker.on('click', () => {
        const near = entriesNear(Number(ext.lng), Number(ext.lat))
        openPlace(near.length ? near : [located.value.find((e) => e.id === ext.entryId)!].filter(Boolean))
      })
    },
  })
  // 2.0 的聚合点没有内置「点开散开」，需要自己算中心放大
  cluster.on('click', (payload: any) => {
    const members = payload?.clusterData
    if (!Array.isArray(members) || members.length <= 1) return
    let sumLng = 0
    let sumLat = 0
    for (const m of members) {
      const ll = m?.lnglat
      const lng = Array.isArray(ll) ? Number(ll[0]) : Number(ll?.lng)
      const lat = Array.isArray(ll) ? Number(ll[1]) : Number(ll?.lat)
      if (Number.isFinite(lng) && Number.isFinite(lat)) { sumLng += lng; sumLat += lat }
    }
    const zoom = map.getZoom()
    map.setZoomAndCenter(Math.min(zoom + 2, 17), [sumLng / members.length, sumLat / members.length])
  })
}

function fitToPoints() {
  if (!AMapNS || !map || !points.value.length) return
  const lngs = points.value.map((p) => p.lng)
  const lats = points.value.map((p) => p.lat)
  const center: [number, number] = [(Math.min(...lngs) + Math.max(...lngs)) / 2, (Math.min(...lats) + Math.max(...lats)) / 2]
  const spanLng = Math.max(...lngs) - Math.min(...lngs)
  const spanLat = Math.max(...lats) - Math.min(...lats)
  const span = Math.max(spanLng, spanLat)
  const zoom = span > 20 ? 4 : span > 8 ? 5 : span > 3 ? 6 : span > 1 ? 7 : span > 0.4 ? 9 : span > 0.1 ? 11 : 13
  map.setZoomAndCenter(zoom, center)
}

async function renderMap() {
  loading.value = true
  mapUnavailable.value = false
  mapNote.value = ''
  if (!points.value.length) {
    // 没有任何可上图的地点：不必加载底图，直接给地点列表
    mapUnavailable.value = true
    mapNote.value = located.value.length ? '这些地点在中国大陆以外，首版底图暂不覆盖。' : '还没有带地点的日记。在编辑器里添加地点后会出现在这里。'
    loading.value = false
    return
  }
  if (!getAmapJsKey()) {
    mapUnavailable.value = true
    mapNote.value = '尚未配置「Web端(JS API)」Key，下面显示已保存的地点。可在 设置 → 通用 → 地点 中填写。'
    loading.value = false
    return
  }
  const AMap = await loadAmap(['AMap.MarkerCluster'])
  if (disposed) return
  if (!AMap) {
    mapUnavailable.value = true
    mapNote.value = '地图加载失败：可能是网络问题，或这个 Key 的「服务平台」不是 Web端(JS API)。下面显示已保存的地点。'
    loading.value = false
    return
  }
  AMapNS = AMap
  if (!mapEl.value) { loading.value = false; return }
  try {
    map = new AMap.Map(mapEl.value, {
      zoom: 5,
      center: [104.2, 35.8],
      viewMode: '2D',
      mapStyle: isDark() ? 'amap://styles/dark' : 'amap://styles/normal',
      showLabel: true,
      resizeEnable: true,
    })
    // 高德安全密钥/网络问题不会抛在构造函数里，靠 complete 事件确认底图真的出来了
    await new Promise<void>((resolve) => {
      let done = false
      const finish = () => { if (!done) { done = true; resolve() } }
      map.on('complete', finish)
      setTimeout(finish, 6000)
    })
    if (disposed) return
    ;(window as any).__atlasMap = map
    buildCluster()
    fitToPoints()
  } catch {
    mapUnavailable.value = true
    mapNote.value = '地图初始化失败，下面显示已保存的地点。'
  } finally {
    loading.value = false
  }
}

function syncMarkers() {
  if (!map || mapUnavailable.value) return
  buildCluster()
  if (points.value.length) fitToPoints()
}

watch(points, () => syncMarkers())

// 主题切换时同步底图样式（原版暗色模式下地图也跟着变暗）
watch(() => document.documentElement.dataset.theme, (theme) => {
  if (!map) return
  try { map.setMapStyle(theme === 'dark' ? 'amap://styles/dark' : 'amap://styles/normal') } catch { /* noop */ }
})

onMounted(async () => {
  await refresh()
  if (disposed) return
  await renderMap()
})

onBeforeUnmount(() => {
  disposed = true
  try { cluster?.setMap(null) } catch { /* noop */ }
  cluster = null
  try { if (typeof map?.destroy === 'function') map.destroy(); else map?.remove?.() } catch { /* noop */ }
  map = null
  AMapNS = null
  ;(window as any).__atlasMap = null
})
</script>

<template>
  <div class="jr-content jr-atlas">
    <div ref="mapEl" class="jr-atlas-map" aria-label="日记地图" />

    <p v-if="loading" class="jr-atlas-hint" role="status">正在加载地图…</p>

    <!-- 地图不可用：已保存的地点列表（断网/无密钥/加载失败） -->
    <section v-else-if="mapUnavailable" class="jr-atlas-panel jr-atlas-fallback" aria-label="已保存的地点">
      <div class="jr-atlas-area-head">
        <h2>已保存的地点</h2>
        <span class="jr-muted">{{ located.length }} 篇日记</span>
      </div>
      <p class="jr-muted jr-atlas-note">{{ mapNote }}</p>
      <div v-if="!fallbackGroups.length" class="jr-atlas-empty">
        <JrIcon :path="mdiMapMarkerOutline" :size="28" />
        <p>还没有带地点的日记。写日记时用工具栏的「地点」按钮添加。</p>
      </div>
      <ul v-else class="jr-atlas-area-list">
        <li v-for="group in fallbackGroups" :key="placeLabel(group.entry) + group.entry.lat">
          <button class="jr-atlas-place-row" @click="openPlace(group.list)">
            <span class="jr-atlas-place-name">{{ placeLabel(group.entry) }}</span>
            <span class="jr-muted">{{ dayFmt.format(new Date(group.entry.dateOfJournal)) }}<template v-if="group.list.length > 1"> · {{ group.list.length }} 篇</template></span>
          </button>
        </li>
      </ul>
    </section>

    <!-- 地图上的地点 → 该地点的日记列表 + 预览（桌面右侧面板 / 手机底部抽屉） -->
    <section v-if="sheetOpen && areaEntries.length" class="jr-atlas-panel" :class="{ 'jr-atlas-sheet': isMobile }" aria-label="此地的日记">
      <div class="jr-atlas-area-head">
        <h2>{{ areaEntries.length > 1 ? `此区域内有 ${areaEntries.length} 篇日记` : '此地的日记' }}</h2>
        <button class="jr-icon-btn" aria-label="关闭" @click="closeSheet"><JrIcon :path="mdiClose" :size="20" /></button>
      </div>
      <div v-if="areaEntries.length > 1" class="jr-atlas-area-list">
        <button
          v-for="entry in areaEntries" :key="entry.id"
          class="jr-atlas-area-item" :aria-pressed="selected?.id === entry.id"
          @click="selected = entry"
        >
          <b>{{ dayFmt.format(new Date(entry.dateOfJournal)) }}</b>
          <span class="jr-muted">{{ (entry.previewText || entry.text || '').replace(/<[^>]*>/g, '').slice(0, 48) || '（无正文）' }}</span>
        </button>
      </div>
      <template v-if="selected">
        <JournalBody :entry="selected" />
        <NuxtLink class="jr-btn" :to="{ path: '/', query: { entry: selected.id } }">在时间线中打开</NuxtLink>
      </template>
    </section>

    <p v-if="!loading && !mapUnavailable && !points.length" class="jr-atlas-hint">
      地图仅显示带地点的日记。可在编辑器的「地点」里添加。
    </p>
    <p v-if="!loading && !mapUnavailable && overseasCount > 0" class="jr-atlas-overseas">
      另有 {{ overseasCount }} 篇海外日记不在底图范围内，可在下方列表中打开。
    </p>
    <button v-if="!loading && !mapUnavailable && overseasCount > 0" class="jr-atlas-overseas-btn" @click="openPlace(located)">
      查看全部 {{ located.length }} 个地点
    </button>
  </div>
</template>

<style scoped>
.jr-atlas { position: relative; overflow: hidden; }

:deep(.jr-atlas-point) {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: var(--jr-primary);
  color: var(--jr-on-primary);
  font-weight: 700;
  box-shadow: 0 2px 8px rgba(23, 28, 30, 0.28);
  cursor: pointer;
  border: 2px solid #fff;
  transition: transform 0.12s ease;
}
:deep(.jr-atlas-point:hover) { transform: scale(1.12); }
:deep(.jr-atlas-point-single) { background: var(--jr-primary); }
:deep(.jr-atlas-point-active) { box-shadow: 0 0 0 3px var(--jr-primary-container); }

.jr-atlas-panel { width: min(380px, calc(100% - 48px)); }
.jr-atlas-area-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 10px; }
.jr-atlas-area-head h2 { font-size: 15.5px; font-weight: 650; margin: 0; }
.jr-atlas-note { font-size: 12.5px; margin: 0 0 12px; line-height: 1.5; }
.jr-atlas-area-list { list-style: none; margin: 0 0 14px; padding: 0; display: flex; flex-direction: column; gap: 4px; }
.jr-atlas-place-row, .jr-atlas-area-item {
  display: flex; flex-direction: column; align-items: flex-start; gap: 2px;
  width: 100%; text-align: left; background: none; border: 0; border-radius: 8px;
  padding: 8px 10px; cursor: pointer; font: inherit; font-size: 13.5px; color: inherit;
}
.jr-atlas-place-row:hover, .jr-atlas-area-item:hover { background: rgba(0, 0, 0, 0.04); }
.jr-atlas-area-item[aria-pressed="true"] { background: var(--jr-primary-container); }
.jr-atlas-place-name { font-weight: 600; }
.jr-atlas-empty { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 32px 12px; text-align: center; color: var(--jr-on-surface-variant); font-size: 13px; }
.jr-atlas-overseas { position: absolute; left: 24px; bottom: 24px; z-index: 4; background: #fff; border-radius: 12px; padding: 8px 12px; font-size: 12.5px; box-shadow: 0 6px 20px rgba(23, 28, 30, 0.14); margin: 0; }
.jr-atlas-overseas-btn { position: absolute; left: 24px; bottom: 66px; z-index: 4; border: 0; border-radius: 10px; padding: 7px 12px; background: var(--jr-primary); color: var(--jr-on-primary); font-size: 12.5px; cursor: pointer; }

/* 手机：全屏地图 + 底部抽屉 */
@media (max-width: 600px) {
  .jr-atlas { min-height: 100%; }
  .jr-atlas-panel { left: 12px; right: 12px; top: auto; bottom: 12px; width: auto; max-height: 58vh; padding: 16px; }
  .jr-atlas-overseas { left: 12px; bottom: 12px; }
  .jr-atlas-overseas-btn { left: 12px; bottom: 56px; }
}
[data-theme="dark"] .jr-atlas-overseas { background: var(--jr-layer); color: var(--jr-on-bg); }
</style>
