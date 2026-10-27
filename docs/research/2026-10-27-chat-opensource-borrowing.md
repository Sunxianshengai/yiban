# 聊天功能开源借鉴笔记

日期：2026-10-27。方法：直接读开源仓库真实源码/规范原文（本文件所有格式与常量均摘自源码，非转述），Rocket.Chat Web 端录音组件在当前 monorepo 中已不可定位（下文注明），语音录制以 Element Web 实现为主要参照——它本来就是 Web 应用，比 Rocket.Chat RN 更贴近忆伴。

## 1. 引用回复 —— Matrix 规范（matrix-org/matrix-spec）

**源码证据**：`content/client-server-api/modules/rich_replies.md`

- 数据模型：不占用 `rel_type`，用 `m.relates_to` 下的子键 `m.in_reply_to`：
  ```json
  { "content": { "m.relates_to": { "m.in_reply_to": { "event_id": "$another_event" } }, "body": "…" } }
  ```
- 旧版 fallback（`> <@user> 引文` 前缀行）v1.13 起已弃用，但客户端渲染前仍应剥掉前缀行——**渲染引用靠关系字段，不靠正文里塞引文**。
- 引用可以指向任意事件类型（v1.3 起），不限于文字消息。

**忆伴落地**：
- `chat_messages` 增加 `replyTo: { messageId, excerpt, role }`（excerpt 是被引用消息的纯文本摘要，消息删除后引用条显示「原消息已删除」墓碑，不渲染悬空内容）。
- prompt 注入：被引用内容单独作为一段上下文标明「用户引用了这句话」，与连续对话历史分开，保证模型接的是被引用那一句。
- UI：编辑器上方引用条（可取消），气泡内渲染折叠引文块。

## 2. 可靠发送 / 消息状态 —— matrix-js-sdk

**源码证据**：`src/models/event-status.ts`
```ts
export enum EventStatus {
    NOT_SENT = "not_sent",   // 未发出且不再重试（显示失败+重试按钮）
    ENCRYPTING = "encrypting",
    SENDING = "sending",
    QUEUED = "queued",       // 排队等待发送
    SENT = "sent",
    CANCELLED = "cancelled",
}
```
另外 element-hq/element-web issue #29677 确认设计意图：**必须等上一条拿到服务器 200 再发下一条，保证顺序**。

**忆伴落地**：
- 逐条用户消息本地状态机：`sending → sent / failed`（忆伴是服务端确认制：收到 `start` 事件即 sent，之前为 sending）。
- 顺序发送：队列串行，前一条确认后再发下一条，不并发。
- 忆伴已有的基础保留：requestKey 指纹去重（chat-generation.mjs:52）、pending 快照恢复、失败退积分提示。新增的是 UI 层失败态点击重试（复用同一 requestKey，服务端 replay）。

## 3. 语音录制 —— Element Web（element-hq/element-web）

**源码证据**：`apps/web/src/audio/VoiceRecording.ts`（325 行）、`apps/web/src/components/views/rooms/VoiceRecordComposerTile.tsx`（309 行）

关键决策（均摘自源码）：
- 单声道、48kHz；语音用 24kbps Opus（`encoderApplication: 2048 // voice`）。
- **时长取自 AudioContext.currentTime**（`get durationSeconds`），不是 MediaRecorder 的不可靠 metadata。
- **波形在 AudioWorklet 里算**（不占主线程），每秒一个 amplitude，live 波形用 `FixedRollingArray(RECORDING_PLAYBACK_SAMPLES=44, 0)` 滚动窗口；播放器缩略波形量化为 `v * 1024` 整数。
- 最长 15 分钟（`TARGET_MAX_LENGTH = 900` 秒），接近结束时警告。
- **上传失败不丢弃录音**（`didUploadFail` 状态，注释明确 "don't dispose the recording: the user has a chance to re-upload"）。
- 录音期间暂停其他播放（`PlaybackManager.instance.pauseAllExcept()`）。

**Rocket.Chat 说明**：Web 主仓（apps/meteor）的 messageBox/composer 目录已无 VoiceRecording 组件（逐目录核实为 404/不存在），录音能力现状不明；其 React Native 端（app/containers/MessageBox 一带）是 RN 手势实现，对 Web 参考价值低于 Element。**忆伴语音以 Element 方案为蓝本。**

**忆伴落地**：
- 不引 opus-recorder 依赖：用原生 `MediaRecorder`（Chrome/Edge 出 `audio/webm;codecs=opus`），波形用 `AudioContext.createAnalyser` + `requestAnimationFrame` 采样成 44 个峰值数组（存进消息，播放器直接复用，免二次解码）。
- 时长：录制期间累计计时 + 停止后用 blob 实测校准。
- 交互：按住说话（pointer events），上滑取消；录音中暂停其他语音播放；上传失败保留录音可重发。
- 时长上限 5 分钟（家庭场景够用，省存储）。

## 4. emoji 最近使用/收藏 —— emoji-mart（missive/emoji-mart）

**源码证据**：`packages/emoji-mart/src/helpers/frequently-used.ts`

- 存储：`Store.get('frequently')` 为 `{emojiId: 次数}` 表，每次使用 `+=1`，同时记 `Store.set('last', emojiId)`。
- 排序：按次数降序，同分按 id 字典序。
- 容量控制：超过 `maxFrequentRows * perLine` 时裁掉最末位（**last 使用的永不裁掉**），且写回存储。
- 空态：内置 14 个 DEFAULTS 兜底，权重为 `perLine - i`（越靠前分越高）。

**忆伴落地**：localStorage 两张表——`yiban:emoji:freq`（id→次数）与 `yiban:emoji:favs`（收藏数组）+ `last`；排序与裁剪逻辑照搬（超容量裁最末、last 豁免）；空态给文档示例风格的默认表情。自定义上传表情存私有 Blob，走既有权限检查。

## 5. 图片/附件上传 —— Chatwoot（chatwoot/chatwoot）

**源码证据**：`app/javascript/widget/components/ChatAttachment.vue`

- **全局 paste 监听**：`document.addEventListener('paste')`，遍历 `clipboardData.items`，`item.kind === 'file'` 时取 File 入上传队列（截图粘贴的原生入口）。
- 直传：ActiveStorage `DirectUpload` 先建 blob 拿 `signed_id`，成功后才把引用交给消息发送；`isUploading` 单标志位控制按钮态。
- 大小限制先查再传（`checkFileSizeLimit`）。

**忆伴落地**：复用既有 Blob 签名直传（家庭记忆已有链路：浏览器直传→服务端核实登记）；composer 加全局 paste 监听 + 相册/拍照（`<input type="file" accept="image/*" capture>`）；多图消息为附件数组，每张独立 `uploading/failed/ready` 状态、失败单张重试；图片放大查看用轻量灯层，保存用 `<a download>`。AI 读图：附件 URL 以多模态消息喂给模型（`ai.mjs` 当前是否支持图像输入需先核实，不支持则文本层如实说明「我看不了图」——按红线不撒谎）。

## 6. 对照表：功能 → 借鉴来源 → 忆伴落地

| 功能 | 借鉴来源 | 核心决策 | 忆伴适配 |
| --- | --- | --- | --- |
| 引用回复 | Matrix 规范 rich_replies.md | m.in_reply_to 关系字段，渲染不靠正文引文 | replyTo 字段 + prompt 单独注入被引用句 |
| 消息状态/重试 | matrix-js-sdk event-status.ts | sending/queued/sent/not_sent 状态机，串行发送 | 服务端确认制映射 + 失败重试复用 requestKey |
| 语音录制 | Element Web VoiceRecording.ts | AudioContext 计时、worklet/analyser 波形、失败保留录音 | 原生 MediaRecorder + 44 峰值数组存消息 |
| emoji 频次 | emoji-mart frequently-used.ts | 计数表+降序+容量裁剪（last 豁免） | localStorage 两表照搬逻辑 |
| 图片上传 | Chatwoot ChatAttachment.vue | 全局 paste、直传后引用、先查大小限制 | 复用 Blob 直传，多图逐张状态机 |

## 7. 与忆伴架构的适配要点

1. **生成与发送解耦**：忆伴每条用户消息触发一次 job 式生成，媒体消息先传媒体再发起生成；媒体上传与积分扣费严格分开（上传失败不扣分，生成失败照旧退回）。
2. **无组件库**：所有借鉴只取数据结构与状态机决策，UI 全部手写沿用现有 token。
3. **不撒谎红线**：AI 读图能力取决于 ai.mjs 的模型多模态支持，接入前 prompt 里如实说明；转写同理。
