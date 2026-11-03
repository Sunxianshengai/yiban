# dsh-pet 桌宠方案补查

日期：2026-11-02（北京时间）。本次仅静态核查一手源码，没有安装、启动或修改上游，也没有修改忆伴业务代码。原研究与原方案保持原样；以下补充可直接用于四个形象的方案调整。

## 版本变化

GitHub `commits/main` 本次返回 `c0f93c6a082360bf1e8fe0f9ef4de451d5f93241`，它是原笔记基线 `58a69ba6d0427e6dd4141bee419414020070cea2` 的直接后继。新增能力为点击工作气泡跳转原会话，并将桌面工作气泡加入鼠标输入命中判据，避免被整窗穿透吞掉。旧笔记基线仍适合讨论动作与物理；它不再代表本次检查时的 main。[新增提交](https://github.com/PC2005-cloud/dsh-pet/commit/c0f93c6a082360bf1e8fe0f9ef4de451d5f93241)

**忆伴建议：**气泡携带原 `threadId` / `messageId`，点击后打开原会话；在 Electron 主进程显式激活已有窗口，避免每次打开新窗口。此项是集成建议，尚未实现。

## 已核实的动作组织

- 动画不是一个大随机池：结构分别为 idle、turn、drag、clicks、moves、categories、events、sleep。events 仅由明确事件触发，不混入随机动作；categories 可标记 noMirror，避免含文字等动作被左右镜像。[类型定义](https://github.com/PC2005-cloud/dsh-pet/blob/58a69ba6d0427e6dd4141bee419414020070cea2/dsh-pet/src/shared/types.ts)
- 自播按 idle / turn / move 的权重分配，剩余概率进入分类动作池；候选尽量避免连续重复。fixed 只从随机链移除转向和移动，点击、拖动和事件动作仍可用。工作状态长时间不变时，可在同档候选中轮换。[选择逻辑](https://github.com/PC2005-cloud/dsh-pet/blob/58a69ba6d0427e6dd4141bee419414020070cea2/dsh-pet/src/shared/pickers.ts)
- 下一动画决策区分“走位成功”“走位占用中”“无法移动”：占用中不重复切视频，无法移动回到原地动作。[下一动作决策](https://github.com/PC2005-cloud/dsh-pet/blob/58a69ba6d0427e6dd4141bee419414020070cea2/dsh-pet/src/client/pet/animation/next-animation.ts)
- 睡眠为入睡 start → 持续 loop → 醒来 end 三段。同一套三段配对；重复应用睡眠快照不重播入睡；入睡过渡被叫醒则取消入睡，不播放完整醒来；醒来结束才回随机链。[睡眠状态机](https://github.com/PC2005-cloud/dsh-pet/blob/58a69ba6d0427e6dd4141bee419414020070cea2/dsh-pet/src/client/pet/card/sleep-machine.ts)
- 松手初速来自近期指针轨迹，轨迹过旧、采样不足、低于死区等会返回 null，代表轻放；快速甩动才进入抛掷。其他模块负责弹簧、挤压、落地与碰撞。[松手估速](https://github.com/PC2005-cloud/dsh-pet/blob/58a69ba6d0427e6dd4141bee419414020070cea2/dsh-pet/src/shared/physics/release.ts)、[物理出口](https://github.com/PC2005-cloud/dsh-pet/blob/58a69ba6d0427e6dd4141bee419414020070cea2/dsh-pet/src/shared/physics.ts)

**忆伴建议：**四个形象共用这些动作语义与状态调度，分别提供画面素材。先制作一只的完整样例，校准脚底、透明边缘、动作衔接和拖动，再按同一规范完成另外三只。是否加入甩抛应由用户决定，技术上可独立开启，无须一开始完成多宠碰撞。

## 状态与提示的差别

工作档位为 thinking / working / result / waiting / success / error，归约器不请求模型；取消等非终态成功原因会清理状态，目标续跑中间轮不会提前庆祝。[工作状态归约](https://github.com/PC2005-cloud/dsh-pet/blob/58a69ba6d0427e6dd4141bee419414020070cea2/dsh-pet/src/host/work-status.ts)

气泡独立调度，同一时刻只显示一个：用户打开的待办面板最高，其后是终态任务、说话、余额、持续工作状态。说明上游并非让动画、通知、面板都竞争同一枚简单状态值。[气泡选择](https://github.com/PC2005-cloud/dsh-pet/blob/58a69ba6d0427e6dd4141bee419414020070cea2/dsh-pet/src/client/pet/card/bubble-slots.ts)

上游通知映射明确区分完成、失败、截断、权限申请、问题；取消和中断不会弹完成通知。该模块说明通知由浏览器侧消费，桌面宠物本体不重复实现同一通知链，不能据此宣称上游桌面 Helper 已有独立完整原生通知服务。[通知映射](https://github.com/PC2005-cloud/dsh-pet/blob/58a69ba6d0427e6dd4141bee419414020070cea2/dsh-pet/src/shared/notify.ts)

**忆伴建议：**业务状态、短交互、气泡、未读角标分开管理。聊天请求进入思考，真实文本输出进入回应，音频实际播放才表演说话，最终任务完成才庆祝。错误给简短可操作提示；未读只来自已保存消息。DPI、多屏、点击穿透与托盘生命周期沿用原研究要求，仍需本机验证。

## 不宜直接搬用的产品语义

上游配置包含周期碎碎念、梦话、独立宠物人设、聊天上下文与按余额分档演出；配置注释明确碎碎念会调用模型。忆伴已有伙伴设定、长期记忆、主动联系与积分，应复用这些业务链路，避免后台宠物动作自动产生额外聊天和消费。[配置事实](https://github.com/PC2005-cloud/dsh-pet/blob/58a69ba6d0427e6dd4141bee419414020070cea2/dsh-pet/assets/config.jsonc)

对忆伴更适合把“睡觉”设计为桌宠安静模式：保留消息接收和未读，不自动播音或随机气泡；用户主动发起聊天时可明确唤醒。该取舍是建议，与上游睡眠时拒绝聊天、余额等请求的规则不同。[上游功能说明](https://github.com/PC2005-cloud/dsh-pet/blob/58a69ba6d0427e6dd4141bee419414020070cea2/FEATURES.md)

## 四伙伴与批量动画工具补查

后续用户已确认：四形象是四个独立 AI 伙伴，各自人格与记忆；Windows 与网页都要；动作应向 dsh-pet 的丰富程度扩展，允许分批制作。下列建议据此调整，不把四形象当同一伙伴的换肤。

### 上游实际生产链

上游制作说明将源视频工具举例为可灵、Runway、豆包，并说明其素材实际使用豆包；每动作独立生成约十秒、固定镜头的纯色背景 MP4，再转透明视频。其项目实际全部采用 Premiere 手工抠像，自动 HSV 抠像是备选，不能把它表述为已验证的全自动高质量产线。睡眠另做三段并核对衔接。[制作说明](https://github.com/PC2005-cloud/dsh-pet/blob/c0f93c6a082360bf1e8fe0f9ef4de451d5f93241/MAKE-YOUR-OWN-PET.md)

可复用的脚本环节与输入输出：

| 工具 | 输入 | 输出与适配要点 |
| --- | --- | --- |
| `chroma_step02.py` | 固定帧率、尺寸的绿幕 MP4 | `step02/*.webm` 透明 VP9；HSV 参数与主体颜色须先测，现有路径、1280×720 和 24fps 是硬编码 |
| Premiere Ultra Key / 手工遮罩 | 绿幕 MP4 | 带 alpha 的 MOV，如 ProRes 4444；用于复杂毛发、白衣边缘和道具。调整边缘与溢色后再输出 |
| `pr_import_step02.py` | 上一步透明 MOV | `step02/*.webm`；可覆盖对应自动抠像结果，支持增量跳过 |
| `normalize_step03.py` | 透明 WebM | `step03` 透明母版，统一站立大小/脚底；现实现按首尾站立估比例，不适合直接处理睡眠 loop，须改为角色基准锚点 |
| `encode_thumbs.py` | 透明母版 | `step04` 的 640×360、24fps、无音轨 VP9-alpha WebM；旧文件顶部注释与实际常量不一致，应以代码为准 |
| `check_alpha.py` | 透明视频 | 现脚本只查单帧，且抽帧失败返回成功，不能原样作为正式批量验收；应改成多帧扫描、解码失败即失败 |

脚本事实：[HSV 抠像](https://github.com/PC2005-cloud/dsh-pet/blob/c0f93c6a082360bf1e8fe0f9ef4de451d5f93241/scripts/chroma_step02.py)、[MOV 导入](https://github.com/PC2005-cloud/dsh-pet/blob/c0f93c6a082360bf1e8fe0f9ef4de451d5f93241/scripts/pr_import_step02.py)、[归一化](https://github.com/PC2005-cloud/dsh-pet/blob/c0f93c6a082360bf1e8fe0f9ef4de451d5f93241/scripts/normalize_step03.py)、[转码](https://github.com/PC2005-cloud/dsh-pet/blob/c0f93c6a082360bf1e8fe0f9ef4de451d5f93241/scripts/encode_thumbs.py)、[透明检查](https://github.com/PC2005-cloud/dsh-pet/blob/c0f93c6a082360bf1e8fe0f9ef4de451d5f93241/scripts/check_alpha.py)。Adobe 的 Ultra Key 支持透明度、边缘清理与溢色抑制。[Adobe 参数文档](https://helpx.adobe.com/premiere/desktop/add-video-effects/effects-and-transitions-library/ultra-key-effect-parameters.html)

只借鉴制作流程不等于获准复制提示词或动作视频。上游 README 将动画、提示词、源视频列为非商用素材；忆伴应从四个自备形象编写自己的动作描述，复制确认为 MIT 的脚本时保留许可。[许可说明](https://github.com/PC2005-cloud/dsh-pet/blob/c0f93c6a082360bf1e8fe0f9ef4de451d5f93241/README.md#许可)

### 可以交给用户选择的现成生成入口

1. **豆包/可灵等已有账号界面**：用户提交角色基准图与独立动作卡，导出源 MP4；直接进入本地批处理。上游未公开能代表用户当前账号的套餐价格，因此不估算该渠道费用。
2. **火山方舟 Seedance 图生视频 API**：首帧/首尾帧入口支持图片与文字生成，首尾帧角色分别是 `first_frame` / `last_frame`，可传同一张图片；返回任务后查询视频结果。普通回归站姿动作可用同一标准站姿作首尾约束，睡眠则使用不同阶段姿态。模型可用性和参数随实际账号查询，不把首尾输入理解为逐像素衔接保证。[官方创建任务文档](https://docs.volcengine.com/docs/ark/create-video-generation-task-api?lang=zh)
3. **Runway 媒体生成 MCP 或其 Image-to-Video API**：需要区分两个官方入口。`https://mcp.runwayml.com` 是在聊天内生成媒体的 MCP；Runway Dev plugin/MCP 则用于 API 集成、账号模型和任务管理，官方明确其插件本身不直接生成媒体。可通过媒体工具或 API 输入角色图、动作文字、时长，输出任务与视频文件。[官方 MCP 区别](https://docs.dev.runwayml.com/guides/mcp/)、[Dev 插件说明](https://docs.dev.runwayml.com/guides/plugin/)、[API](https://docs.dev.runwayml.com/api/)

价格仅作可核验例子：本次 Runway 官方 API 价格页列 `gen4_turbo` 为每秒 5 credits、每 credit 0.01 美元，十秒即 0.50 美元；若四角色各 64 段、每段十秒且一次通过，纯视频生成算术为 128 美元，未含重试、参考图制作或税，且不是对该项目质量/总价/最低价的承诺。[官方价格](https://docs.dev.runwayml.com/guides/pricing/)

### 降低 agent token 而保留动作质量的建议

先建立四份角色基准、共用动作目录、每角色独立 `manifest`，用固定模板拼装批次任务。若目标是每角色 64 段，明确是 256 个真实视频交付；同一视频换别名不算新增动作。先试待机、行走、睡眠衔接、带道具四种难度，再按每角色 16 段分四批扩充；生产任务只携带角色 ID、动作 ID 和必要参数，不反复附全部历史讨论。

生成任务保存 provider taskId、输入哈希、状态、文件路径、人工验收结果。脚本直接轮询、下载、转码与输出总表，仅把失败摘要和低分辨率联系表送给 agent；通过项不重生，失败项局部重试。生成质量靠角色一致性、动作完整、脚底稳定、首尾衔接、透明边缘逐项验收，节省来自减少重复阅读与机械操作，而非省略动作或降低验收。

视频模型费用仍按提供商的秒数、分辨率或视频 token 规则计算；少用聊天 token 不会自动降低这笔费用。批量生产先限定任务数/单批预算，预览工具与最终生成是否分别收费按对应价格页判断。
