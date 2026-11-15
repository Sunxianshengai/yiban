export const houseLevels = ['一楼', '二楼', '三楼', '露台'] as const
export const floorRise = 2.8
export const houseWidth = 10.8
export const houseDepth = 6.6
export const playerRadius = .17

export interface HouseStop {
  id: string
  label: string
  floor: number
  position: [number, number]
  look: [number, number]
}

export const porch: HouseStop = { id: 'porch', label: '入户门外', floor: 0, position: [2.47, 4.10], look: [2.47, 2] }

export const houseStops: HouseStop[] = [
  { id: 'entrance', label: '玄关', floor: 0, position: [2.70, 2.68], look: [.9, -.85] },
  { id: 'living', label: '客厅', floor: 0, position: [-3.32, 1.95], look: [-2.95, -2] },
  { id: 'dining', label: '餐厅', floor: 0, position: [-.47, 2.18], look: [.9, .36] },
  { id: 'kitchen', label: '厨房', floor: 0, position: [1.62, -1.20], look: [1.08, -2.79] },
  { id: 'bedroom', label: '主卧', floor: 1, position: [-3.35, 1.93], look: [-3.07, -1.71] },
  { id: 'landing', label: '卧室门口', floor: 1, position: [.30, .02], look: [-.67, 0] },
  { id: 'play', label: '儿童小窝', floor: 1, position: [2.37, 1.16], look: [.64, 2.11] },
  { id: 'bath', label: '浴室', floor: 1, position: [2.50, -1.54], look: [2.15, -2.87] },
  { id: 'reading', label: '窗边阅读角', floor: 2, position: [-2.18, -.87], look: [-3.54, -2.48] },
  { id: 'craft', label: '手作角', floor: 2, position: [.91, -.69], look: [2.05, -2.54] },
  { id: 'loft', label: '阁楼休息区', floor: 2, position: [-.13, 2.05], look: [-2.81, 2.04] },
  { id: 'terrace', label: '星空露台', floor: 3, position: [-.65, 1.55], look: [-3.15, -.65] },
  { id: 'sky-garden', label: '空中花房', floor: 3, position: [1.45, -1.25], look: [1.55, -2.65] },
]

export const stairStops: HouseStop[] = houseLevels.map((_, floor) => {
  const x = floor >= 2 ? 4.76 : 3.64
  return { id: `stair-${floor}`, label: '楼梯口', floor, position: [x, 2.92], look: [x, .40] }
})

export interface Bounds2D { left: number; right: number; front: number; back: number }

export interface HouseMapRoom extends Bounds2D { stop: string; short: string; color: 'oak' | 'sage' | 'blue' }

export const mapRooms: HouseMapRoom[][] = [
  [
    { stop: 'living', short: '客厅', left: -5.25, right: -.85, back: -3.16, front: 3.16, color: 'oak' },
    { stop: 'kitchen', short: '厨房', left: -.85, right: 3.08, back: -3.16, front: -1.02, color: 'sage' },
    { stop: 'dining', short: '餐厅', left: -.85, right: 3.08, back: -1.02, front: 1.88, color: 'oak' },
    { stop: 'entrance', short: '玄关', left: -.85, right: 3.08, back: 1.88, front: 3.16, color: 'sage' },
  ], [
    { stop: 'bedroom', short: '主卧', left: -5.25, right: -.67, back: -3.16, front: 3.16, color: 'blue' },
    { stop: 'play', short: '儿童小窝', left: -.67, right: 1.45, back: -3.16, front: 1.87, color: 'oak' },
    { stop: 'bath', short: '浴室', left: 1.45, right: 3.08, back: -3.16, front: -.86, color: 'sage' },
    { stop: 'landing', short: '卧室门口', left: -.67, right: 3.08, back: 1.87, front: 3.16, color: 'oak' },
  ], [
    { stop: 'reading', short: '阅读角', left: -5.25, right: -.75, back: -3.16, front: .23, color: 'sage' },
    { stop: 'craft', short: '手作角', left: -.75, right: 3.08, back: -3.16, front: .23, color: 'oak' },
    { stop: 'loft', short: '休息区', left: -5.25, right: 3.08, back: .23, front: 3.16, color: 'blue' },
  ], [
    { stop: 'terrace', short: '星空露台', left: -5.25, right: -.20, back: -3.16, front: 3.16, color: 'blue' },
    { stop: 'sky-garden', short: '空中花房', left: -.20, right: 3.08, back: -3.16, front: 3.16, color: 'sage' },
  ],
]

export const stairs = {
  left: 3.08, right: 5.32, back: -1.78, front: 2.48,
  turn: -.88, middle: 4.20, laneWidth: 1.06,
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
  // 一楼：客厅、餐厅、厨房、玄关
  [
    { kind: 'rug', left: -4.25, right: -1.65, back: -1.85, front: .45 },
    { kind: 'furniture', left: -4.65, right: -1.85, back: -2.90, front: -1.95 }, // 沙发
    { kind: 'furniture', left: -3.65, right: -2.25, back: -1.05, front: -.25 }, // 茶几
    { kind: 'furniture', left: .15, right: 1.65, back: .18, front: 1.28 }, // 餐桌
    { kind: 'counter', left: -.65, right: 2.75, back: -3.14, front: -2.42 }, // 厨房台面
    { kind: 'fixture', left: 2.62, right: 3.22, back: -3.14, front: -2.50 }, // 冰箱
    { kind: 'furniture', left: .85, right: 1.85, back: 2.55, front: 3.12 }, // 玄关柜
  ],
  // 二楼：主卧、儿童小窝、浴室
  [
    { kind: 'wall', left: -.75, right: -.59, back: -3.20, front: -.55 }, // 卧室北墙
    { kind: 'wall', left: -.75, right: -.59, back: .55, front: 3.20 }, // 卧室南墙
    { kind: 'wall', left: 1.37, right: 1.49, back: -3.20, front: -.86 }, // 浴室西墙
    { kind: 'wall', left: 1.37, right: 2.22, back: -.92, front: -.80 }, // 浴室南墙
    { kind: 'furniture', left: -4.35, right: -2.10, back: -2.30, front: -.15 }, // 主卧双人床
    { kind: 'furniture', left: -2.15, right: -1.15, back: 2.25, front: 3.12 }, // 衣柜
    { kind: 'furniture', left: -.10, right: 1.05, back: -2.55, front: -1.15 }, // 儿童床
    { kind: 'fixture', left: 1.52, right: 2.18, back: -3.10, front: -1.72 }, // 浴缸
    { kind: 'fixture', left: 2.35, right: 2.95, back: -3.12, front: -2.60 }, // 洗手台
    { kind: 'fixture', left: 1.55, right: 2.02, back: -1.68, front: -1.15, round: true }, // 马桶
  ],
  // 三楼：阅读角、手作角、阁楼休息区
  [
    { kind: 'rug', left: -4.35, right: -1.75, back: .60, front: 2.85 },
    { kind: 'furniture', left: -3.95, right: -1.85, back: -3.05, front: -2.35 }, // 书桌与双屏
    { kind: 'furniture', left: 1.35, right: 2.95, back: -3.05, front: -1.65 }, // 手作台
    { kind: 'furniture', left: -4.25, right: -1.85, back: 2.15, front: 3.08 }, // 阁楼沙发
    { kind: 'furniture', left: -3.55, right: -2.45, back: .85, front: 1.45 }, // 阁楼茶几
  ],
  // 露台：星空露台、空中花房
  [
    { kind: 'rug', left: -3.80, right: -.65, back: -.85, front: 2.25 }, // 木甲板
    { kind: 'furniture', left: -3.45, right: -1.65, back: .95, front: 2.10 }, // 户外双人沙发
    { kind: 'furniture', left: -2.95, right: -2.05, back: -.15, front: .55, round: true }, // 露台小圆桌
    { kind: 'counter', left: .35, right: 2.65, back: -2.85, front: -2.15 }, // 空中花房花箱
  ],
]

export function blocksWalk(x: number, z: number, bounds: Bounds2D, radius = playerRadius) {
  const nearestX = Math.max(bounds.left, Math.min(x, bounds.right))
  const nearestZ = Math.max(bounds.back, Math.min(z, bounds.front))
  return (x - nearestX) ** 2 + (z - nearestZ) ** 2 < radius ** 2
}
