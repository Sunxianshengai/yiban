<script setup lang="ts">
/**
 * 桌宠页：瞌睡小羊（Electron 透明覆盖层 / 浏览器预览共用）。
 *
 * 两种打开方式：
 * - `/pet?desktop=1`：被 Electron 覆盖层窗口加载。整页透明、只有小羊和气泡收事件，
 *   并把可点区域坐标上报给主进程，由它轮询鼠标位置切换「点得穿」。
 * - `/pet`：浏览器里看效果，给一层淡淡的背景和说明。
 *
 * 这里不承载聊天（那在 /pal）。桌宠只负责「在场」：打盹、被叫醒、说自己今天记了几笔、
 * 双击进日记、右键菜单。
 *
 * 数据全部来自同一个 IndexedDB（JourneyDB），所以不需要联网。
 */
import { mdiPencilOutline, mdiBookOpenPageVariantOutline, mdiCloudSyncOutline, mdiSleep, mdiClose } from '@mdi/js'
import type { EntryV2 } from '~/utils/db'

interface PetBridge {
  ready(): void
  hitRegions(rects: { x: number; y: number; width: number; height: number }[]): void
  openMain(path?: string): void
  hide(): void
  quit(): void
  dragStart(): void
  dragEnd(): void
}
const bridge = (window as Window & { yibanPet?: PetBridge }).yibanPet
const isDesktop = computed(() => !!bridge || new URLSearchParams(location.search).get('desktop') === '1')

// ---- 小羊状态 ----
type Stage = 'idle' | 'thinking' | 'awake'
const stage = ref<Stage>('idle')
const videos: Record<Stage, string> = {
  idle: '/pet/pet-idle.webm',
  thinking: '/pet/pet-think.webm',
  awake: '/pet/pet-awake.webm',
}
const poster = '/pet/pet-poster.webp'
const videoBroken = ref(false)
let awakeTimer: ReturnType<typeof setTimeout> | undefined
let idleTimer: ReturnType<typeof setTimeout> | undefined

/** 叫醒：切 awake，4.5 秒后自己回去打盹。 */
function wake(ms = 4500) {
  stage.value = 'awake'
  clearTimeout(awakeTimer)
  awakeTimer = setTimeout(() => { stage.value = 'idle'; scheduleNap() }, ms)
}
/** 一会儿随机切一次 thinking，让它看起来在「走神」。 */
function scheduleNap() {
  clearTimeout(idleTimer)
  idleTimer = setTimeout(() => {
    if (stage.value === 'idle') {
      stage.value = 'thinking'
      setTimeout(() => { if (stage.value === 'thinking') stage.value = 'idle' }, 2600)
    }
    scheduleNap()
  }, 22000 + Math.random() * 26000)
}

// ---- 今日进度（读本地库） ----
const { entries, refresh } = useEntries()
const todayCount = ref<number | null>(null)
const lastAt = ref<string>('')
async function loadToday() {
  try {
    await refresh()
    const now = new Date()
    const same = (entries.value as EntryV2[]).filter((e) => {
      const d = new Date(e.dateOfJournal)
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate()
    })
    todayCount.value = same.length
    if (same.length) {
      const latest = same.reduce((a, b) => (new Date(a.dateModified) > new Date(b.dateModified) ? a : b))
      const t = new Date((latest as EntryV2).dateModified)
      lastAt.value = `${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}`
    }
  } catch {
    todayCount.value = null
  }
}

// ---- 气泡 ----
const bubble = ref('')
let bubbleTimer: ReturnType<typeof setTimeout> | undefined
function say(text: string, ms = 5200) {
  bubble.value = text
  clearTimeout(bubbleTimer)
  bubbleTimer = setTimeout(() => { bubble.value = '' }, ms)
}
function todayLine() {
  if (todayCount.value === null) return '日记本还没打开，点两下叫我进去看看？'
  if (!todayCount.value) return '今天还一笔没记呢，要不要说一句给我？'
  return `今天记了 ${todayCount.value} 笔${lastAt.value ? `，最近一次是 ${lastAt.value}` : ''}。`
}

// ---- 拖动 ----
const pos = ref({ x: 0, y: 0 })
const POS_KEY = 'jr.petPos'
/** 没存过位置时贴右下角——桌宠该待在角落，不该压在人脸正中间。 */
function defaultPos() {
  const w = 195
  const h = 263
  return {
    x: Math.max(24, window.innerWidth - w - 56),
    y: Math.max(24, window.innerHeight - h - 72),
  }
}
function loadPos() {
  try {
    const raw = localStorage.getItem(POS_KEY)
    if (raw) {
      const p = JSON.parse(raw)
      if (typeof p.x === 'number' && typeof p.y === 'number') {
        pos.value = p
        return
      }
    }
  } catch { /* 坏数据就当没存过 */ }
  pos.value = defaultPos()
}
function savePos() {
  try { localStorage.setItem(POS_KEY, JSON.stringify(pos.value)) } catch { /* 隐私模式写不进去，忽略 */ }
}

let dragging = false
let dragOffset = { x: 0, y: 0 }
let moved = false
function onPointerDown(e: PointerEvent) {
  if (e.button !== 0) return
  dragging = true
  moved = false
  dragOffset = { x: e.clientX - pos.value.x, y: e.clientY - pos.value.y }
  // 合成事件里 pointerId 可能没有真实捕获目标，捕获失败不该让拖动整个失效
  try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId) } catch { /* 忽略 */ }
  bridge?.dragStart()
}
function onPointerMove(e: PointerEvent) {
  if (!dragging) return
  const next = { x: e.clientX - dragOffset.x, y: e.clientY - dragOffset.y }
  if (Math.abs(next.x - pos.value.x) + Math.abs(next.y - pos.value.y) > 3) moved = true
  pos.value = clamp(next)
}
/** 别让小羊被拖到屏幕外找不回来。 */
function clamp(p: { x: number, y: number }) {
  const w = 195
  const h = 263
  return {
    x: Math.min(Math.max(p.x, -w + 60), window.innerWidth - 60),
    y: Math.min(Math.max(p.y, -40), window.innerHeight - 60),
  }
}
function onPointerUp(e: PointerEvent) {
  if (!dragging) return
  dragging = false
  try { (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId) } catch { /* 忽略 */ }
  bridge?.dragEnd()
  if (moved) savePos()
}

// ---- 点击 / 双击 ----
let clickTimer: ReturnType<typeof setTimeout> | undefined
function onClick() {
  wake()
  clearTimeout(clickTimer)
  clickTimer = setTimeout(() => {
    void loadToday().then(() => say(todayLine()))
  }, 240)
}
function onDoubleClick() {
  clearTimeout(clickTimer)
  bubble.value = ''
  if (bridge) bridge.openMain('/')
  else location.assign('/')
}

// ---- 右键菜单 ----
const menuOpen = ref(false)
const menu = [
  { icon: mdiPencilOutline, label: '写一句', run: () => { bridge ? bridge.openMain('/') : location.assign('/') } },
  { icon: mdiBookOpenPageVariantOutline, label: '打开日记', run: () => { bridge ? bridge.openMain('/') : location.assign('/') } },
  { icon: mdiCloudSyncOutline, label: '全部同步', run: () => { bridge ? bridge.openMain('/cloud') : location.assign('/cloud') } },
  { icon: mdiSleep, label: '回去打盹', run: () => { menuOpen.value = false; stage.value = 'idle'; bubble.value = '' } },
  ...(bridge ? [{ icon: mdiClose, label: '不看了（隐藏）', run: () => bridge.hide() }] : []),
]
function onContextMenu(e: MouseEvent) {
  e.preventDefault()
  menuOpen.value = !menuOpen.value
  wake(6000)
}
function closeMenu() { menuOpen.value = false }

// ---- 给 Electron 上报可点区域 ----
let regionTimer: ReturnType<typeof setInterval> | undefined
function reportRegions() {
  if (!bridge) return
  const sel = '.jr-pet-hit, .jr-pet-bubble, .jr-pet-menu'
  const rects = [...document.querySelectorAll(sel)]
    .filter(el => (el as HTMLElement).getClientRects().length)
    .map((el) => {
      const r = el.getBoundingClientRect()
      return { x: r.x, y: r.y, width: r.width, height: r.height }
    })
  bridge.hitRegions(rects)
}

// 桌宠窗口里右键菜单由我们自己画，全局菜单要禁掉（离开页面时解绑，避免泄漏）
function blockNativeMenu(e: Event) { e.preventDefault() }
// 窗口尺寸变了要重算菜单翻面与贴边位置
function onResize() { viewportW.value = window.innerWidth; viewportH.value = window.innerHeight }

const viewportW = ref(0)
const viewportH = ref(0)

onMounted(async () => {
  // html/body 在 main.css 里默认是白底，桌宠窗口必须整页透明
  document.documentElement.classList.add('jr-pet-doc')
  viewportW.value = window.innerWidth
  viewportH.value = window.innerHeight
  loadPos()
  await loadToday()
  scheduleNap()
  bridge?.ready()
  if (bridge) regionTimer = setInterval(reportRegions, 120)
  document.addEventListener('contextmenu', blockNativeMenu)
  window.addEventListener('resize', onResize)
})
onBeforeUnmount(() => {
  document.documentElement.classList.remove('jr-pet-doc')
  clearTimeout(awakeTimer)
  clearTimeout(idleTimer)
  clearTimeout(bubbleTimer)
  clearTimeout(clickTimer)
  if (regionTimer) clearInterval(regionTimer)
  document.removeEventListener('contextmenu', blockNativeMenu)
  window.removeEventListener('resize', onResize)
})

const style = computed(() => ({
  transform: `translate3d(${pos.value.x}px, ${pos.value.y}px, 0)`,
}))
/**
 * 靠右边缘时菜单要往左展开，否则会被窗口裁掉一半。
 * 195 是小羊宽度，148 是菜单最小宽度。
 */
const menuFlip = computed(() => pos.value.x + 195 + 160 > (viewportW.value || 0))
</script>

<template>
  <div class="jr-pet-root" :class="{ desktop: isDesktop }" @pointerdown.self="closeMenu">
    <div class="jr-pet-anchor" :style="style">
      <Transition name="pet-bubble">
        <div v-if="bubble" class="jr-pet-bubble jr-pet-hit" @pointerdown.stop>
          {{ bubble }}
        </div>
      </Transition>

      <div
        class="jr-pet-hit jr-pet-lamb"
        :class="{ dragging, awake: stage !== 'idle' }"
        role="button"
        tabindex="0"
        aria-label="日记伙伴：瞌睡小羊"
        @pointerdown.stop="onPointerDown"
        @pointermove.stop="onPointerMove"
        @pointerup.stop="onPointerUp"
        @pointercancel.stop="onPointerUp"
        @click.stop="onClick"
        @dblclick.stop="onDoubleClick"
        @contextmenu.stop="onContextMenu"
        @keydown.enter.prevent="onClick"
        @keydown.space.prevent="onClick"
      >
        <img v-if="videoBroken" :src="poster" alt="" class="jr-pet-media" draggable="false">
        <video
          v-else
          :key="stage"
          class="jr-pet-media"
          :src="videos[stage]"
          loop
          muted
          playsinline
          autoplay
          preload="auto"
          disablepictureinpicture
          @error="videoBroken = true"
        />
      </div>

      <Transition name="pet-menu">
        <nav v-if="menuOpen" class="jr-pet-menu jr-pet-hit" :class="{ flip: menuFlip }" @pointerdown.stop>
          <button v-for="item in menu" :key="item.label" type="button" @click="item.run(); menuOpen = false">
            <JrIcon :path="item.icon" :size="16" />
            <span>{{ item.label }}</span>
          </button>
        </nav>
      </Transition>
    </div>

    <p v-if="!isDesktop" class="jr-pet-tip">
      桌宠预览 · 单击叫醒她说两句，双击进日记，右键有菜单，可以拖着走。<br>
      桌面版会把它贴到壁纸上，空白处鼠标能直接穿过去。
    </p>
  </div>
</template>

<style scoped>
/* 透明是这页的全部意义：Electron 覆盖层下不能有任何底色 */
.jr-pet-root {
  position: fixed;
  inset: 0;
  background: transparent;
  pointer-events: none;
  overflow: hidden;
  user-select: none;
  -webkit-user-select: none;
}
/* 浏览器预览：给一点背景，否则小羊在白底上没存在感 */
.jr-pet-root:not(.desktop) {
  background: radial-gradient(120% 90% at 70% 10%, #eef3f6 0%, #e7ecef 45%, #dfe6e2 100%);
}

.jr-pet-anchor {
  position: absolute;
  left: 0;
  top: 0;
  will-change: transform;
}

.jr-pet-lamb {
  position: relative;
  width: 195px;
  height: 263px;
  pointer-events: auto;
  cursor: grab;
  transition: filter 0.35s ease;
  filter: drop-shadow(0 10px 14px rgba(38, 46, 52, 0.18));
  touch-action: none;
}
.jr-pet-lamb.dragging { cursor: grabbing; }
.jr-pet-lamb.awake { filter: drop-shadow(0 12px 18px rgba(38, 46, 52, 0.24)); }
.jr-pet-lamb:focus-visible { outline: 2px solid var(--jr-accent, #6b8f9c); outline-offset: 4px; border-radius: 12px; }

.jr-pet-media {
  width: 100%;
  height: 100%;
  object-fit: contain;
  pointer-events: none;
  -webkit-user-drag: none;
}

.jr-pet-bubble {
  position: absolute;
  bottom: calc(100% - 6px);
  left: 50%;
  transform: translateX(-50%);
  width: max-content;
  max-width: 232px;
  padding: 9px 13px;
  border-radius: 14px;
  border-bottom-left-radius: 5px;
  background: rgba(255, 255, 255, 0.96);
  color: #2f3a40;
  font-size: 13px;
  line-height: 1.55;
  box-shadow: 0 6px 22px rgba(40, 52, 60, 0.16);
  pointer-events: auto;
}
[data-theme="dark"] .jr-pet-bubble { background: rgba(38, 45, 50, 0.96); color: #e8eef0; }

.jr-pet-menu {
  position: absolute;
  top: 12px;
  left: calc(100% - 12px);
  min-width: 148px;
  padding: 6px;
  border-radius: 13px;
  background: rgba(255, 255, 255, 0.97);
  box-shadow: 0 10px 30px rgba(40, 52, 60, 0.2);
  pointer-events: auto;
  display: flex;
  flex-direction: column;
  gap: 1px;
}
[data-theme="dark"] .jr-pet-menu { background: rgba(38, 45, 50, 0.97); }
.jr-pet-menu button {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 7px 10px;
  border: 0;
  border-radius: 9px;
  background: transparent;
  color: inherit;
  font-size: 13px;
  text-align: left;
}
.jr-pet-menu button:hover { background: rgba(107, 143, 156, 0.14); }

/* 贴右边时菜单往左展开，否则会被窗口裁掉 */
.jr-pet-menu.flip {
  left: auto;
  right: calc(100% - 12px);
}

.jr-pet-tip {
  position: absolute;
  left: 50%;
  bottom: 34px;
  transform: translateX(-50%);
  margin: 0;
  max-width: 460px;
  text-align: center;
  font-size: 12.5px;
  line-height: 1.7;
  color: #6d7a80;
  pointer-events: none;
}

.pet-bubble-enter-active, .pet-bubble-leave-active { transition: opacity 0.22s ease, transform 0.22s ease; }
.pet-bubble-enter-from, .pet-bubble-leave-to { opacity: 0; transform: translateX(-50%) translateY(6px); }
.pet-menu-enter-active, .pet-menu-leave-active { transition: opacity 0.14s ease, transform 0.14s ease; }
.pet-menu-enter-from, .pet-menu-leave-to { opacity: 0; transform: translateX(-6px); }
</style>
