<script setup lang="ts">
import { mdiRotateRight, mdiFlipHorizontal, mdiArrowUp, mdiArrowDown, mdiWater, mdiTrashCanOutline, mdiClose, mdiLampOutline, mdiRestart } from '@mdi/js'
import { PAL_TOTEMS, PAL_WALLPAPERS, palTotemDef } from '~/utils/palTotemDefs'
import { palSound } from '~/utils/palSounds'

/**
 * Pal 房间（M-122）——原版 Journey Pal 页的家具（totems）系统复刻：
 * 壁纸 + 地板 + 小羊 + 可摆放的家具层；点选家具出动作条（旋转/翻转/置前/置后/浇水/移除），
 * 可拖动摆放，localStorage 持久化；点小羊出浮动反应。
 * 素材是自绘 SVG 占位，等即梦同风格图按原文件名替换（见 palTotemDefs.ts 头注）。
 */

const props = defineProps<{ stage: 'idle' | 'thinking' | 'awake' }>()
const emit = defineEmits<{ (e: 'mascot-tap'): void }>()

const isMobile = useIsMobile()
const room = usePalTotems()

onMounted(() => room.init())

const roomEl = ref<HTMLElement | null>(null)
const selectedId = ref('')
const showCatalog = ref(false)

function select(id: string) {
  selectedId.value = id
  palSound.tap()
}
function deselect() { selectedId.value = '' }

// ---- 拖动摆放：pointer 指针事件，位移 >4px 才算拖动（否则视为点选） ----
interface Drag { id: string; moved: boolean }
let drag: Drag | null = null

function onTotemDown(inst: { id: string }, e: PointerEvent) {
  if ((e.target as HTMLElement).closest('[data-pal-actions]')) return
  select(inst.id)
  const el = e.currentTarget as HTMLElement
  drag = { id: inst.id, moved: false }
  el.setPointerCapture(e.pointerId)
}
function onTotemMove(inst: { id: string }, e: PointerEvent) {
  if (!drag || drag.id !== inst.id) return
  const rect = roomEl.value?.getBoundingClientRect()
  if (!rect) return
  drag.moved = true
  const x = ((e.clientX - rect.left) / rect.width) * 100
  const bottom = ((rect.bottom - e.clientY) / rect.height) * 100
  room.move(inst.id, x, Math.max(bottom, 0))
}
function onTotemUp(e: PointerEvent) {
  const el = e.currentTarget as HTMLElement
  if (el.hasPointerCapture?.(e.pointerId)) el.releasePointerCapture(e.pointerId)
  drag = null
}

// ---- 动作条 ----
function act(id: string, kind: 'rotate' | 'flip' | 'front' | 'back' | 'water' | 'remove') {
  const inst = room.placed.value.find(i => i.id === id)
  const def = inst ? palTotemDef(inst.totemId) : undefined
  if (!inst || !def) return
  if (kind === 'rotate') room.rotate(id)
  else if (kind === 'flip') room.flip(id)
  else if (kind === 'front') room.front(id)
  else if (kind === 'back') room.back(id)
  else if (kind === 'remove') { room.removeTotem(id); palSound.remove(); deselect(); return }
  else if (kind === 'water') doWater(id, def)
}
function doWater(id: string, def: ReturnType<typeof palTotemDef>) {
  const r = room.water(id)
  if (!r) return
  if (r === 'grow') {
    palSound.water()
    palSound.sparkle()
    spawnFx(id, 'drop')
    setTimeout(() => spawnFx(id, 'star'), 420)
  } else {
    palSound.sparkle()
    spawnFx(id, 'star')
  }
}

// ---- 浇水/生长浮动特效（水滴落下、星星升起） ----
interface Fx { key: number; totemId: string; kind: 'drop' | 'star' }
const fx = ref<Fx[]>([])
let fxSeq = 0
function spawnFx(id: string, kind: 'drop' | 'star') {
  const key = ++fxSeq
  fx.value = [...fx.value, { key, totemId: id, kind }]
  setTimeout(() => { fx.value = fx.value.filter(f => f.key !== key) }, 950)
}

// ---- 点小羊：浮动反应（原版为 hug/pat/like/food 贴图，复刻用 emoji 等义替代） ----
const REACTIONS = [
  { key: 'hug', emoji: '🤗' },
  { key: 'pat', emoji: '🫶' },
  { key: 'like', emoji: '❤️' },
  { key: 'food', emoji: '🍪' },
] as const
interface Reaction { key: number; emoji: string }
const reactions = ref<Reaction[]>([])
let reactSeq = 0
let lastReact = -1
function mascotTap() {
  let idx = Math.floor(Math.random() * REACTIONS.length)
  if (idx === lastReact) idx = (idx + 1) % REACTIONS.length
  lastReact = idx
  const key = ++reactSeq
  reactions.value = [...reactions.value, { key, emoji: REACTIONS[idx].emoji }]
  setTimeout(() => { reactions.value = reactions.value.filter(r => r.key !== key) }, 950)
  palSound.react()
  emit('mascot-tap')
}

// ---- 提示条自动消失 ----
watch(room.hint, (v) => {
  if (!v) return
  setTimeout(() => { if (room.hint.value === v) room.hint.value = '' }, 3200)
})

// ---- 目录弹窗 ----
function addFromCatalog(totemId: string) {
  if (room.addTotem(totemId)) palSound.insert()
}
function swapFromCatalog(totemId: string) {
  if (room.swapWallpaper(totemId)) { palSound.insert(); showCatalog.value = false }
}
function resetRoom() {
  room.resetRoom()
  palSound.remove()
  deselect()
  showCatalog.value = false
}
function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    if (showCatalog.value) showCatalog.value = false
    else deselect()
  }
}
onMounted(() => window.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))

// ---- 小羊素材（自 pal.vue 迁入：状态机仍由页面驱动） ----
const petVideos = { idle: '/pet/lamb-idle.webm', thinking: '/pet/lamb-think.webm', awake: '/pet/lamb-awake.webm' }
const petFallback = ref(false)
watch(() => props.stage, () => { petFallback.value = false })
const caption = computed(() => props.stage === 'thinking' ? '小羊想一下…' : props.stage === 'awake' ? '小羊醒着呢' : '小羊打了个盹')

function totemStyle(inst: { x: number; bottom: number; rotation: number; flipped: boolean; z: number; id: string; growthStage: number }) {
  const def = palTotemDef(inst.totemId)
  if (!def) return {}
  return {
    left: `${inst.x}%`,
    bottom: `${inst.bottom}%`,
    width: `${def.w}%`,
    zIndex: inst.z,
    transform: `translateX(-50%) rotate(${inst.rotation}deg) scaleX(${inst.flipped ? -1 : 1})`,
  }
}
function growthScale(stage: number) { return `scale(${(1 + stage * 0.16).toFixed(2)})` }
</script>

<template>
  <div ref="roomEl" class="jr-pal-room" :class="{ mobile: isMobile }" data-testid="pal-room" @pointerdown="deselect">
    <!-- 壁纸（也是一种 totem，单独铺满） -->
    <img v-if="room.wallpaper.value" class="room-wallpaper" :src="palTotemDef(room.wallpaper.value.totemId)?.src" alt="" aria-hidden="true" data-testid="pal-wallpaper">
    <div class="room-spotlight" aria-hidden="true"></div>
    <div class="room-floor" aria-hidden="true"></div>

    <!-- 家具层 -->
    <div v-for="inst in room.placed.value" :key="inst.id" class="room-totem" :class="{ sel: selectedId === inst.id, dragging: drag?.id === inst.id }"
      :style="totemStyle(inst)" :data-totem-name="palTotemDef(inst.totemId)?.id"
      role="button" tabindex="0" :aria-label="`家具：${palTotemDef(inst.totemId)?.name}`"
      @pointerdown.stop="onTotemDown(inst, $event)" @pointermove="onTotemMove(inst, $event)" @pointerup="onTotemUp($event)"
      @keydown.enter.prevent="select(inst.id)">
      <img :src="palTotemDef(inst.totemId)?.src" :alt="palTotemDef(inst.totemId)?.name" draggable="false"
        :data-growth="palTotemDef(inst.totemId)?.growable ? inst.growthStage : undefined" :style="{ transform: growthScale(inst.growthStage) }">
      <span v-for="f in fx.filter(f => f.totemId === inst.id)" :key="f.key" class="fx" :class="f.kind" aria-hidden="true">{{ f.kind === 'drop' ? '💧' : '⭐' }}</span>
      <div v-if="selectedId === inst.id" class="totem-actions" data-pal-actions @pointerdown.stop>
        <button :data-act="'rotate'" title="旋转" aria-label="旋转" @click.stop="act(inst.id, 'rotate')"><JrIcon :path="mdiRotateRight" :size="15" /></button>
        <button :data-act="'flip'" title="水平翻转" aria-label="水平翻转" @click.stop="act(inst.id, 'flip')"><JrIcon :path="mdiFlipHorizontal" :size="15" /></button>
        <button :data-act="'front'" title="置前" aria-label="置前" @click.stop="act(inst.id, 'front')"><JrIcon :path="mdiArrowUp" :size="15" /></button>
        <button :data-act="'back'" title="置后" aria-label="置后" @click.stop="act(inst.id, 'back')"><JrIcon :path="mdiArrowDown" :size="15" /></button>
        <button v-if="palTotemDef(inst.totemId)?.growable" :data-act="'water'" title="浇水" aria-label="浇水" @click.stop="act(inst.id, 'water')"><JrIcon :path="mdiWater" :size="15" /></button>
        <button :data-act="'remove'" title="移除" aria-label="移除" @click.stop="act(inst.id, 'remove')"><JrIcon :path="mdiTrashCanOutline" :size="15" /></button>
        <button :data-act="'done'" title="完成" aria-label="完成" @click.stop="deselect()"><JrIcon :path="mdiClose" :size="15" /></button>
      </div>
    </div>

    <!-- 小羊（吉祥物；点它出反应） -->
    <div class="room-mascot" data-testid="pal-mascot" :data-stage="props.stage" @pointerdown.stop @click.stop="mascotTap">
      <img v-if="petFallback" src="/pet/lamb-poster.webp" alt="日记伙伴：瞌睡小羊" class="jr-pet-img">
      <Transition v-else name="petfade" mode="out-in">
        <video :key="props.stage" class="jr-pet-video on" :src="petVideos[props.stage]" loop muted playsinline autoplay preload="auto" @error="petFallback = true" />
      </Transition>
      <span v-for="r in reactions" :key="r.key" class="room-reaction" data-pal-reaction aria-hidden="true">{{ r.emoji }}</span>
    </div>
    <span class="jr-pet-caption">{{ caption }}</span>

    <!-- 舞台角落：家具入口 + 提示 -->
    <button class="room-catalog-btn" data-testid="pal-catalog-btn" title="家具目录" aria-label="打开家具目录" @pointerdown.stop @click.stop="showCatalog = true">
      <JrIcon :path="mdiLampOutline" :size="14" /> 家具
    </button>
    <span v-if="room.hint.value" class="room-hint" data-pal-hint role="status">{{ room.hint.value }}</span>

    <!-- 家具目录（本地免费目录；原版更多家具为会员云端代币购买，诚实边界见 feature-matrix M-122） -->
    <Teleport to="body">
      <div v-if="showCatalog" class="catalog-overlay" @click.self="showCatalog = false">
        <div class="catalog-panel" role="dialog" aria-modal="true" aria-label="家具目录" data-testid="pal-catalog">
          <header class="catalog-head">
            <h2>家具目录</h2>
            <button class="catalog-close" aria-label="关闭目录" @click="showCatalog = false"><JrIcon :path="mdiClose" :size="16" /></button>
          </header>
          <div class="catalog-grid">
            <button v-for="d in PAL_TOTEMS" :key="d.id" class="catalog-card" :data-catalog-item="d.id" @click="addFromCatalog(d.id)">
              <img :src="d.src" :alt="d.name">
              <span class="catalog-name">{{ d.name }}</span>
              <span class="catalog-state">{{ room.placedCount(d.id) ? `已摆放×${room.placedCount(d.id)}` : '摆上' }}</span>
            </button>
          </div>
          <h3 class="catalog-sub">壁纸</h3>
          <div class="catalog-grid">
            <button v-for="d in PAL_WALLPAPERS" :key="d.id" class="catalog-card" :data-catalog-item="d.id" @click="swapFromCatalog(d.id)">
              <img :src="d.src" :alt="d.name">
              <span class="catalog-name">{{ d.name }}</span>
              <span class="catalog-state">{{ room.wallpaper.value?.totemId === d.id ? '使用中' : '换上' }}</span>
            </button>
          </div>
          <footer class="catalog-foot">
            <span>复刻说明：原版更多家具是会员云端目录（代币购买），这里是本地免费目录。</span>
            <button class="catalog-reset" @click="resetRoom"><JrIcon :path="mdiRestart" :size="13" /> 恢复默认摆放</button>
          </footer>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.jr-pal-room { position: relative; height: 240px; border-radius: 20px; overflow: hidden; isolation: isolate; background: #e9edef; touch-action: none; }

.room-wallpaper { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; z-index: 0; }
.room-spotlight { position: absolute; inset: 0; z-index: 1; background: radial-gradient(58% 88% at 50% -6%, rgba(255,255,255,0.85) 0%, rgba(255,255,255,0.25) 45%, rgba(255,255,255,0) 72%); pointer-events: none; }
.room-floor { position: absolute; left: 0; right: 0; bottom: 0; height: 14%; z-index: 1; background: linear-gradient(180deg, rgba(120,138,146,0) 0%, rgba(120,138,146,0.18) 100%); pointer-events: none; }

.room-totem { position: absolute; cursor: grab; user-select: none; touch-action: none; }
.room-totem.dragging { cursor: grabbing; }
.room-totem img { width: 100%; height: auto; display: block; pointer-events: none; transition: transform 0.2s ease; filter: drop-shadow(0 3px 4px rgba(40,60,70,0.18)); }
.room-totem.dragging img { transition: none; }
.room-totem.sel img { filter: drop-shadow(0 3px 4px rgba(40,60,70,0.18)) drop-shadow(0 0 0 1px rgba(68,192,255,0.35)); outline: 1.5px dashed rgba(68,192,255,0.7); outline-offset: 3px; border-radius: 6px; }

.totem-actions { position: absolute; top: -16px; left: 50%; transform: translate(-50%, -100%); display: flex; gap: 2px; background: #fff; border: 1px solid var(--jr-outline-variant); border-radius: 999px; padding: 3px 5px; box-shadow: 0 4px 14px rgba(20,40,50,0.16); z-index: 20; }
[data-theme="dark"] .totem-actions { background: #232a2d; }
.totem-actions button { width: 26px; height: 26px; border-radius: 50%; border: 0; background: none; color: var(--jr-on-surface-variant); display: flex; align-items: center; justify-content: center; cursor: pointer; }
.totem-actions button:hover { background: var(--jr-surface-variant); }
.totem-actions button[data-act="remove"]:hover { background: #d34f5e; color: #fff; }
.totem-actions button[data-act="water"]:hover { background: #4a90c9; color: #fff; }

.fx { position: absolute; left: 50%; top: 10%; font-size: 15px; pointer-events: none; animation: pal-fx 0.95s ease-out forwards; z-index: 30; }
.fx.drop { top: 0; animation-name: pal-drop; }
.fx.star { animation-name: pal-rise; }

.room-mascot { position: absolute; left: 50%; bottom: 0; transform: translateX(-50%); height: 88%; aspect-ratio: 390 / 525; z-index: 5; cursor: pointer; }
.jr-pal-room.mobile .room-mascot { height: 82%; }
.jr-pet-video, .jr-pet-img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: contain; opacity: 0; transition: opacity 0.45s ease; }
.jr-pet-video.on, .jr-pet-img { opacity: 1; }
.petfade-enter-active, .petfade-leave-active { transition: opacity 0.35s ease; }
.petfade-enter-from, .petfade-leave-to { opacity: 0 !important; }

.room-reaction { position: absolute; left: 50%; top: 6%; font-size: 20px; animation: pal-rise 0.95s ease-out forwards; pointer-events: none; z-index: 30; }

.jr-pet-caption { position: absolute; left: 14px; bottom: 10px; font-size: 12px; color: var(--jr-on-surface-variant); background: rgba(255,255,255,0.6); border-radius: 999px; padding: 3px 10px; z-index: 6; }
[data-theme="dark"] .jr-pet-caption { background: rgba(0,0,0,0.35); }

.room-catalog-btn { position: absolute; right: 10px; top: 10px; z-index: 7; display: inline-flex; align-items: center; gap: 5px; border: 1px solid var(--jr-outline-variant); background: rgba(255,255,255,0.82); color: var(--jr-on-surface-variant); border-radius: 999px; padding: 5px 11px; font-size: 12px; font-weight: 700; cursor: pointer; }
[data-theme="dark"] .room-catalog-btn { background: rgba(29,36,39,0.85); }
.room-catalog-btn:hover { background: var(--jr-surface-variant); }

.room-hint { position: absolute; left: 14px; top: 10px; z-index: 7; font-size: 12px; background: rgba(255,255,255,0.88); border: 1px solid var(--jr-outline-variant); color: var(--jr-on-surface); border-radius: 999px; padding: 4px 11px; max-width: 62%; }
[data-theme="dark"] .room-hint { background: rgba(29,36,39,0.9); }

@keyframes pal-rise { 0% { transform: translate(-50%, 0) scale(0.7); opacity: 0; } 18% { opacity: 1; transform: translate(-50%, -14px) scale(1.08); } 100% { transform: translate(-50%, -52px) scale(1); opacity: 0; } }
@keyframes pal-drop { 0% { transform: translate(-50%, -6px); opacity: 0; } 20% { opacity: 1; } 100% { transform: translate(-50%, 52px); opacity: 0; } }

/* 目录弹窗 */
.catalog-overlay { position: fixed; inset: 0; background: rgba(10,20,24,0.42); z-index: 900; display: flex; align-items: center; justify-content: center; padding: 16px; }
.catalog-panel { background: var(--jr-bg); border-radius: 16px; max-width: 560px; width: 100%; max-height: 82vh; overflow-y: auto; padding: 16px 18px; box-shadow: 0 18px 50px rgba(10,25,32,0.3); }
.catalog-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
.catalog-head h2 { margin: 0; font-size: 16px; font-weight: 800; }
.catalog-close { border: 0; background: none; color: var(--jr-on-surface-variant); cursor: pointer; padding: 4px; }
.catalog-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(96px, 1fr)); gap: 8px; }
.catalog-card { display: flex; flex-direction: column; align-items: center; gap: 4px; border: 1px solid var(--jr-outline-variant); background: var(--jr-surface); border-radius: 12px; padding: 8px 6px; cursor: pointer; }
.catalog-card:hover { background: var(--jr-surface-variant); }
.catalog-card img { height: 52px; width: auto; max-width: 84px; object-fit: contain; }
.catalog-name { font-size: 12px; font-weight: 700; color: var(--jr-on-surface); }
.catalog-state { font-size: 10.5px; color: var(--jr-on-surface-variant); }
.catalog-sub { margin: 12px 0 8px; font-size: 12.5px; color: var(--jr-on-surface-variant); font-weight: 700; }
.catalog-foot { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-top: 14px; font-size: 11px; color: var(--jr-on-surface-variant); }
.catalog-reset { display: inline-flex; align-items: center; gap: 4px; border: 1px solid var(--jr-outline-variant); background: none; color: var(--jr-on-surface-variant); border-radius: 999px; padding: 5px 10px; font-size: 11.5px; cursor: pointer; white-space: nowrap; }
.catalog-reset:hover { background: var(--jr-surface-variant); }

/* ≤600px：房间变矮、动作条加大点击面（沿用移动抽屉时代的布局约定） */
@media (max-width: 600px) {
  .jr-pal-room { height: 200px; border-radius: 16px; }
  .totem-actions button { width: 30px; height: 30px; }
  .room-catalog-btn { right: 8px; top: 8px; }
}
</style>
