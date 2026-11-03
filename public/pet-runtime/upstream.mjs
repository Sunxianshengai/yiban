// vendor/dsh-pet/src/shared/hotkey.ts
function isTypingTarget(target) {
  const el = target;
  if (!el || typeof el.tagName !== "string") return false;
  const tag = el.tagName.toLowerCase();
  if (tag === "input" || tag === "textarea" || tag === "select") return true;
  return el.isContentEditable === true;
}
function isBareKey(e, key) {
  if (e.ctrlKey || e.metaKey || e.altKey) return false;
  if (String(e.key).toLowerCase() !== key) return false;
  return !isTypingTarget(e.target);
}

// vendor/dsh-pet/src/shared/display-hotkey.ts
var DISPLAY_ORDER = ["web", "desktop", "both", "none"];
var DISPLAY_HOTKEY_HINTS = DISPLAY_ORDER.map((_, index) => String(index + 1) + " \u952E");
function displayOfHotkey(e) {
  for (let index = 0; index < DISPLAY_ORDER.length; index += 1) {
    if (isBareKey(e, String(index + 1))) return DISPLAY_ORDER[index];
  }
  return void 0;
}

// vendor/dsh-pet/src/shared/menu/tree.ts
var SLEEP_ALLOWED_ACTIONS = ["sleep", "wake", "home", "set-display", "reload", "third-party"];
var isSleepAllowedAction = (action) => action !== void 0 && SLEEP_ALLOWED_ACTIONS.includes(action);
var DISPLAY_LABELS = {
  web: "\u4EC5\u7F51\u9875",
  desktop: "\u4EC5\u684C\u9762",
  both: "\u4E24\u8005",
  none: "\u90FD\u4E0D"
};
var displayMenuBranch = () => ({
  label: "\u663E\u793A\u4F4D\u7F6E",
  children: DISPLAY_ORDER.map((display, index) => ({
    label: DISPLAY_LABELS[display],
    action: "set-display",
    display,
    hint: DISPLAY_HOTKEY_HINTS[index]
  }))
});
var MORE_MENU_LABEL = "\u66F4\u591A";
function readMenuItems(data, surface2) {
  if (!data || typeof data !== "object") return [];
  const items = data.items;
  if (!Array.isArray(items)) return [];
  const out = [];
  for (const item of items) {
    if (!item || typeof item !== "object") continue;
    const rec = item;
    const rawTarget = rec.target;
    const target = rawTarget === "web" || rawTarget === "desktop" || rawTarget === "both" ? rawTarget : "both";
    if (target !== "both" && target !== surface2) continue;
    const owner = rec.owner;
    const label = rec.label;
    if (typeof owner === "string" && owner !== "" && typeof label === "string" && label !== "") {
      out.push({ owner, label });
    }
  }
  return out;
}
function buildMoreBranch(items) {
  const groups = /* @__PURE__ */ new Map();
  for (const item of items) {
    const list = groups.get(item.owner);
    if (list) list.push(item.label);
    else groups.set(item.owner, [item.label]);
  }
  const children = [];
  for (const [owner, labels2] of groups) {
    if (labels2.length === 1) {
      children.push({ label: labels2[0], action: "third-party", owner });
    } else {
      children.push({
        label: owner,
        children: labels2.map((label) => ({ label, action: "third-party", owner }))
      });
    }
  }
  return children.length > 0 ? { label: MORE_MENU_LABEL, children } : null;
}
var EVENT_LABELS = {
  balance: "\u4F59\u989D\u6863\u4F4D",
  whisper: "\u788E\u788E\u5FF5",
  workStatus: "\u5DE5\u4F5C\u72B6\u6001"
};
var leaf = (anim) => ({ label: anim, anim });
function buildMenuTree(animations) {
  const groups = [];
  const pools = [
    ["\u5F85\u673A", animations.idle],
    ["\u8F6C\u5411", animations.turn],
    ["\u62D6\u62FD", animations.drag],
    ["\u70B9\u51FB\u56DE\u5E94", animations.clicks],
    ["\u79FB\u52A8", animations.moves.actions.map((m) => m.name)]
  ];
  for (const [label, pool] of pools) {
    if (pool.length) groups.push({ label, children: pool.map(leaf) });
  }
  const cats = (animations.categories ?? []).filter((c) => c.actions.length > 0);
  for (const c of cats) {
    groups.push({ label: c.id, children: c.actions.map(leaf) });
  }
  const events = animations.events ?? {};
  for (const key of Object.keys(events)) {
    const pool = events[key] ?? [];
    const names = [];
    for (const slot of pool) {
      if (typeof slot === "string") names.push(slot);
      else names.push(...slot);
    }
    if (names.length) groups.push({ label: EVENT_LABELS[key] ?? key, children: names.map(leaf) });
  }
  if (!groups.length) return [];
  return [{ label: "\u52A8\u4F5C", children: groups }];
}
function isNoMirrorAnimation(categories, anim) {
  return (categories ?? []).some((c) => c.noMirror === true && c.actions.includes(anim));
}

// vendor/dsh-pet/src/shared/menu/memes.ts
function usableNames(memes) {
  if (!memes || typeof memes !== "object" || Array.isArray(memes)) return [];
  const out = [];
  for (const [name, desc] of Object.entries(memes)) {
    if (!name.trim()) continue;
    if (typeof desc !== "string" || desc.trim() === "") continue;
    out.push(name);
  }
  return out;
}
function groupMemes(source) {
  const names = usableNames(source.memes);
  const limit = Math.floor(Number(source.chatImageLimit));
  const unlimited = !Number.isFinite(limit) || limit <= 0;
  const take = source.chatImageEnabled !== true ? 0 : unlimited ? names.length : Math.min(limit, names.length);
  return { chat: names.slice(0, take), other: names.slice(take) };
}
function memeLeaf(name, thumbOf) {
  const leaf2 = { label: name, action: "whisper", image: name };
  if (thumbOf) leaf2.thumb = thumbOf(name);
  return leaf2;
}
function memeThumbUrl(baseUrl, assetRoot, name) {
  const root = assetRoot && assetRoot.trim() !== "" ? assetRoot : "main";
  return baseUrl + "/pic/memes/" + encodeURIComponent(root) + "/" + encodeURIComponent(name) + ".png";
}
function buildMemeBranch(source, thumbOf) {
  const { chat, other } = groupMemes(source);
  const leaf2 = (name) => memeLeaf(name, thumbOf);
  const groups = [];
  if (chat.length > 0) groups.push({ label: "\u7EB3\u5165\u5BF9\u8BDD\u7684\u914D\u56FE", children: chat.map(leaf2) });
  if (other.length > 0) groups.push({ label: "\u5176\u4ED6", children: other.map(leaf2) });
  if (groups.length === 0) return null;
  return { label: "\u914D\u56FE", children: groups };
}

// vendor/dsh-pet/src/shared/menu/css.ts
var MENU_CSS = [
  // 浮层固定浅色：对比度与两端口径一致，优先于跟随宿主主题。
  ".dsh-pet-menu{position:fixed;left:0;top:0;z-index:2147483000;color:#2b2b2b;font-size:13px;line-height:1.5;",
  "font-family:'Microsoft YaHei UI','Segoe UI','PingFang SC',sans-serif;user-select:none;pointer-events:auto}",
  ".dsh-pet-menu,.dsh-pet-menu *{box-sizing:border-box}",
  ".dsh-pet-menu-column{position:absolute;min-width:150px;max-width:300px;padding:4px;",
  "background:rgba(255,255,255,.98);border:1px solid rgba(0,0,0,.12);border-radius:8px;",
  "box-shadow:0 8px 28px rgba(0,0,0,.2);max-height:min(62vh,460px);overflow-y:auto;",
  // 自定义滚动条：Chromium 系走 ::-webkit-scrollbar，Firefox 走 scrollbar-width/scrollbar-color；
  // thumb 用 border + background-clip 内缩留白，与圆角白底协调。
  "scrollbar-width:thin;scrollbar-color:rgba(0,0,0,.22) transparent}",
  ".dsh-pet-menu-column::-webkit-scrollbar{width:8px;height:8px}",
  ".dsh-pet-menu-column::-webkit-scrollbar-track{background:transparent}",
  ".dsh-pet-menu-column::-webkit-scrollbar-thumb{background:rgba(0,0,0,.16);border-radius:4px;",
  "border:2px solid transparent;background-clip:content-box}",
  ".dsh-pet-menu-column::-webkit-scrollbar-thumb:hover{background:rgba(43,99,255,.4);",
  "border:2px solid transparent;background-clip:content-box}",
  ".dsh-pet-menu-column::-webkit-scrollbar-corner{background:transparent}",
  ".dsh-pet-menu-item{position:relative;display:flex;align-items:center;justify-content:space-between;",
  "gap:14px;padding:5px 12px;border-radius:6px;white-space:nowrap;cursor:default}",
  ".dsh-pet-menu-item:hover{background:rgba(43,99,255,.14)}",
  // 文字占满剩余宽度：菜单项是 space-between 的 flex 行，label 吃掉弹性空间后，箭头与 hint 才会贴右。
  // 按类名选而不是 `>span:first-child`——带缩略图的项里第一个子节点是 img。
  ".dsh-pet-menu-label{flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis}",
  // 配图缩略图：裁成方形小图，不参与拉伸；行高由它撑到 28+padding。
  ".dsh-pet-menu-thumb{width:28px;height:28px;border-radius:4px;object-fit:cover;flex:none;",
  "background:rgba(0,0,0,.06)}",
  // 带图的项：图与文字之间收窄（默认 14px 是给「文字 ↔ 箭头」的间距）
  ".dsh-pet-menu-item-pic{gap:8px}",
  // 右侧快捷键提示（菜单项 hint）：与 label 同一 flex 行，space-between 自动贴右
  ".dsh-pet-menu-hint{color:#9aa0a6;font-size:12px;flex:none;white-space:nowrap}",
  ".dsh-pet-menu-arrow{color:#9aa0a6;font-size:12px;flex:none}"
].join("");

// vendor/dsh-pet/src/shared/menu/position.ts
var PANEL_GAP = 4;
function pickPanelPosition(input) {
  const { panel, item, parent, others, clamp } = input;
  const minLeft = clamp.x + PANEL_GAP;
  const minTop = clamp.y + PANEL_GAP;
  const maxLeft = clamp.x + clamp.w - PANEL_GAP - panel.w;
  const maxTop = clamp.y + clamp.h - PANEL_GAP - panel.h;
  const clampX = (v) => Math.max(minLeft, Math.min(v, Math.max(minLeft, maxLeft)));
  const clampY = (v) => Math.max(minTop, Math.min(v, Math.max(minTop, maxTop)));
  const hitsOther = (left, top) => others.some((b) => left < b.right && left + panel.w > b.left && top < b.bottom && top + panel.h > b.top);
  const fitsClamp = (left, top) => left >= minLeft - 0.5 && left <= maxLeft + 0.5 && top >= minTop - 0.5 && top <= maxTop + 0.5;
  const topAtItem = clampY(item.top);
  const topAtParent = clampY(parent.top);
  const cands = [
    { left: parent.right + PANEL_GAP, top: topAtItem },
    { left: parent.left - PANEL_GAP - panel.w, top: topAtItem },
    { left: parent.right + PANEL_GAP, top: topAtParent },
    { left: parent.left - PANEL_GAP - panel.w, top: topAtParent }
  ];
  const ideal = cands.find((cd) => fitsClamp(cd.left, cd.top) && !hitsOther(cd.left, cd.top));
  if (ideal) return ideal;
  const fitted = cands.map((cd) => ({ left: clampX(cd.left), top: clampY(cd.top) })).find((cd) => !hitsOther(cd.left, cd.top));
  if (fitted) return fitted;
  return { left: clampX(parent.right + PANEL_GAP), top: clampY(topAtItem) };
}

// vendor/dsh-pet/src/shared/menu/mount.ts
function isBranchNode(n) {
  return "children" in n && Array.isArray(n.children);
}
function mountContextMenu(opts) {
  const { tree, x, y, onAction, onClose, clamp } = opts;
  const c = clamp && Number.isFinite(clamp.x + clamp.y + clamp.w + clamp.h) ? clamp : { x: 0, y: 0, w: window.innerWidth, h: window.innerHeight };
  const root = document.createElement("div");
  root.className = "dsh-pet-menu";
  root.style.left = "0px";
  root.style.top = "0px";
  root.addEventListener("contextmenu", (e) => e.preventDefault());
  let closed = false;
  const openChild = /* @__PURE__ */ new Map();
  let leaveTimer = null;
  const hideChain = (panel) => {
    panel.style.display = "none";
    const child = openChild.get(panel);
    if (child) {
      openChild.delete(panel);
      hideChain(child);
    }
  };
  const showPanel = (panel, item) => {
    const rect = item.getBoundingClientRect();
    panel.style.left = "";
    panel.style.top = "";
    panel.style.display = "block";
    const parentEl = item.parentElement;
    const pr = parentEl ? parentEl.getBoundingClientRect() : rect;
    const pick2 = pickPanelPosition({
      panel: { w: panel.offsetWidth, h: panel.offsetHeight },
      item: { left: rect.left, right: rect.right, top: rect.top },
      parent: { left: pr.left, right: pr.right, top: pr.top },
      others: Array.from(root.querySelectorAll(".dsh-pet-menu-column")).filter((p) => p !== panel && p.style.display !== "none").map((p) => {
        const b = p.getBoundingClientRect();
        return { left: b.left, top: b.top, right: b.right, bottom: b.bottom };
      }),
      clamp: { x: c.x, y: c.y, w: c.w, h: c.h }
    });
    panel.style.left = pick2.left + "px";
    panel.style.top = pick2.top + "px";
  };
  const buildPanel = (nodes) => {
    const panel = document.createElement("div");
    panel.className = "dsh-pet-menu-column";
    panel.style.display = "none";
    if (clamp) panel.style.maxHeight = Math.min(460, Math.max(120, c.h - 16)) + "px";
    root.appendChild(panel);
    for (const node of nodes) {
      const item = document.createElement("div");
      item.className = "dsh-pet-menu-item";
      if (isBranchNode(node)) {
        item.classList.add("dsh-pet-menu-branch");
        const label = document.createElement("span");
        label.className = "dsh-pet-menu-label";
        label.textContent = node.label;
        const arrow = document.createElement("span");
        arrow.className = "dsh-pet-menu-arrow";
        arrow.textContent = "\u25B8";
        item.appendChild(label);
        item.appendChild(arrow);
        const childPanel = buildPanel(node.children);
        item.addEventListener("mouseenter", () => {
          const prev = openChild.get(panel);
          if (prev && prev !== childPanel) hideChain(prev);
          openChild.set(panel, childPanel);
          showPanel(childPanel, item);
        });
      } else {
        if (node.thumb) {
          const thumb = document.createElement("img");
          thumb.className = "dsh-pet-menu-thumb";
          thumb.src = node.thumb;
          thumb.alt = "";
          thumb.draggable = false;
          thumb.loading = "lazy";
          thumb.decoding = "async";
          item.appendChild(thumb);
          item.classList.add("dsh-pet-menu-item-pic");
        }
        const label = document.createElement("span");
        label.className = "dsh-pet-menu-label";
        label.textContent = node.label;
        item.appendChild(label);
        if (node.hint) {
          const hint = document.createElement("span");
          hint.className = "dsh-pet-menu-hint";
          hint.textContent = node.hint;
          item.appendChild(hint);
        }
        item.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          close();
          onAction(node);
        });
      }
      panel.appendChild(item);
    }
    return panel;
  };
  const rootPanel = buildPanel(tree);
  rootPanel.style.display = "block";
  document.body.appendChild(root);
  rootPanel.style.left = "";
  rootPanel.style.top = "";
  const rw = rootPanel.offsetWidth;
  const rh = rootPanel.offsetHeight;
  rootPanel.style.left = Math.max(c.x + 4, Math.min(x, c.x + c.w - rw - 4)) + "px";
  rootPanel.style.top = Math.max(c.y + 4, Math.min(y, c.y + c.h - rh - 4)) + "px";
  root.addEventListener("mouseleave", () => {
    if (leaveTimer !== null) window.clearTimeout(leaveTimer);
    leaveTimer = window.setTimeout(() => {
      leaveTimer = null;
      close();
    }, 200);
  });
  root.addEventListener("mouseover", () => {
    if (leaveTimer !== null) {
      window.clearTimeout(leaveTimer);
      leaveTimer = null;
    }
  });
  const onDocPointerDown = (e) => {
    if (closed) return;
    if (root.contains(e.target)) return;
    close();
  };
  const onDocKeyDown = (e) => {
    if (closed) return;
    if (e.key === "Escape") close();
  };
  document.addEventListener("mousedown", onDocPointerDown, true);
  document.addEventListener("keydown", onDocKeyDown, true);
  const close = () => {
    if (closed) return;
    closed = true;
    if (leaveTimer !== null) window.clearTimeout(leaveTimer);
    leaveTimer = null;
    document.removeEventListener("mousedown", onDocPointerDown, true);
    document.removeEventListener("keydown", onDocKeyDown, true);
    root.remove();
    if (onClose) onClose();
  };
  return { el: root, close };
}

// vendor/dsh-pet/src/shared/tooltip.ts
var TOOLTIP_CLASS = "pet-tooltip";
var TOOLTIP_GAP_RATIO = 0.022;
function tooltipPlacement(cursor, tip, bounds, gap) {
  const clamp = (v, lo, hi) => hi < lo ? lo : Math.min(Math.max(v, lo), hi);
  const rightMax = bounds.x + bounds.w;
  const bottomMax = bounds.y + bounds.h;
  let x = cursor.x + gap;
  if (x + tip.w > rightMax) x = cursor.x - gap - tip.w;
  x = clamp(x, bounds.x, rightMax - tip.w);
  let y = cursor.y + gap;
  if (y + tip.h > bottomMax) y = cursor.y - gap - tip.h;
  y = clamp(y, bounds.y, bottomMax - tip.h);
  return { x, y };
}
var TOOLTIP_CSS = [
  ".pet-tooltip{",
  // fixed + 坐标由 JS 按光标写：left/top 只是未定位前的兜底，不会真的显示
  "position:fixed;left:0;top:0;",
  "max-width:calc(var(--dsh-pet-size,var(--pet-size,462px))*0.8);",
  "padding:calc(var(--dsh-pet-size,var(--pet-size,462px))*0.010) calc(var(--dsh-pet-size,var(--pet-size,462px))*0.021);",
  "border-radius:calc(var(--dsh-pet-size,var(--pet-size,462px))*0.016);",
  // 白底黑字：对齐原生提示的观感，深色胶囊落在浅色宠物身上太抢眼
  "background:rgba(255,255,255,.96);color:#1f1f1f;",
  // 细边框：白底压在浅色宠物或浅色页面上会糊成一片，靠它划出轮廓
  "border:1px solid rgba(0,0,0,.12);",
  // 字体与气泡同一套；字体族走全局配置变量（注入在 documentElement），继承不到宠物根容器
  'font-family:var(--dsh-pet-font-family,"ShangshouSoftCandy","Yuanti SC","YouYuan","\u5E7C\u5706","Comic Sans MS","PingFang SC","Microsoft YaHei",sans-serif);',
  // 字号对齐 Windows 原生提示（9pt ≈ 12px）：462px 的宠物下 0.026 → 约 12px。
  // --dsh-pet-font-tip 由两端按该宠物尺寸算好注入（shared/fonts.ts 的 resolveFontPx），未注入时回退原表达式。
  "font-size:var(--dsh-pet-font-tip,calc(var(--dsh-pet-size,var(--pet-size,462px))*0.026));line-height:1.4;",
  // nowrap + 截断：宽度锁成一行才好和光标一起摆（换行会让宽度随位置跳变）
  "white-space:nowrap;overflow:hidden;text-overflow:ellipsis;",
  // 不设 backdrop-filter：白底没必要，原生提示也没有毛玻璃
  "box-shadow:0 calc(var(--dsh-pet-size,var(--pet-size,462px))*0.004) calc(var(--dsh-pet-size,var(--pet-size,462px))*0.013) rgba(0,0,0,.18);",
  // 层级低于气泡：两者不抢同一块地方（提示跟光标、气泡在头顶），保留层序只是兜底
  "opacity:0;transition:opacity .12s ease;pointer-events:none;z-index:2}",
  ".pet-tooltip.is-on{opacity:1}"
].join("");

// vendor/dsh-pet/src/client/pet/css.ts
var PET_CSS = [
  ".dsh-pet-root{position:fixed;z-index:40;pointer-events:none;user-select:none}",
  '.dsh-pet-root[data-corner="bottom-right"]{right:var(--dsh-pet-mx,24px);bottom:var(--dsh-pet-my,0)}',
  '.dsh-pet-root[data-corner="bottom-left"]{left:var(--dsh-pet-mx,24px);bottom:var(--dsh-pet-my,0)}',
  '.dsh-pet-root[data-corner="top-right"]{right:var(--dsh-pet-mx,24px);top:var(--dsh-pet-my,0)}',
  '.dsh-pet-root[data-corner="top-left"]{left:var(--dsh-pet-mx,24px);top:var(--dsh-pet-my,0)}',
  ".dsh-pet-stage{position:relative;width:var(--dsh-pet-size,462px);height:calc(var(--dsh-pet-size,462px)*9/16);pointer-events:none}",
  ".dsh-pet-video{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;pointer-events:none;opacity:0;transition:opacity .18s ease;transform-origin:center}",
  ".dsh-pet-video.is-front{opacity:1}",
  // 触屏拖拽必需：缺 touch-action:none 时浏览器会把手势判成滚动并触发 pointercancel；
  // 两条 -webkit-* 抑制长按选中与 iOS 长按系统菜单。
  `.dsh-pet-hit{position:absolute;pointer-events:auto;cursor:grab;z-index:1;touch-action:none;-webkit-user-select:none;-webkit-touch-callout:none}`,
  `.dsh-pet-hit.dragging{cursor:grabbing}`,
  "@media (prefers-reduced-motion: reduce){.dsh-pet-video{transition:none}}",
  // 统一右键菜单样式，与桌面注入同一份。
  MENU_CSS,
  // 悬浮提示样式，与桌面注入同一份。
  TOOLTIP_CSS
].join("\n");
var cssTag = "dsh-pet/style.css";
function injectPetCss() {
  if (typeof document === "undefined") return;
  if (document.querySelector('style[data-plugin-css="' + cssTag + '"]') !== null) return;
  const tag = document.createElement("style");
  tag.dataset.plugin = "dsh-pet";
  tag.dataset.pluginCss = cssTag;
  tag.textContent = PET_CSS;
  document.head.appendChild(tag);
}

// vendor/dsh-pet/src/shared/constants.ts
var CANVAS_H = 360;
var FEET_Y = 330;
var HIT_BOX = { x0: 200, y0: 50, x1: 440, y1: 335 };
var DRAG_THRESHOLD = 5;
var SLINGSHOT_DOUBLE_MS = 200;
var PET_REF_WIDTH = 462;
var ROUTE_PATH = "/api/pet";
var ANIMATION_EXT = ".webm";

// vendor/dsh-pet/src/shared/physics/constants.ts
var SPRING_K = 200;
var SPRING_C = 30;
var TRAIL_KEEP_MS = 200;
var RELEASE_WINDOW_MS = 150;
var RELEASE_STALE_MS = 150;
var MIN_SPAN_MS = 20;
var SEG_MIN_DT_MS = 8;
var DEAD_ZONE_SPEED = 500;
var MAX_THROW_SPEED = 3600;
var PEAK_WEIGHT = 0.5;
var ACCEL_REF = 8e3;
var ACCEL_GAIN_MAX = 0.6;
var GRAVITY = 1400;
var RESTITUTION = 0.78;
var GROUND_FRICTION = 2.5;
var DEFAULT_PHYSICS = {
  gravity: GRAVITY,
  restitution: RESTITUTION,
  groundFriction: GROUND_FRICTION,
  ceilingBounce: true,
  throwPower: 1,
  petCollision: true,
  hapticEnabled: true,
  tiltGravity: true,
  shakeThrow: true
};
var DEFAULT_THROW_POWER = 1;
var REST_NORMAL = 40;
var REST_TANGENT = 15;
var REST_NORMAL_EPS = 1;
var MAX_STEP_DT = 0.05;
var SQ_SQUASH = 0.55;
var SQ_DURATION_MS = 220;
var SQ_SOFT_SPEED = 300;
var SQ_HARD_SPEED = 1500;
var SQ_MAX_SQUASH = 0.55;
var THROW_SPEED_ANCHOR = 1200;
var SLINGSHOT_REF_RATIO = 0.6;
var SUBSTEP_PX = 8;
var SUBSTEP_MAX = 64;
var PET_BOUNCE_E = 0.995;

// vendor/dsh-pet/src/shared/physics/squash.ts
var landingSquash = (impactSpeed) => {
  const t = Math.min(Math.max((Math.abs(impactSpeed) - SQ_SOFT_SPEED) / (SQ_HARD_SPEED - SQ_SOFT_SPEED), 0), 1);
  return Math.min(0.8, 1 - t * (1 - SQ_MAX_SQUASH));
};
var squashScale = (u, squash = SQ_SQUASH) => {
  if (u < 0.45) {
    const p2 = u / 0.45;
    return 1 - (1 - squash) * p2 * p2;
  }
  const p = (u - 0.45) / 0.55;
  const c1 = 1.70158;
  const c3 = c1 + 1;
  const f = 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2);
  return Math.min(1.12, squash + (1 - squash) * Math.max(f, 0));
};

// vendor/dsh-pet/src/shared/displays.ts
var rectRight = (r) => r.x + r.width;
var rectBottom = (r) => r.y + r.height;
var pointInRect = (r, x, y) => x >= r.x && x < rectRight(r) && y >= r.y && y < rectBottom(r);
var rectAtPoint = (rects, x, y) => {
  for (const r of rects) if (pointInRect(r, x, y)) return r;
  return null;
};

// vendor/dsh-pet/src/shared/physics/contact.ts
var CONTACT_NORMALS = {
  left: { nx: 1, ny: 0 },
  right: { nx: -1, ny: 0 },
  ceiling: { nx: 0, ny: 1 },
  floor: { nx: 0, ny: -1 }
};
var resolveContact = (speed, edge, physics, dt) => {
  const { nx, ny } = CONTACT_NORMALS[edge];
  const tx = -ny;
  const ty = nx;
  const vn = speed.vx * nx + speed.vy * ny;
  const vt = speed.vx * tx + speed.vy * ty;
  const normalSpeed = Math.abs(vn) < REST_NORMAL ? 0 : Math.abs(vn) * physics.restitution;
  const tangentSpeed = vt * Math.max(0, 1 - physics.groundFriction * dt);
  return {
    vx: normalSpeed * nx + tangentSpeed * tx,
    vy: normalSpeed * ny + tangentSpeed * ty,
    normalSpeed,
    tangentSpeed
  };
};
var isRestingOnContacts = (edges, speed) => {
  if (edges.length === 0) return false;
  return edges.every((edge) => {
    const { nx, ny } = CONTACT_NORMALS[edge];
    const normal = Math.abs(speed.vx * nx + speed.vy * ny);
    const tangent = Math.abs(speed.vx * -ny + speed.vy * nx);
    return normal < REST_NORMAL_EPS && tangent < REST_TANGENT;
  });
};

// vendor/dsh-pet/src/shared/physics/throw.ts
var throwBounds = (o) => {
  const h = o.size * 9 / 16;
  return { minX: -o.sideAllow, minY: 0, maxX: o.W - o.size + o.sideAllow, maxY: o.H - h };
};
var throwStep = (s, dtRaw, b, physics = DEFAULT_PHYSICS, gravity) => {
  const dt = Math.min(Math.max(dtRaw, 0), MAX_STEP_DT);
  const g = gravity ?? { gx: 0, gy: physics.gravity };
  let { x, y, vx, vy } = s;
  vx += g.gx * dt;
  vy += g.gy * dt;
  x += vx * dt;
  y += vy * dt;
  let bounced = false;
  let hit = null;
  const contacts = [];
  const record = (edge, speed) => {
    contacts.push(edge);
    if (hit === null || speed > hit.speed) hit = { edge, speed };
  };
  if (x < b.minX) {
    record("left", Math.abs(vx));
    x = b.minX;
    const out = resolveContact({ vx, vy }, "left", physics, dt);
    vx = out.vx;
    vy = out.vy;
    bounced = true;
  } else if (x > b.maxX) {
    record("right", Math.abs(vx));
    x = b.maxX;
    const out = resolveContact({ vx, vy }, "right", physics, dt);
    vx = out.vx;
    vy = out.vy;
    bounced = true;
  }
  if (y < b.minY) {
    if (physics.ceilingBounce) {
      record("ceiling", Math.abs(vy));
      y = b.minY;
      const out = resolveContact({ vx, vy }, "ceiling", physics, dt);
      vx = out.vx;
      vy = out.vy;
      bounced = true;
    }
  } else if (y >= b.maxY) {
    record("floor", Math.abs(vy));
    y = b.maxY;
    const out = resolveContact({ vx, vy }, "floor", physics, dt);
    vx = out.vx;
    vy = out.vy;
    bounced = true;
  }
  return { x, y, vx, vy, bounced, atRest: isRestingOnContacts(contacts, { vx, vy }), hit, contacts };
};
var throwSubsteps = (vx, vy, dt) => {
  const travel = Math.hypot(vx, vy) * Math.min(Math.max(dt, 0), MAX_STEP_DT);
  if (!(travel > SUBSTEP_PX)) return 1;
  return Math.min(SUBSTEP_MAX, Math.ceil(travel / SUBSTEP_PX));
};

// vendor/dsh-pet/src/shared/physics/spring.ts
var springStep = (v, x, target, dt, power = DEFAULT_THROW_POWER) => v + ((target - x) * SPRING_K - v * SPRING_C) * power * dt;
var softClampSpeed = (speed) => {
  if (speed <= 0) return 0;
  return MAX_THROW_SPEED * (1 - Math.exp(-speed / MAX_THROW_SPEED));
};

// vendor/dsh-pet/src/shared/physics/release.ts
var trimTrail = (trail, now) => {
  const cutoff = now - TRAIL_KEEP_MS;
  let i = 0;
  while (i < trail.length && trail[i].t < cutoff) i++;
  return i === 0 ? trail : trail.slice(i);
};
var throwVelocity = (angleDeg, power) => {
  const speed = softClampSpeed(power * THROW_SPEED_ANCHOR);
  const rad = angleDeg * Math.PI / 180;
  return { vx: Math.cos(rad) * speed, vy: -Math.sin(rad) * speed };
};
var slingshotRefDist = (size) => size > 0 ? size * SLINGSHOT_REF_RATIO : 0;
var slingshotPower = (dist, size) => {
  const ref = slingshotRefDist(size);
  if (!(ref > 0) || !(dist > 0) || !Number.isFinite(dist)) return 0;
  return dist / ref;
};
var pullAngle = (pullX, pullY) => Math.atan2(pullY, -pullX) * 180 / Math.PI;
var slingshotVelocity = (angleDeg, power, throwPower = DEFAULT_THROW_POWER) => {
  const speed = THROW_SPEED_ANCHOR * Math.max(0, power) * Math.max(0, throwPower);
  if (speed === 0) return { vx: 0, vy: 0 };
  const rad = angleDeg * Math.PI / 180;
  return { vx: Math.cos(rad) * speed, vy: -Math.sin(rad) * speed };
};
var estimateReleaseVelocity = (trail, now, physics = DEFAULT_PHYSICS) => {
  if (trail.length === 0) return null;
  const last = trail[trail.length - 1];
  if (now - last.t > RELEASE_STALE_MS) return null;
  const win = trail.filter((s) => now - s.t <= RELEASE_WINDOW_MS);
  if (win.length < 2) return null;
  const t0 = win[0].t;
  const x0 = win[0].x;
  const y0 = win[0].y;
  const t1 = win[win.length - 1].t;
  const x1 = win[win.length - 1].x;
  const y1 = win[win.length - 1].y;
  const spanMs = t1 - t0;
  if (spanMs < MIN_SPAN_MS) return null;
  const baseVx = (x1 - x0) / spanMs * 1e3;
  const baseVy = (y1 - y0) / spanMs * 1e3;
  const baseSpeed = Math.hypot(baseVx, baseVy);
  if (baseSpeed < 1e-6) return null;
  const segSpeeds = [];
  let px = x0;
  let py = y0;
  let pt2 = t0;
  for (const s of win.slice(1)) {
    const dt = s.t - pt2;
    if (dt >= SEG_MIN_DT_MS) {
      segSpeeds.push({ speed: Math.hypot(s.x - px, s.y - py) / dt * 1e3, tEnd: s.t });
      px = s.x;
      py = s.y;
      pt2 = s.t;
    }
  }
  const peakSpeed = segSpeeds.length ? Math.max(...segSpeeds.map((v) => v.speed)) : baseSpeed;
  let accel = 0;
  if (segSpeeds.length >= 2) {
    const lastSeg = segSpeeds[segSpeeds.length - 1];
    const firstSeg = segSpeeds[0];
    accel = (lastSeg.speed - firstSeg.speed) / Math.max((lastSeg.tEnd - firstSeg.tEnd) / 1e3, MIN_SPAN_MS / 1e3);
  }
  const speedBeforeClamp = ((1 - PEAK_WEIGHT) * baseSpeed + PEAK_WEIGHT * peakSpeed) * (1 + Math.min(Math.max(accel, 0) / ACCEL_REF, 1) * ACCEL_GAIN_MAX);
  const speed = softClampSpeed(speedBeforeClamp) * physics.throwPower;
  if (speed < DEAD_ZONE_SPEED) return null;
  return { vx: baseVx / baseSpeed * speed, vy: baseVy / baseSpeed * speed };
};

// vendor/dsh-pet/src/shared/physics/collide.ts
var bodyPixelBox = (o) => {
  const h = o.size * 9 / 16;
  return {
    left: o.x + HIT_BOX.x0 / 640 * o.size,
    top: o.y + o.bottomPad + HIT_BOX.y0 / 360 * h,
    right: o.x + HIT_BOX.x1 / 640 * o.size,
    bottom: o.y + o.bottomPad + HIT_BOX.y1 / 360 * h
  };
};
var rectsOverlap = (a, b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
var collidePet = (fly, hit) => {
  const hf = fly.size * 9 / 16 / 2;
  const hh = hit.size * 9 / 16 / 2;
  const cx = hit.x + hit.size / 2 - (fly.x + fly.size / 2);
  const cy = hit.y + hh - (fly.y + hf);
  const dist = Math.hypot(cx, cy);
  if (dist < 1e-6) return null;
  const nx = cx / dist;
  const ny = cy / dist;
  const vrel = (fly.vx - hit.vx) * nx + (fly.vy - hit.vy) * ny;
  if (vrel <= 0) return null;
  const e = PET_BOUNCE_E;
  const m1 = fly.size * fly.size;
  const m2 = hit.size * hit.size;
  const v1n = fly.vx * nx + fly.vy * ny;
  const v2n = hit.vx * nx + hit.vy * ny;
  const v1n2 = ((m1 - e * m2) * v1n + (1 + e) * m2 * v2n) / (m1 + m2);
  const v2n2 = ((m2 - e * m1) * v2n + (1 + e) * m1 * v1n) / (m1 + m2);
  return {
    fvx: fly.vx - v1n * nx + v1n2 * nx,
    fvy: fly.vy - v1n * ny + v1n2 * ny,
    hvx: hit.vx - v2n * nx + v2n2 * nx,
    hvy: hit.vy - v2n * ny + v2n2 * ny,
    impactSpeed: vrel
  };
};
var overlapPush = (a, b) => {
  const ox = Math.min(a.right, b.right) - Math.max(a.left, b.left);
  const oy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
  if (ox <= 0 || oy <= 0) return null;
  const alongX = ox <= oy;
  const sign = alongX ? (a.left + a.right) / 2 >= (b.left + b.right) / 2 ? 1 : -1 : (a.top + a.bottom) / 2 >= (b.top + b.bottom) / 2 ? 1 : -1;
  return alongX ? { dx: sign * ox / 2, dy: 0 } : { dx: 0, dy: sign * oy / 2 };
};

// vendor/dsh-pet/src/client/pet/motion/geometry.ts
function derivePetMetrics(size) {
  return {
    halfW: size / 2,
    halfH: size * 9 / 16 / 2,
    bottomPad: size * (9 / 16) * (CANVAS_H - FEET_Y) / CANVAS_H,
    sideAllow: HIT_BOX.x0 / 640 * size
  };
}
function centerToBox(center, viewport, half) {
  return { x: center.rx * viewport.width - half.w, y: center.ry * viewport.height - half.h };
}
function boxToRatio(box, viewport, half) {
  return { rx: (box.x + half.w) / viewport.width, ry: (box.y + half.h) / viewport.height };
}
var MIN_REACHABLE_PX = 24;
function clampReachableBox(box, viewport, body) {
  const inset = bodyPixelBox({ x: 0, y: 0, size: body.size, bottomPad: body.bottomPad });
  const minX = MIN_REACHABLE_PX - inset.right;
  const maxX = viewport.width - inset.left - MIN_REACHABLE_PX;
  const minY = MIN_REACHABLE_PX - inset.bottom;
  const maxY = viewport.height - inset.top - MIN_REACHABLE_PX;
  const height = body.size * 9 / 16;
  return {
    x: clampAxis(box.x, minX, maxX, (viewport.width - body.size) / 2),
    y: clampAxis(box.y, minY, maxY, (viewport.height - height) / 2)
  };
}
function clampAxis(value, lo, hi, centered) {
  return lo > hi ? centered : Math.min(Math.max(value, lo), hi);
}
function petStageStyle(bottomPad) {
  return { transform: "translateY(" + bottomPad + "px)" };
}
function petRootStyle(customPos, viewport, half) {
  if (!customPos) return {};
  return {
    left: customPos.rx * viewport.width - half.w + "px",
    top: customPos.ry * viewport.height - half.h + "px",
    // 角落定位按 data-corner 写 left/right 与 top/bottom；另一侧不归零，两套定位会同时生效、位置跳回角落。
    right: "auto",
    bottom: "auto"
  };
}
var PET_HIT_STYLE = {
  left: HIT_BOX.x0 / 640 * 100 + "%",
  top: HIT_BOX.y0 / 360 * 100 + "%",
  width: (HIT_BOX.x1 - HIT_BOX.x0) / 640 * 100 + "%",
  height: (HIT_BOX.y1 - HIT_BOX.y0) / 360 * 100 + "%"
};

// vendor/dsh-pet/src/client/pet/card/view.ts
var VIDEO_PROPS = { muted: true, playsInline: true, autoPlay: true };
function makeCardView(rt) {
  const { h } = rt;
  return function CardView(props) {
    return h("div", {
      ref: props.rootRef,
      className: "dsh-pet-root",
      "data-corner": props.corner,
      "data-facing": props.facing,
      style: Object.assign(
        {
          "--dsh-pet-size": props.size + "px",
          "--dsh-pet-mx": props.marginX + "px",
          "--dsh-pet-my": props.marginY + "px",
          // 字号注入最终 px；CSS 侧带原值回退，漏注入也不会坏。
          "--dsh-pet-font-bubble": props.fontBubblePx + "px",
          "--dsh-pet-font-tip": props.fontTipPx + "px"
        },
        props.rootStyle
      ),
      children: [
        // 气泡单槽；余额不可用说明也走这里，手动请求与命令气泡不受 whisperEnabled 限制。
        props.bubble,
        h("div", {
          ref: props.stageRef,
          className: "dsh-pet-stage",
          style: props.stageStyle,
          children: [
            h("video", Object.assign({}, VIDEO_PROPS, { ref: props.videoARef, className: "dsh-pet-video is-front" })),
            h("video", Object.assign({}, VIDEO_PROPS, { ref: props.videoBRef, className: "dsh-pet-video" })),
            h("div", {
              className: "dsh-pet-hit",
              style: PET_HIT_STYLE,
              onClick: props.onClick,
              onPointerDown: props.onPointerDown,
              onPointerMove: props.onPointerMove,
              onPointerUp: props.onPointerUp,
              onPointerCancel: props.onPointerUp,
              onPointerEnter: props.onPointerEnter,
              onPointerLeave: props.onPointerLeave,
              onContextMenu: props.onContextMenu,
              // 原生 title 换成自绘浮层后，无障碍名称仍要保留。
              "aria-label": props.name
            })
          ]
        }),
        // 悬浮提示常驻只切 class，挂卸节点吃不到淡入过渡；坐标由 placeTip 直接写 style。
        // pointer-events:none 见 TOOLTIP_CSS，否则会挡住命中区导致 enter/leave 闪烁。
        h("div", {
          ref: props.tipRef,
          className: TOOLTIP_CLASS + (props.tipOn ? " is-on" : ""),
          "aria-hidden": "true",
          children: props.name
        })
      ]
    });
  };
}

// vendor/dsh-pet/src/shared/pickers.ts
var pick = (pool, exclude) => {
  const entries = exclude ? pool.filter((n) => n !== exclude) : pool;
  const src = entries.length ? entries : pool;
  return src[Math.floor(Math.random() * src.length)];
};
var pickSlot = (slot, exclude) => {
  if (typeof slot === "string") return slot;
  const entries = exclude === void 0 ? slot : slot.filter((n) => n !== exclude);
  const src = entries.length ? entries : slot;
  return src[Math.floor(Math.random() * src.length)];
};
var slotIncludes = (slot, anim) => typeof slot === "string" ? slot === anim : slot.includes(anim);
var poolIncludes = (pool, anim) => pool.some((slot) => slotIncludes(slot, anim));
var isEventAnim = (events, anim) => events ? Object.values(events).some((pool) => poolIncludes(pool, anim)) : false;
var nextWorkStatusAnim = (pool, current2) => {
  const idx = pool.findIndex((slot2) => slotIncludes(slot2, current2));
  if (idx === -1) return null;
  const slot = pool[idx];
  if (!Array.isArray(slot) || slot.length <= 1) return null;
  return pickSlot(slot, current2);
};
var randomBetween = (min, max) => Math.floor(min + Math.random() * (max - min));
var pickWeightedCategory = (categories, facing) => {
  const cats = categories.filter((c) => c.actions.length > 0);
  if (!cats.length) return null;
  const filtered = cats.filter((c) => !(c.noMirror && facing === "right"));
  const eligible = filtered.length ? filtered : cats;
  const totalW = eligible.reduce((s, c) => s + c.weight, 0) || 1;
  let t = Math.random() * totalW;
  for (const c of eligible) {
    t -= c.weight;
    if (t <= 0) return c;
  }
  return eligible[eligible.length - 1];
};
var rollKind = (roll, w, opts) => {
  const turn = opts?.fixed ? 0 : w.turn;
  const move = opts?.fixed ? 0 : w.move;
  const topEnd = (w.idle + turn + move) / 100;
  if (roll < w.idle / 100) return "idle";
  if (roll < (w.idle + turn) / 100) return "turn";
  if (roll < topEnd) return "move";
  return "action";
};
var pickCategoryAction = (categories, idlePool, facing, current2) => {
  const cat = pickWeightedCategory(categories, facing);
  if (!cat) return { id: "FALLBACK", name: pick(idlePool, current2) };
  return { id: cat.id, name: pick(cat.actions, current2) };
};

// vendor/dsh-pet/src/shared/balance/tone.ts
var QUOTA_WARN_PERCENT = 70;
var QUOTA_CRIT_PERCENT = 90;
function quotaTone(percent) {
  if (percent >= QUOTA_CRIT_PERCENT) return "crit";
  if (percent >= QUOTA_WARN_PERCENT) return "warn";
  return "ok";
}

// vendor/dsh-pet/src/shared/balance/parse.ts
var CUSTOM_TAGS = ["div", "span", "i", "b", "strong", "em", "img"];
var CUSTOM_STYLE_KEYS = /* @__PURE__ */ new Set([
  "display",
  "flex",
  "flexDirection",
  "flexWrap",
  "alignItems",
  "justifyContent",
  "gap",
  "margin",
  "marginTop",
  "marginRight",
  "marginBottom",
  "marginLeft",
  "padding",
  "paddingTop",
  "paddingRight",
  "paddingBottom",
  "paddingLeft",
  "width",
  "height",
  "minWidth",
  "maxWidth",
  "minHeight",
  "maxHeight",
  "color",
  "fontSize",
  "fontWeight",
  "fontStyle",
  "lineHeight",
  "letterSpacing",
  "textAlign",
  "textDecoration",
  "whiteSpace",
  "verticalAlign",
  "fontVariantNumeric",
  "background",
  "backgroundColor",
  "border",
  "borderTop",
  "borderBottom",
  "borderLeft",
  "borderRight",
  "borderRadius",
  "overflow",
  "opacity"
]);
var BANNED_STYLE_VALUE = /url\(|expression|javascript:|vbscript:|@import|\\|\/\*/i;
var CUSTOM_LIMITS = {
  /** 深度上限，根为 0，超出整树作废 */
  maxDepth: 6,
  /** 全树节点数上限，超出整树作废 */
  maxNodes: 200,
  /** 单节点子节点数上限，超出整树作废 */
  maxChildren: 24,
  /** 单段文本上限，超出截断 */
  maxText: 120,
  /** 单条样式值上限，超出只丢该属性 */
  maxStyleValue: 64,
  /** img 地址上限，含 scheme */
  maxSrc: 512,
  /** 多页页数上限：页多了点不过来，也容易撑破气泡容量 */
  maxViews: 4
};
function parseCustomNode(raw, depth, budget) {
  if (!raw || typeof raw !== "object") return null;
  if (depth >= CUSTOM_LIMITS.maxDepth) return null;
  budget.nodes += 1;
  if (budget.nodes > CUSTOM_LIMITS.maxNodes) return null;
  const n = raw;
  const tag = typeof n.tag === "string" ? n.tag : "";
  if (!CUSTOM_TAGS.includes(tag)) return null;
  const node = { tag };
  if (typeof n.text === "string" && n.text.length > 0) node.text = n.text.slice(0, CUSTOM_LIMITS.maxText);
  if (tag === "img") {
    const src = typeof n.src === "string" ? n.src.trim() : "";
    if (!/^https?:\/\//i.test(src) || src.length > CUSTOM_LIMITS.maxSrc) return null;
    node.src = src;
  }
  if (n.style && typeof n.style === "object" && !Array.isArray(n.style)) {
    const style = {};
    for (const [k, v] of Object.entries(n.style)) {
      if (!CUSTOM_STYLE_KEYS.has(k)) continue;
      if (typeof v !== "string") continue;
      const value = v.trim();
      if (value === "" || value.length > CUSTOM_LIMITS.maxStyleValue) continue;
      if (BANNED_STYLE_VALUE.test(value)) continue;
      style[k] = value;
    }
    if (Object.keys(style).length > 0) node.style = style;
  }
  if (Array.isArray(n.children)) {
    if (n.children.length > CUSTOM_LIMITS.maxChildren) return null;
    const children = [];
    for (const child of n.children) {
      const parsed = parseCustomNode(child, depth + 1, budget);
      if (parsed === null) return null;
      children.push(parsed);
    }
    if (children.length > 0) node.children = children;
  }
  return node;
}
function optNum(value) {
  if (value === void 0 || value === null) return void 0;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}
function parseUsage(raw) {
  if (raw === void 0) return void 0;
  if (!raw || typeof raw !== "object") return null;
  const u = raw;
  const fields = [u.totalTokens, u.inputTokens, u.outputTokens, u.requests, u.spentUsd].map(optNum);
  if (fields.some((n) => typeof n !== "number")) return null;
  const [totalTokens, inputTokens, outputTokens, requests, spentUsd] = fields;
  return { totalTokens, inputTokens, outputTokens, requests, spentUsd };
}
function toBalanceState(raw) {
  if (!raw || typeof raw !== "object") return null;
  const r = raw;
  const provider = String(r.provider ?? "unknown");
  if (r.ok !== true) {
    const reason = r.reason === "unsupported" || r.reason === "credential-missing" || r.reason === "fetch-error" ? r.reason : "fetch-error";
    return { provider, ok: false, reason, message: typeof r.message === "string" ? r.message : void 0 };
  }
  const d = r.data;
  if (!d || typeof d !== "object") return null;
  if (r.shape === "windows") {
    const monthly = optNum(d.monthly);
    const rolling = optNum(d.rolling);
    const weekly = optNum(d.weekly);
    const rollingCapUsd = optNum(d.rollingCapUsd);
    const weeklyCapUsd = optNum(d.weeklyCapUsd);
    const monthlyCapUsd = optNum(d.monthlyCapUsd);
    const usage = parseUsage(d.usage);
    if (monthly === void 0 || monthly === null) return null;
    if (rolling === null || weekly === null || rollingCapUsd === null || weeklyCapUsd === null || monthlyCapUsd === null || usage === null) {
      return null;
    }
    return {
      provider,
      shape: "windows",
      ok: true,
      rolling,
      weekly,
      monthly,
      rollingCapUsd,
      weeklyCapUsd,
      monthlyCapUsd,
      // 没有用量就不带这个键：页数由「键在不在」判定，写 undefined 会让消费方两种写法都判一次。
      ...usage ? { usage } : {},
      rollingLabel: typeof d.rollingLabel === "string" && d.rollingLabel.length > 0 ? d.rollingLabel : void 0,
      rollingResetsAt: typeof d.rollingResetsAt === "string" ? d.rollingResetsAt : void 0,
      weeklyResetsAt: typeof d.weeklyResetsAt === "string" ? d.weeklyResetsAt : void 0,
      monthlyResetsAt: typeof d.monthlyResetsAt === "string" ? d.monthlyResetsAt : void 0
    };
  }
  if (r.shape === "money") {
    const raw2 = Array.isArray(d.wallets) ? d.wallets : [];
    const wallets = [];
    for (const item of raw2) {
      if (!item || typeof item !== "object") continue;
      const w = item;
      if (typeof w.currency !== "string" || w.currency.length === 0) continue;
      if (typeof w.total !== "string" || w.total.length === 0) continue;
      wallets.push({
        currency: w.currency,
        total: w.total,
        granted: typeof w.granted === "string" && w.granted.length > 0 ? w.granted : "0.00",
        toppedUp: typeof w.toppedUp === "string" && w.toppedUp.length > 0 ? w.toppedUp : "0.00",
        fullBalance: typeof w.fullBalance === "string" && w.fullBalance.length > 0 ? w.fullBalance : void 0
      });
    }
    if (wallets.length === 0) return null;
    return {
      provider,
      shape: "money",
      ok: true,
      wallets,
      tier: d.tier === "peak" || d.tier === "idle" ? d.tier : void 0
    };
  }
  if (r.shape === "points") {
    if (typeof d.unit !== "string" || d.unit.length === 0) return null;
    if (typeof d.total !== "string" || d.total.length === 0) return null;
    return {
      provider,
      shape: "points",
      ok: true,
      points: {
        unit: d.unit,
        total: d.total,
        full: typeof d.full === "string" && d.full.length > 0 ? d.full : void 0
      }
    };
  }
  if (r.shape === "custom") {
    let views = [];
    if (Array.isArray(d.views) && d.views.length > 0) {
      if (d.views.length > CUSTOM_LIMITS.maxViews) return null;
      for (const raw2 of d.views) {
        const page = parseCustomNode(raw2, 0, { nodes: 0 });
        if (!page) return null;
        views.push(page);
      }
    } else {
      const rows = parseCustomNode(d.rows, 0, { nodes: 0 });
      if (!rows) return null;
      views = [rows];
      if (d.detailRows !== void 0) {
        const detail = parseCustomNode(d.detailRows, 0, { nodes: 0 });
        if (!detail) return null;
        views.push(detail);
      }
    }
    const pct = typeof d.percent === "number" && Number.isFinite(d.percent) ? Math.max(0, Math.min(100, d.percent)) : void 0;
    return { provider, shape: "custom", ok: true, custom: { views, percent: pct } };
  }
  return null;
}

// vendor/dsh-pet/src/shared/balance/handlers/custom.ts
var customHandler = {
  /** 百分比由第三方直接给（他才知道自己那套额度的分母）；没给则不播档位动画 */
  percent: (v) => v.custom?.percent,
  /** 行数据是内置形态的展示语言，custom 不参与，返回空数组兜底而不是错乱的行 */
  rows: () => [],
  detail: () => [],
  views: (v) => v.custom?.views
};

// vendor/dsh-pet/src/shared/balance/handlers/money.ts
function moneyPercent(v) {
  let remaining = 0;
  let based = 0;
  for (const w of v.wallets ?? []) {
    const total = Number(w.total);
    const full = Number(w.fullBalance);
    if (!Number.isFinite(total) || !Number.isFinite(full) || full <= 0) continue;
    remaining += total / full;
    based++;
  }
  if (based === 0) return void 0;
  return Math.max(0, Math.min(100, 100 - remaining * 100));
}
function moneyRows(v) {
  const visible = (v.wallets ?? []).filter((w) => Number(w.total) !== 0).sort((a, b) => (a.currency === "CNY" ? 0 : 1) - (b.currency === "CNY" ? 0 : 1));
  const amount = visible.length > 0 ? visible.map((w) => (w.currency === "USD" ? "$" : "\xA5") + w.total).join("/") : "\xA50.00";
  if (!v.tier) return [{ role: "label", text: "\u4F59\u989D " + amount }];
  return [
    { role: "label", text: "\u4F59\u989D\uFF08" },
    { role: "tier", tier: v.tier, text: v.tier === "peak" ? "\u5CF0" : "\u8C37" },
    { role: "label", text: "\uFF09" + amount }
  ];
}
var moneyHandler = {
  percent: moneyPercent,
  rows: moneyRows
};

// vendor/dsh-pet/src/shared/balance/handlers/points.ts
function pointsPercent(v) {
  const total = Number(v.points?.total);
  const full = Number(v.points?.full);
  if (!Number.isFinite(total) || !Number.isFinite(full) || full <= 0) return void 0;
  return Math.max(0, Math.min(100, 100 - total / full * 100));
}
function pointsRows(v) {
  const p = v.points;
  if (!p) return [{ role: "label", text: "\u79EF\u5206\u6570\u636E\u4E0D\u53EF\u7528" }];
  return [{ role: "label", text: "\u4F59\u989D " + p.total + " " + p.unit }];
}
var pointsHandler = {
  percent: pointsPercent,
  rows: pointsRows
};

// vendor/dsh-pet/src/shared/balance/handlers/windows.ts
var WINDOW_LABELS = {
  weekly: "\u5468",
  monthly: "\u6708"
};
var DEFAULT_ROLLING_LABEL = "5h";
function windowLabel(v, w) {
  if (w === "rolling") return v.rollingLabel ?? DEFAULT_ROLLING_LABEL;
  return WINDOW_LABELS[w];
}
function windowQuotas(v) {
  return { rolling: v.rollingCapUsd, weekly: v.weeklyCapUsd, monthly: v.monthlyCapUsd };
}
function urgentWindow(v) {
  if (v.shape !== "windows") return void 0;
  const quotas = windowQuotas(v);
  const resets = {
    rolling: v.rollingResetsAt,
    weekly: v.weeklyResetsAt,
    monthly: v.monthlyResetsAt
  };
  const present = ["rolling", "weekly", "monthly"].filter((w) => v[w] !== void 0);
  if (present.length === 0) return void 0;
  const allQuotas = present.every((w) => {
    const quota = quotas[w];
    return quota !== void 0 && quota > 0;
  });
  let best;
  for (const w of present) {
    const percent = v[w] ?? 0;
    const quota = quotas[w];
    const cand = {
      label: windowLabel(v, w),
      percent,
      quotaUsd: quota,
      remainingUsd: allQuotas && quota !== void 0 ? quota * (100 - percent) / 100 : void 0,
      resetsAt: resets[w]
    };
    if (best === void 0) {
      best = cand;
      continue;
    }
    const moreUrgent = allQuotas ? (cand.remainingUsd ?? 0) < (best.remainingUsd ?? 0) : cand.percent > best.percent;
    if (moreUrgent) best = cand;
  }
  return best;
}
function resetInText(iso) {
  if (!iso) return "";
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "";
  const delta = t - Date.now();
  if (delta <= 0) return "\u5DF2\u91CD\u7F6E";
  const hoursF = delta / 36e5;
  if (hoursF >= 96) return (Math.round(hoursF / 24 * 10) / 10).toFixed(1) + " \u5929";
  return Math.max(0.1, Math.round(hoursF * 10) / 10).toFixed(1) + " \u5C0F\u65F6";
}
function windowsPercent(v) {
  return Math.max(v.rolling ?? 0, v.weekly ?? 0, v.monthly ?? 0);
}
function resetPhrase(reset) {
  if (reset === "") return "\u91CD\u7F6E\u65F6\u95F4\u672A\u77E5";
  return reset === "\u5DF2\u91CD\u7F6E" ? reset : reset + "\u91CD\u7F6E";
}
function windowsRows(v) {
  const w = urgentWindow(v);
  if (!w) return [{ role: "label", text: "\u989D\u5EA6\u6570\u636E\u4E0D\u53EF\u7528" }];
  const reset = resetInText(w.resetsAt);
  return [
    { role: "label", text: w.label + "\u989D\u5EA6\u5DF2\u7528 " + Math.round(w.percent) + "%" },
    { role: "sub", text: resetPhrase(reset) }
  ];
}
function windowsDetail(v) {
  const resets = {
    rolling: v.rollingResetsAt,
    weekly: v.weeklyResetsAt,
    monthly: v.monthlyResetsAt
  };
  const rows = [];
  for (const w of ["rolling", "weekly", "monthly"]) {
    const percent = v[w];
    if (percent === void 0) continue;
    const reset = resetInText(resets[w]);
    const usedText = Math.round(percent) + "%";
    const resetText = resetPhrase(reset);
    rows.push({
      role: "quota",
      text: windowLabel(v, w) + " " + usedText + " " + resetText,
      label: windowLabel(v, w),
      percent,
      tone: quotaTone(percent),
      usedText,
      resetText
    });
  }
  return rows.length > 0 ? rows : windowsRows(v);
}
function compactCount(n) {
  if (n >= 1e9) return (n / 1e9).toFixed(1) + "B";
  if (n >= 1e6) return (n / 1e6).toFixed(1) + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(1) + "K";
  return String(Math.round(n));
}
function windowsUsage(v) {
  const u = v.usage;
  if (!u) return void 0;
  const total = compactCount(u.totalTokens);
  const input = compactCount(u.inputTokens) + " \u5165";
  const output = compactCount(u.outputTokens) + " \u51FA";
  const period = "\u672C\u671F " + u.requests + " \u6B21";
  const spend = "$" + u.spentUsd.toFixed(2);
  const sum = u.inputTokens + u.outputTokens;
  const inputPercent = sum > 0 ? u.inputTokens / sum * 100 : void 0;
  return [
    {
      role: "usage",
      text: "Token " + total + " \xB7 " + input + " / " + output + " \xB7 " + period + " \xB7 " + spend,
      title: "Token",
      total,
      input,
      output,
      period,
      spend,
      inputPercent
    }
  ];
}
var windowsHandler = {
  percent: windowsPercent,
  rows: windowsRows,
  detail: windowsDetail,
  usage: windowsUsage
};

// vendor/dsh-pet/src/shared/balance/handlers/index.ts
var HANDLERS = {
  windows: windowsHandler,
  money: moneyHandler,
  points: pointsHandler,
  custom: customHandler
};

// vendor/dsh-pet/src/shared/balance/percent.ts
function balancePercent(v) {
  return HANDLERS[v.shape].percent(v);
}
function balanceEventIndex(p) {
  if (p === 100) return 5;
  const i = Math.floor(p / 20);
  return i < 5 ? i : 4;
}

// vendor/dsh-pet/src/shared/balance/view.ts
function unavailableRows(state) {
  const rows = state.reason === "unsupported" ? [
    { role: "error", text: "\u5F53\u524D\u670D\u52A1\u5546\u6682\u4E0D\u652F\u6301\u4F59\u989D\u67E5\u8BE2" },
    { role: "sub", text: "\u5F53\u524D\u670D\u52A1\u5546\uFF1A" + state.provider }
  ] : state.reason === "credential-missing" ? [
    // host 的 message 已自带「缺少凭证 X」前缀，这里原样展示，不再加前缀。
    { role: "error", text: "\u7F3A\u5C11\u4F59\u989D\u67E5\u8BE2\u51ED\u8BC1" },
    { role: "sub", text: state.message ?? "" }
  ] : [
    { role: "error", text: "\u4F59\u989D\u67E5\u8BE2\u5931\u8D25" },
    { role: "sub", text: state.message ?? "" }
  ];
  return rows.filter((r) => r.role !== "quota" && r.text !== "");
}
function balanceDetailView(state) {
  if (!state.ok) return unavailableRows(state);
  const handler = HANDLERS[state.shape];
  return handler.detail ? handler.detail(state) : handler.rows(state);
}
function balancePageCount(state) {
  if (!state.ok) return 1;
  if (state.shape === "custom") return Math.max(1, customViews(state)?.length ?? 1);
  if (state.shape !== "windows") return 1;
  return state.usage ? 3 : 2;
}
function balancePageView(state, page) {
  if (!state.ok) return unavailableRows(state);
  const handler = HANDLERS[state.shape];
  if (state.shape !== "windows" || page <= 0) return handler.rows(state);
  if (page === 1 || !state.usage) return balanceDetailView(state);
  return handler.usage?.(state) ?? balanceDetailView(state);
}
function customViews(state) {
  if (!state.ok || state.shape !== "custom") return void 0;
  const views = HANDLERS[state.shape].views?.(state);
  return views && views.length > 0 ? views : void 0;
}
function customClickable(state) {
  return (customViews(state)?.length ?? 0) > 1;
}

// vendor/dsh-pet/src/shared/balance/notice.ts
function decideBalanceNotice(state, lastKey, explicit) {
  if (state.ok) return { show: false, key: null };
  const key = state.reason + ":" + state.provider;
  return { show: explicit || key !== lastKey, key };
}

// vendor/dsh-pet/src/shared/work-status.ts
var WORK_STATUS_STATES = ["thinking", "working", "result", "waiting", "success", "error"];
var WORK_STATUS_INDEX = {
  thinking: 0,
  // turn/start → 思考
  working: 1,
  // tool/call → 工作
  result: 2,
  // tool/result → 整理
  waiting: 3,
  // approval/asked → 等待
  success: 4,
  // turn/end completed → 完成
  error: 5
  // turn/end error/max-tokens → 出错
};
function toWorkStatus(raw) {
  if (!raw || typeof raw !== "object") return null;
  const r = raw;
  const state = r.state === null || typeof r.state === "string" && WORK_STATUS_STATES.includes(r.state) ? r.state : null;
  const sessionId = typeof r.sessionId === "string" && r.sessionId !== "" && r.sessionId !== "unknown" ? r.sessionId : null;
  return { state, task: typeof r.task === "string" ? r.task : null, sessionId };
}

// vendor/dsh-pet/src/shared/state.ts
function normLeaf(value) {
  if (!value || typeof value !== "object") return null;
  const leaf2 = value;
  if (typeof leaf2.counter !== "number" || !Number.isFinite(leaf2.counter)) return null;
  return { counter: leaf2.counter, data: leaf2.data ?? null };
}
async function fetchState(baseUrl = ROUTE_PATH + "/state", wait) {
  try {
    const url = wait ? `${baseUrl}?since=${wait.since}&timeout=${wait.timeoutMs}` : baseUrl;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    const raw = await res.json().catch(() => null);
    if (!raw || typeof raw !== "object" || raw.ok === false) return null;
    const sections = {};
    const rawSections = raw.sections && typeof raw.sections === "object" ? raw.sections : {};
    for (const [name, value] of Object.entries(rawSections)) {
      const leaf2 = normLeaf(value);
      if (leaf2) sections[name] = leaf2;
    }
    const pets = {};
    const rawPets = raw.pets && typeof raw.pets === "object" ? raw.pets : {};
    for (const [petId, entry] of Object.entries(rawPets)) {
      if (!entry || typeof entry !== "object") continue;
      const leaves = {};
      for (const [name, value] of Object.entries(entry)) {
        const leaf2 = normLeaf(value);
        if (leaf2) leaves[name] = leaf2;
      }
      pets[petId] = leaves;
    }
    return {
      counter: typeof raw.counter === "number" && Number.isFinite(raw.counter) ? raw.counter : void 0,
      sections,
      pets
    };
  } catch {
    return null;
  }
}
function* walkLeaves(s) {
  for (const [name, leaf2] of Object.entries(s.sections ?? {})) yield ["sections." + name, leaf2];
  for (const [petId, leaves] of Object.entries(s.pets ?? {})) {
    for (const [name, leaf2] of Object.entries(leaves ?? {})) yield ["pets." + petId + "." + name, leaf2];
  }
}
function flattenCounters(s) {
  const out = {};
  for (const [path, leaf2] of walkLeaves(s)) out[path] = leaf2.counter;
  return out;
}
function takeChanged(s, baseline) {
  const out = [];
  for (const [path, leaf2] of walkLeaves(s)) {
    if (baseline[path] === leaf2.counter) continue;
    baseline[path] = leaf2.counter;
    out.push({ path, leaf: leaf2 });
  }
  return out;
}
var SECTION_LEAF_NAMES = ["config", "balance", "workStatus", "notify", "menu", "focusSession"];
var PET_LEAF_NAMES = ["say", "anim", "position", "throw", "lock", "sleep"];
function isSectionLeafName(name) {
  return SECTION_LEAF_NAMES.includes(name);
}
function isPetLeafName(name) {
  return PET_LEAF_NAMES.includes(name);
}
function resolveLeafPath(path) {
  if (path.startsWith("sections.")) {
    const name2 = path.slice("sections.".length);
    return isSectionLeafName(name2) ? { where: "section", name: name2 } : null;
  }
  if (!path.startsWith("pets.")) return null;
  const rest = path.slice("pets.".length);
  const dot = rest.lastIndexOf(".");
  if (dot <= 0) return null;
  const name = rest.slice(dot + 1);
  return isPetLeafName(name) ? { where: "pet", name, petId: rest.slice(0, dot) } : null;
}
function readBalance(leaf2) {
  const state = toBalanceState(leaf2.data);
  if (!state) return null;
  const manual = leaf2.data.manual === true;
  return { state, manual };
}
function readSay(leaf2) {
  if (!leaf2.data || typeof leaf2.data !== "object") return null;
  const d = leaf2.data;
  if (d.clear === true) return { kind: "clear" };
  if (typeof d.text !== "string" || !d.text) return null;
  return {
    kind: "say",
    text: d.text,
    image: typeof d.image === "string" ? d.image : void 0,
    // 第三方给的配图地址（完整 URL，scheme 已由宿主卡在 http/https）。与 image 并列、互斥，
    // 消费端有 url 就用 url，否则拼表情包路径——判别位在字段名上，见 SayCue 的说明。
    url: typeof d.url === "string" ? d.url : void 0,
    // 只认 ≥0 的有限数：非法值当没给（写端已校验，这里只是防御，不让脏数据毁掉整拍）
    duration: typeof d.duration === "number" && Number.isFinite(d.duration) && d.duration >= 0 ? d.duration : void 0,
    anim: typeof d.anim === "boolean" ? d.anim : void 0,
    // 只认两个合法字面量：写错的一端名等于「不指定」，消费端据此不念
    voiceTo: d.voiceTo === "web" || d.voiceTo === "desktop" ? d.voiceTo : void 0
  };
}
function readWorkStatus(leaf2) {
  return toWorkStatus(leaf2.data);
}
function readAnim(leaf2) {
  if (!leaf2.data || typeof leaf2.data !== "object") return null;
  const d = leaf2.data;
  const name = typeof d.name === "string" && d.name ? d.name : void 0;
  const url = typeof d.url === "string" && d.url ? d.url : void 0;
  if (name === void 0 && url === void 0) return null;
  return {
    name,
    url,
    playbackId: typeof d.playbackId === "string" && d.playbackId ? d.playbackId : void 0,
    // 朝向：只认两个字面量，其余（含缺省、老宿主、脏值）一律 undefined = 不动朝向
    facing: d.facing === "left" || d.facing === "right" ? d.facing : void 0
  };
}
function readLock(leaf2) {
  if (!leaf2.data || typeof leaf2.data !== "object") return null;
  const d = leaf2.data;
  if (d.locked === false) return { locked: false };
  if (d.locked !== true) return null;
  if (typeof d.expiresAt !== "number" || !Number.isFinite(d.expiresAt)) return null;
  return { locked: true, expiresAt: d.expiresAt };
}
function readSleep(leaf2) {
  if (!leaf2.data || typeof leaf2.data !== "object") return null;
  const d = leaf2.data;
  if (d.sleeping === false) return { sleeping: false };
  if (d.sleeping !== true) return null;
  for (const name of [d.start, d.loop, d.end]) {
    if (typeof name !== "string" || name === "") return null;
  }
  return { sleeping: true, start: d.start, loop: d.loop, end: d.end };
}
function readPosition(leaf2) {
  if (!leaf2.data || typeof leaf2.data !== "object") return null;
  const d = leaf2.data;
  if (typeof d.x !== "number" || !Number.isFinite(d.x)) return null;
  if (typeof d.y !== "number" || !Number.isFinite(d.y)) return null;
  if (d.mode !== "instant" && d.mode !== "spring" && d.mode !== "line") return null;
  if (d.mode === "line") {
    if (typeof d.duration !== "number" || !Number.isFinite(d.duration) || d.duration < 0) return null;
    return { x: d.x, y: d.y, mode: "line", duration: d.duration };
  }
  return { x: d.x, y: d.y, mode: d.mode, duration: 0 };
}
function readThrow(leaf2) {
  if (!leaf2.data || typeof leaf2.data !== "object") return null;
  const d = leaf2.data;
  if (typeof d.angle !== "number" || !Number.isFinite(d.angle)) return null;
  if (typeof d.power !== "number" || !Number.isFinite(d.power) || d.power <= 0) return null;
  return { angle: d.angle, power: d.power };
}
async function postAction(baseUrl, body) {
  try {
    const res = await fetch(baseUrl, {
      method: "POST",
      ...body === void 0 ? {} : { headers: { "content-type": "application/json" }, body: JSON.stringify(body) }
    });
    if (!res.ok) return false;
    const data = await res.json().catch(() => null);
    return data?.ok === true;
  } catch {
    return false;
  }
}

// vendor/dsh-pet/src/shared/fonts.ts
var FONT_PRESETS = [
  { id: "system", stack: "system-ui,sans-serif" },
  { id: "yahei", stack: '"Microsoft YaHei","PingFang SC",sans-serif' },
  { id: "youyuan", stack: '"YouYuan","Yuanti SC",sans-serif' },
  { id: "kaiti", stack: '"KaiTi","STKaiti",serif' },
  { id: "simsun", stack: '"SimSun","Songti SC",serif' },
  { id: "comic", stack: '"Comic Sans MS","Comic Sans",cursive' }
];
var FONT_SIZE_MIN = 12;
var FONT_SIZE_MAX = 40;
var DEFAULT_FONT = {
  family: "system",
  size: 21,
  followPet: true
};
function fontStackOf(id) {
  return (FONT_PRESETS.find((p) => p.id === id) ?? FONT_PRESETS[0]).stack;
}
var FONT_REF_SIZE = 462;
var BUBBLE_FONT_BASE_PX = 0.0455 * FONT_REF_SIZE;
var TIP_FONT_BASE_PX = 0.026 * FONT_REF_SIZE;
function resolveFontPx(font, size) {
  const own = Number(font?.size);
  const ratio = Number.isFinite(own) && own > 0 ? own / DEFAULT_FONT.size : 1;
  const w = Number(size);
  const follow = font?.followPet !== false;
  const scale = follow && Number.isFinite(w) && w > 0 ? w / FONT_REF_SIZE : 1;
  return {
    bubble: BUBBLE_FONT_BASE_PX * ratio * scale,
    tip: TIP_FONT_BASE_PX * ratio * scale
  };
}

// vendor/dsh-pet/src/shared/pet-size.ts
var BODY_WIDTH_RATIO = (HIT_BOX.x1 - HIT_BOX.x0) / 640;
var SIZE_PERCENT_MIN = 1;
var SIZE_PERCENT_DEFAULT = 20;
function isValidSizePercent(value) {
  return typeof value === "number" && Number.isFinite(value) && value >= SIZE_PERCENT_MIN;
}
function resolvePetSizePx(sizePx, sizePercent, viewportWidthPx) {
  const percent = sizePercent ?? SIZE_PERCENT_DEFAULT;
  if (!isValidSizePercent(percent)) return sizePx;
  if (!Number.isFinite(viewportWidthPx) || viewportWidthPx <= 0) return sizePx;
  const bodyWidthPx = viewportWidthPx * percent / 100;
  return Math.min(sizePx, bodyWidthPx / BODY_WIDTH_RATIO);
}

// vendor/dsh-pet/src/shared/whisper.ts
function whisperBubbleView(state) {
  if (state.ok) return [{ role: "label", text: state.text }];
  const msg = state.reason === "provider-missing" ? "\u5F53\u524D\u5BF9\u8BDD\u672A\u914D\u7F6E\u6A21\u578B\uFF0C\u788E\u788E\u5FF5\u4E0D\u53EF\u7528" : "\u788E\u788E\u5FF5\u751F\u6210\u5931\u8D25" + (state.message ? "\uFF1A" + state.message : "");
  return [{ role: "label", text: msg }];
}
function memeImageUrl(name, base = ROUTE_PATH, assetRoot = "") {
  const root = String(assetRoot ?? "").trim();
  const prefix = root ? "/pic/memes/" + encodeURIComponent(root) : "/pic/memes";
  return base + prefix + "/" + encodeURIComponent(name) + ".png";
}
var MEME_IMG_CLASS = "pet-bub-img";
var MEME_BUBBLE_CLASS = "has-img";
var MEME_BUBBLE_CSS = [
  ".pet-bub-img{--m:var(--f,calc(var(--dsh-pet-size,var(--pet-size,462px))*0.0455));display:block;width:calc(var(--m)*7.4725);max-width:100%;height:auto;border-radius:calc(var(--m)*0.5714);margin:0 auto calc(var(--m)*0.3736);object-fit:cover;pointer-events:none;user-select:none}",
  ".pet-bubble.has-img,.dsh-pet-bubble.has-img{min-width:0}",
  // 语音状态角标：两端共用；绝对定位在气泡右下角，不参与文字排版、不撑高气泡。
  ".dsh-pet-voice-badge{position:absolute;right:calc(var(--f,21px)*0.25);bottom:calc(var(--f,21px)*0.15);width:calc(var(--f,21px)*0.66);height:calc(var(--f,21px)*0.66);display:flex;align-items:center;justify-content:center;font-size:calc(var(--f,21px)*0.5);line-height:1;opacity:.65;pointer-events:none}",
  // 加载态：只有上半圈有颜色的细环，靠旋转表达「在转」。
  '.dsh-pet-voice-badge.is-loading::before{content:"";width:calc(var(--f,21px)*0.5);height:calc(var(--f,21px)*0.5);border:1.5px solid rgba(43,43,43,.22);border-top-color:rgba(43,43,43,.7);border-radius:50%;animation:dsh-pet-voice-spin .8s linear infinite}',
  "@keyframes dsh-pet-voice-spin{to{transform:rotate(360deg)}}",
  // 失败态：静音喇叭，压一点透明度——读得出「这句没念出来」，但不抢文字。
  ".dsh-pet-voice-badge.is-failed{opacity:.5}"
].join("");
var memeCssInjected = false;
function injectMemeBubbleCss() {
  if (memeCssInjected || typeof document === "undefined") return;
  memeCssInjected = true;
  if (document.querySelector('style[data-plugin-css="dsh-pet/meme-bubble"]') !== null) return;
  const tag = document.createElement("style");
  tag.dataset.plugin = "dsh-pet";
  tag.dataset.pluginCss = "dsh-pet/meme-bubble";
  tag.textContent = MEME_BUBBLE_CSS;
  document.head.appendChild(tag);
}

// vendor/dsh-pet/src/client/bubble.ts
var bubbleCss = [
  // 本地字体：由 host 从 assets/fonts 提供；font-display:swap 先回退后切换。
  '.dsh-pet-bubble{position:absolute;left:50%;transform:translateX(-50%);bottom:calc(100% - var(--dsh-pet-size)*0.108);width:max-content;min-width:calc(var(--f)*5.7143);max-width:min(calc(var(--f)*16),100%);box-sizing:content-box;padding:calc(var(--f)*0.4835) calc(var(--f)*0.6593);border-radius:calc(var(--f)*0.7692);background:rgba(255,255,255,.92);--f0:var(--dsh-pet-font-bubble,calc(var(--dsh-pet-size)*0.0455));--f:var(--f0);color:#2b2b2b;font-family:var(--dsh-pet-font-family,"ShangshouSoftCandy","Yuanti SC","YouYuan","\u5E7C\u5706","Comic Sans MS","PingFang SC","Microsoft YaHei",sans-serif);font-size:var(--f);line-height:1.6;z-index:3;pointer-events:none;box-shadow:0 calc(var(--f)*0.1978) calc(var(--f)*0.7692) rgba(0,0,0,.14),0 1px 3px rgba(0,0,0,.08);backdrop-filter:blur(6px);opacity:0;transition:opacity .25s ease;white-space:normal;overflow-wrap:break-word}',
  // 底部尾巴：小三角指向下方宠物，尺寸锚字号。
  '.dsh-pet-bubble::after{content:"";position:absolute;left:50%;bottom:calc(var(--f)*-0.3736);transform:translateX(-50%);border:calc(var(--f)*0.3736) solid transparent;border-top-color:rgba(255,255,255,.92);border-bottom:none}',
  ".dsh-pet-bubble.is-on{opacity:1}",
  // 碎碎念变体：字号缩到余额气泡的 0.75，宽度下限更窄，上限与折行规则相同。
  ".dsh-pet-bubble.dsh-pet-whisper{font-size:calc(var(--f)*0.7473);min-width:calc(var(--f)*2.1978);max-width:min(calc(var(--f)*10.989),100%)}",
  // 配图样式在 shared 的 MEME_BUBBLE_CSS，这里只保留标题与行样式。
  ".dsh-pet-bubble .pet-bub-title{font-size:calc(var(--f)*0.7692);color:rgba(43,43,43,.6);margin-bottom:calc(var(--f)*0.1978)}",
  ".dsh-pet-bubble .pet-bub-row{display:flex;justify-content:space-between;gap:calc(var(--f)*0.6593);flex-wrap:wrap}",
  // 档位行由多个片段拼成：只在片段之间换行，片段内部不拆字，避免竖排。
  ".dsh-pet-bubble .pet-bub-row>span{white-space:nowrap}",
  ".dsh-pet-bubble .pet-bub-sub{font-size:calc(var(--f)*0.7692);color:rgba(43,43,43,.6)}",
  ".dsh-pet-bubble .pet-bub-val{font-variant-numeric:tabular-nums;font-weight:650;color:#1f1f1f}",
  ".dsh-pet-bubble .pet-bub-err{color:#d94f3d;font-size:calc(var(--f)*0.7692)}",
  ".dsh-pet-bubble .pet-bub-tag{margin-left:calc(var(--f)*0.2857);font-size:calc(var(--f)*0.4835);color:rgba(43,43,43,.55);border:1px solid rgba(43,43,43,.25);border-radius:calc(var(--f)*0.2857);padding:0 calc(var(--f)*0.1978);vertical-align:1px}",
  // 峰/谷计价档位：峰红、谷绿。
  ".dsh-pet-bubble .pet-bub-tier{font-weight:700}",
  ".dsh-pet-bubble .pet-bub-tier-peak{color:#e53935}",
  ".dsh-pet-bubble .pet-bub-tier-idle{color:#2e9e4f}",
  // 展开态：每个窗口一行，进度条长度等于已用百分比。
  // 气泡默认不挡宿主页面，只有可展开的余额气泡才开命中。
  ".dsh-pet-bubble.is-clickable{pointer-events:auto;cursor:pointer}",
  // 收起态排不下「窗口名 + 条 + 百分比 + 重置」四列，展开态单独加宽并缩到 60% 字号。
  ".dsh-pet-bubble.is-expanded{--f:calc(var(--f0)*0.6);width:min(calc(var(--f)*21),100%);max-width:100%}",
  // 淡出：换内容前先透明，换完去掉这个类再淡入。
  ".dsh-pet-bubble.is-on.is-fading{opacity:0}",
  ".dsh-pet-bubble .pet-bub-quota{display:flex;align-items:center;gap:calc(var(--f)*0.4);margin:calc(var(--f)*0.13) 0}",
  ".dsh-pet-bubble .pet-bub-quota-label{flex:none;min-width:calc(var(--f)*1.9);font-size:calc(var(--f)*0.7692);color:rgba(43,43,43,.6)}",
  ".dsh-pet-bubble .pet-bub-quota-bar{flex:1 1 auto;height:calc(var(--f)*0.5);border-radius:calc(var(--f)*0.25);background:rgba(43,43,43,.12);overflow:hidden}",
  ".dsh-pet-bubble .pet-bub-quota-fill{display:block;height:100%;border-radius:inherit;background:#2e9e4f}",
  ".dsh-pet-bubble .pet-bub-quota-fill.pet-bub-quota-warn{background:#e8952f}",
  ".dsh-pet-bubble .pet-bub-quota-fill.pet-bub-quota-crit{background:#e53935}",
  ".dsh-pet-bubble .pet-bub-quota-used{flex:none;min-width:calc(var(--f)*2.2);text-align:right;font-variant-numeric:tabular-nums;font-weight:650;color:#1f1f1f}",
  ".dsh-pet-bubble .pet-bub-quota-reset{flex:none;min-width:calc(var(--f)*2.6);text-align:right;font-size:calc(var(--f)*0.7692);color:rgba(43,43,43,.6)}",
  // 用量页（第三页）：三行两列占满展开态宽度，总量是唯一的大字。
  // 配色只给进/出两处强调，其余沿用次级灰——同页里超过两种彩色会盖过数值本身。
  ".dsh-pet-bubble .pet-bub-usage{display:flex;flex-direction:column;gap:calc(var(--f)*0.22);margin:calc(var(--f)*0.1) 0}",
  ".dsh-pet-bubble .pet-bub-usage-line{display:flex;align-items:baseline;justify-content:space-between;gap:calc(var(--f)*0.8);line-height:1.45}",
  ".dsh-pet-bubble .pet-bub-usage-title{font-size:calc(var(--f)*0.7692);color:rgba(43,43,43,.62)}",
  ".dsh-pet-bubble .pet-bub-usage-total{font-size:calc(var(--f)*1.45);line-height:1.2;font-weight:700;font-variant-numeric:tabular-nums;letter-spacing:-.02em;color:#1f1f1f}",
  ".dsh-pet-bubble .pet-bub-usage-in{font-size:calc(var(--f)*0.7692);font-variant-numeric:tabular-nums;color:#3f6ea8}",
  ".dsh-pet-bubble .pet-bub-usage-out{font-size:calc(var(--f)*0.7692);font-variant-numeric:tabular-nums;color:#b4703c}",
  ".dsh-pet-bubble .pet-bub-usage-period{font-size:calc(var(--f)*0.7692);color:rgba(43,43,43,.62)}",
  ".dsh-pet-bubble .pet-bub-usage-spend{font-size:calc(var(--f)*0.7692);font-weight:650;font-variant-numeric:tabular-nums;color:#1f1f1f}",
  // 进出比例条：两段按真实占比分宽，颜色与下面的数字一一对应；占比极小时只留一条细线，不放大。
  ".dsh-pet-bubble .pet-bub-usage-bar{display:flex;height:calc(var(--f)*0.3);border-radius:calc(var(--f)*0.15);overflow:hidden;background:rgba(43,43,43,.1);margin:calc(var(--f)*0.05) 0}",
  ".dsh-pet-bubble .pet-bub-usage-bar-in{display:block;height:100%;background:#3f6ea8}",
  ".dsh-pet-bubble .pet-bub-usage-bar-out{display:block;height:100%;background:#b4703c}"
].join("\n");
function injectBubbleCss() {
  if (typeof document !== "undefined" && document.querySelector('style[data-plugin-css="dsh-pet/bubble"]') === null) {
    const tag = document.createElement("style");
    tag.dataset.plugin = "dsh-pet";
    tag.dataset.pluginCss = "dsh-pet/bubble";
    tag.textContent = bubbleCss;
    document.head.appendChild(tag);
  }
}
function rowsToNodes(h, rows) {
  if (rows.some((r) => r.role === "tier")) {
    return h("div", {
      className: "pet-bub-row",
      children: rows.map((r, i) => {
        if (r.role === "quota") return null;
        if (r.role === "tier") {
          return h("span", {
            key: i,
            className: "pet-bub-tier pet-bub-tier-" + r.tier,
            children: r.text
          });
        }
        return h("span", { key: i, children: r.text });
      })
    });
  }
  return rows.map((r, i) => {
    if (r.role === "quota") {
      return h("div", {
        key: i,
        className: "pet-bub-quota",
        children: [
          h("span", { key: "label", className: "pet-bub-quota-label", children: r.label }),
          h("span", {
            key: "bar",
            className: "pet-bub-quota-bar",
            children: h("i", {
              className: "pet-bub-quota-fill pet-bub-quota-" + r.tone,
              style: { width: Math.max(0, Math.min(100, r.percent)) + "%" }
            })
          }),
          h("span", { key: "used", className: "pet-bub-quota-used", children: r.usedText }),
          h("span", { key: "reset", className: "pet-bub-quota-reset", children: r.resetText })
        ]
      });
    }
    if (r.role === "usage") {
      return h("div", {
        key: i,
        className: "pet-bub-usage",
        children: [
          h("div", {
            key: "head",
            className: "pet-bub-usage-line",
            children: [
              h("span", { key: "title", className: "pet-bub-usage-title", children: r.title }),
              h("span", { key: "total", className: "pet-bub-usage-total", children: r.total })
            ]
          }),
          // 进出比例条：宽度即真实占比，输入通常压倒性占多数，条偏单色属正常。
          r.inputPercent === void 0 ? null : h("div", {
            key: "bar",
            className: "pet-bub-usage-bar",
            children: [
              h("i", { key: "in", className: "pet-bub-usage-bar-in", style: { width: r.inputPercent + "%" } }),
              h("i", {
                key: "out",
                className: "pet-bub-usage-bar-out",
                style: { width: 100 - r.inputPercent + "%" }
              })
            ]
          }),
          h("div", {
            key: "io",
            className: "pet-bub-usage-line",
            children: [
              h("span", { key: "in", className: "pet-bub-usage-in", children: r.input }),
              h("span", { key: "out", className: "pet-bub-usage-out", children: r.output })
            ]
          }),
          h("div", {
            key: "foot",
            className: "pet-bub-usage-line",
            children: [
              h("span", { key: "period", className: "pet-bub-usage-period", children: r.period }),
              h("span", { key: "spend", className: "pet-bub-usage-spend", children: r.spend })
            ]
          })
        ]
      });
    }
    if (r.role === "error") return h("div", { key: i, className: "pet-bub-err", children: r.text });
    if (r.role === "sub") return h("div", { key: i, className: "pet-bub-row pet-bub-sub", children: r.text });
    return h("div", { key: i, className: "pet-bub-row", children: r.text });
  });
}
function treeToNodes(h, node, key) {
  const props = { key };
  if (node.style) props.style = node.style;
  if (node.tag === "img") {
    props.src = node.src ?? "";
    props.alt = "";
    return h("img", props);
  }
  const children = [];
  if (node.text) children.push(node.text);
  for (let i = 0; i < (node.children?.length ?? 0); i++) {
    children.push(treeToNodes(h, node.children[i], i));
  }
  props.children = children;
  return h(node.tag, props);
}
var BALANCE_FADE_MS = 250;
function makeBalanceBubble(rt) {
  const { h, useState, useEffect } = rt;
  injectBubbleCss();
  return function BalanceBubble({
    state,
    on,
    index,
    onCycle
  }) {
    const [shown, setShown] = useState(0);
    const [fading, setFading] = useState(false);
    useEffect(() => {
      if (index === shown) return;
      setFading(true);
      const timer = window.setTimeout(() => {
        setShown(index);
        setFading(false);
      }, BALANCE_FADE_MS);
      return () => window.clearTimeout(timer);
    }, [index, shown]);
    const isCustom = state.ok && state.shape === "custom";
    const views = isCustom ? customViews(state) : void 0;
    const tree = views ? views[Math.min(shown, views.length - 1)] : void 0;
    const rows = isCustom ? [] : balancePageView(state, shown);
    const clickable = state.ok && (state.shape === "windows" || isCustom && customClickable(state));
    const wrap = state.ok ? "" : " dsh-pet-whisper";
    return h("div", {
      className: "dsh-pet-bubble" + wrap + (on ? " is-on" : "") + (clickable ? " is-clickable" : "") + (!isCustom && shown > 0 ? " is-expanded" : "") + (fading ? " is-fading" : ""),
      // 就地吞掉，避免触发宠物本体的点击与拖拽。
      onClick: clickable ? (e) => {
        e.stopPropagation();
        onCycle();
      } : void 0,
      children: tree ? treeToNodes(h, tree, "tree") : rowsToNodes(h, rows)
    });
  };
}
function makeWhisperBubble(rt) {
  const { h } = rt;
  injectBubbleCss();
  injectMemeBubbleCss();
  return function WhisperBubble({
    text,
    image,
    url,
    assetRoot,
    on,
    voiceState: voiceState2 = "idle",
    onClick
  }) {
    const rows = whisperBubbleView({ ok: true, text, ts: 0 });
    const key = String(image ?? "").trim();
    const href = String(url ?? "").trim();
    const src = href || (key ? memeImageUrl(key, ROUTE_PATH, assetRoot) : "");
    const body = src ? [
      h("img", {
        key: "img",
        className: MEME_IMG_CLASS,
        // 名称形态拼本页路由前缀；url 形态是完整地址，与本页 origin 无关。
        src,
        alt: key || href
      }),
      rowsToNodes(h, rows)
    ] : rowsToNodes(h, rows);
    return h("div", {
      className: "dsh-pet-bubble dsh-pet-whisper" + (src ? " " + MEME_BUBBLE_CLASS : "") + (on ? " is-on" : "") + (onClick ? " is-clickable" : ""),
      // 点在气泡上不能漏到底下的宠物本体：那里是拖拽与「摸一下」的命中区。
      onClick: onClick ? (e) => {
        e.stopPropagation();
        onClick(e);
      } : void 0,
      children: voiceState2 === "idle" ? body : [body, voiceBadgeNode(h, voiceState2)]
    });
  };
}
function voiceBadgeNode(h, state) {
  return h("span", {
    key: "voice",
    className: "dsh-pet-voice-badge" + (state === "loading" ? " is-loading" : "") + (state === "failed" ? " is-failed" : ""),
    "aria-hidden": "true",
    children: state === "loading" ? null : state === "failed" ? "\u{1F507}" : "\u{1F50A}"
  });
}

// vendor/dsh-pet/src/shared/todo/types.ts
function numberOr(raw, fallback) {
  return typeof raw === "number" && Number.isFinite(raw) ? raw : fallback;
}
function parseTodoItem(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const record = raw;
  if (typeof record.id !== "string" || record.id === "") return null;
  if (typeof record.text !== "string") return null;
  const dueAt = record.dueAt === null || record.dueAt === void 0 ? null : typeof record.dueAt === "number" && Number.isFinite(record.dueAt) ? record.dueAt : void 0;
  if (dueAt === void 0) return null;
  return {
    id: record.id,
    text: record.text,
    dueAt,
    done: record.done === true,
    createdAt: numberOr(record.createdAt, 0),
    updatedAt: numberOr(record.updatedAt, 0),
    completedAt: typeof record.completedAt === "number" ? record.completedAt : null
  };
}
function parseTodoList(raw) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  for (const item of raw) {
    const todo = parseTodoItem(item);
    if (todo !== null) out.push(todo);
  }
  return out;
}

// vendor/dsh-pet/src/shared/todo/api.ts
var TODOS_PATH = ROUTE_PATH + "/todos";
async function send(url, method, body) {
  try {
    const response = await fetch(url, {
      method,
      cache: "no-store",
      ...body === void 0 ? {} : { headers: { "content-type": "application/json" }, body: JSON.stringify(body) }
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) return { failed: true, message: `\u8BF7\u6C42\u5931\u8D25\uFF08HTTP ${response.status}\uFF09` };
    if (payload === null) return { failed: true, message: "\u54CD\u5E94\u4E0D\u662F JSON" };
    if (payload.ok === false) {
      const reason = typeof payload.message === "string" ? payload.message : payload.reason;
      return { failed: true, message: typeof reason === "string" && reason !== "" ? reason : "\u8BF7\u6C42\u88AB\u62D2\u7EDD" };
    }
    return { failed: false, body: payload };
  } catch (error) {
    return { failed: true, message: "\u8FDE\u4E0D\u4E0A\u684C\u5BA0\u670D\u52A1\uFF1A" + (error instanceof Error ? error.message : String(error)) };
  }
}
function readTodo(body) {
  const todo = parseTodoItem(body.todo);
  return todo === null ? { ok: false, message: "\u54CD\u5E94\u91CC\u6CA1\u6709\u6709\u6548\u7684\u5F85\u529E" } : { ok: true, value: todo };
}
async function loadTodos(baseUrl = TODOS_PATH) {
  const result = await send(baseUrl, "GET");
  if (result.failed) return { ok: false, message: result.message };
  return { ok: true, value: parseTodoList(result.body.todos) };
}
async function addTodo(text, dueAt, baseUrl = TODOS_PATH) {
  const result = await send(baseUrl, "POST", { text, dueAt });
  if (result.failed) return { ok: false, message: result.message };
  return readTodo(result.body);
}
async function patchTodo(id, patch, baseUrl = TODOS_PATH) {
  const result = await send(baseUrl + "/" + encodeURIComponent(id), "PATCH", patch);
  if (result.failed) return { ok: false, message: result.message };
  return readTodo(result.body);
}
async function removeTodo(id, baseUrl = TODOS_PATH) {
  const result = await send(baseUrl + "/" + encodeURIComponent(id), "DELETE");
  if (result.failed) return { ok: false, message: result.message };
  return { ok: true, value: typeof result.body.removed === "number" ? result.body.removed : 0 };
}

// vendor/dsh-pet/src/shared/todo/format.ts
var MINUTE_MS = 60 * 1e3;
var HOUR_MS = 60 * MINUTE_MS;
var DAY_MS = 24 * HOUR_MS;
var WEEKDAYS = ["\u5468\u65E5", "\u5468\u4E00", "\u5468\u4E8C", "\u5468\u4E09", "\u5468\u56DB", "\u5468\u4E94", "\u5468\u516D"];
function pad2(value) {
  return String(value).padStart(2, "0");
}
function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}
function dayDiff(target, base) {
  return Math.round((startOfDay(target) - startOfDay(base)) / DAY_MS);
}
function spanText(ms) {
  const minutes = Math.max(1, Math.round(Math.abs(ms) / MINUTE_MS));
  if (minutes < 60) return `${minutes}\u5206\u949F`;
  const hours = Math.max(1, Math.round(minutes / 60));
  if (hours < 24) return `${hours}\u5C0F\u65F6`;
  return `${Math.max(1, Math.round(hours / 24))}\u5929`;
}
function dueLabel(dueAt, now) {
  if (dueAt === null) return "\u65E0\u671F\u9650";
  const due = new Date(dueAt);
  const clock = `${pad2(due.getHours())}:${pad2(due.getMinutes())}`;
  const days = dayDiff(due, new Date(now));
  if (days === 0) return `\u4ECA\u5929 ${clock}`;
  if (days === 1) return `\u660E\u5929 ${clock}`;
  if (days === 2) return `\u540E\u5929 ${clock}`;
  if (days > 2 && days < 7) return `${WEEKDAYS[due.getDay()]} ${clock}`;
  return `${due.getMonth() + 1}\u6708${due.getDate()}\u65E5 ${clock}`;
}
function remainingLabel(dueAt, now) {
  if (dueAt === null) return "";
  if (dueAt <= now) return `\u5DF2\u903E\u671F${spanText(now - dueAt)}`;
  return `\u8FD8\u5269${spanText(dueAt - now)}`;
}
function todoUrgency(dueAt, now) {
  if (dueAt === null) return "undated";
  const remaining = dueAt - now;
  if (remaining <= 0) return "overdue";
  if (remaining <= 6 * HOUR_MS) return "soon";
  if (remaining <= DAY_MS) return "today";
  return "later";
}
function metaLabel(todo, now) {
  if (todo.done) {
    return todo.dueAt === null ? "\u5DF2\u5B8C\u6210" : `\u5DF2\u5B8C\u6210 \xB7 ${dueLabel(todo.dueAt, now)}`;
  }
  if (todo.dueAt === null) return "\u65E0\u671F\u9650";
  const relative = remainingLabel(todo.dueAt, now);
  if (todo.dueAt <= now) return relative;
  return `${dueLabel(todo.dueAt, now)} \xB7 ${relative}`;
}
function formatDateTimeLocal(ms) {
  const date = new Date(ms);
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}T${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}
function parseDateTimeLocal(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59) return null;
  const date = new Date(year, month - 1, day, hour, minute, 0, 0);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  return date.getTime();
}

// vendor/dsh-pet/src/shared/todo/calendar.ts
function monthCells(year, month) {
  const first = new Date(year, month, 1);
  const lead = (first.getDay() + 6) % 7;
  const days = new Date(year, month + 1, 0).getDate();
  const rows = Math.ceil((lead + days) / 7);
  const cells = [];
  for (let i = 0; i < rows * 7; i++) {
    const date = new Date(year, month, 1 - lead + i);
    cells.push({ date, out: date.getMonth() !== month });
  }
  return cells;
}

// vendor/dsh-pet/src/shared/todo/due-picker.ts
var WEEK_HEAD = ["\u4E00", "\u4E8C", "\u4E09", "\u56DB", "\u4E94", "\u516D", "\u65E5"];
var MINUTE_STEP = 5;
var DEFAULT_HOUR = 9;
function pad22(value) {
  return String(value).padStart(2, "0");
}
function make(tag, className) {
  const node = document.createElement(tag);
  node.className = className;
  return node;
}
function makeButton(className, text) {
  const button = make("button", className);
  button.type = "button";
  if (text !== void 0) button.textContent = text;
  return button;
}
function buildPickerDom() {
  const el = makeButton("dsh-pet-todo-due", "\u65E0\u671F\u9650");
  el.setAttribute("aria-haspopup", "dialog");
  el.setAttribute("aria-expanded", "false");
  el.setAttribute("aria-label", "\u63D0\u9192\u65F6\u95F4\uFF08\u53EF\u9009\uFF09");
  const calendar = make("div", "dsh-pet-todo-cal");
  calendar.setAttribute("role", "dialog");
  calendar.setAttribute("aria-label", "\u9009\u62E9\u63D0\u9192\u65F6\u95F4");
  const head = make("div", "dsh-pet-todo-cal-head");
  const prev = makeButton("dsh-pet-todo-cal-nav", "\u2039");
  prev.dataset.act = "prev";
  prev.setAttribute("aria-label", "\u4E0A\u4E2A\u6708");
  const title = make("span", "dsh-pet-todo-cal-title");
  const next = makeButton("dsh-pet-todo-cal-nav", "\u203A");
  next.dataset.act = "next";
  next.setAttribute("aria-label", "\u4E0B\u4E2A\u6708");
  head.append(prev, title, next);
  const week = make("div", "dsh-pet-todo-cal-week");
  for (const name of WEEK_HEAD) {
    const cell = make("span", "");
    cell.textContent = name;
    week.appendChild(cell);
  }
  const grid = make("div", "dsh-pet-todo-cal-grid");
  const foot = make("div", "dsh-pet-todo-cal-foot");
  const today = makeButton("dsh-pet-todo-cal-act", "\u4ECA\u5929");
  today.dataset.act = "today";
  const clear = makeButton("dsh-pet-todo-cal-act", "\u6E05\u9664");
  clear.dataset.act = "clear";
  const grow = make("span", "dsh-pet-todo-cal-grow");
  const hourChip = makeButton("dsh-pet-todo-cal-chip", "09");
  hourChip.dataset.act = "hour";
  hourChip.setAttribute("aria-label", "\u9009\u62E9\u5C0F\u65F6");
  const colon = make("span", "dsh-pet-todo-cal-colon");
  colon.textContent = ":";
  const minuteChip = makeButton("dsh-pet-todo-cal-chip", "00");
  minuteChip.dataset.act = "minute";
  minuteChip.setAttribute("aria-label", "\u9009\u62E9\u5206\u949F");
  const done = makeButton("dsh-pet-todo-cal-act", "\u5B8C\u6210");
  done.dataset.act = "done";
  foot.append(today, clear, grow, hourChip, colon, minuteChip, done);
  calendar.append(head, week, grid, foot);
  return { el, calendar, prev, next, title, grid, hourChip, minuteChip };
}
function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
function dueMs(state) {
  if (state.picked === null) return null;
  const { picked } = state;
  return new Date(picked.getFullYear(), picked.getMonth(), picked.getDate(), state.hour, state.minute).getTime();
}
function cellButton(text, selected) {
  const button = makeButton("dsh-pet-todo-cal-cell", text);
  button.classList.toggle("is-sel", selected);
  button.setAttribute("aria-pressed", String(selected));
  return button;
}
function renderDays(dom, state) {
  const today = /* @__PURE__ */ new Date();
  for (const cell of monthCells(state.view.getFullYear(), state.view.getMonth())) {
    const { date } = cell;
    const button = cellButton(String(date.getDate()), state.picked !== null && sameDay(state.picked, date));
    button.classList.toggle("is-out", cell.out);
    button.classList.toggle("is-today", sameDay(today, date));
    button.dataset.ts = String(date.getTime());
    button.setAttribute("aria-label", `${date.getMonth() + 1}\u6708${date.getDate()}\u65E5`);
    dom.grid.appendChild(button);
  }
}
function renderNumbers(dom, state) {
  const isHour = state.mode === "hour";
  const count = isHour ? 24 : 60;
  const step = isHour ? 1 : MINUTE_STEP;
  for (let value = 0; value < count; value += step) {
    const button = cellButton(pad22(value), (isHour ? state.hour : state.minute) === value);
    button.dataset.num = String(value);
    button.setAttribute("aria-label", `${value} ${isHour ? "\u65F6" : "\u5206"}`);
    dom.grid.appendChild(button);
  }
}
function syncPicker(dom, state) {
  const ms = dueMs(state);
  dom.el.textContent = ms === null ? "\u65E0\u671F\u9650" : dueLabel(ms, Date.now());
  dom.el.classList.toggle("is-set", ms !== null);
  dom.hourChip.textContent = pad22(state.hour);
  dom.minuteChip.textContent = pad22(state.minute);
  dom.hourChip.classList.toggle("is-on", state.mode === "hour");
  dom.minuteChip.classList.toggle("is-on", state.mode === "minute");
}
function renderPicker(dom, state) {
  const day = state.mode === "day";
  dom.title.textContent = day ? `${state.view.getFullYear()}\u5E74${state.view.getMonth() + 1}\u6708` : state.mode === "hour" ? "\u9009\u62E9\u5C0F\u65F6" : "\u9009\u62E9\u5206\u949F";
  dom.prev.hidden = !day;
  dom.next.hidden = !day;
  dom.grid.className = "dsh-pet-todo-cal-grid is-" + state.mode;
  dom.grid.textContent = "";
  if (day) renderDays(dom, state);
  else renderNumbers(dom, state);
  syncPicker(dom, state);
}
function pickDay(dom, state, date) {
  state.picked = date;
  state.view = new Date(date.getFullYear(), date.getMonth(), 1);
  state.mode = "day";
  renderPicker(dom, state);
}
function onCalendarClick(dom, state, button, close) {
  const { ts, num, act } = button.dataset;
  if (ts !== void 0) {
    pickDay(dom, state, new Date(Number(ts)));
    return;
  }
  if (num !== void 0) {
    if (state.mode === "hour") state.hour = Number(num);
    else state.minute = Number(num);
    state.mode = "day";
    renderPicker(dom, state);
    return;
  }
  if (act === "prev" || act === "next") {
    state.view = new Date(state.view.getFullYear(), state.view.getMonth() + (act === "prev" ? -1 : 1), 1);
    renderPicker(dom, state);
    return;
  }
  if (act === "hour" || act === "minute") {
    state.mode = state.mode === act ? "day" : act;
    renderPicker(dom, state);
    return;
  }
  if (act === "today") {
    const now = /* @__PURE__ */ new Date();
    pickDay(dom, state, new Date(now.getFullYear(), now.getMonth(), now.getDate()));
    return;
  }
  if (act === "clear") state.picked = null;
  renderPicker(dom, state);
  if (act === "clear" || act === "done") close();
}
function createDuePicker(options = {}) {
  const now = /* @__PURE__ */ new Date();
  const state = {
    picked: null,
    hour: DEFAULT_HOUR,
    minute: 0,
    view: new Date(now.getFullYear(), now.getMonth(), 1),
    mode: "day",
    open: false
  };
  const dom = buildPickerDom();
  const setOpen = (open) => {
    if (state.open === open) return;
    state.open = open;
    dom.el.setAttribute("aria-expanded", String(open));
    options.onOpenChange?.(open);
  };
  dom.el.addEventListener("click", () => {
    if (!state.open) {
      const anchor = state.picked ?? /* @__PURE__ */ new Date();
      state.view = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
      state.mode = "day";
      renderPicker(dom, state);
    }
    setOpen(!state.open);
  });
  dom.calendar.addEventListener("click", (event) => {
    const button = event.target.closest("button");
    if (button !== null) onCalendarClick(dom, state, button, () => setOpen(false));
  });
  const onDocMouseDown = (event) => {
    if (!state.open) return;
    const target = event.target;
    if (target !== null && (dom.el.contains(target) || dom.calendar.contains(target))) return;
    setOpen(false);
  };
  document.addEventListener("mousedown", onDocMouseDown, true);
  renderPicker(dom, state);
  return {
    el: dom.el,
    calendar: dom.calendar,
    value: () => {
      const ms = dueMs(state);
      return ms === null ? "" : formatDateTimeLocal(ms);
    },
    close: () => setOpen(false),
    reset: () => {
      state.picked = null;
      state.hour = DEFAULT_HOUR;
      state.minute = 0;
      state.mode = "day";
      renderPicker(dom, state);
      setOpen(false);
    },
    dispose: () => document.removeEventListener("mousedown", onDocMouseDown, true)
  };
}

// vendor/dsh-pet/src/shared/todo/render.ts
var DELETE_ARM_MS = 2500;
var EMPTY_TEXT = "\u8FD8\u6CA1\u6709\u5F85\u529E\u3002\u8BB0\u4E00\u4EF6\u8981\u505A\u7684\u4E8B\uFF0C\u5230\u70B9\u6211\u4F1A\u63D0\u9192\u4F60\uFF5E";
var LIST_ROWS = 2;
function element(tag, className, text) {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== void 0) node.textContent = text;
  return node;
}
function fold(className, children) {
  const outer = element("div", "dsh-pet-todo-fold " + className);
  const clip = element("div", "dsh-pet-todo-foldClip");
  clip.append(...children);
  outer.appendChild(clip);
  return outer;
}
function createTodoPanelParts() {
  const root = element("div", "dsh-pet-todo");
  root.setAttribute("role", "dialog");
  root.setAttribute("aria-label", "\u5F85\u529E\u4E8B\u9879");
  const head = element("div", "dsh-pet-todo-head");
  const title = element("span", "dsh-pet-todo-title", "\u5F85\u529E\u4E8B\u9879");
  const count = element("span", "dsh-pet-todo-count", "0 \u9879\u672A\u5B8C\u6210");
  count.setAttribute("aria-live", "polite");
  const closeButton = element("button", "dsh-pet-todo-close", "\u2715");
  closeButton.type = "button";
  closeButton.setAttribute("aria-label", "\u5173\u95ED\u5F85\u529E\u9762\u677F");
  head.append(title, count, closeButton);
  const form = element("form", "dsh-pet-todo-form");
  const input = element("input", "dsh-pet-todo-input");
  input.type = "text";
  input.maxLength = 200;
  input.placeholder = "\u8BB0\u4E00\u4EF6\u8981\u505A\u7684\u4E8B\u2026";
  input.autocomplete = "off";
  input.setAttribute("aria-label", "\u5F85\u529E\u5185\u5BB9");
  const row = element("div", "dsh-pet-todo-row");
  const duePicker = createDuePicker({ onOpenChange: (open) => root.classList.toggle("is-picking", open) });
  const addButton = element("button", "dsh-pet-todo-add", "\u6DFB\u52A0");
  addButton.type = "submit";
  row.append(duePicker.el, addButton);
  form.append(input, row);
  const error = element("div", "dsh-pet-todo-err");
  error.hidden = true;
  const empty = element("div", "dsh-pet-todo-empty", EMPTY_TEXT);
  empty.hidden = true;
  const list = element("ul", "dsh-pet-todo-list");
  const hint = element("div", "dsh-pet-todo-hint", "\u79BB\u5230\u671F\u8D8A\u8FD1\uFF0C\u6211\u4F1A\u63D0\u9192\u5F97\u8D8A\u52E4\u5FEB\uFF5E");
  const lower = element("div", "dsh-pet-todo-lower");
  lower.append(fold("is-cal", [duePicker.calendar]), fold("is-list", [error, empty, list, hint]));
  root.append(head, form, lower);
  return { root, form, input, duePicker, addButton, list, empty, count, closeButton, error };
}
function capListHeight(list) {
  const first = list.firstElementChild;
  if (first === null) {
    list.style.maxHeight = "";
    return;
  }
  const rowHeight = first.getBoundingClientRect().height;
  if (rowHeight <= 0) return;
  const pad = parseFloat(getComputedStyle(list).paddingTop) || 0;
  list.style.maxHeight = rowHeight * LIST_ROWS + pad * 2 + "px";
}
function renderTodoList(parts, todos, handlers, now) {
  parts.list.textContent = "";
  const pending = todos.filter((todo) => !todo.done).length;
  parts.count.textContent = `${pending} \u9879\u672A\u5B8C\u6210`;
  parts.empty.textContent = EMPTY_TEXT;
  parts.empty.hidden = todos.length > 0;
  for (const todo of todos) parts.list.appendChild(renderItem(todo, handlers, now));
  capListHeight(parts.list);
}
function renderItem(todo, handlers, now) {
  const item = element("li", "dsh-pet-todo-item" + (todo.done ? " is-done" : ""));
  if (!todo.done) item.dataset.urgency = todoUrgency(todo.dueAt, now);
  const check = element("input", "dsh-pet-todo-check");
  check.type = "checkbox";
  check.checked = todo.done;
  check.setAttribute("aria-label", (todo.done ? "\u6807\u8BB0\u672A\u5B8C\u6210\uFF1A" : "\u6807\u8BB0\u5B8C\u6210\uFF1A") + todo.text);
  check.addEventListener("change", () => handlers.onToggle(todo, check.checked));
  const main = element("div", "dsh-pet-todo-main");
  const text = element("div", "dsh-pet-todo-text", todo.text);
  const meta = element("div", "dsh-pet-todo-meta", metaLabel(todo, now));
  main.append(text, meta);
  const remove = element("button", "dsh-pet-todo-del", "\u2715");
  remove.type = "button";
  remove.setAttribute("aria-label", "\u5220\u9664\uFF1A" + todo.text);
  remove.addEventListener("click", () => {
    if (remove.dataset.armed !== "1") {
      remove.dataset.armed = "1";
      remove.classList.add("is-armed");
      remove.textContent = "\u786E\u8BA4";
      window.setTimeout(() => {
        if (!remove.isConnected) return;
        delete remove.dataset.armed;
        remove.classList.remove("is-armed");
        remove.textContent = "\u2715";
      }, DELETE_ARM_MS);
      return;
    }
    handlers.onDelete(todo);
  });
  item.append(check, main, remove);
  return item;
}
function setTodoError(parts, message) {
  parts.error.hidden = message === null;
  parts.error.textContent = message ?? "";
}
function setTodoBusy(parts, busy) {
  parts.input.disabled = busy;
  parts.duePicker.el.disabled = busy;
  parts.addButton.disabled = busy;
}

// vendor/dsh-pet/src/shared/todo/styles.ts
var TODO_FONT_SCALE = 0.618;
var TODO_PANEL_METRICS = {
  /** 头部：上下内边距 + 标题行（行高 1.5 × 字号 1.077）。 */
  head: 0.769 + 0.615 + 1.077 * 1.5,
  /** 表单：正文框 + 间距 + 时间行 + 下内边距。 */
  form: 0.462 * 2 + 1.4 + 0.462 + (0.462 * 2 + 1.4) + 0.769,
  /** 清单态：上下内边距 + 两行条目（每行 = 内边距 + 正文 + 行距 + 时间标签）。 */
  list: 0.462 * 2 + 2 * (0.538 * 2 + 1.5 + 0.154 + 0.846 * 1.5),
  /** 底部提示。 */
  hint: 0.462 + 0.692 + 0.846 * 1.5,
  /** 日历态：内边距 + 标题行 + 星期行 + 六行日期 + 底部操作行 + 行间空隙。 */
  calendar: 1.077 + 1.077 * 1.5 + 0.846 * 1.5 + 6 * (1.4 + 0.231 * 2) + 5 * 0.154 + (0.923 * 1.5 + 0.462) + 0.308 * 3
};
var TODO_CSS = [
  // 气泡变体：两端气泡的基础类不同（网页 .dsh-pet-bubble / 桌面 .pet-bubble），所以并列两条提高特异性，
  // 不依赖注入顺序压过基础样式。宽度锚 --f（14.65 × 21.02 ≈ 308px），max() 给 220px 下限防止
  // 小字号下输入框与按钮挤成一列，max-width 再把整体夹回视口。
  ".dsh-pet-bubble.dsh-pet-todo-bubble,.pet-bubble.dsh-pet-todo-bubble{padding:0;",
  "width:max(220px,calc(var(--f)*14.65));max-width:calc(100vw - 16px);pointer-events:auto;cursor:default}",
  // 面板本体：只负责竖向排布，外框（底色/圆角/阴影/尾巴）全部交给气泡，圆角用 inherit 对齐。
  // 尺寸一律 em，基准是本行的 --t；自己改了 font-size 的元素内边距改用 calc(var(--t)*k)，
  // 否则 em 会按它自己的字号再缩一遍。
  ".dsh-pet-todo{--t:calc(var(--f)*" + TODO_FONT_SCALE + ");display:flex;flex-direction:column;",
  "box-sizing:border-box;border-radius:inherit;overflow:hidden;color:#2b2b2b;font-size:var(--t);",
  "line-height:1.5;user-select:none;",
  "font-family:var(--dsh-pet-font-family,'ShangshouSoftCandy','Yuanti SC','YouYuan','\u5E7C\u5706','Comic Sans MS','PingFang SC','Microsoft YaHei',sans-serif);",
  "}",
  ".dsh-pet-todo *{box-sizing:border-box}",
  ".dsh-pet-todo-head{display:flex;align-items:center;gap:.615em;padding:.769em .923em .615em}",
  ".dsh-pet-todo-title{flex:1;font-size:1.077em;font-weight:600}",
  ".dsh-pet-todo-count{color:rgba(43,43,43,.55);font-size:.923em}",
  ".dsh-pet-todo-close{border:none;background:transparent;color:rgba(43,43,43,.5);font-family:inherit;",
  "font-size:1em;line-height:1;padding:.308em .385em;border-radius:.462em;cursor:pointer}",
  ".dsh-pet-todo-close:hover{background:rgba(0,0,0,.06);color:rgba(43,43,43,.9)}",
  ".dsh-pet-todo-form{display:flex;flex-direction:column;gap:.462em;padding:0 .923em .769em;",
  "border-bottom:1px solid rgba(0,0,0,.07)}",
  ".dsh-pet-todo-input{width:100%;border:1px solid rgba(0,0,0,.12);border-radius:.615em;",
  "background:rgba(255,255,255,.9);padding:.462em .615em;font-size:1em;line-height:1.4;color:#2b2b2b;",
  "font-family:inherit;outline:none}",
  ".dsh-pet-todo-input:focus{border-color:rgba(64,128,255,.55);box-shadow:0 0 0 .154em rgba(64,128,255,.14)}",
  ".dsh-pet-todo-input::placeholder{color:rgba(43,43,43,.42)}",
  ".dsh-pet-todo-row{display:flex;align-items:center;gap:.462em}",
  // 到期按钮：长得像输入框，点开是自绘日历；没选时文字偏淡，选了转深。
  ".dsh-pet-todo-due{flex:1;min-width:0;text-align:left;border:1px solid rgba(0,0,0,.12);border-radius:.615em;",
  "background:rgba(255,255,255,.9);padding:.462em .615em;font-size:1em;line-height:1.4;font-family:inherit;",
  "color:rgba(43,43,43,.55);cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
  ".dsh-pet-todo-due:hover{border-color:rgba(64,128,255,.45)}",
  ".dsh-pet-todo-due.is-set{color:#2b2b2b}",
  '.dsh-pet-todo-due[aria-expanded="true"]{border-color:rgba(64,128,255,.55);',
  "box-shadow:0 0 0 .154em rgba(64,128,255,.14)}",
  ".dsh-pet-todo-add{border:none;border-radius:.615em;background:#4a7dff;color:#fff;font-size:1em;",
  "padding:.462em .923em;cursor:pointer;font-family:inherit;white-space:nowrap}",
  ".dsh-pet-todo-add:hover{background:#3a6ce8}",
  ".dsh-pet-todo-add:disabled,.dsh-pet-todo-input:disabled{opacity:.55;cursor:default}",
  // 内嵌日历：白底淡灰衬底，选中日实心主色，非本月日期变淡，今天描一圈。
  ".dsh-pet-todo-cal{display:flex;flex-direction:column;gap:.308em;",
  "padding:.462em .615em .615em;background:rgba(43,43,43,.025)}",
  ".dsh-pet-todo-cal-head{display:flex;align-items:center;gap:.308em}",
  ".dsh-pet-todo-cal-title{flex:1;text-align:center;font-size:1.077em;font-weight:600}",
  ".dsh-pet-todo-cal-nav{border:none;background:transparent;color:rgba(43,43,43,.55);font-family:inherit;",
  "font-size:1.154em;line-height:1;padding:.154em .385em;border-radius:.462em;cursor:pointer}",
  ".dsh-pet-todo-cal-nav:hover{background:rgba(0,0,0,.07);color:#2b2b2b}",
  ".dsh-pet-todo-cal-week,.dsh-pet-todo-cal-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:.154em}",
  // 日期行高固定，日历高度因此是常量（与 TODO_PANEL_METRICS.calendar 同源），折叠时才能算得准。
  ".dsh-pet-todo-cal-grid{grid-auto-rows:1.862em}",
  // 小时 24 格、分钟 12 格都排 6 列，行数少，整体居中。
  ".dsh-pet-todo-cal-grid.is-hour,.dsh-pet-todo-cal-grid.is-minute{grid-template-columns:repeat(6,1fr);",
  "grid-auto-rows:1.6em;align-content:center}",
  ".dsh-pet-todo-cal-week{font-size:.846em;line-height:1.5;color:rgba(43,43,43,.45);text-align:center}",
  ".dsh-pet-todo-cal-cell{border:none;background:transparent;font-family:inherit;font-size:1em;line-height:1.4;",
  "color:#2b2b2b;padding:.231em 0;border-radius:.462em;cursor:pointer;font-variant-numeric:tabular-nums}",
  ".dsh-pet-todo-cal-cell:hover{background:rgba(0,0,0,.06)}",
  ".dsh-pet-todo-cal-cell.is-out{color:rgba(43,43,43,.26)}",
  ".dsh-pet-todo-cal-cell.is-today{box-shadow:inset 0 0 0 1px rgba(74,125,255,.55)}",
  ".dsh-pet-todo-cal-cell.is-sel{background:#4a7dff;color:#fff;font-weight:600}",
  ".dsh-pet-todo-cal-foot{display:flex;align-items:center;gap:.308em}",
  ".dsh-pet-todo-cal-act{border:none;background:transparent;color:#4a7dff;font-family:inherit;font-size:.923em;",
  "line-height:1.5;padding:.231em .385em;border-radius:.462em;cursor:pointer}",
  ".dsh-pet-todo-cal-act:hover{background:rgba(74,125,255,.1)}",
  ".dsh-pet-todo-cal-grow{flex:1}",
  // 时/分标签：点开就是对应的数字网格，再点一次退回日期。
  ".dsh-pet-todo-cal-chip{border:1px solid rgba(0,0,0,.12);border-radius:.462em;background:rgba(255,255,255,.95);",
  "color:#2b2b2b;font-family:inherit;font-size:.923em;line-height:1.4;padding:.154em .385em;cursor:pointer;",
  "font-variant-numeric:tabular-nums}",
  ".dsh-pet-todo-cal-chip.is-on{border-color:rgba(74,125,255,.55);color:#4a7dff;",
  "box-shadow:0 0 0 .154em rgba(74,125,255,.14)}",
  ".dsh-pet-todo-cal-colon{color:rgba(43,43,43,.45)}",
  // 下半区：两块内容各占一个折叠区，谁出现谁展开，面板高度跟着内容走，不留空白。
  // 折叠用 grid-template-rows 的 0fr→1fr：内容高度是 auto 也能过渡，不用猜 max-height。
  ".dsh-pet-todo-lower{display:flex;flex-direction:column}",
  ".dsh-pet-todo-fold{display:grid;grid-template-rows:0fr;visibility:hidden;",
  "transition:grid-template-rows .18s ease,visibility 0s .18s}",
  ".dsh-pet-todo-fold>.dsh-pet-todo-foldClip{overflow:hidden;min-height:0}",
  ".dsh-pet-todo-fold.is-list{grid-template-rows:1fr;visibility:visible;transition-delay:0s}",
  ".dsh-pet-todo.is-picking .dsh-pet-todo-fold.is-cal{grid-template-rows:1fr;visibility:visible;",
  "transition-delay:0s}",
  // 收起的那一侧等过渡走完再隐藏，否则内容会在半路上突然消失；visibility 同时挡掉键盘焦点。
  ".dsh-pet-todo.is-picking .dsh-pet-todo-fold.is-list{grid-template-rows:0fr;visibility:hidden;",
  "transition-delay:0s,.18s}",
  // 清单高度由 capListHeight 按两行写在行内；这里只保证超出就滚动、滚动不带动气泡外的东西。
  ".dsh-pet-todo-list{list-style:none;margin:0;padding:.462em;overflow-y:auto;overscroll-behavior:contain;",
  "flex:0 1 auto;min-height:0;scrollbar-width:thin}",
  ".dsh-pet-todo-item{display:flex;align-items:flex-start;gap:.615em;padding:.538em .462em;border-radius:.615em}",
  ".dsh-pet-todo-item:hover{background:rgba(0,0,0,.045)}",
  ".dsh-pet-todo-check{margin-top:.231em;width:1.154em;height:1.154em;flex:0 0 auto;cursor:pointer;",
  "accent-color:#4a7dff}",
  ".dsh-pet-todo-main{flex:1;min-width:0}",
  ".dsh-pet-todo-text{overflow-wrap:anywhere;white-space:pre-wrap}",
  ".dsh-pet-todo-meta{margin-top:calc(var(--t)*0.154);font-size:.846em;color:rgba(43,43,43,.5)}",
  '.dsh-pet-todo-item[data-urgency="overdue"] .dsh-pet-todo-meta{color:#d94f3d}',
  '.dsh-pet-todo-item[data-urgency="soon"] .dsh-pet-todo-meta{color:#c9761b}',
  '.dsh-pet-todo-item[data-urgency="today"] .dsh-pet-todo-meta{color:#3f6fd8}',
  ".dsh-pet-todo-item.is-done .dsh-pet-todo-text{text-decoration:line-through;color:#2e9e4f}",
  ".dsh-pet-todo-del{border:none;background:transparent;color:rgba(43,43,43,.34);font-size:.923em;line-height:1;",
  "padding:calc(var(--t)*0.308) calc(var(--t)*0.385);border-radius:.462em;cursor:pointer;flex:0 0 auto;",
  "min-width:calc(var(--t)*1.692)}",
  ".dsh-pet-todo-del:hover{background:rgba(0,0,0,.07);color:rgba(43,43,43,.8)}",
  ".dsh-pet-todo-del.is-armed{background:rgba(217,79,61,.12);color:#d94f3d}",
  ".dsh-pet-todo-empty{padding:calc(var(--t)*1.538) calc(var(--t)*0.923);text-align:center;",
  "color:rgba(43,43,43,.44);font-size:.923em}",
  ".dsh-pet-todo-empty[hidden]{display:none}",
  ".dsh-pet-todo-err{flex:0 0 auto;padding:0 calc(var(--t)*0.923) calc(var(--t)*0.615);color:#d94f3d;",
  "font-size:.923em;white-space:pre-wrap;overflow-wrap:anywhere}",
  ".dsh-pet-todo-err[hidden]{display:none}",
  // margin-top:auto 把提示钉在下半区底部：清单只有两行时，多出来的空当留在中间而不是堆在提示下面。
  ".dsh-pet-todo-hint{margin-top:auto;padding:calc(var(--t)*0.462) calc(var(--t)*0.923) calc(var(--t)*0.692);",
  "color:rgba(43,43,43,.4);font-size:.846em;text-align:center}"
].join("");
var todoCssInjected = false;
function injectTodoCss() {
  if (todoCssInjected || typeof document === "undefined") return;
  todoCssInjected = true;
  const tag = document.createElement("style");
  tag.dataset.plugin = "dsh-pet";
  tag.dataset.pluginCss = "dsh-pet/todo";
  tag.textContent = TODO_CSS;
  document.head.appendChild(tag);
}

// vendor/dsh-pet/src/shared/todo/panel.ts
function createTodoPanel(options = {}) {
  injectTodoCss();
  const parts = createTodoPanelParts();
  const baseUrl = options.baseUrl ?? TODOS_PATH;
  let disposed = false;
  let busy = false;
  let todos = [];
  const handlers = {
    onToggle: (todo, done) => void mutate(() => patchTodo(todo.id, { done }, baseUrl)),
    onDelete: (todo) => void mutate(() => removeTodo(todo.id, baseUrl))
  };
  async function reload() {
    const result = await loadTodos(baseUrl);
    if (disposed) return;
    if (!result.ok) {
      setTodoError(parts, result.message);
      parts.empty.textContent = "\u6E05\u5355\u52A0\u8F7D\u5931\u8D25\uFF0C\u5173\u6389\u9762\u677F\u518D\u5F00\u4E00\u6B21\u8BD5\u8BD5";
      parts.empty.hidden = false;
      return;
    }
    todos = result.value;
    setTodoError(parts, null);
    renderTodoList(parts, todos, handlers, Date.now());
  }
  async function mutate(task) {
    if (disposed || busy) return;
    busy = true;
    setTodoBusy(parts, true);
    setTodoError(parts, null);
    const result = await task();
    busy = false;
    if (disposed) return;
    setTodoBusy(parts, false);
    if (!result.ok) {
      setTodoError(parts, result.message);
      return;
    }
    await reload();
  }
  const submitAdd = () => {
    const text = parts.input.value.trim();
    if (text === "") {
      parts.input.focus();
      return;
    }
    const dueText = parts.duePicker.value();
    const dueAt = dueText === "" ? null : parseDateTimeLocal(dueText);
    parts.duePicker.close();
    if (dueAt !== null && dueAt < Date.now()) {
      setTodoError(parts, "\u8FD9\u4E2A\u65F6\u95F4\u5DF2\u7ECF\u8FC7\u53BB\u4E86\uFF0C\u6362\u4E00\u4E2A\u5427");
      return;
    }
    void mutate(async () => {
      const result = await addTodo(text, dueAt, baseUrl);
      if (result.ok) {
        parts.input.value = "";
        parts.duePicker.reset();
      }
      return result;
    });
  };
  parts.form.addEventListener("submit", (event) => {
    event.preventDefault();
    submitAdd();
  });
  const onDocMouseDown = (event) => {
    if (disposed) return;
    const target = event.target;
    if (target !== null && parts.root.contains(target)) return;
    if (options.keepOpenOn?.(event.target) === true) return;
    options.onClose?.();
  };
  document.addEventListener("mousedown", onDocMouseDown, true);
  parts.closeButton.addEventListener("click", () => options.onClose?.());
  parts.empty.textContent = "\u52A0\u8F7D\u4E2D\u2026";
  parts.empty.hidden = false;
  void reload();
  return {
    el: parts.root,
    dispose: () => {
      if (disposed) return;
      disposed = true;
      document.removeEventListener("mousedown", onDocMouseDown, true);
      parts.duePicker.dispose();
      parts.root.remove();
    }
  };
}

// vendor/dsh-pet/src/client/todo-bubble.ts
function makeTodoBubble(rt) {
  const { h, useRef, useEffect } = rt;
  return function TodoBubble({ on, onClose }) {
    const hostRef = useRef(null);
    const closeRef = useRef(onClose);
    closeRef.current = onClose;
    useEffect(() => {
      const host = hostRef.current;
      if (host === null) return;
      const panel = createTodoPanel({
        onClose: () => closeRef.current(),
        // 点宠物本体不收起：拖它走是常见需求，收起就没法一边看清单一边挪位置。
        keepOpenOn: (target) => target instanceof Element && target.closest(".dsh-pet-hit") !== null
      });
      host.appendChild(panel.el);
      return () => panel.dispose();
    }, []);
    return h("div", {
      ref: hostRef,
      className: "dsh-pet-bubble dsh-pet-todo-bubble" + (on ? " is-on" : "")
    });
  };
}

// vendor/dsh-pet/src/shared/avatar.ts
var LOGO_URL = ROUTE_PATH + "/logo";
function avatarUrl(assetRoot, version) {
  const root = assetRoot.trim();
  const query = root === "" ? "" : "root=" + encodeURIComponent(root) + "&";
  return ROUTE_PATH + "/logo?" + query + "v=" + version;
}

// vendor/dsh-pet/src/shared/notify.ts
var NOTIFY_ICONS = {
  done: "notify-done",
  error: "notify-error",
  truncated: "notify-truncated",
  approval: "notify-approval",
  question: "notify-question",
  test: "notify-test"
};
var MAX_BODY = 80;
var MAX_SESSION_NAME = 30;
function truncate(text) {
  return text.length > MAX_BODY ? text.slice(0, MAX_BODY) + "\u2026" : text;
}
function sessionNameOf(sessionTitle) {
  const name = sessionTitle?.trim();
  if (!name) return void 0;
  return name.length > MAX_SESSION_NAME ? name.slice(0, MAX_SESSION_NAME) + "\u2026" : name;
}
function composeTitle(sessionTitle, label) {
  const name = sessionNameOf(sessionTitle);
  return name ? name + " \xB7 " + label : label;
}
function frameToToast(frame, sessionTitle) {
  switch (frame.type) {
    case "session/event": {
      const ev = frame.event ?? {};
      if (ev.type !== "turn/end") return null;
      const kind = ev.data?.reason?.kind;
      if (kind === "completed") {
        const text = typeof ev.data?.text === "string" ? ev.data.text.trim() : "";
        return {
          title: sessionNameOf(sessionTitle) ?? "\u5BF9\u8BDD\u5B8C\u6210",
          body: text ? truncate(text) : "",
          icon: NOTIFY_ICONS.done
        };
      }
      if (kind === "error")
        return {
          title: composeTitle(sessionTitle, "\u751F\u6210\u5931\u8D25"),
          body: ev.data?.reason?.error?.message ?? "",
          icon: NOTIFY_ICONS.error
        };
      if (kind === "max-tokens")
        return {
          title: composeTitle(sessionTitle, "\u8F93\u51FA\u88AB\u622A\u65AD"),
          body: "\u5DF2\u8FBE\u5230\u8F93\u51FA token \u4E0A\u9650",
          icon: NOTIFY_ICONS.truncated
        };
      return null;
    }
    case "approval/requested": {
      const toolName = typeof frame.toolName === "string" ? frame.toolName : "";
      const reason = typeof frame.reason === "string" && frame.reason ? frame.reason : "";
      return {
        title: composeTitle(sessionTitle, "\u6B63\u5728\u7533\u8BF7\u6743\u9650"),
        body: (toolName ? "\u5DE5\u5177\u300C" + toolName + "\u300D" : "") + (reason ? "\uFF1A" + reason : ""),
        icon: NOTIFY_ICONS.approval
      };
    }
    case "question/requested": {
      const q = Array.isArray(frame.questions) && frame.questions[0]?.question || "";
      return { title: composeTitle(sessionTitle, "\u6A21\u578B\u5728\u7B49\u4F60\u56DE\u7B54"), body: q, icon: NOTIFY_ICONS.question };
    }
    case "host/agent-error": {
      return {
        title: "\u751F\u6210\u5931\u8D25",
        body: typeof frame.message === "string" ? frame.message : "",
        icon: NOTIFY_ICONS.error
      };
    }
    default:
      return null;
  }
}

// vendor/dsh-pet/src/client/notify.ts
var pageVisible = typeof document !== "undefined" && !document.hidden;
var pageFocused = typeof document !== "undefined" && document.hasFocus();
function isPageActive() {
  return pageVisible && pageFocused;
}
var PIC = (name) => `${ROUTE_PATH}/pic/${name}.png`;
var NOTIFY_ICONS2 = {
  done: PIC(NOTIFY_ICONS.done),
  error: PIC(NOTIFY_ICONS.error),
  truncated: PIC(NOTIFY_ICONS.truncated),
  approval: PIC(NOTIFY_ICONS.approval),
  question: PIC(NOTIFY_ICONS.question),
  test: PIC(NOTIFY_ICONS.test)
};
var notifyEnabled = true;
var sessionNavigator;
function sessionTitleFrom(navigator2, sessionId) {
  if (sessionId === void 0) return void 0;
  try {
    return navigator2?.sessionTitle?.(sessionId);
  } catch {
    return void 0;
  }
}
function jumpToSession(sessionId) {
  if (sessionId !== void 0) {
    try {
      sessionNavigator?.openSession(sessionId);
    } catch {
    }
  }
  window.focus();
  if (!/electron/i.test(navigator.userAgent)) return;
  const frame = document.createElement("iframe");
  frame.style.display = "none";
  frame.src = "dsh://open";
  document.body.append(frame);
  setTimeout(() => frame.remove(), 1e3);
}
function wireNotificationClick(n, sessionId) {
  n.onclick = () => {
    n.close();
    jumpToSession(sessionId);
  };
}
function toast(title, body, icon, sessionId) {
  if (!notifyEnabled) return;
  if (isPageActive()) return;
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
  console.log("[dsh-pet] \u3010\u5F39\u7A97\u3011" + title + (body ? "\uFF1A" + body : ""));
  try {
    const opts = {};
    if (body) opts.body = truncate(body);
    if (icon) opts.icon = icon;
    const n = new Notification(title, opts);
    wireNotificationClick(n, sessionId);
  } catch {
  }
}
function toastFrame(frame) {
  const sessionId = typeof frame.sessionId === "string" ? frame.sessionId : void 0;
  const t = frameToToast(frame, sessionTitleFrom(sessionNavigator, sessionId));
  if (!t) return;
  toast(t.title, t.body, PIC(t.icon), sessionId);
}
async function requestNotificationPermission() {
  if (typeof Notification === "undefined") return { ok: false, reason: "unsupported" };
  if (Notification.permission === "granted") return { ok: true };
  if (Notification.permission === "denied") return { ok: false, reason: "denied" };
  try {
    const p = await Notification.requestPermission();
    if (p === "granted") return { ok: true };
    if (p === "denied") return { ok: false, reason: "rejected" };
    return { ok: false, reason: "error", message: "\u6743\u9650\u672A\u6388\u4E88\uFF08" + p + "\uFF09" };
  } catch (e) {
    return { ok: false, reason: "error", message: e instanceof Error ? e.message : String(e) };
  }
}
async function readNotificationsEnabled() {
  try {
    const r = await fetch(ROUTE_PATH + "/config");
    if (!r.ok) return true;
    const d = await r.json().catch(() => null);
    return typeof d?.main?.notificationsEnabled === "boolean" ? d.main.notificationsEnabled : true;
  } catch {
    return true;
  }
}
async function reloadNotifications() {
  notifyEnabled = await readNotificationsEnabled();
}
function notifyFromFrame(frame) {
  toastFrame(frame);
}

// vendor/dsh-pet/src/client/settings/css.ts
var SETTINGS_CSS = [
  ".dsh-pet-mp{position:relative;min-width:0;display:flex;flex-direction:column;gap:4px}",
  ".dsh-pet-mp__trigger{display:flex;align-items:center;gap:6px;width:100%;max-width:340px;height:28px;padding:0 8px;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font-size:13px;line-height:20px;text-align:left;cursor:pointer;outline:none}",
  ".dsh-pet-mp__trigger:hover:not(:disabled){border-color:var(--dsw-alias-state-business-primary)}",
  ".dsh-pet-mp__trigger:focus-visible{border-color:var(--dsw-alias-state-business-primary);box-shadow:0 0 0 2px var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary))}",
  ".dsh-pet-mp__trigger:disabled{color:var(--dsw-alias-label-dimmed);cursor:default}",
  ".dsh-pet-mp__label{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}",
  ".dsh-pet-mp__sub{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0;flex-shrink:1000;color:var(--dsw-alias-label-caption,var(--dsw-alias-label-tertiary))}",
  ".dsh-pet-mp__chevron{flex:none;margin-left:auto;color:var(--dsw-alias-label-caption,var(--dsw-alias-label-tertiary));transition:transform .12s}",
  ".dsh-pet-mp__chevron.is-open{transform:rotate(180deg)}",
  // 浮层用 fixed 脱离设置页的滚动容器（不被 overflow 裁掉）；z-index 与插件右键菜单同一档。
  ".dsh-pet-mp__panel{position:fixed;z-index:2147483000;display:flex;flex-direction:column;gap:4px;padding:4px;overflow:hidden;border:1px solid var(--dsw-alias-border-l1);border-radius:var(--dsw-radius-md,10px);background:var(--dsw-alias-bg-layer-1);box-shadow:var(--dsw-elevation-prominent,0 8px 30px rgba(0,0,0,.35));color:var(--dsw-alias-label-primary)}",
  ".dsh-pet-mp__search{box-sizing:border-box;width:100%;height:28px;padding:0 8px;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font-size:13px;outline:none}",
  ".dsh-pet-mp__search:focus{border-color:var(--dsw-alias-state-business-primary)}",
  // overflow-x 必须显式 hidden：只设 overflow-y 时 CSS 会把另一轴的 visible 抬成 auto，
  // 而条目是 width:100% + 左右 padding，横向会多出 16px，于是冒出没用的横向滚动条。
  ".dsh-pet-mp__list{display:flex;flex-direction:column;min-height:0;overflow-x:hidden;overflow-y:auto;scrollbar-width:thin}",
  ".dsh-pet-mp__group{padding:6px 8px 2px;font-size:11px;line-height:16px;color:var(--dsw-alias-label-tertiary)}",
  ".dsh-pet-mp__item{display:flex;align-items:center;gap:8px;width:100%;padding:6px 8px;border:none;border-radius:var(--dsw-radius-sm,6px);background:transparent;color:inherit;font-size:13px;line-height:20px;text-align:left;cursor:pointer}",
  ".dsh-pet-mp__item:hover:not(:disabled),.dsh-pet-mp__item.is-active{background:var(--dsw-alias-interactive-bg-hover)}",
  '.dsh-pet-mp__item[aria-checked="true"]{color:var(--dsw-alias-state-business-primary)}',
  ".dsh-pet-mp__item:disabled{color:var(--dsw-alias-label-dimmed);cursor:default}",
  ".dsh-pet-mp__name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}",
  ".dsh-pet-mp__check{flex:none;margin-left:auto}",
  ".dsh-pet-mp__status{padding:8px;font-size:12px;line-height:18px;color:var(--dsw-alias-label-tertiary)}",
  // 通用单选下拉：触发器叠加在 __inp 之上，只补按钮该有而输入框没有的排布；浮层与上面的模型选择器同一套外观。
  ".dsh-pet-sel{position:relative;min-width:0}",
  ".dsh-pet-sel__trigger{display:flex;align-items:center;gap:6px;text-align:left;cursor:pointer}",
  ".dsh-pet-sel__trigger:disabled{cursor:default}",
  ".dsh-pet-sel__label{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}",
  // 箭头用小三角而不是字符：不依赖字体，旋转时的基线与折叠卡一致。
  ".dsh-pet-sel__chevron{flex:none;margin-left:auto;width:0;height:0;border-left:4px solid transparent;border-right:4px solid transparent;border-top:5px solid currentColor;color:var(--dsw-alias-label-tertiary);transition:transform .12s}",
  ".dsh-pet-sel__chevron.is-open{transform:rotate(180deg)}",
  ".dsh-pet-sel__panel{position:fixed;z-index:2147483000;display:flex;flex-direction:column;gap:2px;padding:4px;overflow:hidden;border:1px solid var(--dsw-alias-border-l1);border-radius:var(--dsw-radius-md,10px);background:var(--dsw-alias-bg-layer-1);box-shadow:var(--dsw-elevation-prominent,0 8px 30px rgba(0,0,0,.35));color:var(--dsw-alias-label-primary)}",
  ".dsh-pet-sel__list{display:flex;flex-direction:column;min-height:0;overflow-x:hidden;overflow-y:auto;scrollbar-width:thin}",
  ".dsh-pet-sel__item{display:flex;align-items:center;gap:8px;width:100%;padding:5px 8px;border:none;border-radius:var(--dsw-radius-sm,6px);background:transparent;color:inherit;font:inherit;font-size:13px;line-height:20px;text-align:left;cursor:pointer}",
  ".dsh-pet-sel__item:hover:not(:disabled),.dsh-pet-sel__item.is-active{background:var(--dsw-alias-interactive-bg-hover)}",
  '.dsh-pet-sel__item[aria-selected="true"]{color:var(--dsw-alias-state-business-primary)}',
  ".dsh-pet-sel__item:disabled{color:var(--dsw-alias-label-dimmed);cursor:default}",
  ".dsh-pet-sel__name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}",
  ".dsh-pet-sel__check{flex:none;margin-left:auto}",
  ".dsh-pet-cfg{container-type:inline-size;display:flex;flex-direction:column;gap:12px;color:var(--dsw-alias-label-primary);font-size:13px;line-height:20px}",
  ".dsh-pet-cfg__title{display:flex;align-items:center;gap:6px;margin:0;font-size:16px;font-weight:500;line-height:24px}",
  ".dsh-pet-cfg__card{display:flex;flex-direction:column;gap:10px;padding:12px 14px;border:1px solid var(--dsw-alias-border-l2);border-radius:12px}",
  ".dsh-pet-cfg__cardHead{display:flex;align-items:center;gap:6px;min-height:20px}",
  ".dsh-pet-cfg__cardTitle{font-size:13px;font-weight:500;color:var(--dsw-alias-label-primary)}",
  // 折叠卡（高级配置 / 卸载与存储）：标题行常驻，正文收进裁剪层。
  // 卡片自身的 gap 归零，头与正文的间距改由正文内层的 padding-top 提供——收起时随裁剪一起消失，底部不留空缝。
  ".dsh-pet-cfg__card.is-fold{gap:0}",
  ".dsh-pet-cfg__foldToggle{display:flex;align-items:center;gap:6px;flex:1 1 auto;min-width:0;min-height:20px;padding:0;border:none;border-radius:4px;background:transparent;color:inherit;font:inherit;text-align:left;cursor:pointer;outline:none}",
  ".dsh-pet-cfg__foldToggle:focus-visible{box-shadow:0 0 0 2px var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary))}",
  // 箭头用小三角而不是字符：不依赖字体、缩进也不受行高影响。
  ".dsh-pet-cfg__chevron{flex:none;margin-left:auto;width:0;height:0;border-left:4px solid transparent;border-right:4px solid transparent;border-top:5px solid currentColor;color:var(--dsw-alias-label-tertiary);transition:transform .12s}",
  ".dsh-pet-cfg__chevron.is-open{transform:rotate(180deg)}",
  ".dsh-pet-cfg__fold{display:grid;grid-template-rows:0fr;transition:grid-template-rows .12s ease}",
  ".dsh-pet-cfg__card.is-open .dsh-pet-cfg__fold{grid-template-rows:1fr}",
  ".dsh-pet-cfg__foldClip{min-height:0;overflow:hidden}",
  ".dsh-pet-cfg__foldBody{display:flex;flex-direction:column;gap:10px;padding-top:10px}",
  ".dsh-pet-cfg__grid3{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px 16px;align-items:end}",
  ".dsh-pet-cfg__grid4{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px 16px;align-items:end}",
  ".dsh-pet-cfg__grid2{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px 16px;align-items:end}",
  "@container (max-width:600px){.dsh-pet-cfg__grid4{grid-template-columns:repeat(2,minmax(0,1fr))}}",
  "@container (max-width:400px){.dsh-pet-cfg__grid2,.dsh-pet-cfg__grid3,.dsh-pet-cfg__grid4{grid-template-columns:minmax(0,1fr)}}",
  ".dsh-pet-cfg__field{display:flex;flex-direction:column;gap:4px;min-width:0}",
  ".dsh-pet-cfg__flabel{display:inline-flex;align-items:center;gap:5px;font-size:12px;color:var(--dsw-alias-label-secondary)}",
  // 顶部一行：头像作左列，右侧是 2×2 的输入网格；窄容器降成单列，头像回到输入之上。
  ".dsh-pet-cfg__topRow{display:grid;grid-template-columns:auto minmax(0,1fr);gap:14px 18px;align-items:stretch;margin-bottom:10px}",
  // 头像：宽度固定，高度**撑满右侧两行**——否则头像下方会空出一大块（右列比 72px 高得多）。
  // 能换的时候整块就是按钮：悬浮出遮罩、点它直接开文件框，没有独立按钮。
  ".dsh-pet-cfg__avatarCol{position:relative;width:120px;flex:none}",
  ".dsh-pet-cfg__avatarImg{display:block;width:100%;height:100%;min-height:72px;border-radius:14px;border:1px solid var(--dsw-alias-border-l2);object-fit:cover;background:var(--dsw-alias-bg-layer-1)}",
  ".dsh-pet-cfg__avatarPick{position:relative;display:block;height:100%;border-radius:14px}",
  // 键盘可达：input 铺满整块且透明（display:none 会让它不可聚焦）；焦点与悬浮一样出遮罩。
  ".dsh-pet-cfg__avatarPick:focus-within{outline:2px solid var(--dsw-alias-state-business-primary);outline-offset:2px}",
  // 遮罩用 token，缺 token 时回退到半透明黑：与本文件其它「token + fallback」写法一致，
  // 不在规则里直接写字面色值。文字色同理用静态白 token。
  ".dsh-pet-cfg__avatarMask{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;border-radius:14px;background:var(--dsw-alias-bg-mask,rgba(0,0,0,.55));color:var(--dsw-static-neutral-00,#fff);font-size:12px;line-height:1;opacity:0;transition:opacity .12s;pointer-events:none}",
  ".dsh-pet-cfg__avatarPick:hover .dsh-pet-cfg__avatarMask,.dsh-pet-cfg__avatarPick:focus-within .dsh-pet-cfg__avatarMask,.dsh-pet-cfg__avatarMask.is-busy{opacity:1}",
  ".dsh-pet-cfg__file{position:absolute;inset:0;width:100%;height:100%;opacity:0;cursor:pointer;font-size:0}",
  // 竖排时没有「右侧两行」可撑：头像回到 72px 的方块，否则会被拉成整宽的大图。
  "@container (max-width:400px){.dsh-pet-cfg__topRow{grid-template-columns:minmax(0,1fr)}.dsh-pet-cfg__avatarCol{width:72px}.dsh-pet-cfg__avatarImg{height:72px;min-height:0}}",
  ".dsh-pet-cfg__inp{box-sizing:border-box;width:100%;min-height:28px;padding:4px 10px;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font:inherit;font-size:13px;outline:none}",
  ".dsh-pet-cfg__inp:focus{border-color:var(--dsw-alias-state-business-primary)}",
  ".dsh-pet-cfg__inp:disabled{color:var(--dsw-alias-label-tertiary);cursor:default}",
  // 人设复用 __inp 的边框与字号，只补高度与纵向缩放；人设没有长度上限，右下角只显示字数、不阻断输入。
  ".dsh-pet-cfg__persona{display:flex;flex-direction:column;gap:2px;min-width:0}",
  ".dsh-pet-cfg__area{min-height:66px;resize:vertical;line-height:18px}",
  ".dsh-pet-cfg__count{font-size:11px;color:var(--dsw-alias-label-tertiary);text-align:right}",
  ".dsh-pet-cfg__toggle{display:flex;align-items:center;gap:6px;min-width:0;font-size:13px;color:var(--dsw-alias-label-primary)}",
  ".dsh-pet-cfg__toggle>label{display:inline-flex;align-items:center;gap:6px;cursor:pointer;min-width:0}",
  ".dsh-pet-cfg__toggle>label>span{overflow-wrap:anywhere}",
  ".dsh-pet-cfg__toggle input[type=checkbox]{flex:none;width:16px;height:16px;margin:0;accent-color:var(--dsw-alias-state-business-primary);cursor:pointer}",
  // 悬浮说明气泡：由 ./tip-layer 按光标挂到 body 上，不画在触发元素里——右列与贴顶的说明
  // 会被窗口边缘或滚动容器裁掉。这里只管外观，坐标由 tooltipPlacement 写进 style。
  ".pet-cfg-tip{position:fixed;left:0;top:0;z-index:2147483000;max-width:320px;padding:6px 10px;border-radius:8px;background:var(--dsw-alias-tooltip-bg);color:var(--dsw-static-neutral-00);font-size:12px;font-style:normal;font-weight:400;line-height:18px;text-align:left;white-space:pre-wrap;overflow-wrap:anywhere;pointer-events:none;opacity:0;transition:opacity .12s ease;box-shadow:var(--dsw-elevation-prominent,0 6px 20px rgba(0,0,0,.22))}",
  ".pet-cfg-tip.is-on{opacity:1}",
  // 问号：气泡的一个圆形宿主外观。
  ".dsh-pet-cfg__q{display:inline-flex;align-items:center;justify-content:center;flex:none;width:14px;height:14px;border:1px solid var(--dsw-alias-label-tertiary);border-radius:50%;color:var(--dsw-alias-label-tertiary);font-size:10px;font-style:normal;line-height:1;cursor:help;user-select:none}",
  // 折叠卡把问号放进了标题按钮里：包一层 span 以便单独拦截点击（点问号只出气泡、不开合）。
  ".dsh-pet-cfg__qWrap{display:inline-flex;flex:none;align-items:center}",
  ".dsh-pet-cfg__btn{border:1px solid var(--dsw-alias-border-l2);background:transparent;color:var(--dsw-alias-label-primary);border-radius:8px;padding:4px 14px;font:inherit;font-size:12px;line-height:20px;cursor:pointer;white-space:nowrap}",
  // 实心主按钮必须排除在通用 hover 外：半透明 hover 会顶掉 button-info-fill，让蓝色按钮一悬停就发白；
  // 主按钮的 hover 走主题自己的 button-info-hover。
  ".dsh-pet-cfg__btn:hover:not(:disabled):not(.is-primary){background:var(--dsw-alias-interactive-bg-hover)}",
  ".dsh-pet-cfg__btn:disabled{opacity:.5;cursor:default}",
  ".dsh-pet-cfg__btn.is-primary{border-color:var(--dsw-alias-button-info-fill);background:var(--dsw-alias-button-info-fill);color:#fff}",
  ".dsh-pet-cfg__btn.is-primary:hover:not(:disabled){border-color:var(--dsw-alias-button-info-hover);background:var(--dsw-alias-button-info-hover)}",
  ".dsh-pet-cfg__btn.is-danger{border-color:var(--dsw-alias-state-error-secondary);color:var(--dsw-alias-state-error-primary)}",
  ".dsh-pet-cfg__btn.is-sm{padding:2px 10px}",
  ".dsh-pet-cfg__btn.is-ghost{border-style:dashed;color:var(--dsw-alias-label-secondary)}",
  ".dsh-pet-cfg__tabs{display:flex;gap:8px;flex-wrap:wrap;align-items:center}",
  ".dsh-pet-cfg__tabsLabel{font-size:12px;color:var(--dsw-alias-label-secondary)}",
  // 种类条单独一行：与下面的宠物条隔开，避免两组按钮读成一行。
  ".dsh-pet-cfg__kinds{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:10px}",
  ".dsh-pet-cfg__tab{border:1px solid var(--dsw-alias-border-l2);background:transparent;color:var(--dsw-alias-label-primary);border-radius:8px;padding:4px 12px;font:inherit;font-size:13px;cursor:pointer}",
  ".dsh-pet-cfg__tab:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}",
  ".dsh-pet-cfg__tab:disabled{opacity:.5;cursor:default}",
  ".dsh-pet-cfg__tab.is-active{border-color:var(--dsw-alias-state-business-primary);background:var(--dsw-alias-interactive-bg-active)}",
  ".dsh-pet-cfg__tab.is-ghost{border-style:dashed;color:var(--dsw-alias-label-secondary)}",
  ".dsh-pet-cfg__actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:4px}",
  ".dsh-pet-cfg__msg{margin-left:4px;font-size:12px;color:var(--dsw-alias-state-success-primary)}",
  ".dsh-pet-cfg__msg.is-err{color:var(--dsw-alias-state-error-primary)}",
  ".dsh-pet-cfg__note{margin:0;font-size:12px;line-height:18px;color:var(--dsw-alias-label-tertiary)}",
  ".dsh-pet-cfg__path{font-size:12px;line-height:18px;word-break:break-all;user-select:text;color:var(--dsw-alias-label-secondary)}",
  ".dsh-pet-cfg__path b{color:var(--dsw-alias-label-primary);font-weight:400}",
  '.dsh-pet-cfg__cmd{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,"Courier New",monospace;font-size:12px;line-height:18px;word-break:break-all;user-select:text;padding:6px 10px;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-alias-interactive-bg-active);color:var(--dsw-alias-label-primary)}'
].join("\n");
var settingsCssTag = "dsh-pet/settings.css";
function injectSettingsCss() {
  if (typeof document === "undefined") return;
  if (document.querySelector('style[data-plugin-css="' + settingsCssTag + '"]') !== null) return;
  const tag = document.createElement("style");
  tag.dataset.plugin = "dsh-pet";
  tag.dataset.pluginCss = settingsCssTag;
  tag.textContent = SETTINGS_CSS;
  document.head.appendChild(tag);
}

// vendor/dsh-pet/src/client/settings/ui.ts
var INPUT_CLASS = "dsh-pet-cfg__inp";
function numberInputProps(value, onCommit, extra = {}) {
  return {
    ...extra,
    type: "number",
    className: INPUT_CLASS,
    defaultValue: String(value),
    key: String(value),
    onBlur: (e) => {
      const text = e.target.value.trim();
      const parsed = Number(text);
      const next = text !== "" && Number.isFinite(parsed) ? parsed : value;
      e.target.value = String(next);
      if (next !== value) onCommit(next);
    },
    onKeyDown: (e) => {
      if (e.key === "Enter") e.currentTarget.blur();
    }
  };
}
var MONO_STACK = 'ui-monospace, SFMono-Regular, Menlo, Consolas, "Courier New", monospace';
function makeUiKit(rt) {
  const { h, t } = rt;
  const tip = (text) => ({ "data-tip": text });
  const q = (text) => h("i", { className: "dsh-pet-cfg__q", ...tip(text), "aria-label": text, role: "img", children: "?" });
  return {
    tip,
    q,
    cardHead: (title, hint) => h("div", {
      className: "dsh-pet-cfg__cardHead",
      children: [
        h("span", { key: "t", className: "dsh-pet-cfg__cardTitle", children: title }),
        hint ? q(hint) : null
      ]
    }),
    field: (label, control, hint) => h("div", {
      className: "dsh-pet-cfg__field",
      children: [
        h("span", {
          key: "l",
          className: "dsh-pet-cfg__flabel",
          children: hint ? [label, q(hint)] : label
        }),
        control
      ]
    }),
    toggleCell: (label, value, disabled, onToggle) => h("div", {
      className: "dsh-pet-cfg__toggle",
      children: [
        h("label", {
          key: "l",
          children: [
            h("input", {
              key: "i",
              type: "checkbox",
              checked: value,
              disabled,
              onChange: (e) => onToggle(e.target.checked)
            }),
            h("span", { key: "t", children: t(label) })
          ]
        }),
        q(t(label + "Hint"))
      ]
    }),
    foldCard: (options) => h("div", {
      className: "dsh-pet-cfg__card is-fold" + (options.open ? " is-open" : ""),
      children: [
        // 整行可点：标题、问号与箭头都在按钮里。问号自己拦掉冒泡，点它只出气泡、不开合。
        h("button", {
          key: "head",
          type: "button",
          className: "dsh-pet-cfg__foldToggle",
          "aria-expanded": options.open,
          "aria-controls": options.id,
          onClick: options.onToggle,
          children: [
            h("span", { key: "t", className: "dsh-pet-cfg__cardTitle", children: options.title }),
            h("span", {
              key: "q",
              className: "dsh-pet-cfg__qWrap",
              onClick: (e) => e.stopPropagation(),
              children: q(options.hint)
            }),
            // 箭头：展开时转 180°，与模型选择器的展开指示一致。
            h("i", {
              key: "c",
              className: "dsh-pet-cfg__chevron" + (options.open ? " is-open" : ""),
              "aria-hidden": "true"
            })
          ]
        }),
        // 裁剪层承担 overflow，正文内层出高度：收起时 0fr 把 padding 一起裁掉，卡片底不留空缝。
        h("div", {
          key: "body",
          id: options.id,
          className: "dsh-pet-cfg__fold",
          "aria-hidden": options.open ? void 0 : "true",
          children: h("div", {
            className: "dsh-pet-cfg__foldClip",
            children: h("div", { className: "dsh-pet-cfg__foldBody", children: options.body })
          })
        })
      ]
    })
  };
}

// vendor/dsh-pet/src/client/settings/actions.ts
function makeActions(rt) {
  const { h, t } = rt;
  const { tip, q } = makeUiKit({ h, t });
  return function Actions(props) {
    const { busy, msg, permMsg } = props;
    return h("div", {
      className: "dsh-pet-cfg__actions",
      children: [
        h("button", {
          type: "button",
          disabled: busy,
          onClick: props.onSave,
          className: "dsh-pet-cfg__btn is-primary",
          // 悬浮按钮即出快捷键气泡。
          ...tip(t("saveHotkey")),
          children: t("save")
        }),
        h("button", {
          type: "button",
          disabled: busy,
          onClick: props.onSync,
          className: "dsh-pet-cfg__btn",
          children: t("sync")
        }),
        h("button", {
          type: "button",
          onClick: props.onTestNotification,
          className: "dsh-pet-cfg__btn",
          children: t("notifyTest")
        }),
        q(t("syncHint")),
        // 两个反馈各归各的：msg 是保存 / 同步结果，permMsg 是测试通知结果。
        msg.text ? h("span", {
          className: "dsh-pet-cfg__msg" + (msg.kind === "err" ? " is-err" : ""),
          children: msg.text
        }) : null,
        permMsg.text ? h("span", {
          className: "dsh-pet-cfg__msg" + (permMsg.kind === "err" ? " is-err" : ""),
          children: permMsg.text
        }) : null
      ]
    });
  };
}

// vendor/dsh-pet/src/client/settings/bridge.ts
var petBridge = {
  current: [],
  reload: () => {
  },
  template: void 0
};

// vendor/dsh-pet/src/shared/weights.ts
var WEIGHT_KEYS = ["idle", "turn", "move"];
var WEIGHTS_TOTAL = 100;
var DEFAULT_WEIGHTS = { idle: 10, turn: 5, move: 5 };
var clampInt = (value, min, max) => {
  const rounded = Math.round(value);
  if (!Number.isFinite(rounded)) return min;
  const upper = Math.max(min, max);
  return Math.min(Math.max(rounded, min), upper);
};
function actionPercent(weights) {
  return Math.max(0, WEIGHTS_TOTAL - weights.idle - weights.turn - weights.move);
}
function withWeight(weights, key, value) {
  const others = weights.idle + weights.turn + weights.move - weights[key];
  return { ...weights, [key]: clampInt(value, 0, WEIGHTS_TOTAL - others) };
}
function parseWeights(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return void 0;
  const record = raw;
  const idle = Number(record.idle);
  const turn = Number(record.turn);
  const move = Number(record.move);
  if ([idle, turn, move].some((value) => !Number.isFinite(value) || value < 0)) return void 0;
  return { idle, turn, move };
}

// vendor/dsh-pet/src/client/settings/config/read.ts
var nonNegative = (value) => {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : void 0;
};
var readModel = (value) => {
  const model = value;
  if (!model || typeof model.provider !== "string" || typeof model.model !== "string") return void 0;
  return { provider: model.provider, model: model.model };
};
function readMainConfig(merged) {
  const main = merged.main;
  if (!main || !Array.isArray(main.pets)) return null;
  const pets = main.pets;
  const patch = {
    // 位置深拷贝：编辑列表与容器手里的成品列表必须是两份数据。
    pets: pets.map((pet) => ({ ...pet, position: { ...pet.position } }))
  };
  if (typeof main.whisperPrompt === "string") patch.entryPrompt = main.whisperPrompt;
  if (typeof main.notificationsEnabled === "boolean") patch.notificationsEnabled = main.notificationsEnabled;
  if (typeof main.clickSoundEnabled === "boolean") patch.clickSoundEnabled = main.clickSoundEnabled;
  if (typeof main.whisperImageEnabled === "boolean") patch.whisperImageEnabled = main.whisperImageEnabled;
  if (typeof main.chatImageEnabled === "boolean") patch.chatImageEnabled = main.chatImageEnabled;
  if (typeof main.chatAnimationEnabled === "boolean") patch.chatAnimationEnabled = main.chatAnimationEnabled;
  if (typeof main.confineToScreen === "boolean") patch.confineToScreen = main.confineToScreen;
  if (typeof main.trayEnabled === "boolean") patch.trayEnabled = main.trayEnabled;
  if (typeof main.voiceEnabled === "boolean") patch.voiceEnabled = main.voiceEnabled;
  if (typeof main.voiceName === "string") patch.voiceName = main.voiceName;
  if (typeof main.voiceWhisperEnabled === "boolean") patch.voiceWhisperEnabled = main.voiceWhisperEnabled;
  if (typeof main.voiceTodoEnabled === "boolean") patch.voiceTodoEnabled = main.voiceTodoEnabled;
  if (main.physics && typeof main.physics === "object") {
    patch.physics = { ...DEFAULT_PHYSICS, ...main.physics };
  }
  if (main.font && typeof main.font === "object") {
    patch.font = { ...DEFAULT_FONT, ...main.font };
  }
  const weights = parseWeights(main.animationWeights);
  if (weights) patch.animationWeights = weights;
  const whisperModel = readModel(main.whisperModel);
  if (whisperModel) patch.whisperModel = whisperModel;
  const chatModel = readModel(main.chatModel);
  if (chatModel) patch.chatModel = chatModel;
  const rounds = nonNegative(main.chatMemoryRounds);
  if (rounds !== void 0) patch.chatMemoryRounds = rounds;
  const limit = nonNegative(main.chatImageLimit);
  if (limit !== void 0) patch.chatImageLimit = limit;
  const volume = nonNegative(main.voiceVolume);
  if (volume !== void 0 && volume <= 1) patch.voiceVolume = volume;
  return patch;
}
function readConfigEntries(merged) {
  const main = merged.main;
  if (!main || !Array.isArray(main.pets)) return null;
  const out = [];
  for (const [key, conf] of Object.entries(merged)) {
    const pets = Array.isArray(conf?.pets) ? conf.pets : [];
    out.push({
      key,
      kind: key === "main" ? "main" : "pack",
      ...typeof conf?.whisperPrompt === "string" ? { entryPrompt: conf.whisperPrompt } : {},
      pets: pets.map((pet) => ({ ...pet, position: { ...pet.position }, assetRoot: key }))
    });
  }
  return out;
}

// vendor/dsh-pet/src/client/settings/config/http.ts
function buildSaveBody(fields) {
  return {
    pets: fields.pets,
    notificationsEnabled: fields.notificationsEnabled,
    clickSoundEnabled: fields.clickSoundEnabled,
    whisperImageEnabled: fields.whisperImageEnabled,
    chatImageEnabled: fields.chatImageEnabled,
    chatAnimationEnabled: fields.chatAnimationEnabled,
    confineToScreen: fields.confineToScreen,
    trayEnabled: fields.trayEnabled,
    voiceEnabled: fields.voiceEnabled,
    voiceName: fields.voiceName,
    voiceVolume: fields.voiceVolume,
    voiceWhisperEnabled: fields.voiceWhisperEnabled,
    voiceTodoEnabled: fields.voiceTodoEnabled,
    physics: fields.physics,
    whisperModel: fields.whisperModel,
    chatModel: fields.chatModel,
    chatMemoryRounds: fields.chatMemoryRounds,
    chatImageLimit: fields.chatImageLimit,
    font: fields.font,
    animationWeights: fields.animationWeights
  };
}
async function loadConfig(signal) {
  try {
    const response = await fetch(ROUTE_PATH + "/config", signal === void 0 ? {} : { signal });
    if (!response.ok) return null;
    const body = await response.json();
    if (body.ok === false) return null;
    return body;
  } catch {
    return null;
  }
}
async function loadMeta() {
  try {
    const response = await fetch(ROUTE_PATH + "/config/meta");
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}
async function loadModelCatalog() {
  try {
    const response = await fetch(ROUTE_PATH + "/models");
    if (!response.ok) return null;
    const body = await response.json();
    if (!body || !Array.isArray(body.providers)) return null;
    return body.providers;
  } catch {
    return null;
  }
}
async function saveConfig(body, force) {
  try {
    const response = await fetch(ROUTE_PATH + "/config" + (force === true ? "?force=1" : ""), {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body)
    });
    const payload = await response.json().catch(() => null);
    if (payload && payload.ok === false) {
      if (payload.reason === "user-config-unparsable") {
        return { kind: "corrupt", userFile: typeof payload.userFile === "string" ? payload.userFile : null };
      }
      if (payload.reason === "bad-request" || payload.reason === "invalid-json") return { kind: "invalid" };
      return { kind: "error" };
    }
    if (!response.ok) return { kind: "error" };
    return { kind: "ok", merged: payload };
  } catch {
    return { kind: "error" };
  }
}
async function syncConfig() {
  try {
    const response = await fetch(ROUTE_PATH + "/config", { method: "POST" });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}
async function savePetLayer(entry, pets) {
  try {
    const response = await fetch(ROUTE_PATH + "/pet-config", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ entry, pets })
    });
    const payload = await response.json().catch(() => null);
    if (payload && payload.ok === false) {
      if (payload.reason === "bad-request" || payload.reason === "unknown-entry") {
        return { kind: "invalid", message: typeof payload.message === "string" ? payload.message : "" };
      }
      return { kind: "error" };
    }
    if (!response.ok) return { kind: "error" };
    return { kind: "ok", merged: payload };
  } catch {
    return { kind: "error" };
  }
}

// vendor/dsh-pet/src/client/settings/config/pack-writes.ts
function fingerprint(pet) {
  return JSON.stringify([
    pet.id,
    pet.name,
    pet.size,
    pet.sizePercent ?? "",
    pet.balanceEnabled,
    pet.whisperEnabled,
    pet.workStatusEnabled,
    pet.fixedEnabled,
    pet.display,
    pet.position.corner,
    pet.position.marginX,
    pet.position.marginY,
    pet.whisperPrompt ?? ""
  ]);
}
function diffPackWrites(loaded, current2) {
  const groups = /* @__PURE__ */ new Map();
  for (const pet of current2) {
    const entry = pet.assetRoot ?? "";
    if (entry === "" || entry === "main") continue;
    const list = groups.get(entry);
    if (list) list.push(pet);
    else groups.set(entry, [pet]);
  }
  const out = [];
  for (const [entry, pets] of groups) {
    const before = loaded.find((item) => item.key === entry)?.pets ?? [];
    const unchanged = before.length === pets.length && before.every((pet, i) => fingerprint(pet) === fingerprint(pets[i]));
    if (!unchanged) out.push({ entry, pets });
  }
  return out;
}

// vendor/dsh-pet/src/client/settings/config/persist.ts
async function persistSettings(fields, packWrites, force, fallbackUserFile) {
  const outcome = await saveConfig(buildSaveBody(fields), force);
  if (outcome.kind === "corrupt") return { kind: "corrupt", path: outcome.userFile ?? fallbackUserFile };
  if (outcome.kind !== "ok") return { kind: outcome.kind };
  let merged = outcome.merged;
  const failed = [];
  for (const write of packWrites) {
    const result = await savePetLayer(write.entry, write.pets);
    if (result.kind === "ok") merged = result.merged;
    else failed.push(write.entry);
  }
  petBridge.reload(merged);
  void reloadNotifications();
  return failed.length > 0 ? { kind: "partial", failed } : { kind: "ok" };
}
async function syncSettings() {
  const merged = await syncConfig();
  if (merged === null) return null;
  petBridge.reload(merged);
  void reloadNotifications();
  return merged;
}

// vendor/dsh-pet/src/client/settings/config/validate-form.ts
var modelPairValid = (model) => model.provider.trim() === "" === (model.model.trim() === "");
var petValid = (pet) => Number.isFinite(pet.size) && pet.size > 0 && (pet.sizePercent === void 0 || isValidSizePercent(pet.sizePercent)) && Number.isFinite(pet.position.marginX) && Number.isFinite(pet.position.marginY);
var physicsValid = (physics) => Number.isFinite(physics.gravity) && physics.gravity >= 0 && Number.isFinite(physics.restitution) && physics.restitution >= 0 && physics.restitution <= 1 && Number.isFinite(physics.groundFriction) && physics.groundFriction >= 0 && Number.isFinite(physics.throwPower) && physics.throwPower > 0;
var fontValid = (font) => FONT_PRESETS.some((preset) => preset.id === font.family) && Number.isFinite(font.size) && font.size >= FONT_SIZE_MIN && font.size <= FONT_SIZE_MAX;
function validateForm(values) {
  if (!values.pets.every(petValid)) return "invalid";
  if (!physicsValid(values.physics)) return "invalidPhysics";
  if (!modelPairValid(values.whisperModel) || !modelPairValid(values.chatModel)) return "invalidModel";
  if (!Number.isFinite(values.chatMemory) || values.chatMemory < 0) return "invalidChatMemory";
  if (!Number.isFinite(values.chatImageLimit) || values.chatImageLimit < 0) return "invalidChatImageLimit";
  if (!fontValid(values.font)) return "invalidFont";
  return null;
}

// vendor/dsh-pet/src/client/settings/config/write-flow.ts
function createWriteFlow(deps) {
  const { setBusy, setMsg, setDialog, t } = deps;
  const save = async (force = false) => {
    if (deps.busy()) return;
    const fields = deps.fields();
    const invalid = validateForm({
      pets: fields.pets,
      physics: fields.physics,
      whisperModel: fields.whisperModel,
      chatModel: fields.chatModel,
      chatMemory: fields.chatMemoryRounds,
      chatImageLimit: fields.chatImageLimit,
      font: fields.font
    });
    if (invalid !== null) {
      setMsg({ kind: "err", text: t(invalid) });
      return;
    }
    setBusy(true);
    setMsg({ kind: "", text: "" });
    try {
      const result = await persistSettings(fields, deps.packWrites(), force, deps.userFile());
      if (result.kind === "ok") {
        setMsg({ kind: "ok", text: t("saved") });
        return;
      }
      if (result.kind === "corrupt") {
        setDialog({ kind: "corrupt", path: result.path });
        return;
      }
      if (result.kind === "partial") {
        setMsg({ kind: "err", text: t("savePartial").replace("{names}", result.failed.join("\u3001")) });
        return;
      }
      setMsg({ kind: "err", text: t(result.kind === "invalid" ? "saveInvalid" : "saveError") });
    } finally {
      setBusy(false);
    }
  };
  const doSync = async () => {
    setBusy(true);
    setMsg({ kind: "", text: "" });
    try {
      const merged = await syncSettings();
      if (merged === null) {
        setMsg({ kind: "err", text: t("syncError") });
        return;
      }
      deps.applyConfig(merged);
      setMsg({ kind: "ok", text: t("saved") });
    } finally {
      setBusy(false);
    }
  };
  return {
    save,
    requestSync: () => setDialog({ kind: "sync" }),
    confirmDialog: () => {
      const pending = deps.dialog();
      if (pending === null) return;
      setDialog(null);
      if (pending.kind === "remove") deps.onRemove();
      else if (pending.kind === "corrupt") void save(true);
      else if (pending.kind === "sync") void doSync();
    }
  };
}

// vendor/dsh-pet/src/client/settings/config/use-config-load.ts
function useConfigLoad(rt, onMerged) {
  const { useState, useEffect } = rt;
  const [loadState, setLoadState] = useState("loading");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let alive = true;
    const controller = new AbortController();
    void loadConfig(controller.signal).then((merged) => {
      if (!alive) return;
      if (merged === null) {
        setLoadState("error");
        return;
      }
      onMerged(merged);
      setLoadState("ready");
    }).catch(() => {
      if (alive) setLoadState("error");
    });
    return () => {
      alive = false;
      controller.abort();
    };
  }, [onMerged, attempt]);
  const retry = () => {
    setLoadState("loading");
    setAttempt((value) => value + 1);
  };
  return { loadState, retry };
}

// vendor/dsh-pet/src/client/settings/dialog.ts
function bodyText(dialog, t, selId) {
  if (dialog.kind === "remove") return t("confirmRemove").replace("{id}", selId);
  if (dialog.kind === "lastOne") return t("atLeastOne");
  if (dialog.kind === "lastOfKind") return t("lastOfKind").replace("{entry}", dialog.entry);
  if (dialog.kind === "corrupt") return t("corruptBody").replace("{path}", dialog.path);
  return t("confirmSync");
}
function confirmLabel(kind, t) {
  if (kind === "remove") return t("remove");
  if (kind === "corrupt") return t("corruptConfirm");
  return t("sync");
}
function makeDialog(rt) {
  const { h, t } = rt;
  return function SettingsDialog(props) {
    const { dialog } = props;
    const confirmable = dialog.kind === "lastOne" || dialog.kind === "lastOfKind" ? null : dialog;
    return h("div", {
      style: {
        position: "fixed",
        inset: 0,
        zIndex: 2147483647,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0, 0, 0, 0.45)"
      },
      onClick: props.onDismiss,
      children: h("div", {
        style: {
          width: "340px",
          maxWidth: "calc(100vw - 40px)",
          background: "var(--dsw-alias-bg-layer-1)",
          border: "1px solid var(--dsw-alias-border-l2)",
          borderRadius: "12px",
          padding: "16px 18px",
          boxShadow: "0 8px 30px rgba(0, 0, 0, 0.35)",
          display: "flex",
          flexDirection: "column",
          gap: "12px"
        },
        onClick: (e) => e.stopPropagation(),
        children: [
          h("div", {
            style: { fontSize: "14px", fontWeight: 500, color: "var(--dsw-alias-label-primary)" },
            children: t(dialog.kind === "corrupt" ? "corruptTitle" : "confirmTitle")
          }),
          h("div", {
            style: { fontSize: "13px", lineHeight: "20px", color: "var(--dsw-alias-label-secondary)" },
            children: bodyText(dialog, t, props.selId)
          }),
          h("div", {
            style: { display: "flex", gap: "8px", justifyContent: "flex-end" },
            // 只剩一只没有可确认的动作，只给「知道了」；其余都是取消 + 确认双按钮。
            children: confirmable === null ? [
              h("button", {
                key: "ok",
                type: "button",
                onClick: props.onDismiss,
                className: "dsh-pet-cfg__btn is-primary",
                children: t("ok")
              })
            ] : [
              h("button", {
                key: "cancel",
                type: "button",
                onClick: props.onDismiss,
                className: "dsh-pet-cfg__btn",
                children: t("cancel")
              }),
              h("button", {
                key: "confirm",
                type: "button",
                onClick: props.onConfirm,
                className: "dsh-pet-cfg__btn " + (confirmable.kind === "sync" ? "is-primary" : "is-danger"),
                children: confirmLabel(confirmable.kind, t)
              })
            ]
          })
        ]
      })
    });
  };
}

// vendor/dsh-pet/src/client/settings/panel/placement.ts
var PANEL_GAP_PX = 12;
var PANEL_OFFSET_PX = 4;
var EDGE_MARGIN_PX = 8;
var VIEWPORT_INSET_PX = 16;
var MIN_AVAILABLE_WIDTH_PX = 200;
function computePanelPlacement(anchor, viewport, options = {}) {
  const minWidth = options.minWidthPx ?? 240;
  const maxWidth = options.maxWidthPx ?? 420;
  const maxHeight = options.maxHeightPx ?? 360;
  const flipThreshold = options.flipThresholdPx ?? 240;
  const below = viewport.height - anchor.bottom - PANEL_GAP_PX;
  const above = anchor.top - PANEL_GAP_PX;
  const available = Math.max(MIN_AVAILABLE_WIDTH_PX, Math.min(maxWidth, viewport.width - VIEWPORT_INSET_PX));
  const width = Math.min(Math.max(anchor.width, minWidth), available);
  const left = Math.max(EDGE_MARGIN_PX, Math.min(anchor.left, viewport.width - width - EDGE_MARGIN_PX));
  const openUp = below < flipThreshold && above > below;
  return openUp ? { left, bottom: viewport.height - anchor.top + PANEL_OFFSET_PX, width, maxHeight: Math.min(maxHeight, above) } : { left, top: anchor.bottom + PANEL_OFFSET_PX, width, maxHeight: Math.min(maxHeight, below) };
}

// vendor/dsh-pet/src/client/settings/panel/select.ts
function makeSelect(rt) {
  const { h, useState, useEffect, useRef } = rt;
  return function Select(props) {
    const [open, setOpen] = useState(false);
    const [active, setActive] = useState(0);
    const [pos, setPos] = useState(null);
    const rootRef = useRef(null);
    const panelRef = useRef(null);
    const selectedAt = props.options.findIndex((option) => option.id === props.value);
    const currentLabel = selectedAt >= 0 ? props.options[selectedAt].label : "";
    const openAt = (index) => {
      setActive(index >= 0 ? index : 0);
      setOpen(true);
    };
    const commit = (index) => {
      const option = props.options[index];
      setOpen(false);
      if (option !== void 0 && option.id !== props.value) props.onChange(option.id);
    };
    const step = (dir) => {
      const count = props.options.length;
      if (count === 0) return;
      const next = (Math.max(active, 0) + dir + count) % count;
      setActive(next);
      panelRef.current?.querySelector('[data-row="' + next + '"]')?.scrollIntoView({ block: "nearest" });
    };
    useEffect(() => {
      if (!open) return;
      const root = rootRef.current;
      const place = () => {
        if (!root) return;
        setPos(
          computePanelPlacement(
            root.getBoundingClientRect(),
            { width: window.innerWidth, height: window.innerHeight },
            // 与触发器等宽：240 的下限是给「服务商 + 模型」两段文字留的，单行下拉不该继承。
            { minWidthPx: 0 }
          )
        );
      };
      place();
      const onDown = (e) => {
        const target = e.target;
        if (target && (rootRef.current?.contains(target) === true || panelRef.current?.contains(target) === true)) {
          return;
        }
        setOpen(false);
      };
      const onKey = (e) => {
        if (e.key === "Escape") setOpen(false);
      };
      document.addEventListener("mousedown", onDown, true);
      document.addEventListener("keydown", onKey, true);
      window.addEventListener("scroll", place, true);
      window.addEventListener("resize", place);
      return () => {
        document.removeEventListener("mousedown", onDown, true);
        document.removeEventListener("keydown", onKey, true);
        window.removeEventListener("scroll", place, true);
        window.removeEventListener("resize", place);
      };
    }, [open]);
    useEffect(() => {
      if (props.disabled) setOpen(false);
    }, [props.disabled]);
    const toggle = () => {
      if (props.disabled) return;
      if (open) setOpen(false);
      else openAt(selectedAt);
    };
    const onTriggerKey = (e) => {
      const count = props.options.length;
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        if (open) step(e.key === "ArrowDown" ? 1 : -1);
        else openAt(selectedAt);
        return;
      }
      if (open && (e.key === "Home" || e.key === "End")) {
        e.preventDefault();
        setActive(e.key === "Home" || count === 0 ? 0 : count - 1);
        return;
      }
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        if (open) commit(active);
        else openAt(selectedAt);
      }
    };
    const panel = open && pos ? h("div", {
      ref: panelRef,
      className: "dsh-pet-sel__panel",
      role: "listbox",
      "aria-label": props.label,
      style: {
        left: pos.left + "px",
        top: pos.top === void 0 ? void 0 : pos.top + "px",
        bottom: pos.bottom === void 0 ? void 0 : pos.bottom + "px",
        width: pos.width + "px",
        maxHeight: pos.maxHeight + "px"
      },
      children: h("div", {
        className: "dsh-pet-sel__list",
        children: props.options.map(
          (option, index) => h("button", {
            key: option.id,
            type: "button",
            role: "option",
            "aria-selected": option.id === props.value,
            "data-row": index,
            className: "dsh-pet-sel__item" + (index === active ? " is-active" : ""),
            onMouseMove: () => setActive(index),
            onClick: () => commit(index),
            children: [
              h("span", { key: "n", className: "dsh-pet-sel__name", children: option.label }),
              h("span", {
                key: "c",
                className: "dsh-pet-sel__check",
                children: option.id === props.value ? "\u2713" : ""
              })
            ]
          })
        )
      })
    }) : null;
    return h("div", {
      ref: rootRef,
      className: "dsh-pet-sel",
      children: [
        h("button", {
          key: "trigger",
          type: "button",
          className: INPUT_CLASS + " dsh-pet-sel__trigger",
          disabled: props.disabled,
          "aria-haspopup": "listbox",
          "aria-expanded": open,
          "aria-label": props.label,
          onClick: toggle,
          onKeyDown: onTriggerKey,
          children: [
            h("span", { key: "l", className: "dsh-pet-sel__label", children: currentLabel }),
            h("span", { key: "c", className: "dsh-pet-sel__chevron" + (open ? " is-open" : "") })
          ]
        }),
        panel
      ]
    });
  };
}

// vendor/dsh-pet/src/client/settings/font-card.ts
function makeFontCard(rt) {
  const { h, t } = rt;
  const { cardHead, field, toggleCell } = makeUiKit({ h, t });
  const Select = makeSelect(rt);
  return function FontCard(props) {
    const { busy, font } = props;
    return h("div", {
      className: "dsh-pet-cfg__card",
      children: [
        cardHead(t("fontTitle"), t("fontHint")),
        h("div", {
          className: "dsh-pet-cfg__grid2",
          children: [
            field(
              t("fontFamilyLabel"),
              h(Select, {
                label: t("fontFamilyLabel"),
                value: font.family,
                options: FONT_PRESETS.map((preset) => ({ id: preset.id, label: t("font." + preset.id) })),
                disabled: busy,
                onChange: (id) => props.onChange({ family: id })
              }),
              t("fontFamilyHint")
            ),
            field(
              t("fontSizeLabel"),
              h(
                "input",
                numberInputProps(font.size, (v) => props.onChange({ size: v }), {
                  step: "1",
                  min: String(FONT_SIZE_MIN),
                  max: String(FONT_SIZE_MAX),
                  disabled: busy
                })
              ),
              t("fontSizeHint")
            )
          ]
        }),
        h("div", {
          className: "dsh-pet-cfg__grid2",
          children: [toggleCell("fontFollowToggle", font.followPet, busy, (v) => props.onChange({ followPet: v }))]
        })
      ]
    });
  };
}

// vendor/dsh-pet/src/client/settings/global-card.ts
var TOGGLES = [
  { key: "notificationsEnabled", label: "notifyToggle" },
  { key: "clickSoundEnabled", label: "clickSoundToggle" },
  { key: "confineToScreen", label: "confineToggle" }
];
function makeGlobalCard(rt) {
  const { h, t } = rt;
  const { cardHead, toggleCell } = makeUiKit({ h, t });
  return function GlobalCard(props) {
    return h("div", {
      className: "dsh-pet-cfg__card",
      children: [
        cardHead(t("globalTitle"), t("globalHint")),
        h("div", {
          className: "dsh-pet-cfg__grid4",
          children: TOGGLES.map(
            (toggle) => toggleCell(
              toggle.label,
              props.values[toggle.key],
              props.busy,
              (value) => props.onChange(toggle.key, value)
            )
          )
        })
      ]
    });
  };
}

// vendor/dsh-pet/src/client/settings/load-status.ts
function makeLoadStatus(rt) {
  const { h, t } = rt;
  return function LoadStatus(props) {
    if (props.loadState === "ready") return null;
    const failed = props.loadState === "error";
    return h("div", {
      role: failed ? "alert" : "status",
      className: "dsh-pet-cfg__actions",
      children: [
        h("span", { children: t(failed ? "loadError" : "loading") }),
        failed ? h("button", {
          type: "button",
          className: "dsh-pet-cfg__btn",
          onClick: props.onRetry,
          children: t("retry")
        }) : null
      ]
    });
  };
}

// vendor/dsh-pet/src/client/settings/model-card.ts
var CHAT_TOGGLES = [
  { key: "whisperImageEnabled", label: "whisperImageToggle" },
  { key: "chatImageEnabled", label: "chatImageToggle" },
  { key: "chatAnimationEnabled", label: "chatAnimationToggle" }
];
function makeModelCard(rt, picker) {
  const { h, t } = rt;
  const { cardHead, field, toggleCell } = makeUiKit({ h, t });
  return function ModelCard(props) {
    const { busy, catalog, failed } = props;
    const numField = (label, value, setter) => field(
      t(label),
      h("input", numberInputProps(value, setter, { step: "1", min: "0", disabled: busy })),
      t(label + "Hint")
    );
    const modelCell = (key, value) => {
      const label = t(key === "whisperModel" ? "whisperModelLabel" : "chatModelLabel");
      return field(
        label,
        h(picker, {
          label,
          value,
          disabled: busy,
          catalog,
          failed,
          onChange: (next) => props.onModelChange(key, next)
        }),
        t("modelFieldHint")
      );
    };
    return h("div", {
      className: "dsh-pet-cfg__card",
      children: [
        cardHead(t("modelTitle"), t("modelHint")),
        failed ? h("p", {
          className: "dsh-pet-cfg__note",
          style: { color: "var(--dsw-alias-state-error-primary)" },
          children: t("modelCatalogFailed")
        }) : null,
        h("div", {
          className: "dsh-pet-cfg__grid2",
          children: [modelCell("whisperModel", props.whisperModel), modelCell("chatModel", props.chatModel)]
        }),
        h("div", {
          className: "dsh-pet-cfg__grid4",
          children: [
            numField("chatMemory", props.chatMemory, props.onChatMemoryChange),
            numField("chatImageLimit", props.chatImageLimit, props.onChatImageLimitChange)
          ]
        }),
        h("div", {
          className: "dsh-pet-cfg__grid3",
          children: CHAT_TOGGLES.map(
            (toggle) => toggleCell(toggle.label, props.values[toggle.key], busy, (value) => props.onFlagChange(toggle.key, value))
          )
        })
      ]
    });
  };
}

// vendor/dsh-pet/src/client/pet/device-tilt.ts
var TILT_DEAD_ZONE_DEG = 2;
var SHAKE_THRESHOLD = 18;
var SHAKE_COOLDOWN_MS = 300;
var SHAKE_BASE_SPEED = 3600;
var SHAKE_GAIN = 160;
var SHAKE_MAX_BONUS = 4800;
var screenAngleDeg = () => {
  if (typeof screen === "undefined" || !screen.orientation) return 0;
  return screen.orientation.angle || 0;
};
var nearestDelta = (delta, period) => {
  const half = period / 2;
  return ((delta + half) % period + period) % period - half;
};
function tiltGravity(sample, baseline, gravity, screenAngle = screenAngleDeg()) {
  const dBeta = nearestDelta(sample.beta - baseline.beta, 360);
  const dGamma = nearestDelta(sample.gamma - baseline.gamma, 180);
  if (Math.abs(dBeta) < TILT_DEAD_ZONE_DEG && Math.abs(dGamma) < TILT_DEAD_ZONE_DEG) return { gx: 0, gy: 0 };
  if (!Number.isFinite(gravity) || gravity <= 0) return { gx: 0, gy: 0 };
  const rad = Math.PI / 180;
  const ax = gravity * Math.sin(dGamma * rad);
  const ay = gravity * Math.sin(dBeta * rad);
  switch ((screenAngle % 360 + 360) % 360) {
    case 90:
      return { gx: ay, gy: -ax };
    case 180:
      return { gx: -ax, gy: -ay };
    case 270:
      return { gx: -ay, gy: ax };
    default:
      return { gx: ax, gy: ay };
  }
}
function shakeImpulse(ax, ay, az, throwPower) {
  const mag = Math.hypot(ax, ay, az);
  if (!Number.isFinite(mag) || mag < SHAKE_THRESHOLD) return null;
  const lateral = Math.hypot(ax, ay);
  if (lateral < 1e-6) return null;
  const speed = (SHAKE_BASE_SPEED + Math.min(SHAKE_MAX_BONUS, mag * SHAKE_GAIN)) * Math.max(0, throwPower);
  return { vx: ax / lateral * speed, vy: ay / lateral * speed };
}
function canReadMotionSensors() {
  return typeof DeviceOrientationEvent !== "undefined" && typeof DeviceMotionEvent !== "undefined";
}
async function requestMotionPermission(kinds) {
  const ask = async (ctor) => {
    if (ctor === void 0) return false;
    const fn = ctor.requestPermission;
    if (typeof fn !== "function") return true;
    try {
      return await fn.call(ctor) === "granted";
    } catch {
      return false;
    }
  };
  const granted = [];
  if (kinds.tilt) granted.push(await ask(globalThis.DeviceOrientationEvent));
  if (kinds.shake) granted.push(await ask(globalThis.DeviceMotionEvent));
  return granted.every(Boolean);
}
function subscribeTilt(onSample) {
  if (typeof window === "undefined" || typeof DeviceOrientationEvent === "undefined") return () => {
  };
  const handler = (e) => {
    if (e.beta === null || e.gamma === null) return;
    onSample({ beta: e.beta, gamma: e.gamma });
  };
  window.addEventListener("deviceorientation", handler, true);
  return () => window.removeEventListener("deviceorientation", handler, true);
}
function subscribeShake(onShake, now = () => performance.now()) {
  if (typeof window === "undefined" || typeof DeviceMotionEvent === "undefined") return () => {
  };
  let lastAt = 0;
  const handler = (e) => {
    const a = e.acceleration;
    const raw = a && (a.x !== null || a.y !== null || a.z !== null) ? a : e.accelerationIncludingGravity;
    if (!raw) return;
    const ax = raw.x ?? 0;
    const ay = raw.y ?? 0;
    const az = raw.z ?? 0;
    if (Math.hypot(ax, ay, az) < SHAKE_THRESHOLD) return;
    const at = now();
    if (at - lastAt < SHAKE_COOLDOWN_MS) return;
    lastAt = at;
    onShake(ax, ay, az);
  };
  window.addEventListener("devicemotion", handler, true);
  return () => window.removeEventListener("devicemotion", handler, true);
}

// vendor/dsh-pet/src/client/settings/mobile-card.ts
function makeMobileCard(rt) {
  const { h, t } = rt;
  const { cardHead, toggleCell } = makeUiKit({ h, t });
  return function MobileCard(props) {
    const { busy, physics } = props;
    return h("div", {
      className: "dsh-pet-cfg__card",
      children: [
        cardHead(t("mobileTitle"), t("mobileHint")),
        h("div", {
          className: "dsh-pet-cfg__grid3",
          children: [
            toggleCell(
              "physicsHaptic",
              physics.hapticEnabled !== false,
              busy,
              (v) => props.onChange({ hapticEnabled: v })
            ),
            toggleCell("physicsTilt", physics.tiltGravity === true, busy, (v) => {
              if (v) void requestMotionPermission({ tilt: true, shake: false });
              props.onChange({ tiltGravity: v });
            }),
            toggleCell("physicsShake", physics.shakeThrow === true, busy, (v) => {
              if (v) void requestMotionPermission({ tilt: false, shake: true });
              props.onChange({ shakeThrow: v });
            })
          ]
        })
      ]
    });
  };
}

// vendor/dsh-pet/src/client/settings/motion-card.ts
function makeMotionCard(rt) {
  const { h, t } = rt;
  const { cardHead, field } = makeUiKit({ h, t });
  return function MotionCard(props) {
    const { busy, weights } = props;
    const weightFields = WEIGHT_KEYS.map(
      (key) => field(
        t("motion." + key),
        h(
          "input",
          numberInputProps(weights[key], (value) => props.onChange(withWeight(weights, key, value)), {
            step: "1",
            min: "0",
            max: "100",
            disabled: busy
          })
        )
      )
    );
    const actionField = field(
      t("motion.action"),
      h("input", {
        className: INPUT_CLASS,
        type: "number",
        value: actionPercent(weights),
        readOnly: true,
        tabIndex: -1,
        "aria-label": t("motion.action")
      })
    );
    return h("div", {
      className: "dsh-pet-cfg__card",
      children: [
        cardHead(t("motionTitle"), t("motionHint")),
        h("div", { className: "dsh-pet-cfg__grid4", children: [...weightFields, actionField] })
      ]
    });
  };
}

// vendor/dsh-pet/src/client/settings/picker/model-rows.ts
function matchModelQuery(text, query) {
  const needle = query.trim().toLowerCase();
  if (needle === "") return true;
  let at = 0;
  for (const char of text.toLowerCase()) {
    if (char === needle[at]) at += 1;
    if (at >= needle.length) return true;
  }
  return false;
}
function buildModelRows(groups, query) {
  const needle = query.trim().toLowerCase();
  const rows = [];
  if (needle === "") rows.push({ kind: "follow", key: "__follow" });
  for (const group of groups) {
    const models = group.models.filter((model) => matchModelQuery(model.name + " " + model.id, needle));
    if (models.length === 0 && !(needle === "" && group.models.length === 0)) continue;
    rows.push({ kind: "group", key: group.id, name: group.name });
    if (models.length === 0) {
      rows.push({ kind: "none", key: group.id + "/__none" });
      continue;
    }
    for (const model of models) {
      rows.push({ kind: "model", key: group.id + "/" + model.id, provider: group.id, model });
    }
  }
  return rows;
}
function selectableIndexes(rows) {
  return rows.map((row, index) => row.kind === "group" || row.kind === "none" ? -1 : index).filter((i) => i >= 0);
}

// vendor/dsh-pet/src/client/settings/picker/model-picker-panel.ts
function buildModelPanel(view) {
  const { h, t } = view;
  const emptyHint = view.catalog !== null && view.catalog.length === 0 ? t("modelNoModels") : view.rows.length === 0 ? t("modelEmpty") : "";
  return h("div", {
    ref: view.panelRef,
    className: "dsh-pet-mp__panel",
    role: "menu",
    "aria-label": view.label,
    style: {
      left: view.pos.left + "px",
      top: view.pos.top === void 0 ? void 0 : view.pos.top + "px",
      bottom: view.pos.bottom === void 0 ? void 0 : view.pos.bottom + "px",
      width: view.pos.width + "px",
      maxHeight: view.pos.maxHeight + "px"
    },
    children: [
      searchNode(view),
      view.catalog === null ? statusNode(h, "loading", view.failed ? t("modelCatalogFailed") : t("modelLoading"), false) : emptyHint !== "" ? statusNode(h, "empty", emptyHint, true) : h("div", {
        key: "list",
        className: "dsh-pet-mp__list",
        role: "group",
        children: view.rows.map((row, index) => rowNode(view, row, index))
      })
    ]
  });
}
function statusNode(h, key, text, live) {
  return h("div", {
    key,
    className: "dsh-pet-mp__status",
    role: live ? "status" : void 0,
    children: text
  });
}
function searchNode(view) {
  const { h, t } = view;
  return h("input", {
    key: "search",
    type: "text",
    className: "dsh-pet-mp__search",
    role: "searchbox",
    placeholder: t("modelSearch"),
    "aria-label": t("modelSearch"),
    value: view.query,
    disabled: view.disabled,
    onChange: (event) => view.onQueryChange(event.target.value),
    onKeyDown: view.onKeyDown
  });
}
function rowNode(view, row, index) {
  const { h, t } = view;
  if (row.kind === "group") {
    return h("div", { key: row.key, className: "dsh-pet-mp__group", children: row.name });
  }
  if (row.kind === "none") {
    return h("div", { key: row.key, className: "dsh-pet-mp__status", children: t("modelNone") });
  }
  const checked = row.kind === "follow" ? view.value.provider === "" : view.value.provider === row.provider && view.value.model === row.model.id;
  return h("button", {
    key: row.key,
    type: "button",
    role: "menuitemradio",
    "aria-checked": checked,
    "data-row": index,
    className: "dsh-pet-mp__item" + (index === view.active ? " is-active" : ""),
    disabled: view.disabled,
    onClick: () => view.onPick(row),
    onMouseMove: () => view.onHover(index),
    children: [
      h("span", {
        key: "n",
        className: "dsh-pet-mp__name",
        children: row.kind === "follow" ? t("modelFollow") : row.model.name
      }),
      h("span", { key: "c", className: "dsh-pet-mp__check", children: checked ? "\u2713" : "" })
    ]
  });
}

// vendor/dsh-pet/src/client/settings/picker/model-picker.ts
function makeModelPicker(rt) {
  const { h, useState, useEffect, useRef, t } = rt;
  return function ModelPicker(props) {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState("");
    const [active, setActive] = useState(0);
    const [pos, setPos] = useState(null);
    const rootRef = useRef(null);
    const panelRef = useRef(null);
    const groups = props.catalog ?? [];
    const group = groups.find((g) => g.id === props.value.provider);
    const picked = group?.models.find((m) => m.id === props.value.model);
    const isFollow = props.value.provider === "";
    const triggerLabel = isFollow ? t("modelFollow") : picked?.name ?? props.value.model;
    const triggerSub = isFollow ? "" : group?.name ?? props.value.provider + t("modelUnknown");
    const rows = buildModelRows(groups, query);
    const selectable = selectableIndexes(rows);
    const commit = (value) => {
      props.onChange(value);
      setOpen(false);
      setQuery("");
    };
    const pick2 = (row) => {
      if (!row) return;
      if (row.kind === "follow") commit({ provider: "", model: "" });
      else if (row.kind === "model") commit({ provider: row.provider, model: row.model.id });
    };
    const step = (dir) => {
      if (selectable.length === 0) return;
      const at = selectable.indexOf(active);
      const next = selectable[at < 0 ? 0 : (at + dir + selectable.length) % selectable.length];
      setActive(next);
      panelRef.current?.querySelector('[data-row="' + next + '"]')?.scrollIntoView({ block: "nearest" });
    };
    useEffect(() => {
      if (!open) return;
      const el = rootRef.current;
      const place = () => {
        if (!el) return;
        setPos(
          computePanelPlacement(el.getBoundingClientRect(), {
            width: window.innerWidth,
            height: window.innerHeight
          })
        );
      };
      place();
      panelRef.current?.querySelector("input")?.focus();
      const onDown = (e) => {
        const target = e.target;
        if (target && (rootRef.current?.contains(target) === true || panelRef.current?.contains(target) === true)) {
          return;
        }
        setOpen(false);
      };
      const onKey = (e) => {
        if (e.key === "Escape") setOpen(false);
      };
      document.addEventListener("mousedown", onDown, true);
      document.addEventListener("keydown", onKey, true);
      window.addEventListener("scroll", place, true);
      window.addEventListener("resize", place);
      return () => {
        document.removeEventListener("mousedown", onDown, true);
        document.removeEventListener("keydown", onKey, true);
        window.removeEventListener("scroll", place, true);
        window.removeEventListener("resize", place);
      };
    }, [open]);
    const toggle = () => {
      if (props.disabled) return;
      if (!open) {
        setQuery("");
        const at = rows.findIndex(
          (r) => r.kind === "model" && r.provider === props.value.provider && r.model.id === props.value.model
        );
        setActive(at >= 0 ? at : 0);
      }
      setOpen(!open);
    };
    const panel = open && pos ? buildModelPanel({
      h,
      t,
      label: props.label,
      disabled: props.disabled,
      catalog: props.catalog,
      failed: props.failed,
      rows,
      active,
      query,
      value: props.value,
      pos,
      panelRef,
      onQueryChange: (value) => {
        setQuery(value);
        setActive(selectable.length > 0 ? selectable[0] : 0);
      },
      onPick: pick2,
      onHover: setActive,
      onKeyDown: (event) => {
        if (event.key === "ArrowDown") {
          event.preventDefault();
          step(1);
        } else if (event.key === "ArrowUp") {
          event.preventDefault();
          step(-1);
        } else if (event.key === "Enter") {
          event.preventDefault();
          pick2(rows[active]);
        }
      }
    }) : null;
    return h("div", {
      ref: rootRef,
      className: "dsh-pet-mp",
      children: [
        h("button", {
          key: "trigger",
          type: "button",
          className: "dsh-pet-mp__trigger",
          disabled: props.disabled,
          "aria-haspopup": "menu",
          "aria-expanded": open,
          "aria-label": t("modelTriggerAria").replace("{model}", triggerLabel),
          onClick: toggle,
          children: [
            h("span", { key: "l", className: "dsh-pet-mp__label", children: triggerLabel }),
            triggerSub ? h("span", { key: "s", className: "dsh-pet-mp__sub", children: triggerSub }) : null,
            h("span", { key: "c", className: "dsh-pet-mp__chevron" + (open ? " is-open" : ""), children: "\u25BE" })
          ]
        }),
        panel
      ]
    });
  };
}

// vendor/dsh-pet/src/client/settings/picker/voice-picker.ts
function makeVoicePicker(rt) {
  const { h } = rt;
  const Select = makeSelect(rt);
  return function VoicePicker(props) {
    return h(Select, {
      label: props.label,
      value: props.value,
      options: props.options.map((option) => ({ id: option.id, label: `${option.name}\uFF08${option.tag}\uFF09` })),
      disabled: props.disabled,
      onChange: props.onChange
    });
  };
}

// vendor/dsh-pet/src/client/settings/notify-test.ts
async function runNotificationTest(deps) {
  const { t, report } = deps;
  report({ kind: "", text: "" });
  const result = await requestNotificationPermission();
  if (!result.ok) {
    const reason = result.reason === "unsupported" ? t("notifyDenyUnsupported") : result.reason === "denied" ? t("notifyDenyBlocked") : result.reason === "rejected" ? t("notifyDenyRejected") : t("notifyDenyError") + (result.message ? "\uFF1A" + result.message : "");
    report({ kind: "err", text: reason + (result.reason === "unsupported" ? "" : " " + t("notifyGuide")) });
    return;
  }
  try {
    wireNotificationClick(
      new Notification("\u6D4B\u8BD5\u901A\u77E5", { body: "\u3010dsh-pet\u3011\u7CFB\u7EDF\u901A\u77E5\u5DF2\u5C31\u7EEA\u3002", icon: NOTIFY_ICONS2.test })
    );
  } catch {
  }
  report({ kind: "ok", text: t("notifyTestOk") });
}

// vendor/dsh-pet/src/client/settings/kind-tabs.ts
function makeKindTabs(rt) {
  const { h, t } = rt;
  return function KindTabs(props) {
    return h("div", {
      className: "dsh-pet-cfg__kinds",
      children: [
        h("span", { key: "label", className: "dsh-pet-cfg__tabsLabel", children: t("kindLabel") }),
        ...props.kinds.map(
          (item) => h("button", {
            key: item.entry,
            type: "button",
            disabled: props.busy,
            onClick: () => props.onSelect(item.entry),
            className: "dsh-pet-cfg__tab" + (item.entry === props.kind ? " is-active" : ""),
            // 主条目固定显示「内置」；文件宠物直接显示目录前缀（与素材根一致）。
            children: (item.kind === "main" ? t("kindMain") : item.entry) + " (" + item.count + ")"
          })
        )
      ]
    });
  };
}

// vendor/dsh-pet/src/client/settings/paths-cards.ts
var BODY_ID = {
  meta: "pet-cfg-paths-meta",
  storage: "pet-cfg-paths-storage"
};
function makePathsCards(rt) {
  const { h, t, useState } = rt;
  const { foldCard } = makeUiKit({ h, t });
  function ConfigMetaCard(props) {
    const { paths } = props;
    const [open, setOpen] = useState(false);
    const line = (key, value, suffix = "") => value === void 0 ? null : h("div", { key, className: "dsh-pet-cfg__path", children: t(key) + "\uFF1A" + value + suffix });
    const body = [
      line("defaultConfig", paths.default),
      line("userConfig", paths.user),
      line("todosFile", paths.todos),
      line("animationDir", paths.animations),
      line("memesDir", paths.memes),
      // 日志文件路径 + 一句说明；其余位置的用途都在问号里，唯独这条写在明面上——反馈问题时要先找它。
      line("logFile", paths.logs),
      paths.logs ? h("div", { key: "logNote", className: "dsh-pet-cfg__note", children: t("logFileNote") }) : null
    ];
    return foldCard({
      id: BODY_ID.meta,
      title: t("configMeta"),
      hint: t("configMetaHint"),
      body,
      open,
      onToggle: () => setOpen(!open)
    });
  }
  function StorageCard(props) {
    const { paths } = props;
    const [open, setOpen] = useState(false);
    const storage = paths.storage ?? [];
    if (storage.length === 0) return null;
    const body = [
      // 存储位置清单：每条都是「路径（等宽、可选中复制）到作用」。
      ...storage.map(
        (entry) => h("div", {
          key: entry.key,
          className: "dsh-pet-cfg__path",
          children: [
            h("b", { key: "p", style: { fontFamily: MONO_STACK }, children: entry.path }),
            // 尚未产生的目录标一下，避免用户去找不存在的文件夹。
            h("span", {
              key: "d",
              children: " \u2014 " + t("storage." + entry.key) + (entry.exists === false ? t("storageMissing") : "")
            })
          ]
        })
      ),
      h("div", {
        key: "ut",
        className: "dsh-pet-cfg__cardTitle",
        style: { marginTop: "4px" },
        children: t("uninstallTitle")
      }),
      h("div", { key: "u1", className: "dsh-pet-cfg__note", children: t("uninstallStep1") }),
      h("div", { key: "u2", className: "dsh-pet-cfg__note", children: t("uninstallStep2") }),
      h("div", {
        key: "cmd",
        className: "dsh-pet-cfg__cmd",
        children: t("uninstallCmd").replace("{profile}", paths.profile || "<profile>")
      }),
      h("div", { key: "u3", className: "dsh-pet-cfg__note", children: t("uninstallStep3") })
    ];
    return foldCard({
      id: BODY_ID.storage,
      title: t("storageTitle"),
      hint: t("storageHint"),
      body,
      open,
      onToggle: () => setOpen(!open)
    });
  }
  return { ConfigMetaCard, StorageCard };
}

// vendor/dsh-pet/src/shared/config.ts
var PET_DISPLAYS = ["web", "desktop", "both", "none"];
var isWebVisible = (display) => display === "web" || display === "both";
function flattenConfigPets(merged) {
  const out = [];
  for (const [entry, conf] of Object.entries(merged)) {
    const list = Array.isArray(conf?.pets) ? conf.pets : [];
    for (const p of list) {
      out.push({
        ...p,
        animations: conf.animations,
        animationWeights: conf.animationWeights,
        eventsRefreshSec: conf.eventsRefreshSec,
        physics: conf.physics,
        font: conf.font,
        confineToScreen: conf.confineToScreen,
        workStatusTexts: conf.workStatusTexts,
        // 睡觉文案：渲染端要能「睡着时点对话/碎碎念就弹拒绝台词」，所以必须在拍平时带出来
        // （与 workStatusTexts 同一类条目级字段：多实例共享所属条目那一份）。
        sleepStartTexts: conf.sleepStartTexts,
        sleepEndTexts: conf.sleepEndTexts,
        sleepRefuseTexts: conf.sleepRefuseTexts,
        whisperModel: conf.whisperModel,
        chatModel: conf.chatModel,
        // 表情包三件套：右键「配图」菜单要按配置里的清单与顺序分组，客户端不读磁盘，
        // 所以只能在拍平时一并带出；文件是否存在由宿主在生成时校验（见 host/memes 的池判定）。
        memes: conf.memes,
        chatImageEnabled: conf.chatImageEnabled,
        chatAnimationEnabled: conf.chatAnimationEnabled,
        chatImageLimit: conf.chatImageLimit,
        assetRoot: entry,
        extra: entry !== "main"
      });
    }
  }
  return out;
}

// vendor/dsh-pet/src/client/settings/pet-card-parts.ts
var CORNERS = ["top-left", "top-right", "bottom-left", "bottom-right"];
function makePetAvatarCell(rt) {
  const { h, t } = rt;
  const { tip } = makeUiKit({ h, t });
  const image = (src) => h("img", { className: "dsh-pet-cfg__avatarImg", src, alt: t("avatarLabel"), loading: "lazy" });
  return function PetAvatarCell(props) {
    if (props.onAvatar === void 0) {
      return h("div", { className: "dsh-pet-cfg__avatarCol", children: image(props.avatarSrc) });
    }
    return h("div", {
      className: "dsh-pet-cfg__avatarCol",
      children: h("div", {
        className: "dsh-pet-cfg__avatarPick",
        ...tip(t("avatarHint")),
        children: [
          image(props.avatarSrc),
          h("span", {
            key: "mask",
            className: "dsh-pet-cfg__avatarMask" + (props.avatarBusy ? " is-busy" : ""),
            children: props.avatarBusy ? t("avatarUploading") : t("avatarChange")
          }),
          h("input", {
            key: "file",
            className: "dsh-pet-cfg__file",
            type: "file",
            accept: "image/png,image/jpeg,image/webp,image/gif",
            disabled: props.avatarBusy || props.busy,
            "aria-label": t("avatarUpload"),
            onChange: (e) => {
              const file = e.target.files?.[0];
              if (file !== void 0) props.onAvatar?.(file);
              e.target.value = "";
            }
          })
        ]
      })
    });
  };
}
function makePetIdentityFields(rt) {
  const { h, t } = rt;
  const { field } = makeUiKit({ h, t });
  const Select = makeSelect(rt);
  const sizeInput = (value, disabled, setter) => h("input", numberInputProps(value, setter, { step: "10", min: "120", disabled }));
  const percentInput = (value, disabled, setter) => h("input", numberInputProps(value, setter, { min: String(SIZE_PERCENT_MIN), step: "1", disabled }));
  const cells = (props) => {
    const { pet, busy, onChange } = props;
    return [
      field(
        t("nameLabel"),
        h("input", {
          type: "text",
          className: INPUT_CLASS,
          value: String(pet.name ?? ""),
          disabled: busy,
          maxLength: 50,
          onChange: (e) => onChange({ name: e.target.value })
        }),
        t("nameHint")
      ),
      field(
        t("sizeLabel"),
        sizeInput(pet.size, busy, (v) => onChange({ size: v })),
        t("sizeHint")
      ),
      field(
        t("sizePercentLabel"),
        percentInput(pet.sizePercent ?? SIZE_PERCENT_DEFAULT, busy, (v) => onChange({ sizePercent: v })),
        t("sizePercentHint")
      ),
      field(
        t("displayLabel"),
        h(Select, {
          label: t("displayLabel"),
          value: pet.display,
          options: PET_DISPLAYS.map((d) => ({ id: d, label: t("display." + d) })),
          disabled: busy,
          onChange: (id) => onChange({ display: id })
        }),
        t("displayHint")
      )
    ];
  };
  return function PetIdentityFields(props) {
    return h("div", { className: "dsh-pet-cfg__grid2", children: cells(props) });
  };
}
function makePetPositionFields(rt) {
  const { h, t } = rt;
  const { field } = makeUiKit({ h, t });
  const Select = makeSelect(rt);
  const marginInput = (value, disabled, setter) => h("input", numberInputProps(value, setter, { step: "1", min: "", disabled }));
  return function PetPositionFields(props) {
    const { pet, busy, onChange } = props;
    return h("div", {
      className: "dsh-pet-cfg__grid3",
      children: [
        field(
          t("cornerLabel"),
          h(Select, {
            label: t("cornerLabel"),
            value: pet.position.corner,
            options: CORNERS.map((c) => ({ id: c, label: t("corner." + c) })),
            disabled: busy,
            onChange: (id) => onChange({ position: { corner: id } })
          }),
          t("cornerHint")
        ),
        field(
          t("marginX"),
          marginInput(pet.position.marginX, busy, (v) => onChange({ position: { marginX: v } })),
          t("marginXHint")
        ),
        field(
          t("marginY"),
          marginInput(pet.position.marginY, busy, (v) => onChange({ position: { marginY: v } })),
          t("marginYHint")
        )
      ]
    });
  };
}

// vendor/dsh-pet/src/client/settings/pet-card.ts
function makePetCard(rt) {
  const { h, t } = rt;
  const { tip, q, field, toggleCell } = makeUiKit({ h, t });
  const AvatarCell = makePetAvatarCell(rt);
  const IdentityFields = makePetIdentityFields(rt);
  const PositionFields = makePetPositionFields(rt);
  return function PetCard(props) {
    const { pet, busy, msg } = props;
    if (pet === null) return h("p", { className: "dsh-pet-cfg__note", children: t("emptyPets") });
    return h("div", {
      className: "dsh-pet-cfg__card",
      children: [
        h("div", {
          className: "dsh-pet-cfg__cardHead",
          children: [
            h("span", { key: "t", className: "dsh-pet-cfg__cardTitle", children: t("petCardTitle") }),
            q(t("petCardHint")),
            // 右侧动作组：auto margin 挂在这层 wrapper 上，保存结果出现 / 消失时按钮位置不会跳。
            h("div", {
              key: "acts",
              style: { marginLeft: "auto", display: "flex", alignItems: "center", gap: "6px" },
              children: [
                // 保存结果就近反馈（与页面底部同一份 msg 状态），否则在卡片上点保存看不到结果。
                msg.text ? h("span", {
                  key: "msg",
                  className: "dsh-pet-cfg__msg" + (msg.kind === "err" ? " is-err" : ""),
                  children: msg.text
                }) : null,
                // 就近保存：宠物这一块改完就地存盘，不必滚到底部的「保存」；悬浮按钮即出快捷键气泡。
                h("button", {
                  key: "sv",
                  type: "button",
                  onClick: props.onSave,
                  disabled: busy,
                  className: "dsh-pet-cfg__btn is-primary is-sm",
                  ...tip(t("saveHotkey")),
                  children: t("save")
                }),
                h("button", {
                  key: "rm",
                  type: "button",
                  onClick: props.onRemove,
                  disabled: busy,
                  className: "dsh-pet-cfg__btn is-danger is-sm",
                  children: t("remove")
                })
              ]
            })
          ]
        }),
        // 顶部一行：头像作左列，右侧是 2×2 的输入网格。
        h("div", {
          className: "dsh-pet-cfg__topRow",
          children: [
            h(AvatarCell, {
              avatarSrc: props.avatarSrc,
              avatarBusy: props.avatarBusy,
              busy,
              onAvatar: props.onAvatar
            }),
            h(IdentityFields, { pet, busy, onChange: props.onChange })
          ]
        }),
        h(PositionFields, { pet, busy, onChange: props.onChange }),
        h("div", {
          className: "dsh-pet-cfg__grid4",
          children: [
            toggleCell("balanceEnabled", !!pet.balanceEnabled, busy, (v) => props.onChange({ balanceEnabled: v })),
            toggleCell("whisperEnabled", !!pet.whisperEnabled, busy, (v) => props.onChange({ whisperEnabled: v })),
            toggleCell(
              "workStatusEnabled",
              !!pet.workStatusEnabled,
              busy,
              (v) => props.onChange({ workStatusEnabled: v })
            ),
            toggleCell("fixedEnabled", !!pet.fixedEnabled, busy, (v) => props.onChange({ fixedEnabled: v }))
          ]
        }),
        // 人设（可选，实例级）：写在这只宠物上的 whisperPrompt，空 = 跟随所属条目的人设。
        // 只存储与回显，不在这里拼 system；拼装（名字声明 + 时间背景）在宿主半侧。
        // 占位符直接用条目人设正文，让「跟随的是什么」可见；人设没有长度上限，右下角只显示字数。
        field(
          t("personaLabel"),
          h("div", {
            className: "dsh-pet-cfg__persona",
            children: [
              h("textarea", {
                className: INPUT_CLASS + " dsh-pet-cfg__area",
                rows: 3,
                value: String(pet.whisperPrompt ?? ""),
                disabled: busy,
                placeholder: props.entryPrompt,
                onChange: (e) => props.onChange({ whisperPrompt: e.target.value })
              }),
              h("span", {
                className: "dsh-pet-cfg__count",
                children: t("personaCount").replace("{n}", String(String(pet.whisperPrompt ?? "").length))
              })
            ]
          }),
          t("personaHint")
        )
      ]
    });
  };
}

// vendor/dsh-pet/src/shared/chat/image-pick.ts
var IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];
var IMAGE_ACCEPT = IMAGE_TYPES.join(",");
var IMAGE_EXT = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif"
};
function imageMediaTypeOf(file) {
  const declared = String(file.type || "").toLowerCase();
  if (IMAGE_TYPES.includes(declared)) return declared;
  const ext = String(file.name || "").split(".").pop()?.toLowerCase();
  return ext === void 0 ? void 0 : IMAGE_EXT[ext];
}
function isImageFile(file) {
  return imageMediaTypeOf(file) !== void 0;
}
function dragHasFiles(e) {
  const types = e.dataTransfer?.types;
  if (!types) return false;
  return Array.from(types).includes("Files");
}
function firstImageFile(dataTransfer) {
  const files = dataTransfer?.files;
  if (!files) return void 0;
  for (const file of Array.from(files)) {
    if (isImageFile(file)) return file;
  }
  return void 0;
}
function firstImageFromClipboard(data) {
  if (!data) return void 0;
  const files = data.files;
  if (files) {
    for (const file of Array.from(files)) {
      if (isImageFile(file)) return file;
    }
  }
  const items = data.items;
  if (!items) return void 0;
  for (const item of Array.from(items)) {
    if (item.kind !== "file") continue;
    const file = item.getAsFile();
    if (file && isImageFile(file)) return file;
  }
  return void 0;
}

// vendor/dsh-pet/src/shared/chat/encode.ts
var IMAGE_MAX_BYTES = 640 * 1024;
var IMAGE_MAX_SIDE = 2048;
var IMAGE_QUALITIES = [0.85, 0.75, 0.65, 0.55];
var PREVIEW_SIDE = 96;
function attachmentBytes(base64) {
  const pad = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
  return Math.floor(base64.length * 3 / 4) - pad;
}
function targetSize(width, height, maxSide = IMAGE_MAX_SIDE) {
  const scale = Math.min(1, maxSide / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}
function loadImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("\u8FD9\u4E2A\u6587\u4EF6\u8BFB\u4E0D\u51FA\u6765"));
    reader.onload = () => {
      const url = typeof reader.result === "string" ? reader.result : "";
      if (!url) {
        reject(new Error("\u8FD9\u4E2A\u6587\u4EF6\u8BFB\u4E0D\u51FA\u6765"));
        return;
      }
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("\u8FD9\u4E2A\u6587\u4EF6\u89E3\u4E0D\u51FA\u56FE\u7247"));
      img.src = url;
    };
    reader.readAsDataURL(file);
  });
}
function bytesToBase64(bytes) {
  let bin = "";
  const CHUNK = 32768;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
  }
  return btoa(bin);
}
function drawToCanvas(source, size) {
  const canvas = document.createElement("canvas");
  canvas.width = size.width;
  canvas.height = size.height;
  canvas.getContext("2d")?.drawImage(source, 0, 0, size.width, size.height);
  return canvas;
}
function previewOf(source, width, height) {
  return drawToCanvas(source, targetSize(width, height, PREVIEW_SIDE)).toDataURL("image/jpeg", 0.72);
}
function encodeCanvas(canvas) {
  const { width, height } = canvas;
  const previewUrl = previewOf(canvas, width, height);
  const floor = IMAGE_QUALITIES[IMAGE_QUALITIES.length - 1];
  for (const quality of IMAGE_QUALITIES) {
    const dataUrl = canvas.toDataURL("image/jpeg", quality);
    const base64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
    const bytes = attachmentBytes(base64);
    if (bytes <= IMAGE_MAX_BYTES || quality === floor) {
      return { base64, mediaType: "image/jpeg", bytes, width, height, resized: true, previewUrl };
    }
  }
  throw new Error("\u65E0\u6CD5\u538B\u5230\u9884\u7B97\u5185");
}

// vendor/dsh-pet/src/client/settings/avatar-upload.ts
var AVATAR_MAX_SIDE_PX = 512;
async function encodeAvatarFile(file) {
  const img = await loadImage(file);
  const width = img.naturalWidth || img.width;
  const height = img.naturalHeight || img.height;
  if (Math.max(width, height) <= AVATAR_MAX_SIDE_PX) {
    return { base64: bytesToBase64(new Uint8Array(await file.arrayBuffer())), mediaType: file.type || "image/png" };
  }
  const scale = AVATAR_MAX_SIDE_PX / Math.max(width, height);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const ctx = canvas.getContext("2d");
  if (ctx === null) throw new Error("\u6D4F\u89C8\u5668\u4E0D\u652F\u6301\u7F29\u653E\u8FD9\u5F20\u56FE");
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  const dataUrl = canvas.toDataURL("image/png");
  return { base64: dataUrl.slice(dataUrl.indexOf(",") + 1), mediaType: "image/png" };
}
async function postAvatar(assetRoot, base64, fetchImpl = fetch) {
  const res = await fetchImpl(ROUTE_PATH + "/pet-avatar?root=" + encodeURIComponent(assetRoot), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ base64 })
  });
  const raw = await res.json().catch(() => null);
  if (!res.ok || raw === null) return { ok: false, message: "\u4E0A\u4F20\u5931\u8D25\uFF08HTTP " + res.status + "\uFF09" };
  if (raw.ok !== true) return { ok: false, message: typeof raw.message === "string" ? raw.message : "\u4E0A\u4F20\u5931\u8D25" };
  return { ok: true };
}
async function uploadPetAvatar(assetRoot, file) {
  const { base64 } = await encodeAvatarFile(file);
  return postAvatar(assetRoot, base64);
}

// vendor/dsh-pet/src/client/settings/pet-tabs.ts
function makePetTabs(rt) {
  const { h, t } = rt;
  return function PetTabs(props) {
    return h("div", {
      className: "dsh-pet-cfg__tabs",
      children: [
        h("span", { key: "label", className: "dsh-pet-cfg__tabsLabel", children: t("petsLabel") }),
        ...props.pets.map(
          (pet) => h("button", {
            key: pet.id,
            type: "button",
            onClick: () => props.onSelect(pet.id),
            className: "dsh-pet-cfg__tab" + (pet.id === props.selId ? " is-active" : ""),
            children: (pet.name || pet.id) + " (" + pet.size + "px" + (pet.sizePercent === void 0 || pet.sizePercent >= 100 ? "" : " / " + pet.sizePercent + "%") + ")"
          })
        ),
        h("button", {
          key: "add",
          type: "button",
          onClick: props.onAdd,
          disabled: props.busy,
          className: "dsh-pet-cfg__tab is-ghost",
          children: "+ " + t("add")
        })
      ]
    });
  };
}

// vendor/dsh-pet/src/client/settings/physics-card.ts
function makePhysicsCard(rt) {
  const { h, t } = rt;
  const { cardHead, field, toggleCell } = makeUiKit({ h, t });
  return function PhysicsCard(props) {
    const { busy, physics } = props;
    const physField = (key, step, min) => field(
      t("physics." + key),
      h(
        "input",
        numberInputProps(physics[key], (v) => props.onChange({ [key]: v }), { step, min, disabled: busy })
      ),
      t("physics." + key + "Hint")
    );
    return h("div", {
      className: "dsh-pet-cfg__card",
      children: [
        cardHead(t("physicsTitle"), t("physicsHint")),
        h("div", {
          className: "dsh-pet-cfg__grid4",
          children: [
            physField("gravity", "50", "0"),
            physField("restitution", "0.01", "0"),
            physField("groundFriction", "0.1", "0"),
            physField("throwPower", "0.05", "0.05")
          ]
        }),
        h("div", {
          className: "dsh-pet-cfg__grid2",
          children: [
            toggleCell(
              "physicsCeilingBounce",
              physics.ceilingBounce,
              busy,
              (v) => props.onChange({ ceilingBounce: v })
            ),
            toggleCell("physicsPetCollision", physics.petCollision, busy, (v) => props.onChange({ petCollision: v }))
          ]
        })
      ]
    });
  };
}

// vendor/dsh-pet/src/shared/chat/hear-hold.ts
var HEAR_KEY = "m";
var HEAR_HOTKEY_HINT = "M \u952E";
function isHearHotkey(e) {
  return isBareKey(e, HEAR_KEY);
}
function createHearHold(hooks) {
  let holding = false;
  const sameKey = (key) => String(key).toLowerCase() === HEAR_KEY;
  const release = () => {
    if (!holding) return;
    holding = false;
    hooks.onRelease();
  };
  return {
    onKeyDown(e) {
      if (holding) return sameKey(e.key);
      if (e.repeat === true || !isHearHotkey(e) || !hooks.isArmed()) return false;
      holding = true;
      hooks.onPress();
      return true;
    },
    onKeyUp(e) {
      if (sameKey(e.key)) release();
    },
    release
  };
}

// vendor/dsh-pet/src/shared/chat/hotkey.ts
var CHAT_HOTKEY_HINT = "L \u952E";
var CAPTURE_HOTKEY_HINT = "S \u952E";
function isChatHotkey(e) {
  return isBareKey(e, "l");
}
function isCaptureHotkey(e) {
  return isBareKey(e, "s");
}

// vendor/dsh-pet/src/shared/sleep-hotkey.ts
var SLEEP_HOTKEY_HINT = "Z \u952E";
function isSleepHotkey(e) {
  return isBareKey(e, "z");
}

// vendor/dsh-pet/src/shared/todo/hotkey.ts
var TODO_HOTKEY_HINT = "D \u952E";
function isTodoHotkey(e) {
  return isBareKey(e, "d");
}

// vendor/dsh-pet/src/client/app-shortcut.ts
var MODIFIER_LABELS = {
  alt: "Alt",
  control: "Ctrl",
  meta: "Cmd",
  shift: "Shift"
};
function keycapOf(binding) {
  const isMac = /Mac/i.test(navigator.platform || navigator.userAgent);
  const modifiers = binding.modifiers.map(
    (modifier) => modifier === "primary" ? isMac ? "Cmd" : "Ctrl" : MODIFIER_LABELS[modifier] ?? modifier
  );
  return [...modifiers, binding.code.replace(/^Key/, "")].join("+");
}
function readShortcutKeycap(ctx, id) {
  const catalog = ctx.get?.("shortcuts")?.catalog;
  if (catalog === void 0) return void 0;
  const row = catalog.getSnapshot().find((item) => item.id === id);
  return row === void 0 || row.keys.length === 0 ? void 0 : row.keys.join("");
}
function subscribeShortcutKeycaps(ctx, listener) {
  const catalog = ctx.get?.("shortcuts")?.catalog;
  if (catalog === void 0) return () => {
  };
  return catalog.subscribe(listener);
}

// vendor/dsh-pet/src/client/chat/shortcut.ts
var PET_CHAT_COMMAND_ID = "pet-chat.open";
var BINDING = { code: "KeyP", modifiers: ["primary", "shift"] };
function petChatShortcutKeycap(ctx) {
  return readShortcutKeycap(ctx, PET_CHAT_COMMAND_ID) ?? keycapOf(BINDING);
}

// vendor/dsh-pet/src/client/pet/card/registry.ts
var handles = /* @__PURE__ */ new Map();
function registerPetChatHandle(id, handle) {
  handles.set(id, handle);
  return () => {
    if (handles.get(id) === handle) handles.delete(id);
  };
}

// vendor/dsh-pet/src/client/pet/card/shortcut.ts
var PET_FLOAT_COMMAND_ID = "pet-chat.float";
var PET_HEAR_COMMAND_ID = "pet-chat.hear";
var PET_CAPTURE_COMMAND_ID = "pet-chat.capture";
var FLOAT_BINDING = { code: "KeyL", modifiers: ["primary", "shift"] };
var HEAR_BINDING = { code: "KeyM", modifiers: ["primary", "shift"] };
var CAPTURE_BINDING = { code: "KeyS", modifiers: ["primary", "shift"] };
var COMMANDS = {
  chat: { id: PET_FLOAT_COMMAND_ID, binding: FLOAT_BINDING },
  hear: { id: PET_HEAR_COMMAND_ID, binding: HEAR_BINDING },
  capture: { id: PET_CAPTURE_COMMAND_ID, binding: CAPTURE_BINDING }
};
function petShortcutKeycap(ctx, key) {
  const command = COMMANDS[key];
  return readShortcutKeycap(ctx, command.id) ?? keycapOf(command.binding);
}

// vendor/dsh-pet/src/client/settings/shortcuts-card.ts
var BODY_ID2 = "pet-cfg-shortcuts";
var PASTE_KEYCAP = keycapOf({ code: "KeyV", modifiers: ["primary"] });
function readKeycaps(ctx) {
  return {
    open: petShortcutKeycap(ctx, "chat"),
    hear: petShortcutKeycap(ctx, "hear"),
    capture: petShortcutKeycap(ctx, "capture"),
    sidebar: petChatShortcutKeycap(ctx)
  };
}
function makeShortcutsCard(rt, ctx) {
  const { h, t, useState, useEffect } = rt;
  const { foldCard } = makeUiKit({ h, t });
  return function ShortcutsCard() {
    const [open, setOpen] = useState(false);
    const [keycaps, setKeycaps] = useState(readKeycaps(ctx));
    useEffect(() => subscribeShortcutKeycaps(ctx, () => setKeycaps(readKeycaps(ctx))), []);
    const row = (label, keys) => h("div", {
      className: "dsh-pet-cfg__field",
      children: [
        h("span", { key: "l", className: "dsh-pet-cfg__flabel", children: t(label) }),
        h("span", { key: "v", className: "dsh-pet-cfg__note", children: keys })
      ]
    });
    return foldCard({
      id: BODY_ID2,
      title: t("shortcutCardTitle"),
      hint: t("shortcutCardHint"),
      body: [
        h("p", { key: "petTitle", className: "dsh-pet-cfg__cardTitle", children: t("shortcutGroupPet") }),
        h("p", { key: "petHint", className: "dsh-pet-cfg__note", children: t("shortcutGroupPetHint") }),
        h("div", {
          key: "petRows",
          className: "dsh-pet-cfg__grid2",
          children: [
            row("shortcutRowChat", CHAT_HOTKEY_HINT),
            row("shortcutRowHold", HEAR_HOTKEY_HINT),
            row("shortcutRowCapture", CAPTURE_HOTKEY_HINT),
            row("shortcutRowPaste", PASTE_KEYCAP),
            row("shortcutRowTodo", TODO_HOTKEY_HINT),
            row("shortcutRowSleep", SLEEP_HOTKEY_HINT),
            row("shortcutRowDisplay", DISPLAY_HOTKEY_HINTS.join(" \xB7 "))
          ]
        }),
        h("p", { key: "globalTitle", className: "dsh-pet-cfg__cardTitle", children: t("shortcutGroupGlobal") }),
        h("p", { key: "globalHint", className: "dsh-pet-cfg__note", children: t("shortcutGroupGlobalHint") }),
        h("div", {
          key: "globalRows",
          className: "dsh-pet-cfg__grid2",
          children: [
            row("shortcutRowChat", keycaps.open),
            row("shortcutRowHear", keycaps.hear),
            row("shortcutRowCapture", keycaps.capture),
            row("shortcutRowSidebar", keycaps.sidebar)
          ]
        })
      ],
      open,
      onToggle: () => setOpen(!open)
    });
  };
}

// vendor/dsh-pet/src/client/settings/tip-layer.ts
var TIP_CLASS = "pet-cfg-tip";
var TIP_ATTR = "data-tip";
var TIP_GAP_PX = 10;
var bubble;
var current;
var detach;
function hideTip() {
  bubble?.classList.remove("is-on");
  current = void 0;
}
function ensureTip() {
  if (bubble !== void 0 && bubble.parentNode === document.body) return bubble;
  const el = document.createElement("div");
  el.setAttribute("class", TIP_CLASS);
  el.setAttribute("role", "tooltip");
  document.body.appendChild(el);
  bubble = el;
  return el;
}
function triggerOf(node) {
  const host = node;
  if (host === null || typeof host.closest !== "function") return void 0;
  return host.closest("[" + TIP_ATTR + "]") ?? void 0;
}
function showTip(text, cursor) {
  const el = ensureTip();
  el.textContent = text;
  el.style.left = "0px";
  el.style.top = "0px";
  const placed = tooltipPlacement(
    cursor,
    { w: el.offsetWidth, h: el.offsetHeight },
    { x: 0, y: 0, w: window.innerWidth, h: window.innerHeight },
    TIP_GAP_PX
  );
  el.style.left = placed.x + "px";
  el.style.top = placed.y + "px";
  el.classList.add("is-on");
}
function onOver(event) {
  const trigger = triggerOf(event.target);
  if (trigger === void 0 || trigger === current) return;
  const text = trigger.getAttribute(TIP_ATTR);
  if (text === null || text === "") return;
  showTip(text, { x: event.clientX, y: event.clientY });
  current = trigger;
}
function onOut(event) {
  const from = triggerOf(event.target);
  if (from === void 0) return;
  if (triggerOf(event.relatedTarget ?? null) === from) return;
  hideTip();
}
function attachTipLayer() {
  if (detach !== void 0) return detach;
  const root = document;
  root.addEventListener("pointerover", onOver);
  root.addEventListener("pointerout", onOut);
  root.addEventListener("pointerdown", hideTip);
  root.addEventListener("scroll", hideTip, true);
  detach = () => {
    root.removeEventListener("pointerover", onOver);
    root.removeEventListener("pointerout", onOut);
    root.removeEventListener("pointerdown", hideTip);
    root.removeEventListener("scroll", hideTip, true);
    bubble?.remove();
    bubble = void 0;
    current = void 0;
    detach = void 0;
  };
  return detach;
}

// vendor/dsh-pet/src/client/settings/pet-draft.ts
function nextPetId(list, kind = "main") {
  const prefix = kind === "main" ? "pet" : kind;
  for (let n = 2; ; n += 1) {
    const id = prefix + "-" + n;
    if (!list.some((pet) => pet.id === id)) return id;
  }
}
function draftPet(template, id) {
  return {
    id,
    name: id,
    size: template.size,
    sizePercent: template.sizePercent ?? SIZE_PERCENT_DEFAULT,
    balanceEnabled: template.balanceEnabled,
    whisperEnabled: template.whisperEnabled,
    workStatusEnabled: template.workStatusEnabled,
    fixedEnabled: template.fixedEnabled,
    display: template.display,
    position: { ...template.position }
  };
}

// vendor/dsh-pet/src/client/settings/use-pet-list.ts
function petKinds(pets) {
  const order = [];
  const counts = /* @__PURE__ */ new Map();
  for (const pet of pets) {
    const entry = pet.assetRoot ?? "main";
    if (!counts.has(entry)) order.push(entry);
    counts.set(entry, (counts.get(entry) ?? 0) + 1);
  }
  return order.map((entry) => ({
    entry,
    kind: entry === "main" ? "main" : "pack",
    count: counts.get(entry) ?? 0
  }));
}
function mainPetsOf(pets) {
  return pets.filter((pet) => (pet.assetRoot ?? "main") === "main");
}
function usePetList(rt, requestDialog) {
  const { useState, useCallback, useRef } = rt;
  const initial = petBridge.current;
  const [pets, setPets] = useState(initial.map((pet) => ({ ...pet, position: { ...pet.position } })));
  const [kind, setKind] = useState(initial[0]?.assetRoot ?? "main");
  const [selId, setSelId] = useState(initial[0]?.id ?? "");
  const loadedRef = useRef([]);
  const kindRef = useRef(kind);
  kindRef.current = kind;
  const update = (patch) => setPets(
    (list) => list.map((pet) => {
      if (pet.id !== selId) return pet;
      const { position: posPatch, ...rest } = patch;
      return { ...pet, ...rest, position: posPatch ? { ...pet.position, ...posPatch } : pet.position };
    })
  );
  const add = () => {
    const group = pets.filter((pet) => (pet.assetRoot ?? "main") === kind);
    const template = group[0];
    if (!template) return;
    const id = nextPetId(pets, kind);
    const draft = { ...draftPet(template, id), assetRoot: kind };
    setPets((list) => {
      const next = [...list];
      let at = -1;
      for (let i = 0; i < next.length; i += 1) if ((next[i].assetRoot ?? "main") === kind) at = i;
      next.splice(at + 1, 0, draft);
      return next;
    });
    setSelId(id);
  };
  const remove = () => {
    const list = pets.filter((pet) => pet.id !== selId);
    setPets(list);
    setSelId(list[0]?.id ?? "");
  };
  const replace = useCallback((entries) => {
    loadedRef.current = entries;
    const loaded = entries.flatMap((entry) => entry.pets);
    const nextKind = entries.some((entry) => entry.key === kindRef.current) ? kindRef.current : entries[0]?.key ?? "main";
    setPets(loaded);
    setKind(nextKind);
    setSelId((id) => {
      if (loaded.some((pet) => pet.id === id)) return id;
      return loaded.find((pet) => (pet.assetRoot ?? "main") === nextKind)?.id ?? "";
    });
  }, []);
  const selectKind = (entry) => {
    setKind(entry);
    const first = pets.find((pet) => (pet.assetRoot ?? "main") === entry);
    if (first) setSelId(first.id);
  };
  const current2 = pets.find((pet) => pet.id === selId);
  const entryPrompt = loadedRef.current.find((item) => item.key === kind)?.entryPrompt ?? "";
  const requestRemove = () => {
    if (!current2) return;
    const entry = current2.assetRoot ?? "main";
    const groupSize = pets.filter((pet) => (pet.assetRoot ?? "main") === entry).length;
    if (groupSize <= 1) requestDialog(entry === "main" ? { kind: "lastOne" } : { kind: "lastOfKind", entry });
    else requestDialog({ kind: "remove" });
  };
  return {
    pets,
    mainPets: mainPetsOf(pets),
    kinds: petKinds(pets),
    kind,
    visiblePets: pets.filter((pet) => (pet.assetRoot ?? "main") === kind),
    selId,
    entryPrompt,
    select: setSelId,
    selectKind,
    update,
    add,
    requestRemove,
    remove,
    replace,
    packWrites: () => diffPackWrites(loadedRef.current, pets)
  };
}

// vendor/dsh-pet/src/client/settings/use-remote-data.ts
function useRemoteData(rt) {
  const { useState, useEffect } = rt;
  const [paths, setPaths] = useState(null);
  const [catalog, setCatalog] = useState(null);
  const [catalogFailed, setCatalogFailed] = useState(false);
  useEffect(() => {
    let alive = true;
    void loadMeta().then((meta) => {
      if (alive) setPaths(meta);
    });
    return () => {
      alive = false;
    };
  }, []);
  useEffect(() => {
    let alive = true;
    void loadModelCatalog().then((groups) => {
      if (!alive) return;
      if (groups === null) setCatalogFailed(true);
      else setCatalog(groups);
    });
    return () => {
      alive = false;
    };
  }, []);
  return { paths, catalog, catalogFailed };
}

// vendor/dsh-pet/src/client/settings/voice-card.ts
function makeVoiceCard(rt, picker) {
  const { h, t } = rt;
  const { cardHead, field, toggleCell } = makeUiKit({ h, t });
  return function VoiceCard(props) {
    return h("div", {
      className: "dsh-pet-cfg__card",
      children: [
        cardHead(t("voiceTitle"), t("voiceHint")),
        // 第一行三个开关：总开关与两个子项必须相邻，读得出是「同一类」；第二行两个输入：音色与音量。
        // 音色不挂文字标签也不挂问号：下拉当前值「晓伊（女·活泼）」自己就说明了它是什么。
        h("div", {
          className: "dsh-pet-cfg__grid3",
          children: [
            toggleCell("voiceEnabled", props.enabled, props.busy, props.onToggle),
            toggleCell("voiceWhisperEnabled", props.whisperEnabled, props.busy, props.onWhisperToggle),
            toggleCell("voiceTodoEnabled", props.todoEnabled, props.busy, props.onTodoToggle)
          ]
        }),
        h("div", {
          className: "dsh-pet-cfg__grid2",
          children: [
            h(picker, {
              label: t("voiceNameLabel"),
              value: props.voiceName,
              options: props.voices,
              disabled: props.busy,
              onChange: props.onVoiceChange
            }),
            field(
              t("voiceVolumeLabel"),
              h(
                "input",
                numberInputProps(props.volume, props.onVolumeChange, {
                  step: "0.05",
                  min: "0",
                  max: "1",
                  disabled: props.busy
                })
              ),
              t("voiceVolumeHint")
            )
          ]
        })
      ]
    });
  };
}

// vendor/dsh-pet/src/client/settings/locales/zh.ts
var zh = {
  nav: "\u684C\u5BA0\u914D\u7F6E",
  intro: "\u7BA1\u7406\u591A\u4E2A\u684C\u5BA0\uFF1A\u6BCF\u4E2A\u5BA0\u7269\u53EF\u72EC\u7ACB\u8BBE\u7F6E\u5927\u5C0F\u4E0E\u4F4D\u7F6E\uFF08\u4FDD\u5B58\u540E\u5373\u65F6\u751F\u6548\uFF09\u3002",
  // 卡片标题与卡片级说明；说明统一进问号气泡。
  petCardTitle: "\u5BA0\u7269\u914D\u7F6E",
  avatarLabel: "\u5934\u50CF",
  avatarHint: "\u5BF9\u8BDD\u9762\u677F\u91CC\u8FD9\u6761\u5BA0\u7269\u6D88\u606F\u65C1\u8FB9\u663E\u793A\u7684\u5C0F\u56FE\u3002\u6CA1\u4E0A\u4F20\u8FC7\u5C31\u662F\u63D2\u4EF6\u9ED8\u8BA4\u56FE\uFF1B\u4E0A\u4F20\u540E\u7ACB\u5373\u751F\u6548\u5E76\u8986\u76D6\u65E7\u56FE\uFF0C\u4E0D\u9700\u8981\u70B9\u300C\u4FDD\u5B58\u300D\u3002",
  avatarUpload: "\u4E0A\u4F20\u5934\u50CF",
  avatarChange: "\u66F4\u6362",
  avatarUploading: "\u4E0A\u4F20\u4E2D\u2026",
  avatarUploaded: "\u5934\u50CF\u5DF2\u66F4\u65B0",
  petCardHint: "\u6BCF\u53EA\u5BA0\u7269\u72EC\u7ACB\u914D\u7F6E\uFF1A\u540D\u5B57 / \u5927\u5C0F / \u663E\u793A\u4F4D\u7F6E / \u4F4D\u7F6E / \u504F\u79FB / \u56DB\u4E2A\u529F\u80FD\u5F00\u5173\u3002\u6539\u5B8C\u70B9\u6700\u4E0B\u9762\u7684\u300C\u4FDD\u5B58\u300D\u5373\u65F6\u751F\u6548\u3002",
  globalTitle: "\u5168\u5C40\u5F00\u5173",
  globalHint: "\u6240\u6709\u5BA0\u7269\u5171\u7528\uFF08pet pack \u53EF\u5728\u81EA\u5DF1\u79CD\u7C7B\u6587\u4EF6\u91CC\u5355\u72EC\u8986\u76D6\uFF09\u3002\u8FD9\u51E0\u4E2A\u5F00\u5173\u53EA\u6539\u672C\u5730\u72B6\u6001\uFF0C\u968F\u300C\u4FDD\u5B58\u300D\u6574\u5305\u5199\u5165\u7528\u6237\u914D\u7F6E\uFF08\u4E0D\u505A\u5373\u65F6\u5199\u5165\uFF09\uFF1B\u7CFB\u7EDF\u901A\u77E5\u5728\u4FDD\u5B58\u540E\u5373\u65F6\u91CD\u8BFB\uFF0C\u65E0\u9700\u5237\u65B0\u9875\u9762\u3002",
  cornerHint: "\u5BA0\u7269\u8D34\u7740\u5C4F\u5E55\u7684\u54EA\u4E2A\u89D2\uFF08\u684C\u9762\u7AEF\u6309\u5404\u81EA\u663E\u793A\u5668\u7684\u5DE5\u4F5C\u533A\u7B97\uFF09\u3002",
  marginXHint: "\u8DDD\u6240\u9009\u89D2\u843D\u7684\u6C34\u5E73\u8DDD\u79BB\uFF08px\uFF09\uFF0C\u53EF\u4E3A\u4EFB\u610F\u6570\u5B57\u3002",
  marginYHint: "\u8DDD\u6240\u9009\u89D2\u843D\u7684\u5782\u76F4\u8DDD\u79BB\uFF08px\uFF09\uFF0C\u53EF\u4E3A\u4EFB\u610F\u6570\u5B57\u3002",
  // 「/」命令菜单的行标题（图标由 app.ts 经 command-faces.ts 补上）。
  "cmd.chat": "\u5BF9\u8BDD",
  "cmd.pet": "\u684C\u5BA0",
  "cmd.balance": "\u4F59\u989D",
  // 设置 → 通用 → 快捷键里的命令标题。
  "shortcut.open": "\u6253\u5F00\u684C\u5BA0\u5BF9\u8BDD",
  "shortcut.chat": "\u6253\u5F00\u5BF9\u8BDD\u5F39\u7A97",
  "shortcut.hear": "\u8BED\u97F3\u8F93\u5165",
  "shortcut.capture": "\u622A\u56FE\u5230\u5BF9\u8BDD",
  shortcutCardTitle: "\u5FEB\u6377\u952E",
  shortcutCardHint: "\u5C55\u5F00\u540E\u5206\u4E24\u7EC4\uFF1A\u684C\u5BA0\u5FEB\u6377\u952E\u4E0E\u5168\u5C40\u5FEB\u6377\u952E\u3002",
  shortcutRowChat: "\u6253\u5F00\u5BF9\u8BDD",
  shortcutRowHold: "\u6309\u4F4F\u8BF4\u8BDD",
  shortcutRowHear: "\u8BED\u97F3\u8F93\u5165",
  shortcutRowCapture: "\u622A\u56FE",
  shortcutRowPaste: "\u7C98\u8D34\u56FE\u7247",
  shortcutRowTodo: "\u5F85\u529E\u4E8B\u9879",
  shortcutRowSleep: "\u7761\u89C9 / \u8D77\u6765",
  shortcutRowDisplay: "\u663E\u793A\u4F4D\u7F6E",
  shortcutRowSidebar: "\u6253\u5F00\u4FA7\u680F\u5BF9\u8BDD",
  shortcutGroupPet: "\u684C\u5BA0\u5FEB\u6377\u952E",
  shortcutGroupPetHint: "\u7F51\u9875\u7AEF\u9F20\u6807\u505C\u5728\u5BA0\u7269\u4E0A\u5373\u53EF\uFF1B\u684C\u9762\u5BA0\u7269\u7A97\u53E3\u8981\u5148\u70B9\u4E00\u4E0B\u5BA0\u7269\uFF0C\u62FF\u5230\u952E\u76D8\u7126\u70B9\u540E\u624D\u751F\u6548\u3002",
  shortcutGroupGlobal: "\u5168\u5C40\u5FEB\u6377\u952E",
  shortcutGroupGlobalHint: "\u7F51\u9875\u7AEF\u4E0E\u684C\u9762\u7248\u7A97\u53E3\u91CC\u7531 DSH \u5206\u53D1\uFF1B\u53EF\u5728\u300C\u8BBE\u7F6E \u2192 \u901A\u7528 \u2192 \u5FEB\u6377\u952E\u300D\u6539\u7ED1\u3002",
  petsLabel: "\u5BA0\u7269\u5217\u8868",
  add: "\u6DFB\u52A0\u5BA0\u7269",
  remove: "\u5220\u9664",
  confirmRemove: "\u786E\u5B9A\u5220\u9664\u5BA0\u7269\u300C{id}\u300D\u5417\uFF1F",
  confirmTitle: "\u786E\u8BA4\u64CD\u4F5C",
  cancel: "\u53D6\u6D88",
  ok: "\u77E5\u9053\u4E86",
  atLeastOne: "\u81F3\u5C11\u4FDD\u7559\u4E00\u4E2A\u5BA0\u7269\u3002",
  emptyPets: "\u6682\u65E0\u5BA0\u7269\uFF0C\u70B9\u51FB\u300C\u6DFB\u52A0\u5BA0\u7269\u300D\u521B\u5EFA\u3002",
  sizeLabel: "\u5927\u5C0F\uFF08\u5BBD\u5EA6 px\uFF09",
  sizeHint: "\u9AD8\u5EA6\u81EA\u52A8 = \u5BBD\u5EA6 \xD7 9/16\u3002",
  sizePercentLabel: "\u5C4F\u5E55\u5BBD\u5EA6\u4E0A\u9650\uFF08%\uFF09",
  sizePercentHint: "\u684C\u5BA0\u6700\u591A\u5360\u5C4F\u5E55\u591A\u5BBD\uFF1A100 = \u4E0D\u8D85\u8FC7\u4E00\u5C4F\u5BBD\uFF0C\u7A97\u53E3\u6BD4\u5BA0\u7269\u5BBD\u65F6\u4E0E\u6309 px \u663E\u793A\u5B8C\u5168\u4E00\u81F4\uFF1B\u586B 30\u201340 \u53EF\u8BA9\u624B\u673A\u7AD6\u5C4F\u660E\u663E\u53D8\u5C0F\uFF0C\u684C\u9762\u89C2\u611F\u4E0D\u53D8\u3002\u53EA\u5728\u9875\u9762\u52A0\u8F7D\u65F6\u8BA1\u7B97\u4E00\u6B21\uFF0C\u6539\u7A97\u53E3\u5927\u5C0F\u540E\u5237\u65B0\u751F\u6548\u3002",
  nameLabel: "\u540D\u5B57",
  nameHint: "\u663E\u793A\u540D\uFF1A\u9F20\u6807\u60AC\u6D6E\u5BA0\u7269\u65F6\u5F39\u51FA\uFF0C\u4E5F\u4F1A\u52A0\u8FDB AI \u4EBA\u8BBE\uFF08\u4F60\u7684\u540D\u5B57\u662F X\uFF09\u3002\u53EF\u91CD\u590D\uFF0C\u7559\u7A7A\u6309\u5BA0\u7269 id \u5904\u7406\u3002",
  personaLabel: "\u4EBA\u8BBE\uFF08\u53EF\u9009\uFF09",
  personaHint: "\u53EA\u5F71\u54CD\u8FD9\u53EA\u5BA0\u7269\u3002\u7559\u7A7A = \u8DDF\u968F\u6240\u5C5E\u6761\u76EE\u7684\u4EBA\u8BBE\u2014\u2014\u8F93\u5165\u6846\u91CC\u7684\u7070\u8272\u6587\u5B57\u5C31\u662F\u90A3\u4EFD\u5185\u5BB9\u3002\u5B9E\u9645\u53D1\u7ED9\u6A21\u578B\u7684 system = \u8FD9\u6BB5 + \u81EA\u52A8\u8FFD\u52A0\u7684\u300C\u4F60\u7684\u540D\u5B57\u662F\u201C<\u540D\u5B57>\u201D\u300D+ \u5F53\u524D\u65F6\u95F4\u80CC\u666F\uFF0C\u6240\u4EE5\u522B\u5728\u8FD9\u91CC\u518D\u5199\u540D\u5B57\u548C\u65E5\u671F\u3002",
  personaCount: "{n} \u5B57",
  balanceEnabled: "\u4F59\u989D\u529F\u80FD",
  balanceEnabledHint: "\u542F\u7528\u540E\u8BE5\u5BA0\u7269\u89E6\u53D1\u4F59\u989D\u52A8\u753B\u5E76\u663E\u793A\u4F59\u989D\u6C14\u6CE1\u3002",
  whisperEnabled: "\u788E\u788E\u5FF5",
  whisperEnabledHint: "\u542F\u7528\u540E\u8BE5\u5BA0\u7269\u6309\u5468\u671F\u7528 AI \u751F\u6210\u4E00\u53E5\u8BDD\u5E76\u64AD\u788E\u788E\u5FF5\u52A8\u753B\uFF08\u4EBA\u8BBE\u89C1\u4E0B\u65B9\u300C\u4EBA\u8BBE\u300D\u6846\uFF0C\u7559\u7A7A\u8DDF\u968F\u6761\u76EE\uFF09\u3002",
  workStatusEnabled: "\u5DE5\u4F5C\u72B6\u6001\u8054\u52A8",
  workStatusEnabledHint: "\u542F\u7528\u540E\u8BE5\u5BA0\u7269\u8DDF\u968F DSH \u5DE5\u4F5C\u72B6\u6001\uFF1A\u601D\u8003/\u5DE5\u4F5C\u4E2D/\u7B49\u5F85\u786E\u8BA4/\u5B8C\u6210/\u51FA\u9519\u65F6\u81EA\u52A8\u5207\u5BF9\u5E94\u52A8\u753B\u5E76\u5F39\u6C14\u6CE1\uFF08\u52A8\u753B\u6C60\u5728\u914D\u7F6E\u9876\u5C42\uFF0C\u4EC5\u76D1\u542C\u4E0D\u8C03\u7528\u6A21\u578B\uFF09\u3002",
  fixedEnabled: "\u5BA0\u7269\u56FA\u5B9A",
  fixedEnabledHint: "\u542F\u7528\u540E\u968F\u673A\u52A8\u753B\u4E0D\u518D\u8BA9\u5BA0\u7269\u81EA\u5DF1\u8F6C\u5411\u6216\u8D70\u5F00\uFF0C\u53EA\u64AD\u539F\u5730\u5F85\u673A\u4E0E\u968F\u673A\u5C0F\u52A8\u4F5C\uFF1B\u53F3\u952E\u83DC\u5355\u70B9\u64AD\u3001\u63A5\u53E3\u89E6\u53D1\u3001\u4F59\u989D/\u788E\u788E\u5FF5/\u5DE5\u4F5C\u72B6\u6001\u52A8\u753B\u4E0D\u53D7\u5F71\u54CD\u3002",
  displayLabel: "\u663E\u793A\u4F4D\u7F6E",
  displayHint: "web=\u4EC5\u6D4F\u89C8\u5668 / desktop=\u4EC5\u684C\u9762 / both=\u4E24\u8005\u90FD\u663E\u793A / none=\u90FD\u4E0D\u663E\u793A",
  "display.web": "\u4EC5\u6D4F\u89C8\u5668",
  "display.desktop": "\u4EC5\u684C\u9762",
  "display.both": "\u4E24\u8005\u90FD\u663E\u793A",
  "display.none": "\u90FD\u4E0D\u663E\u793A",
  cornerLabel: "\u4F4D\u7F6E",
  "corner.top-left": "\u5DE6\u4E0A\u89D2",
  "corner.top-right": "\u53F3\u4E0A\u89D2",
  "corner.bottom-left": "\u5DE6\u4E0B\u89D2",
  "corner.bottom-right": "\u53F3\u4E0B\u89D2",
  marginX: "\u6C34\u5E73\u504F\u79FB",
  marginY: "\u5782\u76F4\u504F\u79FB",
  save: "\u4FDD\u5B58",
  saveHotkey: "Ctrl+S / Cmd+S",
  sync: "\u540C\u6B65",
  confirmSync: "\u786E\u5B9A\u540C\u6B65\u5417\uFF1F\u5C06\u7528\u9879\u76EE\u5185\u7F6E\u7684\u9ED8\u8BA4\u914D\u7F6E\uFF08\u5B8C\u6574\u5B57\u6BB5 + \u6CE8\u91CA\uFF09\u8986\u76D6\u7528\u6237\u914D\u7F6E\uFF0C\u5F53\u524D\u7684\u81EA\u5B9A\u4E49\u5185\u5BB9\u4F1A\u4E22\u5931\u3002",
  corruptTitle: "\u7528\u6237\u914D\u7F6E\u5DF2\u635F\u574F\uFF0C\u672A\u4FDD\u5B58",
  corruptConfirm: "\u5F3A\u884C\u4FDD\u5B58",
  corruptBody: "\u7528\u6237\u914D\u7F6E\u6587\u4EF6\u89E3\u6790\u4E0D\u4E86\uFF08\u5185\u5BB9\u5DF2\u635F\u574F\uFF0C\u4E0D\u662F\u5408\u6CD5 JSON/JSONC\uFF09\uFF1A{path}\u3002\u7EE7\u7EED\u4FDD\u5B58\u4F1A\u6309\u767D\u540D\u5355\u91CD\u5EFA\u8FD9\u4E2A\u6587\u4EF6\u2014\u2014\u5B83\u91CC\u9762\u73B0\u6709\u7684\u5185\u5BB9\uFF08animations / physics / memes \u7B49\u81EA\u5B9A\u4E49\u5B57\u6BB5\uFF09\u4F1A\u5168\u90E8\u4E22\u5931\u3002\u53D6\u6D88 = \u4E0D\u52A8\u6587\u4EF6\uFF08\u5148\u53BB\u628A\u914D\u7F6E\u6539\u56DE\u5408\u6CD5\u518D\u4FDD\u5B58\uFF09\uFF1B\u786E\u8BA4 = \u5F3A\u884C\u4FDD\u5B58\uFF08\u4E22\u5F03\u6587\u4EF6\u91CC\u73B0\u6709\u7684\u5185\u5BB9\uFF09\u3002",
  syncHint: "\u300C\u540C\u6B65\u300D\u4F1A\u628A\u9879\u76EE\u5185\u7F6E\u7684\u9ED8\u8BA4\u914D\u7F6E\uFF08\u542B\u6CE8\u91CA\u4E0E\u5168\u90E8\u9AD8\u7EA7\u5B57\u6BB5\uFF09\u5199\u5165\u7528\u6237\u914D\u7F6E\u6587\u4EF6\uFF0C\u8986\u76D6\u5F53\u524D\u81EA\u5B9A\u4E49\u5185\u5BB9\uFF1B\u4E4B\u540E\u53EF\u76F4\u63A5\u7F16\u8F91\u8BE5\u6587\u4EF6\u3002\u6CE8\u610F\u4E24\u70B9\uFF1A\u2460 \u6587\u4EF6\u4E00\u65E6\u751F\u6210\u5373\u4E3A\u663E\u5F0F\u8986\u76D6\u5C42\u2014\u2014\u63D2\u4EF6\u5347\u7EA7\u540E\u5185\u7F6E\u9ED8\u8BA4\u7684\u53D8\u5316\u4E0D\u4F1A\u81EA\u52A8\u751F\u6548\uFF08\u9664\u975E\u518D\u6B21\u540C\u6B65\u6216\u5220\u9664\u8BE5\u6587\u4EF6\uFF09\uFF1B\u2461 \u5728\u672C\u9875\u70B9\u300C\u4FDD\u5B58\u300D\u4F1A\u6309\u767D\u540D\u5355\u91CD\u5199\u8BE5\u6587\u4EF6\uFF08\u5B57\u6BB5\u503C\u4FDD\u7559\uFF0C\u4F46\u6CE8\u91CA\u4F1A\u88AB\u53BB\u6389\uFF09\u3002",
  configMeta: "\u9AD8\u7EA7\u914D\u7F6E\uFF08\u6587\u4EF6\uFF09",
  configMetaHint: "\u7528\u6237\u914D\u7F6E\u53EF\u8986\u76D6\u5BA0\u7269\u5217\u8868 / \u52A8\u753B\u6C60 / \u64AD\u653E\u6743\u91CD\uFF0C\u4FEE\u6539\u540E\u5237\u65B0\u6216\u91CD\u542F\u751F\u6548\uFF1A\u6D4F\u89C8\u5668\u7AEF\u5237\u65B0\u9875\u9762\uFF0C\u684C\u9762\u7AEF\u53F3\u952E\u5BA0\u7269 \u2192\u300C\u91CD\u8F7D\u914D\u7F6E\u300D\uFF08\u91CD\u8F7D\u5168\u90E8\u684C\u9762\u5BA0\u7269\u7A97\u53E3\uFF09\uFF1B\u9ED8\u8BA4\u914D\u7F6E\u4E3A\u5B8C\u6574\u53C2\u8003\u3002",
  defaultConfig: "\u9ED8\u8BA4\u914D\u7F6E\uFF08\u53EA\u8BFB\uFF0C\u5B8C\u6574\u53C2\u8003\uFF09",
  userConfig: "\u7528\u6237\u914D\u7F6E\uFF08\u81EA\u5B9A\u4E49\u8986\u76D6\uFF09",
  todosFile: "\u5F85\u529E\u6570\u636E\uFF08\u6E05\u5355\u6B63\u6587\u3001\u5230\u671F\u65F6\u95F4\u4E0E\u5B8C\u6210\u72B6\u6001\uFF1B\u5220\u6389\u7B49\u4E8E\u6E05\u7A7A\u5F85\u529E\uFF09",
  animationDir: "\u52A8\u753B\u7D20\u6750\u76EE\u5F55\uFF08\u53EF\u81EA\u5B9A\u4E49/\u6269\u5145\u52A8\u753B\uFF09",
  memesDir: "\u8868\u60C5\u5305\u76EE\u5F55\uFF08\u53EF\u81EA\u5B9A\u4E49/\u6269\u5145\u914D\u56FE\uFF09",
  logFile: "\u65E5\u5FD7\u6587\u4EF6\uFF08\u6392\u969C\u7528\uFF0C\u53EF\u6E05\u7A7A\uFF09",
  logFileNote: "\u684C\u9762\u7248\u6CA1\u6709\u63A7\u5236\u53F0\uFF0C\u63D2\u4EF6\u7684\u8FD0\u884C\u65E5\u5FD7\uFF08\u542F\u52A8\u3001\u684C\u9762\u5BA0\u7269\u5D29\u6E83/\u91CD\u542F\u3001\u9519\u8BEF\u4E0E\u544A\u8B66\uFF09\u5168\u90E8\u5199\u8FDB\u8FD9\u4E00\u4E2A\u6587\u4EF6\uFF1B\u53CD\u9988\u95EE\u9898\u8BF7\u9644\u4E0A\u5B83\u3002\u5355\u6587\u4EF6\u4E0A\u9650 1 MB\uFF0C\u5199\u6EE1\u53EA\u7559\u6700\u65B0\u7684 512 KB\u3002",
  saved: "\u5DF2\u4FDD\u5B58\uFF0C\u684C\u5BA0\u5373\u65F6\u751F\u6548\u3002",
  loadError: "\u52A0\u8F7D\u914D\u7F6E\u5931\u8D25",
  saveError: "\u4FDD\u5B58\u914D\u7F6E\u5931\u8D25\uFF0C\u8BF7\u68C0\u67E5\u670D\u52A1\u8FDE\u63A5\u3001\u914D\u7F6E\u76EE\u5F55\u7684\u5199\u5165\u6743\u9650\u6216\u670D\u52A1\u65E5\u5FD7\u3002",
  saveInvalid: "\u4FDD\u5B58\u914D\u7F6E\u5931\u8D25\uFF1A\u914D\u7F6E\u5185\u5BB9\u65E0\u6548\uFF0C\u8BF7\u68C0\u67E5\u540E\u91CD\u8BD5\u3002",
  syncError: "\u540C\u6B65\u914D\u7F6E\u5931\u8D25\uFF0C\u8BF7\u68C0\u67E5\u670D\u52A1\u8FDE\u63A5\u548C\u914D\u7F6E\u76EE\u5F55\u7684\u5199\u5165\u6743\u9650\u3002",
  loading: "\u6B63\u5728\u52A0\u8F7D\u914D\u7F6E\u2026",
  retry: "\u91CD\u8BD5",
  invalid: "\u8BF7\u68C0\u67E5\u8F93\u5165\uFF1A\u5927\u5C0F\u9700\u4E3A\u6B63\u6570\uFF0C\u8FB9\u8DDD\u53EF\u4E3A\u4EFB\u610F\u6570\u5B57\u3002",
  busy: "\u4FDD\u5B58\u4E2D\u2026",
  extraPetsHint: "\u53E6 {n} \u4E2A\u79CD\u7C7B\u6765\u81EA pet/ \u76EE\u5F55\u6587\u4EF6\uFF08<\u540D>-config.json + <\u540D>-animation/\uFF09\uFF0C\u5728\u4E0A\u65B9\u300C\u79CD\u7C7B\u300D\u6761\u91CC\u5207\u6362\u5373\u53EF\u4FEE\u6539\uFF1B\u4FDD\u5B58\u4F1A\u5199\u56DE\u5404\u81EA\u7684\u89D2\u8272\u5305\u914D\u7F6E\uFF0C\u4E0D\u6DF7\u8FDB main-config.jsonc\u3002",
  kindLabel: "\u79CD\u7C7B",
  kindMain: "\u5185\u7F6E",
  lastOfKind: "\u300C{entry}\u300D\u53EA\u5269\u8FD9\u4E00\u53EA\uFF0C\u5220\u6389\u5C31\u6CA1\u6709\u8FD9\u4E2A\u79CD\u7C7B\u4E86\u3002\u8981\u5F7B\u5E95\u79FB\u9664\u8BF7\u76F4\u63A5\u5220\u9664\u8BE5\u89D2\u8272\u5305\u6587\u4EF6\u3002",
  savePartial: "\u4E3B\u5BA0\u7269\u5DF2\u4FDD\u5B58\uFF0C\u4F46 {names} \u6CA1\u80FD\u5199\u56DE\uFF1A\u68C0\u67E5\u8BE5\u89D2\u8272\u5305\u914D\u7F6E\u662F\u5426\u5408\u6CD5\u3001\u76EE\u5F55\u662F\u5426\u53EF\u5199\u3002",
  notifyToggle: "\u7CFB\u7EDF\u901A\u77E5",
  notifyToggleHint: "\u5BF9\u8BDD\u5B8C\u6210 / \u751F\u6210\u5931\u8D25 / \u6743\u9650\u7533\u8BF7 / \u7528\u6237\u9009\u62E9\uFF0C\u5728\u7A97\u53E3\u5931\u7126\u65F6\u5F39\u51FA\u7CFB\u7EDF\u7EA7\u901A\u77E5\uFF08\u684C\u9762\u53F3\u4E0B\u89D2\uFF09\u3002",
  clickSoundToggle: "\u70B9\u51FB\u97F3\u6548",
  clickSoundToggleHint: "\u70B9\u4E00\u4E0B\u5BA0\u7269\u64AD\u4E00\u58F0\u5185\u7F6E\u97F3\u6548\uFF08assets/sound/click-duck.wav\uFF0C\u97F3\u91CF 0.5\uFF1B100ms \u5185\u7684\u8FDE\u7EED\u70B9\u51FB\u53EA\u54CD\u4E00\u6B21\uFF0C\u591A\u5F00\u4E5F\u4E0D\u4F1A\u53E0\u97F3\uFF09\u3002\u5173\u6389\u5373\u5B8C\u5168\u9759\u97F3\u3002\u968F\u300C\u4FDD\u5B58\u300D\u5199\u5165\u7528\u6237\u914D\u7F6E\u3002",
  whisperImageToggle: "\u788E\u788E\u5FF5\u914D\u56FE",
  whisperImageToggleHint: "\u788E\u788E\u5FF5\u65F6\u4ECE\u8868\u60C5\u5305\u6C60\u968F\u673A\u62BD\u4E00\u5F20\uFF0C\u8FDE\u540C\u90A3\u53E5\u8BDD\u4E00\u8D77\u663E\u793A\uFF08\u56FE\u7247\u6620\u5C04\u5728\u914D\u7F6E\u6587\u4EF6\u9876\u5C42 memes\uFF09\u3002token\uFF1A\u788E\u788E\u5FF5\u672C\u6765\u5C31\u6BCF\u6B21\u751F\u6210\u90FD\u8981\u8C03\u4E00\u6B21\u6A21\u578B\uFF0C\u914D\u56FE\u53EA\u662F\u628A\u62BD\u4E2D\u90A3\u5F20\u7684\u540D\u79F0+\u63CF\u8FF0\uFF08\u7EA6 100 \u5B57\u7B26 / \u224860 token\uFF09\u52A0\u8FDB\u540C\u4E00\u6B21\u8BF7\u6C42\uFF0C\u589E\u91CF\u53EF\u5FFD\u7565\u3002",
  chatImageToggle: "\u5BF9\u8BDD\u914D\u56FE",
  chatImageToggleHint: "\u5BF9\u8BDD\u65F6\u7531 AI \u6309\u5F53\u524D\u8BED\u5883\u4ECE\u8868\u60C5\u5305\u6C60\u6311\u4E00\u5F20\u914D\u56FE\uFF08\u53EF\u4E0D\u6311\uFF1B\u56FE\u7247\u6620\u5C04\u5728\u914D\u7F6E\u6587\u4EF6\u9876\u5C42 memes\uFF09\u3002token\uFF1A\u6BCF\u6761\u6D88\u606F\u90FD\u8981\u628A\u6574\u5F20\u6E05\u5355\u9644\u8FDB\u8BF7\u6C42\uFF0C\u5F53\u524D\u7EA6 1.1k \u5B57\u7B26\uFF08\u2248650 token\uFF0C\u7EA6\u788E\u788E\u5FF5\u914D\u56FE\u7684 11 \u500D\uFF09\uFF0C\u5E76\u968F\u56FE\u7247\u6570\u91CF\u7EBF\u6027\u589E\u957F\uFF1B\u5173\u6389\u5219\u4E00\u4E2A\u5B57\u7B26\u90FD\u4E0D\u9644\u3002",
  chatAnimationToggle: "\u5BF9\u8BDD\u52A8\u4F5C\u8054\u52A8",
  chatAnimationToggleHint: "\u5F00\u542F\u540E\uFF0C\u5BF9\u8BDD\u65F6\u4F1A\u628A\u53EF\u8868\u6F14\u7684\u52A8\u4F5C\u6E05\u5355\uFF08animations.categories \u4E0B\u7684\u5168\u90E8\u52A8\u4F5C\uFF09\u4EA4\u7ED9\u6A21\u578B\uFF1A\u6A21\u578B\u8BA4\u4E3A\u8FD9\u53E5\u8BDD\u786E\u5B9E\u5728\u6F14\u67D0\u4E2A\u52A8\u4F5C\u65F6\uFF0C\u5BA0\u7269\u5F53\u573A\u6F14\u51FA\u6765\uFF1B\u6CA1\u6709\u5408\u9002\u7684\u5C31\u53EA\u56DE\u6587\u5B57\u3002token\uFF1A\u6BCF\u6761\u6D88\u606F\u90FD\u8981\u9644\u6574\u5F20\u52A8\u4F5C\u6E05\u5355\uFF0C\u5173\u6389\u5219\u4E00\u4E2A\u540D\u5B57\u90FD\u4E0D\u9644\u3002\u5168\u5C40\u9ED8\u8BA4\uFF0C\u6240\u6709\u5BA0\u7269\u5171\u7528\uFF08pet pack \u53EF\u5728\u81EA\u5DF1\u79CD\u7C7B\u6587\u4EF6\u91CC\u8986\u76D6\uFF09\u3002",
  confineToggle: "\u9501\u5B9A\u5728\u5F53\u524D\u5C4F\u5E55",
  confineToggleHint: "\u591A\u5C4F\u7528\u6237\uFF1A\u5F00\u4E86\u4E4B\u540E\u5BA0\u7269\u53EA\u5728\u5F53\u524D\u6240\u5728\u90A3\u5757\u5C4F\u5E55\u5185\u6D3B\u52A8\u2014\u2014\u7529\u51FA\u53BB\u7684\u5BA0\u7269\u53EA\u5728\u677E\u624B\u65F6\u6240\u5728\u90A3\u5757\u5C4F\u5185\u5F39\uFF08\u5C4F\u7F1D\u5F53\u5899\uFF0C\u4E0D\u98DE\u5230\u9694\u58C1\u5C4F\uFF09\uFF0C\u81EA\u4E3B\u6F2B\u6E38\u4E5F\u53EA\u5728\u5F53\u524D\u6240\u5728\u90A3\u5757\u5C4F\u5185\u8D70\uFF08\u8D8A\u51FA\u5C4F\u7F1D\u7684\u90A3\u4E00\u6B65\u76F4\u63A5\u53D6\u6D88\uFF09\u3002\u5173\u6389\u5219\u7167\u5E38\u8DE8\u5C4F\u98DE\u884C / \u8DE8\u5C4F\u884C\u8D70\u3002\u53EA\u5F71\u54CD\u684C\u9762\u6A21\u5F0F\u2014\u2014\u6D4F\u89C8\u5668 overlay \u672C\u6765\u5C31\u53EA\u5728\u89C6\u53E3\u5185\u6D3B\u52A8\u3002",
  trayToggle: "\u7CFB\u7EDF\u6258\u76D8",
  trayToggleHint: "\u684C\u9762\u6A21\u5F0F\u542F\u52A8\u540E\u5728\u901A\u77E5\u533A\u57DF\uFF08macOS \u4E3A\u83DC\u5355\u680F\uFF09\u5E38\u9A7B\u4E00\u4E2A\u56FE\u6807\uFF0C\u5217\u51FA\u914D\u7F6E\u91CC\u7684\u5168\u90E8\u5BA0\u7269\uFF0C\u52FE\u9009\u5C31\u80FD\u5207\u6362\u663E\u793A\u4F4D\u7F6E\u2014\u2014\u5305\u62EC\u5F53\u524D\u4E0D\u5728\u684C\u9762\u3001\u6CA1\u6709\u7A97\u53E3\u53EF\u53F3\u952E\u7684\u90A3\u4E9B\u3002\u5173\u6389\u4E4B\u540E\u8981\u628A\u5BA0\u7269\u53EB\u56DE\u684C\u9762\uFF0C\u53EA\u80FD\u5F00\u6D4F\u89C8\u5668\u7528\u8BBE\u7F6E\u9875\uFF0C\u6216\u5728\u7F51\u9875\u7AEF\u90A3\u53EA\u5BA0\u7269\u8EAB\u4E0A\u53F3\u952E\u3002Windows \u672C\u6765\u5C31\u4F1A\u628A\u5B83\u6298\u53E0\u8FDB\u300C\u9690\u85CF\u7684\u56FE\u6807\u300D\u9762\u677F\u3002\u4EC5\u5F71\u54CD\u684C\u9762\u6A21\u5F0F\u3002",
  voiceTitle: "\u8BED\u97F3\u64AD\u62A5",
  voiceHint: "\u684C\u5BA0\u51FA\u58F0\u7684\u4E09\u4E2A\u5F00\u5173\u4E0E\u97F3\u8272\uFF1A\u603B\u5F00\u5173\u7BA1\u81EA\u52A8\u64AD\u62A5\uFF0C\u4E24\u4E2A\u7EC6\u5206\u5F00\u5173\u5404\u7BA1\u4E00\u7C7B\u4E3B\u52A8\u6D88\u606F\u3002\u9ED8\u8BA4\u5168\u5173\uFF0C\u968F\u300C\u4FDD\u5B58\u300D\u5199\u5165\u7528\u6237\u914D\u7F6E\uFF08\u4E0D\u505A\u5373\u65F6\u5199\u5165\uFF09\u3002",
  voiceEnabled: "\u8BED\u97F3\u64AD\u62A5",
  voiceEnabledHint: "\u81EA\u52A8\u64AD\u62A5\u7684\u603B\u5F00\u5173\u3002\u5173\u6389\u540E\u5468\u671F\u788E\u788E\u5FF5\u4E0E\u5F85\u529E\u63D0\u9192\u90FD\u4E0D\u5FF5\uFF08\u4E0B\u9762\u4E24\u4E2A\u7EC6\u5206\u5F00\u5173\u4E0D\u8D77\u4F5C\u7528\uFF09\uFF1B\u624B\u52A8\u788E\u788E\u5FF5\u3001\u5BF9\u8BDD\u56DE\u590D\u4E0E\u5BF9\u8BDD\u9762\u677F\u7684\u5587\u53ED\u6309\u94AE\u4E0D\u53D7\u5B83\u9650\u5236\u2014\u2014\u90A3\u4E9B\u662F\u4F60\u4E3B\u52A8\u70B9\u7684\uFF0C\u53D1\u8D77\u7684\u90A3\u4E00\u7AEF\u76F4\u63A5\u5FF5\u3002\u53EA\u5F71\u54CD\u300C\u8BF4\u4E0D\u8BF4\u300D\uFF1A\u6C14\u6CE1\u3001\u5BF9\u8BDD\u8BB0\u5FC6\u4E0E\u7CFB\u7EDF\u901A\u77E5\u90FD\u4E0D\u53D7\u5F71\u54CD\uFF1B\u5408\u6210\u5931\u8D25\u53EA\u7559\u65E5\u5FD7\uFF0C\u4E0D\u6253\u65AD\u5BF9\u8BDD\u3002",
  voiceWhisperEnabled: "\u788E\u788E\u5FF5\u64AD\u62A5",
  voiceWhisperEnabledHint: "\u5468\u671F\u751F\u6210\u7684\u90A3\u53E5\u788E\u788E\u5FF5\u5FF5\u51FA\u6765\uFF08\u624B\u52A8\u53F3\u952E\u7684\u788E\u788E\u5FF5\u4E0D\u53D7\u672C\u9879\u5F71\u54CD\uFF09\u3002\u53D7\u4E0A\u9762\u7684\u603B\u5F00\u5173\u7EA6\u675F\uFF1A\u603B\u5F00\u5173\u5173\u6389\u65F6\u672C\u9879\u4E0D\u8D77\u4F5C\u7528\u3002\u9ED8\u8BA4\u5173\u95ED\u2014\u2014\u788E\u788E\u5FF5\u662F\u80CC\u666F\u65C1\u767D\uFF0C\u4E0D\u8BE5\u9ED8\u8BA4\u51FA\u58F0\u3002",
  voiceTodoEnabled: "\u5F85\u529E\u64AD\u62A5",
  voiceTodoEnabledHint: "\u5230\u70B9\u7684\u5F85\u529E\u63D0\u9192\u5FF5\u51FA\u6765\uFF08\u540C\u4E00\u53E5\u7167\u6837\u5F39\u6C14\u6CE1\uFF0C\u672C\u9879\u53EA\u51B3\u5B9A\u5FF5\u4E0D\u5FF5\uFF09\u3002\u53D7\u4E0A\u9762\u7684\u603B\u5F00\u5173\u7EA6\u675F\u3002\u9ED8\u8BA4\u5173\u95ED\u3002",
  voiceNameLabel: "\u97F3\u8272",
  voiceVolumeLabel: "\u97F3\u91CF",
  voiceVolumeHint: "\u64AD\u62A5\u97F3\u91CF\uFF0C0\u20131 \u7684\u5C0F\u6570\uFF1A1 \u662F\u6700\u5927\u97F3\u91CF\uFF08100%\uFF09\uFF0C0 \u662F\u9759\u97F3\u3002\u53EA\u6539\u64AD\u653E\u54CD\u5EA6\uFF0C\u4E0D\u4F1A\u91CD\u65B0\u5408\u6210\u97F3\u9891\uFF0C\u8C03\u5B83\u4E0D\u989D\u5916\u82B1\u94B1\u3002\u4E0E\u4E0A\u9762\u7684\u603B\u5F00\u5173\u662F\u4E24\u4EF6\u4E8B\u2014\u2014\u603B\u5F00\u5173\u5173\u7740\u65F6\u5B83\u4E0D\u8D77\u4F5C\u7528\u3002",
  physicsTitle: "\u7269\u7406\uFF08\u62D6\u62FD\u629B\u63B7\u624B\u611F\uFF09",
  physicsHint: "\u5168\u5C40\u9ED8\u8BA4\uFF0C\u6240\u6709\u5BA0\u7269\u5171\u7528\uFF08pet pack \u53EF\u5728\u81EA\u5DF1\u79CD\u7C7B\u6587\u4EF6\u91CC\u5355\u72EC\u8986\u76D6\uFF09\uFF1B\u968F\u300C\u4FDD\u5B58\u300D\u5199\u5165\u7528\u6237\u914D\u7F6E\uFF08\u4E0D\u505A\u5373\u65F6\u5199\u5165\uFF09\u3002\u6D4F\u89C8\u5668\u4FDD\u5B58\u540E\u5373\u65F6\u751F\u6548\uFF0C\u684C\u9762\u7AEF\u7531\u4FDD\u5B58\u91CD\u8F7D\u5BA0\u7269\u7A97\u53E3\u540E\u751F\u6548\u3002",
  mobileTitle: "\u79FB\u52A8\u7AEF\u6548\u679C",
  mobileHint: "\u8FD9\u51E0\u9879\u53EA\u5728\u624B\u673A\u6D4F\u89C8\u5668\u4E0A\u6709\u610F\u4E49\uFF1A\u632F\u52A8\u8981\u6709\u9A6C\u8FBE\uFF0C\u4E24\u4E2A\u4F53\u611F\u5F00\u5173\u8981\u6709\u59FF\u6001 / \u52A0\u901F\u5EA6\u4F20\u611F\u5668\uFF1B\u4F20\u611F\u5668\u8FD8\u8981\u6C42 HTTPS \u6216 localhost\u3002",
  "physics.gravity": "\u91CD\u529B",
  "physics.gravityHint": "px/s\xB2\uFF0C\u8D8A\u5927\u843D\u5F97\u8D8A\u5FEB\uFF1B0 = \u65E0\u91CD\u529B\uFF08\u629B\u51FA\u53BB\u5300\u901F\u76F4\u7EBF\u98DE\uFF09",
  "physics.restitution": "\u5F39\u6027",
  "physics.restitutionHint": "0~1\uFF0C\u78B0\u58C1 / \u843D\u5730\u53CD\u5F39\u4FDD\u7559\u7684\u901F\u5EA6\u6BD4\u4F8B\uFF081 = \u5B8C\u5168\u5F39\u6027\uFF0C0 = \u649E\u4E0A\u5373\u505C\uFF09",
  "physics.groundFriction": "\u63A5\u89E6\u6469\u64E6",
  "physics.groundFrictionHint": "/s\uFF0C\u649E\u5899 / \u843D\u5730 / \u649E\u9876\u540E\u6CBF\u63A5\u89E6\u9762\u65B9\u5411\u7684\u901F\u5EA6\u8870\u51CF\u7387\uFF1B0 = \u56DB\u9762\u90FD\u50CF\u51B0\u9762",
  "physics.throwPower": "\u603B\u529B\u5EA6",
  "physics.throwPowerHint": "> 0\uFF0C\u5F39\u7C27\u8DDF\u624B\u4E0E\u7529\u51FA\u521D\u901F\u7684\u6574\u4F53\u500D\u7387\uFF081 = \u9ED8\u8BA4\uFF1B\u8D8A\u5927\u8D8A\u8DDF\u624B\u3001\u7529\u5F97\u8D8A\u731B\uFF09",
  physicsCeilingBounce: "\u9876\u90E8\u53CD\u5F39",
  physicsCeilingBounceHint: "\u5173\u6389\u540E\u629B\u63B7\u53EF\u98DE\u51FA\u5C4F\u5E55\u9876\u90E8\uFF08\u91CD\u529B\u4ECD\u4F1A\u628A\u5B83\u62C9\u56DE\u6765\uFF09",
  physicsPetCollision: "\u5BA0\u7269\u4E92\u649E",
  physicsPetCollisionHint: "\u98DE\u884C\u4E2D\u7684\u5BA0\u7269\u649E\u5230\u522B\u7684\u5BA0\u7269\u6309\u52A8\u91CF\u5B88\u6052\u5F39\u5F00\uFF08\u8D28\u91CF \u221D \u5C3A\u5BF8\xB2\uFF09",
  physicsHaptic: "\u78B0\u649E\u9707\u52A8",
  physicsHapticHint: "\u649E\u5899\u3001\u843D\u5730\u3001\u649E\u9876\u3001\u4E92\u649E\u5404\u9707\u4E00\u4E0B\u3002Chrome / Edge \u53EF\u7528\uFF1BiOS \u4E0E Via \u7B49 WebView \u58F3\u4E0D\u751F\u6548\uFF1B\u52FF\u6270\u6A21\u5F0F\u4F1A\u6321\u4F4F\u632F\u52A8\u3002",
  physicsTilt: "\u503E\u659C\u63A7\u5236\u91CD\u529B",
  physicsTiltHint: "\u503E\u659C\u624B\u673A = \u91CD\u529B\u671D\u90A3\u8FB9\uFF0C\u5927\u5C0F\u5C31\u662F\u4E0A\u9762\u7684\u91CD\u529B\u503C\uFF1B\u91CD\u529B\u4E3A 0 \u65F6\u503E\u659C\u6CA1\u6709\u6548\u679C\u3002\u9700\u8981 HTTPS \u6216 localhost\u3002",
  physicsShake: "\u6447\u4E00\u6447\u629B\u51FA",
  physicsShakeHint: "\u6447\u4E00\u6447\u6CBF\u7529\u52A8\u65B9\u5411\u628A\u5BA0\u7269\u7529\u51FA\u53BB\uFF0C\u529B\u5EA6 = \u57FA\u51C6 \xD7 \u603B\u529B\u5EA6\uFF1B\u4E0E\u91CD\u529B\u65E0\u5173\uFF0C\u91CD\u529B\u8BBE 0 \u4E5F\u80FD\u7529\u3002\u9700\u8981 HTTPS \u6216 localhost\u3002",
  invalidPhysics: "\u8BF7\u68C0\u67E5\u7269\u7406\u53C2\u6570\uFF1A\u91CD\u529B / \u5730\u9762\u6469\u64E6 \u2265 0\uFF0C\u5F39\u6027 0~1\uFF0C\u603B\u529B\u5EA6 > 0\u3002",
  fontTitle: "\u5916\u89C2\u4E0E\u5B57\u4F53",
  fontHint: "\u5B57\u4F53\u79CD\u7C7B\u4F5C\u7528\u4E8E\u73B0\u5728\u7528\u8F6F\u7CD6\u4F53\u7684\u5168\u90E8\u6587\u5B57\uFF1A\u5BA0\u7269\u6C14\u6CE1\u3001\u60AC\u6D6E\u63D0\u793A\u3001\u5BF9\u8BDD\u7A97\u3001\u5F97\u5206\u5F39\u7A97\uFF1B\u5B57\u53F7\u53EA\u4F5C\u7528\u4E8E\u5BA0\u7269\u6C14\u6CE1\u4E0E\u60AC\u6D6E\u63D0\u793A\uFF08\u5BF9\u8BDD\u7A97\u4E0E\u5F97\u5206\u5F39\u7A97\u7684\u5B57\u53F7\u4E0D\u53D8\uFF09\u3002\u5168\u5C40\u9ED8\u8BA4\uFF0C\u6240\u6709\u5BA0\u7269\u5171\u7528\uFF08pet pack \u53EF\u5728\u81EA\u5DF1\u79CD\u7C7B\u6587\u4EF6\u91CC\u5355\u72EC\u8986\u76D6\uFF09\uFF1B\u968F\u300C\u4FDD\u5B58\u300D\u5199\u5165\u7528\u6237\u914D\u7F6E\uFF0C\u6D4F\u89C8\u5668\u4FDD\u5B58\u540E\u5373\u65F6\u751F\u6548\uFF0C\u684C\u9762\u7AEF\u7531\u4FDD\u5B58\u91CD\u8F7D\u5BA0\u7269\u7A97\u53E3\u540E\u751F\u6548\u3002",
  fontFamilyLabel: "\u5B57\u4F53",
  fontFamilyHint: "\u300C\u8F6F\u7CD6\u4F53\uFF08\u5185\u7F6E\uFF09\u300D\u968F\u63D2\u4EF6\u63D0\u4F9B\uFF1B\u5176\u4F59\u4E3A\u7CFB\u7EDF\u5B57\u4F53\uFF0C\u673A\u5668\u4E0A\u6CA1\u88C5\u65F6\u81EA\u52A8\u56DE\u9000\u5230\u5B57\u4F53\u6808\u91CC\u7684\u4E0B\u4E00\u4E2A\uFF08\u4E0D\u4F1A\u7A7A\u767D\u6216\u62A5\u9519\uFF09\u3002",
  fontSizeLabel: "\u5B57\u53F7\uFF08px\uFF09",
  fontSizeHint: "\u6C14\u6CE1\u6B63\u6587\u5B57\u53F7\uFF1B\u60AC\u6D6E\u63D0\u793A\u4E0E\u6C14\u6CE1\u5185\u7684\u5C0F\u5B57\u6309\u65E2\u6709\u6BD4\u4F8B\u6D3E\u751F\u3002\u8303\u56F4 4~200\u3002",
  fontFollowToggle: "\u5B57\u53F7\u968F\u5BA0\u7269\u5927\u5C0F\u7F29\u653E",
  fontFollowToggleHint: "\u5F00\u542F\uFF08\u9ED8\u8BA4\uFF09\uFF1A\u5BA0\u7269\u8C03\u5927\u65F6\u5B57\u53F7\u7B49\u6BD4\u653E\u5927\uFF0C462 \u5BBD\u65F6\u6B63\u597D\u662F\u4E0A\u9762\u8BBE\u5B9A\u7684\u5B57\u53F7\uFF1B\u5173\u95ED\uFF1A\u5B57\u53F7\u6052\u5B9A\uFF0C\u4E0D\u968F\u5BA0\u7269\u5927\u5C0F\u53D8\u5316\u3002",
  invalidFont: "\u8BF7\u68C0\u67E5\u5B57\u4F53\u8BBE\u7F6E\uFF1A\u5B57\u4F53\u9700\u5728\u4E0B\u62C9\u5217\u8868\u5185\uFF0C\u5B57\u53F7\u9700\u4E3A 4~200 \u7684\u6570\u5B57\u3002",
  "font.candy": "\u8F6F\u7CD6\u4F53\uFF08\u5185\u7F6E\uFF09",
  "font.yahei": "\u5FAE\u8F6F\u96C5\u9ED1 / \u82F9\u65B9",
  "font.youyuan": "\u5E7C\u5706",
  "font.kaiti": "\u6977\u4F53",
  "font.simsun": "\u5B8B\u4F53",
  "font.comic": "\u6F2B\u753B\u4F53",
  "font.system": "\u7CFB\u7EDF\u9ED8\u8BA4",
  modelTitle: "\u5BF9\u8BDD\u4E0E\u6A21\u578B",
  modelHint: "\u788E\u788E\u5FF5\u4E0E\u5BF9\u8BDD\u5404\u81EA\u7528\u54EA\u4E2A\u6A21\u578B\uFF0C\u4EE5\u53CA\u5BF9\u8BDD\u6BCF\u6B21\u5E26\u591A\u5C11\u5386\u53F2\u8FDB\u4E0A\u4E0B\u6587\u3002\u9009\u300C\u8DDF\u968F\u5F53\u524D\u5BF9\u8BDD\u300D= \u7528\u4F60\u5F53\u524D\u5BF9\u8BDD\u6B63\u5728\u7528\u7684\u90A3\u4E2A\u6A21\u578B\uFF08\u9ED8\u8BA4\uFF09\u3002\u5168\u5C40\u9ED8\u8BA4\uFF1A\u5BF9\u6240\u6709\u5BA0\u7269\u751F\u6548\uFF0Cpet pack \u53EF\u5728\u81EA\u5DF1\u79CD\u7C7B\u6587\u4EF6\u91CC\u5355\u72EC\u8986\u76D6\u3002\u9009\u9879\u4E0E DSH \u7684\u6A21\u578B\u9009\u62E9\u5668\u540C\u6E90\uFF0C\u7531\u5BBF\u4E3B\u5B9E\u65F6\u63D0\u4F9B\u3002",
  modelFollow: "\u8DDF\u968F\u5F53\u524D\u5BF9\u8BDD",
  modelSearch: "\u641C\u7D22\u6A21\u578B\u2026",
  modelEmpty: "\u6CA1\u6709\u5339\u914D\u7684\u6A21\u578B\u3002",
  modelNoModels: "\u6CA1\u6709\u53EF\u7528\u7684\u6A21\u578B\u3002",
  modelLoading: "\u6B63\u5728\u5237\u65B0\u6A21\u578B\u5217\u8868\u2026",
  modelTriggerAria: "\u9009\u62E9\u6A21\u578B\uFF0C\u5F53\u524D {model}",
  modelUnknown: "\uFF08\u5F53\u524D\u914D\u7F6E\uFF0C\u4E0D\u5728\u5217\u8868\u4E2D\uFF09",
  modelNone: "\u8BE5\u670D\u52A1\u5546\u6CA1\u6709\u53EF\u7528\u6A21\u578B",
  whisperModelLabel: "\u788E\u788E\u5FF5\u6A21\u578B",
  chatModelLabel: "\u5BF9\u8BDD\u6A21\u578B",
  modelFieldHint: "\u9009\u300C\u8DDF\u968F\u5F53\u524D\u5BF9\u8BDD\u300D= \u7528\u5F53\u524D\u5BF9\u8BDD\u7684\u6A21\u578B\uFF1B\u6307\u5B9A\u4E86\u4F46\u8C03\u7528\u5931\u8D25\u4F1A\u81EA\u52A8\u56DE\u843D\u5230\u5F53\u524D\u5BF9\u8BDD\u7684\u6A21\u578B\u91CD\u8BD5\u4E00\u6B21\u3002",
  invalidModel: "\u8BF7\u68C0\u67E5\u6A21\u578B\u8BBE\u7F6E\uFF1A\u670D\u52A1\u5546\u4E0E\u6A21\u578B\u8981\u4E48\u90FD\u9009\uFF0C\u8981\u4E48\u90FD\u7559\u7A7A\uFF08\u8DDF\u968F\u5F53\u524D\u5BF9\u8BDD\uFF09\u3002",
  modelCatalogFailed: "\u6A21\u578B\u5217\u8868\u52A0\u8F7D\u5931\u8D25\uFF08\u5237\u65B0\u9875\u9762\u53EF\u91CD\u8BD5\uFF09\uFF1B\u5F53\u524D\u914D\u7F6E\u503C\u4ECD\u4F1A\u539F\u6837\u4FDD\u7559\u3002",
  chatMemory: "\u5BF9\u8BDD\u5386\u53F2\u6761\u6570",
  chatMemoryHint: "\u6BCF\u6B21\u5BF9\u8BDD\u8BF7\u6C42\u643A\u5E26\u7684\u6700\u8FD1\u5386\u53F2\u8F6E\u6570\uFF081 \u8F6E = 1 \u95EE 1 \u7B54\uFF1B0 = \u4E0D\u5E26\u5386\u53F2\uFF0C\u6BCF\u53E5\u90FD\u662F\u5168\u65B0\u5BF9\u8BDD\uFF09\u3002\u5BF9\u8BDD\u8BB0\u5FC6\u672C\u8EAB\u5168\u5B58\u4E0D\u5220\uFF0C\u6B64\u503C\u53EA\u51B3\u5B9A\u622A\u591A\u5C11\u8FDB\u4E0A\u4E0B\u6587\u2014\u2014\u8D8A\u5927\u8D8A\u8BB0\u5F97\u4F4F\uFF0C\u4E5F\u8D8A\u8D39 token\u3002\u5168\u5C40\u9ED8\u8BA4\uFF0C\u6240\u6709\u5BA0\u7269\u5171\u7528\uFF08pet pack \u53EF\u5728\u81EA\u5DF1\u79CD\u7C7B\u6587\u4EF6\u91CC\u5355\u72EC\u8986\u76D6\uFF09\u3002",
  invalidChatMemory: "\u8BF7\u68C0\u67E5\u5BF9\u8BDD\u5386\u53F2\u6761\u6570\uFF1A\u9700\u4E3A \u2265 0 \u7684\u6570\u5B57\u3002",
  chatImageLimit: "\u5BF9\u8BDD\u914D\u56FE\u5F20\u6570\u4E0A\u9650",
  chatImageLimitHint: "\u5BF9\u8BDD\u65F6\u53D1\u7ED9\u6A21\u578B\u7684\u8868\u60C5\u5305\u6E05\u5355\u6700\u591A\u51E0\u5F20\uFF08\u300C\u524D N \u5F20\u300D= \u914D\u7F6E\u91CC\u5199\u5728\u524D\u9762\u7684\u90A3 N \u6761\uFF0C\u60F3\u8BA9\u54EA\u51E0\u5F20\u4F18\u5148\u88AB\u53D1\u51FA\u53BB\u5C31\u628A\u987A\u5E8F\u5F80\u524D\u632A\uFF09\u3002\u6574\u5F20\u6E05\u5355\u662F\u6BCF\u6761\u6D88\u606F\u90FD\u8981\u9644\u7684\uFF0Ctoken \u968F\u5F20\u6570\u7EBF\u6027\u589E\u957F\u2014\u2014\u5F20\u6570\u4E00\u591A\u5C31\u662F\u7EAF\u70E7\u94B1\uFF0C\u9650\u5236\u6210\u524D N \u5F20\uFF0C\u6A21\u578B\u53EA\u4ECE\u8FD9\u51E0\u5F20\u91CC\u6311\u30020 = \u4E0D\u9650\u5236\uFF08\u5168\u90E8\u53D1\uFF09\u3002\u5185\u7F6E\u9ED8\u8BA4 10\u3002\u5168\u5C40\u9ED8\u8BA4\uFF0C\u6240\u6709\u5BA0\u7269\u5171\u7528\uFF08pet pack \u53EF\u5728\u81EA\u5DF1\u79CD\u7C7B\u6587\u4EF6\u91CC\u8986\u76D6\uFF09\u3002\u53EA\u5F71\u54CD\u5BF9\u8BDD\u9009\u56FE\uFF1A\u788E\u788E\u5FF5\u53EA\u5E26\u62BD\u4E2D\u7684\u90A3\u4E00\u5F20\u3002",
  invalidChatImageLimit: "\u8BF7\u68C0\u67E5\u5BF9\u8BDD\u914D\u56FE\u5F20\u6570\u4E0A\u9650\uFF1A\u9700\u4E3A \u2265 0 \u7684\u6570\u5B57\uFF080 = \u4E0D\u9650\u5236\uFF09\u3002",
  notifyTest: "\u6D4B\u8BD5\u5F39\u7A97",
  notifyTestOk: "\u6D4B\u8BD5\u901A\u77E5\u5DF2\u53D1\u9001\uFF0C\u8BF7\u67E5\u770B\u684C\u9762\u53F3\u4E0B\u89D2\u3002",
  notifyDenyUnsupported: "\u5F53\u524D\u73AF\u5883\u4E0D\u652F\u6301\u7CFB\u7EDF\u901A\u77E5\uFF08\u6D4F\u89C8\u5668\u65E0 Notification API\uFF09\u3002",
  notifyDenyBlocked: "\u901A\u77E5\u6743\u9650\u5DF2\u88AB\u6D4F\u89C8\u5668\u6807\u8BB0\u4E3A\u300C\u963B\u6B62\u300D\u3002",
  notifyDenyRejected: "\u4F60\u5728\u6743\u9650\u8BE2\u95EE\u5F39\u7A97\u4E2D\u9009\u62E9\u4E86\u300C\u963B\u6B62\u300D\u3002",
  notifyDenyError: "\u7533\u8BF7\u6743\u9650\u65F6\u51FA\u9519",
  notifyGuide: "\u5F15\u5BFC\uFF1A\u70B9\u51FB\u5730\u5740\u680F\u5DE6\u4FA7 \u{1F512}/\u24D8 \u2192\u300C\u7F51\u7AD9\u8BBE\u7F6E\u300D\u2192\u300C\u901A\u77E5\u300D\u2192 \u6539\u4E3A\u300C\u5141\u8BB8\u300D\uFF0C\u5237\u65B0\u9875\u9762\u540E\u91CD\u8BD5\u3002",
  storageTitle: "\u5378\u8F7D\u4E0E\u5B58\u50A8",
  storageHint: "\u63D2\u4EF6\u5728\u672C\u673A\u843D\u4E0B\u7684\u5168\u90E8\u4F4D\u7F6E\u3002\u5220\u7F13\u5B58\u4E0D\u5F71\u54CD\u4F7F\u7528\uFF08\u4F1A\u81EA\u52A8\u91CD\u4E0B/\u91CD\u5EFA\uFF09\uFF1B\u5220\u300C\u63D2\u4EF6\u7528\u6237\u6570\u636E\u300D\u4F1A\u4E22\u914D\u7F6E\u4E0E\u5BF9\u8BDD\u8BB0\u5FC6\u3002",
  "storage.userData": "\u63D2\u4EF6\u7528\u6237\u6570\u636E\uFF1A\u81EA\u5B9A\u4E49\u914D\u7F6E main-config.jsonc\u3001\u5BF9\u8BDD\u8BB0\u5FC6 memory.json\u3001\u81EA\u5B9A\u4E49\u52A8\u753B\u7D20\u6750 main-animation/\u3001\u6587\u4EF6\u5BA0\u7269 pet/",
  "storage.electron": "\u684C\u9762\u5BA0\u7269\u7528\u7684 Electron \u8FD0\u884C\u65F6\uFF08\u4F53\u79EF\u8F83\u5927\uFF1B\u5220\u9664\u540E\u4E0B\u6B21\u542F\u7528\u684C\u9762\u6A21\u5F0F\u4F1A\u81EA\u52A8\u91CD\u65B0\u4E0B\u8F7D\uFF09",
  "storage.desktopCache": "\u684C\u9762\u5BA0\u7269\u7A97\u53E3\u7684\u7F13\u5B58\u4E0E\u4E3B\u5C4F\u7F29\u653E\u7F13\u5B58\uFF08\u53EF\u5220\uFF0C\u4F1A\u81EA\u52A8\u91CD\u5EFA\uFF09",
  "storage.electronCache": "Electron \u5B89\u88C5\u5305\u4E0B\u8F7D\u7F13\u5B58\uFF08\u53EF\u5220\uFF0C\u9700\u8981\u65F6\u4F1A\u91CD\u65B0\u4E0B\u8F7D\uFF09",
  "storage.package": "\u63D2\u4EF6\u672C\u4F53\uFF08\u7531 DSH \u7BA1\u7406\uFF0C\u7528\u4E0B\u9762\u7684\u5378\u8F7D\u547D\u4EE4\u79FB\u9664\uFF0C\u4E0D\u8981\u624B\u5220\uFF09",
  storageMissing: "\uFF08\u5C1A\u672A\u521B\u5EFA\uFF09",
  uninstallTitle: "\u5378\u8F7D\u65B9\u6CD5",
  uninstallStep1: "1. \u5148\u9000\u51FA DSH\uFF08\u684C\u9762\u5BA0\u7269\u968F\u4E4B\u9000\u51FA\uFF09\uFF1B\u4E0D\u8981\u5728\u684C\u5BA0\u8FD0\u884C\u65F6\u5220\u9664\u4E0A\u9762\u7684\u6587\u4EF6\u3002",
  uninstallStep2: "2. \u5378\u8F7D\u63D2\u4EF6\u672C\u4F53\uFF08\u7EC8\u7AEF\u6267\u884C\uFF0C\u4F1A\u540C\u65F6\u4ECE profile \u7684 bundle \u5C42\u79FB\u9664\uFF09\uFF1A",
  uninstallStep3: "3. \u6309\u9700\u5220\u9664\u4E0A\u9762\u7684\u4F4D\u7F6E\uFF1A\u7F13\u5B58\u7C7B\u5220\u4E86\u65E0\u5F71\u54CD\uFF1B\u300C\u63D2\u4EF6\u7528\u6237\u6570\u636E\u300D\u5220\u4E86\u4F1A\u4E22\u914D\u7F6E\u4E0E\u5BF9\u8BDD\u8BB0\u5FC6\uFF08\u60F3\u4FDD\u7559\u5C31\u5148\u5907\u4EFD\u5176\u4E2D\u7684 main-config.jsonc\uFF09\u3002",
  motionTitle: "\u52A8\u4F5C\u9891\u7387",
  motionHint: "\u56DB\u4E2A\u6846\uFF1A\u5F85\u673A / \u8F6C\u5411 / \u79FB\u52A8\u53EF\u6539\uFF0C\u968F\u673A\u52A8\u4F5C\u81EA\u52A8\u7B97\uFF08= 100 \u2212 \u5176\u4F59\u4E09\u9879\uFF09\u3002\u5168\u5C40\u9ED8\u8BA4\uFF0C\u6240\u6709\u5BA0\u7269\u5171\u7528\uFF1Bpet pack \u53EF\u5728\u81EA\u5DF1\u79CD\u7C7B\u6587\u4EF6\u91CC\u8986\u76D6\u3002",
  "motion.idle": "\u5F85\u673A",
  "motion.turn": "\u8F6C\u5411",
  "motion.move": "\u79FB\u52A8",
  "motion.action": "\u968F\u673A\u52A8\u4F5C",
  uninstallCmd: "dsh plugin --profile {profile} remove dsh-pet"
};

// vendor/dsh-pet/src/client/settings.ts
function makePetConfigSection(rt, ctx) {
  const { h, useState, useEffect, useRef, useCallback, t } = rt;
  injectSettingsCss();
  const { q } = makeUiKit({ h, t });
  const ModelPicker = makeModelPicker({ h, useState, useEffect, useRef, t });
  const VoicePicker = makeVoicePicker({ h, useState, useEffect, useRef });
  const PetTabs = makePetTabs({ h, t });
  const KindTabs = makeKindTabs({ h, t });
  const PetCard = makePetCard(rt);
  const GlobalCard = makeGlobalCard(rt);
  const VoiceCard = makeVoiceCard(rt, VoicePicker);
  const FontCard = makeFontCard(rt);
  const ModelCard = makeModelCard(rt, ModelPicker);
  const PhysicsCard = makePhysicsCard(rt);
  const MotionCard = makeMotionCard(rt);
  const ShortcutsCard = makeShortcutsCard(rt, ctx);
  const MobileCard = makeMobileCard(rt);
  const Actions = makeActions(rt);
  const { ConfigMetaCard, StorageCard } = makePathsCards(rt);
  const SettingsDialog = makeDialog(rt);
  const LoadStatus = makeLoadStatus({ h, t });
  return function PetConfigSection() {
    const [saving, setBusy] = useState(false);
    const [msg, setMsg] = useState({ kind: "", text: "" });
    const [permMsg, setPermMsg] = useState({ kind: "", text: "" });
    const rootRef = useRef(null);
    const [dialog, setDialog] = useState(null);
    const {
      pets,
      mainPets,
      kinds,
      kind,
      visiblePets,
      selId,
      entryPrompt,
      select,
      selectKind,
      update,
      add,
      requestRemove,
      remove,
      replace,
      packWrites
    } = usePetList(rt, setDialog);
    const { paths, catalog, catalogFailed } = useRemoteData(rt);
    useEffect(() => attachTipLayer(), []);
    useEffect(() => {
      let alive = true;
      void fetch(ROUTE_PATH + "/voice/voices").then((response) => response.ok ? response.json() : null).then((body) => {
        if (alive && body && Array.isArray(body.voices)) setVoiceOptions(body.voices);
      }).catch(() => void 0);
      return () => {
        alive = false;
      };
    }, []);
    const [notifyEnabled2, setNotifyEnabled] = useState(true);
    const [clickSound, setClickSound] = useState(true);
    const [whisperImage, setWhisperImage] = useState(false);
    const [chatImage, setChatImage] = useState(false);
    const [chatAnimation, setChatAnimation] = useState(true);
    const [confineScreen, setConfineScreen] = useState(false);
    const [trayEnabled, setTrayEnabled] = useState(true);
    const [voiceEnabled2, setVoiceEnabled] = useState(false);
    const [voiceName2, setVoiceName] = useState("zh-CN-XiaoyiNeural");
    const [voiceVolume2, setVoiceVolume] = useState(1);
    const [voiceWhisperEnabled, setVoiceWhisperEnabled] = useState(false);
    const [voiceTodoEnabled, setVoiceTodoEnabled] = useState(false);
    const [voiceOptions, setVoiceOptions] = useState([]);
    const [physics, setPhysics] = useState({ ...DEFAULT_PHYSICS });
    const [font, setFont] = useState({ ...DEFAULT_FONT });
    const [weights, setWeights] = useState({ ...DEFAULT_WEIGHTS });
    const [whisperModel, setWhisperModel] = useState({ provider: "", model: "" });
    const [chatModel, setChatModel] = useState({ provider: "", model: "" });
    const [chatMemory, setChatMemory] = useState(10);
    const [chatImageLimit, setChatImageLimit] = useState(20);
    const [avatarVersion, setAvatarVersion] = useState(Date.now());
    const [avatarBusy, setAvatarBusy] = useState(false);
    const applyConfig = useCallback(
      (merged) => {
        const entries = readConfigEntries(merged);
        const patch = readMainConfig(merged);
        if (entries === null || patch === null) throw new Error("Invalid config response");
        replace(entries);
        if (patch.notificationsEnabled !== void 0) setNotifyEnabled(patch.notificationsEnabled);
        if (patch.clickSoundEnabled !== void 0) setClickSound(patch.clickSoundEnabled);
        if (patch.whisperImageEnabled !== void 0) setWhisperImage(patch.whisperImageEnabled);
        if (patch.chatImageEnabled !== void 0) setChatImage(patch.chatImageEnabled);
        if (patch.chatAnimationEnabled !== void 0) setChatAnimation(patch.chatAnimationEnabled);
        if (patch.confineToScreen !== void 0) setConfineScreen(patch.confineToScreen);
        if (patch.trayEnabled !== void 0) setTrayEnabled(patch.trayEnabled);
        if (patch.voiceEnabled !== void 0) setVoiceEnabled(patch.voiceEnabled);
        if (patch.voiceName !== void 0) setVoiceName(patch.voiceName);
        if (patch.voiceVolume !== void 0) setVoiceVolume(patch.voiceVolume);
        if (patch.voiceWhisperEnabled !== void 0) setVoiceWhisperEnabled(patch.voiceWhisperEnabled);
        if (patch.voiceTodoEnabled !== void 0) setVoiceTodoEnabled(patch.voiceTodoEnabled);
        if (patch.physics !== void 0) setPhysics(patch.physics);
        if (patch.font !== void 0) setFont(patch.font);
        if (patch.animationWeights !== void 0) setWeights(patch.animationWeights);
        if (patch.whisperModel !== void 0) setWhisperModel(patch.whisperModel);
        if (patch.chatModel !== void 0) setChatModel(patch.chatModel);
        if (patch.chatMemoryRounds !== void 0) setChatMemory(patch.chatMemoryRounds);
        if (patch.chatImageLimit !== void 0) setChatImageLimit(patch.chatImageLimit);
      },
      [replace]
    );
    const { loadState, retry } = useConfigLoad(rt, applyConfig);
    const busy = saving || loadState !== "ready";
    const toggleNotify = async (v) => {
      setNotifyEnabled(v);
      if (v) await requestNotificationPermission();
    };
    const testNotification = () => void runNotificationTest({ t, report: setPermMsg });
    const cur = pets.find((p) => p.id === selId) ?? null;
    const avatarEditable = cur !== null && cur.assetRoot !== void 0 && cur.assetRoot !== "main";
    const uploadAvatar = (file) => {
      if (cur === null) return;
      const assetRoot = cur.assetRoot ?? "";
      setAvatarBusy(true);
      void (async () => {
        try {
          const result = await uploadPetAvatar(assetRoot, file);
          if (!result.ok) {
            setMsg({ kind: "err", text: result.message });
            return;
          }
          setAvatarVersion(Date.now());
          setMsg({ kind: "ok", text: t("avatarUploaded") });
        } catch (error) {
          setMsg({ kind: "err", text: error instanceof Error ? error.message : String(error) });
        } finally {
          setAvatarBusy(false);
        }
      })();
    };
    const packCount = kinds.filter((item) => item.kind === "pack").length;
    const globalFlags = {
      notificationsEnabled: notifyEnabled2,
      clickSoundEnabled: clickSound,
      confineToScreen: confineScreen,
      trayEnabled
    };
    const chatFlags = {
      whisperImageEnabled: whisperImage,
      chatImageEnabled: chatImage,
      chatAnimationEnabled: chatAnimation
    };
    const flagSetters = {
      notificationsEnabled: (value) => void toggleNotify(value),
      clickSoundEnabled: setClickSound,
      confineToScreen: setConfineScreen,
      trayEnabled: setTrayEnabled,
      whisperImageEnabled: setWhisperImage,
      chatImageEnabled: setChatImage,
      chatAnimationEnabled: setChatAnimation
    };
    const setGlobalFlag = (key, value) => flagSetters[key](value);
    const setChatFlag = (key, value) => flagSetters[key](value);
    const patchFont = (patch) => setFont((current2) => ({ ...current2, ...patch }));
    const patchPhysics = (patch) => setPhysics((current2) => ({ ...current2, ...patch }));
    const setModel = (key, value) => {
      if (key === "whisperModel") setWhisperModel(value);
      else setChatModel(value);
    };
    const write = createWriteFlow({
      fields: () => ({
        // PUT /config 只写用户主配置：只能提交 main 层实例，pack 实例走 POST /pet-config。
        pets: mainPets,
        notificationsEnabled: notifyEnabled2,
        clickSoundEnabled: clickSound,
        whisperImageEnabled: whisperImage,
        chatImageEnabled: chatImage,
        chatAnimationEnabled: chatAnimation,
        confineToScreen: confineScreen,
        trayEnabled,
        voiceEnabled: voiceEnabled2,
        voiceName: voiceName2,
        voiceVolume: voiceVolume2,
        voiceWhisperEnabled,
        voiceTodoEnabled,
        physics,
        whisperModel,
        chatModel,
        chatMemoryRounds: chatMemory,
        chatImageLimit,
        font,
        animationWeights: weights
      }),
      busy: () => busy,
      setBusy,
      setMsg,
      setDialog,
      dialog: () => dialog,
      applyConfig,
      packWrites,
      userFile: () => paths?.user ?? "",
      t,
      onRemove: remove
    });
    const saveRef = useRef(() => {
    });
    useEffect(() => {
      saveRef.current = () => void write.save();
    });
    useEffect(() => {
      const onKey = (e) => {
        if (!(e.ctrlKey || e.metaKey) || e.shiftKey || e.altKey) return;
        if (e.key.toLowerCase() !== "s") return;
        const root = rootRef.current;
        if (!root || !root.isConnected || root.getClientRects().length === 0) return;
        e.preventDefault();
        saveRef.current();
      };
      document.addEventListener("keydown", onKey);
      return () => document.removeEventListener("keydown", onKey);
    }, []);
    return h("section", {
      ref: rootRef,
      className: "dsh-pet-cfg",
      style: { maxWidth: "720px" },
      children: [
        // 标题：intro 与「额外宠物」说明都收进问号。
        h("h2", {
          className: "dsh-pet-cfg__title",
          children: [
            t("nav"),
            q(packCount > 0 ? t("intro") + "\n" + t("extraPetsHint").replace("{n}", String(packCount)) : t("intro"))
          ]
        }),
        h(LoadStatus, { loadState, onRetry: retry }),
        h(KindTabs, { kinds, kind, busy, onSelect: selectKind }),
        h(PetTabs, { pets: visiblePets, selId, busy, onSelect: select, onAdd: add }),
        h(PetCard, {
          pet: cur,
          busy,
          msg,
          entryPrompt,
          // 预览与聊天面板同一个地址：内置回默认 logo，所以无需区分「有没有头像」。
          avatarSrc: avatarUrl(cur?.assetRoot ?? "", avatarVersion),
          avatarBusy,
          // 内置条目没有这个能力：不传 onAvatar，卡片就只渲染预览。
          ...avatarEditable ? { onAvatar: uploadAvatar } : {},
          onChange: update,
          onSave: () => void write.save(),
          onRemove: requestRemove
        }),
        h(GlobalCard, { busy, values: globalFlags, onChange: setGlobalFlag }),
        h(VoiceCard, {
          busy,
          enabled: voiceEnabled2,
          voiceName: voiceName2,
          volume: voiceVolume2,
          voices: voiceOptions,
          whisperEnabled: voiceWhisperEnabled,
          todoEnabled: voiceTodoEnabled,
          onToggle: setVoiceEnabled,
          onVoiceChange: setVoiceName,
          onVolumeChange: setVoiceVolume,
          onWhisperToggle: setVoiceWhisperEnabled,
          onTodoToggle: setVoiceTodoEnabled
        }),
        h(FontCard, { busy, font, onChange: patchFont }),
        h("p", { className: "dsh-pet-cfg__note", children: "\u5BF9\u8BDD\u4E0E\u788E\u788E\u5FF5\u4F7F\u7528\u5FC6\u4F34\u5DF2\u914D\u7F6E\u7684 AI \u6A21\u578B\u3002\u56FE\u7247\u3001\u8BED\u97F3\u8F93\u5165\u8BF7\u5728\u4E3B\u804A\u5929\u4E2D\u4F7F\u7528\u3002" }),
        h(PhysicsCard, { busy, physics, onChange: patchPhysics }),
        h(MotionCard, { busy, weights, onChange: setWeights }),
        h(Actions, {
          busy,
          msg,
          permMsg,
          onSave: () => void write.save(),
          onSync: write.requestSync,
          onTestNotification: testNotification
        }),
        // 保存按钮以下是参考类卡片：只读说明，改不改都不用点保存。
        // 落盘位置两张卡都靠 meta，读不到就整块不出现。
        dialog ? h(SettingsDialog, { dialog, selId, onDismiss: () => setDialog(null), onConfirm: write.confirmDialog }) : null
      ]
    });
  };
}

// vendor/dsh-pet/src/client/pet/click-sound.ts
var CLICK_SOUND_URL = ROUTE_PATH + "/sound/click-duck.wav";
var CLICK_SOUND_THROTTLE_MS = 100;
var lastClickSoundAt = 0;
var clickSoundEnabled = false;
function setClickSoundEnabled(enabled) {
  clickSoundEnabled = enabled;
}
function playClickSound() {
  if (!clickSoundEnabled) return;
  const now = Date.now();
  if (now - lastClickSoundAt < CLICK_SOUND_THROTTLE_MS) return;
  lastClickSoundAt = now;
  try {
    const Context = window.AudioContext;
    if (!Context) return;
    const context = new Context();
    const oscillator = context.createOscillator(), gain = context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(650, context.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(350, context.currentTime + 0.08);
    gain.gain.setValueAtTime(0.08, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(1e-3, context.currentTime + 0.1);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.onended = () => {
      void context.close();
    };
    oscillator.start();
    oscillator.stop(context.currentTime + 0.11);
  } catch {
  }
}

// vendor/dsh-pet/src/client/menu-service.ts
var labels = /* @__PURE__ */ new Map();
var marks = /* @__PURE__ */ new Map();
function setMenuItems(items) {
  labels.clear();
  for (const item of items) {
    const list = labels.get(item.owner);
    if (list === void 0) labels.set(item.owner, [item.label]);
    else if (!list.includes(item.label)) list.push(item.label);
  }
  for (const [owner, entry] of marks) {
    const list = labels.get(owner);
    if (list === void 0) {
      marks.delete(owner);
      continue;
    }
    for (const label of [...entry.keys()]) {
      if (!list.includes(label)) entry.delete(label);
    }
  }
}
function setMenuClick(owner, label, pet) {
  let entry = marks.get(owner);
  if (entry === void 0) {
    entry = /* @__PURE__ */ new Map();
    marks.set(owner, entry);
  }
  entry.set(label, pet);
}

// vendor/dsh-pet/src/client/pet/menu-actions.ts
async function switchDisplay(deps, display) {
  try {
    const response = await fetch(ROUTE_PATH + "/pet-display", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: deps.petId, display })
    });
    if (!response.ok) throw new Error("pet-display HTTP " + response.status);
    const body = await response.json();
    if (body.ok === false) throw new Error("pet-display \u88AB\u62D2\uFF1A" + String(body.reason ?? ""));
    deps.applyMerged(body);
  } catch (error) {
    deps.warn("[dsh-pet] \u663E\u793A\u4F4D\u7F6E\u5207\u6362\u5931\u8D25 " + (error instanceof Error ? error.message : String(error)));
  }
}
function createMenuActions(deps) {
  const { petId } = deps;
  const fireAction = (route, label) => {
    postAction(route).then((ok) => {
      if (!ok) deps.warn("[dsh-pet] " + label + "\u5931\u8D25 pet=" + petId);
    }).catch((error) => deps.warn("[dsh-pet] " + label + "\u5F02\u5E38 pet=" + petId + " " + String(error)));
  };
  const run = (leaf2, playbackId, keepFacing = false, hostInstruction = false) => {
    if (!hostInstruction && deps.sleeping?.() === true && deps.locked?.() !== true && !isSleepAllowedAction(leaf2.action)) {
      const pool = deps.sleepRefuseTexts?.() ?? [];
      const text = pool[Math.floor(Math.random() * pool.length)];
      if (text !== void 0) deps.say?.(text);
      return;
    }
    if (leaf2.action === "third-party") {
      const owner = leaf2.owner ?? "";
      if (owner !== "") {
        setMenuClick(owner, leaf2.label, petId);
        postAction(ROUTE_PATH + "/menu/click", { owner, label: leaf2.label, pet: petId }).catch(
          (error) => deps.warn("[dsh-pet] \u7B2C\u4E09\u65B9\u83DC\u5355\u70B9\u51FB\u4E0A\u62A5\u5931\u8D25 " + String(error))
        );
      }
      return;
    }
    if (leaf2.action === "sleep" || leaf2.action === "wake") {
      const route = leaf2.action === "sleep" ? "/sleep" : "/wake";
      console.info("[dsh-pet] \u83DC\u5355" + (leaf2.action === "sleep" ? "\u7761\u89C9" : "\u8D77\u6765") + " pet=" + petId);
      fireAction(ROUTE_PATH + route + "?pet=" + encodeURIComponent(petId), leaf2.action === "sleep" ? "\u7761\u89C9" : "\u8D77\u6765");
      return;
    }
    if (leaf2.action === "show-balance") {
      console.info("[dsh-pet] \u83DC\u5355\u67E5\u770B\u4F59\u989D pet=" + petId);
      fireAction(ROUTE_PATH + "/balance", "\u4F59\u989D\u5237\u65B0\u52A8\u4F5C");
      return;
    }
    if (leaf2.action === "whisper") {
      console.info("[dsh-pet] \u83DC\u5355\u89E6\u53D1\u788E\u788E\u5FF5 pet=" + petId + (leaf2.image ? " image=" + leaf2.image : ""));
      const pic = leaf2.image ? "&image=" + encodeURIComponent(leaf2.image) : "";
      fireAction(ROUTE_PATH + "/whisper?pet=" + encodeURIComponent(petId) + "&surface=web" + pic, "\u788E\u788E\u5FF5\u624B\u52A8\u89E6\u53D1");
      return;
    }
    if (leaf2.action === "chat") {
      deps.openChat();
      return;
    }
    if (leaf2.action === "todo") {
      deps.openTodo();
      return;
    }
    if (leaf2.action === "set-display") {
      const display = leaf2.display;
      if (!display) return;
      console.info("[dsh-pet] \u83DC\u5355\u5207\u6362\u663E\u793A\u4F4D\u7F6E pet=" + petId + " display=" + display);
      void switchDisplay(deps, display);
      return;
    }
    if (leaf2.action === "home") {
      deps.stopThrow();
      deps.stopMove();
      deps.resetPosition();
      return;
    }
    if (!leaf2.anim) return;
    const cuePlaybackId = playbackId ?? null;
    if (!keepFacing && isNoMirrorAnimation(deps.animations().categories, leaf2.anim) && deps.isFacingRight()) {
      deps.faceLeft();
    }
    const movies = deps.animations().moves.actions;
    if (movies.some((action) => action.name === leaf2.anim)) {
      if (deps.tryMove(leaf2.anim) === false) {
        deps.stopMove();
        deps.playOnce(leaf2.anim, cuePlaybackId);
      } else if (cuePlaybackId !== null) {
        deps.report(cuePlaybackId, "failed", "busy");
      }
      return;
    }
    deps.stopMove();
    deps.playOnce(leaf2.anim, cuePlaybackId);
  };
  return { run };
}

// vendor/dsh-pet/src/client/pet/playback-report.ts
function playbackReportRequest(playbackId, status, reason) {
  return {
    url: ROUTE_PATH + "/playback/" + encodeURIComponent(playbackId) + "/report",
    body: reason === void 0 ? { status } : { status, reason }
  };
}
function makePlaybackReporter(o) {
  return (playbackId, status, reason) => {
    const request = playbackReportRequest(playbackId, status, reason);
    void postAction(request.url, request.body).then((ok) => {
      if (!ok) {
        console.warn("[dsh-pet] \u64AD\u653E\u56DE\u6267\u672A\u9001\u8FBE pet=" + o.petId + " id=" + playbackId + " status=" + status);
      }
    });
  };
}

// vendor/dsh-pet/src/client/pet/animation/next-animation.ts
function decideNextAnimation(input) {
  const { kind, animations, facing, current: current2, move } = input;
  if (kind === "idle") return { kind: "IDLE", anim: pick(animations.idle, current2), play: true };
  if (kind === "turn") return { kind: "TURN", anim: pick(animations.turn, current2), play: true };
  if (kind === "move" && move !== false && move !== void 0) {
    return { kind: "MOVES", anim: typeof move === "string" ? move : null, play: false };
  }
  const action = pickCategoryAction(animations.categories, animations.idle, facing, current2);
  return { kind: action.id, anim: action.name, play: true };
}

// vendor/dsh-pet/src/client/pet/card/sleep-machine.ts
function createSleepMachine(hub, pickNext, log4) {
  let current2 = null;
  const play = (name, once) => {
    hub.card.actions.setOnce(once);
    hub.card.actions.setAnim(name);
    hub.card.actions.bumpSeq();
  };
  const apply = (state) => {
    const petId = hub.cfg().id;
    if (state.sleeping) {
      if (current2 !== null) return;
      hub.stopMotion();
      hub.bubbles.hideWork();
      current2 = { set: { start: state.start, loop: state.loop, end: state.end }, phase: "start" };
      log4(petId, "\u7761\u89C9 -> [" + state.start + "]");
      play(state.start, true);
      return;
    }
    if (current2 === null || current2.phase === "end") return;
    if (current2.phase === "start") {
      current2 = null;
      log4(petId, "\u5165\u7761\u88AB\u6253\u65AD\uFF1A\u4E0D\u64AD\u8D77\u6765");
      return;
    }
    current2.phase = "end";
    log4(petId, "\u9192\u6765 -> [" + current2.set.end + "]");
    play(current2.set.end, true);
  };
  return {
    apply,
    consumeEnded: () => {
      if (current2 === null) return false;
      if (current2.phase === "start") {
        current2.phase = "loop";
        play(current2.set.loop, false);
        return true;
      }
      if (current2.phase === "loop") {
        play(current2.set.loop, false);
        return true;
      }
      current2 = null;
      pickNext();
      return true;
    },
    sleeping: () => current2 !== null,
    phase: () => current2?.phase ?? null
  };
}

// vendor/dsh-pet/src/client/pet/card/animation-flow.ts
var stamp = () => (/* @__PURE__ */ new Date()).toTimeString().slice(0, 8);
var log = (petId, message) => {
  console.log("[dsh-pet] " + stamp() + " pet=" + petId + " " + message);
};
function createAnimationFlow(rt) {
  const { useRef } = rt;
  return function useAnimationFlow(hub, workStatus) {
    const workStatusRef = useRef(workStatus);
    workStatusRef.current = workStatus;
    const machineRef = useRef(null);
    const sleep2 = () => machineRef.current ??= createSleepMachine(hub, pickNext, log);
    const sleeping = () => sleep2().sleeping();
    const sleepPhase = () => sleep2().phase();
    const applySleep = (state) => sleep2().apply(state);
    const resumeWorkStatusAnim = () => {
      const card = hub.card;
      if (hub.ownAnim.isFrozen()) return false;
      if (sleeping()) return false;
      const ws = workStatusRef.current;
      if (!ws || !ws.state || ws.state === "success" || ws.state === "error") return false;
      const pool = hub.anims().events?.workStatus;
      if (!pool || pool.length === 0) return false;
      const idx = WORK_STATUS_INDEX[ws.state];
      const slot = pool[idx];
      if (slot === void 0) return false;
      const name = pickSlot(slot, card.animRef.current);
      log(hub.cfg().id, "\u4E92\u52A8\u7ED3\u675F\u6062\u590D\u72B6\u6001\u52A8\u753B: " + name);
      card.actions.setOnce(Array.isArray(slot) && slot.length > 1);
      card.actions.setAnim(name);
      return true;
    };
    const pickNext = () => {
      const card = hub.card;
      if (hub.ownAnim.isFrozen()) return;
      if (sleeping()) return;
      const roll = Math.random();
      const kind = rollKind(roll, hub.cfg().animationWeights, { fixed: hub.cfg().fixedEnabled });
      const move = kind === "move" ? hub.tryWalk() : void 0;
      const decision = decideNextAnimation({
        kind,
        animations: hub.anims(),
        facing: card.facingRef.current,
        current: card.animRef.current,
        move
      });
      log(
        hub.cfg().id,
        "facing=" + card.facingRef.current + " roll=" + roll.toFixed(4) + " -> [" + decision.kind + "] " + (decision.anim ?? "\u79FB\u52A8\u8FDB\u884C\u4E2D(\u4E0D\u91CD\u64AD)")
      );
      if (decision.play && decision.anim !== null) card.actions.setAnim(decision.anim);
      card.actions.setOnce(true);
      card.actions.bumpSeq();
    };
    const applyEndedCue = (cue) => {
      const card = hub.card;
      if (sleep2().consumeEnded()) return;
      if (cue.kind === "ignore") return;
      if (cue.kind === "work-rotate") {
        card.actions.setOnce(true);
        card.actions.setAnim(cue.anim);
        card.actions.bumpSeq();
        return;
      }
      if (cue.kind === "work-replay") {
        card.actions.setOnce(false);
        card.actions.bumpSeq();
        return;
      }
      if (cue.kind === "event-done") {
        if (resumeWorkStatusAnim()) return;
        if (hub.anims().idle.length) card.actions.setAnim(pick(hub.anims().idle, card.animRef.current));
        card.actions.setOnce(true);
        card.actions.bumpSeq();
        return;
      }
      if (cue.kind === "turn") {
        const next = card.state.facing === "left" ? "right" : "left";
        card.actions.setFacing(next);
        card.facingRef.current = next;
        return;
      }
      if (cue.kind === "interaction-done") {
        if (resumeWorkStatusAnim()) return;
        if (hub.anims().idle.length) card.actions.setAnim(pick(hub.anims().idle, card.animRef.current));
        card.actions.setOnce(true);
        card.actions.bumpSeq();
        return;
      }
      pickNext();
    };
    const speak2 = (text, image, url, duration, anim) => {
      const card = hub.card;
      let name = null;
      if (anim !== false && !sleeping()) {
        const pool = hub.anims().events?.whisper;
        if (!pool || pool.length === 0) {
          console.error("[dsh-pet] \u914D\u7F6E\u7F3A\u5C11 animations.events.whisper\uFF0C\u65E0\u6CD5\u64AD\u653E\u788E\u788E\u5FF5\u52A8\u753B");
          return;
        }
        name = pickSlot(pick(pool, card.animRef.current), card.animRef.current);
      }
      log(hub.cfg().id, "whisper" + (name === null ? " \uFF08\u4E0D\u8054\u52A8\u52A8\u753B\uFF09" : " -> [" + name + "]") + " \u300C" + text + "\u300D");
      if (name !== null) {
        hub.stopMotion();
        card.actions.setOnce(true);
        card.actions.setAnim(name);
      }
      hub.bubbles.showWhisper(text, { image, url }, duration);
    };
    return { applyEndedCue, applySleep, pickNext, resumeWorkStatusAnim, sleepPhase, sleeping, speak: speak2 };
  };
}

// vendor/dsh-pet/src/shared/bubble-hold.ts
var BUBBLE_HOLD_TAIL_MS = 1500;
var BUBBLE_HOLD_MAX_MS = 5e4;
var BUBBLE_HOLD_IDLE = { on: false, delayMs: null, holdSeq: null };
function reduceBubbleHold(state, event) {
  if (event.kind === "show") return { delayMs: Math.max(0, event.durationMs), holdSeq: null, on: true };
  if (event.kind === "clear") return BUBBLE_HOLD_IDLE;
  if (event.kind === "hide") return state.on ? BUBBLE_HOLD_IDLE : state;
  if (!state.on) return state;
  if (event.kind === "hold") {
    if (state.holdSeq === event.seq) return state;
    return { delayMs: BUBBLE_HOLD_MAX_MS, holdSeq: event.seq, on: true };
  }
  if (state.holdSeq !== event.seq) return state;
  return { delayMs: BUBBLE_HOLD_TAIL_MS, holdSeq: null, on: true };
}

// vendor/dsh-pet/src/shared/voice.ts
var voiceName = "";
var voiceEnabled = false;
var voiceVolume = 1;
var surface = null;
var voiceBase = ROUTE_PATH;
var configLoaded = false;
var voiceState = "idle";
var stateListeners = /* @__PURE__ */ new Set();
var utteranceListeners = /* @__PURE__ */ new Set();
var utteranceSeq = 0;
var VOICE_SPEECH_MAX_CHARS = 60;
var SPEAK_TIMEOUT_MS = 3e4;
function speakSignal() {
  return AbortSignal.timeout(SPEAK_TIMEOUT_MS);
}
function setVoiceState(next) {
  if (voiceState === next) return;
  voiceState = next;
  for (const listener of stateListeners) listener(next);
}
function subscribeVoiceState(listener) {
  stateListeners.add(listener);
  listener(voiceState);
  return () => {
    stateListeners.delete(listener);
  };
}
function subscribeVoiceUtterance(listener) {
  utteranceListeners.add(listener);
  return () => {
    utteranceListeners.delete(listener);
  };
}
function emitUtterance(event) {
  for (const listener of utteranceListeners) listener(event);
}
function speechSlice(text) {
  if (text.length <= VOICE_SPEECH_MAX_CHARS) return text;
  const head = text.slice(0, VOICE_SPEECH_MAX_CHARS);
  const cut = Math.max(
    ...["\u3002", "\uFF01", "\uFF1F", "\uFF1B", "\uFF0C", ".", "!", "?", ";", ","].map((mark) => head.lastIndexOf(mark))
  );
  return cut >= VOICE_SPEECH_MAX_CHARS / 2 ? head.slice(0, cut + 1) : head;
}
function setSurface(next) {
  if (next === "web" || next === "desktop") surface = next;
}
function setVoiceConfig(name, enabled, volume) {
  voiceName = typeof name === "string" ? name : "";
  voiceEnabled = enabled === true;
  voiceVolume = clampVolume(volume);
  configLoaded = true;
}
function clampVolume(value) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 1;
}
async function loadConfigOnce() {
  if (configLoaded) return;
  try {
    const response = await fetch(voiceBase + "/config", { cache: "no-store" });
    const body = await response.json();
    const main = body?.main;
    voiceName = typeof main?.voiceName === "string" ? main.voiceName : "";
    voiceEnabled = main?.voiceEnabled === true;
    voiceVolume = clampVolume(main?.voiceVolume);
    configLoaded = true;
  } catch {
  }
}
function playSayVoice(say) {
  const isMine = say.voiceTo !== void 0 && say.voiceTo === surface;
  if (!say.text || !isMine) {
    setVoiceState("idle");
    return;
  }
  if (surface === "web" && typeof document !== "undefined" && document.hidden) {
    setVoiceState("idle");
    return;
  }
  void speakIfEnabled(say.text);
}
async function speakIfEnabled(text) {
  await loadConfigOnce();
  if (!voiceEnabled) {
    setVoiceState("idle");
    return;
  }
  const seq = ++utteranceSeq;
  emitUtterance({ kind: "start", seq, text });
  setVoiceState("loading");
  try {
    await speak(speechSlice(text));
  } finally {
    emitUtterance({ kind: "end", seq, text });
  }
}
async function speak(text) {
  try {
    const response = await fetch(voiceBase + "/voice/speak", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text, ...voiceName ? { voice: voiceName } : {} }),
      signal: speakSignal()
    });
    if (!response.ok || !(response.headers.get("content-type") ?? "").includes("audio")) {
      setVoiceState("failed");
      return;
    }
    const objectUrl = URL.createObjectURL(await response.blob());
    const audio = new Audio(objectUrl);
    audio.volume = voiceVolume;
    audio.onended = () => URL.revokeObjectURL(objectUrl);
    audio.onerror = () => URL.revokeObjectURL(objectUrl);
    setVoiceState("ready");
    await audio.play();
  } catch {
    setVoiceState("failed");
  }
}

// vendor/dsh-pet/src/client/pet/timings.ts
var BUBBLE_DURATION_MS = 10 * 1e3;
var STATE_WAIT_MS = 1e3;
var STATE_FALLBACK_MS = 1e3;

// vendor/dsh-pet/src/client/pet/card/bubble-slots.ts
function decideBubbleSlot(input) {
  if (input.todoOn) return "todo";
  if (input.workTerminal && input.workOn && input.workText && input.workStatusEnabled) return "work-terminal";
  if (input.whisperOn && input.whisperText) return "whisper";
  if (input.balanceOn && input.balanceAvailable && (input.balanceEnabled || input.balanceManual)) return "balance";
  if (input.workOn && input.workText && input.workStatusEnabled) return "work";
  return "none";
}
function balancePageCount2(balance) {
  return balance ? balancePageCount(balance) : 1;
}
function createBubbleSlots(rt, components) {
  const { h, useState, useRef, useEffect } = rt;
  const BalanceBubble = components.balanceBubble;
  const TodoBubble = components.todoBubble;
  const WhisperBubble = components.whisperBubble;
  return function useBubbleSlots(input) {
    const [balanceOn, setBalanceOn] = useState(false);
    const [balancePage, setBalancePage] = useState(0);
    const balanceTimerRef = useRef(null);
    const [whisperOn, setWhisperOn] = useState(false);
    const [whisperText, setWhisperText] = useState(null);
    const [whisperImage, setWhisperImage] = useState(void 0);
    const [whisperUrl, setWhisperUrl] = useState(void 0);
    const whisperHoldRef = useRef(BUBBLE_HOLD_IDLE);
    const whisperTextRef = useRef(null);
    const whisperTimerRef = useRef(null);
    const [todoOn, setTodoOn] = useState(false);
    const [workOn, setWorkOn] = useState(false);
    const [workText, setWorkText] = useState(null);
    const workTimerRef = useRef(null);
    const [voiceState2, setVoiceState2] = useState("idle");
    useEffect(() => subscribeVoiceState(setVoiceState2), []);
    useEffect(
      () => () => {
        if (balanceTimerRef.current !== null) window.clearTimeout(balanceTimerRef.current);
        if (whisperTimerRef.current !== null) window.clearTimeout(whisperTimerRef.current);
        if (workTimerRef.current !== null) window.clearTimeout(workTimerRef.current);
      },
      []
    );
    const armBalanceTimeout = () => {
      if (balanceTimerRef.current !== null) window.clearTimeout(balanceTimerRef.current);
      balanceTimerRef.current = window.setTimeout(() => setBalanceOn(false), BUBBLE_DURATION_MS);
    };
    const showBalance = () => {
      setBalancePage(0);
      setBalanceOn(true);
      armBalanceTimeout();
    };
    const cycleBalance = () => {
      const pages = balancePageCount2(input.balance);
      setBalancePage((page) => (page + 1) % pages);
      armBalanceTimeout();
    };
    const applyWhisperHold = (event) => {
      const next = reduceBubbleHold(whisperHoldRef.current, event);
      if (next === whisperHoldRef.current) return;
      whisperHoldRef.current = next;
      setWhisperOn(next.on);
      if (whisperTimerRef.current !== null) window.clearTimeout(whisperTimerRef.current);
      whisperTimerRef.current = null;
      if (next.delayMs === null) return;
      whisperTimerRef.current = window.setTimeout(() => {
        whisperTimerRef.current = null;
        applyWhisperHold({ kind: "hide" });
      }, next.delayMs);
    };
    useEffect(
      () => subscribeVoiceUtterance((event) => {
        if (event.text !== whisperTextRef.current) return;
        applyWhisperHold({ kind: event.kind === "start" ? "hold" : "release", seq: event.seq });
      }),
      // eslint-disable-next-line react-hooks/exhaustive-deps -- 订阅只建一次：收起计划全部经 ref 现读，重订阅只会漏事件
      []
    );
    const showWhisper = (text, parts, duration) => {
      if (duration === 0) return;
      setWhisperText(text);
      whisperTextRef.current = text;
      setWhisperImage(parts.image);
      setWhisperUrl(parts.url);
      applyWhisperHold({ durationMs: duration ?? BUBBLE_DURATION_MS, kind: "show" });
    };
    const clearWhisper = () => {
      whisperTextRef.current = null;
      setWhisperText(null);
      setWhisperImage(void 0);
      applyWhisperHold({ kind: "clear" });
    };
    const lightWork = (terminal) => {
      setWorkOn(true);
      if (workTimerRef.current !== null) window.clearTimeout(workTimerRef.current);
      workTimerRef.current = terminal ? window.setTimeout(() => setWorkOn(false), BUBBLE_DURATION_MS) : null;
    };
    const hideWork = () => {
      if (workTimerRef.current !== null) window.clearTimeout(workTimerRef.current);
      workTimerRef.current = null;
      setWorkOn(false);
    };
    const resetWork = () => {
      hideWork();
      setWorkText(null);
    };
    const showTodo = () => setTodoOn(true);
    const hideTodo = () => setTodoOn(false);
    const toggleTodo = () => setTodoOn((on) => !on);
    const node = () => {
      const slot = decideBubbleSlot({
        todoOn,
        workTerminal: input.workTerminal,
        workOn,
        workText,
        workStatusEnabled: input.workStatusEnabled,
        whisperOn,
        whisperText,
        balanceOn,
        balanceAvailable: input.balance !== null,
        balanceEnabled: input.balanceEnabled,
        balanceManual: input.balanceManual
      });
      if (slot === "todo") return h(TodoBubble, { on: todoOn, onClose: hideTodo });
      if (slot === "balance") {
        return input.balance === null ? null : h(BalanceBubble, { state: input.balance, on: balanceOn, index: balancePage, onCycle: cycleBalance });
      }
      if (slot === "whisper") {
        return whisperText === null ? null : h(WhisperBubble, {
          text: whisperText,
          image: whisperImage,
          url: whisperUrl,
          assetRoot: input.assetRoot,
          on: whisperOn,
          voiceState: voiceState2
        });
      }
      if (slot === "work" || slot === "work-terminal") {
        if (workText === null) return null;
        const sessionId = input.workSessionId ?? "";
        const onFocus = input.onFocusSession;
        const onClick = sessionId !== "" && onFocus !== void 0 ? () => onFocus(sessionId) : void 0;
        return h(WhisperBubble, {
          text: workText,
          on: workOn,
          ...onClick === void 0 ? {} : { onClick }
        });
      }
      return null;
    };
    return {
      clearWhisper,
      cycleBalance,
      hideTodo,
      hideWork,
      lightWork,
      node,
      resetWork,
      showBalance,
      showTodo,
      showWhisper,
      toggleTodo,
      updateWorkText: setWorkText
    };
  };
}

// vendor/dsh-pet/src/client/pet/animation/cues.ts
var isWorkActive = (state) => state !== null && state !== void 0 && state !== "success" && state !== "error";
function decideEndedCue(input) {
  const { animations, current: current2, workState } = input;
  const isEvent = isEventAnim(animations.events, current2);
  if (isEvent && isWorkActive(workState)) {
    const nextWork = nextWorkStatusAnim(animations.events?.workStatus ?? [], current2);
    if (nextWork !== null) return { kind: "work-rotate", anim: nextWork };
    if (poolIncludes(animations.events?.workStatus ?? [], current2)) return { kind: "work-replay" };
  }
  if (isEvent) return { kind: "event-done" };
  if (animations.turn.includes(current2)) return { kind: "turn" };
  if (animations.drag.includes(current2) || animations.clicks.includes(current2)) return { kind: "interaction-done" };
  return { kind: "random" };
}

// vendor/dsh-pet/src/client/pet/animation/asset-loader.ts
function createAssetLoader(timeoutMs) {
  const inflight = /* @__PURE__ */ new Set();
  return {
    load: (url, handlers) => {
      const controller = new AbortController();
      inflight.add(controller);
      const timer = window.setTimeout(() => controller.abort(), timeoutMs);
      const settle = () => {
        window.clearTimeout(timer);
        inflight.delete(controller);
      };
      fetch(url, { cache: "default", signal: controller.signal }).then((response) => {
        if (!response.ok) throw new Error("asset HTTP " + response.status);
        return response.blob();
      }).then((blob) => {
        settle();
        handlers.onObjectUrl(URL.createObjectURL(blob));
      }).catch((error) => {
        settle();
        handlers.onError(error);
      });
    },
    abortAll: () => {
      for (const controller of inflight) controller.abort();
      inflight.clear();
    },
    release: (objectUrl) => {
      URL.revokeObjectURL(objectUrl);
    }
  };
}

// vendor/dsh-pet/src/client/pet/animation/assets.ts
function animationAssetUrl(source) {
  if (source.cueUrl) return source.cueUrl;
  const root = source.assetRoot === "" ? source.id : source.assetRoot;
  return ROUTE_PATH + "/thumb/" + encodeURIComponent(root) + "/" + encodeURIComponent(source.anim) + source.ext;
}

// vendor/dsh-pet/src/client/pet/animation/media.ts
var resolvedExt = null;
function prefersMov() {
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/i.test(ua)) return true;
  if (/Chrome|Chromium|Edg|OPR|Firefox|FxiOS/i.test(ua)) return false;
  return /Mac/i.test(navigator.platform || ua);
}
function thumbExt() {
  if (resolvedExt === null) {
    const explicit = ANIMATION_EXT;
    resolvedExt = explicit === ".mov" || prefersMov() ? ".mov" : ".webm";
  }
  return resolvedExt;
}

// vendor/dsh-pet/src/client/pet/animation/animation.ts
var REASON_ASSET_LOAD = "asset-load";
var REASON_PLAY_REJECTED = "play-rejected";
var REASON_DECODE = "decode-error";
var REASON_SUPERSEDED = "superseded";
var REASON_FROZEN = "frozen";
var ASSET_FETCH_TIMEOUT_MS = 1e4;
var stamp2 = (petId) => (/* @__PURE__ */ new Date()).toTimeString().slice(0, 8) + " pet=" + petId;
function createOwnAnimation(deps) {
  let front = 0;
  let pending = null;
  let gen = 0;
  let cueUrl = null;
  let playing = null;
  let frozen = deps.initiallyFrozen;
  const blobUrl = { a: null, b: null };
  const loader = deps.loader ?? createAssetLoader(ASSET_FETCH_TIMEOUT_MS);
  let mounted = true;
  const slotOf = (index) => index === 0 ? "a" : "b";
  const elementOf = (index) => index === 0 ? deps.videoA() : deps.videoB();
  const frontVideo = () => elementOf(front);
  const reportOnce = (playbackId, status, reason) => {
    if (playing === playbackId) playing = null;
    deps.report(playbackId, status, reason);
  };
  const switchTo = (next, nextOnce, cuePlaybackId) => {
    if (cuePlaybackId !== null) deps.clearCuePlayback();
    const cfg = deps.cfg();
    const url = cueUrl;
    cueUrl = null;
    if (next === "") return;
    if (pending !== null && pending.anim === next && pending.once === nextOnce) {
      if (cuePlaybackId !== null) {
        playing = cuePlaybackId;
        deps.report(cuePlaybackId, "playing");
      }
      return;
    }
    if (isEventAnim(cfg.animations.events, next)) {
      console.log("[dsh-pet] " + stamp2(cfg.id) + " switch " + next + " once=" + nextOnce);
    }
    const swapGen = gen += 1;
    pending = { anim: next, once: nextOnce, gen: swapGen };
    const targetIndex = front === 0 ? 1 : 0;
    const el = elementOf(targetIndex);
    if (el === null) return;
    el.loop = !nextOnce;
    el.muted = true;
    el.autoplay = true;
    el.playsInline = true;
    el.onended = nextOnce ? (event) => deps.onEnded(handleEnded(event)) : null;
    el.onerror = cuePlaybackId === null ? null : () => reportOnce(cuePlaybackId, "failed", REASON_DECODE);
    const assetUrl = animationAssetUrl({
      cueUrl: url,
      assetRoot: cfg.assetRoot ?? "",
      id: cfg.id,
      anim: next,
      ext: thumbExt()
    });
    loader.load(assetUrl, {
      onObjectUrl: (objectUrl) => {
        if (!mounted) {
          loader.release(objectUrl);
          return;
        }
        if (pending?.gen !== swapGen) {
          loader.release(objectUrl);
          return;
        }
        const slot = slotOf(targetIndex);
        const previous = blobUrl[slot];
        if (previous !== null) loader.release(previous);
        blobUrl[slot] = objectUrl;
        el.src = objectUrl;
        el.load();
      },
      onError: (error) => {
        if (!mounted) return;
        if (pending?.gen !== swapGen) return;
        pending = null;
        if (cuePlaybackId !== null) reportOnce(cuePlaybackId, "failed", REASON_ASSET_LOAD);
        console.warn(
          "[dsh-pet] \u7D20\u6750\u52A0\u8F7D\u5931\u8D25 pet=" + cfg.id + " anim=" + next + "\uFF1A" + (error instanceof Error ? error.message : String(error)) + "\uFF08\u5DF2\u91CA\u653E\u672C\u6B21\u5207\u6362\uFF09"
        );
      }
    });
    const onReady = () => {
      el.removeEventListener("loadeddata", onReady);
      if (pending?.gen !== swapGen) return;
      const outgoing = elementOf(front);
      el.classList.add("is-front");
      if (outgoing !== null && outgoing !== el) {
        outgoing.classList.remove("is-front");
        outgoing.onended = null;
        outgoing.onerror = null;
        outgoing.pause();
        if (playing !== null && playing !== cuePlaybackId) reportOnce(playing, "cancelled", REASON_SUPERSEDED);
      }
      front = front === 0 ? 1 : 0;
      pending = null;
      playing = cuePlaybackId;
      el.style.transform = deps.facing() === "right" ? "scaleX(-1)" : "";
      el.play().then(() => {
        if (cuePlaybackId !== null) deps.report(cuePlaybackId, "playing");
      }).catch(() => {
        if (cuePlaybackId !== null) reportOnce(cuePlaybackId, "failed", REASON_PLAY_REJECTED);
      });
      deps.onFrontReady(el);
    };
    el.addEventListener("loadeddata", onReady);
  };
  const handleEnded = (event) => {
    const endedOn = event === void 0 ? null : event.currentTarget;
    if (endedOn !== null && !endedOn.classList.contains("is-front")) return { kind: "ignore" };
    const done = playing;
    if (done !== null) {
      playing = null;
      deps.report(done, "ended");
    }
    if (deps.isDragging()) return { kind: "ignore" };
    if (frozen) return { kind: "ignore" };
    const cue = decideEndedCue({
      animations: deps.cfg().animations,
      current: deps.currentAnim(),
      workState: deps.workStatus()?.state
    });
    const petId = deps.cfg().id;
    if (cue.kind === "work-rotate") {
      console.log("[dsh-pet] " + stamp2(petId) + " workStatus \u6863\u5185\u8F6E\u6362: " + deps.currentAnim() + " -> " + cue.anim);
    } else if (cue.kind === "work-replay") {
      console.log("[dsh-pet] " + stamp2(petId) + " workStatus \u5FAA\u73AF\u7EED\u64AD: " + deps.currentAnim());
    } else if (cue.kind === "event-done") {
      console.log("[dsh-pet] " + stamp2(petId) + " \u4E8B\u4EF6\u52A8\u753B\u64AD\u5B8C ended anim=" + deps.currentAnim());
    }
    return cue;
  };
  return {
    switchTo,
    handleEnded,
    stopLoopingFront: () => {
      const el = frontVideo();
      if (el === null) return;
      el.loop = false;
      el.onended = (event) => deps.onEnded(handleEnded(event));
    },
    setCueUrl: (url) => {
      cueUrl = url;
    },
    setFrozen: (next) => {
      if (frozen === next) return null;
      frozen = next;
      if (next) {
        frontVideo()?.pause();
        if (playing !== null) reportOnce(playing, "cancelled", REASON_FROZEN);
        return { kind: "frozen" };
      }
      return { kind: "resumed" };
    },
    isFrozen: () => frozen,
    frontVideo,
    playingPlayback: () => playing,
    dispose: () => {
      mounted = false;
      loader.abortAll();
      if (blobUrl.a !== null) loader.release(blobUrl.a);
      if (blobUrl.b !== null) loader.release(blobUrl.b);
      blobUrl.a = null;
      blobUrl.b = null;
    }
  };
}

// vendor/dsh-pet/src/client/pose.ts
var readers = /* @__PURE__ */ new Map();
function registerPose(petId, read) {
  readers.set(petId, read);
  return () => {
    if (readers.get(petId) === read) readers.delete(petId);
  };
}

// vendor/dsh-pet/src/client/progress.ts
var readers2 = /* @__PURE__ */ new Map();
function registerProgress(petId, read) {
  readers2.set(petId, read);
  return () => {
    if (readers2.get(petId) === read) readers2.delete(petId);
  };
}

// vendor/dsh-pet/src/client/pet/card/animation.ts
function createCardAnimation(rt) {
  const { useEffect, useRef } = rt;
  return function useCardAnimation(input) {
    const { card, cfgRef, live, pendingSquash, petId, workStatusRef } = input;
    const ownAnimRef = useRef(null);
    ownAnimRef.current ??= createOwnAnimation({
      videoA: input.videoA,
      videoB: input.videoB,
      cfg: () => cfgRef.current,
      currentAnim: () => card.animRef.current,
      workStatus: () => workStatusRef.current,
      facing: () => card.facingRef.current,
      report: input.report,
      clearCuePlayback: () => input.setCuePlayback(null),
      onFrontReady: (el) => {
        if (pendingSquash.current) {
          pendingSquash.current = false;
          live.current.squash.start(el);
        }
        if (live.current.walk.hasPending()) live.current.walk.start(el);
      },
      onEnded: (cue) => live.current.flow?.applyEndedCue(cue),
      isDragging: () => live.current.drag.isActive(),
      initiallyFrozen: input.lock?.locked === true && input.lock.expiresAt > Date.now()
    });
    const ownAnim = ownAnimRef.current;
    live.current.ownAnim = ownAnim;
    const { anim, cuePlayback, once, seq } = card.state;
    useEffect(() => {
      ownAnim.switchTo(anim, once, cuePlayback);
    }, [anim, once, seq, cuePlayback]);
    useEffect(() => {
      const services = live.current;
      const onResize = () => card.actions.setCustomPos((prev) => {
        if (!prev) return prev;
        const { size } = cfgRef.current;
        const { halfW, halfH, bottomPad } = derivePetMetrics(size);
        const viewport = { width: window.innerWidth, height: window.innerHeight };
        const half = { w: halfW, h: halfH };
        const box = centerToBox(prev, viewport, half);
        return { ...boxToRatio(clampReachableBox(box, viewport, { size, bottomPad }), viewport, half) };
      });
      window.addEventListener("resize", onResize);
      const unregisterPose = registerPose(petId, () => {
        const center = live.current.center();
        return {
          x: center.x / window.innerWidth,
          y: center.y / window.innerHeight,
          facing: card.facingRef.current
        };
      });
      const unregisterProgress = registerProgress(petId, () => {
        const el = ownAnim.frontVideo();
        const playbackId = ownAnim.playingPlayback();
        const anim2 = card.animRef.current;
        if (el === null) {
          return { playbackId, anim: anim2, currentTime: 0, duration: 0, paused: true, buffering: false };
        }
        const duration = Number.isFinite(el.duration) && el.duration > 0 ? el.duration : 0;
        return {
          playbackId,
          anim: anim2,
          currentTime: el.currentTime,
          duration,
          paused: el.paused,
          buffering: el.readyState < 3 || el.seeking
        };
      });
      return () => {
        window.removeEventListener("resize", onResize);
        unregisterPose();
        unregisterProgress();
        ownAnim.dispose();
        services.stopMove();
        services.drag.stopFollow();
        services.flight.stop();
        services.squash.stop();
      };
    }, []);
    return ownAnim;
  };
}

// vendor/dsh-pet/src/shared/score.ts
var SCORE_MIN_SPEED = 400;
var SCORE_SPEED_PER_POINT = 100;
var clickScore = (speed, size) => {
  if (speed <= 0 || size <= 0) return 0;
  return Math.max(1, Math.round(speed / SCORE_SPEED_PER_POINT * (PET_REF_WIDTH / size)));
};

// vendor/dsh-pet/src/shared/score-popup.ts
var SCORE_POPUP_DURATION_MS = 2200;
var SCORE_POPUP_CSS = [
  ".dsh-pet-score{position:fixed;z-index:2147483002;min-width:120px;text-align:center;",
  "background:rgba(255,255,255,.97);border:1px solid rgba(255,179,0,.35);border-radius:12px;",
  "box-shadow:0 10px 32px rgba(0,0,0,.22);padding:8px 16px 9px;user-select:none;pointer-events:auto;",
  // 字体族走全局配置变量（两端注入在 documentElement）：弹窗挂在 body 下，继承不到宠物根容器。
  // 字号固定 px——配置的 font.size 只作用于气泡与悬浮提示。
  "font-family:var(--dsh-pet-font-family,'ShangshouSoftCandy','Yuanti SC','YouYuan','\u5E7C\u5706','Comic Sans MS','PingFang SC','Microsoft YaHei',sans-serif);}",
  ".dsh-pet-score.is-in{animation:dshPetScorePop .28s ease}",
  ".dsh-pet-score-val{font-size:22px;line-height:1.25;font-weight:700;color:#ff8f00;font-variant-numeric:tabular-nums}",
  ".dsh-pet-score-sub{font-size:11px;line-height:1.4;color:rgba(43,43,43,.6);margin-top:2px;white-space:nowrap}",
  // 粒子层：整屏固定、不挡交互；粒子为绝对定位小圆点，位移与透明度由 rAF 直接写
  ".dsh-pet-score-burst{position:fixed;inset:0;pointer-events:none;z-index:2147483002}",
  ".dsh-pet-score-particle{position:absolute;border-radius:50%;pointer-events:none}",
  "@keyframes dshPetScorePop{from{transform:scale(.6);opacity:0}to{transform:scale(1);opacity:1}}"
].join("");
var scoreCssInjected = false;
function injectScoreCss() {
  if (scoreCssInjected || typeof document === "undefined") return;
  scoreCssInjected = true;
  const tag = document.createElement("style");
  tag.dataset.plugin = "dsh-pet";
  tag.dataset.pluginCss = "dsh-pet/score";
  tag.textContent = SCORE_POPUP_CSS;
  document.head.appendChild(tag);
}
var BURST_COUNT = 20;
var BURST_SPEED_MIN = 120;
var BURST_SPEED_MAX = 460;
var BURST_GRAVITY = 700;
var BURST_LIFE_MIN = 500;
var BURST_LIFE_MAX = 900;
var BURST_RADIUS_MIN = 3;
var BURST_RADIUS_MAX = 7;
var BURST_COLORS = ["#ffb300", "#ff8f00", "#ff7043", "#f4511e", "#ffc400", "#ffd54f", "#ef5350"];
function spawnScoreBurst(x, y) {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  injectScoreCss();
  const root = document.createElement("div");
  root.className = "dsh-pet-score-burst";
  document.body.appendChild(root);
  const parts = [];
  for (let i = 0; i < BURST_COUNT; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = BURST_SPEED_MIN + Math.random() * (BURST_SPEED_MAX - BURST_SPEED_MIN);
    const r = BURST_RADIUS_MIN + Math.random() * (BURST_RADIUS_MAX - BURST_RADIUS_MIN);
    const el = document.createElement("div");
    el.className = "dsh-pet-score-particle";
    el.style.left = x + "px";
    el.style.top = y + "px";
    el.style.width = r * 2 + "px";
    el.style.height = r * 2 + "px";
    el.style.background = BURST_COLORS[Math.floor(Math.random() * BURST_COLORS.length)];
    root.appendChild(el);
    parts.push({
      el,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 80,
      t0: performance.now(),
      life: BURST_LIFE_MIN + Math.random() * (BURST_LIFE_MAX - BURST_LIFE_MIN)
    });
  }
  const step = () => {
    const now = performance.now();
    let alive = false;
    for (const p of parts) {
      const tSec = (now - p.t0) / 1e3;
      const lifeRatio = (now - p.t0) / p.life;
      if (lifeRatio >= 1) continue;
      alive = true;
      p.el.style.transform = "translate(" + p.vx * tSec + "px," + (p.vy * tSec + 0.5 * BURST_GRAVITY * tSec * tSec) + "px)";
      p.el.style.opacity = String(Math.max(0, 1 - lifeRatio));
    }
    if (alive) requestAnimationFrame(step);
    else root.remove();
  };
  requestAnimationFrame(step);
}
function mountScorePopup(opts) {
  injectScoreCss();
  const x = opts.x;
  const y = opts.y;
  const root = document.createElement("div");
  root.className = "dsh-pet-score";
  const val = document.createElement("div");
  val.className = "dsh-pet-score-val";
  val.textContent = "+" + opts.score;
  const sub = document.createElement("div");
  sub.className = "dsh-pet-score-sub";
  sub.textContent = "\u901F\u5EA6 " + Math.round(opts.speed) + " \xB7 \u5927\u5C0F " + Math.round(opts.size);
  root.appendChild(val);
  root.appendChild(sub);
  document.body.appendChild(root);
  const rr = root.getBoundingClientRect();
  root.style.left = Math.max(4, Math.min(x - rr.width / 2, window.innerWidth - rr.width - 4)) + "px";
  root.style.top = Math.max(4, y - rr.height - 14) + "px";
  void root.offsetWidth;
  root.classList.add("is-in");
  let closed = false;
  let timer = null;
  const close = () => {
    if (closed) return;
    closed = true;
    if (timer !== null) window.clearTimeout(timer);
    timer = null;
    document.removeEventListener("mousedown", onDocPointerDown, true);
    document.removeEventListener("keydown", onDocKeyDown, true);
    root.remove();
    if (opts.onClose) opts.onClose();
  };
  const mountedAt = performance.now();
  let graceConsumed = false;
  const onDocPointerDown = (e) => {
    if (closed) return;
    if (!graceConsumed) {
      graceConsumed = true;
      if (e.timeStamp - mountedAt < 300) return;
    }
    if (root.contains(e.target)) return;
    close();
  };
  const onDocKeyDown = (e) => {
    if (closed) return;
    if (e.key === "Escape") close();
  };
  document.addEventListener("mousedown", onDocPointerDown, true);
  document.addEventListener("keydown", onDocKeyDown, true);
  timer = window.setTimeout(close, SCORE_POPUP_DURATION_MS);
  return { el: root, close };
}

// vendor/dsh-pet/src/client/pet/motion/drag-follow.ts
function createDragFollow(deps) {
  let frame = null;
  let token = 0;
  let target = null;
  let velocity = { vx: 0, vy: 0 };
  let last = 0;
  const stop = () => {
    token++;
    if (frame !== null) {
      cancelAnimationFrame(frame);
      frame = null;
    }
    target = null;
    velocity = { vx: 0, vy: 0 };
  };
  const aim = (next) => {
    target = next;
  };
  const start = (rootEl) => {
    if (frame !== null) return;
    const current2 = deps.card();
    const spring = current2.physics.throwPower;
    const own = ++token;
    last = performance.now();
    const step = () => {
      if (token !== own) return;
      const goal = target;
      if (!goal) {
        frame = null;
        return;
      }
      const now = performance.now();
      const dt = Math.min((now - last) / 1e3, 1 / 30);
      last = now;
      const box = current2.box() ?? { x: 0, y: 0 };
      let x = box.x;
      let y = box.y;
      velocity.vx = springStep(velocity.vx, x, goal.x, dt, spring);
      velocity.vy = springStep(velocity.vy, y, goal.y, dt, spring);
      x += velocity.vx * dt;
      y += velocity.vy * dt;
      current2.setBox({ x, y });
      rootEl.style.left = x + "px";
      rootEl.style.top = y + "px";
      rootEl.style.right = "auto";
      rootEl.style.bottom = "auto";
      frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
  };
  return { aim, start, stop };
}

// vendor/dsh-pet/src/client/pet/motion/touch-press.ts
var LONG_PRESS_MS = 500;
var SLOP_PX = 8;
function createTouchPress(deps) {
  let timer = null;
  let pending = null;
  const cancel = () => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
    pending = null;
  };
  const arm = (target) => {
    cancel();
    if (target.pointerType === "mouse" || target.pointerType === "pen") return;
    pending = target;
    timer = setTimeout(() => {
      timer = null;
      const current2 = pending;
      pending = null;
      if (current2 === null || !deps.stillHolding()) return;
      deps.onMenu(current2);
    }, LONG_PRESS_MS);
  };
  const move = (distancePx) => {
    if (timer === null) return;
    if (distancePx > SLOP_PX) cancel();
  };
  return { arm, cancel, isArmed: () => timer !== null, move };
}

// vendor/dsh-pet/src/client/pet/motion/drag-release.ts
function decideRelease(input) {
  if (input.sling) {
    const pullX = input.box.x + input.half.w - input.anchor.x;
    const pullY = input.box.y + input.half.h - input.anchor.y;
    const dist = Math.hypot(pullX, pullY);
    const power = slingshotPower(dist, input.size);
    return {
      kind: "sling",
      dist,
      power,
      velocity: slingshotVelocity(pullAngle(pullX, pullY), power, input.physics.throwPower)
    };
  }
  const velocity = estimateReleaseVelocity(input.trail, input.now, input.physics);
  return velocity ? { kind: "throw", velocity } : { kind: "place" };
}

// vendor/dsh-pet/src/client/pet/motion/drag.ts
var IDLE_PRESS = {
  active: false,
  dragging: false,
  sx: 0,
  sy: 0,
  offX: 0,
  offY: 0,
  sling: false,
  anchorX: 0,
  anchorY: 0
};
var JUST_DRAGGED_MS = 100;
var stamp3 = () => (/* @__PURE__ */ new Date()).toTimeString().slice(0, 8);
var log2 = (petId, message) => {
  console.log("[dsh-pet] " + stamp3() + " pet=" + petId + " " + message);
};
function noteGrab(current2, x, y) {
  const grab = current2.grabVelocity();
  const speed = grab ? Math.hypot(grab.vx, grab.vy) : 0;
  log2(
    current2.petId,
    "grab vx=" + (grab ? Math.round(grab.vx) : 0) + " vy=" + (grab ? Math.round(grab.vy) : 0) + " |v|=" + Math.round(speed)
  );
  if (speed < SCORE_MIN_SPEED) return false;
  const score = clickScore(speed, current2.size);
  log2(current2.petId, "click-score speed=" + Math.round(speed) + " size=" + current2.size + " -> +" + score);
  spawnScoreBurst(x, y);
  mountScorePopup({ x, y, score, speed, size: current2.size });
  return true;
}
function createDrag(card) {
  let press = { ...IDLE_PRESS };
  let justDraggedUntil = 0;
  let pressScoreFired = false;
  let lastPressAt = 0;
  let trail = [];
  const follow = createDragFollow({ card });
  let mousePressHit = null;
  function onWindowMouseUp(e) {
    const hit = mousePressHit;
    if (!hit || e.button !== 0 || e.buttons !== 0) return;
    endPress(card(), { x: e.clientX, y: e.clientY, hit });
  }
  const armMouseFallback = (hit) => {
    mousePressHit = hit;
    if (typeof window !== "undefined") window.addEventListener("mouseup", onWindowMouseUp, true);
  };
  const clearMouseFallback = () => {
    mousePressHit = null;
    if (typeof window !== "undefined") window.removeEventListener("mouseup", onWindowMouseUp, true);
  };
  const touchPress = createTouchPress({
    onMenu: (target) => {
      press.active = false;
      pressScoreFired = true;
      if (target.el.hasPointerCapture(target.pointerId)) target.el.releasePointerCapture(target.pointerId);
      log2(card().petId, "-> [TOUCH-MENU]");
      target.el.dispatchEvent(
        new MouseEvent("contextmenu", {
          bubbles: true,
          button: 2,
          cancelable: true,
          clientX: target.x,
          clientY: target.y,
          view: window
        })
      );
    },
    stillHolding: () => press.active && !press.dragging
  });
  const beginPress = (c, e) => {
    e.currentTarget.classList.add("dragging");
    e.currentTarget.setPointerCapture(e.pointerId);
    c.setTipOn(false);
    const rootEl = c.root();
    let offX = 0;
    let offY = 0;
    if (rootEl) {
      const rr = rootEl.getBoundingClientRect();
      offX = e.clientX - (rr.left + rr.width / 2);
      offY = e.clientY - (rr.top + rr.height / 2);
      c.setBox({ x: rr.left, y: rr.top });
    }
    const pressNow = performance.now();
    const sling = pressNow - lastPressAt < SLINGSHOT_DOUBLE_MS;
    lastPressAt = sling ? 0 : pressNow;
    const anchor = c.box();
    return {
      active: true,
      anchorX: anchor ? anchor.x + c.halfW : e.clientX,
      anchorY: anchor ? anchor.y + c.halfH : e.clientY,
      dragging: false,
      offX,
      offY,
      sling,
      sx: e.clientX,
      sy: e.clientY
    };
  };
  const onPointerDown = (e) => {
    const c = card();
    if (e.button !== 0) return;
    if (c.isFrozen()) c.releaseLock();
    pressScoreFired = noteGrab(c, e.clientX, e.clientY);
    c.stopFlight();
    follow.stop();
    c.stopAutonomy();
    trail = [];
    press = beginPress(c, e);
    clearMouseFallback();
    if (e.pointerType === "mouse") armMouseFallback(e.currentTarget);
    touchPress.arm({
      el: e.currentTarget,
      pointerId: e.pointerId,
      pointerType: e.pointerType,
      x: e.clientX,
      y: e.clientY
    });
  };
  const onPointerMove = (e) => {
    const c = card();
    if (c.tipOn()) c.placeTip(e.clientX, e.clientY);
    if (!press.active) return;
    const dx = e.clientX - press.sx;
    const dy = e.clientY - press.sy;
    touchPress.move(Math.hypot(dx, dy));
    if (!press.dragging) {
      if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
      press.dragging = true;
      c.setOnce(true);
      if (c.dragAnims.length) {
        const name = pick(c.dragAnims);
        log2(c.petId, "-> [DRAG] " + name);
        c.playAnim(name);
      }
    }
    const now = performance.now();
    trail = trimTrail([...trail, { t: now, x: e.clientX, y: e.clientY }], now);
    follow.aim({ x: e.clientX - press.offX - c.halfW, y: e.clientY - press.offY - c.halfH });
    const rootEl = c.root();
    if (rootEl) follow.start(rootEl);
  };
  const settleRelease = (c, point) => {
    const current2 = c.box();
    const box = current2 ?? { x: point.x - press.offX - c.halfW, y: point.y - press.offY - c.halfH };
    const decision = decideRelease({
      anchor: { x: press.anchorX, y: press.anchorY },
      box,
      half: { w: c.halfW, h: c.halfH },
      now: performance.now(),
      physics: c.physics,
      size: c.size,
      sling: press.sling,
      trail
    });
    trail = [];
    if (decision.kind === "sling") {
      log2(
        c.petId,
        "sling dist=" + Math.round(decision.dist) + " power=" + decision.power.toFixed(2) + " vx=" + Math.round(decision.velocity.vx) + " vy=" + Math.round(decision.velocity.vy)
      );
      c.startFlight(box.x, box.y, decision.velocity.vx, decision.velocity.vy);
      return;
    }
    if (decision.kind === "throw") {
      const { vx, vy } = decision.velocity;
      log2(c.petId, "release vx=" + Math.round(vx) + " vy=" + Math.round(vy) + " |v|=" + Math.round(Math.hypot(vx, vy)));
      c.startFlight(box.x, box.y, vx, vy);
      return;
    }
    c.commitPlace(box);
  };
  const restoreTip = (c, point) => {
    const hitRect = point.hit.getBoundingClientRect();
    const inside = point.x >= hitRect.left && point.x <= hitRect.right && point.y >= hitRect.top && point.y <= hitRect.bottom;
    if (!inside) return;
    c.placeTip(point.x, point.y);
    c.setTipOn(true);
  };
  const endPress = (c, point) => {
    clearMouseFallback();
    touchPress.cancel();
    const wasDragging = press.dragging;
    press.active = false;
    press.dragging = false;
    point.hit.classList.remove("dragging");
    follow.stop();
    if (wasDragging) {
      justDraggedUntil = performance.now() + JUST_DRAGGED_MS;
      if (!c.resumeWork()) {
        if (c.idleAnims.length) c.playAnim(pick(c.idleAnims, c.currentAnim));
        c.setOnce(true);
      }
      settleRelease(c, point);
    }
    restoreTip(c, point);
  };
  const onPointerUp = (e) => {
    endPress(card(), { x: e.clientX, y: e.clientY, hit: e.currentTarget });
  };
  const onClick = () => {
    const c = card();
    if (press.active || press.dragging || performance.now() < justDraggedUntil) return;
    if (pressScoreFired) {
      pressScoreFired = false;
      c.stopFlight();
      c.stopAutonomy();
      return;
    }
    c.stopFlight();
    c.stopAutonomy();
    c.playClickSound();
    c.setOnce(true);
    if (!c.clickAnims.length) return;
    const name = pick(c.clickAnims);
    log2(c.petId, "-> [CLICK] " + name);
    c.markSquash();
    c.bumpSeq();
    c.playAnim(name);
  };
  return {
    isActive: () => press.active,
    justDragged: () => performance.now() < justDraggedUntil,
    onClick,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    stopFollow: follow.stop,
    dispose: clearMouseFallback
  };
}

// vendor/dsh-pet/src/client/pet/card/drag.ts
function createCardDrag(rt) {
  const { useRef, useEffect } = rt;
  return function useCardDrag(input) {
    const { bumpSeq, card, cfgRef, live, motion, pendingSquash, root, setAnim, setCustomPos } = input;
    const { setOnce, setTipOn } = input;
    const dragCard = () => {
      const metrics = motion.metrics();
      return {
        petId: cfgRef.current.id,
        size: metrics.size,
        halfW: metrics.halfW,
        halfH: metrics.halfH,
        physics: cfgRef.current.physics,
        // 睡着时不给拖拽动画：可以拖、位置跟手，但保持睡姿（空池 = 驱动退化为只拖不换源）
        dragAnims: live.current.flow?.sleeping() ?? false ? [] : cfgRef.current.animations.drag,
        clickAnims: cfgRef.current.animations.clicks,
        // 松手同理：睡着时不给回 idle 的动画，否则拖一下就把睡姿换掉了
        idleAnims: live.current.flow?.sleeping() ?? false ? [] : cfgRef.current.animations.idle,
        currentAnim: card.animRef.current,
        setOnce: (on) => setOnce(on),
        playAnim: (name) => setAnim(name),
        bumpSeq: () => bumpSeq(),
        markSquash: () => {
          pendingSquash.current = true;
        },
        resumeWork: () => live.current.flow?.resumeWorkStatusAnim() ?? false,
        stopAutonomy: () => motion.stopMove(),
        stopFlight: () => motion.flight.stop(),
        startFlight: motion.startThrow,
        isFrozen: () => live.current.ownAnim.isFrozen(),
        releaseLock: () => live.current.releaseLock(),
        grabVelocity: () => motion.flight.isFlying() ? motion.flight.velocity() : null,
        playClickSound: () => playClickSound(),
        tipOn: () => live.current.tipOn(),
        placeTip: (x, y) => live.current.placeTip(x, y),
        setTipOn,
        root,
        box: () => motion.box(),
        setBox: (box) => motion.setBox(box),
        commitPlace: (box) => {
          const metrics2 = motion.metrics();
          const viewport = { width: window.innerWidth, height: window.innerHeight };
          const half = { w: metrics2.halfW, h: metrics2.halfH };
          const reached = clampReachableBox(box, viewport, metrics2);
          const rootEl = root();
          if (rootEl) {
            rootEl.style.left = reached.x + "px";
            rootEl.style.top = reached.y + "px";
            rootEl.style.right = "auto";
            rootEl.style.bottom = "auto";
          }
          motion.setBox(reached);
          setCustomPos(boxToRatio(reached, viewport, half));
        }
      };
    };
    const dragRef = useRef(null);
    dragRef.current ??= createDrag(dragCard);
    const drag = dragRef.current;
    useEffect(() => () => drag.dispose(), [drag]);
    live.current.drag = drag;
    return drag;
  };
}

// vendor/dsh-pet/src/shared/hear.ts
var HEAR_SAMPLE_RATE = 16e3;
var MAX_RECORD_MS = 24e3;
var SILENCE_PEAK = 2e-3;
var MIN_RECORD_MS = 300;
var HEAR_TIMEOUT_MS = 4e4;
var BLOCK_SAMPLES = 1024;
var TAIL_SETTLE_MS = 80;
function canRecord() {
  return typeof navigator !== "undefined" && typeof navigator.mediaDevices?.getUserMedia === "function";
}
function floatToPcm16(samples) {
  const out = new Int16Array(samples.length);
  for (let i = 0; i < samples.length; i++) {
    const v = samples[i] < -1 ? -1 : samples[i] > 1 ? 1 : samples[i];
    out[i] = v < 0 ? v * 32768 : v * 32767;
  }
  return out;
}
function peakOf(pcm) {
  let peak = 0;
  for (let i = 0; i < pcm.length; i++) {
    const v = pcm[i] < 0 ? -pcm[i] : pcm[i];
    if (v > peak) peak = v;
  }
  return peak / 32768;
}
function encodeWave(pcm, sampleRate = HEAR_SAMPLE_RATE) {
  const dataBytes = pcm.length * 2;
  const bytes = new Uint8Array(44 + dataBytes);
  const view = new DataView(bytes.buffer);
  const ascii = (offset, text) => {
    for (let i = 0; i < text.length; i++) bytes[offset + i] = text.charCodeAt(i);
  };
  ascii(0, "RIFF");
  view.setUint32(4, 36 + dataBytes, true);
  ascii(8, "WAVE");
  ascii(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  ascii(36, "data");
  view.setUint32(40, dataBytes, true);
  for (let i = 0; i < pcm.length; i++) view.setInt16(44 + i * 2, pcm[i], true);
  return bytes;
}
function toBase64(bytes) {
  const BASE64_CHUNK_BYTES = 8192;
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += BASE64_CHUNK_BYTES) {
    const end = Math.min(offset + BASE64_CHUNK_BYTES, bytes.length);
    for (let i = offset; i < end; i++) binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}
function reasonOf(raw) {
  return raw === "unsupported" || raw === "bad-request" ? raw : "generate-error";
}
async function hearAudio(url, audio, signal) {
  const timeout = AbortSignal.timeout(HEAR_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ audio }),
      signal: signal === void 0 ? timeout : AbortSignal.any([signal, timeout])
    });
    const raw = await res.json().catch(() => null);
    if (!raw || typeof raw !== "object") {
      return { ok: false, reason: "network", message: "\u8BC6\u522B\u54CD\u5E94\u4E0D\u662F JSON" };
    }
    const body = raw;
    if (body.ok === true && typeof body.text === "string") return { ok: true, text: body.text };
    return {
      ok: false,
      reason: reasonOf(body.reason),
      message: typeof body.message === "string" ? body.message : ""
    };
  } catch (e) {
    return { ok: false, reason: "network", message: e instanceof Error ? e.message : String(e) };
  }
}
async function startRecording() {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1 } });
  const ctx = new AudioContext({ sampleRate: HEAR_SAMPLE_RATE });
  const source = ctx.createMediaStreamSource(stream);
  const processor = ctx.createScriptProcessor(BLOCK_SAMPLES, 1, 1);
  const chunks = [];
  const maxSamples = Math.floor(MAX_RECORD_MS / 1e3 * HEAR_SAMPLE_RATE);
  let frames = 0;
  let closed = false;
  processor.onaudioprocess = (event) => {
    if (frames >= maxSamples) return;
    const samples = event.inputBuffer.getChannelData(0);
    const room = maxSamples - frames;
    const take = samples.length > room ? samples.subarray(0, room) : samples;
    chunks.push(new Float32Array(take));
    frames += take.length;
  };
  source.connect(processor);
  processor.connect(ctx.destination);
  await ctx.resume();
  const teardown = () => {
    if (closed) return;
    closed = true;
    processor.onaudioprocess = null;
    try {
      source.disconnect();
      processor.disconnect();
    } catch {
    }
    for (const track of stream.getTracks()) track.stop();
    void ctx.close();
  };
  return {
    elapsedMs: () => frames / HEAR_SAMPLE_RATE * 1e3,
    async stop() {
      await new Promise((resolve) => setTimeout(resolve, TAIL_SETTLE_MS));
      teardown();
      if (frames === 0) return null;
      const all = new Float32Array(frames);
      let offset = 0;
      for (const chunk of chunks) {
        all.set(chunk, offset);
        offset += chunk.length;
      }
      const pcm = floatToPcm16(all);
      return { wave: encodeWave(pcm), peak: peakOf(pcm) };
    },
    cancel: teardown
  };
}

// vendor/dsh-pet/src/shared/chat/hear-control.ts
function createHearControl(opts) {
  const { micBtn, input, hint, resizeInput, hearUrl } = opts;
  let hearState = "idle";
  let recorder = null;
  let hearTimer = 0;
  let wasReleasedEarly = false;
  const paint = () => {
    if (hearState === "starting" || hearState === "recording") micBtn.dataset.hear = "recording";
    else delete micBtn.dataset.hear;
    micBtn.disabled = hearState === "transcribing";
  };
  const blockedReason = () => {
    if (!canRecord()) return "\u5F53\u524D\u5730\u5740\u4E0D\u652F\u6301\u5F55\u97F3\uFF1A\u7528 https \u6216 localhost \u6253\u5F00\u624D\u6709\u9EA6\u514B\u98CE";
    if (hearUrl === "") return "\u8FD9\u4E2A\u5165\u53E3\u6CA1\u6709\u63A5\u4E0A\u8BC6\u522B\u5730\u5740";
    return "";
  };
  const insertText = (text) => {
    const from = input.selectionStart ?? input.value.length;
    const to = input.selectionEnd ?? from;
    input.value = input.value.slice(0, from) + text + input.value.slice(to);
    const caret = from + text.length;
    input.setSelectionRange(caret, caret);
    resizeInput();
    input.focus();
  };
  const describeFailure = (outcome) => {
    if (outcome.reason === "unsupported") return "\u8FD9\u4E2A\u5BBF\u4E3B\u6CA1\u5F00\u8BED\u97F3\u8BC6\u522B";
    if (outcome.reason === "bad-request") return "\u97F3\u9891\u6CA1\u901A\u8FC7\u5BBF\u4E3B\u6821\u9A8C";
    if (outcome.reason === "network") return "\u8BC6\u522B\u8BF7\u6C42\u5931\u8D25\uFF1A" + outcome.message;
    return "\u8BC6\u522B\u5931\u8D25\uFF1A" + (outcome.message || "\u672A\u77E5\u539F\u56E0");
  };
  const stop = async () => {
    const current2 = recorder;
    if (!current2) return;
    recorder = null;
    window.clearInterval(hearTimer);
    if (current2.elapsedMs() < MIN_RECORD_MS) {
      current2.cancel();
      hearState = "idle";
      paint();
      hint.hide();
      return;
    }
    hearState = "transcribing";
    paint();
    hint.show("\u8BC6\u522B\u4E2D\u2026");
    try {
      const clip = await current2.stop();
      if (clip === null) {
        hint.flash("\u6CA1\u5F55\u5230\u58F0\u97F3");
        return;
      }
      if (clip.peak < SILENCE_PEAK) {
        hint.flash("\u6CA1\u542C\u5230\u58F0\u97F3\uFF0C\u68C0\u67E5\u4E00\u4E0B\u9EA6\u514B\u98CE");
        return;
      }
      if (!input.isConnected) return;
      const outcome = await hearAudio(hearUrl, toBase64(clip.wave));
      if (!input.isConnected) return;
      if (!outcome.ok) {
        hint.flash(describeFailure(outcome));
        return;
      }
      const text = outcome.text.trim();
      if (text === "") {
        hint.flash("\u6CA1\u542C\u6E05\uFF0C\u518D\u8BF4\u4E00\u6B21");
        return;
      }
      hint.hide();
      insertText(text);
    } catch (e) {
      hint.flash("\u5F55\u97F3\u51FA\u9519\uFF1A" + (e instanceof Error ? e.message : String(e)));
    } finally {
      hearState = "idle";
      paint();
    }
  };
  const start = async () => {
    const blocked = blockedReason();
    if (blocked !== "") {
      hint.flash(blocked);
      return;
    }
    if (hearState !== "idle") return;
    if (document.activeElement === input) input.blur();
    hearState = "starting";
    wasReleasedEarly = false;
    paint();
    hint.show("\u6B63\u5728\u6253\u5F00\u9EA6\u514B\u98CE\u2026");
    try {
      recorder = await startRecording();
    } catch (e) {
      hearState = "idle";
      paint();
      hint.flash("\u6253\u4E0D\u5F00\u9EA6\u514B\u98CE\uFF1A" + (e instanceof Error ? e.message : String(e)));
      return;
    }
    if (wasReleasedEarly) {
      void stop();
      return;
    }
    hearState = "recording";
    paint();
    hearTimer = window.setInterval(() => {
      const rec = recorder;
      if (!rec) return;
      if (rec.elapsedMs() >= MAX_RECORD_MS) {
        void stop();
        return;
      }
      const total = Math.floor(rec.elapsedMs() / 1e3);
      hint.show("\u5F55\u97F3\u4E2D " + Math.floor(total / 60) + ":" + String(total % 60).padStart(2, "0") + " \xB7 \u677E\u5F00\u7ED3\u675F");
    }, 200);
  };
  micBtn.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    try {
      micBtn.setPointerCapture(e.pointerId);
    } catch {
    }
    void start();
  });
  const onRelease = () => {
    if (hearState === "starting") {
      wasReleasedEarly = true;
      return;
    }
    if (hearState === "recording") void stop();
  };
  micBtn.addEventListener("pointerup", onRelease);
  micBtn.addEventListener("pointercancel", onRelease);
  return {
    start: () => void start(),
    stop: () => void stop(),
    isHearing: () => hearState === "recording",
    dispose: () => {
      window.clearInterval(hearTimer);
      if (recorder) {
        recorder.cancel();
        recorder = null;
      }
      hearState = "idle";
    }
  };
}

// vendor/dsh-pet/src/shared/chat/icons.ts
var ICON_ATTRS = {
  fill: "none",
  stroke: "currentColor",
  "stroke-width": "1.8",
  "stroke-linecap": "round",
  "stroke-linejoin": "round",
  "aria-hidden": "true"
};
function svgNode(tag, attrs) {
  const node = document.createElementNS("http://www.w3.org/2000/svg", tag);
  for (const [name, value] of Object.entries(attrs)) node.setAttribute(name, value);
  return node;
}
function pictureIcon(size = 16) {
  const svg = svgNode("svg", {
    viewBox: "0 0 24 24",
    width: String(size),
    height: String(size),
    ...ICON_ATTRS
  });
  svg.append(
    svgNode("rect", { x: "3", y: "3", width: "18", height: "18", rx: "2" }),
    svgNode("circle", { cx: "8.5", cy: "8.5", r: "1.5" }),
    svgNode("path", { d: "M21 15l-5-5L5 21" })
  );
  return svg;
}
function micIcon(size = 16) {
  const svg = svgNode("svg", {
    viewBox: "0 0 24 24",
    width: String(size),
    height: String(size),
    ...ICON_ATTRS
  });
  svg.append(
    svgNode("rect", { x: "9", y: "2", width: "6", height: "11", rx: "3" }),
    svgNode("path", { d: "M5.5 11a6.5 6.5 0 0 0 13 0" }),
    svgNode("path", { d: "M12 17.5V21" }),
    svgNode("path", { d: "M8.5 21h7" })
  );
  return svg;
}
function cameraIcon(size = 16) {
  const svg = svgNode("svg", {
    viewBox: "0 0 24 24",
    width: String(size),
    height: String(size),
    ...ICON_ATTRS
  });
  svg.append(
    svgNode("path", { d: "M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" }),
    svgNode("circle", { cx: "12", cy: "13", r: "4" })
  );
  return svg;
}

// vendor/dsh-pet/src/shared/chat/styles.ts
var CHAT_CSS = [
  ".dsh-pet-chat{position:fixed;z-index:2147483001;width:160px;max-width:80vw;",
  "background:rgba(255,255,255,.98);border:1px solid rgba(0,0,0,.12);border-radius:10px;",
  "box-shadow:0 10px 32px rgba(0,0,0,.22);color:#2b2b2b;font-size:14px;line-height:1.5;",
  // 字体与桌宠气泡同款（上首软糖体，两端均已注入 @font-face），风格一致不显正式。
  // 字体族走全局配置变量 --dsh-pet-font-family：弹窗挂在 body 下、继承不到宠物根容器，由两端注入在 documentElement。
  // 字号保持固定 14px：配置里的 font.size 只作用于气泡与悬浮提示。
  "font-family:var(--dsh-pet-font-family,'ShangshouSoftCandy','Yuanti SC','YouYuan','\u5E7C\u5706','Comic Sans MS','PingFang SC','Microsoft YaHei',sans-serif);",
  "user-select:none}",
  ".dsh-pet-chat *{box-sizing:border-box}",
  ".dsh-pet-chat-input{display:block;width:100%;border:none;outline:none;background:transparent;",
  "padding:8px 11px 9px;font-size:14px;line-height:1.45;color:#2b2b2b;font-family:inherit;",
  "resize:none;overflow:hidden;white-space:pre-wrap;overflow-wrap:anywhere}",
  ".dsh-pet-chat-input::placeholder{color:rgba(43,43,43,.45)}",
  ".dsh-pet-chat-input:disabled{opacity:.55}",
  // 操作行：上传 / 截屏 / 按住说话三枚图标按钮（无边框、悬停才显底）
  ".dsh-pet-chat-actions{display:flex;align-items:center;gap:6px;padding:0 8px 7px}",
  ".dsh-pet-chat-btn{display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;",
  "border:none;border-radius:6px;background:transparent;color:rgba(43,43,43,.62);font-size:14px;line-height:1;",
  "cursor:pointer;transition:background .15s,color .15s}",
  ".dsh-pet-chat-btn:hover{background:rgba(0,0,0,.06);color:rgba(43,43,43,.9)}",
  ".dsh-pet-chat-btn:disabled{opacity:.45;cursor:default}",
  ".dsh-pet-chat-btn svg{display:block}",
  // 话筒：录音中常亮红底 + 呼吸，告诉用户「正在听」。状态由 dom 写在 data-hear 上。
  '.dsh-pet-chat-btn[data-hear="recording"]{color:#e5484d;background:rgba(229,72,77,.14)}',
  '.dsh-pet-chat-btn[data-hear="recording"]:hover{background:rgba(229,72,77,.2);color:#e5484d}',
  '.dsh-pet-chat-btn[data-hear="recording"] svg{animation:dsh-pet-hear-pulse 1s ease-in-out infinite}',
  "@keyframes dsh-pet-hear-pulse{0%,100%{opacity:1}50%{opacity:.4}}",
  // 已选图片：跟在两枚按钮右侧的一枚小图，不占额外一行
  ".dsh-pet-chat-attach{display:none;align-items:center;gap:4px;margin-left:2px}",
  '.dsh-pet-chat-attach[data-on="1"]{display:inline-flex}',
  ".dsh-pet-chat-thumb{width:24px;height:24px;object-fit:cover;border-radius:4px;",
  "border:1px solid rgba(0,0,0,.1);flex:0 0 auto;background:rgba(0,0,0,.06)}",
  ".dsh-pet-chat-attach-x{border:none;background:transparent;color:rgba(43,43,43,.45);cursor:pointer;",
  "font-size:12px;line-height:1;padding:2px 3px;border-radius:4px}",
  ".dsh-pet-chat-attach-x:hover{background:rgba(0,0,0,.08);color:rgba(43,43,43,.85)}",
  ".dsh-pet-chat-hint{display:none;color:rgba(43,43,43,.55);font-size:12px;padding:0 12px 8px}",
  ".dsh-pet-chat-err{color:#d94f3d;font-size:12px;padding:0 12px 8px;white-space:pre-wrap;overflow-wrap:anywhere}"
].join("");
var CHAT_MIN_W = 160;
var CHAT_MAX_W = 340;
var CHAT_H_PAD = 22;
var chatCssInjected = false;
function injectChatCss() {
  if (chatCssInjected || typeof document === "undefined") return;
  chatCssInjected = true;
  const tag = document.createElement("style");
  tag.dataset.plugin = "dsh-pet";
  tag.dataset.pluginCss = "dsh-pet/chat";
  tag.textContent = CHAT_CSS;
  document.head.appendChild(tag);
}

// vendor/dsh-pet/src/shared/chat/dom.ts
var HINT_MS = 2200;
function iconButton(title, icon) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "dsh-pet-chat-btn";
  btn.title = title;
  btn.setAttribute("aria-label", title);
  btn.appendChild(icon);
  return btn;
}
function enableAutoResize(input, root) {
  let measureCtx = null;
  const resize = () => {
    const ctx = measureCtx ?? (measureCtx = document.createElement("canvas").getContext("2d"));
    ctx.font = getComputedStyle(input).font;
    const textW = ctx.measureText(input.value || " ").width;
    const w = Math.max(CHAT_MIN_W, Math.min(Math.ceil(textW + CHAT_H_PAD), CHAT_MAX_W));
    root.style.width = w + "px";
    input.style.height = "auto";
    input.style.height = Math.max(input.scrollHeight, 22) + "px";
  };
  input.addEventListener("input", resize);
  return resize;
}
function createChatDom(opts = {}) {
  const root = document.createElement("div");
  root.className = "dsh-pet-chat";
  const input = document.createElement("textarea");
  input.className = "dsh-pet-chat-input";
  input.placeholder = "\u8BF4\u70B9\u4EC0\u4E48\u2026";
  input.maxLength = 2e3;
  input.rows = 1;
  const err = document.createElement("div");
  err.className = "dsh-pet-chat-err";
  err.style.display = "none";
  const hint = document.createElement("div");
  hint.className = "dsh-pet-chat-hint";
  let hintTimer = 0;
  const showHint = (text) => {
    window.clearTimeout(hintTimer);
    hint.textContent = text;
    hint.style.display = "block";
  };
  const hideHint = () => {
    window.clearTimeout(hintTimer);
    hint.style.display = "none";
  };
  const flash = (text) => {
    showHint(text);
    hintTimer = window.setTimeout(hideHint, HINT_MS);
  };
  const pickBtn = iconButton("\u4E0A\u4F20\u56FE\u7247", pictureIcon());
  const shotBtn = iconButton("\u622A\u53D6\u5F53\u524D\u5C4F\u5E55", cameraIcon());
  const hearUrl = typeof opts.hearUrl === "string" ? opts.hearUrl : "";
  const micBtn = iconButton("\u6309\u4F4F\u8BF4\u8BDD", micIcon());
  const fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.accept = IMAGE_ACCEPT;
  fileInput.style.display = "none";
  const attach = document.createElement("div");
  attach.className = "dsh-pet-chat-attach";
  const thumb = document.createElement("img");
  thumb.className = "dsh-pet-chat-thumb";
  thumb.alt = "\u5DF2\u9009\u56FE\u7247";
  const attachX = document.createElement("button");
  attachX.type = "button";
  attachX.className = "dsh-pet-chat-attach-x";
  attachX.textContent = "\u2715";
  attachX.title = "\u79FB\u9664\u56FE\u7247";
  attachX.setAttribute("aria-label", "\u79FB\u9664\u56FE\u7247");
  attach.append(thumb, attachX);
  const actions = document.createElement("div");
  actions.className = "dsh-pet-chat-actions";
  for (const btn of [pickBtn, shotBtn, micBtn]) {
    btn.disabled = true;
    btn.title = "\u56FE\u7247\u4E0E\u8BED\u97F3\u8BF7\u5728\u5FC6\u4F34\u4E3B\u804A\u5929\u4E2D\u4F7F\u7528";
  }
  actions.append(pickBtn, shotBtn, micBtn, fileInput, attach);
  root.append(input, actions, hint, err);
  document.body.appendChild(root);
  const resizeInput = enableAutoResize(input, root);
  let attachment;
  let encoding = false;
  let capturing = false;
  const clearAttach = () => {
    attachment = void 0;
    attach.dataset.on = "0";
    thumb.removeAttribute("src");
    fileInput.value = "";
  };
  const applyEncoded = (encoded) => {
    if (!root.isConnected) return false;
    attachment = { mediaType: encoded.mediaType, data: encoded.base64 };
    thumb.src = encoded.previewUrl;
    attach.dataset.on = "1";
    return true;
  };
  const setImageFile = async (_file) => {
    flash("\u56FE\u7247\u8BF7\u5728\u5FC6\u4F34\u4E3B\u804A\u5929\u4E2D\u53D1\u9001");
    return false;
  };
  pickBtn.addEventListener("click", () => fileInput.click());
  fileInput.addEventListener("change", () => {
    const file = fileInput.files && fileInput.files[0];
    if (file) void setImageFile(file);
  });
  attachX.addEventListener("click", clearAttach);
  root.addEventListener("paste", (e) => {
    const file = firstImageFromClipboard(e.clipboardData);
    if (!file) return;
    e.preventDefault();
    void setImageFile(file);
  });
  if (opts.capture) {
    const capture = opts.capture;
    shotBtn.addEventListener("click", () => {
      if (capturing) return;
      capturing = true;
      shotBtn.disabled = true;
      void capture().then((encoded) => applyEncoded(encoded)).catch((e) => flash("\u622A\u5C4F\u5931\u8D25\uFF1A" + (e instanceof Error ? e.message : String(e)))).finally(() => {
        capturing = false;
        shotBtn.disabled = false;
      });
    });
  } else {
    shotBtn.addEventListener("click", () => flash("\u5F53\u524D\u73AF\u5883\u4E0D\u652F\u6301\u622A\u5C4F\uFF0C\u5148\u7528\u4E0A\u4F20\u8BD5\u8BD5"));
  }
  const hear = createHearControl({
    micBtn,
    input,
    hint: { show: showHint, hide: hideHint, flash },
    resizeInput,
    hearUrl
  });
  resizeInput();
  return {
    root,
    input,
    err,
    shotBtn,
    resizeInput,
    clearAttach,
    setImageFile,
    setEncoded: applyEncoded,
    getAttachment: () => attachment,
    isEncoding: () => encoding || capturing,
    flash,
    startHear: hear.start,
    stopHear: hear.stop,
    isHearing: hear.isHearing,
    dispose: () => {
      window.clearTimeout(hintTimer);
      hear.dispose();
    }
  };
}

// vendor/dsh-pet/src/shared/chat/enter.ts
var COMPOSITION_SETTLE_MS = 80;
function createCompositionWatch() {
  let composing = false;
  let endedAt = Number.NEGATIVE_INFINITY;
  return {
    start: () => {
      composing = true;
    },
    end: (at) => {
      composing = false;
      endedAt = at;
    },
    isComposing: () => composing,
    endedWithin: (now) => now - endedAt < COMPOSITION_SETTLE_MS
  };
}
function decideEnter(event, watch, now) {
  if (event.key !== "Enter" || event.shiftKey) return "ignore";
  if (event.isComposing === true || event.keyCode === 229 || watch.isComposing()) return "ignore";
  if (event.repeat === true) return "swallow";
  if (watch.endedWithin(now)) return "swallow";
  return "send";
}

// vendor/dsh-pet/src/shared/chat/send.ts
var SEND_TIMEOUT_MS = 12e4;
var pendingSends = /* @__PURE__ */ new Map();
async function sendChat(baseUrl, text, attachment) {
  const fingerprint2 = baseUrl + "\n" + text;
  const sendKey = pendingSends.get(fingerprint2) ?? crypto.randomUUID();
  pendingSends.set(fingerprint2, sendKey);
  const res = await fetch(baseUrl, {
    method: "POST",
    headers: { "content-type": "application/json", "idempotency-key": sendKey },
    body: JSON.stringify(attachment ? { text, attachment } : { text }),
    signal: AbortSignal.timeout(SEND_TIMEOUT_MS)
  });
  const raw = await res.json().catch(() => null);
  if (!raw || typeof raw !== "object") {
    throw new Error("dsh-pet: \u5BF9\u8BDD\u54CD\u5E94\u975E\u6CD5");
  }
  const o = raw;
  pendingSends.delete(fingerprint2);
  if (o.ok !== true) {
    return {
      ok: false,
      reason: o.reason === "provider-missing" || o.reason === "generate-error" || o.reason === "config-error" ? o.reason : "bad-request",
      message: typeof o.message === "string" ? o.message : void 0
    };
  }
  return { ok: true };
}

// vendor/dsh-pet/src/shared/chat/dialog.ts
function bindDismiss(root, isClosed, onDismiss) {
  const onPointerDown = (e) => {
    if (isClosed() || root.contains(e.target)) return;
    onDismiss();
  };
  const onKeyDown = (e) => {
    if (e.key === "Escape") onDismiss();
  };
  document.addEventListener("mousedown", onPointerDown, true);
  document.addEventListener("keydown", onKeyDown, true);
  return () => {
    document.removeEventListener("mousedown", onPointerDown, true);
    document.removeEventListener("keydown", onKeyDown, true);
  };
}
function bindSend(binding) {
  let sending = false;
  const doSend = () => {
    if (binding.isClosed() || sending) return;
    if (binding.isEncoding()) {
      binding.notify("\u56FE\u7247\u8FD8\u5728\u5904\u7406\uFF0C\u7A0D\u7B49\u4E00\u4E0B");
      return;
    }
    const text = binding.input.value.trim();
    if (!text) return;
    sending = true;
    binding.input.disabled = true;
    sendChat(binding.url, text, binding.attachment()).then((state) => {
      if (state.ok) binding.onOk();
      else {
        binding.err.textContent = "\u5BF9\u8BDD\u5931\u8D25\uFF1A" + (state.message ?? state.reason);
        binding.err.style.display = "block";
      }
    }).catch((e) => {
      binding.err.textContent = "\u5BF9\u8BDD\u5F02\u5E38\uFF1A" + String(e && e.message ? e.message : e);
      binding.err.style.display = "block";
    }).finally(() => {
      sending = false;
      binding.input.disabled = false;
      if (!binding.isClosed()) binding.input.focus();
    });
  };
  const ime = createCompositionWatch();
  binding.input.addEventListener("compositionstart", ime.start);
  binding.input.addEventListener("compositionend", () => ime.end(performance.now()));
  binding.input.addEventListener("keydown", (e) => {
    const action = decideEnter(e, ime, performance.now());
    if (action === "ignore") return;
    e.preventDefault();
    if (action === "send") doSend();
  });
}
function hearUrlOf(baseUrl) {
  return baseUrl.replace(/\/chat$/, "") + "/voice/hear";
}
function mountChatDialog(opts) {
  injectChatCss();
  const { petId, surface: surface2, x, y, onSent, onClose, clamp } = opts;
  const baseUrl = opts.baseUrl ?? ROUTE_PATH + "/chat";
  const withPet = baseUrl + "?pet=" + encodeURIComponent(petId) + "&surface=" + surface2;
  const c = clamp && Number.isFinite(clamp.x + clamp.y + clamp.w + clamp.h) ? clamp : { x: 0, y: 0, w: window.innerWidth, h: window.innerHeight };
  const dom = createChatDom({ capture: opts.capture, hearUrl: opts.hearUrl ?? hearUrlOf(baseUrl) });
  const { root, input, err } = dom;
  const place = () => {
    const r = root.getBoundingClientRect();
    root.style.left = Math.max(c.x + 4, Math.min(x, c.x + c.w - r.width - 4)) + "px";
    root.style.top = Math.max(c.y + 4, Math.min(y, c.y + c.h - r.height - 4)) + "px";
  };
  let closed = false;
  let unbindDismiss = () => {
  };
  const close = () => {
    if (closed) return;
    closed = true;
    unbindDismiss();
    dom.dispose();
    dom.clearAttach();
    root.remove();
    if (onClose) onClose();
  };
  unbindDismiss = bindDismiss(root, () => closed, close);
  bindSend({
    input,
    err,
    url: withPet,
    isClosed: () => closed,
    onOk: () => {
      close();
      if (onSent) onSent();
    },
    attachment: () => dom.getAttachment(),
    isEncoding: () => dom.isEncoding(),
    notify: (text) => dom.flash(text)
  });
  dom.resizeInput();
  place();
  if (opts.initialImage) void dom.setImageFile(opts.initialImage);
  if (opts.initialEncoded) dom.setEncoded(opts.initialEncoded);
  input.focus();
  return {
    el: root,
    close,
    startHear: dom.startHear,
    stopHear: dom.stopHear,
    isHearing: dom.isHearing,
    setEncoded: dom.setEncoded,
    setImageFile: dom.setImageFile,
    flash: dom.flash
  };
}

// vendor/dsh-pet/src/shared/chat/capture.ts
function waitForFrame(video) {
  if (video.videoWidth > 0) return Promise.resolve();
  return new Promise((resolve) => {
    video.onloadeddata = () => resolve();
  });
}
async function captureDisplayFrame() {
  const media = navigator.mediaDevices;
  if (!media || typeof media.getDisplayMedia !== "function") throw new Error("\u5F53\u524D\u73AF\u5883\u4E0D\u652F\u6301\u622A\u5C4F");
  const stream = await media.getDisplayMedia({ video: true, audio: false });
  try {
    const video = document.createElement("video");
    video.srcObject = stream;
    video.muted = true;
    await video.play();
    await waitForFrame(video);
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    canvas.getContext("2d")?.drawImage(video, 0, 0, canvas.width, canvas.height);
    return encodeCanvas(canvas);
  } finally {
    for (const track of stream.getTracks()) track.stop();
  }
}

// vendor/dsh-pet/src/client/file-drop.ts
function claimFileDragEnter(event) {
  if (!dragHasFiles(event)) return false;
  event.stopPropagation();
  hideHostDropOverlay();
  return true;
}
function claimFileDragOver(event) {
  if (!dragHasFiles(event)) return false;
  event.preventDefault();
  event.stopPropagation();
  return true;
}
function claimFileDrop(event) {
  if (!dragHasFiles(event)) return void 0;
  event.preventDefault();
  event.stopPropagation();
  hideHostDropOverlay();
  return firstImageFile(event.dataTransfer);
}
function hideHostDropOverlay() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event("dragend"));
}

// vendor/dsh-pet/src/client/pet/card/open-chat.ts
function bindOpenChat(input) {
  const { stage, isHovered, openChat } = input;
  const onKeyDown = (e) => {
    if (!isHovered() || !isChatHotkey(e)) return;
    e.preventDefault();
    openChat();
  };
  const onPaste = (e) => {
    if (!isHovered() || isTypingTarget(e.target)) return;
    const file = firstImageFromClipboard(e.clipboardData);
    if (file === void 0) return;
    e.preventDefault();
    openChat(file);
  };
  const onDragOver = (e) => {
    if (!claimFileDragOver(e)) return;
    if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
  };
  const onDrop = (e) => {
    const file = claimFileDrop(e);
    if (file !== void 0) openChat(file);
  };
  document.addEventListener("keydown", onKeyDown, true);
  document.addEventListener("paste", onPaste, true);
  stage?.addEventListener("dragenter", claimFileDragEnter);
  stage?.addEventListener("dragover", onDragOver);
  stage?.addEventListener("drop", onDrop);
  return () => {
    document.removeEventListener("keydown", onKeyDown, true);
    document.removeEventListener("paste", onPaste, true);
    stage?.removeEventListener("dragenter", claimFileDragEnter);
    stage?.removeEventListener("dragover", onDragOver);
    stage?.removeEventListener("drop", onDrop);
  };
}

// vendor/dsh-pet/src/client/pet/card/entry.ts
function createCardEntry(rt) {
  const { useEffect, useRef } = rt;
  return function useCardEntry(input) {
    const { card, cfgRef, drag, live, menuItemsRef, motion, runMenuAction, showTodo, stage, tipRef, toggleTodo } = input;
    const menuRef = useRef(null);
    const chatRef = useRef(null);
    const placeTip = (clientX, clientY) => {
      const tipEl = tipRef.current;
      if (!tipEl) return;
      const viewport = document.documentElement;
      const p = tooltipPlacement(
        { x: clientX, y: clientY },
        { w: tipEl.offsetWidth, h: tipEl.offsetHeight },
        { x: 0, y: 0, w: viewport.clientWidth, h: viewport.clientHeight },
        motion.metrics().size * TOOLTIP_GAP_RATIO
      );
      tipEl.style.left = p.x + "px";
      tipEl.style.top = p.y + "px";
    };
    useEffect(
      () => () => {
        if (menuRef.current) {
          menuRef.current.close();
          menuRef.current = null;
        }
        if (chatRef.current) {
          chatRef.current.close();
          chatRef.current = null;
        }
      },
      []
    );
    const mountChat = (seed) => {
      if (chatRef.current) chatRef.current.close();
      const hitRect = stage()?.querySelector(".dsh-pet-hit")?.getBoundingClientRect();
      chatRef.current = mountChatDialog({
        petId: cfgRef.current.id,
        baseUrl: ROUTE_PATH + "/chat",
        surface: "web",
        x: hitRect ? hitRect.right + 6 : window.innerWidth - 256,
        y: hitRect ? hitRect.top + 6 : 8,
        ...seed.image ? { initialImage: seed.image } : {},
        ...seed.encoded ? { initialEncoded: seed.encoded } : {},
        // 浏览器侧截屏：getDisplayMedia 抓一帧，系统选择器由用户确认
        capture: captureDisplayFrame,
        onSent: () => {
          console.info("[dsh-pet] \u5BF9\u8BDD\u5DF2\u53D1\u9001 pet=" + cfgRef.current.id);
        },
        onClose: () => {
          chatRef.current = null;
        }
      });
    };
    const openChat = (image) => mountChat(image ? { image } : {});
    const openChatWithImage = (file) => {
      const existing = chatRef.current;
      if (existing !== null) {
        void existing.setImageFile(file);
        return;
      }
      openChat(file);
    };
    const openTodo = () => showTodo();
    const startChatHear = () => {
      if (!chatRef.current) openChat();
      chatRef.current?.startHear();
    };
    const stopChatHear = () => {
      chatRef.current?.stopHear();
    };
    const openChatOrFocus = () => {
      const existing = chatRef.current;
      if (existing === null) {
        openChat();
        return;
      }
      existing.el.querySelector(".dsh-pet-chat-input")?.focus();
    };
    const captureInto = async () => {
      let encoded;
      try {
        encoded = await captureDisplayFrame();
      } catch (error) {
        const reason = "\u622A\u5C4F\u5931\u8D25\uFF1A" + (error instanceof Error ? error.message : String(error));
        const opened = chatRef.current;
        if (opened !== null) {
          opened.flash(reason);
          return;
        }
        mountChat({});
        chatRef.current?.flash(reason);
        return;
      }
      const existing = chatRef.current;
      if (existing !== null) {
        existing.setEncoded(encoded);
        return;
      }
      mountChat({ encoded });
    };
    const screenshot = () => {
      void captureInto();
    };
    const hoverRef = useRef(false);
    const openChatRef = useRef(openChat);
    openChatRef.current = openChat;
    const stageGetterRef = useRef(stage);
    stageGetterRef.current = stage;
    const toggleTodoRef = useRef(toggleTodo);
    toggleTodoRef.current = toggleTodo;
    const toggleSleepRef = useRef(() => {
    });
    toggleSleepRef.current = () => {
      const asleep = live.current.flow?.sleeping() ?? false;
      runMenuAction(asleep ? { label: "\u8D77\u6765", action: "wake" } : { label: "\u7761\u89C9", action: "sleep" });
    };
    const switchDisplayRef = useRef(() => {
    });
    switchDisplayRef.current = (display) => {
      runMenuAction({ label: "\u663E\u793A\u4F4D\u7F6E", action: "set-display", display });
    };
    const startChatHearRef = useRef(startChatHear);
    startChatHearRef.current = startChatHear;
    const stopChatHearRef = useRef(stopChatHear);
    stopChatHearRef.current = stopChatHear;
    const openChatOrFocusRef = useRef(openChatOrFocus);
    openChatOrFocusRef.current = openChatOrFocus;
    const openChatWithImageRef = useRef(openChatWithImage);
    openChatWithImageRef.current = openChatWithImage;
    const screenshotRef = useRef(screenshot);
    screenshotRef.current = screenshot;
    useEffect(
      () => registerPetChatHandle(cfgRef.current.id, {
        open: () => openChatOrFocusRef.current(),
        // close 走弹窗自己的 onClose，句柄随之置空，isOpen 立刻转假。
        close: () => chatRef.current?.close(),
        isOpen: () => chatRef.current !== null,
        startHear: () => startChatHearRef.current(),
        stopHear: () => stopChatHearRef.current(),
        isHearing: () => chatRef.current?.isHearing() ?? false,
        screenshot: () => screenshotRef.current()
      }),
      [cfgRef]
    );
    useEffect(() => {
      const offChat = bindOpenChat({
        stage: stageGetterRef.current(),
        isHovered: () => hoverRef.current,
        openChat: (image) => image === void 0 ? openChatRef.current() : openChatWithImageRef.current(image)
      });
      const hearHold = createHearHold({
        isArmed: () => {
          if (hoverRef.current) return true;
          const chat = chatRef.current;
          const active = document.activeElement;
          return !!chat && !!active && chat.el.contains(active);
        },
        onPress: () => startChatHearRef.current(),
        onRelease: () => stopChatHearRef.current()
      });
      const onKeyDown = (e) => {
        if (hearHold.onKeyDown(e)) {
          e.preventDefault();
          return;
        }
        if (!hoverRef.current) return;
        const display = displayOfHotkey(e);
        if (display !== void 0) {
          e.preventDefault();
          switchDisplayRef.current(display);
          return;
        }
        if (isCaptureHotkey(e)) {
          e.preventDefault();
          screenshotRef.current();
          return;
        }
        if (isSleepHotkey(e)) {
          e.preventDefault();
          toggleSleepRef.current();
          return;
        }
        if (!isTodoHotkey(e)) return;
        e.preventDefault();
        toggleTodoRef.current();
      };
      const onKeyUp = (e) => hearHold.onKeyUp(e);
      document.addEventListener("keydown", onKeyDown, true);
      document.addEventListener("keyup", onKeyUp, true);
      return () => {
        offChat();
        document.removeEventListener("keydown", onKeyDown, true);
        document.removeEventListener("keyup", onKeyUp, true);
      };
    }, []);
    live.current.placeTip = placeTip;
    live.current.tipOn = () => card.state.tipOn;
    const handleContextMenu = (e) => {
      const more = buildMoreBranch(menuItemsRef.current);
      const pic = cfgRef.current;
      const memes = buildMemeBranch(pic, (name) => memeThumbUrl(ROUTE_PATH, pic.assetRoot, name));
      const asleep = live.current.flow?.sleeping() ?? false;
      const canSleep = (cfgRef.current.animations.sleep ?? []).length > 0;
      const sleepItem = asleep ? { label: "\u8D77\u6765", action: "wake", hint: SLEEP_HOTKEY_HINT } : { label: "\u7761\u89C9", action: "sleep", hint: SLEEP_HOTKEY_HINT };
      const tools = [
        { label: "\u67E5\u770B\u4F59\u989D", action: "show-balance" },
        { label: "\u5F85\u529E\u4E8B\u9879", action: "todo", hint: TODO_HOTKEY_HINT },
        { label: "\u788E\u788E\u5FF5", action: "whisper" },
        { label: "\u5BF9\u8BDD", action: "chat", hint: CHAT_HOTKEY_HINT },
        ...memes ? [memes] : [],
        ...canSleep ? [sleepItem] : []
      ];
      const tail = [
        // 显示位置子菜单与桌面端同一份；改成不含 web 的值后本宠物会从页面消失。
        displayMenuBranch(),
        { label: "\u56DE\u5230\u521D\u59CB\u4F4D\u7F6E", action: "home" }
      ];
      const tree = [
        ...tools,
        ...buildMenuTree(cfgRef.current.animations),
        ...tail,
        ...more ? [more] : []
      ];
      if (!tree.length) return;
      e.preventDefault();
      e.stopPropagation();
      if (drag.isActive() || drag.justDragged()) return;
      motion.flight.stop();
      motion.stopMove();
      if (menuRef.current) menuRef.current.close();
      menuRef.current = mountContextMenu({
        tree,
        x: e.clientX,
        y: e.clientY,
        onAction: runMenuAction,
        // 菜单被点外或 Esc 关闭时置空句柄，避免残留引用。
        onClose: () => {
          if (menuRef.current) menuRef.current = null;
        }
      });
    };
    return {
      handleContextMenu,
      onPointerEnter: (e) => {
        hoverRef.current = true;
        placeTip(e.clientX, e.clientY);
        card.actions.setTipOn(true);
      },
      onPointerLeave: () => {
        hoverRef.current = false;
        card.actions.setTipOn(false);
      },
      openChat,
      openTodo,
      placeTip
    };
  };
}

// vendor/dsh-pet/src/client/pet/motion/flight-integrate.ts
function integrateFlight(state, dt, bounds, physics, gravity) {
  const substeps = throwSubsteps(state.vx, state.vy, dt);
  let res = throwStep(state, dt / substeps, bounds, physics, gravity);
  let hit = res.hit;
  for (let i = 1; i < substeps && !res.atRest; i++) {
    res = throwStep(res, dt / substeps, bounds, physics, gravity);
    if (res.hit !== null && (hit === null || res.hit.speed > hit.speed)) hit = res.hit;
  }
  return { ...res, hit };
}

// vendor/dsh-pet/src/client/pet/motion/pet-collision.ts
var separate = (state, push) => push === null ? state : { ...state, x: state.x + push.dx * 2, y: state.y + push.dy * 2 };
function createPetCollision(deps) {
  return (state, metrics) => {
    const slots = deps.arena().slots;
    const myBody = bodyPixelBox({ x: state.x, y: state.y, size: metrics.size, bottomPad: metrics.bottomPad });
    for (const slotId of Object.keys(slots)) {
      if (slotId === deps.petId) continue;
      const slot = slots[slotId];
      const otherBox = slot.getBox();
      if (!otherBox) continue;
      const otherBody = bodyPixelBox({ x: otherBox.x, y: otherBox.y, size: slot.size, bottomPad: slot.bottomPad });
      if (!rectsOverlap(myBody, otherBody)) continue;
      const separated = separate(state, overlapPush(myBody, otherBody));
      const vel = slot.getVel();
      const hit = collidePet(
        { x: state.x, y: state.y, vx: state.vx, vy: state.vy, size: metrics.size },
        { x: otherBox.x, y: otherBox.y, vx: vel.vx, vy: vel.vy, size: slot.size }
      );
      if (hit === null) return separated;
      deps.onPetImpact(hit.impactSpeed);
      slot.applyVelocity(hit.hvx, hit.hvy);
      return { ...separated, vx: hit.fvx, vy: hit.fvy };
    }
    return state;
  };
}

// vendor/dsh-pet/src/client/pet/motion/flight.ts
var MAX_HELD_SPEED = 6e3;
function createFlight(deps) {
  let frame = null;
  let token = 0;
  let state = null;
  let held = false;
  let quietMs = 0;
  const resolveCollisions = createPetCollision({
    arena: deps.arena,
    petId: deps.petId,
    onPetImpact: (speed) => deps.onImpact?.({ kind: "pet", speed })
  });
  const stop = () => {
    token++;
    if (frame !== null) {
      cancelAnimationFrame(frame);
      frame = null;
    }
    state = null;
    held = false;
    quietMs = 0;
  };
  const start = (px, py, vx, vy) => {
    held = false;
    run(px, py, vx, vy);
  };
  const startHeld = () => {
    if (frame !== null && held) return;
    const el = deps.root();
    const box = deps.box() ?? (el ? { x: el.getBoundingClientRect().left, y: el.getBoundingClientRect().top } : null);
    if (box === null) return;
    held = true;
    run(box.x, box.y, 0, 0);
  };
  const setVelocity = (vx, vy) => {
    if (state === null) return;
    state.vx = vx;
    state.vy = vy;
  };
  const impulse = (dvx, dvy) => {
    if (state === null) return;
    state.vx += dvx;
    state.vy += dvy;
  };
  const run = (px, py, vx, vy) => {
    const metrics = deps.metrics();
    const viewport = deps.viewport();
    const physics = deps.physics();
    const bounds = throwBounds({
      W: viewport.width,
      H: viewport.height,
      size: metrics.size,
      sideAllow: metrics.sideAllow
    });
    const own = ++token;
    quietMs = 0;
    let current2 = { x: px, y: py, vx, vy };
    let last = performance.now();
    let prevGrounded = false;
    const rootEl = deps.root();
    const commitPose = (at) => {
      if (rootEl) {
        rootEl.style.left = at.x + "px";
        rootEl.style.top = at.y + "px";
        rootEl.style.right = "auto";
        rootEl.style.bottom = "auto";
      }
      deps.setBox({ x: at.x, y: at.y });
      const center = { rx: (at.x + metrics.halfW) / viewport.width, ry: (at.y + metrics.halfH) / viewport.height };
      deps.commitLive(center);
      return center;
    };
    const step = () => {
      if (token !== own) return;
      const now = performance.now();
      const dt = Math.min(0.05, Math.max(0, (now - last) / 1e3));
      last = now;
      const fallingVy = current2.vy;
      const gravity = held ? deps.gravity?.() : void 0;
      const res = integrateFlight(current2, dt, bounds, physics, gravity);
      if (res.hit !== null) deps.onImpact?.({ kind: res.hit.edge, speed: res.hit.speed });
      const integrated = { x: res.x, y: res.y, vx: res.vx, vy: res.vy };
      current2 = integrated;
      if (physics.petCollision) current2 = resolveCollisions(current2, metrics);
      const disturbed = current2 !== integrated;
      if (held) {
        const speed = Math.hypot(current2.vx, current2.vy);
        if (speed > MAX_HELD_SPEED) {
          const k = MAX_HELD_SPEED / speed;
          current2 = { ...current2, vx: current2.vx * k, vy: current2.vy * k };
        }
      }
      state = current2;
      const center = commitPose(current2);
      const grounded = current2.y >= bounds.maxY - 1;
      if (res.bounced && grounded && !prevGrounded) deps.onLanding(fallingVy);
      prevGrounded = grounded;
      if (held) {
        const g = gravity ?? { gx: 0, gy: physics.gravity };
        const isStill = Math.hypot(g.gx, g.gy) < 1 && Math.hypot(current2.vx, current2.vy) < 20;
        quietMs = isStill ? quietMs + dt * 1e3 : 0;
        if (quietMs >= 300) {
          deps.commitFinal(center);
          stop();
          return;
        }
      } else if (res.atRest && !disturbed) {
        deps.commitFinal(center);
        stop();
        return;
      }
      frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
  };
  return {
    impulse,
    isFlying: () => frame !== null,
    isHeld: () => held,
    setVelocity,
    start,
    startHeld,
    stop,
    velocity: () => frame !== null && state !== null ? { vx: state.vx, vy: state.vy } : { vx: 0, vy: 0 }
  };
}

// vendor/dsh-pet/src/client/pet/haptics.ts
var HAPTIC_COOLDOWN_MS = 120;
var HAPTIC_MIN_SPEED = 150;
var SOFT_SPEED = 300;
var HARD_SPEED = 1500;
var SHORT_PULSE_MS = 10;
var LONG_PULSE_MS = 28;
function pulseMsFor(speed) {
  if (!Number.isFinite(speed) || speed < HAPTIC_MIN_SPEED) return null;
  const t = Math.min(1, Math.max(0, (speed - SOFT_SPEED) / (HARD_SPEED - SOFT_SPEED)));
  return Math.round(SHORT_PULSE_MS + (LONG_PULSE_MS - SHORT_PULSE_MS) * t);
}
function createHaptics(deps) {
  const vibrate = deps?.vibrate ?? hardwareVibrate;
  const now = deps?.now ?? (() => performance.now());
  const enabled = deps?.enabled ?? (() => true);
  const lastAt = /* @__PURE__ */ new Map();
  return {
    hit(kind, speed) {
      if (!enabled()) return;
      const ms = pulseMsFor(speed);
      if (ms === null) return;
      const at = now();
      const prev = lastAt.get(kind);
      if (prev !== void 0 && at - prev < HAPTIC_COOLDOWN_MS) return;
      lastAt.set(kind, at);
      vibrate(ms);
    }
  };
}
function hardwareVibrate(ms) {
  if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") return;
  if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
  try {
    navigator.vibrate(ms);
  } catch {
  }
}

// vendor/dsh-pet/src/client/pet/motion/position-follow.ts
function createPositionFollow(deps) {
  let frame = null;
  let token = 0;
  const stop = () => {
    token += 1;
    if (frame !== null) {
      cancelAnimationFrame(frame);
      frame = null;
    }
  };
  const paint = (el, x, y) => {
    deps.setBox({ x, y });
    el.style.left = x + "px";
    el.style.top = y + "px";
    el.style.right = "auto";
    el.style.bottom = "auto";
  };
  const apply = (rx, ry, mode, duration) => {
    if (deps.isDragging()) return;
    deps.takeOver();
    const target = centerToBox({ rx, ry }, deps.viewport(), deps.half());
    const el = deps.root();
    if (!el || mode === "instant" || mode === "line" && duration <= 0) {
      deps.setBox(target);
      deps.commit({ rx, ry });
      return;
    }
    const current2 = token + 1;
    token = current2;
    if (frame !== null) cancelAnimationFrame(frame);
    if (mode === "line") {
      if (duration <= 0) return;
      const from = deps.box() ?? target;
      const t0 = performance.now();
      const step2 = () => {
        if (token !== current2) return;
        const p = Math.min((performance.now() - t0) / duration, 1);
        if (p >= 1) {
          paint(el, target.x, target.y);
          frame = null;
          deps.commit({ rx, ry });
          return;
        }
        paint(el, from.x + (target.x - from.x) * p, from.y + (target.y - from.y) * p);
        frame = requestAnimationFrame(step2);
      };
      frame = requestAnimationFrame(step2);
      return;
    }
    let last = performance.now();
    const vel = { vx: 0, vy: 0 };
    const step = () => {
      if (token !== current2) return;
      const now = performance.now();
      const dt = Math.min((now - last) / 1e3, 1 / 30);
      last = now;
      let x = deps.box()?.x ?? target.x;
      let y = deps.box()?.y ?? target.y;
      vel.vx = springStep(vel.vx, x, target.x, dt, deps.spring());
      vel.vy = springStep(vel.vy, y, target.y, dt, deps.spring());
      x += vel.vx * dt;
      y += vel.vy * dt;
      paint(el, x, y);
      if (Math.abs(target.x - x) < 0.5 && Math.abs(target.y - y) < 0.5 && Math.abs(vel.vx) < 1 && Math.abs(vel.vy) < 1) {
        paint(el, target.x, target.y);
        frame = null;
        deps.commit({ rx, ry });
        return;
      }
      frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
  };
  return { apply, stop };
}

// vendor/dsh-pet/src/client/pet/motion/squash.ts
function createSquashDriver(o) {
  let frame = null;
  let token = 0;
  const stop = () => {
    token += 1;
    if (frame !== null) {
      cancelAnimationFrame(frame);
      frame = null;
    }
  };
  const start = (el, depth = SQ_SQUASH) => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    token += 1;
    const current2 = token;
    if (frame !== null) cancelAnimationFrame(frame);
    const origin = el.style.transformOrigin;
    el.style.transformOrigin = "bottom";
    const t0 = performance.now();
    const step = () => {
      if (token !== current2) return;
      const u = Math.min((performance.now() - t0) / SQ_DURATION_MS, 1);
      const scale = squashScale(u, depth);
      el.style.transform = (o.facing() === "right" ? "scaleX(-1) " : "") + "scaleY(" + scale + ")";
      if (u < 1) {
        frame = requestAnimationFrame(step);
        return;
      }
      frame = null;
      el.style.transformOrigin = origin;
      el.style.transform = o.facing() === "right" ? "scaleX(-1)" : "";
    };
    frame = requestAnimationFrame(step);
  };
  return { start, stop };
}

// vendor/dsh-pet/src/shared/motion.ts
var planMove = (o) => {
  const side = o.sideAllow ?? 0;
  const distance = randomBetween(o.minDist, o.maxDist);
  const target = o.cx + o.dir * distance;
  if (o.areas && o.areas.length > 0) {
    const bodyHalf = o.halfW - side;
    if (!rectAtPoint(o.areas, target - bodyHalf - o.margin, o.cy)) return null;
    if (!rectAtPoint(o.areas, target + bodyHalf + o.margin, o.cy)) return null;
  } else {
    const leftBound = o.margin + o.halfW - side;
    const rightBound = o.W - o.margin - o.halfW + side;
    if (target < leftBound || target > rightBound) return null;
  }
  return {
    startRatio: o.cx / o.W,
    startYRatio: o.cy / o.H,
    targetRatio: target / o.W,
    totalRatio: Math.abs(target - o.cx) / o.W
  };
};

// vendor/dsh-pet/src/client/pet/motion/move-action.ts
function planMoveAction(input) {
  const actions = input.moves.actions;
  if (actions.length === 0) return null;
  const random = input.random ?? Math.random;
  const chosen = input.preferredName ? actions.find((action) => action.name === input.preferredName) ?? null : actions[Math.floor(random() * actions.length)];
  if (!chosen) return null;
  const params = Object.assign({}, input.moves.default, chosen.params ?? {});
  const dir = input.facing === "right" ? 1 : -1;
  const distScale = input.size / PET_REF_WIDTH;
  const plan = planMove({
    cx: input.center.x,
    cy: input.center.y,
    W: input.viewport.width,
    H: input.viewport.height,
    dir,
    minDist: params.minDist * distScale,
    maxDist: params.maxDist * distScale,
    margin: params.margin,
    halfW: input.halfW,
    sideAllow: input.sideAllow
  });
  if (plan === null) return null;
  return { anim: chosen.name, pending: { ...plan, dir, leadSec: params.leadSec, tailSec: params.tailSec } };
}

// vendor/dsh-pet/src/client/pet/motion/walk.ts
var FALLBACK_DURATION_SEC = 10.09;
function createWalk(deps) {
  let frame = null;
  let token = 0;
  let pending = null;
  const hasPending = () => pending !== null;
  const start = (el) => {
    if (pending === null || frame !== null) return;
    const move = pending;
    pending = null;
    const duration = Number.isFinite(el.duration) && el.duration > 0 ? el.duration : FALLBACK_DURATION_SEC;
    const travelWindow = Math.max(0.1, duration - move.leadSec - move.tailSec);
    const own = ++token;
    const step = () => {
      if (token !== own) return;
      const t = el.currentTime || 0;
      const { halfW, halfH } = deps.metrics();
      const { width: W, height: H } = deps.viewport();
      let ratioX;
      if (t <= move.leadSec) ratioX = move.startRatio;
      else if (t >= duration - move.tailSec) ratioX = move.targetRatio;
      else ratioX = move.startRatio + (move.targetRatio - move.startRatio) * ((t - move.leadSec) / travelWindow);
      const box = { x: ratioX * W - halfW, y: move.startYRatio * H - halfH };
      const rootEl = deps.root();
      if (rootEl) {
        rootEl.style.left = box.x + "px";
        rootEl.style.top = box.y + "px";
        rootEl.style.right = "auto";
        rootEl.style.bottom = "auto";
      }
      deps.setBox(box);
      if (t < duration - move.tailSec) frame = requestAnimationFrame(step);
      else {
        frame = null;
        deps.commit({ rx: move.targetRatio, ry: move.startYRatio });
      }
    };
    frame = requestAnimationFrame(step);
  };
  const tryMove = (preferredName) => {
    if (frame !== null || pending !== null || deps.isFlying()) return true;
    const metrics = deps.metrics();
    const action = planMoveAction({
      moves: deps.moves(),
      preferredName,
      // 走路方向只看当前 facing；不要用 turn 动画反推方向，facingRef 已在 handleEnded 即时同步。
      facing: deps.facing(),
      size: metrics.size,
      center: deps.center(),
      viewport: deps.viewport(),
      halfW: metrics.halfW,
      sideAllow: metrics.sideAllow
    });
    if (action === null) return false;
    pending = action.pending;
    deps.play(action.anim);
    return action.anim;
  };
  const stop = () => {
    pending = null;
    token++;
    if (frame !== null) {
      cancelAnimationFrame(frame);
      frame = null;
    }
  };
  return { hasPending, start, stop, tryMove };
}

// vendor/dsh-pet/src/client/pet/card/motion.ts
function createCardMotion(rt) {
  const { useEffect, useRef } = rt;
  return function useCardMotion(input) {
    const { arena, card, cfgRef, live, metrics, moves, petId, root, setAnim, setOnce, setCustomPos } = input;
    const motionRef = useRef(metrics);
    motionRef.current = metrics;
    const movesRef = useRef(moves);
    movesRef.current = moves;
    const boxRef = useRef(null);
    const squashRef = useRef(null);
    squashRef.current ??= createSquashDriver({ facing: () => card.facingRef.current });
    const squash = squashRef.current;
    const currentCenterX = () => {
      const cp = card.customPosRef.current;
      if (cp) return cp.rx * window.innerWidth;
      const rootEl = root();
      if (rootEl) return rootEl.getBoundingClientRect().left + motionRef.current.halfW;
      return window.innerWidth - 24 - motionRef.current.halfW;
    };
    const currentCenterY = () => {
      const cp = card.customPosRef.current;
      if (cp) return cp.ry * window.innerHeight;
      const rootEl = root();
      if (rootEl) return rootEl.getBoundingClientRect().top + motionRef.current.halfH;
      return window.innerHeight - 20 - motionRef.current.halfH;
    };
    const walkRef = useRef(null);
    walkRef.current ??= createWalk({
      root,
      center: () => ({ x: currentCenterX(), y: currentCenterY() }),
      metrics: () => motionRef.current,
      moves: () => movesRef.current,
      facing: () => card.facingRef.current,
      viewport: () => ({ width: window.innerWidth, height: window.innerHeight }),
      isFlying: () => flightRef.current?.isFlying() ?? false,
      play: (name) => {
        setOnce(true);
        setAnim(name);
      },
      setBox: (box) => {
        boxRef.current = box;
      },
      commit: setCustomPos
    });
    const walk = walkRef.current;
    const stopMove = () => {
      walkRef.current?.stop();
      posFollowRef.current?.stop();
    };
    const flightRef = useRef(null);
    const hapticsRef = useRef(null);
    hapticsRef.current ??= createHaptics({ enabled: () => cfgRef.current.physics?.hapticEnabled !== false });
    const haptics = hapticsRef.current;
    flightRef.current ??= createFlight({
      root,
      metrics: () => motionRef.current,
      viewport: () => ({ width: window.innerWidth, height: window.innerHeight }),
      physics: () => cfgRef.current.physics,
      arena: () => arena.current,
      petId,
      box: () => boxRef.current,
      setBox: (box) => {
        boxRef.current = box;
      },
      commitLive: (center2) => {
        card.customPosRef.current = center2;
      },
      commitFinal: setCustomPos,
      onLanding: (impactVy) => {
        const frontEl = live.current.ownAnim.frontVideo();
        if (frontEl) live.current.squash.start(frontEl, landingSquash(impactVy));
      },
      onImpact: (impact) => {
        haptics.hit(impact.kind, impact.speed);
      },
      // 只在常驻（倾斜）模式被读：倾斜没开或还没有采样时退回竖直重力，行为与关掉体感一致。
      gravity: () => {
        const physics = cfgRef.current.physics;
        const gravity = physics?.gravity ?? 0;
        if (physics?.tiltGravity !== true) return { gx: 0, gy: gravity };
        const sample = tiltSampleRef.current;
        const baseline = tiltBaselineRef.current;
        if (sample === null || baseline === null) return { gx: 0, gy: gravity };
        return tiltGravity(sample, baseline, gravity);
      }
    });
    const flight = flightRef.current;
    const tiltSampleRef = useRef(null);
    const tiltBaselineRef = useRef(null);
    const startThrow = (px, py, vx, vy) => {
      live.current.drag.stopFollow();
      stopMove();
      flight.start(px, py, vx, vy);
    };
    const applyVelocity = (vx, vy, mode) => {
      if (flight.isFlying()) {
        if (mode === "set") flight.setVelocity(vx, vy);
        else flight.impulse(vx, vy);
        return;
      }
      const at = boxRef.current ?? root()?.getBoundingClientRect() ?? null;
      if (at === null) return;
      startThrow(at.x, at.y, vx, vy);
    };
    const applyVelocityRef = useRef(() => {
    });
    applyVelocityRef.current = applyVelocity;
    useEffect(() => {
      if (!canReadMotionSensors()) return;
      const offTilt = subscribeTilt((sample) => {
        if (cfgRef.current.physics?.tiltGravity !== true) {
          tiltSampleRef.current = null;
          tiltBaselineRef.current = null;
          if (flight.isHeld()) flight.stop();
          return;
        }
        if (tiltBaselineRef.current === null) tiltBaselineRef.current = sample;
        tiltSampleRef.current = sample;
        if (live.current.drag.isActive() || flight.isFlying()) return;
        const gravity = cfgRef.current.physics?.gravity ?? 0;
        const vector = tiltGravity(sample, tiltBaselineRef.current, gravity);
        if (vector.gx === 0 && vector.gy === 0) return;
        stopMove();
        flight.startHeld();
      });
      const offShake = subscribeShake((ax, ay, az) => {
        const physics = cfgRef.current.physics;
        if (physics?.shakeThrow !== true) return;
        if (live.current.drag.isActive()) return;
        const impulse = shakeImpulse(ax, ay, az, physics.throwPower ?? 1);
        if (impulse !== null) applyVelocityRef.current(impulse.vx, impulse.vy, "add");
      });
      return () => {
        offTilt();
        offShake();
        flight.stop();
      };
    }, []);
    const posFollowRef = useRef(null);
    posFollowRef.current ??= createPositionFollow({
      root,
      box: () => boxRef.current,
      setBox: (box) => {
        boxRef.current = box;
      },
      commit: setCustomPos,
      viewport: () => ({ width: window.innerWidth, height: window.innerHeight }),
      half: () => ({ w: motionRef.current.halfW, h: motionRef.current.halfH }),
      spring: () => cfgRef.current.physics.throwPower,
      isDragging: () => live.current.drag.isActive(),
      takeOver: () => {
        flightRef.current?.stop();
        walkRef.current?.stop();
        posFollowRef.current?.stop();
      }
    });
    const posFollow = posFollowRef.current;
    const applyThrow = (angleDeg, power) => {
      if (live.current.drag.isActive()) return;
      const { vx, vy } = throwVelocity(angleDeg, power);
      const box = boxRef.current ?? {
        x: currentCenterX() - motionRef.current.halfW,
        y: currentCenterY() - motionRef.current.halfH
      };
      startThrow(box.x, box.y, vx, vy);
    };
    const { size, bottomPad } = metrics;
    useEffect(() => {
      const arenaSlots = arena.current.slots;
      arenaSlots[petId] = {
        size,
        bottomPad,
        getBox: () => {
          if (boxRef.current) return boxRef.current;
          const r = root()?.getBoundingClientRect();
          return r ? { x: r.left, y: r.top } : null;
        },
        getVel: () => flight.velocity(),
        applyVelocity: (vx, vy) => applyVelocityRef.current(vx, vy, "set")
      };
      return () => {
        delete arenaSlots[petId];
      };
    }, [petId, size, bottomPad, arena]);
    const center = () => ({ x: currentCenterX(), y: currentCenterY() });
    live.current.walk = walk;
    live.current.flight = flight;
    live.current.posFollow = posFollow;
    live.current.squash = squash;
    live.current.center = center;
    live.current.stopMove = stopMove;
    return {
      applyThrow,
      box: () => boxRef.current,
      center,
      flight,
      metrics: () => motionRef.current,
      posFollow,
      setBox: (box) => {
        boxRef.current = box;
      },
      squash,
      startThrow,
      stopMove,
      walk
    };
  };
}

// vendor/dsh-pet/src/client/pet/card/state.ts
function createCardState(rt) {
  const { useState, useRef } = rt;
  return function useCardState(init) {
    const [anim, setAnim] = useState(init.anim);
    const [once, setOnce] = useState(true);
    const [seq, setSeq] = useState(0);
    const [cuePlayback, setCuePlayback] = useState(null);
    const [facing, setFacing] = useState("left");
    const [tipOn, setTipOn] = useState(false);
    const [customPos, setCustomPos] = useState(null);
    const [size, setSize] = useState(init.size);
    const [corner, setCorner] = useState(init.corner);
    const [margin, setMargin] = useState(init.margin);
    const animRef = useRef(anim);
    animRef.current = anim;
    const facingRef = useRef(facing);
    facingRef.current = facing;
    const customPosRef = useRef(customPos);
    customPosRef.current = customPos;
    const bumpSeq = () => setSeq((s) => s + 1);
    const play = (next, opts) => {
      setAnim(next);
      setOnce(opts?.once ?? true);
      if (opts?.replay) bumpSeq();
      if (opts?.cue !== void 0) setCuePlayback(opts.cue);
    };
    return {
      actions: {
        bumpSeq,
        play,
        setAnim,
        setCorner,
        setCuePlayback,
        setCustomPos,
        setFacing,
        setMargin,
        setOnce,
        setSize,
        setTipOn
      },
      animRef,
      customPosRef,
      facingRef,
      state: { anim, corner, cuePlayback, customPos, facing, margin, once, seq, size, tipOn }
    };
  };
}

// vendor/dsh-pet/src/client/pet/card/cue-effects.ts
var stamp4 = () => (/* @__PURE__ */ new Date()).toTimeString().slice(0, 8);
var log3 = (message) => {
  console.log("[dsh-pet] " + stamp4() + " " + message);
};
function createCueEffects(rt) {
  const { useEffect, useRef } = rt;
  return function useCueEffects(hub, props) {
    const { balance, balanceManual, balanceNoticeTick, balanceTick } = props;
    const { animCue, animCueTick, posCue, posCueTick, say, sayTick, throwCue, throwCueTick } = props;
    const { workStatus, workStatusTick } = props;
    const prevBalanceRef = useRef(0);
    const prevNoticeRef = useRef(0);
    const prevWorkRef = useRef(0);
    const prevWorkStateRef = useRef(void 0);
    const prevSayRef = useRef(0);
    const prevAnimRef = useRef(0);
    const prevPosRef = useRef(0);
    const prevThrowRef = useRef(0);
    const consumeBalance = () => {
      const cfg = hub.cfg();
      const card = hub.card;
      if (balanceTick === 0 || balanceTick === prevBalanceRef.current) return;
      prevBalanceRef.current = balanceTick;
      if (hub.ownAnim.isFrozen() && !balanceManual) return;
      if (hub.sleeping()) return;
      if (!balance || !balance.ok) return;
      if (!cfg.balanceEnabled && !balanceManual) return;
      const percent = balancePercent(balance);
      if (balanceManual || percent !== void 0 || balance.shape === "custom") hub.bubbles.showBalance();
      if (!cfg.balanceEnabled) return;
      if (percent === void 0) return;
      const pool = hub.anims().events?.balance;
      if (!pool || pool.length === 0) {
        console.error("[dsh-pet] \u914D\u7F6E\u7F3A\u5C11 animations.events.balance\uFF0C\u65E0\u6CD5\u64AD\u653E\u4F59\u989D\u4E8B\u4EF6\u52A8\u753B");
        return;
      }
      const idx = balanceEventIndex(percent);
      const slot = pool[idx];
      if (!slot) {
        console.error("[dsh-pet] balance \u6863\u4F4D\u7D22\u5F15\u8D8A\u754C\uFF1Ap=" + percent + " idx=" + idx);
        return;
      }
      const name = pickSlot(slot, card.animRef.current);
      log3("balance pet=" + cfg.id + " p=" + percent.toFixed(1) + "% -> [\u6863" + idx + "] " + name);
      hub.stopMotion();
      card.actions.setOnce(true);
      card.actions.setAnim(name);
    };
    const consumeBalanceNotice = () => {
      const cfg = hub.cfg();
      if (!cfg.balanceEnabled && !balanceManual) return;
      if (balanceNoticeTick === 0 || balanceNoticeTick === prevNoticeRef.current) return;
      prevNoticeRef.current = balanceNoticeTick;
      if (hub.ownAnim.isFrozen() && !balanceManual) return;
      if (hub.sleeping()) return;
      if (!balance || balance.ok) return;
      hub.bubbles.showBalance();
    };
    const consumeWorkStatus = () => {
      const cfg = hub.cfg();
      const card = hub.card;
      if (!cfg.workStatusEnabled) return;
      if (workStatusTick === 0 || workStatusTick === prevWorkRef.current) return;
      prevWorkRef.current = workStatusTick;
      if (hub.ownAnim.isFrozen()) return;
      if (hub.sleeping()) return;
      if (!workStatus || workStatus.state === null) {
        log3("pet=" + cfg.id + " " + (prevWorkStateRef.current ?? "null") + "->null    \u64AD\u5B8C\u5373\u505C\uFF08\u56DE\u5F85\u673A\uFF0C\u6536\u8D77\u6C14\u6CE1\uFF09");
        prevWorkStateRef.current = null;
        if (poolIncludes(hub.anims().events?.workStatus ?? [], card.animRef.current)) hub.ownAnim.stopLoopingFront();
        hub.bubbles.resetWork();
        return;
      }
      const pool = hub.anims().events?.workStatus;
      if (!pool || pool.length === 0) {
        console.error("[dsh-pet] \u914D\u7F6E\u7F3A\u5C11 animations.events.workStatus\uFF0C\u65E0\u6CD5\u64AD\u653E\u5DE5\u4F5C\u72B6\u6001\u52A8\u753B");
        return;
      }
      const idx = WORK_STATUS_INDEX[workStatus.state];
      const slot = pool[idx];
      if (slot === void 0) {
        console.error("[dsh-pet] work-status \u6863\u4F4D\u7D22\u5F15\u8D8A\u754C\uFF1Astate=" + workStatus.state + " idx=" + idx);
        return;
      }
      const name = pickSlot(slot, card.animRef.current);
      log3("pet=" + cfg.id + " " + (prevWorkStateRef.current ?? "null") + "->" + workStatus.state + "    " + name);
      const stateChanged = prevWorkStateRef.current !== workStatus.state;
      prevWorkStateRef.current = workStatus.state;
      hub.stopMotion();
      const textGroup = Array.isArray(cfg.workStatusTexts) ? cfg.workStatusTexts[idx] : void 0;
      const configuredText = Array.isArray(textGroup) && textGroup.length > 0 ? textGroup[Math.floor(Math.random() * textGroup.length)] : void 0;
      hub.bubbles.updateWorkText(workStatus.task ?? configuredText ?? null);
      const terminal = workStatus.state === "success" || workStatus.state === "error";
      if (stateChanged) hub.bubbles.lightWork(terminal);
      const rotating = !terminal && Array.isArray(slot) && slot.length > 1;
      card.actions.setOnce(terminal || rotating);
      card.actions.setAnim(name);
    };
    const consumeSay = () => {
      if (!say || say.seq === prevSayRef.current) return;
      prevSayRef.current = say.seq;
      if (say.kind === "clear") {
        hub.bubbles.clearWhisper();
        return;
      }
      hub.speak(say.text, say.image, say.url, say.duration, say.anim);
      playSayVoice(say);
    };
    const consumeAnimCue = () => {
      const card = hub.card;
      if (!animCue || animCue.seq === prevAnimRef.current) return;
      prevAnimRef.current = animCue.seq;
      const explicitFacing = animCue.facing !== void 0;
      if (animCue.facing !== void 0) {
        card.actions.setFacing(animCue.facing);
        card.facingRef.current = animCue.facing;
      }
      if (animCue.url !== void 0) {
        hub.stopMotion();
        hub.ownAnim.setCueUrl(animCue.url);
        card.actions.setOnce(true);
        card.actions.bumpSeq();
        card.actions.setAnim(animCue.url);
        card.actions.setCuePlayback(animCue.playbackId ?? null);
        return;
      }
      if (animCue.name === void 0) return;
      hub.playByName(animCue.name, animCue.playbackId, explicitFacing);
    };
    const consumePosCue = () => {
      if (!posCue || posCue.seq === prevPosRef.current) return;
      prevPosRef.current = posCue.seq;
      hub.posFollow.apply(posCue.x, posCue.y, posCue.mode, posCue.duration);
    };
    const consumeThrowCue = () => {
      if (!throwCue || throwCue.seq === prevThrowRef.current) return;
      prevThrowRef.current = throwCue.seq;
      hub.applyThrow(throwCue.angle, throwCue.power);
    };
    useEffect(() => {
      consumeBalance();
      consumeBalanceNotice();
      consumeWorkStatus();
      consumeSay();
      consumeAnimCue();
      consumePosCue();
      consumeThrowCue();
    }, [balanceTick, balanceNoticeTick, workStatusTick, sayTick, animCueTick, posCueTick, throwCueTick]);
  };
}

// vendor/dsh-pet/src/client/pet/card/lock-freeze.ts
function freezeDeadline(lock, nowMs) {
  const expiresAt = lock?.locked === true ? lock.expiresAt : 0;
  return expiresAt > nowMs ? expiresAt : 0;
}
function dispatchCue(cue, handlers) {
  if (cue === null) return;
  if (cue.kind === "frozen") handlers.onFrozen();
  else handlers.onResumed();
}
function createLockFreeze(rt) {
  const { useEffect, useRef } = rt;
  return function useLockFreeze(input) {
    const timerRef = useRef(null);
    const clearTimer = () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
    useEffect(() => {
      clearTimer();
      const now = Date.now();
      const expiresAt = freezeDeadline(input.lock, now);
      dispatchCue(input.setFrozen(expiresAt > now), input);
      if (expiresAt <= now) return clearTimer;
      timerRef.current = window.setTimeout(() => {
        timerRef.current = null;
        dispatchCue(input.setFrozen(false), input);
      }, expiresAt - now);
      return clearTimer;
    }, [input.lockTick, input.lock]);
    return {
      release: () => {
        clearTimer();
        dispatchCue(input.setFrozen(false), input);
      }
    };
  };
}

// vendor/dsh-pet/src/client/pet/card/runtime.ts
function createCardRuntime(rt) {
  const { h, useEffect, useRef, useState } = rt;
  const BalanceBubble = makeBalanceBubble({ h, useState, useEffect });
  const WhisperBubble = makeWhisperBubble({ h });
  const TodoBubble = makeTodoBubble({ h, useEffect, useRef });
  const useBubbleSlots = createBubbleSlots(
    { h, useState, useEffect, useRef },
    { balanceBubble: BalanceBubble, todoBubble: TodoBubble, whisperBubble: WhisperBubble }
  );
  const useCardState = createCardState({ useState, useRef });
  const useLockFreeze = createLockFreeze({ useEffect, useRef });
  const useCueEffects = createCueEffects({ useEffect, useRef });
  const useAnimationFlow = createAnimationFlow({ useRef });
  const useCardAnimation = createCardAnimation({ useEffect, useRef });
  const useCardMotion = createCardMotion({ useEffect, useRef });
  const useCardDrag = createCardDrag({ useRef, useEffect });
  const useCardEntry = createCardEntry({ useEffect, useRef });
  return function useCardRuntime(props) {
    const { arena, balance, balanceManual, cfg, lock, lockTick, menuItemsRef, sleep: sleep2, sleepTick, workStatus } = props;
    const { onFocusSession } = props;
    const effectiveSizePx = resolvePetSizePx(cfg.size, cfg.sizePercent, window.innerWidth);
    const card = useCardState({
      anim: cfg.animations.idle[0] ?? "",
      corner: cfg.position.corner,
      margin: { x: cfg.position.marginX, y: cfg.position.marginY },
      size: effectiveSizePx
    });
    const { actions, state } = card;
    const { corner, customPos, facing, margin, size, tipOn } = state;
    const liveRef = useRef({});
    const menuActionsRef = useRef(null);
    const entryRef = useRef(null);
    const pendingSquashRef = useRef(false);
    const cfgRef = useRef(cfg);
    cfgRef.current = cfg;
    const workStatusRef = useRef(workStatus);
    workStatusRef.current = workStatus;
    const rootRef = useRef(null);
    const stageRef = useRef(null);
    const videoARef = useRef(null);
    const videoBRef = useRef(null);
    const tipRef = useRef(null);
    const reportPlayback = makePlaybackReporter({ petId: cfg.id });
    const { halfW, halfH, bottomPad, sideAllow } = derivePetMetrics(size);
    const fontPx = resolveFontPx(cfg.font, size);
    const petAnims = cfg.animations;
    useEffect(() => {
      actions.setSize(resolvePetSizePx(cfg.size, cfg.sizePercent, window.innerWidth));
    }, [cfg.size, cfg.sizePercent]);
    useEffect(() => {
      actions.setCorner(cfg.position.corner);
      actions.setMargin({ x: cfg.position.marginX, y: cfg.position.marginY });
      actions.setCustomPos(null);
    }, [cfg.position.corner, cfg.position.marginX, cfg.position.marginY]);
    const bubbles = useBubbleSlots({
      assetRoot: cfg.assetRoot,
      balance,
      balanceEnabled: cfg.balanceEnabled,
      balanceManual,
      workStatusEnabled: cfg.workStatusEnabled,
      workTerminal: workStatus?.state === "success" || workStatus?.state === "error",
      workSessionId: workStatus?.sessionId ?? null,
      ...onFocusSession === void 0 ? {} : { onFocusSession }
    });
    const ownAnim = useCardAnimation({
      card,
      cfgRef,
      live: liveRef,
      lock,
      pendingSquash: pendingSquashRef,
      petId: cfg.id,
      report: reportPlayback,
      setCuePlayback: actions.setCuePlayback,
      videoA: () => videoARef.current,
      videoB: () => videoBRef.current,
      workStatusRef
    });
    const motion = useCardMotion({
      arena,
      card,
      cfgRef,
      live: liveRef,
      metrics: { bottomPad, halfH, halfW, sideAllow, size },
      moves: petAnims.moves,
      petId: cfg.id,
      root: () => rootRef.current,
      setAnim: actions.setAnim,
      setCustomPos: actions.setCustomPos,
      setOnce: actions.setOnce
    });
    const drag = useCardDrag({
      bumpSeq: actions.bumpSeq,
      card,
      cfgRef,
      live: liveRef,
      motion,
      pendingSquash: pendingSquashRef,
      root: () => rootRef.current,
      setAnim: actions.setAnim,
      setCustomPos: actions.setCustomPos,
      setOnce: actions.setOnce,
      setTipOn: actions.setTipOn
    });
    const entry = useCardEntry({
      card,
      cfgRef,
      drag,
      live: liveRef,
      menuItemsRef,
      motion,
      runMenuAction: (leaf2, playbackId, keepFacing) => menuActionsRef.current?.run(leaf2, playbackId, keepFacing),
      showTodo: bubbles.showTodo,
      stage: () => stageRef.current,
      tipRef,
      toggleTodo: bubbles.toggleTodo
    });
    entryRef.current = entry;
    menuActionsRef.current ??= createMenuActions({
      animations: () => cfgRef.current.animations,
      applyMerged: (merged) => petBridge.reload(merged),
      faceLeft: () => actions.setFacing("left"),
      isFacingRight: () => card.facingRef.current === "right",
      openChat: () => entryRef.current?.openChat(),
      openTodo: () => entryRef.current?.openTodo(),
      petId: cfg.id,
      playOnce: (anim, playbackId) => {
        actions.setOnce(true);
        actions.setAnim(anim);
        actions.setCuePlayback(playbackId);
      },
      report: reportPlayback,
      resetPosition: () => actions.setCustomPos(null),
      // 睡觉：菜单在点击那一刻就要能拒绝（对话弹窗、待办面板、动作点播都是纯前端行为，宿主拦不到）
      say: (text) => liveRef.current.flow?.speak(text, void 0, void 0, void 0, false),
      locked: () => ownAnim.isFrozen(),
      sleepRefuseTexts: () => cfgRef.current.sleepRefuseTexts ?? [],
      sleeping: () => liveRef.current.flow?.sleeping() ?? false,
      stopMove: motion.stopMove,
      stopThrow: () => motion.flight.stop(),
      tryMove: motion.walk.tryMove,
      warn: (message) => console.warn(message)
    });
    const menuActions = menuActionsRef.current;
    const lockFreeze = useLockFreeze({
      lock,
      lockTick,
      onFrozen: () => {
        motion.stopMove();
        bubbles.hideWork();
      },
      onResumed: () => {
        if (liveRef.current.flow?.resumeWorkStatusAnim() ?? false) return;
        if (petAnims.idle.length) {
          actions.setAnim(pick(petAnims.idle, card.animRef.current));
          actions.setOnce(true);
          actions.bumpSeq();
        }
      },
      setFrozen: ownAnim.setFrozen
    });
    liveRef.current.releaseLock = () => {
      lockFreeze.release();
      void postAction(ROUTE_PATH + "/lock/release?pet=" + encodeURIComponent(cfg.id), { force: true });
    };
    const hub = {
      anims: () => cfgRef.current.animations,
      applyThrow: motion.applyThrow,
      bubbles,
      card,
      cfg: () => cfgRef.current,
      isDragging: () => drag.isActive(),
      ownAnim,
      // 第四个参数 = 宿主指令：来自 pets.<id>.anim 的点播，不按「用户点击」判睡觉
      playByName: (anim, playbackId, keepFacing) => menuActions.run({ anim, label: anim }, playbackId, keepFacing, true),
      posFollow: motion.posFollow,
      speak: (text, image, url, duration, anim) => liveRef.current.flow?.speak(text, image, url, duration, anim),
      // 睡觉是状态不是指令：自动来源（工作状态/余额/碎碎念）读它决定要不要闭嘴
      sleeping: () => liveRef.current.flow?.sleeping() ?? false,
      // 占用锁：锁的语义是把控制权交给第三方，睡觉的菜单闸门与自动化闸门都对持锁者让路
      locked: () => ownAnim.isFrozen(),
      stopMotion: motion.stopMove,
      tryWalk: motion.walk.tryMove
    };
    useCueEffects(hub, props);
    const flow = useAnimationFlow(hub, workStatus);
    liveRef.current.flow = flow;
    useEffect(() => {
      if (sleep2) flow.applySleep(sleep2);
    }, [sleepTick]);
    const stageStyle = petStageStyle(bottomPad);
    const rootStyle = petRootStyle(
      customPos,
      { width: window.innerWidth, height: window.innerHeight },
      { h: halfH, w: halfW }
    );
    return {
      // 气泡单槽：四种气泡共用同一套定位，按优先级只挂一个。
      bubble: bubbles.node(),
      corner,
      facing,
      fontBubblePx: fontPx.bubble,
      fontTipPx: fontPx.tip,
      marginX: margin.x,
      marginY: margin.y,
      name: cfg.name,
      onClick: () => {
        if (drag.justDragged() || drag.isActive()) return;
        const phase = liveRef.current.flow?.sleepPhase() ?? null;
        if (phase !== null && phase !== "start") {
          const front = ownAnim.frontVideo();
          if (front) liveRef.current.squash.start(front);
          playClickSound();
          void postAction(ROUTE_PATH + "/wake?pet=" + encodeURIComponent(cfg.id));
          return;
        }
        if (phase === "start") void postAction(ROUTE_PATH + "/wake?pet=" + encodeURIComponent(cfg.id));
        drag.onClick();
      },
      onContextMenu: entry.handleContextMenu,
      onPointerDown: drag.onPointerDown,
      onPointerEnter: entry.onPointerEnter,
      onPointerLeave: entry.onPointerLeave,
      onPointerMove: drag.onPointerMove,
      onPointerUp: drag.onPointerUp,
      rootRef,
      rootStyle,
      size,
      stageRef,
      stageStyle,
      tipOn,
      tipRef,
      videoARef,
      videoBRef
    };
  };
}

// vendor/dsh-pet/src/client/pet/card/pet-card.ts
function createPetCard(rt) {
  const { h } = rt;
  const CardView = makeCardView({ h });
  const useCardRuntime = createCardRuntime(rt);
  function PetCard(props) {
    return h(CardView, useCardRuntime(props));
  }
  return PetCard;
}

// vendor/dsh-pet/src/shared/focus-session.ts
var FOCUS_REPLAY_WINDOW_MS = 1e4;
function readFocusSession(raw, now, lastTs) {
  if (!raw || typeof raw !== "object") return null;
  const { sessionId, ts } = raw;
  if (typeof sessionId !== "string" || sessionId === "") return null;
  if (typeof ts !== "number" || !Number.isFinite(ts)) return null;
  if (ts <= lastTs) return null;
  if (now - ts > FOCUS_REPLAY_WINDOW_MS) return null;
  return { sessionId, ts };
}

// vendor/dsh-pet/src/client/pet/state-poll.ts
var sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function runStatePoll(deps) {
  let longPoll = false;
  let since;
  while (deps.isAlive()) {
    let state = null;
    try {
      state = await deps.fetch(longPoll && since !== void 0 ? { since, timeoutMs: deps.waitMs } : void 0);
    } catch {
    }
    if (!deps.isAlive()) return;
    if (state !== null) {
      longPoll = typeof state.counter === "number";
      if (longPoll && typeof state.counter === "number") since = state.counter;
      deps.onState(state);
    }
    if (state === null || !longPoll) await sleep(deps.fallbackMs);
  }
}

// vendor/dsh-pet/src/client/state-service.ts
var latest = null;
var listeners = /* @__PURE__ */ new Set();
function setStateSnapshot(state) {
  latest = state;
  for (const listener of listeners) {
    try {
      listener(state);
    } catch (error) {
      console.error("[dsh-pet] \u72B6\u6001\u8BA2\u9605\u56DE\u8C03\u51FA\u9519\uFF08\u5DF2\u5FFD\u7565\uFF0C\u4E0D\u5F71\u54CD\u8F6E\u8BE2\uFF09\uFF1A", error);
    }
  }
}

// vendor/dsh-pet/src/client/pet/multi.ts
function createPetMulti(rt, Card) {
  const { h, useState, useEffect, useRef } = rt;
  return function PetMulti() {
    const [pets, setPets] = useState([]);
    const [ready, setReady] = useState(false);
    const arenaRef = useRef({ slots: {} });
    const [balance, setBalance] = useState(null);
    const [balanceTick, setBalanceTick] = useState(0);
    const [balanceNoticeTick, setBalanceNoticeTick] = useState(0);
    const [balanceManual, setBalanceManual] = useState(false);
    const noticeKeyRef = useRef(null);
    const applyBalanceRef = useRef(() => {
    });
    applyBalanceRef.current = (state, explicit) => {
      setBalance(state);
      setBalanceManual(explicit);
      if (state.ok) {
        setBalanceTick((t) => t + 1);
        return;
      }
      const { show, key } = decideBalanceNotice(state, noticeKeyRef.current, explicit);
      noticeKeyRef.current = key;
      if (show) setBalanceNoticeTick((t) => t + 1);
      if (state.reason !== "unsupported") {
        console.error("[dsh-pet] \u4F59\u989D\u67E5\u8BE2\u5931\u8D25 reason=" + state.reason + (state.message ? " " + state.message : ""));
      }
    };
    const [workStatus, setWorkStatus] = useState(null);
    const [workStatusTick, setWorkStatusTick] = useState(0);
    useEffect(() => {
      const family = pets[0]?.font?.family;
      if (family === void 0) return;
      document.documentElement.style.setProperty("--dsh-pet-font-family", fontStackOf(family));
    }, [pets]);
    useEffect(() => {
      let alive = true;
      const applyMerged = (merged) => {
        const main = merged?.main;
        if (typeof main !== "object" || main === null) {
          throw new Error("\u914D\u7F6E\u54CD\u5E94\u4E0D\u662F\u6210\u54C1\u805A\u5408\uFF08host \u7248\u672C\u4E0D\u5339\u914D\uFF1F\uFF09");
        }
        setClickSoundEnabled(main.clickSoundEnabled === true);
        setSurface("web");
        setVoiceConfig(main.voiceName, main.voiceEnabled, main.voiceVolume);
        const flattened = flattenConfigPets(merged);
        petBridge.current = flattened;
        petBridge.template = Array.isArray(main.pets) ? main.pets[0] ?? void 0 : void 0;
        setPets(flattened);
      };
      const loadMerged = async () => {
        const r = await fetch(ROUTE_PATH + "/config", { cache: "no-store" });
        if (!r.ok) throw new Error("config HTTP " + r.status);
        const body = await r.json();
        if (body.ok === false) throw new Error("config: " + String(body.reason ?? "failed"));
        return body;
      };
      (async () => {
        try {
          const merged = await loadMerged();
          if (!alive) return;
          applyMerged(merged);
          setReady(true);
        } catch (e) {
          console.error("[dsh-pet] \u914D\u7F6E\u52A0\u8F7D\u5931\u8D25", e);
        }
      })();
      petBridge.reload = (merged) => {
        void (async () => {
          try {
            const next = merged ?? await loadMerged();
            if (!alive) return;
            applyMerged(next);
          } catch (e) {
            console.error("[dsh-pet] \u914D\u7F6E\u91CD\u8F7D\u5931\u8D25\uFF0C\u4FDD\u7559\u5F53\u524D\u6E32\u67D3\u5217\u8868", e);
          }
        })();
      };
      return () => {
        alive = false;
        petBridge.reload = () => {
        };
      };
    }, []);
    const visiblePets = pets.filter((p) => isWebVisible(p.display));
    const [sayTick, setSayTick] = useState(0);
    const sayRef = useRef({});
    const [animCueTick, setAnimCueTick] = useState(0);
    const animCueRef = useRef({});
    const [posCueTick, setPosCueTick] = useState(0);
    const posCueRef = useRef({});
    const [throwCueTick, setThrowCueTick] = useState(0);
    const throwCueRef = useRef({});
    const [lockTick, setLockTick] = useState(0);
    const lockRef = useRef({});
    const [sleepTick, setSleepTick] = useState(0);
    const sleepRef = useRef({});
    const menuItemsRef = useRef([]);
    const lastFocusTsRef = useRef(0);
    useEffect(() => {
      if (!ready) return;
      let alive = true;
      let baseline = null;
      const applyFocusSession = (data) => {
        const cue = readFocusSession(data, Date.now(), lastFocusTsRef.current);
        if (cue === null) return;
        lastFocusTsRef.current = cue.ts;
        jumpToSession(cue.sessionId);
      };
      const applySection = (name, leaf2) => {
        switch (name) {
          case "config":
            petBridge.reload();
            return;
          case "balance": {
            const hit = readBalance(leaf2);
            if (hit) applyBalanceRef.current(hit.state, hit.manual);
            return;
          }
          case "workStatus": {
            const snap = readWorkStatus(leaf2);
            if (snap) {
              setWorkStatus(snap);
              setWorkStatusTick((t) => t + 1);
            }
            return;
          }
          case "notify":
            notifyFromFrame(leaf2.data);
            return;
          case "menu":
            menuItemsRef.current = readMenuItems(leaf2.data, "web");
            setMenuItems(menuItemsRef.current);
            return;
          case "focusSession":
            applyFocusSession(leaf2.data);
            return;
        }
      };
      const applyPetLeaf = (name, petId, leaf2) => {
        switch (name) {
          case "say": {
            const said = readSay(leaf2);
            if (!said) return;
            sayRef.current[petId] = { ...said, seq: (sayRef.current[petId]?.seq ?? 0) + 1 };
            setSayTick((t) => t + 1);
            return;
          }
          case "anim": {
            const hit = readAnim(leaf2);
            if (!hit) return;
            animCueRef.current[petId] = {
              name: hit.name,
              url: hit.url,
              playbackId: hit.playbackId,
              facing: hit.facing,
              seq: (animCueRef.current[petId]?.seq ?? 0) + 1
            };
            setAnimCueTick((t) => t + 1);
            return;
          }
          case "position": {
            const hit = readPosition(leaf2);
            if (!hit) return;
            posCueRef.current[petId] = { ...hit, seq: (posCueRef.current[petId]?.seq ?? 0) + 1 };
            setPosCueTick((t) => t + 1);
            return;
          }
          case "throw": {
            const hit = readThrow(leaf2);
            if (!hit) return;
            throwCueRef.current[petId] = { ...hit, seq: (throwCueRef.current[petId]?.seq ?? 0) + 1 };
            setThrowCueTick((t) => t + 1);
            return;
          }
          case "lock": {
            const hit = readLock(leaf2);
            if (!hit) return;
            lockRef.current[petId] = hit;
            setLockTick((t) => t + 1);
            return;
          }
          case "sleep": {
            const hit = readSleep(leaf2);
            if (!hit) return;
            sleepRef.current[petId] = hit;
            setSleepTick((t) => t + 1);
            return;
          }
        }
      };
      const applyState = (s) => {
        setStateSnapshot(s);
        if (baseline === null) {
          baseline = flattenCounters(s);
          applyFocusSession(s.sections.focusSession?.data);
          menuItemsRef.current = readMenuItems(s.sections.menu?.data, "web");
          setMenuItems(menuItemsRef.current);
          for (const [petId, entry] of Object.entries(s.pets)) {
            const hit = entry?.sleep?.data == null ? null : readSleep(entry.sleep);
            if (hit) sleepRef.current[petId] = hit;
          }
          setSleepTick((t) => t + 1);
          return;
        }
        for (const { path, leaf: leaf2 } of takeChanged(s, baseline)) {
          if (leaf2.data === null) continue;
          const target = resolveLeafPath(path);
          if (target === null) continue;
          if (target.where === "section") applySection(target.name, leaf2);
          else applyPetLeaf(target.name, target.petId, leaf2);
        }
      };
      void runStatePoll({
        fetch: (options) => fetchState(
          void 0,
          options === void 0 ? void 0 : { since: options.since, timeoutMs: options.timeoutMs }
        ),
        onState: applyState,
        waitMs: STATE_WAIT_MS,
        fallbackMs: STATE_FALLBACK_MS,
        isAlive: () => alive
      });
      return () => {
        alive = false;
      };
    }, [ready]);
    return ready ? visiblePets.map(
      (p) => h(Card, {
        key: p.id,
        cfg: p,
        balance,
        balanceTick,
        balanceNoticeTick,
        balanceManual,
        workStatus,
        workStatusTick,
        onFocusSession: jumpToSession,
        say: sayRef.current[p.id],
        sayTick,
        animCue: animCueRef.current[p.id],
        animCueTick,
        posCue: posCueRef.current[p.id],
        posCueTick,
        throwCue: throwCueRef.current[p.id],
        throwCueTick,
        lock: lockRef.current[p.id],
        lockTick,
        sleep: sleepRef.current[p.id],
        sleepTick,
        menuItemsRef,
        arena: arenaRef
      })
    ) : null;
  };
}

// vendor/dsh-pet/src/client/pet.ts
function makePetUI(rt) {
  injectPetCss();
  const PetCard = createPetCard(rt);
  const PetMulti = createPetMulti(rt, PetCard);
  return PetMulti;
}
export {
  createPetCard,
  flattenConfigPets,
  fontStackOf,
  injectPetCss,
  makePetConfigSection,
  makePetUI,
  petBridge,
  readAnim,
  readBalance,
  readSay,
  readSleep,
  readWorkStatus,
  setClickSoundEnabled,
  zh
};
