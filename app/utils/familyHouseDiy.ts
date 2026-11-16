export type WallStyleId = 'stone-brick' | 'cream-plaster' | 'sage-plaster' | 'warm-brick' | 'slate-stone'
export type FloorStyleId = 'warm-oak' | 'honey-walnut' | 'light-ash' | 'terrazzo'

export interface DiyFurnitureOption {
  modelKey: string
  label: string
  category: 'seating' | 'storage' | 'table' | 'decor'
  emoji: string
  scale: number
  hintSize: string
}

export interface DiyPlacedItem {
  id: string
  modelKey: string
  floor: number
  x: number
  z: number
  rotation: number
}

export interface FamilyHouseDiyState {
  wallStyle: WallStyleId
  floorStyle: FloorStyleId
  items: DiyPlacedItem[]
}

export const WALL_STYLES: Array<{ id: WallStyleId; label: string; color: string; usesStoneMap: boolean; desc: string }> = [
  { id: 'stone-brick', label: '天然石砖', color: '#f4f5f2', usesStoneMap: true, desc: '交错条石条纹与灰缝凹凸' },
  { id: 'cream-plaster', label: '奶油白漆', color: '#f6f2ea', usesStoneMap: false, desc: '温润哑光奶白灰泥' },
  { id: 'sage-plaster', label: '鼠尾草绿', color: '#dbe3d8', usesStoneMap: false, desc: '柔和北欧莫兰迪绿' },
  { id: 'warm-brick', label: '暖陶红砖', color: '#d89b84', usesStoneMap: true, desc: '复古暖陶色砌砖条纹' },
  { id: 'slate-stone', label: '极简深岩', color: '#8f9694', usesStoneMap: true, desc: '沉稳深灰天然石材' },
]

export const FLOOR_STYLES: Array<{ id: FloorStyleId; label: string; color: string; useTile: boolean; desc: string }> = [
  { id: 'warm-oak', label: '浅色橡木', color: '#ebd4b4', useTile: false, desc: '自然原木拼花地板' },
  { id: 'honey-walnut', label: '焦糖胡桃', color: '#b48256', useTile: false, desc: '温暖深色胡桃木纹' },
  { id: 'light-ash', label: '北欧白蜡', color: '#f2eadc', useTile: false, desc: '极简浅米白蜡木' },
  { id: 'terrazzo', label: '浅灰水磨石', color: '#e5e7e4', useTile: true, desc: '清爽哑光石材方砖' },
]

export const DIY_FURNITURE_CATALOG: DiyFurnitureOption[] = [
  { modelKey: 'armchair', label: '单人扶手椅', category: 'seating', emoji: '🪑', scale: 1, hintSize: '0.8m' },
  { modelKey: 'sofa-2seat', label: '双人布艺沙发', category: 'seating', emoji: '🛋️', scale: 1, hintSize: '1.5m' },
  { modelKey: 'sofa-3seat', label: '三人客厅沙发', category: 'seating', emoji: '🛋️', scale: 1, hintSize: '2.1m' },
  { modelKey: 'ergo-chair', label: '人体工学椅', category: 'seating', emoji: '💺', scale: 1, hintSize: '0.7m' },
  { modelKey: 'dining-chair', label: '餐椅', category: 'seating', emoji: '🪑', scale: 1, hintSize: '0.5m' },
  { modelKey: 'bookshelf', label: '原木书架', category: 'storage', emoji: '📚', scale: 1, hintSize: '1.0m' },
  { modelKey: 'steel-shelf', label: '铁艺置物架', category: 'storage', emoji: '🗄️', scale: 0.09, hintSize: '0.9m' },
  { modelKey: 'display-shelf', label: '展示矮柜', category: 'storage', emoji: '🪵', scale: 1, hintSize: '1.2m' },
  { modelKey: 'sideboard', label: '餐边储物柜', category: 'storage', emoji: '🚪', scale: 1, hintSize: '1.4m' },
  { modelKey: 'coffee-table', label: '圆润茶几', category: 'table', emoji: '☕', scale: 1, hintSize: '0.9m' },
  { modelKey: 'patio-table', label: '露台休闲桌', category: 'table', emoji: '🪵', scale: 1, hintSize: '0.8m' },
  { modelKey: 'dining-table', label: '原木餐桌', category: 'table', emoji: '🍽️', scale: 1, hintSize: '1.5m' },
  { modelKey: 'tall-plant', label: '大型龟背竹', category: 'decor', emoji: '🌿', scale: 0.88, hintSize: '0.6m' },
  { modelKey: 'small-plant', label: '桌面小绿植', category: 'decor', emoji: '🪴', scale: 0.95, hintSize: '0.4m' },
  { modelKey: 'floor-lamp', label: '落地氛围灯', category: 'decor', emoji: '🛋️', scale: 1, hintSize: '0.5m' },
  { modelKey: 'cat-tree', label: '宠物爬架', category: 'decor', emoji: '🐾', scale: 1, hintSize: '0.7m' },
  { modelKey: 'pet-bed', label: '宠物软窝', category: 'decor', emoji: '🐶', scale: 1, hintSize: '0.7m' },
]

const DIY_STORAGE_KEY = 'jr.familyHouseDiy.v1'

export function defaultDiyState(): FamilyHouseDiyState {
  return {
    wallStyle: 'stone-brick',
    floorStyle: 'warm-oak',
    items: [],
  }
}

export function loadDiyState(): FamilyHouseDiyState {
  if (!import.meta.client) return defaultDiyState()
  try {
    const raw = localStorage.getItem(DIY_STORAGE_KEY)
    if (!raw) return defaultDiyState()
    const parsed = JSON.parse(raw)
    const wallValid = WALL_STYLES.some((w) => w.id === parsed?.wallStyle)
    const floorValid = FLOOR_STYLES.some((f) => f.id === parsed?.floorStyle)
    const items = Array.isArray(parsed?.items)
      ? parsed.items.filter((it: any) =>
          typeof it?.id === 'string'
          && typeof it?.modelKey === 'string'
          && Number.isInteger(it?.floor)
          && Number.isFinite(it?.x)
          && Number.isFinite(it?.z)
          && Number.isFinite(it?.rotation))
      : []
    return {
      wallStyle: wallValid ? parsed.wallStyle : 'stone-brick',
      floorStyle: floorValid ? parsed.floorStyle : 'warm-oak',
      items,
    }
  } catch {
    return defaultDiyState()
  }
}

export function saveDiyState(state: FamilyHouseDiyState) {
  if (!import.meta.client) return
  try {
    localStorage.setItem(DIY_STORAGE_KEY, JSON.stringify(state))
  } catch { /* ignore */ }
}
