# 个人长期记忆：开源实现核对与忆伴第一版建议

研究日期：2026-10-27（Asia/Shanghai）。范围：只参考一手仓库源码、许可证和官方文档；未安装框架、未连接第三方记忆服务、未复制源码。以下“建议”是针对忆伴的独立设计判断，不是这些项目提供的现成能力或已经实现的行为。

## 核对的版本与许可证

| 项目 | 固定源码快照 | 核对许可证 | 本轮用途 |
| --- | --- | --- | --- |
| Mem0 | [26cdefb46600c0fa5953c4b5ee5003c125539fc4](https://github.com/mem0ai/mem0/tree/26cdefb46600c0fa5953c4b5ee5003c125539fc4)，2026-10-26 | [Apache-2.0](https://github.com/mem0ai/mem0/blob/26cdefb46600c0fa5953c4b5ee5003c125539fc4/LICENSE) | 分离写入/检索；身份范围；去重；明确抽取成本 |
| Letta Code | [b995585d42313c9ddb8873986de05e01a595d52a](https://github.com/letta-ai/letta-code/tree/b995585d42313c9ddb8873986de05e01a595d52a)，2026-10-27 UTC | [Apache-2.0](https://github.com/letta-ai/letta-code/blob/b995585d42313c9ddb8873986de05e01a595d52a/LICENSE) | 人格与用户记忆分区；短核心上下文；可检查、受约束的持久数据 |
| Graphiti | [2b5db9e139b2627c3ba18ff55f9181569b0d8224](https://github.com/getzep/graphiti/tree/2b5db9e139b2627c3ba18ff55f9181569b0d8224)，2026-10-26 UTC | [Apache-2.0](https://github.com/getzep/graphiti/blob/2b5db9e139b2627c3ba18ff55f9181569b0d8224/LICENSE) | 来源、有效期、纠正与遗忘的区别 |
| SillyTavern | [06bde939fb1e9c4c8d8641d810f0a916b5bce127](https://github.com/SillyTavern/SillyTavern/tree/06bde939fb1e9c4c8d8641d810f0a916b5bce127)，release/1.19.0 | [AGPL-3.0](https://github.com/SillyTavern/SillyTavern/blob/06bde939fb1e9c4c8d8641d810f0a916b5bce127/LICENSE) | 记忆可编辑、可暂停；摘要与检索不是同一件事；只学习概念 |

特别注意版本漂移：旧 [letta-ai/letta 的 8816d3a](https://github.com/letta-ai/letta/blob/8816d3a8516893bfdc0fa14bfb1235226012e295/README.md) 已指向 letta-code，V1 服务端放在 archive 分支。不能把旧 Python 服务端教程当当前接入方案。Mem0 也已改变抽取流程，见下节。

## 从源码中实际学到什么

### Mem0：保存与召回分离，身份必须由可信调用方设置

当前 [memory/main.py](https://github.com/mem0ai/mem0/blob/26cdefb46600c0fa5953c4b5ee5003c125539fc4/mem0/memory/main.py) 的 `_build_filters_and_metadata` 校验 user_id / agent_id / run_id，并剥离自由 metadata 中的身份字段；search 要求范围过滤。`_add_to_vector_store` 区分直接存储与模型抽取，后者进行现有条目查询、一次 JSON 抽取、批量 embedding 和 hash 去重。这个版本的抽取是 ADD-only，不能沿用旧版本“模型自动决定 ADD/UPDATE/DELETE”的说法。显式 update/delete API 仍存在，自动抽取与显式管理不是同一层。

对忆伴的推论：会话所属 userId 和 profileId 应由服务端现有权限检查产生，不能接受前端传任意 userId，也不能让模型返回的字段决定归属。第一版使用用户确认后的原文即可，不必购买 embedding 或增加抽取模型调用。

成本证据的边界：[README](https://github.com/mem0ai/mem0/blob/26cdefb46600c0fa5953c4b5ee5003c125539fc4/README.md) 明确其基准为托管平台且含专有优化；不得把官方延迟/准确率数字承诺为忆伴或开源 SDK 的指标。源码说明自动抽取还要 embedding 和一次额外 LLM 请求；不能视为免费后台工作。

### Letta：人格与“关于用户的长期信息”分别组织，核心上下文有预算

新源码 [memory.ts](https://github.com/letta-ai/letta-code/blob/b995585d42313c9ddb8873986de05e01a595d52a/src/agent/memory.ts) 保留 `persona`、`human` 的块概念。[memory-constraints.ts](https://github.com/letta-ai/letta-code/blob/b995585d42313c9ddb8873986de05e01a595d52a/src/agent/memory-constraints.ts) 对文件、根层核心上下文和只读路径定义限制；[冲突修复模块](https://github.com/letta-ai/letta-code/blob/b995585d42313c9ddb8873986de05e01a595d52a/src/agent/memory-conflict-repair.ts) 体现并发编辑需显式处理。

[当前官方 Memory 文档](https://docs.letta.com/configuration/memory) 的 MemFS 跨同一 agent 的会话持久存在，支持检查和显式 remember；后台整理增加模型 tokens。文档中的 Agent reviews 是另一个 agent 审查，**不等于用户确认**。旧 [V1 memory blocks 文档](https://docs.letta.com/v1-sdk/memory/memory-blocks) 可用于理解有长度限制的常驻信息块，但不应声称它就是当前 MemFS 的全部实现。

对忆伴的推论：已完成的“人格与表达”继续描述 AI 怎么说话；个人长期记忆描述用户希望这位 AI 记住什么。不要把二者合并成一大段可任意覆盖的 system prompt。采用现有数据库的小条目即可，无须引入文件系统、Git 记忆同步和自主 agent 工具。

### Graphiti：事实变化、来源删除、隐私遗忘是不同操作

[edges.py](https://github.com/getzep/graphiti/blob/2b5db9e139b2627c3ba18ff55f9181569b0d8224/graphiti_core/edges.py) 保存 group_id、episodes、valid_at、invalid_at、expired_at。[edge_operations.py](https://github.com/getzep/graphiti/blob/2b5db9e139b2627c3ba18ff55f9181569b0d8224/graphiti_core/utils/maintenance/edge_operations.py) 处理去重和矛盾失效。[graphiti.py](https://github.com/getzep/graphiti/blob/2b5db9e139b2627c3ba18ff55f9181569b0d8224/graphiti_core/graphiti.py) 的检索带 group_ids/结果上限；remove_episode 会移除该来源的支持关系，只删除失去全部支持的边，并重建剩余实体摘要。删除原始来源并不简单等于删除所有相关知识。

对忆伴的推论：每条个人记忆保存来源会话/消息及确认时间；纠正内容应带 revision，而遗忘必须从未来召回中排除。不要用“保留历史的失效”冒充“彻底删除隐私内容”。Graphiti 的 group_id 只是框架范围参数，不替应用完成授权。其图数据库、模型抽取和混合检索对本版过重，暂不引入。

### SillyTavern：记忆应看得见、改得动，也能停用

固定 [摘要实现](https://github.com/SillyTavern/SillyTavern/blob/06bde939fb1e9c4c8d8641d810f0a916b5bce127/public/scripts/extensions/memory/index.js) 有编辑摘要、暂停、恢复入口。[官方摘要说明](https://docs.sillytavern.app/extensions/summarize/) 明确生成摘要可能遗漏或幻觉，并允许手工纠正；摘要附着于消息。文档快照为 [ed5423d](https://github.com/SillyTavern/SillyTavern-Docs/tree/ed5423d809c6b10b8c1e9ef4a0c8ddc7f2ef7f3d)。

[官方聊天向量化说明](https://docs.sillytavern.app/extensions/chat-vectorization/) 区分原文召回与摘要，设置条数、阈值、近期消息排除和注入位置；动态前缀也可能损伤 prompt 缓存。对忆伴的推论：不能把“记住全部聊天”和“永久摘要”当可靠记忆，更不能把助手编的叙述变成用户事实。沿用聊天消息操作和次级设置入口，减少主界面新增负担。

## 忆伴第一版推荐（产品与工程判断）

1. **作用域**：`userId + profileId`，同一账号、同一 AI 家人跨会话可用；其他家人、同家庭其他账号均不可读。默认家伴若支持无 profile 会话，使用明确的私有默认作用域，不把 null 当“所有人”。
2. **入口**：用户消息菜单“记住这件事”打开确认编辑页；AI 家人的次级入口“个人记忆”可手动添加、搜索、修改、删除、停用。明确“仅你与这位 AI 家人使用，不加入家庭记忆库”。不要默默回扫旧聊天。
3. **写入**：仅接受用户明确确认的内容。消息来源要重新校验归属和角色；拒绝把 assistant 消息直接当用户事实。保存原文或用户修改的短句，区别来源原文与最终记忆。允许偏好、习惯、近况、重要关系等轻分类；不要推断健康、收入、创伤等敏感事实。
4. **召回**：短期历史照旧；额外加入少量启用且已确认的个人记忆。可用本项目中文 n-gram 思路作小规模检索，限制每条字数、条数和总字符预算；固定/常用条目也计入预算。无匹配就不填充。建议首版最多 6 条、总计约 2000 字符，具体数字由本地测试确认，不能宣称字符数等于 token 数。
5. **信任层级**：单独标记“用户确认的个人记忆”，仅用于个性化和延续话题；已核对家庭史继续只来自 confirmed 家庭记忆。记忆内的命令、HTML/XML/Markdown、假角色分隔符均为资料，不可改变 AI 身份、规则或权限。JSON 编码只能避免结构破坏，不能保证模型绝不受注入影响。
6. **用户控制**：保存/管理免费、无额外模型调用；常规生成沿用现有积分消费和失败退回。支持全局/作用域停用，文案明确停用影响召回，**不会自动擦除原聊天记录**。删除记忆也不能声称模型已从当前历史中忘掉所有相同内容。
7. **并发与删除**：CAS revision 防多端覆盖，幂等键防重复保存。若有来源消息去重，删除后保留无正文 tombstone/来源屏蔽标识，旧请求重放不得复活；主动再次添加需新的用户确认。若将来自动提炼，必须有排除清单/水位和任务版本检查，不能只删索引后从旧消息自动重新抽取。
8. **来源生命周期**：来源删除/消息编辑时显示“原消息已删除或修改”，不暴露旧原文，不悄悄替换用户已确认的记忆。若用户只删聊天而记忆仍在，删除对话确认应明确说明；未来可提供同时删除关联记忆。隐私清除需要覆盖记忆正文、检索副本、摘要和源记录，备份保留另行说明。

这版是可控、真实持久化的长期记忆，不是自动推断一切的记忆代理。后续只有用户提出需求且有质量、成本证据时，再引入“候选→用户确认”的模型提炼和 embedding 检索。

## 当前代码接缝

- `lib/chat-generation.mjs::prepareGeneration` 已校验 thread.userId、通过 `ownedProfile` 获取当前角色，然后独立检索 confirmed 家庭记忆；在此读取个人作用域设置并召回，传给 `prompt` 新的独立参数。不能复用 `sources` 家庭来源格式冒充家庭史。
- `prompt` 的 system 已明确“只有已核对家庭记忆是家庭事实来源”。新增个人上下文需明确用途并保留此规则；不要把个人资料拼成无条件事实宣言。每轮从存储读取，修改/停用/删除从下一次生成生效，不回写旧回复。
- `lib/familia-store.mjs::ownedProfile` 可复用角色归属；新 `personal-memory` 模块独立负责条目校验、授权、去重、CAS、读取预算，避免把人格 CRUD 再塞入自由文本。
- `lib/store.mjs` 已有 get/all/put/insertIfAbsent/compareAndPut/remove，SQLite 本地和 Neon JSON 文档双后端可沿用。多条目清空/计数上限不可假设单条 CAS 就有事务保证；并发场景需明确策略。不要写任何 credits 文档来改余额。
- `lib/chat-workspace.mjs` 有用户消息角色、分支 parentId/headId 和 soft-deleted thread。来自聊天的记忆必须验证消息属于当前用户和该 profile，考虑分支，不能以全库 allMessages 中任意 ID 绕过权限。
- 旧 `lib/companion.mjs::localNotes` 是短句集合，未形成新的角色隔离/确认模型；不要将旧 notes 自动迁入用户确认的长期记忆。

## 必要验证清单

- 同用户新会话可召回；换角色或换用户不可召回；默认作用域不泄露。
- 用户消息确认保存、来源校验、长度/类型、重复与幂等、过期 revision、失败保留输入。
- 编辑从下一次生成起生效；停用和删除后不进入新请求；旧请求/旧后台任务不复活删除内容。
- 家庭引用关/开与个人记忆开/关互相独立，个人信息不写入家庭 confirmed 集合。
- 不相关条目、条数上限、总字符预算；恶意资料只能在数据块出现，不改真实 system 规则。
- 保存/删除不扣分；已有聊天成功/失败/停止/幂等扣费不变；没有额外外部模型请求。
- 手机与网页真实页面截图，空态、管理态、编辑/确认、来源不可用、加载失败、大字号和键盘可达。

## 采用范围与复现边界

本轮仅学习架构与交互概念，建议独立编写 JavaScript/React 实现。尚未引入任何上述项目的源码、SDK、服务、商标或视觉素材；无需为第一版安装 Python 向量数据库、图数据库或 agent 平台。许可证核对仅记录来源文件，不替代后续实际引入依赖时对其分发和网络使用条件的复核。
