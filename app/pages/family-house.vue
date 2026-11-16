<script setup lang="ts">
import {
  mdiArrowLeft, mdiBookOpenOutline, mdiCameraOutline, mdiClose, mdiCubeOutline, mdiDeleteOutline, mdiDoorOpen, mdiDownload,
  mdiFloorPlan, mdiFullscreen, mdiFullscreenExit, mdiGestureTap, mdiHelpCircleOutline, mdiHomeOutline, mdiLightbulbOutline,
  mdiMapOutline, mdiMoonWaningCrescent, mdiMouse, mdiPaletteOutline, mdiPaw, mdiPlus, mdiRestore, mdiRotateRight,
  mdiSofa, mdiStar, mdiStarOutline, mdiTune, mdiUndo, mdiVolumeHigh, mdiVolumeOff, mdiWalk,
} from '@mdi/js'
import furnitureUrl from '~/assets/family-house/furniture.glb?url'
import type { EntryV2 } from '~/utils/db'
import {
  DIY_FURNITURE_CATALOG, FLOOR_STYLES, WALL_STYLES, defaultDiyState, loadDiyState, saveDiyState,
  type FamilyHouseDiyState, type FloorStyleId, type WallStyleId,
} from '~/utils/familyHouseDiy'
import { houseLevels, houseStops, porch, stairStops, type HouseStop } from '~/utils/familyHouseLayout'
import type { createFamilyHouseScene, HouseDiySceneState, HouseFloor, HouseHint, HousePetState, HousePosition, HouseView } from '~/utils/familyHouseScene'

useHead({ title: '回家 · 我们的小家' })

const canOpen3DHouse = useFamilyHouseAccess()
const stage = ref<HTMLElement>()
const canvas = ref<HTMLCanvasElement>()
const help = ref<HTMLDialogElement>()
const sensitivityDialog = ref<HTMLDialogElement>()
const status = ref<'loading' | 'ready' | 'error'>('loading')
const view = ref<HouseView>('walk')
const overviewFloor = ref<HouseFloor>('all')
const outside = ref(false)
const lit = ref(true)
const evening = ref(false)
const muted = ref(false)
const activePropsLabels = shallowRef<string[]>([])
const mapOpen = ref(true)
const toolsOpen = ref(false)
const journalOpen = ref(false)
const tvOpen = ref(false)
const galleryOpen = ref(false)
const galleryPhotos = ref<Array<{ id?: number; jId: number; url?: string; fileName: string; dateLabel: string }>>([])

// DIY 装修模式状态与撤销栈
const diyState = ref<FamilyHouseDiyState>(loadDiyState())
const diyUndoStack = ref<FamilyHouseDiyState[]>([])
const diyTab = ref<'furniture' | 'materials' | 'placed'>('furniture')
const diyCat = ref<'all' | 'seating' | 'storage' | 'table' | 'decor'>('all')
const diySceneState = shallowRef<HouseDiySceneState>({ placingKey: null, placingValid: true, selectedId: null, items: [] })
const filteredCatalog = computed(() =>
  diyCat.value === 'all' ? DIY_FURNITURE_CATALOG : DIY_FURNITURE_CATALOG.filter(item => item.category === diyCat.value),
)
const decorateFloor = computed(() => typeof overviewFloor.value === 'number' ? overviewFloor.value : position.value.floor)
function snapshotDiyForUndo() {
  diyUndoStack.value.push(JSON.parse(JSON.stringify(diyState.value)))
  if (diyUndoStack.value.length > 20) diyUndoStack.value.shift()
}
function undoDiy() {
  const prev = diyUndoStack.value.pop()
  if (!prev) return
  diyState.value = prev
  saveDiyState(prev)
  game?.setWallStyle(prev.wallStyle)
  game?.setFloorStyle(prev.floorStyle)
  game?.loadDiyItems(prev.items)
  showActionToast('已撤销上一步装修操作')
}
function chooseWallStyle(id: WallStyleId) {
  snapshotDiyForUndo()
  diyState.value.wallStyle = id
  saveDiyState(diyState.value)
  game?.setWallStyle(id)
}
function chooseFloorStyle(id: FloorStyleId) {
  snapshotDiyForUndo()
  diyState.value.floorStyle = id
  saveDiyState(diyState.value)
  game?.setFloorStyle(id)
}
function resetAllDiy() {
  snapshotDiyForUndo()
  const next = defaultDiyState()
  diyState.value = next
  saveDiyState(next)
  game?.setWallStyle(next.wallStyle)
  game?.setFloorStyle(next.floorStyle)
  game?.loadDiyItems([])
  showActionToast('已恢复默认小屋装修')
}
async function syncWallPhotosTo3D() {
  if (!game) return
  try {
    const rows = (await allMedia()).filter(m => m.mimeType.startsWith('image/')).slice(0, 4)
    await prefetchMedia(rows)
    const urls = rows.map(m => mediaUrl(m)).filter((u): u is string => Boolean(u))
    game.syncPictureWall(urls)
  } catch { /* ignore */ }
}
const editorOpen = ref(false)
const editingEntry = shallowRef<EntryV2 | null>(null)
const journalTitle = ref('日记书架')
const journalQuery = ref('')
const journalFilter = ref<'all' | 'starred'>('all')
const draftText = ref('')
const draftStarred = ref(false)
const savingDraft = ref(false)
const { entries, refresh: refreshEntries, saveEntry, allMedia } = useEntries()
const { prefetch: prefetchMedia, urlForSync: mediaUrl } = useMediaResolver()
const { state: familyState, feed: familyFeed } = useFamilySync()

async function openGalleryDrawer() {
  journalOpen.value = false
  tvOpen.value = false
  galleryOpen.value = true
  const rows = (await allMedia()).filter((m) => m.mimeType.startsWith('image/')).slice(0, 12)
  await prefetchMedia(rows)
  galleryPhotos.value = rows.map((m) => ({
    id: m.id,
    jId: m.jId,
    url: mediaUrl(m),
    fileName: m.fileName,
    dateLabel: m.createdAt ? formatJournalDate(m.createdAt) : '',
  }))
}

const onThisDayEntries = computed(() => {
  const now = new Date()
  const month = now.getMonth()
  const day = now.getDate()
  const sameDay = entries.value.filter((e) => {
    const d = new Date(e.dateOfJournal)
    return d.getMonth() === month && d.getDate() === day
  })
  return (sameDay.length ? sameDay : entries.value).slice(0, 5)
})
const filteredEntries = computed(() => {
  const q = journalQuery.value.trim().toLowerCase()
  return entries.value.filter(entry => {
    if (journalFilter.value === 'starred' && !entry.favourite) return false
    if (!q) return true
    return (entry.previewText || '').toLowerCase().includes(q)
      || (entry.tags || []).some(tag => tag.toLowerCase().includes(q))
  }).slice(0, 40)
})
function openJournalDrawer(title = '日记书架') {
  journalTitle.value = title
  journalOpen.value = true
  toolsOpen.value = false
  void refreshEntries()
}
function openJournalEditor(entry?: EntryV2) {
  editingEntry.value = entry ?? null
  editorOpen.value = true
  toolsOpen.value = false
}
async function onEditorDone(savedId?: number) {
  editorOpen.value = false
  editingEntry.value = null
  await refreshEntries()
  if (savedId != null) showActionToast('日记已保存并更新到书架！')
  focusScene()
}
function escapeHtml(raw: string) {
  return raw.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
}
async function submitQuickJournal() {
  const content = draftText.value.trim()
  if (!content || savingDraft.value) return
  savingDraft.value = true
  try {
    const html = content.split(/\n+/).map(line => `<p>${escapeHtml(line)}</p>`).join('')
    await saveEntry(undefined, html, new Date(), { favourite: draftStarred.value ? 1 : 0 }, [], [])
    await refreshEntries()
    draftText.value = ''
    draftStarred.value = false
    showActionToast('已记录新日记并上架到书架！')
  } catch (error) {
    console.error('Failed to save quick journal entry', error)
    alertText.value = '日记保存失败，请重试。'
  } finally {
    savingDraft.value = false
  }
}
function formatJournalDate(date: Date | string) {
  const d = date instanceof Date ? date : new Date(date)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric', weekday: 'short' })
}
watch(entries, list => {
  game?.syncJournalBooks(list.length, list.filter(item => item.favourite).length)
}, { deep: false })
const mouseLocked = ref(false)
const fullscreen = ref(false)
const sensitivityKey = 'jr.familyHouseLookSensitivity'
const sensitivityMin = 25
const sensitivityMax = 150
const sensitivityStep = 5
const sensitivityDefault = 70
const sensitivity = ref(readSensitivity())
const room = ref('porch')
const position = shallowRef<HousePosition>({ x: porch.position[0], z: porch.position[1], yaw: 0, floor: 0, onStairs: false })
const hint = shallowRef<HouseHint | null>(null)
const petState = shallowRef<HousePetState>({ floor: 0, moving: true, called: false, roomLabel: '客厅' })
const petStatusText = computed(() => {
  if (petState.value.called) return `小狗正在跑向${petState.value.roomLabel}`
  return petState.value.moving ? `柴犬散步中 · 小狗在${petState.value.roomLabel}里` : `柴犬休息中 · 小狗在${petState.value.roomLabel}里`
})
const livingStop = houseStops.find(item => item.id === 'living')!
const exporting = ref(false)
const alertText = ref('')
const actionToast = ref('')
let actionTimer: ReturnType<typeof setTimeout> | undefined
function showActionToast(message: string) {
  actionToast.value = message
  if (actionTimer) clearTimeout(actionTimer)
  actionTimer = setTimeout(() => { actionToast.value = '' }, 2400)
}
const allStops = [porch, ...houseStops, ...stairStops]
const actualRoom = computed(() => room.value === 'stairs' ? '楼梯间' : allStops.find(stop => stop.id === room.value)?.label || '玄关')
const mapFloor = computed(() => view.value === 'walk' ? position.value.floor : overviewFloor.value)
let controller: AbortController | undefined
let game: Awaited<ReturnType<typeof createFamilyHouseScene>> | undefined

function clampSensitivity(value: number) {
  return Math.max(sensitivityMin, Math.min(sensitivityMax, Math.round(value / sensitivityStep) * sensitivityStep))
}
function readSensitivity() {
  try {
    const saved = localStorage.getItem(sensitivityKey)
    const value = Number(saved)
    if (saved && Number.isFinite(value)) return clampSensitivity(value)
  } catch { /* The control still works when storage is unavailable. */ }
  return sensitivityDefault
}
function applySensitivity() {
  game?.setLookSensitivity(fullscreen.value ? sensitivity.value / 100 : 1)
}
watch(sensitivity, value => {
  applySensitivity()
  try { localStorage.setItem(sensitivityKey, String(value)) }
  catch { /* The setting remains usable for the current visit. */ }
}, { flush: 'sync' })

function focusScene() {
  canvas.value?.focus({ preventScroll: true })
}
async function initialize() {
  const element = canvas.value
  if (!element || !canOpen3DHouse.value || game) return
  controller?.abort()
  const attempt = new AbortController()
  controller = attempt
  status.value = 'loading'
  try {
    const { createFamilyHouseScene } = await import('~/utils/familyHouseScene')
    attempt.signal.throwIfAborted()
    const result = await createFamilyHouseScene(element, furnitureUrl, {
      signal: attempt.signal,
      onRoom: id => { room.value = id },
      onPosition: value => { position.value = value },
      onHint: value => { hint.value = value },
      onLock: value => { mouseLocked.value = value },
      onPet: value => { petState.value = value },
      onAction: showActionToast,
      onPropsChange: labels => { activePropsLabels.value = labels },
      onDiyChange: next => {
        const prevCount = diyState.value.items.length
        const nextCount = next.items.length
        if (prevCount !== nextCount || JSON.stringify(diyState.value.items) !== JSON.stringify(next.items)) {
          snapshotDiyForUndo()
          diyState.value.items = next.items
          saveDiyState(diyState.value)
        }
        diySceneState.value = next
      },
      onOpenJournal: ctx => {
        if (ctx.mode === 'editor') openJournalEditor()
        else if (ctx.mode === 'tv') {
          journalOpen.value = false
          galleryOpen.value = false
          tvOpen.value = true
        } else if (ctx.mode === 'gallery') {
          void openGalleryDrawer()
        } else {
          tvOpen.value = false
          galleryOpen.value = false
          openJournalDrawer(ctx.title)
        }
      },
    })
    if (attempt.signal.aborted) { result.dispose(); return }
    game = result
    game.syncJournalBooks(entries.value.length, entries.value.filter(item => item.favourite).length)
    game.setWallStyle(diyState.value.wallStyle)
    game.setFloorStyle(diyState.value.floorStyle)
    game.loadDiyItems(diyState.value.items)
    void syncWallPhotosTo3D()
    applySensitivity()
    view.value = 'walk'
    overviewFloor.value = 'all'
    outside.value = false
    lit.value = true
    evening.value = false
    status.value = 'ready'
    await nextTick()
    if (document.activeElement === document.body) focusScene()
  } catch (error) {
    if (attempt.signal.aborted) return
    console.error('Unable to open the family house', error)
    status.value = 'error'
  }
}

function dispose() {
  controller?.abort()
  game?.dispose()
  game = undefined
}
watch(canOpen3DHouse, async allowed => {
  if (!allowed) { dispose(); return }
  await nextTick()
  await initialize()
})
onMounted(() => {
  void refreshEntries()
  void initialize()
  document.addEventListener('fullscreenchange', syncFullscreen)
})
onBeforeUnmount(() => {
  document.removeEventListener('fullscreenchange', syncFullscreen)
  dispose()
})

function visit(stop: HouseStop) {
  const switchingToWalk = view.value !== 'walk'
  view.value = 'walk'
  game?.setView('walk', stop.floor)
  game?.enter(stop)
  focusScene()
  if (switchingToWalk && fullscreen.value) void game?.lockLook()
}
function changeView(mode: HouseView) {
  if (mode === view.value) return
  view.value = mode
  if (mode === 'decorate' && overviewFloor.value === 'all') overviewFloor.value = position.value.floor
  const targetFloor = mode === 'overview' ? overviewFloor.value : mode === 'decorate' ? decorateFloor.value : position.value.floor
  game?.setView(mode, targetFloor, mode === 'decorate' ? false : outside.value)
  if (mode === 'walk') {
    focusScene()
    if (fullscreen.value) void game?.lockLook()
  }
}
function selectFloor(value: HouseFloor) {
  if (view.value === 'walk' && value !== 'all') {
    visit(houseStops.find(item => item.floor === value)!)
    return
  }
  overviewFloor.value = value
  if (value !== 'all') outside.value = false
  game?.setView(view.value === 'decorate' ? 'decorate' : 'overview', value, view.value === 'decorate' ? false : outside.value)
}
function toggleOutside() {
  outside.value = !outside.value
  overviewFloor.value = 'all'
  game?.setView('overview', 'all', outside.value)
}
function toggleLamps() {
  lit.value = !lit.value
  game?.setLamps(lit.value)
  if (view.value === 'walk') focusScene()
}
function toggleEvening() {
  evening.value = !evening.value
  game?.setEvening(evening.value)
  if (view.value === 'walk') focusScene()
}
function showHelp() {
  game?.releaseLook()
  help.value?.showModal()
}
function syncFullscreen() {
  const wasFullscreen = fullscreen.value
  fullscreen.value = document.fullscreenElement === stage.value
  applySensitivity()
  if (wasFullscreen && !fullscreen.value) {
    game?.releaseLook()
    sensitivityDialog.value?.close()
  }
}
async function toggleFullscreen() {
  const surface = stage.value
  if (!surface) return
  alertText.value = ''
  let capture: Promise<void> | undefined
  try {
    if (document.fullscreenElement === surface) {
      await document.exitFullscreen()
      return
    }
    if (document.fullscreenEnabled && view.value === 'walk' && !mouseLocked.value) {
      // Fullscreen consumes the same click activation required by pointer lock.
      capture = game?.lockLook()
    }
    await surface.requestFullscreen()
  } catch {
    alertText.value = '当前窗口无法全屏。'
    if (capture) {
      await capture
      if (document.fullscreenElement !== surface) game?.releaseLook()
    }
  }
}
function resumeFullscreenLook() {
  if (fullscreen.value && view.value === 'walk' && !mouseLocked.value) void game?.lockLook()
}
function openSensitivity() {
  game?.releaseLook()
  sensitivityDialog.value?.showModal()
}
function finishSensitivity() {
  sensitivityDialog.value?.close()
  resumeFullscreenLook()
}
function shortcuts(event: KeyboardEvent) {
  if (event.target !== canvas.value || event.repeat || event.altKey || event.ctrlKey || event.metaKey) return
  if (event.code === 'Escape' && mouseLocked.value) {
    event.preventDefault()
    game?.releaseLook()
    return
  }
  if (fullscreen.value && view.value === 'walk') {
    const decrease = event.code === 'Minus' || event.code === 'NumpadSubtract'
    const increase = event.code === 'Equal' || event.code === 'NumpadAdd'
    if (decrease || increase) {
      event.preventDefault()
      sensitivity.value = clampSensitivity(sensitivity.value + (decrease ? -1 : 1) * sensitivityStep)
      return
    }
  }
  if (event.code === 'Digit1') { changeView('walk'); return }
  if (event.code === 'Digit2') { changeView('overview'); return }
  if (event.code === 'Digit3') { changeView('decorate'); return }
  if (event.code === 'KeyV') changeView(view.value === 'walk' ? 'overview' : 'walk')
  if (event.code === 'KeyM') mapOpen.value = !mapOpen.value
  if (event.code === 'KeyP') game?.takePostcard()
}
function toggleMute() {
  muted.value = !muted.value
  game?.setMuted(muted.value)
  showActionToast(muted.value ? '已开启静音' : '已恢复小家音效')
}
async function download() {
  if (!game || exporting.value) return
  exporting.value = true
  alertText.value = ''
  try {
    const data = await game.exportModel()
    const url = URL.createObjectURL(new Blob([data], { type: 'model/gltf-binary' }))
    const link = document.createElement('a')
    link.href = url
    link.download = 'three-storey-family-home.glb'
    link.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  } catch (error) {
    console.error('Unable to export the family house', error)
    alertText.value = '模型导出失败，请重试。'
  } finally {
    exporting.value = false
  }
}
</script>

<template>
  <main v-if="!canOpen3DHouse" class="house-desktop-only">
    <JrIcon :path="mdiHomeOutline" :size="36" />
    <h1>回家</h1>
    <p>3D 漫游目前在桌面网页端开放。</p>
    <NuxtLink to="/family">返回家庭日记</NuxtLink>
  </main>
  <main v-else ref="stage" class="house-stage" aria-label="3D 房屋视图" @keydown="shortcuts">
    <canvas ref="canvas" class="house-canvas" tabindex="0" aria-label="小家 3D 场景" aria-describedby="house-controls"
      :class="{ 'mouse-locked': mouseLocked }" @click="resumeFullscreenLook" />
    <div v-if="status !== 'ready'" class="house-cover">
      <p v-if="status === 'loading'" role="status">正在打开小家…</p>
      <template v-else>
        <p role="alert">小家暂时打不开。请确认桌面浏览器启用了 WebGL，再试一次。</p>
        <button type="button" @click="initialize">重试</button>
      </template>
    </div>

    <header class="house-top">
      <NuxtLink to="/family" class="house-brand house-hud" aria-label="返回家庭日记" title="返回家庭日记">
        <span class="house-brand-icon"><JrIcon :path="mdiHomeOutline" :size="22" /></span>
        <span><strong>回家 <em class="house-brand-tag">3D 漫游</em></strong><small>{{ view === 'walk' ? `${houseLevels[position.floor]} · ${actualRoom}` : '我们的小家' }}</small></span>
        <JrIcon class="house-back-icon" :path="mdiArrowLeft" :size="16" />
      </NuxtLink>

      <div v-if="status === 'ready'" class="house-mode house-hud" role="group" aria-label="浏览视角">
        <button type="button" :aria-pressed="view === 'walk'" @click="changeView('walk')">
          <JrIcon :path="mdiWalk" :size="17" /> 第一人称 <kbd class="mode-key">1</kbd>
        </button>
        <button type="button" :aria-pressed="view === 'overview'" @click="changeView('overview')">
          <JrIcon :path="mdiCubeOutline" :size="17" /> 全屋视角 <kbd class="mode-key">2</kbd>
        </button>
        <button type="button" :aria-pressed="view === 'decorate'" @click="changeView('decorate')">
          <JrIcon :path="mdiFloorPlan" :size="17" /> 装修 <kbd class="mode-key">3</kbd>
        </button>
      </div>

      <div v-if="status === 'ready'" class="house-toolbar-wrap">
        <div class="house-toolbar house-hud" role="group" aria-label="场景工具">
          <button type="button" :aria-pressed="mapOpen" aria-label="小地图" title="小地图 · M" @click="mapOpen = !mapOpen"><JrIcon :path="mdiMapOutline" :size="20" /></button>
          <button type="button" :aria-pressed="toolsOpen" aria-label="更多功能" title="场景设置与工具" @click="toolsOpen = !toolsOpen"><JrIcon :path="mdiTune" :size="20" /></button>
          <button type="button" aria-label="按键说明" title="按键说明" @click="toolsOpen = false; showHelp()"><JrIcon :path="mdiHelpCircleOutline" :size="20" /></button>
          <button type="button" :aria-label="fullscreen ? '退出全屏' : '全屏'" :title="fullscreen ? '退出全屏' : '全屏'" @click="toggleFullscreen">
            <JrIcon :path="fullscreen ? mdiFullscreenExit : mdiFullscreen" :size="21" />
          </button>
        </div>

        <div v-if="toolsOpen" class="house-tools-menu house-hud" role="menu" aria-label="场景功能菜单">
          <button type="button" @click="openJournalDrawer('日记书架')">
            <JrIcon :path="mdiBookOpenOutline" :size="18" /><span>打开日记书架 ({{ entries.length }})</span>
          </button>
          <button v-if="view === 'overview'" type="button" :aria-pressed="outside" @click="toggleOutside">
            <JrIcon :path="mdiHomeOutline" :size="18" /><span>{{ outside ? '剖面预览' : '完整外观' }}</span>
          </button>
          <button v-if="view === 'overview'" type="button" @click="game?.resetOrbit()">
            <JrIcon :path="mdiRestore" :size="18" /><span>重置全景视角</span>
          </button>
          <button v-if="view === 'walk'" type="button" :aria-pressed="mouseLocked" @click="mouseLocked ? game?.releaseLook() : game?.lockLook(); toolsOpen = false">
            <JrIcon :path="mdiMouse" :size="18" /><span>{{ mouseLocked ? '释放鼠标视角' : '锁定鼠标视角' }}</span>
          </button>
          <button v-if="view === 'walk'" type="button" @click="visit(livingStop); toolsOpen = false">
            <JrIcon :path="mdiSofa" :size="18" /><span>回到客厅</span>
          </button>
          <button type="button" :aria-pressed="lit" @click="toggleLamps">
            <JrIcon :path="mdiLightbulbOutline" :size="18" /><span>{{ lit ? '关闭室内暖灯' : '打开室内暖灯' }}</span>
          </button>
          <button type="button" :aria-pressed="evening" @click="toggleEvening">
            <JrIcon :path="mdiMoonWaningCrescent" :size="18" /><span>{{ evening ? '切回白天' : '切到夜景' }}</span>
          </button>
          <button type="button" :aria-pressed="muted" @click="toggleMute">
            <JrIcon :path="muted ? mdiVolumeOff : mdiVolumeHigh" :size="18" /><span>{{ muted ? '取消静音' : '静音音效' }}</span>
          </button>
          <button type="button" @click="game?.takePostcard(); toolsOpen = false; focusScene()">
            <JrIcon :path="mdiCameraOutline" :size="18" /><span>拍明信片 (P)</span>
          </button>
          <button v-if="fullscreen && view === 'walk'" type="button" @click="toolsOpen = false; openSensitivity()">
            <JrIcon :path="mdiTune" :size="18" /><span>鼠标灵敏度 {{ sensitivity }}%</span>
          </button>
          <button type="button" :disabled="exporting" @click="download">
            <JrIcon :path="mdiDownload" :size="18" /><span>{{ exporting ? '导出中…' : '导出 3D 模型' }}</span>
          </button>
        </div>
      </div>
    </header>

    <template v-if="status === 'ready'">
      <div v-if="activePropsLabels.length" class="house-active-props house-hud" aria-label="运行中的家居">
        <span>{{ activePropsLabels.join(' · ') }}</span>
      </div>
      <div v-if="view === 'walk'" class="house-reticle" aria-hidden="true" />
      <FamilyHouseMap v-if="mapOpen" class="house-map-wrap house-hud" :floor="mapFloor" :room="room" :position="position" :view="view"
        @floor="selectFloor" @visit="visit" @hide="mapOpen = false; focusScene()" />
      <p v-if="view === 'walk' && actionToast" class="house-action-toast" role="status">{{ actionToast }}</p>
      <button v-if="view === 'walk' && hint" type="button" class="house-interaction house-hud" :aria-label="hint.label" aria-keyshortcuts="E" @click="game?.interact(); focusScene()">
        <kbd>E</kbd><JrIcon :path="hint.kind === 'door' ? mdiDoorOpen : hint.kind === 'pet' ? mdiPaw : hint.kind === 'seat' ? mdiSofa : hint.kind === 'prop' ? mdiGestureTap : mdiLightbulbOutline" :size="18" />{{ hint.label }}
      </button>
      <aside v-if="view === 'decorate'" class="house-diy-dock house-hud" aria-label="小屋装修工作台">
        <div v-if="diySceneState.placingKey" class="diy-float-bar" :class="{ invalid: !diySceneState.placingValid }">
          <span>
            {{ diySceneState.placingValid ? '点击地面放置 · R 旋转 45° · Shift 连续放置' : '位置重叠或靠近墙体/楼梯，请移动位置' }}
          </span>
          <div class="diy-float-actions">
            <button type="button" @click="game?.rotateSelectedDiy(45)"><JrIcon :path="mdiRotateRight" :size="15" /> 旋转</button>
            <button type="button" @click="game?.cancelPlaceDiy()"><JrIcon :path="mdiClose" :size="15" /> 取消 (Esc)</button>
          </div>
        </div>
        <div v-else-if="diySceneState.selectedId" class="diy-float-bar">
          <span>已选中家具 · 可直接用方向键微调或 R 旋转</span>
          <div class="diy-float-actions">
            <button type="button" @click="game?.startMoveSelectedDiy()">移动</button>
            <button type="button" @click="game?.rotateSelectedDiy(45)"><JrIcon :path="mdiRotateRight" :size="15" /> 旋转 45°</button>
            <button type="button" class="danger" @click="game?.deleteSelectedDiy()"><JrIcon :path="mdiDeleteOutline" :size="15" /> 删除</button>
            <button type="button" @click="game?.selectDiyItem(null)">完成</button>
          </div>
        </div>

        <div class="diy-dock-head">
          <div class="diy-tabs">
            <button type="button" :aria-pressed="diyTab === 'furniture'" @click="diyTab = 'furniture'"><JrIcon :path="mdiSofa" :size="15" /> 摆家具</button>
            <button type="button" :aria-pressed="diyTab === 'materials'" @click="diyTab = 'materials'"><JrIcon :path="mdiPaletteOutline" :size="15" /> 墙面与地板</button>
            <button type="button" :aria-pressed="diyTab === 'placed'" @click="diyTab = 'placed'">已放 ({{ diyState.items.length }})</button>
          </div>
          <div class="diy-floor-pills">
            <button
              v-for="(label, idx) in houseLevels"
              :key="idx"
              type="button"
              :aria-pressed="decorateFloor === idx"
              @click="selectFloor(idx)"
            >{{ label }}</button>
          </div>
          <div class="diy-head-tools">
            <button type="button" :disabled="!diyUndoStack.length" title="撤销" @click="undoDiy">
              <JrIcon :path="mdiUndo" :size="15" /> 撤销
            </button>
            <button type="button" title="重置默认装修" @click="resetAllDiy">重置</button>
          </div>
        </div>

        <div v-if="diyTab === 'furniture'" class="diy-panel">
          <div class="diy-cat-row">
            <button type="button" :aria-pressed="diyCat === 'all'" @click="diyCat = 'all'">全部</button>
            <button type="button" :aria-pressed="diyCat === 'seating'" @click="diyCat = 'seating'">座椅沙发</button>
            <button type="button" :aria-pressed="diyCat === 'storage'" @click="diyCat = 'storage'">书架收纳</button>
            <button type="button" :aria-pressed="diyCat === 'table'" @click="diyCat = 'table'">桌几</button>
            <button type="button" :aria-pressed="diyCat === 'decor'" @click="diyCat = 'decor'">绿植灯饰</button>
          </div>
          <div class="diy-catalog-scroll">
            <button
              v-for="item in filteredCatalog"
              :key="item.modelKey"
              type="button"
              class="diy-item-card"
              :class="{ active: diySceneState.placingKey === item.modelKey }"
              @click="game?.startPlaceDiy(item.modelKey); focusScene()"
            >
              <span class="diy-item-emoji">{{ item.emoji }}</span>
              <strong>{{ item.label }}</strong>
              <small>{{ item.hintSize }}</small>
            </button>
          </div>
        </div>

        <div v-else-if="diyTab === 'materials'" class="diy-materials-grid">
          <div>
            <div class="diy-mat-title">墙面材质</div>
            <div class="diy-mat-row">
              <button
                v-for="w in WALL_STYLES"
                :key="w.id"
                type="button"
                class="diy-mat-chip"
                :class="{ active: diyState.wallStyle === w.id }"
                :title="w.desc"
                @click="chooseWallStyle(w.id)"
              >
                <span class="diy-mat-swatch" :style="{ background: w.color }" />
                <span>{{ w.label }}</span>
              </button>
            </div>
          </div>
          <div>
            <div class="diy-mat-title">地板材质</div>
            <div class="diy-mat-row">
              <button
                v-for="f in FLOOR_STYLES"
                :key="f.id"
                type="button"
                class="diy-mat-chip"
                :class="{ active: diyState.floorStyle === f.id }"
                :title="f.desc"
                @click="chooseFloorStyle(f.id)"
              >
                <span class="diy-mat-swatch" :style="{ background: f.color }" />
                <span>{{ f.label }}</span>
              </button>
            </div>
          </div>
        </div>

        <div v-else class="diy-placed-list">
          <p v-if="!diyState.items.length" class="diy-empty">还没有自定义摆放家具，切到「摆家具」点选一件放到房间里吧。</p>
          <div v-else class="diy-placed-chips">
            <button
              v-for="it in diyState.items"
              :key="it.id"
              type="button"
              class="diy-mat-chip"
              :class="{ active: diySceneState.selectedId === it.id }"
              @click="selectFloor(it.floor); game?.selectDiyItem(it.id); focusScene()"
            >
              <span>{{ houseLevels[it.floor] }} · {{ DIY_FURNITURE_CATALOG.find(c => c.modelKey === it.modelKey)?.label || it.modelKey }}</span>
            </button>
            <button type="button" class="diy-mat-chip danger" @click="snapshotDiyForUndo(); game?.clearAllDiy()">清空全部</button>
          </div>
        </div>
      </aside>

      <aside class="house-pet house-hud" aria-label="家里的小伙伴">
        <div class="house-pet-info">
          <JrIcon :path="mdiPaw" :size="18" class="house-pet-icon" />
          <div>
            <strong>家里的小伙伴</strong>
            <small>{{ petStatusText }}</small>
          </div>
        </div>
        <button type="button" @click="game?.callPet(); if (view === 'walk') focusScene()">叫过来</button>
      </aside>

      <aside v-if="journalOpen" class="house-journal-drawer house-hud" aria-label="日记书架">
        <div class="journal-drawer-head">
          <div>
            <strong>{{ journalTitle }}</strong>
            <small>共 {{ entries.length }} 篇日常记忆</small>
          </div>
          <button type="button" class="journal-close" aria-label="关闭日记书架" @click="journalOpen = false; focusScene()">
            <JrIcon :path="mdiClose" :size="18" />
          </button>
        </div>

        <form class="journal-compose" @submit.prevent="submitQuickJournal">
          <textarea v-model="draftText" rows="3" placeholder="在这里写下今天的随笔或小确幸，保存后会自动上架到书架…" />
          <div class="journal-compose-bar">
            <button type="button" class="journal-star-btn" :aria-pressed="draftStarred" @click="draftStarred = !draftStarred">
              <JrIcon :path="draftStarred ? mdiStar : mdiStarOutline" :size="16" />
              <span>{{ draftStarred ? '已星标' : '加星标' }}</span>
            </button>
            <div class="journal-compose-actions">
              <button type="button" class="journal-star-btn" @click="openJournalEditor()">完整编辑器</button>
              <button type="submit" class="journal-save-btn" :disabled="savingDraft || !draftText.trim()">
                <JrIcon :path="mdiPlus" :size="16" />
                <span>{{ savingDraft ? '保存中…' : '存入书架' }}</span>
              </button>
            </div>
          </div>
        </form>

        <div class="journal-filter-row">
          <input v-model="journalQuery" type="search" placeholder="搜索日记内容或标签…" />
          <button type="button" :aria-pressed="journalFilter === 'all'" @click="journalFilter = 'all'">全部</button>
          <button type="button" :aria-pressed="journalFilter === 'starred'" @click="journalFilter = 'starred'">星标</button>
        </div>

        <ul class="journal-list">
          <li v-if="!filteredEntries.length" class="journal-empty">书架这一层还没有匹配的日记，写一篇吧。</li>
          <li v-for="item in filteredEntries" :key="item.id ?? item.cloudId" class="journal-item" role="button" tabindex="0" @click="openJournalEditor(item)" @keydown.enter.prevent="openJournalEditor(item)">
            <div class="journal-item-meta">
              <span>{{ formatJournalDate(item.dateOfJournal) }}</span>
              <JrIcon v-if="item.favourite" :path="mdiStar" :size="14" class="journal-item-star" />
            </div>
            <p>{{ item.previewText || '（空白日记）' }}</p>
            <div v-if="item.tags?.length" class="journal-tags">
              <span v-for="tag in item.tags.slice(0, 3)" :key="tag">#{{ tag }}</span>
            </div>
          </li>
        </ul>

        <nav class="journal-quick-links" aria-label="快捷入口">
          <NuxtLink to="/">完整时间线</NuxtLink>
          <NuxtLink to="/calendar">日历</NuxtLink>
          <NuxtLink to="/atlas">足迹</NuxtLink>
          <NuxtLink to="/media">相册</NuxtLink>
        </nav>
      </aside>

      <aside v-if="tvOpen" class="house-journal-drawer house-hud" aria-label="客厅电视 · 家庭动态与回忆">
        <div class="journal-drawer-head">
          <div>
            <strong>📺 客厅电视 · 家庭与回忆频道</strong>
            <small>{{ familyState.group ? `家庭组：${familyState.group.name}` : '未加入家庭组 · 展示本机回顾' }}</small>
          </div>
          <button type="button" class="journal-close" aria-label="关闭电视面板" @click="tvOpen = false; focusScene()">
            <JrIcon :path="mdiClose" :size="18" />
          </button>
        </div>

        <div class="journal-filter-row" style="justify-content:space-between">
          <strong style="font-size:12.5px">👨‍👩‍👧‍👦 家庭最新动态</strong>
          <NuxtLink to="/family" style="font-size:12px;color:var(--jr-primary);text-decoration:none">去我们的小家 →</NuxtLink>
        </div>
        <ul class="journal-list" style="max-height:170px">
          <li v-if="!familyFeed.entries.length" class="journal-empty">暂无家庭共享动态，去「我们的小家」发布第一条动态吧。</li>
          <li v-for="fe in familyFeed.entries.slice(0, 4)" :key="fe.cloudId || fe.id" class="journal-item">
            <div class="journal-item-meta">
              <span>{{ fe.ownerNickname }}</span>
              <span>{{ formatJournalDate(fe.dateOfJournal) }}</span>
            </div>
            <p>{{ (fe.previewText || fe.text || '').replace(/<[^>]*>/g, '').slice(0, 72) || '分享了一篇日记' }}</p>
          </li>
        </ul>

        <div class="journal-filter-row" style="margin-top:6px">
          <strong style="font-size:12.5px">🕰️ 那年今日 / 近期回忆</strong>
        </div>
        <ul class="journal-list">
          <li v-if="!onThisDayEntries.length" class="journal-empty">暂无本机日记记录。</li>
          <li v-for="item in onThisDayEntries" :key="item.id ?? item.cloudId" class="journal-item" role="button" tabindex="0" @click="tvOpen = false; openJournalEditor(item)">
            <div class="journal-item-meta">
              <span>{{ formatJournalDate(item.dateOfJournal) }}</span>
              <JrIcon v-if="item.favourite" :path="mdiStar" :size="14" class="journal-item-star" />
            </div>
            <p>{{ item.previewText || '（空白日记）' }}</p>
          </li>
        </ul>
      </aside>

      <aside v-if="galleryOpen" class="house-journal-drawer house-hud" aria-label="客厅照片墙 · 真实相册">
        <div class="journal-drawer-head">
          <div>
            <strong>🖼️ 客厅照片墙</strong>
            <small>来自你的真实日记相册（点击直达所属日记）</small>
          </div>
          <button type="button" class="journal-close" aria-label="关闭照片墙" @click="galleryOpen = false; focusScene()">
            <JrIcon :path="mdiClose" :size="18" />
          </button>
        </div>
        <div v-if="!galleryPhotos.length" class="journal-empty" style="padding:20px 8px">
          还没有日记照片，写日记时插入图片就会自动挂上照片墙。
        </div>
        <div v-else class="house-photo-grid">
          <button
            v-for="photo in galleryPhotos"
            :key="photo.id"
            type="button"
            class="house-photo-card"
            @click="galleryOpen = false; openJournalEditor(entries.find(e => e.id === photo.jId))"
          >
            <img v-if="photo.url" :src="photo.url" :alt="photo.fileName" />
            <span>{{ photo.dateLabel || photo.fileName }}</span>
          </button>
        </div>
        <nav class="journal-quick-links" aria-label="相册入口">
          <NuxtLink to="/media">打开完整相册</NuxtLink>
          <NuxtLink to="/atlas">足迹地图</NuxtLink>
        </nav>
      </aside>
      <p id="house-controls" class="sr-only">
        W A S D 移动，拖动或移动鼠标看四周，E 交互，1 2 切换视角，M 开关小地图，P 拍明信片
      </p>
    </template>
    <p v-if="alertText" class="house-alert house-hud" role="alert">{{ alertText }}</p>

    <dialog ref="help" class="house-help house-hud" aria-labelledby="house-help-title" @close="focusScene">
      <h2 id="house-help-title">怎么在小家走动</h2>
      <dl>
        <dt>移动</dt><dd><kbd>W</kbd> <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd> 或方向键</dd>
        <dt>看四周</dt><dd>窗口内拖动鼠标，第一人称全屏后直接移动鼠标。<kbd>Esc</kbd> 释放鼠标。</dd>
        <dt>互动</dt><dd>靠近门、灯具、沙发/床铺、电视、咖啡机、水龙头、冰箱、微波炉、浴缸、工作台、望远镜或宠物食盆后，按 <kbd>E</kbd> 或点击提示即可互动；靠近小柴还能摸摸它。</dd>
        <dt>上下楼</dt><dd>走进楼梯的对应一侧，到半层平台后折返。也能在小地图切楼层。</dd>
        <dt>视角与功能</dt><dd><kbd>1</kbd>/<kbd>2</kbd> 或 <kbd>V</kbd> 切视角，<kbd>M</kbd> 开关小地图，<kbd>P</kbd> 拍下当前小家明信片。</dd>
      </dl>
      <form method="dialog"><button type="submit">回到小家</button></form>
    </dialog>
    <dialog ref="sensitivityDialog" class="house-help house-hud" aria-labelledby="house-sensitivity-title">
      <h2 id="house-sensitivity-title">鼠标灵敏度</h2>
      <div class="house-sensitivity-label">
        <label for="house-sensitivity-range">转向速度</label>
        <output for="house-sensitivity-range">{{ sensitivity }}%</output>
      </div>
      <input id="house-sensitivity-range" v-model.number="sensitivity" class="house-sensitivity-range" type="range"
        :min="sensitivityMin" :max="sensitivityMax" :step="sensitivityStep" :aria-valuetext="sensitivity + '%'" autofocus />
      <div class="house-sensitivity-scale" aria-hidden="true"><span>慢</span><span>快</span></div>
      <form @submit.prevent="finishSensitivity"><button type="submit">继续漫游</button></form>
    </dialog>

    <EntryEditor
      v-if="editorOpen"
      :entry-id="editingEntry?.id"
      :initial-text="editingEntry?.text"
      :initial-date="editingEntry?.dateOfJournal"
      :initial-meta="editingEntry ?? undefined"
      @done="onEditorDone"
    />
  </main>
</template>

<style scoped>
.house-stage {
  --house-panel: rgba(255, 255, 255, 0.80);
  --house-control: #edf2ee;
  --house-text: #223228;
  --house-accent: #2b513e;
  --house-line: rgba(255, 255, 255, 0.72);
  position: relative; width: 100%; height: 100%; min-width: 0; overflow: hidden; isolation: isolate;
  background: #dce3e1; color: var(--house-text);
}
.sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); border: 0; }
.house-canvas { width: 100%; height: 100%; display: block; touch-action: none; cursor: grab; }
.house-canvas:active { cursor: grabbing; }
.house-canvas.mouse-locked { cursor: none; }
.house-canvas:focus { outline: none; }
.house-canvas:focus-visible { box-shadow: inset 0 0 0 2px #526b57; }
.house-stage :is(button, a):focus-visible { outline: 2px solid #2b513e; outline-offset: 2px; }
.house-stage button, .house-stage a { color: inherit; font: inherit; text-decoration: none; cursor: pointer; }
.house-stage button:disabled { opacity: .55; cursor: default; }
.house-hud { background: var(--house-panel); border: 1px solid var(--house-line); color: var(--house-text); box-shadow: 0 8px 28px rgba(24, 38, 30, 0.10); backdrop-filter: blur(16px); }
.house-top { position: absolute; inset: 20px 22px auto; display: grid; grid-template-columns: 1fr auto 1fr; align-items: start; gap: 14px; pointer-events: none; z-index: 4; }
.house-top > * { pointer-events: auto; }
.house-brand { display: flex; align-items: center; gap: 10px; width: max-content; padding: 8px 12px 8px 8px; border-radius: 16px; }
.house-brand-icon { width: 38px; height: 38px; border-radius: 10px; display: grid; place-items: center; color: #ffffff; background: var(--house-accent); }
.house-brand strong { display: flex; align-items: center; gap: 6px; font-size: 1.02rem; line-height: 1.15; font-weight: 650; }
.house-brand-tag { font-style: normal; font-size: .68rem; font-weight: 500; color: #54665b; }
.house-brand small { display: block; margin-top: 3px; color: #5c6d62; font-size: .71rem; }
.house-back-icon { margin-left: 4px; opacity: .68; }
.house-brand:hover { background: rgba(255, 255, 255, 0.92); }
.house-mode { display: flex; gap: 4px; padding: 4px; border-radius: 14px; }
.house-toolbar-wrap { position: relative; justify-self: end; display: flex; flex-direction: column; align-items: flex-end; gap: 8px; }
.house-toolbar { display: flex; gap: 4px; padding: 4px; border-radius: 14px; }
.house-mode button, .house-toolbar button { display: inline-flex; justify-content: center; align-items: center; gap: 6px; min-height: 38px; border: 0; border-radius: 10px; background: transparent; white-space: nowrap; }
.house-mode button { padding: 0 15px; font-size: .85rem; font-weight: 550; }
.house-toolbar button { width: 38px; padding: 0; color: #36493d; }
.house-mode button:hover, .house-toolbar button:hover { background: #e4ede6; }
.house-mode button[aria-pressed="true"] { background: var(--house-accent); color: #ffffff; }
.house-mode .mode-key { min-width: 17px; min-height: 17px; font-size: .66rem; margin-left: 1px; opacity: .82; }
.house-mode button[aria-pressed="true"] .mode-key { background: rgba(255, 255, 255, 0.22); border-color: rgba(255, 255, 255, 0.34); color: #ffffff; }
.house-toolbar button[aria-pressed="true"] { background: #dcebe0; color: #224432; }
.house-tools-menu { display: grid; gap: 3px; min-width: 176px; padding: 6px; border-radius: 14px; }
.house-tools-menu button { display: flex; align-items: center; gap: 9px; width: 100%; padding: 8px 10px; border: 0; border-radius: 9px; background: transparent; font-size: .80rem; text-align: left; }
.house-tools-menu button:hover { background: #e6efe8; }
.house-tools-menu button[aria-pressed="true"] { background: #dcebe0; color: #224432; font-weight: 600; }
.house-active-props { position: absolute; top: 88px; left: 22px; max-width: min(320px, calc(50vw - 90px)); padding: 5px 12px; border-radius: 999px; font-size: .73rem; color: #354b3d; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; pointer-events: none; }
.house-reticle { position: absolute; top: 50%; left: 50%; width: 6px; height: 6px; transform: translate(-50%, -50%); border-radius: 50%; background: #ffffff; box-shadow: 0 0 0 1.5px rgba(43, 81, 62, 0.55), 0 0 6px rgba(0, 0, 0, 0.25); pointer-events: none; }
.house-map-wrap { position: absolute; left: 22px; bottom: 20px; z-index: 3; }
.house-pet { position: absolute; right: 22px; bottom: 20px; z-index: 3; display: flex; align-items: center; gap: 14px; padding: 10px 12px 10px 14px; border-radius: 16px; }
.house-pet-info { display: flex; align-items: center; gap: 9px; }
.house-pet-icon { color: #365945; flex: none; }
.house-pet strong { display: block; font-size: .82rem; font-weight: 650; line-height: 1.2; color: #233329; }
.house-pet small { display: block; font-size: .71rem; color: #5b6c61; margin-top: 3px; }
.house-pet button { padding: 7px 14px; border: 0; border-radius: 10px; background: #e2eee5; color: #2b513e; font-size: .78rem; font-weight: 650; white-space: nowrap; }
.house-pet button:hover { background: #d4e6d9; }
.house-stage kbd { display: inline-grid; min-width: 20px; min-height: 20px; place-items: center; padding: 0 4px; border-radius: 5px; border: 1px solid #b7c3b9; background: #ffffff; font: 700 .72rem var(--jr-font); color: #2b513e; }
.house-stage .house-interaction { position: absolute; bottom: 24px; left: 50%; transform: translateX(-50%); z-index: 3; min-height: 44px; display: flex; align-items: center; gap: 9px; border-radius: 12px; padding: 7px 15px 7px 10px; color: var(--house-text); font-size: .87rem; font-weight: 550; white-space: nowrap; }
.house-action-toast { position: absolute; top: 82px; left: 50%; transform: translateX(-50%); z-index: 3; margin: 0; border-radius: 10px; padding: 7px 15px; background: rgba(34, 52, 42, 0.88); color: #ffffff; box-shadow: 0 6px 20px rgba(0, 0, 0, 0.16); backdrop-filter: blur(12px); font-size: .80rem; font-weight: 550; pointer-events: none; white-space: nowrap; }
.house-interaction:hover { background: rgba(255, 255, 255, 0.94); }
.house-interaction kbd { min-width: 24px; min-height: 24px; border-radius: 6px; color: #ffffff; background: var(--house-accent); border: 0; }
.house-journal-drawer {
  position: absolute; top: 76px; right: 22px; bottom: 92px; width: min(350px, calc(100vw - 44px));
  z-index: 5; display: flex; flex-direction: column; gap: 10px; padding: 15px; border-radius: 18px;
}
.journal-drawer-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.journal-drawer-head strong { display: block; font-size: .96rem; font-weight: 650; }
.journal-drawer-head small { display: block; font-size: .72rem; color: #5b6c61; margin-top: 2px; }
.journal-close { width: 32px; height: 32px; border: 0; border-radius: 9px; display: grid; place-items: center; background: transparent; }
.journal-close:hover { background: #e3ece5; }
.journal-compose { display: grid; gap: 8px; padding: 10px; border-radius: 12px; background: rgba(255, 255, 255, 0.72); border: 1px solid rgba(43, 81, 62, 0.12); }
.journal-compose textarea { width: 100%; resize: none; border: 0; background: transparent; font: inherit; font-size: .82rem; color: var(--house-text); outline: none; }
.journal-compose-bar { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
.journal-compose-actions { display: flex; align-items: center; gap: 6px; }
.journal-item[role="button"] { cursor: pointer; }
.journal-item[role="button"]:hover { border-color: rgba(43, 81, 62, 0.34); background: rgba(255, 255, 255, 0.94); }
.journal-star-btn, .journal-save-btn { display: inline-flex; align-items: center; gap: 4px; border: 0; border-radius: 8px; padding: 5px 10px; font-size: .76rem; font-weight: 600; }
.journal-star-btn { background: #edf2ee; color: #475a4e; }
.journal-star-btn[aria-pressed="true"] { background: #fdf0d2; color: #996615; }
.journal-save-btn { background: var(--house-accent); color: #ffffff; }
.journal-filter-row { display: flex; gap: 6px; align-items: center; }
.journal-filter-row input { flex: 1; min-width: 0; border: 1px solid rgba(43, 81, 62, 0.18); border-radius: 9px; padding: 6px 10px; font: inherit; font-size: .78rem; background: rgba(255, 255, 255, 0.78); color: var(--house-text); }
.journal-filter-row button { border: 0; border-radius: 8px; padding: 6px 10px; font-size: .74rem; background: #e9efe9; color: #36493d; }
.journal-filter-row button[aria-pressed="true"] { background: var(--house-accent); color: #ffffff; font-weight: 600; }
.journal-list { flex: 1; min-height: 0; overflow-y: auto; margin: 0; padding: 0; list-style: none; display: grid; gap: 8px; align-content: start; }
.journal-empty { padding: 18px 10px; text-align: center; font-size: .78rem; color: #647469; }
.journal-item { padding: 10px 11px; border-radius: 12px; background: rgba(255, 255, 255, 0.76); border: 1px solid rgba(43, 81, 62, 0.08); }
.journal-item-meta { display: flex; justify-content: space-between; align-items: center; font-size: .70rem; color: #647469; margin-bottom: 4px; }
.journal-item-star { color: #d4962a; }
.journal-item p { margin: 0; font-size: .80rem; line-height: 1.45; color: #24332a; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
.journal-tags { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 6px; }
.journal-tags span { font-size: .68rem; padding: 1px 6px; border-radius: 999px; background: #e2eee5; color: #2b513e; }
.journal-quick-links { display: flex; justify-content: space-between; gap: 6px; padding-top: 4px; border-top: 1px solid rgba(43, 81, 62, 0.10); }
.journal-quick-links a { flex: 1; text-align: center; padding: 6px 4px; border-radius: 8px; font-size: .74rem; font-weight: 550; background: #edf3ee; color: #2b513e; }
.journal-quick-links a:hover { background: #dceae0; }
.house-photo-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; overflow-y: auto; padding: 4px 2px; max-height: 360px; }
.house-photo-card { display: flex; flex-direction: column; gap: 4px; padding: 6px; border-radius: 10px; border: 1px solid rgba(25, 40, 35, .1); background: #fff; text-align: left; cursor: pointer; }
.house-photo-card:hover { border-color: #3f8a80; }
.house-photo-card img { width: 100%; height: 92px; object-fit: cover; border-radius: 6px; }
.house-photo-card span { font-size: 11px; color: #53645e; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.house-diy-dock { position: absolute; left: 50%; bottom: 18px; transform: translateX(-50%); width: min(860px, calc(100% - 36px)); z-index: 16; padding: 12px 14px; border-radius: 18px; display: flex; flex-direction: column; gap: 10px; }
.diy-float-bar { position: absolute; bottom: calc(100% + 10px); left: 50%; transform: translateX(-50%); display: flex; align-items: center; gap: 12px; padding: 8px 14px; border-radius: 999px; background: rgba(24, 34, 30, .90); color: #fff; font-size: 12.5px; white-space: nowrap; box-shadow: 0 8px 24px rgba(0, 0, 0, .18); }
.diy-float-bar.invalid { background: rgba(185, 28, 28, .92); }
.diy-float-actions { display: flex; gap: 6px; }
.diy-float-actions button { display: inline-flex; align-items: center; gap: 4px; border: 0; border-radius: 999px; padding: 4px 10px; font-size: 12px; font-weight: 600; background: rgba(255, 255, 255, .18); color: #fff; cursor: pointer; }
.diy-float-actions button.danger { background: rgba(239, 68, 68, .85); }
.diy-dock-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap; }
.diy-tabs, .diy-floor-pills, .diy-head-tools, .diy-cat-row { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.diy-tabs button, .diy-floor-pills button, .diy-head-tools button, .diy-cat-row button { display: inline-flex; align-items: center; gap: 4px; border: 0; border-radius: 9px; padding: 5px 10px; font-size: 12px; font-weight: 600; background: rgba(43, 81, 62, .08); color: #2b4437; cursor: pointer; }
.diy-tabs button[aria-pressed="true"], .diy-floor-pills button[aria-pressed="true"], .diy-cat-row button[aria-pressed="true"] { background: var(--house-accent); color: #fff; }
.diy-head-tools button:disabled { opacity: .45; cursor: default; }
.diy-panel { display: flex; flex-direction: column; gap: 8px; }
.diy-catalog-scroll { display: flex; gap: 8px; overflow-x: auto; padding-bottom: 4px; }
.diy-item-card { flex: 0 0 92px; display: flex; flex-direction: column; align-items: center; gap: 3px; padding: 8px 6px; border-radius: 12px; border: 1.5px solid rgba(43, 81, 62, .12); background: rgba(255, 255, 255, .82); color: #24332a; cursor: pointer; }
.diy-item-card:hover, .diy-item-card.active { border-color: var(--house-accent); background: #eef6f1; }
.diy-item-emoji { font-size: 20px; line-height: 1.2; }
.diy-item-card strong { font-size: 11.5px; text-align: center; }
.diy-item-card small { font-size: 10.5px; color: #647469; }
.diy-materials-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
.diy-mat-title { font-size: 11.5px; font-weight: 700; color: #516258; margin-bottom: 6px; }
.diy-mat-row, .diy-placed-chips { display: flex; flex-wrap: wrap; gap: 6px; }
.diy-mat-chip { display: inline-flex; align-items: center; gap: 6px; border: 1.5px solid rgba(43, 81, 62, .14); border-radius: 999px; padding: 5px 10px; font-size: 12px; background: rgba(255, 255, 255, .82); color: #24332a; cursor: pointer; }
.diy-mat-chip.active { border-color: var(--house-accent); background: #e8f3ec; font-weight: 600; }
.diy-mat-chip.danger { color: #b91c1c; border-color: rgba(185, 28, 28, .28); }
.diy-mat-swatch { width: 14px; height: 14px; border-radius: 50%; border: 1px solid rgba(0, 0, 0, .18); }
.diy-empty { margin: 4px 0; font-size: 12.5px; color: #647469; }
.house-cover { position: absolute; inset: 0; display: grid; place-content: center; text-align: center; padding: 18px; }
.house-cover button, .house-help form button { border: 0; border-radius: 8px; padding: 9px 14px; background: var(--house-accent); color: #fffdf5; justify-self: center; }
.house-alert { position: absolute; top: 83px; right: 22px; border-radius: 8px; padding: 10px; }
.house-help { width: min(460px, calc(100% - 28px)); padding: 23px; border-radius: 15px; }
.house-help::backdrop { background: #283b2e6e; }
.house-help h2 { margin: 0 0 18px; font-size: 1.17rem; }
.house-help dl { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 11px 12px; line-height: 1.45; font-size: .88rem; }
.house-help dt { font-weight: 620; }
.house-help dd { margin: 0; }
.house-help form { margin-top: 20px; display: flex; justify-content: flex-end; }
.house-sensitivity-label, .house-sensitivity-scale { display: flex; justify-content: space-between; gap: 12px; font-size: .88rem; }
.house-sensitivity-label output { font-variant-numeric: tabular-nums; font-weight: 650; }
.house-sensitivity-range { display: block; width: 100%; min-height: 36px; margin: 5px 0 0; accent-color: var(--house-accent); }
.house-sensitivity-scale { color: #536055; }
.house-desktop-only { margin: 0; min-height: 100%; display: grid; place-content: center; justify-items: center; padding: 16px; background: var(--jr-bg); color: var(--jr-on-bg); text-align: center; }
.house-desktop-only h1 { margin: 8px 0 2px; }
.house-desktop-only a { color: var(--jr-primary); }
@media (max-width: 940px) {
  .house-top { inset-inline: 12px; }
  .house-toolbar button { width: 34px; }
  .house-mode button { padding: 0 8px; }
  .house-back-icon { display: none; }
}
@media (max-width: 720px) {
  .house-top { grid-template-columns: auto auto; justify-content: space-between; }
  .house-mode { grid-row: 2; grid-column: 1 / -1; justify-self: center; }
  .house-location { top: 151px; }
}
</style>
