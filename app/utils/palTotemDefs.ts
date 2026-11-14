/**
 * Pal 房间家具（totems）目录 —— M-122。
 *
 * 证据：journey-replica/evidence/derived/pal-totems/（原版 6.0.1 app.asar 解包 + CKWhi-kr.js 交互模型）。
 * 原版完整目录/代币购买走云端（sync.journey.cloud/odyssey/v3 + pal-assets.journey.cloud），
 * 本地只做免费目录 + 写日记攒⭐解锁（诚实版代币经济）。
 *
 * 素材为自绘 SVG（与原版同名、观感对齐），之后用即梦同风格图替换：
 * 同名换 .png 时改这里对应 src 一行即可，布局与交互不动。
 */
import {
  mdiLightbulbOnOutline, mdiFire, mdiMusicNote, mdiPiano, mdiSoccer, mdiFeather, mdiAutorenew, mdiCalendarMonthOutline,
  mdiBellOutline, mdiBookOpenPageVariant, mdiHeart, mdiShimmer, mdiCeilingLight, mdiClockOutline, mdiBroom,
} from '@mdi/js'

export interface PalTotemDef {
  id: string
  name: string
  src: string
  /** 渲染宽度 = 世界宽度的百分比；高度按素材纵横比自动 */
  w: number
  /** 素材纵横比（高/宽），用于把动作条定位在家具顶边（旋转不跟随） */
  ar: number
  /** 默认摆放：中心 x（%），bottom = 离世界底部（%）。壁挂件用大 bottom 贴墙。 */
  x: number
  bottom: number
  z: number
  kind: 'wallpaper' | 'furniture' | 'plant'
  /** 壁挂/悬空件：不画接触投影（窗/门/相框/吊灯/挂钟/黑板/鸟笼/地毯） */
  noShadow?: boolean
  /** 纵向布局档（竖房间/竖世界用）：不填则沿用横档尺寸 */
  p?: { w: number; x: number; bottom: number }
  /** 专属互动：动作条上多一个专属按钮，再次点击已选中的家具也会触发 */
  interact?: { kind: 'lamp' | 'fire' | 'melody' | 'arp' | 'roll' | 'chirp' | 'board' | 'date' | 'knock' | 'page' | 'sit' | 'sparkle' | 'swing' | 'chime' | 'pat' | 'purr'; icon: string; label: string; srcOn?: string }
  /** 相框：照片在素材里的开口区（百分比，相对素材框）。有值即可放照片（原版 totem 的 photoId 模型）。 */
  photo?: { ax: number; ay: number; aw: number; ah: number }
  /** 黑板：文字开口区（组件渲染最近日记片段/默认句） */
  board?: { ax: number; ay: number; aw: number; ah: number }
  /** 日历牌：日期开口区（组件渲染今天日期） */
  dateBox?: { ax: number; ay: number; aw: number; ah: number }
  /** 星星价格（诚实版代币）：有值的家具要先攒⭐解锁，原版为云端代币购买 */
  cost?: number
  /** 生长型（盆栽/花/鱼缸）：浇水/喂鱼进阶。占位阶段用缩放表达（原版是每阶段独立素材）。 */
  growable?: { maxStage: number; action?: 'water' | 'feed'; label?: string }
}

export const PAL_TOTEMS: PalTotemDef[] = [
  { id: 'modular-side-table-red', name: '红色边几', src: '/pal-totems/modular-side-table-red.svg', w: 13, ar: 1.04, x: 24, bottom: 3, z: 3, kind: 'furniture', p: { w: 30, x: 22, bottom: 4 }, interact: { kind: 'knock', icon: mdiBellOutline, label: '敲一敲' } },
  { id: 'stack-of-art-books', name: '艺术书堆', src: '/pal-totems/stack-of-art-books.svg', w: 11, ar: 0.59, x: 24, bottom: 40, z: 4, kind: 'furniture', p: { w: 24, x: 22, bottom: 27 }, interact: { kind: 'page', icon: mdiBookOpenPageVariant, label: '翻一翻' } },
  { id: 'potted-fan-palm', name: '棕榈盆栽', src: '/pal-totems/potted-fan-palm.svg', w: 17, ar: 1.3, x: 84, bottom: 3, z: 2, kind: 'plant', p: { w: 36, x: 86, bottom: 4 }, growable: { maxStage: 3 } },
  { id: 'red-tulips-clear-glass-vase', name: '红郁金香花瓶', src: '/pal-totems/red-tulips-clear-glass-vase.svg', w: 9, ar: 1.205, x: 52, bottom: 3, z: 2, kind: 'plant', p: { w: 16, x: 55, bottom: 4 }, growable: { maxStage: 3 } },
  { id: 'aquarium', name: '鱼缸', src: '/pal-totems/aquarium.svg', w: 16, ar: 0.8, x: 46, bottom: 3, z: 3, kind: 'furniture', p: { w: 30, x: 50, bottom: 5 }, cost: 6, growable: { maxStage: 2, action: 'feed', label: '喂鱼' } },
  { id: 'bookshelf', name: '木书架', src: '/pal-totems/bookshelf.svg', w: 15, ar: 1.2, x: 12, bottom: 3, z: 3, kind: 'furniture', p: { w: 34, x: 20, bottom: 4 }, interact: { kind: 'page', icon: mdiBookOpenPageVariant, label: '抽一本' } },
  { id: 'wall-clock', name: '挂钟', src: '/pal-totems/wall-clock.svg', w: 9, ar: 1.25, x: 30, bottom: 52, z: 1, kind: 'furniture', p: { w: 20, x: 70, bottom: 62 }, interact: { kind: 'chime', icon: mdiClockOutline, label: '报时' }, noShadow: true },
  { id: 'rug-round', name: '圆地毯', src: '/pal-totems/rug-round.svg', w: 22, ar: 0.318, x: 50, bottom: 1, z: 1, kind: 'furniture', p: { w: 44, x: 30, bottom: 1 }, interact: { kind: 'pat', icon: mdiBroom, label: '拍一拍' }, noShadow: true },
  { id: 'cat-sitting', name: '猫咪', src: '/pal-totems/cat-sitting.svg', w: 12, ar: 0.78, x: 60, bottom: 3, z: 3, kind: 'furniture', p: { w: 22, x: 60, bottom: 3 }, interact: { kind: 'purr', icon: mdiHeart, label: '撸猫' } },
  { id: 'floor-lamp', name: '落地灯', src: '/pal-totems/floor-lamp.svg', w: 13, ar: 1.7, x: 8, bottom: 3, z: 3, kind: 'furniture', p: { w: 26, x: 10, bottom: 4 }, interact: { kind: 'lamp', icon: mdiLightbulbOnOutline, label: '开关灯', srcOn: '/pal-totems/floor-lamp-on.svg' } },
  { id: 'fireplace', name: '壁炉', src: '/pal-totems/fireplace.svg', w: 20, ar: 0.846, x: 88, bottom: 3, z: 2, kind: 'furniture', p: { w: 40, x: 84, bottom: 4 }, cost: 8, interact: { kind: 'fire', icon: mdiFire, label: '拨火' } },
  { id: 'speaker', name: '音箱', src: '/pal-totems/speaker.svg', w: 11, ar: 1.25, x: 66, bottom: 3, z: 3, kind: 'furniture', p: { w: 20, x: 88, bottom: 4 }, cost: 4, interact: { kind: 'melody', icon: mdiMusicNote, label: '点唱' } },
  { id: 'keyboard', name: '电子琴', src: '/pal-totems/keyboard.svg', w: 18, ar: 0.5, x: 36, bottom: 3, z: 3, kind: 'furniture', p: { w: 34, x: 38, bottom: 4 }, interact: { kind: 'arp', icon: mdiPiano, label: '弹一段' } },
  { id: 'soccer-ball', name: '足球', src: '/pal-totems/soccer-ball.svg', w: 7, ar: 1.0, x: 62, bottom: 3, z: 3, kind: 'furniture', p: { w: 13, x: 64, bottom: 3 }, interact: { kind: 'roll', icon: mdiSoccer, label: '踢一下' } },
  { id: 'birdcage', name: '鸟笼', src: '/pal-totems/birdcage.svg', w: 10, ar: 1.57, x: 88, bottom: 26, z: 1, kind: 'furniture', p: { w: 18, x: 90, bottom: 30 }, interact: { kind: 'chirp', icon: mdiFeather, label: '逗鸟' }, noShadow: true },
  { id: 'blackboard', name: '小黑板', src: '/pal-totems/blackboard.svg', w: 18, ar: 0.75, x: 70, bottom: 46, z: 1, kind: 'furniture', p: { w: 34, x: 72, bottom: 52 }, interact: { kind: 'board', icon: mdiAutorenew, label: '下一句' }, board: { ax: 12, ay: 14, aw: 76, ah: 68 }, noShadow: true },
  { id: 'wall-calendar', name: '日历牌', src: '/pal-totems/wall-calendar.svg', w: 9, ar: 1.36, x: 44, bottom: 52, z: 1, kind: 'furniture', p: { w: 17, x: 44, bottom: 58 }, interact: { kind: 'date', icon: mdiCalendarMonthOutline, label: '报日期' }, dateBox: { ax: 15, ay: 32, aw: 70, ah: 40 } },
  { id: 'patterned-armchair-burgundy', name: '花纹扶手椅', src: '/pal-totems/patterned-armchair-burgundy.svg', w: 21, ar: 1.033, x: 74, bottom: 3, z: 1, kind: 'furniture', p: { w: 40, x: 79, bottom: 3 }, cost: 3, interact: { kind: 'sit', icon: mdiHeart, label: '小憩' } },
  { id: 'arched-glass-window-frame', name: '拱形玻璃窗', src: '/pal-totems/arched-glass-window-frame.svg', w: 12, ar: 1.583, x: 40, bottom: 13, z: 1, kind: 'furniture', p: { w: 30, x: 33, bottom: 42 }, interact: { kind: 'sparkle', icon: mdiShimmer, label: '擦一擦' }, noShadow: true },
  { id: 'white-french-double-door', name: '法式双开门', src: '/pal-totems/white-french-double-door.svg', w: 14, ar: 1.417, x: 66, bottom: 1, z: 1, kind: 'furniture', p: { w: 28, x: 67, bottom: 38 }, interact: { kind: 'knock', icon: mdiBellOutline, label: '敲门' }, noShadow: true },
  { id: 'picture-frame-small-square-red', name: '小红相框', src: '/pal-totems/picture-frame-small-square-red.svg', w: 7, ar: 1.0, x: 36, bottom: 52, z: 1, kind: 'furniture', p: { w: 14, x: 38, bottom: 74 }, photo: { ax: 25, ay: 25, aw: 50, ah: 50 }, noShadow: true },
  { id: 'flower-pendant-mustard-yellow', name: '花朵吊灯', src: '/pal-totems/flower-pendant-mustard-yellow.svg', w: 8, ar: 1.5, x: 56, bottom: 58, z: 1, kind: 'furniture', p: { w: 15, x: 52, bottom: 78 }, cost: 5, interact: { kind: 'swing', icon: mdiCeilingLight, label: '拨一拨' }, noShadow: true },
]

export const PAL_WALLPAPERS: PalTotemDef[] = [
  { id: 'wallpaper-light-blue-striped', name: '浅蓝条纹', src: '/pal-totems/wallpaper-light-blue-striped.svg', w: 100, ar: 0.65, x: 50, bottom: 0, z: 0, kind: 'wallpaper' },
  { id: 'wallpaper-sage-leaf', name: '浅绿叶片', src: '/pal-totems/wallpaper-sage-leaf.svg', w: 100, ar: 0.65, x: 50, bottom: 0, z: 0, kind: 'wallpaper' },
  { id: 'wallpaper-cream-dot', name: '米底圆点', src: '/pal-totems/wallpaper-cream-dot.svg', w: 100, ar: 0.65, x: 50, bottom: 0, z: 0, kind: 'wallpaper' },
  { id: 'wallpaper-dusk-glow', name: '黄昏暖阳', src: '/pal-totems/wallpaper-dusk-glow.svg', w: 100, ar: 0.65, x: 50, bottom: 0, z: 0, kind: 'wallpaper' },
  { id: 'wallpaper-night-sky', name: '星空夜幕', src: '/pal-totems/wallpaper-night-sky.svg', w: 100, ar: 0.65, x: 50, bottom: 0, z: 0, kind: 'wallpaper' },
  { id: 'wallpaper-rain-fall', name: '雨天雨声', src: '/pal-totems/wallpaper-rain-fall.svg', w: 100, ar: 0.65, x: 50, bottom: 0, z: 0, kind: 'wallpaper' },
  { id: 'wallpaper-sakura', name: '樱花', src: '/pal-totems/wallpaper-sakura.svg', w: 100, ar: 0.65, x: 50, bottom: 0, z: 0, kind: 'wallpaper' },
  { id: 'wallpaper-mint-sky', name: '晴空薄荷', src: '/pal-totems/wallpaper-mint-sky.svg', w: 100, ar: 0.65, x: 50, bottom: 0, z: 0, kind: 'wallpaper' },
  { id: 'wallpaper-forest-mist', name: '森林晨雾', src: '/pal-totems/wallpaper-forest-mist.svg', w: 100, ar: 0.65, x: 50, bottom: 0, z: 0, kind: 'wallpaper' },
]

export function palTotemDef(id: string): PalTotemDef | undefined {
  return PAL_TOTEMS.find(d => d.id === id) ?? PAL_WALLPAPERS.find(d => d.id === id)
}

/** 空态默认摆放（对齐原版 page-pal.png / 12-pal.png：壁纸+边几+书堆+盆栽，书叠在几上） */
export const PAL_ROOM_DEFAULT = {
  wallpaper: 'wallpaper-light-blue-striped',
  totems: ['modular-side-table-red', 'stack-of-art-books', 'potted-fan-palm'],
}
