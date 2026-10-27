# 拟人聊天：大肥鱼与小手机的一手实现对照

研究日期：2026-10-27（Asia/Shanghai）。只浏览公开 GitHub 源码及作者案例；未安装依赖、未运行项目、未调用第三方模型，也未更改忆伴应用。本记录用于判断当前陪伴预览还缺什么。

## 证据边界

“大鲸鱼／大肥鱼”是搜索线索，不能视为一个已确认来源的软件名称。本轮找到的 `dafeiyu-bot` 是独立开源 QQ 伙伴项目，**没有证据证明用户发的截图或某条抖音视频就是它**。其 README 明确仍在迭代，不能按完整成熟商业产品评价。

作者的[连续聊天案例](https://github.com/SAKURAfan1023/dafeiyu-bot/blob/edf05b8524d5e32a3a4cadf177df2c6c37da7d5f/docs/assets/cases/01-conversation.html)声明：同一私聊的十条消息、脱敏重新排版，五条机器人回复经作者本机发送记录核对；不是原始 QQ 截图。其[证据说明](https://github.com/SAKURAfan1023/dafeiyu-bot/blob/edf05b8524d5e32a3a4cadf177df2c6c37da7d5f/docs/CHAT_EXAMPLE.md)也明确单一片段不能证明长期稳定性。这是作者提供的样例，非本轮独立实测。

## 固定版本与实际观察

| 项目 | 本轮固定提交 | 观察范围 |
| --- | --- | --- |
| 大肥鱼 | [edf05b8524d5e32a3a4cadf177df2c6c37da7d5f](https://github.com/SAKURAfan1023/dafeiyu-bot/tree/edf05b8524d5e32a3a4cadf177df2c6c37da7d5f) | 人格、表情选择与节流、记忆提炼、私聊上下文与发送队列、公开连续案例 |
| 小手机 | [6b02f733faf95c5413cfd42950bd81199a4d6858](https://github.com/AuroraLyra/xiaoshouji/tree/6b02f733faf95c5413cfd42950bd81199a4d6858) | 微信式界面、按行分消息、特殊消息解析、角色表情库、时间和本地记忆展示 |
| DSH Message | [7bad960e2fb37343f5586839c7929abfbeb04406](https://github.com/Stu-KatoMegumi/dsh-message/tree/7bad960e2fb37343f5586839c7929abfbeb04406) | 消息气泡分隔协议、记忆增改删协议及内部操作过滤 |

### 1. 大肥鱼：角色表达有具体约束，表情是有节制的行为

[QQPersonality.swift](https://github.com/SAKURAfan1023/dafeiyu-bot/blob/edf05b8524d5e32a3a4cadf177df2c6c37da7d5f/Sources/BotCore/QQPersonality.swift#L35)分别定义不同风格怎样回应、何时停止玩笑、避免重复口癖。它不是只写“温柔、俏皮”几个标签。

[QQPersona.swift](https://github.com/SAKURAfan1023/dafeiyu-bot/blob/edf05b8524d5e32a3a4cadf177df2c6c37da7d5f/Sources/BotCore/QQPersona.swift#L14)有回复长度、配图触发类型、情绪、间隔与去重时间；[QQEngine.swift](https://github.com/SAKURAfan1023/dafeiyu-bot/blob/edf05b8524d5e32a3a4cadf177df2c6c37da7d5f/Sources/WeChatAIBot/QQEngine.swift#L854)先提供可用候选，再验证模型选择的表情 ID，并检查冷却。推论：忆伴应从单张展示表情走向角色专属、有语境和重复限制的表情集合，而不是随机配图。

### 2. 大肥鱼：记忆需要表示“发生了变化”

[QQMemoryLearning.swift](https://github.com/SAKURAfan1023/dafeiyu-bot/blob/edf05b8524d5e32a3a4cadf177df2c6c37da7d5f/Sources/WeChatAIBot/QQMemoryLearning.swift#L9)的提炼协议区分 preference / fact / task / event，使用事件时间理解相对日期；变化可通过 `replaces` 关联旧条目，撤回使用 forget；条目包含来源消息、逐字证据、有效天数及主体。该协议证明设计意图与接口字段，不保证模型每次都能正确抽取。

[QQEngine.swift](https://github.com/SAKURAfan1023/dafeiyu-bot/blob/edf05b8524d5e32a3a4cadf177df2c6c37da7d5f/Sources/WeChatAIBot/QQEngine.swift#L809)按上下文剩余预算召回，并要求历史、失效信息不能当成当前状态，最新纠正优先。推论：忆伴目前的原文 ADD-only 与关键词召回，需要补充状态变化和时间解释，才能从“记得一句话”进到“跟得上生活”。

### 3. 小手机：真实分条实现存在，但简单换行不是自然节奏

[ChatRoom.vue](https://github.com/AuroraLyra/xiaoshouji/blob/6b02f733faf95c5413cfd42950bd81199a4d6858/src/views/ChatRoom.vue#L483)把非流式文字按换行拆成多条，并在后续条目前等待 500ms；生成状态另有最短等待时间。其[特殊消息配置](https://github.com/AuroraLyra/xiaoshouji/blob/6b02f733faf95c5413cfd42950bd81199a4d6858/src/config/messageDirectives.js)提供模型可选的表情库信息。

这证明“分条＋表情消息”是实际代码路径，但不能据此称其已解决语义分段、用户插话、跨分块解析或可靠发送队列。忆伴不应把一篇长回答机械切行来冒充自然聊天。

### 4. DSH Message：气泡与记忆操作需要不同协议

其[README](https://github.com/Stu-KatoMegumi/dsh-message/blob/7bad960e2fb37343f5586839c7929abfbeb04406/README.md)说明独立分隔行可作为气泡边界，并限制单轮条数。[memory.mjs](https://github.com/Stu-KatoMegumi/dsh-message/blob/7bad960e2fb37343f5586839c7929abfbeb04406/src/core/memory.mjs#L17)区分 add / replace / delete 和 explicit / inferred；后续解析、流过滤与原子写入使内部记忆控制块不直接展示。推论：忆伴可以设计结构化的回复块与后台记忆维护，但仍需自己的服务端授权、版本控制与扣费处理，不能直接信任模型输出。

## 忆伴建议按此顺序改进（本项目判断）

1. **先做真实聊天回合与插话。** 允许用户连续发几条后合并理解；AI 按语义决定一至几条消息，后续条目可被新的用户发言暂停或重新规划，避免“你说你的、它把旧回答发完”。文中参考项目只提供局部线索，完整行为须忆伴独立实现及测试。
2. **人格从标签进入具体行为。** 记录称呼、句式、幽默程度、回应长度与明确相处偏好；测试玩笑、倾诉、纠正三种不同语境。当前“小满”示例偏温柔安慰，尚不足以证明有鲜明、稳定、能自然接梗的性格。
3. **记忆从存储进入变化管理。** 除语义召回，优先加入事实／计划／事件、明确时间、当前状态、来源及旧项替代。不要重复询问已完成的计划，也不要把用户临时情绪变成长期定性。
4. **表情成为角色表达的一部分。** 同角色多种表情、按语境选择、冷却与去重；严肃倾诉时降低配图与玩笑。先用小而一致的原创集合，不急着做大图库或无关生图。
5. **界面保留私聊简洁，重测交互质量。** 保留当前联系人与气泡方向；隐藏后台记忆操作，保留纠错与遗忘入口。优先检验连续二十轮、隔天接续、用户插话、表情恰当性，再添加日记、朋友圈、虚拟红包等扩展模块。

当前 `public/design-preview/companion-im-preview` 只证明预览外观和演示点击可以成立；其中的顺畅对白和单张表情是预写示例，不是模型质量、长期关系或自动召回的验证。不能据此宣布已达到“大肥鱼”视频或 Kindroid 的实际聊天效果。

本轮只借鉴架构与交互概念，没有复制第三方代码或角色素材。没有对上述项目作成熟度背书，也没有将其与特定抖音创作者强行关联。
