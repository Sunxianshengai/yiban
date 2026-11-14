<script setup lang="ts">
import { mdiRotateRight, mdiFlipHorizontal, mdiArrowUp, mdiArrowDown, mdiWater, mdiTrashCanOutline, mdiClose, mdiLampOutline, mdiRestart, mdiImageMultipleOutline, mdiImageOffOutline } from '@mdi/js'
import { PAL_TOTEMS, PAL_WALLPAPERS, palTotemDef, type PalTotemDef } from '~/utils/palTotemDefs'
import { palSound } from '~/utils/palSounds'
import { db } from '~/utils/db'
import { WEATHER_EMOJI } from '~/utils/services'

/**
 * Pal 房间（M-122）——原版 Journey Pal 页的家具（totems）系统复刻：
 * 壁纸 + 地板 + 小羊 + 可摆放的家具层；点选家具出动作条（旋转/翻转/置前/置后/浇水/移除），
 * 可拖动摆放，localStorage 持久化；点小羊出浮动反应。
 *
 * 世界层：家具/小羊住在一个固定纵横比（760:240）的 .room-world 里，贴底居中、
 * 等比容纳进任何房间尺寸——竖高房间上方留出墙面（与原版"墙+地板场景"观感一致），
 * 且尺寸(宽%)与位置(高%)始终在同一坐标系，书堆永远落在边几上。
 * 素材是自绘 SVG 占位，等即梦同风格图按原文件名替换（见 palTotemDefs.ts 头注）。
 */

const props = defineProps<{ stage: 'idle' | 'thinking' | 'awake' }>()
const emit = defineEmits<{ (e: 'mascot-tap'): void }>()

const isMobile = useIsMobile()
const room = usePalTotems()

const roomEl = ref<HTMLElement | null>(null)
const worldEl = ref<HTMLElement | null>(null)
const selectedId = ref('')
const showCatalog = ref(false)

// 世界层几何：等比放进房间（贴底居中）
const DESIGN_ASPECT = 760 / 240
const PORTRAIT_ASPECT = 0.8
const roomW = ref(760)
const roomH = ref(240)
function measureRoom() {
  if (!roomEl.value) return
  // 布局未就绪时 clientWidth 可能为 0：保留上一次的有效值，避免世界层量出错尺寸
  const w = roomEl.value.clientWidth
  const h = roomEl.value.clientHeight
  if (w > 0) roomW.value = w
  if (h > 0) roomH.value = h
}

/** 纵向布局档：房间明显高于宽（桌面双栏右栏）时切竖版世界与摆位（对齐原版移动端场景） */
const portrait = computed(() => roomH.value > roomW.value * 0.75)
const worldW = computed(() => {
  if (portrait.value) { const h = Math.min(roomH.value * 0.95, roomW.value / PORTRAIT_ASPECT); return h * PORTRAIT_ASPECT }
  return Math.min(roomW.value, roomH.value * DESIGN_ASPECT)
})
const worldH = computed(() => portrait.value ? worldW.value / PORTRAIT_ASPECT : worldW.value / DESIGN_ASPECT)
const worldStyle = computed(() => ({ width: `${worldW.value}px`, height: `${worldH.value}px`, left: `${(roomW.value - worldW.value) / 2}px` }))

/** 当前布局档下的家具尺寸/摆位 */
function dims(def: PalTotemDef) {
  return portrait.value && def.p ? { ...def, w: def.p.w, x: def.p.x, bottom: def.p.bottom } : def
}

onMounted(() => { measureRoom(); room.init(portrait.value); window.addEventListener('resize', measureRoom) })
onBeforeUnmount(() => window.removeEventListener('resize', measureRoom))
watch(isMobile, () => nextTick(measureRoom))

const selected = computed(() => room.placed.value.find(i => i.id === selectedId.value) ?? null)
const barStyle = computed(() => {
  const sel = selected.value
  const def = sel ? palTotemDef(sel.totemId) : undefined
  if (!sel || !def) return {}
  const imgH = (dims(def).w / 100) * worldW.value * def.ar * (1 + sel.growthStage * 0.16)
  const worldLeft = (roomW.value - worldW.value) / 2
  // 横向夹紧：动作条 ~9 键宽，贴左右边时会被 overflow:hidden 裁掉按钮（移动端实测 55px）
  const half = isMobile.value ? 118 : 126
  const left = Math.min(Math.max(worldLeft + (dims(def).x / 100) * worldW.value, half), roomW.value - half)
  const bottom = Math.min((dims(def).bottom / 100) * worldH.value + imgH + 12, roomH.value - 44)
  return { left: `${left}px`, bottom: `${bottom}px` }
})

// ---- 相框照片（原版 totem 的 photoId 模型）：photoId 指向 mediaFilesV2，渲染时换显示地址 ----
const stars = usePalStars()
const photoUrls = ref<Record<string, string>>({})
const photoResolver = useMediaResolver()
watch(() => room.instances.value.map(i => `${i.id}:${i.photoId ?? 0}`).join('|'), async () => {
  for (const inst of room.instances.value) {
    if (!inst.photoId) { delete photoUrls.value[inst.id]; continue }
    if (photoUrls.value[inst.id]) continue
    try {
      const row = await db.mediaFilesV2.get(inst.photoId)
      if (!row) continue
      await photoResolver.prefetch([row])
      const url = photoResolver.urlForSync(row)
      if (url) photoUrls.value[inst.id] = url
    } catch { /* 取不到就先空着，相框留白 */ }
  }
}, { immediate: true })
onBeforeUnmount(() => photoResolver.dispose())

const photoOpen = ref(false)
const photoRows = ref<{ id: number; url: string; fileName: string }[]>([])
async function openPhotoPicker() {
  if (!selected.value) return
  photoOpen.value = true
  try {
    const all = (await db.mediaFilesV2.toArray())
      .filter(m => m.mimeType?.startsWith('image/'))
      .sort((a, b) => (b.id ?? 0) - (a.id ?? 0))
      .slice(0, 80)
    await photoResolver.prefetch(all)
    photoRows.value = all.flatMap(m => { const url = photoResolver.urlForSync(m); return url && m.id != null ? [{ id: m.id, url, fileName: m.fileName }] : [] })
  } catch { photoRows.value = [] }
}
function assignPhoto(photoId: number) {
  if (!selected.value) return
  room.setPhoto(selected.value.id, photoId)
  palSound.insert()
  photoOpen.value = false
}
function clearPhoto() {
  if (!selected.value) return
  room.setPhoto(selected.value.id, undefined)
  palSound.remove()
}

// ---- 昼夜氛围 + 天气徽章（取最近一篇带天气的日记；原版房间随昼夜/季节变化的氛围方向） ----
const nowHour = ref(new Date().getHours())
let hourTimer: ReturnType<typeof setInterval> | undefined
const night = computed(() => nowHour.value >= 21 || nowHour.value < 6)
const { entries: palEntries, refresh: refreshPalEntries } = useEntries()
const weatherBadge = computed(() => {
  const withW = palEntries.value.filter(e => e.weatherIcon).slice(0, 60)
  if (!withW.length) return ''
  const latest = withW.reduce((a, b) => (new Date(b.dateOfJournal) > new Date(a.dateOfJournal) ? b : a))
  const emoji = WEATHER_EMOJI[latest.weatherIcon!] || ''
  if (!emoji) return ''
  return latest.weatherDegreeC != null ? `${emoji} ${latest.weatherDegreeC}°C` : emoji
})
onMounted(() => {
  hourTimer = setInterval(() => { nowHour.value = new Date().getHours() }, 60000)
  if (!palEntries.value.length) void refreshPalEntries()
})
onBeforeUnmount(() => clearInterval(hourTimer))

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
  const rect = worldEl.value?.getBoundingClientRect()
  if (!rect || rect.height === 0) return
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
  const isFeed = def?.growable?.action === 'feed'
  const r = room.water(id)
  if (!r) return
  if (r === 'grow') {
    palSound.water()
    palSound.sparkle()
    spawnFx(id, 'drop', isFeed ? '🍤' : '💧')
    setTimeout(() => spawnFx(id, 'star'), 420)
  } else {
    palSound.sparkle()
    spawnFx(id, 'star')
  }
}

// ---- 浇水/喂鱼/生长浮动特效（水滴/鱼食落下、星星升起） ----
interface Fx { key: number; totemId: string; kind: 'drop' | 'star'; emoji?: string }
const fx = ref<Fx[]>([])
let fxSeq = 0
function spawnFx(id: string, kind: 'drop' | 'star', emoji?: string) {
  const key = ++fxSeq
  fx.value = [...fx.value, { key, totemId: id, kind, emoji }]
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
const catalogNote = ref('')
let noteTimer: ReturnType<typeof setTimeout> | undefined
function note(msg: string) {
  catalogNote.value = msg
  clearTimeout(noteTimer)
  noteTimer = setTimeout(() => { catalogNote.value = '' }, 3600)
}
function addFromCatalog(totemId: string) {
  if (room.addTotem(totemId, portrait.value)) palSound.insert()
}
function onCatalogCard(d: PalTotemDef) {
  if (!stars.isLocked(d)) { addFromCatalog(d.id); return }
  if (stars.unlock(d)) {
    note(`已解锁「${d.name}」，花掉 ${d.cost}⭐。`)
    addFromCatalog(d.id)
  } else {
    note(`「${d.name}」要 ${d.cost}⭐，还差 ${stars.missingFor(d)} 颗——写一篇日记 +1⭐，当天首篇 +2⭐。`)
  }
}
function swapFromCatalog(totemId: string) {
  if (room.swapWallpaper(totemId, portrait.value)) { palSound.insert(); showCatalog.value = false }
}
function resetRoom() {
  room.resetRoom(portrait.value)
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
    width: `${dims(def).w}%`,
    zIndex: inst.z,
    transform: `translateX(-50%) rotate(${inst.rotation}deg) scaleX(${inst.flipped ? -1 : 1})`,
  }
}
function growthScale(stage: number) { return `scale(${(1 + stage * 0.16).toFixed(2)})` }
function photoStyle(def: PalTotemDef) {
  const p = def.photo!
  return { left: `${p.ax}%`, top: `${p.ay}%`, width: `${p.aw}%`, height: `${p.ah}%` }
}
</script>

<template>
  <div ref="roomEl" class="jr-pal-room" :class="{ mobile: isMobile }" data-testid="pal-room" @pointerdown="deselect">
    <!-- 壁纸（也是一种 totem，单独铺满整面墙） -->
    <img v-if="room.wallpaper.value" class="room-wallpaper" :src="palTotemDef(room.wallpaper.value.totemId)?.src" alt="" aria-hidden="true" data-testid="pal-wallpaper">
    <div class="room-spotlight" aria-hidden="true"></div>
    <!-- 夜间氛围：21:00-6:00 房间蒙上夜色（对齐原版随昼夜变化的氛围方向） -->
    <div v-if="night" class="room-night" aria-hidden="true"></div>

    <!-- 世界层：固定纵横比，贴底居中；地板/家具/小羊都在同一坐标系里 -->
    <div ref="worldEl" class="room-world" :class="{ 'is-portrait': portrait }" :style="worldStyle">
      <div class="room-floor" aria-hidden="true"></div>

      <div v-for="inst in room.placed.value" :key="inst.id" class="room-totem" :class="{ sel: selectedId === inst.id, dragging: drag?.id === inst.id }"
        :style="totemStyle(inst)" :data-totem-name="palTotemDef(inst.totemId)?.id"
        role="button" tabindex="0" :aria-label="`家具：${palTotemDef(inst.totemId)?.name}`"
        @pointerdown.stop="onTotemDown(inst, $event)" @pointermove="onTotemMove(inst, $event)" @pointerup="onTotemUp($event)"
        @keydown.enter.prevent="select(inst.id)">
        <img :src="palTotemDef(inst.totemId)?.src" :alt="palTotemDef(inst.totemId)?.name" draggable="false"
          :data-growth="palTotemDef(inst.totemId)?.growable ? inst.growthStage : undefined" :style="{ transform: growthScale(inst.growthStage) }">
        <!-- 相框里的照片（原版 photoId 模型）：钉在素材开口区，跟随旋转/翻转 -->
        <img v-if="palTotemDef(inst.totemId)?.photo && inst.photoId && photoUrls[inst.id]" class="frame-photo"
          :src="photoUrls[inst.id]" alt="相框里的照片" :style="photoStyle(palTotemDef(inst.totemId)!)">
        <span v-for="f in fx.filter(f => f.totemId === inst.id)" :key="f.key" class="fx" :class="f.kind" aria-hidden="true">{{ f.emoji || (f.kind === 'drop' ? '💧' : '⭐') }}</span>
      </div>

      <!-- 小羊（吉祥物；点它出反应）。容器不吃点击（透明大盒会挡住摆在中部的家具），命中区缩小到小羊身体 -->
      <div class="room-mascot" :data-stage="props.stage">
        <img v-if="petFallback" src="/pet/lamb-poster.webp" alt="日记伙伴：瞌睡小羊" class="jr-pet-img">
        <Transition v-else name="petfade" mode="out-in">
          <video :key="props.stage" class="jr-pet-video on" :src="petVideos[props.stage]" loop muted playsinline autoplay preload="auto" @error="petFallback = true" />
        </Transition>
        <span v-for="r in reactions" :key="r.key" class="room-reaction" data-pal-reaction aria-hidden="true">{{ r.emoji }}</span>
        <button class="mascot-hit" data-testid="pal-mascot" aria-label="和小羊互动" @click.stop="mascotTap"></button>
      </div>
    </div>

    <!-- 动作条（房间根层，始终正立，定位在选中家具顶边；不随家具旋转/翻转） -->
    <div v-if="selected" class="totem-actions" data-pal-actions :style="barStyle" @pointerdown.stop>
      <button :data-act="'rotate'" title="旋转" aria-label="旋转" @click.stop="act(selected.id, 'rotate')"><JrIcon :path="mdiRotateRight" :size="15" /></button>
      <button :data-act="'flip'" title="水平翻转" aria-label="水平翻转" @click.stop="act(selected.id, 'flip')"><JrIcon :path="mdiFlipHorizontal" :size="15" /></button>
      <button :data-act="'front'" title="置前" aria-label="置前" @click.stop="act(selected.id, 'front')"><JrIcon :path="mdiArrowUp" :size="15" /></button>
      <button :data-act="'back'" title="置后" aria-label="置后" @click.stop="act(selected.id, 'back')"><JrIcon :path="mdiArrowDown" :size="15" /></button>
      <button v-if="palTotemDef(selected.totemId)?.photo" :data-act="'pick-photo'" title="选照片" aria-label="选照片" @click.stop="openPhotoPicker()"><JrIcon :path="mdiImageMultipleOutline" :size="15" /></button>
      <button v-if="palTotemDef(selected.totemId)?.photo && selected.photoId" :data-act="'clear-photo'" title="清除照片" aria-label="清除照片" @click.stop="clearPhoto()"><JrIcon :path="mdiImageOffOutline" :size="15" /></button>
      <button v-if="palTotemDef(selected.totemId)?.growable" :data-act="'water'" :title="palTotemDef(selected.totemId)?.growable?.label || '浇水'" :aria-label="palTotemDef(selected.totemId)?.growable?.label || '浇水'" @click.stop="act(selected.id, 'water')"><JrIcon :path="mdiWater" :size="15" /></button>
      <button :data-act="'remove'" title="移除" aria-label="移除" @click.stop="act(selected.id, 'remove')"><JrIcon :path="mdiTrashCanOutline" :size="15" /></button>
      <button :data-act="'done'" title="完成" aria-label="完成" @click.stop="deselect()"><JrIcon :path="mdiClose" :size="15" /></button>
    </div>

    <span class="jr-pet-caption">{{ caption }}</span>
    <span v-if="weatherBadge" class="room-weather" :title="'来自最近一篇带天气的日记'">{{ weatherBadge }}</span>

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
            <span class="catalog-balance" data-pal-stars title="写一篇日记 +1⭐，当天首篇 +2⭐">⭐ {{ stars.count }}</span>
            <button class="catalog-close" aria-label="关闭目录" @click="showCatalog = false"><JrIcon :path="mdiClose" :size="16" /></button>
          </header>
          <div class="catalog-grid">
            <button v-for="d in PAL_TOTEMS" :key="d.id" class="catalog-card" :data-catalog-item="d.id" :data-locked="stars.isLocked(d) ? '1' : undefined" @click="onCatalogCard(d)">
              <img :src="d.src" :alt="d.name">
              <span class="catalog-name">{{ d.name }}</span>
              <span class="catalog-state">{{ stars.isLocked(d) ? `🔒 ${d.cost}⭐ 解锁` : room.placedCount(d.id) ? `已摆放×${room.placedCount(d.id)}` : '摆上' }}</span>
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
          <p v-if="catalogNote" class="catalog-note" role="status">{{ catalogNote }}</p>
          <footer class="catalog-foot">
            <span>复刻说明：原版更多家具是会员云端目录（代币购买），这里写日记攒⭐解锁。</span>
            <button class="catalog-reset" @click="resetRoom"><JrIcon :path="mdiRestart" :size="13" /> 恢复默认摆放</button>
          </footer>
        </div>
      </div>
    </Teleport>

    <!-- 选照片弹窗（相框用；照片来自你日记的附件，仅本机） -->
    <Teleport to="body">
      <div v-if="photoOpen" class="catalog-overlay" @click.self="photoOpen = false">
        <div class="catalog-panel" role="dialog" aria-modal="true" aria-label="选择照片" data-testid="pal-photo-picker">
          <header class="catalog-head">
            <h2>选择一张照片</h2>
            <button class="catalog-close" aria-label="关闭" @click="photoOpen = false"><JrIcon :path="mdiClose" :size="16" /></button>
          </header>
          <p class="photo-picker-note">来自你日记里的照片（仅本机）。选一张放进相框。</p>
          <div class="catalog-grid photo-grid">
            <button v-for="row in photoRows" :key="row.id" class="catalog-card" :data-photo-id="row.id" @click="assignPhoto(row.id)">
              <img :src="row.url" :alt="row.fileName">
            </button>
          </div>
          <p v-if="!photoRows.length" class="photo-picker-note">还没有带照片的日记——写日记时添几张照片，再来装点房间。</p>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.jr-pal-room { position: relative; height: 240px; border-radius: 20px; overflow: hidden; isolation: isolate; background: #e9edef; touch-action: none; }

.room-wallpaper { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; z-index: 0; }
.room-spotlight { position: absolute; inset: 0; z-index: 1; background: radial-gradient(58% 88% at 50% -6%, rgba(255,255,255,0.85) 0%, rgba(255,255,255,0.25) 45%, rgba(255,255,255,0) 72%); pointer-events: none; }
.room-night { position: absolute; inset: 0; z-index: 46; background: linear-gradient(180deg, rgba(18,28,52,0.42) 0%, rgba(18,28,52,0.24) 100%); pointer-events: none; }
.room-weather { position: absolute; left: 14px; bottom: 36px; z-index: 47; font-size: 12px; background: rgba(255,255,255,0.72); border-radius: 999px; padding: 2px 9px; color: var(--jr-on-surface-variant); }
[data-theme="dark"] .room-weather { background: rgba(29,36,39,0.72); }

/* 世界层：固定纵横比，贴底居中（竖高房间上方留墙面） */
.room-world { position: absolute; bottom: 0; }
.room-world.is-portrait .room-mascot { height: 62%; }
.room-floor { position: absolute; left: 0; right: 0; bottom: 0; height: 14%; background: linear-gradient(180deg, rgba(120,138,146,0) 0%, rgba(120,138,146,0.18) 100%); pointer-events: none; }

.room-totem { position: absolute; cursor: grab; user-select: none; touch-action: none; }
.room-totem.dragging { cursor: grabbing; }
.room-totem img { width: 100%; height: auto; display: block; pointer-events: none; transition: transform 0.2s ease; filter: drop-shadow(0 3px 4px rgba(40,60,70,0.18)); }
.room-totem.dragging img { transition: none; }
.room-totem.sel img { filter: drop-shadow(0 3px 4px rgba(40,60,70,0.18)) drop-shadow(0 0 0 1px rgba(68,192,255,0.35)); outline: 1.5px dashed rgba(68,192,255,0.7); outline-offset: 3px; border-radius: 6px; }

.totem-actions { position: absolute; transform: translateX(-50%); display: flex; gap: 2px; background: #fff; border: 1px solid var(--jr-outline-variant); border-radius: 999px; padding: 3px 5px; box-shadow: 0 4px 14px rgba(20,40,50,0.16); z-index: 50; }
[data-theme="dark"] .totem-actions { background: #232a2d; }
.totem-actions button { width: 26px; height: 26px; border-radius: 50%; border: 0; background: none; color: var(--jr-on-surface-variant); display: flex; align-items: center; justify-content: center; cursor: pointer; }
.totem-actions button:hover { background: var(--jr-surface-variant); }
.totem-actions button[data-act="remove"]:hover { background: #d34f5e; color: #fff; }
.totem-actions button[data-act="water"]:hover { background: #4a90c9; color: #fff; }

.fx { position: absolute; left: 50%; top: 10%; font-size: 15px; pointer-events: none; animation: pal-fx 0.95s ease-out forwards; z-index: 30; }
.fx.drop { top: 0; animation-name: pal-drop; }
.fx.star { animation-name: pal-rise; }

.frame-photo { position: absolute; object-fit: cover; pointer-events: none; }

.catalog-balance { font-size: 12.5px; font-weight: 800; color: var(--jr-on-surface); background: var(--jr-surface-variant); border-radius: 999px; padding: 4px 11px; margin-right: auto; margin-left: 10px; }
.catalog-note { margin: 10px 0 0; font-size: 12px; color: var(--jr-on-surface-variant); background: var(--jr-surface-variant); border-radius: 10px; padding: 8px 11px; }
.photo-picker-note { margin: 0 0 10px; font-size: 12px; color: var(--jr-on-surface-variant); }
.photo-grid { max-height: 52vh; overflow-y: auto; }
.photo-grid .catalog-card { padding: 4px; }
.photo-grid .catalog-card img { width: 100%; height: 84px; object-fit: cover; border-radius: 8px; }

.room-mascot { position: absolute; left: 50%; bottom: 0; transform: translateX(-50%); height: 88%; aspect-ratio: 390 / 525; z-index: 0; pointer-events: none; }
.mascot-hit { position: absolute; left: 50%; bottom: 0; transform: translateX(-50%); width: 64%; height: 44%; pointer-events: auto; cursor: pointer; background: none; border: 0; padding: 0; border-radius: 14px; }
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
