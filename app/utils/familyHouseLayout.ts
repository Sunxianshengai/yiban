export const houseLevels = ['一楼', '二楼', '三楼', '露台'] as const
export const floorRise = 2.8
export const houseWidth = 13.6
export const houseDepth = 8.4
export const halfWidth = houseWidth / 2
export const halfDepth = houseDepth / 2
export const playerRadius = .17

export interface HouseStop {
  id: string
  label: string
  floor: number
  position: [number, number]
  look: [number, number]
}

export const porch: HouseStop = { id: 'porch', label: '入户门外', floor: 0, position: [2.85, 5.05], look: [2.85, 2.5] }

export const houseStops: HouseStop[] = [
  { id: 'entrance', label: '玄关', floor: 0, position: [2.85, 3.35], look: [1.25, .65] },
  { id: 'living', label: '客厅', floor: 0, position: [-3.95, 1.35], look: [-3.95, 3.65] },
  { id: 'study', label: '工作间', floor: 0, position: [-4.15, -1.65], look: [-4.45, -3.55] },
  { id: 'dining', label: '餐厅', floor: 0, position: [-.25, 1.85], look: [1.25, .45] },
  { id: 'kitchen', label: '厨房', floor: 0, position: [1.10, -2.05], look: [1.10, -3.65] },
  { id: 'bedroom', label: '主卧', floor: 1, position: [-4.05, 2.25], look: [-4.05, -1.65] },
  { id: 'landing', label: '卧室门口', floor: 1, position: [.35, 2.85], look: [-.90, 0] },
  { id: 'play', label: '儿童小窝', floor: 1, position: [.55, 1.05], look: [.55, -2.10] },
  { id: 'bath', label: '浴室', floor: 1, position: [3.45, -2.05], look: [3.10, -3.65] },
  { id: 'reading', label: '窗边阅读角', floor: 2, position: [-3.25, -1.35], look: [-4.45, -3.55] },
  { id: 'craft', label: '手作角', floor: 2, position: [1.35, -1.35], look: [2.45, -3.45] },
  { id: 'loft', label: '阁楼休息区', floor: 2, position: [-.45, 2.45], look: [-3.65, 2.45] },
  { id: 'terrace', label: '星空露台', floor: 3, position: [-1.15, 1.95], look: [-3.85, -.45] },
  { id: 'sky-garden', label: '空中花房', floor: 3, position: [1.85, -1.35], look: [2.10, -3.35] },
]

export const stairStops: HouseStop[] = houseLevels.map((_, floor) => {
  const x = floor >= 2 ? 6.16 : 5.04
  return { id: `stair-${floor}`, label: '楼梯口', floor, position: [x, 3.25], look: [x, .40] }
})

export interface Bounds2D { left: number; right: number; front: number; back: number }

export interface HouseMapRoom extends Bounds2D { stop: string; short: string; color: 'oak' | 'sage' | 'blue' }

export const mapRooms: HouseMapRoom[][] = [
  [
    { stop: 'study', short: '工作间', left: -6.65, right: -2.15, back: -4.05, front: -.35, color: 'blue' },
    { stop: 'living', short: '客厅', left: -6.65, right: -1.20, back: -.35, front: 4.05, color: 'oak' },
    { stop: 'kitchen', short: '厨房', left: -2.15, right: 4.48, back: -4.05, front: -1.55, color: 'sage' },
    { stop: 'dining', short: '餐厅', left: -1.20, right: 4.48, back: -1.55, front: 2.35, color: 'oak' },
    { stop: 'entrance', short: '玄关', left: -1.20, right: 4.48, back: 2.35, front: 4.05, color: 'sage' },
  ], [
    { stop: 'bedroom', short: '主卧', left: -6.65, right: -.90, back: -4.05, front: 4.05, color: 'blue' },
    { stop: 'play', short: '儿童小窝', left: -.90, right: 2.05, back: -4.05, front: 2.25, color: 'oak' },
    { stop: 'bath', short: '浴室', left: 2.05, right: 4.48, back: -4.05, front: -1.15, color: 'sage' },
    { stop: 'landing', short: '卧室门口', left: -.90, right: 4.48, back: 2.25, front: 4.05, color: 'oak' },
  ], [
    { stop: 'reading', short: '阅读角', left: -6.65, right: -1.10, back: -4.05, front: .35, color: 'sage' },
    { stop: 'craft', short: '手作角', left: -1.10, right: 4.48, back: -4.05, front: .35, color: 'oak' },
    { stop: 'loft', short: '休息区', left: -6.65, right: 4.48, back: .35, front: 4.05, color: 'blue' },
  ], [
    { stop: 'terrace', short: '星空露台', left: -6.65, right: -.35, back: -4.05, front: 4.05, color: 'blue' },
    { stop: 'sky-garden', short: '空中花房', left: -.35, right: 4.48, back: -4.05, front: 4.05, color: 'sage' },
  ],
]

export const stairs = {
  left: 4.48, right: 6.72, back: -2.00, front: 2.70,
  turn: -1.00, middle: 5.60, laneWidth: 1.06,
} as const

export const stairLane = (x: number) => x < stairs.middle ? 'up' : 'down'

export const hasStairFootprint = (x: number, z: number) =>
  x > stairs.left - playerRadius && x < stairs.right && z > stairs.back - playerRadius && z < stairs.front

export function stairHeight(x: number, z: number, lowerFloor: number) {
  const progress = Math.max(0, Math.min(1, (stairs.front - z) / (stairs.front - stairs.turn)))
  return floorRise * (lowerFloor + (stairLane(x) === 'up' ? progress / 2 : 1 - progress / 2))
}

export interface HousePlanShape extends Bounds2D {
  kind: 'wall' | 'furniture' | 'counter' | 'rug' | 'fixture'
  round?: boolean
}

export const mapPlanShapes: HousePlanShape[][] = [
  // 一楼：工作间、客厅、餐厅、厨房、玄关（宽敞连通楼房户型）
  [
    { kind: 'wall', left: -6.65, right: -3.55, back: -.42, front: -.28 }, // 工作间南墙（留 1.4m 门洞）
    { kind: 'wall', left: -2.22, right: -2.08, back: -4.05, front: -1.75 }, // 工作间东墙（留 1.4m 门洞）
    { kind: 'furniture', left: -5.25, right: -3.65, back: -3.95, front: -3.25 }, // 工作间书桌
    { kind: 'rug', left: -5.65, right: -2.25, back: .60, front: 3.10 },
    { kind: 'furniture', left: -5.15, right: -2.75, back: .35, front: 1.15 }, // 客厅沙发
    { kind: 'furniture', left: -4.65, right: -3.25, back: 1.65, front: 2.30 }, // 茶几
    { kind: 'furniture', left: -4.85, right: -3.05, back: 3.45, front: 3.98 }, // 电视柜
    { kind: 'furniture', left: .45, right: 2.05, back: -.10, front: 1.00 }, // 餐桌
    { kind: 'counter', left: -1.00, right: 3.20, back: -4.02, front: -3.30 }, // 厨房台面
    { kind: 'fixture', left: 3.55, right: 4.18, back: -4.02, front: -3.35 }, // 冰箱
    { kind: 'furniture', left: .70, right: 1.70, back: 3.45, front: 3.98 }, // 玄关凳
  ],
  // 二楼：主卧、儿童小窝、浴室
  [
    { kind: 'wall', left: -.98, right: -.82, back: -4.05, front: -.55 }, // 卧室北墙
    { kind: 'wall', left: -.98, right: -.82, back: .55, front: 4.05 }, // 卧室南墙
    { kind: 'wall', left: 1.99, right: 2.11, back: -4.05, front: -1.15 }, // 浴室西墙
    { kind: 'wall', left: 1.99, right: 3.10, back: -1.21, front: -1.09 }, // 浴室南墙
    { kind: 'furniture', left: -5.15, right: -2.95, back: -2.75, front: -.55 }, // 主卧双人床
    { kind: 'furniture', left: -2.75, right: -1.75, back: 3.15, front: 4.00 }, // 衣柜
    { kind: 'furniture', left: -.10, right: 1.05, back: -3.20, front: -1.70 }, // 儿童床
    { kind: 'fixture', left: 2.25, right: 2.98, back: -3.68, front: -2.22 }, // 浴缸
    { kind: 'fixture', left: 3.45, right: 4.08, back: -4.00, front: -3.45 }, // 洗手台
    { kind: 'fixture', left: 2.30, right: 2.82, back: -2.05, front: -1.50, round: true }, // 马桶
  ],
  // 三楼：阅读角、手作角、阁楼休息区
  [
    { kind: 'rug', left: -5.25, right: -2.05, back: 1.25, front: 3.45 },
    { kind: 'furniture', left: -5.25, right: -3.65, back: -3.95, front: -3.25 }, // 书桌与双屏
    { kind: 'furniture', left: 1.65, right: 3.25, back: -3.92, front: -2.45 }, // 手作台
    { kind: 'furniture', left: -4.85, right: -2.45, back: 3.05, front: 3.98 }, // 阁楼沙发
    { kind: 'furniture', left: -4.35, right: -2.95, back: 1.50, front: 2.20 }, // 阁楼茶几
  ],
  // 露台：星空露台、空中花房
  [
    { kind: 'rug', left: -5.50, right: -.90, back: -1.15, front: 2.85 }, // 木甲板
    { kind: 'furniture', left: -4.35, right: -2.55, back: 1.55, front: 2.65 }, // 户外双人沙发
    { kind: 'furniture', left: -3.85, right: -2.85, back: -.10, front: .80, round: true }, // 露台小圆桌
    { kind: 'counter', left: .95, right: 3.25, back: -3.72, front: -2.98 }, // 空中花房花箱
  ],
]

export function blocksWalk(x: number, z: number, bounds: Bounds2D, radius = playerRadius) {
  const nearestX = Math.max(bounds.left, Math.min(x, bounds.right))
  const nearestZ = Math.max(bounds.back, Math.min(z, bounds.front))
  return (x - nearestX) ** 2 + (z - nearestZ) ** 2 < radius ** 2
}
