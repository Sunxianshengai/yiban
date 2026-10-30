# AI 伴侣专属声音 · 验收说明

范围：伴侣的声音设置、克隆、试听和两种回复模式。家庭记忆、真实家人克隆接口及已有历史音频不变。本次不部署。

## 入口与操作

- 聊天右上角「对话菜单 → 声音」。手机全屏设置页，网页右侧抽屉。
- 「人格与表达 → 声音与回复模式 → 声音」也可进入。
- 我的专属音色 → 创建专属音色 → 上传音频或现场录音。文件选择后只在本机解码为 24 kHz 单声道 PCM WAV，未确认时没有上传。
- 支持浏览器可解码的 MP3/WAV/M4A 等格式；3–30 秒，建议清晰、单人、10–20 秒。现场录音 29 秒自动停止，退出释放麦克风。
- 填名称、确认声音本人的授权，点击创建后才上传至私有媒体存储并发送千问。
- 创建状态保留在账号中，可以退出再回来查询；超时按固定前缀查询，避免重复创建。自动查询最多 20 次，之后可手动查询。
- 生成试听后「用于伙伴」，不会创建后自动替换；失败保留旧设置。已有音色可选择、重命名或从本账号移除。
- 正在使用的音色须先切换再移除；移除不删除历史语音，不销毁服务商音色。

## 两种回复模式

1. **语音回复模式**：普通聊天优先生成语音气泡，文字折叠在「查看文字」；用户本轮说“打字就好”等可以临时覆盖。失败保留文字和重试入口，不伪造音频。
2. **文字模式**：默认文字；用户明确要求“说给我听”“发语音”等，才合成。

旧 auto/manual/off 数据继续可读，展示和生成按文字模式兼容；保存设置写入 voice/text。原 off 的失败语音重试仍遵守旧禁用规则，改为新模式后生效。声音设置会影响该伙伴的后续会话，已有会话记录和语音不重新生成。

## 服务配置（服务器环境变量）

```dotenv
QWEN_VOICE_API_KEY=<千问 AI 平台密钥，不是百炼密钥>
QWEN_VOICE_MODEL=qwen-audio-3.1-tts-plus
# 默认，无需配置：
# QWEN_VOICE_BASE_URL=https://maas.qianwenaiapi.com/api/v1
```

自定义音色始终使用创建时绑定的模型，不随全局合成模型覆盖。家人现有声音服务和伴侣预置音色仍沿用既有配置；仅添加千问密钥不会开启其他供应商的预置音色。

已有独立工具创建的音色无需再次上传：管理员可在服务端设置以下登记列表。先确认录音本人授权适用于应用内使用，明确指定目标用户 ID；使用相同千问平台账号的密钥。不要把密钥或完整私人 manifest 提交到仓库。

```json
[{"userId":"目标账号的内部用户ID","name":"专属声音01","model":"qwen-audio-3.1-tts-plus","voiceId":"已有的完整音色ID"}]
```

将上面 JSON 作为 `QWEN_COMPANION_VOICES_JSON` 的值。音色仅在指定账号内出现，首次查询验证服务商状态后才能使用。网页不显示服务商音色 ID，也不允许客户端填写任意他人 ID。移除后不会因环境配置自动重新出现。

## 费用、隐私与限制

- 保存、创建和试听当前不扣应用积分；语音聊天沿用已有聊天计费及失败处理。服务商克隆、合成费用由平台账号承担，不代表云服务免费。
- 每账号每天最多创建 5 次（含待确认结果），最多 10 个未移除的音色；每日按 UTC 日界计数。服务商仍可能保留已移除的音色。
- 每音色提供 5 条固定试听文本；同一句缓存复用，失败最多尝试 3 次。音频私有，下载不向存储域名发送 API Key。
- 不自动朗读或播放，保留用户主动播放、AI 合成标记。未配置服务时明确提示。
- 当前语音合成上限沿用每条模型回复 1200 字。长回复或语音服务失败时保留文字，无法保证每轮都能合成。

## 本地测试

```powershell
npm test
npm run build
# 用隔离目录、模拟模型和合成测试音频启动应用，不能使用真实密钥：
# QWEN_VOICE_API_KEY=local-mock-only
# QWEN_VOICE_BASE_URL=http://127.0.0.1:3879/api/v1
# YIBAN_VOICE_MOCK=1
# YIBAN_DATA_DIR=<独立测试目录>
# AI_API_URL=http://127.0.0.1:3878/v1/chat/completions
# AI_API_KEY=local-mock-only; AI_MODEL=mock
# 分别启动 tests/mock-model.mjs (MOCK_PORT=3878)、
# tests/mock-companion-voice.mjs (VOICE_MOCK_PORT=3879) 和 next start -p 3877。
$env:PW_BASE_URL='http://localhost:3877'
npx playwright test tests/browser/companion-voice.spec.mjs --project=functional
```

`YIBAN_VOICE_MOCK=1` 只在非 Vercel 环境允许本机回环服务；不改变生产默认域名。

接口测试覆盖实际应用 handler、素材归属、授权、幂等、超时恢复、试听缓存/次数、音频下载和 WAV 长度修正、账号隔离、角色音色保存、聊天两种模式、语音失败与家庭数据不变。浏览器测试覆盖手机/网页创建—试听—应用—切换—刷新恢复及保存失败保留编辑。

真实音色质量由用户试听验收。本轮使用本地合成音频测试流程，不读取或上传私人录音，不使用真实千问密钥，不声称完成线上或真人音色质量测试。

## 官方接口依据

- https://platform.qianwenai.com/docs/developer-guides/speech/voice-cloning
- https://platform.qianwenai.com/docs/api-reference/speech-synthesis/voice-cloning/http-api
- https://platform.qianwenai.com/docs/developer-guides/speech/tts
