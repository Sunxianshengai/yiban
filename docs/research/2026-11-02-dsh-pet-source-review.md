# dsh-pet 一手源码核查

核查日期：2026-11-02。用途：为忆伴引入网页内宠物与 Windows 桌宠提供技术证据。本文区分仓库事实与集成建议；未安装插件、运行外部脚本或修改忆伴业务代码。

## 1. 核查基线

- 仓库：[PC2005-cloud/dsh-pet](https://github.com/PC2005-cloud/dsh-pet)。2026-11-02 核查时 `main` 指向 `58a69ba6d0427e6dd4141bee419414020070cea2`，提交时间为北京时间 2026-11-02 15:14:12，内容是独立模式选择服务商与查询余额。[提交](https://github.com/PC2005-cloud/dsh-pet/commit/58a69ba6d0427e6dd4141bee419414020070cea2)
- 最新 GitHub Release 为 `v0.4.0`，发布时间为北京时间 2026-11-01 19:09:12；tag 指向 `166b52baf9aa41eec9f7d5ead114f274175c1338`。当前源码包的 `version` 仍为 `0.4.0`，因此包版本号不足以区分 main 上尚未发版的更新。[Release](https://github.com/PC2005-cloud/dsh-pet/releases/tag/v0.4.0)、[包清单](https://github.com/PC2005-cloud/dsh-pet/blob/58a69ba6d0427e6dd4141bee419414020070cea2/dsh-pet/package.json)

下文源码链接固定到该 main 提交，便于后续复查；不声称已在忆伴中验证运行效果。

## 2. 许可：代码与素材必须分开

根目录 `LICENSE` 为 MIT，要求在软件副本或重要部分中保留版权与许可文本。根 README 则另列素材与形象条件：动画、提示词和源视频禁止商用；衍生、改版、换皮作品要求在公开渠道附原作者仓库链接；内置鲸鱼娘是社区二创形象，并非 DeepSeek 官方形象，README 标注形象采用 CC BY-NC-SA 4.0，同时给出原设计者和声明出处。[代码许可](https://github.com/PC2005-cloud/dsh-pet/blob/58a69ba6d0427e6dd4141bee419414020070cea2/LICENSE)、[README 许可段](https://github.com/PC2005-cloud/dsh-pet/blob/58a69ba6d0427e6dd4141bee419414020070cea2/README.md#许可)

**对忆伴的建议：**可以评估抽取 MIT 代码并保留出处和许可；正式产品优先使用原创或单独获得明确授权的角色、动画和声音，建立每套素材的作者、来源、许可和授权凭据清单。不要把 `package.json` 中的 MIT 标签当作所有内置形象与素材的统一授权。比赛展示或开源发布能否覆盖具体素材用法，仍需对照各素材权利条件；不能把“用于比赛”直接视为全部授权已满足。

## 3. 架构与运行形态

| 层 | 源码事实 | 可供忆伴参考之处 |
| --- | --- | --- |
| Host | Cordis 插件入口装配配置、HTTP 路由、会话监听、聊天、余额、通知、待办和 Desktop Helper；注入 `webServer`、`agentDefaultModel`、`credentials`、`llm`、`commands`、`connection`。 | 学习装配边界；忆伴使用自己的认证、模型、积分和持久化。 |
| Web client | 工厂模块注入 DSH slots、locale、connection、remote、commandUi，把宠物挂入 `shell.overlay`，设置挂入 `settings.section`。 | 参考 overlay 与设置入口；不能把 DSH 插件入口原样当 Next.js React 组件使用。 |
| Shared | 浏览器 bundle 与桌面 `shared-core.js` 共用逻辑；包含物理、动作选择、屏幕几何，也包含菜单、聊天等 DOM 渲染，整个 shared 目录并非都属于无副作用纯函数。 | 优先逐个评估物理、动作选择、几何与状态判据。 |
| Desktop | 每只桌宠一个局部透明置顶窗口，另有托盘、IPC、显示器更新、鼠标穿透、焦点、DPI 和宿主存活处理。 | 参考局部窗口与输入命中，接入忆伴现有 Electron 主进程。 |
| Standalone | CLI 创建本机 HTTP 服务与伪 Cordis ctx，再复用 Host 装配；当前 main 可创建独立 AI provider。 | 证明核心可以脱离 DSH，但照搬会带入额外配置、聊天、服务进程与模型调用链。 |

证据：[Host 入口](https://github.com/PC2005-cloud/dsh-pet/blob/58a69ba6d0427e6dd4141bee419414020070cea2/dsh-pet/src/host/index.ts)、[Web 注入](https://github.com/PC2005-cloud/dsh-pet/blob/58a69ba6d0427e6dd4141bee419414020070cea2/dsh-pet/src/client/app.ts#L69)、[overlay 挂载](https://github.com/PC2005-cloud/dsh-pet/blob/58a69ba6d0427e6dd4141bee419414020070cea2/dsh-pet/src/client/app.ts#L172)、[Shared 出口](https://github.com/PC2005-cloud/dsh-pet/blob/58a69ba6d0427e6dd4141bee419414020070cea2/dsh-pet/src/shared/index.ts)、[Desktop 主进程](https://github.com/PC2005-cloud/dsh-pet/blob/58a69ba6d0427e6dd4141bee419414020070cea2/dsh-pet/runtime/electron-helper/main.js)、[Standalone CLI](https://github.com/PC2005-cloud/dsh-pet/blob/58a69ba6d0427e6dd4141bee419414020070cea2/dsh-pet/src/standalone/cli.ts#L47)。

包清单声明 React / React DOM peer 为 `^18.2.0`，且依赖多项 DSH 专用 peer 服务；当前忆伴使用 React 19。**集成判断：不应直接 `npm install dsh-pet` 后把它视为通用 React 桌宠库。**更合适的是保留上游版本来源，抽取少量算法，建立忆伴自己的渲染器、事件适配与 Electron 桥接。[上游依赖声明](https://github.com/PC2005-cloud/dsh-pet/blob/58a69ba6d0427e6dd4141bee419414020070cea2/dsh-pet/package.json)

## 4. 事件联动已实现到什么程度

上游监听 DSH 的 `session/event`，将事件折叠为 `thinking / working / result / waiting / success / error`。例如 `turn/start` 进入 thinking，普通 `tool/call` 进入 working，问用户问题的工具调用与 `approval/asked` 进入 waiting；`tool/result` 进入 result。`turn/end` 根据结束原因区分成功、出错、等待，取消则清理状态；目标自动续跑时，中间轮不触发最终成功庆祝。[监听装配](https://github.com/PC2005-cloud/dsh-pet/blob/58a69ba6d0427e6dd4141bee419414020070cea2/dsh-pet/src/host/plugin/session-watch.ts#L155)、[状态归约](https://github.com/PC2005-cloud/dsh-pet/blob/58a69ba6d0427e6dd4141bee419414020070cea2/dsh-pet/src/host/work-status.ts#L15)、[结束判据](https://github.com/PC2005-cloud/dsh-pet/blob/58a69ba6d0427e6dd4141bee419414020070cea2/dsh-pet/src/host/work-status.ts#L61)

它还按会话聚合状态，展示优先级为 waiting、error、working、thinking、result、success，同档取最近更新。说明“事件驱动动画”已有具体实现可参考，而不是只能靠定时随机动作；不过这些 DSH 事件名和任务语义需要映射到忆伴实际聊天生命周期。[聚合规则](https://github.com/PC2005-cloud/dsh-pet/blob/58a69ba6d0427e6dd4141bee419414020070cea2/dsh-pet/src/host/work-status.ts#L147)

对外 HTTP 功能涵盖状态读取、指定文本气泡、动画、位置、睡觉、外部工作状态、第三方菜单、播放回执；还有占用锁，用户拖动或隐藏等操作可以撤销外部控制。状态接口使用版本计数与最长 10 秒的长轮询；同页 DSH 插件则可以通过 Cordis 客户端服务访问，不必经过网络。[HTTP 接口目录](https://github.com/PC2005-cloud/dsh-pet/blob/58a69ba6d0427e6dd4141bee419414020070cea2/API.md)、[Cordis 服务契约](https://github.com/PC2005-cloud/dsh-pet/blob/58a69ba6d0427e6dd4141bee419414020070cea2/CORDIS.md)

**集成建议：**借鉴归约器、优先级、取消清理、用户操作优先和最终完成判据。忆伴网页内部使用自身状态订阅；Electron 跨窗口使用受限 IPC。没有必要为了内部动画再运行一份桌宠 HTTP 服务器，或给每个动作请求模型。

## 5. 素材与动画链

内置主资源是 640×360 的透明 VP9-alpha WebM，GIF 用于 README 预览。源码对 macOS/iOS WebKit 请求 HEVC-alpha MOV，因为“可以播放 WebM”并不等于正确支持 WebM alpha；Chromium、Electron 和 Firefox 使用 WebM。MOV 兼容资源不随默认 npm 包一起发布。[README 平台与素材说明](https://github.com/PC2005-cloud/dsh-pet/blob/58a69ba6d0427e6dd4141bee419414020070cea2/README.md#L81)、[容器选择源码](https://github.com/PC2005-cloud/dsh-pet/blob/58a69ba6d0427e6dd4141bee419414020070cea2/dsh-pet/src/client/pet/animation/media.ts)、[发布文件清单](https://github.com/PC2005-cloud/dsh-pet/blob/58a69ba6d0427e6dd4141bee419414020070cea2/dsh-pet/package.json)

浏览器动画模块处理前后两个播放器的切换，等待新素材就绪后交换前台播放器，并与事件动作、动作结束回执关联。物理入口导出弹簧、速度估计、抛掷、挤压和碰撞等函数；动作选择与移动几何有独立模块。[动画切换](https://github.com/PC2005-cloud/dsh-pet/blob/58a69ba6d0427e6dd4141bee419414020070cea2/dsh-pet/src/client/pet/animation/animation.ts#L98)、[物理出口](https://github.com/PC2005-cloud/dsh-pet/blob/58a69ba6d0427e6dd4141bee419414020070cea2/dsh-pet/src/shared/physics.ts)、[动作选择](https://github.com/PC2005-cloud/dsh-pet/blob/58a69ba6d0427e6dd4141bee419414020070cea2/dsh-pet/src/shared/pickers.ts)、[移动几何](https://github.com/PC2005-cloud/dsh-pet/blob/58a69ba6d0427e6dd4141bee419414020070cea2/dsh-pet/src/shared/motion.ts)

Pet pack 是配置和素材目录的组合，一种角色可以拥有多个实例，各种类有独立动画池；当前体系以视频动画为核心，不能把它直接描述成已经兼容任意精灵图、Live2D 或 Spine 的统一运行时。[Pet pack 配置](https://github.com/PC2005-cloud/dsh-pet/blob/58a69ba6d0427e6dd4141bee419414020070cea2/CONFIG.md#L56)

**集成建议：**忆伴第一版选择一种可控格式，优先实现统一动作名、锚点、尺寸、循环与缺失动作降级，再考虑新增渲染后端。若采用透明 WebM，需对 Windows Electron、移动浏览器和 Safari 分别制定验收，不能以文件后缀或 `canPlayType` 一项替代实测。

## 6. 桌面壳中值得关注的真实问题

透明不等于点击穿透。上游通过 `setIgnoreMouseEvents(ignore, { forward: true })` 控制，并专门处理菜单、输入区和焦点。窗口设置包含透明、无边框、置顶、隐藏任务栏、`contextIsolation: true`、`nodeIntegration: false`；同时设置 `sandbox: false`。主进程还有 Windows 透明窗视频合成、DPI、混合缩放屏幕、置顶与任务栏恢复的适配。[窗口与穿透](https://github.com/PC2005-cloud/dsh-pet/blob/58a69ba6d0427e6dd4141bee419414020070cea2/dsh-pet/runtime/electron-helper/main/windows.js#L83)、[窗口参数](https://github.com/PC2005-cloud/dsh-pet/blob/58a69ba6d0427e6dd4141bee419414020070cea2/dsh-pet/runtime/electron-helper/main/windows.js#L191)、[主进程平台处理](https://github.com/PC2005-cloud/dsh-pet/blob/58a69ba6d0427e6dd4141bee419414020070cea2/dsh-pet/runtime/electron-helper/main.js)

这些是兼容性经验，不是忆伴必须全盘复制的安全配置。尤其上游还包含截屏、打开外部站点等 IPC 能力；忆伴应根据实际产品范围收窄 API。对于现有 Electron 壳，优先做本地宠物窗口、白名单消息类型、发送方检查与受限 preload；主聊天窗口继续复用现有在线服务。[上游 preload 能力表](https://github.com/PC2005-cloud/dsh-pet/blob/58a69ba6d0427e6dd4141bee419414020070cea2/dsh-pet/runtime/electron-helper/preload.js)

## 7. 文档与 main 源码有滞后差异

`API.md` 写着本机接口无鉴权、独立模式的 chat/whisper 缺少 provider。当前 main 的独立模式已具备 AI 配置、provider 装配；`request-security.ts` 也已经实现随机能力令牌、回环 Host 校验和跨站请求检查。写操作与部分敏感读操作要求请求头令牌。因此不能用旧 API 说明概括当前 main 的全部行为，也不能把 standalone 的安全门面推断为每一种 DSH 宿主接入都采用相同规则。[旧 API 说明](https://github.com/PC2005-cloud/dsh-pet/blob/58a69ba6d0427e6dd4141bee419414020070cea2/API.md)、[当前独立 AI 装配](https://github.com/PC2005-cloud/dsh-pet/blob/58a69ba6d0427e6dd4141bee419414020070cea2/dsh-pet/src/standalone/cli.ts#L47)、[当前安全门面](https://github.com/PC2005-cloud/dsh-pet/blob/58a69ba6d0427e6dd4141bee419414020070cea2/dsh-pet/src/standalone/request-security.ts)、[当前 AI 配置](https://github.com/PC2005-cloud/dsh-pet/blob/58a69ba6d0427e6dd4141bee419414020070cea2/dsh-pet/src/standalone/ai-config.ts)

## 8. 建议采用的参考边界

1. **可优先参考或有选择移植：**物理算法、动作权重选择、动画双播放器切换、脚底与几何锚点、状态优先级、取消与回收、低干扰输入命中。
2. **用忆伴实现替代：**DSH 插件安装与 Cordis ctx、模型凭证、余额服务、独立聊天历史、用户配置目录、独立托盘进程、宿主协议。
3. **单独准备：**原创角色与动作素材、包格式与校验、按当前账号保存的桌宠设置、跨窗口与重启恢复、产品内通知和勿扰规则。
4. **后续再评估：**多宠碰撞、任意第三方 API、桌面截图理解、Live2D/Spine、AI 自动生成宠物素材；这些并不是让忆伴桌宠第一版成立的前置条件。

以上是基于静态源码审阅的集成建议；尚未做上游可执行程序安装、素材性能基准或忆伴 Windows 原生窗口实测。
