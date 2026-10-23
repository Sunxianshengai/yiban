// 字号档位 → 直接写 documentElement 的内联 font-size。
//
// 为什么不用 data-font-level / CSS 变量（都是实测掉进去的坑）：
// - html{font-size:calc(14px * var(--font-scale))}：每次切档 38~48ms 长帧，
//   浏览器要从 var() 求值根字号，样式计算阶段反复回查父级布局；
// - html[data-font-level='N']{font-size:…}：同样 40~48ms，因为改根元素属性会让
//   整棵树的选择器重新匹配一遍，再叠加一次全量重排；
// - 内联 style.fontSize：实测 6~14ms，稳定无长帧，走的是「只失效字号、直接重排」快路径。
// 用户实际感知的卡顿就是这一类 40ms+ 的掉帧，所以这里选内联写法。
// 档位用序号索引 FONT_SCALES，避免 1.0/1.3 这类倍数字符串化后匹配不上。
import {FONT_SCALES} from './core.mjs';

export function applyFontScale(scale) {
  const level=Math.max(0,FONT_SCALES.findIndex(f=>Number(f.id)===Number(scale)));
  const root=document.documentElement;
  const px=`${Math.round(14*Number(FONT_SCALES[level].id)*10000)/10000}px`;
  if(root.style.fontSize!==px)root.style.fontSize=px;
}
