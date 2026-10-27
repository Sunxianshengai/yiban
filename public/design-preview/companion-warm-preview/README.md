# 忆伴 · 陪伴聊天「暖色版」预览

2026-10-27。用户反馈：陪伴聊天页（深色 QQ／微信式 IM）与首页的暖色风格「非常不搭配」，要求改成与首页一致的风格，**先出预览图判断**，确认后才改动正式应用。

本轮只新增独立静态原型，没有修改 `app/`、`components/`、`lib/`、数据库与积分模块。

## 和上一轮的关系

| | 上一轮 `companion-im-preview/` | 本轮 `companion-warm-preview/` |
|---|---|---|
| 视觉 | 深色中性画布（用户指定的 QQ／微信截图） | 首页同款暖色渐变 + 白色大圆角卡片 |
| 定位 | 三栏 IM，左侧 84px 深色 rail | 同结构，三块白色圆角卡片悬浮在暖渐变上 |
| 用户气泡 | sage 绿（`#bfd0ae`） | 默认 sage 绿，`?bubble=clay` 可切暖陶土 |
| 结论 | 保留为「深色版」参考 | 待用户确认是否替换正式陪伴页 |

## 设计对齐（数值直接取自正式代码）

- 底色 `--chat` 取自 `app/preview-parity.css:2` 的 `--fa-chat`：
  `radial-gradient(#E4CDF8) + radial-gradient(#FFDFCB) + linear-gradient(#F5E4E4,#F0F0EE)`。
- 卡片 `--surface:#FFFDFB`、`--ink:#2B241B`、`--muted:#6F6258`、`--border:#DFD5CD`、`--brand:#3C1008`、
  `--brand-soft:#F4E3DA`、`--terracotta:#E7834B`，全部来自 `app/familia.css:4`。
- 圆角语言对齐首页：卡片 30px、会话项 24px、输入框 22px、圆形按钮 44–50px。
- 用户气泡沿用站点 sage `#93AF5B / #33451F`（与 `app/familia.css:23` 的 `.cw-user-text` 一致）。
- 字体与正式站相同：自托管 Urbanist + `@fontsource-variable/noto-sans-sc`。

## 查看

需要一个以仓库根目录为根的静态服务器（例如 `python -m http.server 3811`），然后访问
`/public/design-preview/companion-warm-preview/index.html`。若跑 `next dev`，则用
`http://localhost:3711/design-preview/companion-warm-preview/`。

- `?bubble=clay`：用户气泡与「我」头像切换为暖陶土色（更贴合首页桃粉）。
- 断点：1760 三栏 → 1300 收窄 → 900 以下切手机单栏。
- 交互仅为演示：发送消息、切换 tab、点按钮都会明确提示未接入。

## 已验证

Edge (Playwright) 实测 1440×1000／1280×900／1024×768／390×844 四种尺寸，sage 与 clay 两套气泡配色共 6 张截图，无控制台错误、无横向溢出。截图位于 `.impeccable/review/companion-warm-preview/`，复现脚本 `scripts/shoot-warm-preview.mjs`。

这些验证只证明预览可运行，不代表用户已批准接入正式应用。

## 已落地（2026-10-27）

用户看过预览后确认「直接部署」，正式应用已按下面三处改动换肤，提交 `3365c5c`：

1. `app/companion-chat.css:2` 的 `--im-*` token 换成暖色值；`--fa-chat` 作为聊天画布，卡片、气泡、输入区用 `--im-surface` 白卡 + 大圆角 + 无边框阴影。
2. `components/Chat.jsx:36` 的 `chatTheme` 默认值从 `'dark'` 改为 `'light'`，详情里的「聊天外观」仍可切换并保存。
3. 深色没有删除：`app/companion-chat.css:3` 保留 `[data-im-theme=dark]` 与 `html[data-theme=night]` 两套暗色 token，夜间模式下聊天区自动收敛到暗紫棕渐变。

真实页面截图见 `.impeccable/review/companion-warm-live/`，复现脚本 `scripts/shoot-warm-live.mjs`。
