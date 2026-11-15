<script setup lang="ts">
import {
  mdiArrowLeft, mdiCubeOutline, mdiDoorOpen, mdiDownload, mdiFullscreen, mdiFullscreenExit,
  mdiHelpCircleOutline, mdiHomeOutline, mdiLightbulbOutline, mdiMapOutline, mdiMoonWaningCrescent,
  mdiMouse, mdiPaw, mdiRestore, mdiTune, mdiWalk,
} from '@mdi/js'
import furnitureUrl from '~/assets/family-house/furniture.glb?url'
import { houseLevels, houseStops, porch, stairStops, type HouseStop } from '~/utils/familyHouseLayout'
import type { createFamilyHouseScene, HouseFloor, HouseHint, HousePetState, HousePosition, HouseView } from '~/utils/familyHouseScene'

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
const mapOpen = ref(true)
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
const petState = shallowRef<HousePetState>({ floor: 0, moving: true, called: false })
const petStatusText = computed(() => {
  const floorName = houseLevels[petState.value.floor] ?? '一楼'
  if (petState.value.called) return `小柴正跑向${floorName}`
  return petState.value.moving ? `小柴在${floorName}散步` : `小柴在${floorName}发呆`
})
const exporting = ref(false)
const alertText = ref('')
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
    })
    if (attempt.signal.aborted) { result.dispose(); return }
    game = result
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
  game?.setView(mode, mode === 'overview' ? overviewFloor.value : position.value.floor, outside.value)
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
  game?.setView('overview', value, outside.value)
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
  if (event.code === 'KeyV') changeView(view.value === 'walk' ? 'overview' : 'walk')
  if (event.code === 'KeyM') mapOpen.value = !mapOpen.value
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
        <span><strong>回家</strong><small>我们的小家</small></span>
        <JrIcon class="house-back-icon" :path="mdiArrowLeft" :size="16" />
      </NuxtLink>

      <div v-if="status === 'ready'" class="house-mode house-hud" role="group" aria-label="浏览视角">
        <button type="button" :aria-pressed="view === 'walk'" @click="changeView('walk')">
          <JrIcon :path="mdiWalk" :size="17" /> 第一人称
        </button>
        <button type="button" :aria-pressed="view === 'overview'" @click="changeView('overview')">
          <JrIcon :path="mdiCubeOutline" :size="17" /> 全屋视角
        </button>
      </div>

      <div v-if="status === 'ready'" class="house-toolbar house-hud" role="group" aria-label="场景工具">
        <button v-if="view === 'overview'" type="button" :aria-pressed="outside" aria-label="显示完整外观" title="显示完整外观" @click="toggleOutside">
          <JrIcon :path="mdiHomeOutline" :size="21" />
        </button>
        <button v-if="view === 'overview'" type="button" aria-label="重置全景视角" title="重置全景视角" @click="game?.resetOrbit()">
          <JrIcon :path="mdiRestore" :size="20" />
        </button>
        <button v-if="view === 'walk'" type="button" :aria-pressed="mouseLocked" aria-label="鼠标自由转视角" title="鼠标自由转视角 · Esc 退出"
          @click="mouseLocked ? game?.releaseLook() : game?.lockLook()"><JrIcon :path="mdiMouse" :size="20" /></button>
        <button type="button" :aria-pressed="lit" aria-label="室内暖灯" title="室内暖灯" @click="toggleLamps"><JrIcon :path="mdiLightbulbOutline" :size="21" /></button>
        <button type="button" :aria-pressed="evening" aria-label="夜景" title="夜景" @click="toggleEvening"><JrIcon :path="mdiMoonWaningCrescent" :size="19" /></button>
        <button type="button" :aria-pressed="mapOpen" aria-label="小地图" title="小地图 · M" @click="mapOpen = !mapOpen"><JrIcon :path="mdiMapOutline" :size="21" /></button>
        <button type="button" aria-label="按键说明" title="按键说明" @click="showHelp"><JrIcon :path="mdiHelpCircleOutline" :size="21" /></button>
        <button type="button" :aria-label="fullscreen ? '退出全屏' : '全屏'" :title="fullscreen ? '退出全屏' : '全屏'" @click="toggleFullscreen">
          <JrIcon :path="fullscreen ? mdiFullscreenExit : mdiFullscreen" :size="23" />
        </button>
      </div>
    </header>

    <template v-if="status === 'ready'">
      <div v-if="view === 'walk'" class="house-location" aria-live="polite">
        {{ houseLevels[position.floor] }} · {{ actualRoom }}
      </div>
      <div v-if="view === 'walk'" class="house-reticle" aria-hidden="true" />
      <FamilyHouseMap v-if="mapOpen" class="house-map-wrap house-hud" :floor="mapFloor" :room="room" :position="position" :view="view"
        @floor="selectFloor" @visit="visit" @hide="mapOpen = false; focusScene()" />
      <button v-if="view === 'walk' && hint" type="button" class="house-interaction house-hud" :aria-label="hint.label" aria-keyshortcuts="E" @click="game?.interact(); focusScene()">
        <kbd>E</kbd><JrIcon :path="hint.kind === 'door' ? mdiDoorOpen : hint.kind === 'pet' ? mdiPaw : mdiLightbulbOutline" :size="18" />{{ hint.label }}
      </button>
      <aside class="house-pet house-hud" aria-label="家里的小伙伴">
        <div class="house-pet-info">
          <JrIcon :path="mdiPaw" :size="17" class="house-pet-icon" />
          <div>
            <strong>家里的小伙伴</strong>
            <small>{{ petStatusText }}</small>
          </div>
        </div>
        <button type="button" @click="game?.callPet(); if (view === 'walk') focusScene()">叫过来</button>
      </aside>
      <footer class="house-footer house-hud">
        <p id="house-controls">
          <template v-if="view === 'walk'">
            <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> 移动
            <span class="house-divider" />
            <template v-if="mouseLocked">移动鼠标看四周 <span class="house-divider" /><kbd>Esc</kbd> 释放鼠标</template>
            <template v-else>{{ fullscreen ? '点击画面恢复鼠标转向' : '拖动看四周' }}</template>
            <span class="house-divider" /><kbd>E</kbd> 交互
            <template v-if="fullscreen && mouseLocked"><span class="house-divider" /><kbd>−</kbd><kbd>+</kbd> 调灵敏度</template>
          </template>
          <template v-else>拖动旋转 <span class="house-divider" /> 滚轮缩放</template>
        </p>
        <div class="house-footer-actions">
          <button v-if="fullscreen && view === 'walk'" type="button" aria-haspopup="dialog" @click="openSensitivity">
            <JrIcon :path="mdiTune" :size="18" /> 鼠标灵敏度 {{ sensitivity }}%
          </button>
          <button type="button" :disabled="exporting" @click="download">
            <JrIcon :path="mdiDownload" :size="18" /> {{ exporting ? '导出中' : '下载模型' }}
          </button>
        </div>
      </footer>
    </template>
    <p v-if="alertText" class="house-alert house-hud" role="alert">{{ alertText }}</p>

    <dialog ref="help" class="house-help house-hud" aria-labelledby="house-help-title" @close="focusScene">
      <h2 id="house-help-title">怎么在小家走动</h2>
      <dl>
        <dt>移动</dt><dd><kbd>W</kbd> <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd> 或方向键</dd>
        <dt>看四周</dt><dd>窗口内拖动鼠标，第一人称全屏后直接移动鼠标。<kbd>Esc</kbd> 释放鼠标。</dd>
        <dt>互动</dt><dd>靠近门或台灯后，按 <kbd>E</kbd> 或点击提示。</dd>
        <dt>上下楼</dt><dd>走进楼梯的对应一侧，到半层平台后折返。也能在小地图切楼层。</dd>
        <dt>视角与地图</dt><dd><kbd>V</kbd> 切视角，<kbd>M</kbd> 显示或收起小地图。</dd>
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
  </main>
</template>

<style scoped>
.house-stage {
  --house-panel: #faf8efd9;
  --house-control: #eeeee3;
  --house-text: #29372e;
  --house-accent: #42634e;
  --house-line: #fffdf3a6;
  position: relative; width: 100%; height: 100%; min-width: 0; overflow: hidden; isolation: isolate;
  background: #e9e4da; color: var(--house-text);
}
.house-canvas { width: 100%; height: 100%; display: block; touch-action: none; cursor: grab; }
.house-canvas:active { cursor: grabbing; }
.house-canvas.mouse-locked { cursor: none; }
.house-canvas:focus { outline: none; }
.house-canvas:focus-visible { box-shadow: inset 0 0 0 2px #526b57; }
.house-stage :is(button, a):focus-visible { outline: 2px solid #355b44; outline-offset: 2px; }
.house-stage button, .house-stage a { color: inherit; font: inherit; text-decoration: none; cursor: pointer; }
.house-stage button:disabled { opacity: .55; cursor: default; }
.house-hud { background: var(--house-panel); border: 1px solid var(--house-line); color: var(--house-text); box-shadow: 0 4px 15px #24382b22; backdrop-filter: blur(12px); }
.house-top { position: absolute; inset: 22px 22px auto; display: grid; grid-template-columns: 1fr auto 1fr; align-items: start; gap: 14px; pointer-events: none; }
.house-top > * { pointer-events: auto; }
.house-brand { display: flex; align-items: center; gap: 9px; width: max-content; padding: 7px 10px 7px 7px; border-radius: 12px; }
.house-brand-icon { width: 38px; height: 38px; border-radius: 8px; display: grid; place-items: center; color: #fffff3; background: var(--house-accent); }
.house-brand strong { display: block; font-size: 1.04rem; line-height: 1.15; }
.house-brand small { display: block; margin-top: 4px; color: #536055; font-size: .69rem; }
.house-back-icon { margin-left: 5px; }
.house-brand:hover { background: #fffcf4; }
.house-mode, .house-toolbar { display: flex; gap: 3px; padding: 4px; border-radius: 12px; }
.house-toolbar { justify-self: end; flex-wrap: wrap; justify-content: end; }
.house-mode button, .house-toolbar button, .house-footer button { display: inline-flex; justify-content: center; align-items: center; gap: 5px; min-height: 42px; border: 0; border-radius: 8px; background: transparent; white-space: nowrap; }
.house-mode button { padding: 0 16px; font-size: .87rem; }
.house-toolbar button { width: 41px; padding: 0; }
.house-mode button:hover, .house-toolbar button:hover, .house-footer button:hover { background: #e4ebe0; }
.house-mode button[aria-pressed="true"] { background: var(--house-accent); color: #fffdf6; }
.house-toolbar button[aria-pressed="true"] { background: #dce9dc; color: #294533; }
.house-location { position: absolute; top: 89px; left: 50%; transform: translateX(-50%); padding: 7px 13px; background: #2c4839f0; color: #fffdf4; border-radius: 8px; font-size: .8rem; white-space: nowrap; pointer-events: none; }
.house-reticle { position: absolute; top: 50%; left: 50%; width: 6px; height: 6px; transform: translate(-50%, -50%); border-radius: 50%; background: #fffef0; box-shadow: 0 0 0 1px #36503b88, 0 0 4px #29352e5e; pointer-events: none; }
.house-map-wrap { position: absolute; left: 22px; bottom: 88px; }
.house-pet { position: absolute; right: 22px; bottom: 88px; display: flex; align-items: center; gap: 12px; padding: 8px 10px 8px 12px; border-radius: 12px; }
.house-pet-info { display: flex; align-items: center; gap: 8px; }
.house-pet-icon { color: #b67641; flex: none; }
.house-pet strong { display: block; font-size: .78rem; line-height: 1.2; }
.house-pet small { display: block; font-size: .70rem; color: #536055; margin-top: 2px; }
.house-pet button { padding: 5px 10px; border: 0; border-radius: 8px; background: var(--house-accent); color: #fffdf6; font-size: .76rem; white-space: nowrap; }
.house-pet button:hover { filter: brightness(1.07); }
.house-footer { position: absolute; bottom: 22px; left: 22px; right: 22px; display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 4px 8px 4px 13px; border-radius: 12px; }
.house-footer p { min-width: 0; margin: 0; display: flex; flex-wrap: wrap; align-items: center; gap: 5px; font-size: .77rem; color: #465447; }
.house-footer button { padding: 0 9px; font-size: .8rem; }
.house-footer-actions { display: flex; flex: none; gap: 4px; }
.house-divider { height: 17px; width: 1px; margin: 0 6px; background: #89968760; }
.house-stage kbd { display: inline-grid; min-width: 20px; min-height: 20px; place-items: center; padding: 0 3px; border-radius: 4px; border: 1px solid #b7c1b2; background: #fcfbf4; font: 700 .72rem var(--jr-font); color: #334f3e; }
.house-stage .house-interaction { position: absolute; bottom: 14%; left: 50%; transform: translateX(-50%); min-height: 45px; display: flex; align-items: center; gap: 8px; border-radius: 10px; padding: 6px 11px; color: var(--house-text); font-size: .87rem; white-space: nowrap; }
.house-interaction:hover { background: #fffcf4; }
.house-interaction kbd { color: #fffdf7; background: var(--house-accent); border: 0; }
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
