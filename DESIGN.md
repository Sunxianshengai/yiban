---
name: 忆伴 · Familia
description: Familia App 的柔和彩色陪伴界面，承载真实家庭记忆与明确标识的 AI 家人。
colors:
  canvas: "#F4E9E2"
  surface: "#FFFDFB"
  surface-2: "#F2EFEC"
  ink: "#2B241B"
  ink-2: "#493B30"
  muted: "#6F6258"
  faint: "#817269"
  brand: "#3C1008"
  brand-strong: "#582119"
  brand-soft: "#F4E3DA"
  leaf: "#F2E4DB"
  leaf-deep: "#EAD0C2"
  border: "#DFD5CD"
  border-strong: "#C9B8AC"
  on-brand: "#FFFDF9"
  terracotta: "#E7834B"
  fa-sage: "#93AF5B"
  fa-sage-ink: "#33451F"
  error: "#A23F32"
  error-soft: "#F6E7E3"
  warn: "#715E38"
  warn-soft: "#F5EFDC"
typography:
  headline:
    fontFamily: "Urbanist, Noto Sans SC Variable, PingFang SC, Microsoft YaHei, sans-serif"
    fontSize: "clamp(1.5rem,3vw,2.1rem)"
    fontWeight: 750
    lineHeight: 1.5
    letterSpacing: "-.025em"
  title:
    fontFamily: "Urbanist, Noto Sans SC Variable, PingFang SC, Microsoft YaHei, sans-serif"
    fontSize: "1.72rem"
    fontWeight: 750
    lineHeight: 1.5
    letterSpacing: "-.025em"
  body:
    fontFamily: "Urbanist, Noto Sans SC Variable, PingFang SC, Microsoft YaHei, sans-serif"
    fontSize: "1rem"
    lineHeight: 1.8
  label:
    fontFamily: "Urbanist, Noto Sans SC Variable, PingFang SC, Microsoft YaHei, sans-serif"
    fontSize: ".75rem"
    lineHeight: 1.6
  wordmark:
    fontFamily: "Noto Serif SC Variable, serif"
    fontSize: "2rem"
    fontWeight: 750
    letterSpacing: ".04em"
rounded:
  button: "32px"
  choice: "40px"
  contact: "48px"
  panel: "24px"
  modal: "28px"
  field: "24px"
  circle: "50%"
  legacy-card: "12px"
spacing:
  small: "8px"
  choice-gap: "12px"
  row-gap: "14px"
  regular: "16px"
  roomy: "24px"
components:
  button-primary:
    backgroundColor: "{colors.brand}"
    textColor: "{colors.on-brand}"
    rounded: "{rounded.button}"
  button-primary-hover:
    backgroundColor: "{colors.brand-strong}"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.button}"
  choice:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.choice}"
    padding: "12px 18px"
  contact-action:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.contact}"
    padding: "14px 18px"
  user-message:
    backgroundColor: "{colors.fa-sage}"
    textColor: "{colors.fa-sage-ink}"
    rounded: "30px 30px 4px 30px"
    padding: "15px 20px"
  assistant-message:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "30px 30px 30px 4px"
    padding: "18px 20px 12px 64px"
  field:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.field}"
  nav-active:
    backgroundColor: "{colors.brand-soft}"
    textColor: "{colors.brand}"
---

# Design System: 忆伴 · Familia

## Overview

**Creative North Star: "Familia App 的亲近陪伴"**

用户已确认用真实 Familia App 复现方向替换原有松绿体系。珊瑚、桃色和淡紫背景承托白色长圆选项、圆形头像与深棕主操作；视觉选择以实际实现为准，不另造概念。依据为 app/familia.css 对基础样式的覆盖及 components/Familia.jsx、components/Chat.jsx。批准稿 public/design-preview/familia-app-replica/index.html 与 .tmp-familia/review/replica-board.jpg 是视觉参照，不是生产用户素材库。

家庭影像与原声保留真实来源，AI 家人始终标明为个人陪伴设定。头像来自有权使用的图片，缺省为姓名首字或 Lucide 人物图标。新流程进入实际家庭记忆、历史会话和积分机制，保留原有权限与设置。

**Key Characteristics:**

- 柔和彩色渐变、白色胶囊和深棕操作。
- 自托管 Urbanist 配合中文 Noto 无衬线；忆伴字标保留 Noto 中文衬线。
- 绿色用户气泡与白色助手气泡，身份及来源清楚。
- 留白、真实状态和可见焦点优先。

## Colors

### Primary

深棕 brand 用于主操作、选中标记和发送，brand-strong 为悬停，搭配 on-brand。terracotta 是暖橘辅助强调。

### Secondary

三个实际 CSS 渐变分别承担首页与创建（fa-warm）、联系人（fa-coral）和聊天（fa-chat）；完整渐变及夜间覆盖保存在 sidecar。用户气泡配对 fa-sage 与 fa-sage-ink。

### Neutral

surface 承载白色选项、面板和助手气泡；surface-2 用于输入和工具底色。ink / ink-2 为正文，muted 为辅助说明，border / border-strong 为边界。leaf 已变为暖桃中性色，不再代表旧松绿身份。错误与警示保持已有语义配对。

**The Semantic Pair Rule.** 联系人姓名及说明继承 ink；绿色用户气泡使用 fa-sage-ink。不要把浅色文字重新放在这些正文位置。夜间使用暗紫棕画布、浅桃操作与更深的背景渐变；高对比将辅助文字及边界提升至正文色。新组件复用现有语义属性。

## Typography

**Display / Body Font:** 自托管 Urbanist，中文回退至自托管 Noto Sans SC Variable，再到 PingFang SC、Microsoft YaHei、sans-serif。

**Wordmark Font:** Noto Serif SC Variable，serif 回退。既有记忆引文、长篇故事可继续使用其衬线样式。

### Hierarchy

- **Headline:** 首页问候采用 frontmatter 响应字号，手机为（1.55rem）。
- **Title:** 创建问题采用 frontmatter title，手机（1.65rem），窄至（370px）为（1.5rem）；联系人姓名（2.2rem / 1.5），手机（2rem）。
- **Body:** 对话（1rem / 1.8），开场说明（.95rem / 1.8）。
- **Label:** 操作说明（.75rem / 1.6），AI 标签（.75rem / 1.7）。

**The Root Scale Rule.** 延续根字号偏好和 rem 正文。手机聊天输入保留 max(1rem,16px)。页面局部字号不升级为全站固定标题规则。

## Layout

首页最大宽度（820px），联系人列表（600px）。桌面（1181px）起使用（88px）图标侧栏；（1180px）以下使用含安全区的（68px）底部导航。联系人与聊天专注页面隐藏顶栏、页脚和底部导航。

联系人桌面最大宽度（560px），（1180px）以下、（760px）以上为（600px），手机取消最大宽度。操作组最大宽度（430px）、间距（14px）；大头像（174px），首屏依次呈现头像姓名、AI 标识和聊天/语音/视频三个白色长圆入口。

创建对话框宽 min(480px,calc(100vw - 36px))、最大高（94dvh）；（760px）以下成为完整视口页面。继续按钮在流程下沿，包含安全区。年龄轮支持键盘、滚轮、触屏。

聊天占满（100dvh），消息、快捷回复和输入容器最大宽度（850px）。白色头部高（88px），手机（82px）；白色输入容器承托灰白输入框与（48px）发送。历史和设置由明确控件打开。

Familia 层断点为（1180px）、（760px）、（370px）。基础样式仍有（1440px）、（1250px）、（900px）、（640px）用于原有页面，不将局部旧布局强制用于新流程。

## Elevation & Depth

层次主要来自渐变、白色面与留白；主按钮和聊天气泡无持续阴影。头像投影（0 7px 20px #56301D0D）极轻。描述框紫桃柔光（0 -5px 20px #B46DD64D,0 7px 18px #C7956A26）仅用于该创建步骤。浮层继续使用既有 shadow-float，完整值在 sidecar。

**The Reduced Motion Rule.** 减少动态设置下，Familia、创建和心情页面关闭动画、过渡与平滑滚动。普通按钮（.16s）和字段焦点（.15s）保留已有状态反馈，不新增通用入场动效。

## Shapes

按钮（32px）、创建选项（40px）、联系人操作（48px）、面板（24px）、对话框（28px）形成柔和长圆语言。头像与工具为圆形。聊天头部下角（32px），输入容器上角（32px，手机 30px）；气泡尾角（4px）靠说话者一侧。原有记忆卡保留（12px）圆角，不机械变为胶囊。

## Components

### Buttons

主按钮深棕浅字，最小高（48px），字重（650）；创建继续为（56px）。次按钮白底深字。禁用保留真实不可用状态。Familia 焦点为（3px solid #8360B1）及（3px）偏移，聊天输入为（2px）及（2px）偏移。

### Chips

特质选择为白色半透明胶囊，选中淡紫底深紫字，使用 aria-pressed。家庭记忆筛选为白色默认、深棕选中。状态标签保留明确文字。

### Cards / Containers

首页家人行白底长圆，最小高（88px）、内边距（16px 22px）；手机（82px）及（14px 18px）。设置、积分和面板使用近白面。普通卡片不继承描述框柔光。

### Inputs / Fields

保留可见标签及提示。创建输入近白底细边界；语音设置字段最小高（48px）、圆角（26px）、内边距（12px 16px）。聊天输入高（50px）、最大高（180px），左侧为工具预留空间。语音识别文字先编辑确认，再发送。

### Navigation

桌面图标侧栏与手机底部导航使用 Lucide，活动项浅桃底深棕字。保留首页、家庭记忆、陪伴、家庭，其他功能通过更多入口。图标按钮有明确的可访问名称。

### Contact and conversation

聊天、语音、视频分别配橙、紫、黄圆图标。语音是浏览器识别和设备合成朗读；视频打开已保存家庭影像。保留 AI 身份及能力说明。用户绿色气泡、助手白色气泡保留头像、引用、回复操作、历史、积分及失败状态。

个人心情为本人自报的按日记录，缺失日期留空，仅本人可见。图表不能暗示诊断或编造数据。

## Do's and Don'ts

### Do:

- **Do** 从实际 Familia 实现延续渐变、胶囊、圆头像与棕色操作。
- **Do** 保留夜间、高对比、字号和减少动态偏好。
- **Do** 保留真实内容来源、AI 身份及操作前积分说明。
- **Do** 使用 Lucide 与可访问名称，头像使用获权图片或有意义的首字。

### Don't:

- **Don't** 把批准稿人物图或截图当生产用户资料。
- **Don't** 把 AI 家人当真实家庭成员，或将影像回看标成实时视频通话。
- **Don't** 用浅色文字破坏联系人正文与用户气泡的颜色配对。
- **Don't** 将年龄轮、心情弧线或描述柔光推广到所有页面。
