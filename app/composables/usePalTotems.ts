/**
 * Pal 房间家具的摆放状态 —— M-122。
 *
 * 数据模型对齐原版（evidence/derived/pal-totems/README.md）：
 * 实例 = { id, totemId, 位置 x/bottom, rotation, flipped, z, growthStage, growthUpdatedAt }。
 * 原版拆成 journey_pal_active_totems + journey_pal_totem_positions 两个键；
 * 这里合并成单个键 jr.palTotemInstances 原子读写，避免两表不同步。
 * 刷新后位置、层级、旋转、翻转、生长阶段都记得。
 */
import { PAL_ROOM_DEFAULT, palTotemDef, type PalTotemDef } from '~/utils/palTotemDefs'

export interface PalTotemInstance {
  id: string
  totemId: string
  x: number
  bottom: number
  rotation: number
  flipped: boolean
  z: number
  growthStage: number
  growthUpdatedAt?: number
  /** 相框里放的照片（mediaFilesV2 行 id，原版 totem 的 photoId 模型） */
  photoId?: number
}

const KEY = 'jr.palTotemInstances'

function clamp(n: number, lo: number, hi: number) { return Math.min(hi, Math.max(lo, n)) }

function makeInstance(def: PalTotemDef, portrait: boolean, offset = 0): PalTotemInstance {
  const d = portrait && def.p ? { ...def, w: def.p.w, x: def.p.x, bottom: def.p.bottom } : def
  return {
    id: `t${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    totemId: def.id,
    x: clamp(d.x + offset, 2, 98),
    bottom: d.bottom,
    rotation: 0,
    flipped: false,
    z: def.kind === 'wallpaper' ? 0 : def.z,
    growthStage: 0,
  }
}

/** 摆放是否还是某一档的「原始默认组合」（未拖动/旋转/生长过）——跨档切换时可安全重排 */
function matchesDefaults(items: PalTotemInstance[], portrait: boolean): boolean {
  const placedItems = items.filter(i => palTotemDef(i.totemId)?.kind !== 'wallpaper')
  if (placedItems.length !== PAL_ROOM_DEFAULT.totems.length) return false
  return PAL_ROOM_DEFAULT.totems.every(id => {
    const inst = placedItems.find(i => i.totemId === id)
    const raw = palTotemDef(id)!
    const d = portrait && raw.p ? { x: raw.p.x, bottom: raw.p.bottom } : { x: raw.x, bottom: raw.bottom }
    return !!inst && Math.abs(inst.x - d.x) < 0.6 && Math.abs(inst.bottom - d.bottom) < 0.6
      && inst.rotation === 0 && !inst.flipped && inst.growthStage === 0
  })
}

export function usePalTotems() {
  const instances = useState<PalTotemInstance[]>('jr.palTotemInstances', () => [])
  const initialized = useState<boolean>('jr.palTotemsInit', () => false)
  const hint = useState<string>('jr.palTotemHint', () => '')

  /** 挂载后从 localStorage 载入；没有记录就摆出原版空态默认组合（按当前布局档取默认摆位） */
  function init(portrait: boolean) {
    if (initialized.value) return
    initialized.value = true
    let saved: PalTotemInstance[] | null = null
    try {
      const raw = localStorage.getItem(KEY)
      if (raw) saved = JSON.parse(raw) as PalTotemInstance[]
    } catch { saved = null }
    const valid = (saved ?? []).filter(i => i && palTotemDef(i.totemId))
    if (saved && valid.length && !matchesDefaults(valid, portrait)) {
      // 原始默认摆位跨布局档（横↔竖）切换时按当前档重排；用户自定义过的摆放原样保留
      instances.value = valid
    } else {
      instances.value = [
        makeInstance(palTotemDef(PAL_ROOM_DEFAULT.wallpaper)!, portrait),
        ...PAL_ROOM_DEFAULT.totems.map(id => makeInstance(palTotemDef(id)!, portrait)),
      ]
    }
  }

  watch(instances, (v) => {
    if (!initialized.value) return
    try { localStorage.setItem(KEY, JSON.stringify(v)) } catch { /* 隐私模式写不进去就忽略 */ }
  }, { deep: true })

  const wallpaper = computed(() => instances.value.find(i => palTotemDef(i.totemId)?.kind === 'wallpaper'))
  const placed = computed(() => instances.value
    .filter(i => palTotemDef(i.totemId)?.kind !== 'wallpaper')
    .sort((a, b) => a.z - b.z))
  const placedCount = (totemId: string) => placed.value.filter(i => i.totemId === totemId).length

  function nextZ() { return Math.min(placed.value.reduce((m, i) => Math.max(m, i.z), 2) + 1, 45) } // 封顶，避免盖过房间级动作条(z50)

  /** 从目录摆一件；同款已摆会横向错开，避免完全重叠 */
  function addTotem(totemId: string, portrait: boolean): boolean {
    const def = palTotemDef(totemId)
    if (!def || def.kind === 'wallpaper') return false
    const offset = (placedCount(totemId) % 4) * 4.5
    instances.value = [...instances.value, makeInstance(def, portrait, offset)]
    return true
  }

  function swapWallpaper(totemId: string, portrait: boolean): boolean {
    const def = palTotemDef(totemId)
    if (!def || def.kind !== 'wallpaper') return false
    const next = instances.value.filter(i => palTotemDef(i.totemId)?.kind !== 'wallpaper')
    instances.value = [makeInstance(def, portrait), ...next]
    return true
  }

  function removeTotem(id: string) {
    instances.value = instances.value.filter(i => i.id !== id)
  }

  function patch(id: string, fn: (inst: PalTotemInstance) => PalTotemInstance) {
    instances.value = instances.value.map(i => (i.id === id ? fn(i) : i))
  }

  function move(id: string, x: number, bottom: number) {
    patch(id, i => ({ ...i, x: clamp(x, 2, 98), bottom: clamp(bottom, 0, 92) }))
  }
  function rotate(id: string) { patch(id, i => ({ ...i, rotation: (i.rotation + 90) % 360 })) }
  function flip(id: string) { patch(id, i => ({ ...i, flipped: !i.flipped })) }
  function front(id: string) { patch(id, i => ({ ...i, z: nextZ() })) }
  function back(id: string) { patch(id, i => ({ ...i, z: Math.max(1, i.z - 1) })) }

  /** 浇水/喂鱼（growable.action 区分）：返回 'grow' | 'max'。原版有 growthUpdatedAt 冷却，复刻按当前阶段直达上限。 */
  function water(id: string): 'grow' | 'max' | null {
    const inst = instances.value.find(i => i.id === id)
    const def = inst ? palTotemDef(inst.totemId) : undefined
    if (!inst || !def?.growable) return null
    const isFeed = def.growable.action === 'feed'
    if (inst.growthStage >= def.growable.maxStage) {
      hint.value = isFeed ? `${def.name}里的鱼吃饱啦，谢谢你照顾它们。` : `${def.name}已经长到最大啦，谢谢你照顾它。`
      return 'max'
    }
    const stage = inst.growthStage + 1
    patch(id, i => ({ ...i, growthStage: stage, growthUpdatedAt: Date.now() }))
    hint.value = stage >= def.growable.maxStage
      ? (isFeed ? `${def.name}里的鱼都长大啦！` : `${def.name}长成啦！`)
      : (isFeed ? `${def.name}里的鱼更精神了。` : `${def.name}又长高了一点。`)
    return 'grow'
  }

  /** 相框放照片 / 清除（photoId 为 mediaFilesV2 行 id） */
  function setPhoto(id: string, photoId: number | undefined) {
    patch(id, i => ({ ...i, photoId }))
  }

  /** 回到原版空态默认组合（按当前布局档） */
  function resetRoom(portrait: boolean) {
    instances.value = [
      makeInstance(palTotemDef(PAL_ROOM_DEFAULT.wallpaper)!, portrait),
      ...PAL_ROOM_DEFAULT.totems.map(id => makeInstance(palTotemDef(id)!, portrait)),
    ]
  }

  return { instances, wallpaper, placed, hint, init, addTotem, swapWallpaper, removeTotem, move, rotate, flip, front, back, water, setPhoto, resetRoom, placedCount }
}
