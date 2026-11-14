/**
 * Pal 房间家具（totems）目录 —— M-122。
 *
 * 证据：journey-replica/evidence/derived/pal-totems/（原版 6.0.1 app.asar 解包 + CKWhi-kr.js 交互模型）。
 * 原版完整目录/代币购买走云端（sync.journey.cloud/odyssey/v3 + pal-assets.journey.cloud），
 * 本地只做免费目录：空态四件套 + 会员预览间的家具同名复刻。
 *
 * 素材为自绘 SVG 占位（与原版同名、观感对齐），之后用即梦同风格图替换：
 * 同名换 .png 时改这里对应 src 一行即可，布局与交互不动。
 */

export interface PalTotemDef {
  id: string
  name: string
  src: string
  /** 渲染宽度 = 舞台宽度的百分比；高度按素材纵横比自动 */
  w: number
  /** 素材纵横比（高/宽），用于把动作条定位在家具顶边（旋转不跟随） */
  ar: number
  /** 默认摆放：中心 x（%），bottom = 离舞台底部（%）。壁挂件用大 bottom 贴墙。 */
  x: number
  bottom: number
  z: number
  kind: 'wallpaper' | 'furniture' | 'plant'
  /** 生长型（盆栽/花）：浇水进阶。占位阶段用缩放表达（原版是每阶段独立素材）。 */
  growable?: { maxStage: number }
}

export const PAL_TOTEMS: PalTotemDef[] = [
  { id: 'modular-side-table-red', name: '红色边几', src: '/pal-totems/modular-side-table-red.svg', w: 13, ar: 1.04, x: 24, bottom: 3, z: 3, kind: 'furniture' },
  { id: 'stack-of-art-books', name: '艺术书堆', src: '/pal-totems/stack-of-art-books.svg', w: 11, ar: 0.59, x: 24, bottom: 40, z: 4, kind: 'furniture' },
  { id: 'potted-fan-palm', name: '棕榈盆栽', src: '/pal-totems/potted-fan-palm.svg', w: 17, ar: 1.3, x: 84, bottom: 3, z: 2, kind: 'plant', growable: { maxStage: 3 } },
  { id: 'red-tulips-clear-glass-vase', name: '红郁金香花瓶', src: '/pal-totems/red-tulips-clear-glass-vase.svg', w: 9, ar: 1.205, x: 52, bottom: 3, z: 2, kind: 'plant', growable: { maxStage: 3 } },
  { id: 'patterned-armchair-burgundy', name: '花纹扶手椅', src: '/pal-totems/patterned-armchair-burgundy.svg', w: 21, ar: 1.033, x: 74, bottom: 3, z: 1, kind: 'furniture' },
  { id: 'arched-glass-window-frame', name: '拱形玻璃窗', src: '/pal-totems/arched-glass-window-frame.svg', w: 12, ar: 1.583, x: 40, bottom: 13, z: 1, kind: 'furniture' },
  { id: 'white-french-double-door', name: '法式双开门', src: '/pal-totems/white-french-double-door.svg', w: 14, ar: 1.417, x: 66, bottom: 1, z: 1, kind: 'furniture' },
  { id: 'picture-frame-small-square-red', name: '小红相框', src: '/pal-totems/picture-frame-small-square-red.svg', w: 7, ar: 1.0, x: 36, bottom: 52, z: 1, kind: 'furniture' },
  { id: 'flower-pendant-mustard-yellow', name: '花朵吊灯', src: '/pal-totems/flower-pendant-mustard-yellow.svg', w: 8, ar: 1.5, x: 56, bottom: 58, z: 1, kind: 'furniture' },
]

export const PAL_WALLPAPERS: PalTotemDef[] = [
  { id: 'wallpaper-light-blue-striped', name: '浅蓝条纹壁纸', src: '/pal-totems/wallpaper-light-blue-striped.svg', w: 100, ar: 0.65, x: 50, bottom: 0, z: 0, kind: 'wallpaper' },
]

export function palTotemDef(id: string): PalTotemDef | undefined {
  return PAL_TOTEMS.find(d => d.id === id) ?? PAL_WALLPAPERS.find(d => d.id === id)
}

/** 空态默认摆放（对齐原版 page-pal.png / 12-pal.png：壁纸+边几+书堆+盆栽，书叠在几上） */
export const PAL_ROOM_DEFAULT = {
  wallpaper: 'wallpaper-light-blue-striped',
  totems: ['modular-side-table-red', 'stack-of-art-books', 'potted-fan-palm'],
}
