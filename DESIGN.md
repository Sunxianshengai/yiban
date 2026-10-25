---
name: 忆伴
description: 暖白与深松绿构成的家庭记忆空间
colors:
  canvas: "#F7F6F2"
  surface: "#FFFEFB"
  surface-2: "#F1F0E9"
  leaf: "#E8EEE4"
  leaf-deep: "#DCE5D6"
  brand: "#2E5147"
  brand-strong: "#24403A"
  brand-soft: "#E9F0E9"
  ink: "#25332D"
  ink-2: "#3D4A43"
  muted: "#687168"
  faint: "#8B968D"
  border: "#D9DED3"
  border-strong: "#BFC9BB"
  error: "#A23F32"
  error-soft: "#F6E7E3"
  warn: "#715E38"
  warn-soft: "#F5EFDC"
  on-brand: "#FFFDF9"
  terracotta: "#C2693C"
typography:
  headline:
    fontFamily: "Noto Sans SC Variable, Noto Sans SC, PingFang SC, Microsoft YaHei, system-ui, sans-serif"
    fontSize: "clamp(1.65rem, 2.7vw, 2.15rem)"
    fontWeight: 600
    lineHeight: 1.35
    letterSpacing: "-.025em"
  title:
    fontFamily: "Noto Sans SC Variable, Noto Sans SC, PingFang SC, Microsoft YaHei, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 600
    lineHeight: 1.5
  body:
    fontFamily: "Noto Sans SC Variable, Noto Sans SC, PingFang SC, Microsoft YaHei, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 400
    lineHeight: 1.75
  label:
    fontFamily: "Noto Sans SC Variable, Noto Sans SC, PingFang SC, Microsoft YaHei, system-ui, sans-serif"
    fontSize: ".9688rem"
    fontWeight: 500
  button:
    fontFamily: "Noto Sans SC Variable, Noto Sans SC, PingFang SC, Microsoft YaHei, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 500
  chat-body:
    fontFamily: "Noto Sans SC Variable, Noto Sans SC, PingFang SC, Microsoft YaHei, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.95
  chat-control:
    fontFamily: "Noto Sans SC Variable, Noto Sans SC, PingFang SC, Microsoft YaHei, system-ui, sans-serif"
    fontSize: ".875rem"
  chat-note:
    fontFamily: "Noto Sans SC Variable, Noto Sans SC, PingFang SC, Microsoft YaHei, system-ui, sans-serif"
    fontSize: ".75rem"
  chat-code:
    fontFamily: "Consolas, monospace"
    fontSize: ".84em"
rounded:
  radius-sm: "10px"
  radius: "12px"
  feature: "16px"
  radius-lg: "20px"
  pill: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  compact: "12px"
  md: "16px"
  lg: "24px"
  xl: "32px"
  section: "48px"
components:
  button-primary:
    backgroundColor: "{colors.brand}"
    textColor: "{colors.on-brand}"
    typography: "{typography.button}"
    rounded: "{rounded.radius-sm}"
    padding: "0 20px"
  button-primary-hover:
    backgroundColor: "{colors.brand-strong}"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.brand}"
    rounded: "{rounded.radius-sm}"
    padding: "0 20px"
  button-ghost:
    textColor: "{colors.muted}"
    rounded: "{rounded.radius-sm}"
    padding: "0 20px"
  field:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.radius-sm}"
    padding: "9px 14px"
  badge:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.muted}"
    rounded: "{rounded.pill}"
    padding: "3px 11px"
  memory-card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.radius}"
  nav-active:
    backgroundColor: "{colors.brand-soft}"
    textColor: "{colors.brand}"
    rounded: "{rounded.radius-sm}"
    padding: "9px 11px"
  story-player:
    backgroundColor: "{colors.leaf}"
    textColor: "{colors.ink}"
    rounded: "{rounded.radius}"
    padding: "20px"
  chat-user-message:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.ink}"
    rounded: "{rounded.feature}"
    padding: "14px 20px"
  chat-reply:
    textColor: "{colors.ink}"
    typography: "{typography.chat-body}"
  chat-composer:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.feature}"
    padding: "16px 16px 10px"
  chat-history-active:
    backgroundColor: "{colors.leaf}"
    textColor: "{colors.brand}"
    padding: "11px 10px"
---

# Design System: 忆伴

## Overview

**Creative North Star: "安静的家庭相册"**

这是对现有实现的描述性命名。忆伴延续暖白画布、深松绿操作和中文无衬线文字，让家庭影像、原话和熟悉的声音成为视觉中心。宽松留白与柔和分隔线使内容易于阅读，色块用于承托内容和提示状态。

界面同时服务家庭记录者与回看故事的长辈。桌面通过主内容与辅助栏组织信息，手机顺序展开；文字随根字号设置缩放。保留原始内容、示例标识和声音来源说明，是视觉表达可信度的一部分。

**Key Characteristics:**
- 暖白背景，深松绿操作，低饱和叶绿色辅助面。
- 中文无衬线层级，真实家庭内容优先。
- 细描边与留白建立层次，浮层承载阴影。
- 可见的操作状态、来源说明和键盘焦点。

## Colors

前置令牌记录默认日间配色；同名 CSS 自定义属性是运行时来源。

### Primary
- **深松绿**（brand / brand-strong）：主操作、链接、选中项与焦点；强调状态加深。
- **淡叶绿**（leaf / leaf-deep / brand-soft）：问题引导、播放器、占位图与选中导航背景。

### Secondary
- **陶土橘**（terracotta）：既有系统中的小面积时间和强调标记。

### Neutral
- **暖白画布与纸面**（canvas / surface / surface-2）：区分页面、内容容器与内嵌设置区。
- **绿灰文字**（ink / ink-2 / muted / faint）：正文、次正文、说明与低优先级元数据。
- **灰绿描边**（border / border-strong）：普通容器与可编辑控件的边界。
- **暖白反白文字**（on-brand）：主按钮文字。

错误使用 error / error-soft，待核对或提醒使用 warn / warn-soft。既有徽记还提供 sage、peach、lavender、gold、blue 的浅底深字配对，使用 globals.css 中成对的 tint 属性，避免独立拼配前景与背景。

夜间由 `data-theme=night` 切换同名属性：深松绿画布配浅薄荷主操作，主操作文字随 on-brand 变深。高对比度由 `data-contrast=high` 调整文字和描边。不要把日间十六进制值硬编码到主题组件。

**The Semantic Pair Rule.** 主操作始终成对使用 brand 与 on-brand，状态面成对使用对应的前景与浅底。

## Typography

**Body Font:** Noto Sans SC Variable，回退到 Noto Sans SC、苹方、微软雅黑和系统无衬线。

**Editorial Font:** Noto Serif SC Variable，回退到 Noto Serif SC、宋体类字体与 serif；现有年册、引语和部分编辑内容保留此字体。家庭首页、记忆卡标题和详情正文使用无衬线。

**Code Font:** Consolas，回退 monospace；仅用于陪伴对话中真实的行内代码和代码块，不用于普通回复、标签或装饰数字。

### Hierarchy
- **Headline:** 首页问候使用前置 headline 令牌；手机在 640px 断点改为 1.5rem。故事主标题使用响应式 1.5–2rem 与 1.45 行高。
- **Title:** 记忆卡标题使用前置 title 令牌，最多展示两行；栏目标题常用 1.05–1.18rem。
- **Body:** 基础正文使用前置 body 令牌；760px 以下基础正文变为 1.0625rem。故事详情正文为 1rem、2 倍行高并保留换行。
- **Label:** 字段标签使用前置 label 令牌；按钮使用 button 令牌。元数据存在 .7–.85rem 的局部尺寸，并不构成新增的全局字体档位。

陪伴对话使用局部 chat 角色，不替换全站正文层级：桌面 AI 回复使用 chat-body；用户气泡和输入文字也为 1rem，行高分别为 1.9 和 1.8。768px 以下回复与用户气泡为 .9rem，回复行高为 1.9；输入使用 `max(1rem,16px)`，兼顾手机输入和家庭大字号偏好。对话方式、表达风格与家庭记忆选项使用 chat-control，费用和 AI／合成声音说明使用 chat-note；这些角色在手机上保留 rem 缩放。代码使用 chat-code，相对正文缩放。历史摘要、工具说明等仍有局部微字号，不将每个值升级为全站字体档位。

**The Root Scale Rule.** 延续 rem 字号并保留现有根字号偏好机制；不要将家庭内容文字固定成不可缩放的像素尺寸。

## Layout

桌面框架使用固定侧栏（210px），工作区相应偏移；1181–1250px 区间侧栏缩至 190px。主内容容器上限为 1240px，水平内边距为 `clamp(24px, 3.4vw, 48px)`，1440px 起使用 48px。顶栏高度为 72px，保持可见。

复用 4/8/12/16/24/32/48px 间距节奏；具体内容网格也使用 18、20、28、30、36、42px 的局部组合。不要把局部组合误认为新增的全局间距令牌。

首页故事采用图文双栏（1.12:1），下方内容与辅助栏之间留出 36px，辅助栏为 280px。1180px 以下辅助栏收至 240px，900px 以下改为单栏，640px 以下故事图文与记忆列表均纵向排列。此首页比例是页面实现，不要求所有新页面复制。

1180px 以下侧栏替换为底部五列导航，预留安全区与内容底部空间。录入弹窗在桌面使用双列基础字段，640px 以下改为单列；手机隐藏装饰性预览，保留素材操作。录入区独立滚动，保存栏保持在弹窗底部。

陪伴对话为独立的操作型工作区（Operate）：桌面 1181px 起把应用侧栏收为 76px 图标栏，旁边是 236px 历史栏；消息列表和底部输入区居中，上限均为 800px。消息独立滚动，工作区填满可用视口，输入区留在下方。769–1100px 历史栏缩至 210px。768px 以下历史转为左侧抽屉，宽度为 `min(300px,85%)`；消息水平留白为 18px，输入区为 12px。1180px 以下沿用主应用底部导航并预留 64px 与安全区空间。这些尺寸仅约束陪伴对话，不改变其他页面框架。

## Elevation & Depth

常规内容卡通过浅底和细描边建立层次，不使用持续阴影。浮层阴影引用 globals.css 的 shadow-float：日间为 `0 14px 44px rgba(35,48,41,.16),0 2px 8px rgba(35,48,41,.08)`，夜间切换为更深的双层阴影。弹窗遮罩使用深绿透明底与轻模糊；顶栏和移动导航使用半透明背景与模糊。

陪伴对话的历史栏、消息和输入区保持平面。对话菜单与家庭记忆选项菜单复用 shadow-float，移动历史抽屉以透明遮罩阻隔背景；不另建聊天专属阴影或品牌色。

记忆卡悬停向上移动 2px 并加强描边，过渡为 .18s ease-out；减少动态效果偏好关闭移动与动画。通用按钮状态过渡为 .16s，字段为 .15s。

**The Floating Surface Rule.** 应用内容保持平面；阴影用于弹窗、通知和菜单等浮层。

## Shapes

控件使用 radius-sm，卡片和音频区使用 radius，首页主故事使用 feature，大弹窗使用 radius-lg；手机弹窗改为 feature。徽记使用 pill，头像使用圆形。容器使用 1px 细描边，图像随容器裁切；详情图保留完整画面，列表封面填充裁切。

陪伴对话用户气泡与输入容器复用 feature；代码块和浮层菜单复用 radius。历史行及工具按钮使用 8px 局部圆角，菜单行与来源按钮为 7px，行内代码为 4px；这些是聊天组件内部细节，不扩大全站圆角 ramp。发送／停止按钮为圆形。

## Components

### Buttons

文字与线性 SVG 图标组合，默认最小高度为 44px，水平内边距见前置令牌。主按钮用深松绿，次按钮用暖白底与较强描边，弱操作用透明底。悬停分别加深主色、换叶绿底或提高文字对比。忙碌时使用旋转指示并禁用；禁用态透明度为 .45。键盘焦点使用 2.5px brand 轮廓和 2px 外偏移。录入素材按钮在手机增至 48px 高。

### Chips

徽记使用胶囊形和成对浅底深字。状态徽记直接写出“待确认”等含义，不仅依靠色相。

### Cards / Containers

记忆卡由可点击封面、年代标记、主题与状态、两行标题、地点和家人信息组成。纸面底配普通描边，内文区使用 `14px 16px 13px` 内边距；收藏拥有独立按钮。没有图片时使用叶绿占位与 SVG 图标。虚构示例保留明确标记。

### Inputs / Fields

字段采用纸面底、较强描边和控件圆角，最小高度为 44px；标签在上，说明在下。输入获得焦点时边框转 brand，并出现 3px、16% 品牌色的柔和环。文本域允许纵向调整，使用 1.8 行高。素材选择由可聚焦按钮触发隐藏文件输入。

### Navigation

侧栏条目使用文字与 SVG 图标，最小高度为 44px。当前页为浅品牌色底、品牌色文字和 600 字重；悬停使用画布底。移动导航保留当前页文字与色块。页面内专辑切换使用底部描边，不添加阴影。

### Story Player

叶绿承托的播放器把声音来源放在标题下。家人原声使用浏览器音频控件；没有原声时显示明确标注的设备朗读和开始/停止按钮。手机中播放按钮独占一行。来源、费用及错误文字紧邻对应动作。

### Record Dialog

先呈现素材与故事，再呈现名称与人物；时间、地点、分类收进可展开区。发布选择有独立浅底区，底部保留草稿状态和保存动作。弹窗将焦点带入、限制键盘循环、支持 Escape 关闭，并在关闭后归还焦点。

### Chat Workspace

历史栏用画布底、细分隔线和浅叶绿选中行承托搜索与会话列表。桌面可折叠；手机打开时作为具名模态对话框，将焦点带入抽屉，Tab／Shift + Tab 在其中循环，主对话区、顶栏和底部导航设为 inert；Escape、遮罩或关闭按钮关闭后归还焦点。

用户消息右对齐，以浅底气泡保留换行；AI 回复采用没有气泡背景的段落式 Markdown，支持标题、列表、引用、表格和可复制代码。段落间距为 16px，表格和代码块在自身范围内横向滚动。每条回复下方提供复制、朗读、版本与反馈等弱工具，家庭来源紧邻该条回复，引用使用品牌色。键盘工具焦点为 2px brand 轮廓、3px 外偏移；选中反馈使用 leaf 与 brand。

底部多行输入容器用较强描边，获得焦点时转为 brand；选项可换行，发送按钮保持独立。发送为 brand／on-brand，悬停为 brand-strong，禁用为 surface-2／muted；生成时同一位置切换为停止按钮。手机发送、选项及抽屉关闭触点至少 44px。费用和失败／停止退回说明放在输入区下，AI 真实性与设备合成声音说明持续可见。空状态提供三条话题建议，只填入输入框，保留用户确认发送的动作。

此记录对应 2026-10-25 陪伴工作区实现及桌面空态／会话、390px 手机／历史抽屉、820px 平板和手机大字号截图。独立完成评审的字号与抽屉焦点问题已修复，结论为可交付；不据此推断所有历史页面或主题状态均已复核。

## Do's and Don'ts

### Do:
- **Do** 复用现有语义 CSS 属性和主题配对。
- **Do** 使用 rem 文字、明确按钮文字和可见键盘焦点。
- **Do** 保留原声、设备朗读、AI 整理和虚构示例的来源说明。
- **Do** 用留白、细描边和浅色面区分内容层次。

### Don't:
- **Don't** 将日间固定颜色写入需要响应夜间主题的组件。
- **Don't** 给普通记忆卡增加持续浮层阴影。
- **Don't** 把页面局部字号、网格比例和间距升级为所有页面的强制规则。

未规范化的既有漂移：globals.css 仍含旧页面的 eyebrow/kicker、较小元数据字号与局部装饰；这些不作为新增界面的样式准则，本次文档工作不修改应用源码。夜间、高对比度和全部历史页面未在本次静态截图中逐一验证。
