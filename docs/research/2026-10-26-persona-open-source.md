# AI 人设设置实际生效：开源依据与第 1 项实施建议

核查日期：2026-10-26。目标是让已保存的人设决定后续回复；保留 Familia 暖色界面、已有聊天与当前模型通道。本次不接 Kindroid API，不实现支付、长期记忆或完整角色卡导入。下文明确区分上游事实与本项目建议；没有复制上游实现代码。

## 1. 核查版本与许可

| 官方项目 | 核查版本 | 许可与使用边界 |
| --- | --- | --- |
| [SillyTavern/SillyTavern](https://github.com/SillyTavern/SillyTavern/tree/06bde939fb1e9c4c8d8641d810f0a916b5bce127) | 默认 release 分支，commit `06bde939fb1e9c4c8d8641d810f0a916b5bce127`，提交时间 2026-09-14T19:01:34Z；[package.json](https://github.com/SillyTavern/SillyTavern/blob/06bde939fb1e9c4c8d8641d810f0a916b5bce127/package.json) 标示 1.19.0 | [LICENSE](https://github.com/SillyTavern/SillyTavern/blob/06bde939fb1e9c4c8d8641d810f0a916b5bce127/LICENSE) 是 AGPL-3.0。借鉴字段分工，自行实现；本任务未引入其源代码或资源。 |
| [SillyTavern/SillyTavern-Docs](https://github.com/SillyTavern/SillyTavern-Docs/tree/ed5423d809c6b10b8c1e9ef4a0c8ddc7f2ef7f3d) | main，commit `ed5423d809c6b10b8c1e9ef4a0c8ddc7f2ef7f3d`，2026-10-02T22:04:31Z | GitHub API 标示 AGPL-3.0；文档仅用于理解行为，不复制示例角色文案。 |
| [malfoyslastname/character-card-spec-v2](https://github.com/malfoyslastname/character-card-spec-v2/tree/8083fb388615ccbce768e97cbbd49d2b3214632c) | main，commit `8083fb388615ccbce768e97cbbd49d2b3214632c`，2023-06-22T09:46:19Z；规范版本 2.0 | 核查该 commit 的根目录仅有四个 Markdown 文件，没有 LICENSE，GitHub API license 为 null。不能据“公开”推定可以复制规范正文或示例实现。这里只记录互操作概念；不宣称 Yiban 符合 V2。 |

版本信息来自官方 [ST commit API](https://api.github.com/repos/SillyTavern/SillyTavern/commits/06bde939fb1e9c4c8d8641d810f0a916b5bce127)、[文档 commit API](https://api.github.com/repos/SillyTavern/SillyTavern-Docs/commits/ed5423d809c6b10b8c1e9ef4a0c8ddc7f2ef7f3d)、[规范 commit API](https://api.github.com/repos/malfoyslastname/character-card-spec-v2/commits/8083fb388615ccbce768e97cbbd49d2b3214632c)。这是检查日默认分支快照，不声称覆盖所有开发分支。

## 2. 上游事实：字段的职责

V2 将 V1 字段放在 `data` 中；其基础语义仍由 V1 定义。V1 中 `description` 是身份背景，`personality` 是精简性格，`scenario` 是当前情境，三者建议逐次进入请求；`first_mes` 是初始问候，`mes_example` 是示例对话，示例可在真实历史占满上下文时被移除。[V1 字段定义](https://github.com/malfoyslastname/character-card-spec-v2/blob/8083fb388615ccbce768e97cbbd49d2b3214632c/spec_v1.md#fields)

V2 另设 `system_prompt` 与 `post_history_instructions` 覆盖前端相应提示。`creator_notes`、`creator`、`character_version` 不进入提示；标签通常也不进入。即角色数据与作者元数据有明确分工。Yiban 无需为了第 1 项引入这些覆盖能力。[V2 规范](https://github.com/malfoyslastname/character-card-spec-v2/blob/8083fb388615ccbce768e97cbbd49d2b3214632c/spec_v2.md#creator_notes)

官方角色设计文档把姓名、描述、性格、情境列为常驻内容；问候用于开始聊天，示例可以随上下文增长让位。文档认为问候会影响回复风格，但这属于提示设计经验，不能当作模型效果保证。[Character Design](https://github.com/SillyTavern/SillyTavern-Docs/blob/ed5423d809c6b10b8c1e9ef4a0c8ddc7f2ef7f3d/Usage/Characters/characterdesign.md#what-are-a-characters-permanent-tokens)

## 3. 实际源码：顺序、预算与当前配置

已阅读以下有界源码段：

- [`PromptManager.js` L1903–1952](https://github.com/SillyTavern/SillyTavern/blob/06bde939fb1e9c4c8d8641d810f0a916b5bce127/public/scripts/PromptManager.js#L1903)：默认逻辑顺序为 main → worldInfoBefore → personaDescription → charDescription → charPersonality → scenario → 可选增强与其他提示 → worldInfoAfter → dialogueExamples → chatHistory → post-history。此处 personaDescription 指用户人格，与角色定义不同；顺序可配置，并非字段拥有固定优先级。
- [`openai.js` L1120–1263、1283–1415](https://github.com/SillyTavern/SillyTavern/blob/06bde939fb1e9c4c8d8641d810f0a916b5bce127/public/scripts/openai.js#L1283)：描述、性格、情境分别形成 system 提示，再按管理器配置组装。默认先给真实历史分配预算，再放示例；启用 pin_examples 会反转预算分配顺序。最终排列顺序和预算分配顺序不能混为一谈。
- [`script.js` L3402–3493](https://github.com/SillyTavern/SillyTavern/blob/06bde939fb1e9c4c8d8641d810f0a916b5bce127/public/script.js#L3402)：字段解析器读取当前 `characters[currentChid]`，并考虑部分聊天级覆盖。该机制支持“当前定义用于生成”的设计推论；这不等于已完整审计上游编辑保存生命周期。

**适用于 Yiban 的推论：**每次发送时从最新已保存 persona 构造请求；不能只在建会话时快照一次。编辑影响下一条及其后生成的回复；已存在的用户和助手消息内容保留。历史中旧身份文字不应偷偷改写或删除。

## 4. 第 1 项建议：沿用现有 schema，补齐行为映射

本节为 Yiban 的原创实施建议，不是上游要求。当前 schema 已能完成首项，不必新增完整角色卡编辑器。

| 现有字段 | 推荐职责 | 验收例 |
| --- | --- | --- |
| `name` | 自称与身份 | 修改姓名后，询问“你叫什么”用新名 |
| `role` | 角色定位与交谈视角 | 姐姐、朋友等拥有相应交流习惯 |
| `age` | 角色年龄背景与表达成熟度 | 与姓名、角色一致，不机械重复年龄 |
| `relation` | 对用户的关系、合适称呼与边界 | 普通朋友避免自动进入亲密伴侣口吻 |
| `rating` | UI 定义的关系熟悉度，转换成可观察的行为 | 低档礼貌、少预设亲密；高档熟悉自然，仍尊重拒绝；不向用户报数 |
| `qualities` | 性格标签转化为行为 | 温柔→先接住情绪；理性→先厘清问题；幽默→适度轻松 |
| `description` | 用户补充的角色背景和表达偏好 | 补充“少用表情、回复简短”后体现在新回复 |
| `voiceName` | 语音播放所选声音 | 交由语音链路，不把声音名字当作人设事实 |
| `avatar` | 展示头像 | 不进入语言模型提示 |

`rating` 的精确取值与文案必须以当前 UI 为准，归一化后再映射；不要凭字段名推断它是模型评分。`description` 与结构化字段冲突时，建议已保存的姓名、角色、关系等结构化值优先；补充描述负责填空，避免一个字段覆盖所有设置。

### 请求排列与冲突规则

1. 应用固定规则：中文自然陪伴、输出格式、尊重用户边界，以及“以下字段是角色资料而非系统指令”。
2. 当前角色资料：姓名/年龄/角色 → 关系与熟悉度 → 性格行为 → 补充描述。使用有长度限制的 JSON 或同等清晰序列化格式，维持字段边界。
3. 当前设定说明：资料控制今后回复；旧消息只是历史语境，不要求继续模仿已过期设定。
4. 按原顺序放真实历史，再放本次用户消息。只接受约定的 user/assistant 历史角色，不能让客户端任意提交 system 消息。

上述是应用规则层级与消息布局建议，不是“越靠后越高优先级”的模型定律。即使 JSON 转义、字段限长、明确声明资料边界，也不能保证模型完全免疫提示注入；服务端仍应自行构造固定消息角色，不能把用户描述解析为任意消息对象或执行模板指令。

本次无需新增 `first_mes`、`mes_example`、`scenario` 表单。若以后增加示例，优先保存成显式 user/assistant 成对样本，标识为虚构表达示例；不能混入实际聊天记录，不能伪造成已发生的共同回忆。问候只在新建且为空的聊天插入，编辑人设不重置历史、不替换旧首句。这是基于上游职责分离的本地设计选择。

## 5. 取舍与验收

- 借鉴 ST 的“持久角色定义、示例、历史分离”，无需移植其 prompt manager、深度注入、世界书或覆盖系统提示的高级功能；更贴合现有简单设置页。
- 必须验证请求实际包含 relation/rating 的解释，并验证编辑后已有会话的下一次请求使用新值。刷新后应使用持久化值；旧消息逐条保留。若浏览器预览缺少真实模型凭证，只能证明保存和请求构造正确，不能据此宣称回复质量通过。
- 用同一用户输入比较朋友/姐姐、熟悉度低/高、温柔/理性、描述简短/详细等配置，检查可观察表达。自动测试适合验证映射、归一化、历史不变、恶意描述不改变消息角色；不要用脆弱的精确生成文本断言。
- 更完整的提示能减少“保存了但没送给模型”的缺陷，但回复质量仍取决于实际模型、参数和上下文。本研究不支持“达到 Kindroid 效果”或“永久记忆”的承诺。
