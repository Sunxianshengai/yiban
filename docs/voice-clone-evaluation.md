# 忆伴 · 多成员声音克隆（音色复刻）方案评估

> 目标：让**每一位家庭成员**都能用自己的输入语音克隆出专属音色，之后用该音色朗读文字 / 故事 / 留言。
> 实现方式：调用现有模型或平台，不自研声码器。
> 本文先评估方案与候选平台，**不写业务代码**，待你选定厂商后再落地。

---

## 1. 需求界定

- 对象：家庭成员（现有 `members` 集合里的每个人），**多人、各自独立音色**。
- 输入：成员自己录制的语音样本（不是照片、不是别人声音）。
- 输出：该成员专属 `voiceId`，用于把任意文本合成成"他的声音"。
- 覆盖范围：记忆故事朗读、专辑讲述、留言、可能的"今天的陪伴"文字。
- 兜底：克隆失败 / 未克隆 / 离线 / 额度耗尽时，回退到浏览器 `speechSynthesis`，永不静默失败。
- 合规底线：只允许本人克隆**自己**的声音，且需显式授权。

---

## 2. 现状对照（忆伴现有能力，已读源码确认）

| 维度 | 现状 | 缺口 |
|---|---|---|
| 成员模型 | `members` 仅 `{id,name,relation,role,color}`，**无 voice 字段** | 需加 `voiceId / voiceStatus / voiceSampleUrl / voiceConsent` |
| 音频载体 | 音频只挂在 `memory.audio`，是"一段记忆的录音"，不是"某人的音色" | 需要成员级音色，独立于具体记忆 |
| TTS | 仅 `window.speechSynthesis`（Elder.jsx、page.jsx 专辑试听），无服务端合成、无缓存 | 需加服务端合成 + Blob 缓存 |
| 媒体存储 | `saveMedia` / `readMedia` 已支持本地与 Vercel Blob 双轨，`uploads` 集合记录 | 克隆样本与合成音频可复用同一套存储 |
| API 形态 | 单文件 `app/api/[...path]/route.js`，`members` 已有 POST/DELETE 分支 | 新增 `voice` 分支（enroll / speak）即可，无需改路由框架 |
| 鉴权 | `guard(request, role)` + `ensureOrigin` 已就绪 | 克隆属于 editor 权限操作，复用即可 |

**结论**：忆伴的存储、媒体、鉴权、路由都是"通用文档 + 媒体"架构，扩展一个"成员音色 + 合成缓存"概念成本很低，**不需要重构**。

---

## 3. 候选平台横向对比（2026-10 现价）

| 平台 / 模型 | 克隆方式 | 样本要求 | 克隆成本 | 合成成本 | 流式 | 中文质量 | 国内直连 |
|---|---|---|---|---|---|---|---|
| **阿里云百炼 CosyVoice-v3-Flash** | 上传参考音频复刻 | **5–20s**（v3-flash） | **免费**（CosyVoice 系创建音色免） | **1 元/万字符**（华北2） | ✅ 实时流式 | 好，自然度/情感提升 | ✅ |
| 阿里云 CosyVoice-v3.5-Plus | 同上 | 5–20s | 免费 | 更高（Plus 档） | ✅ | 更高保真 | ✅ |
| **MiniMax Speech-2.8**（turbo/hd） | 快速复刻 | ~10s | 按量（约 2 元/turbo、3.5 元/hd 每万字符，刊例） | 同上 | ✅ <250ms | 中文自然度好，支持声音标签 | ✅ |
| **Fish Audio**（s2.1-pro / s2-pro / s1） | 支持克隆 | 10s+ | 按量 | **约 1.14 元/万字符** | ✅ | 参数控制最全（时长/采样率/语速/音量/情绪标签） | ✅ |
| ElevenLabs v3 / flash v2.5 | Instant clone | 1min+ | 按量 | 约 3.75 元/万字符 | ✅ 75ms | 表现力最佳 | ❌ 海外账号/支付/网络 |
| **本地 GPT-SoVITS / IndexTTS2** | 本地推理 | 10s–5min | **0 元** | **0 元** | 视部署 | 强（IndexTTS2 情绪克隆突出） | ✅ 但需 N 卡 |

数据来源：
- 阿里云 CosyVoice 克隆免费、v3-Flash 合成 1 元/万字符、5–20s 样本：[声音复刻及声音设计实践](https://help.aliyun.com/zh/model-studio/voice-cloning-and-voice-design)、[cosyvoice-v3-flash 模型页](https://help.aliyun.com/zh/model-studio/cosyvoice-v3-flash)
- MiniMax / Fish Audio / ElevenLabs 刊例价见[三家对比文章](https://blog.csdn.net/2601_96838444/article/details/167039719)
- 本地开源选型见[2026 开源 TTS 模型怎么选](https://zhuanlan.zhihu.com/p/2058139948285536224)

### 一句话判断

- **最低成本 + 最稳国内接入 → 阿里云 CosyVoice-v3-Flash**（克隆免费是决定性优势，家庭场景每个成员只克隆一次）。
- **中文自然度 / 声音标签最强 → MiniMax 2.8 或 Fish Audio**（但克隆与合成都按量，价格略高）。
- **完全离线 / 隐私最好 / 零边际成本 → 本地 GPT-SoVITS / IndexTTS2**（仅适合桌面版，不适合 Vercel 云端，且安装包 +1~2GB）。
- **表现力天花板 → ElevenLabs**（但海外支付与网络对比赛演示不友好，不推荐首发）。

---

## 4. 成本测算（一个家庭）

计费基数 = 合成字符数（克隆免费或一次性）。以阿里云 CosyVoice-v3-Flash（1 元/万字符）为例：

| 场景 | 字符/月 | 费用/月 |
|---|---|---|
| 每天 2 段故事（每段 500 字） | 30,000 | **≈ 3 元** |
| 加每日问候、留言朗读 | 50,000 | **≈ 5 元** |
| **开启音频缓存**（同一段文字只合成一次，长尾复用） | 实际 1/3~1/5 | **≈ 0.6–1.5 元** |

- 新账号在百炼控制台通常有试用额度（以控制台显示为准），**比赛演示基本可零成本覆盖**。
- 克隆是一次性成本（CosyVoice 免费），后续只有合成按字符计费。
- 缓存层是把成本压低一个数量级的关键（陪伴产品"同一段故事反复听"是高频行为）。

---

## 5. 推荐技术架构（与现有代码对接）

### 5.1 数据模型

- `members` 记录增加字段：`voiceId`（平台音色 ID，可为空）、`voiceStatus`（`none | enrolling | ready | failed`）、`voiceSampleUrl`（样本 Blob 地址）、`voiceConsentAt`（授权时间戳）。
- 新增 `voice_cache` 集合：`{ id: hash(voiceId+text+speed), blobUrl, createdAt }`，服务端查缓存命中，避免重复合成。

### 5.2 平台抽象层（`lib/voice.mjs`）

```js
// 伪代码骨架（待厂商确定后填充具体实现）
export async function enrollVoice(sampleBlobUrl, memberId) { /* 调平台克隆 → 存 voiceId */ }
export async function synthesize(text, voiceId, speed) {
  const key = hash(voiceId + text + speed);
  const hit = await get('voice_cache', key);
  if (hit?.blobUrl) return hit.blobUrl;          // 命中缓存
  const audio = await provider.speak(text, voiceId, speed); // 调平台
  const stored = await saveMedia(...audio);       // 写 Blob
  await put('voice_cache', { id:key, blobUrl:stored.blobUrl });
  return stored.blobUrl;
}
```

`provider` 做成可切换接口：`cosyvoice.js` / `minimax.js` / `fishaudio.js` / `local.js`，密钥走环境变量（如 `COSYVOICE_API_KEY`）。

### 5.3 API 扩展（`app/api/[...path]/route.js`）

新增 `voice` 分支（复用 `guard` + `ensureOrigin`）：

- `POST /voice { action:'enroll', memberId, sampleBlobUrl }` → 调平台克隆，更新 `members[id].voiceId / voiceStatus`。
- `POST /voice { action:'speak', memberId, text, speed }` → 查缓存 → 调合成 → 存 Blob → 返回 `audioUrl`。
- 删除成员时（`DELETE /members/:id`）一并清理其 `voiceStatus`。

### 5.4 前端接入点

- `components/UI.jsx` 的 `Avatar` 旁：成员卡片增加"录制我的声音"按钮（走现有 `uploadPresigned` 上传样本到 Blob）。
- `components/Elder.jsx` 播放器 `play()`：当前逻辑是 `memory.audio → speechSynthesis`；改为 `member.voiceId 合成音频 → memory.audio → speechSynthesis`，失败逐级回退。
- `app/page.jsx` 专辑试听同理改用 `synthesize()`。
- 播放界面标注"AI 合成声音"（合规，见第 6 节）。

---

## 6. 合规与风险（比赛评委必问）

1. **声音权**：《民法典》第 1023 条，自然人声音参照肖像权保护。界面必须显式勾选"我同意使用我的声音生成语音"，并留存授权时间/账号；**只允许本人克隆自己的声音**。
2. **AI 生成内容标识**：《人工智能生成合成内容标识办法》已于 **2025-09-01 施行**，AI 合成语音需在播放界面有"AI 合成"提示（显式或隐式标识）。
3. **已故亲人声音**：伦理与法律风险最高（可能侵害他人声音权、且涉及亲属争议）。**建议比赛版本明确不做**，至少在条款里写清限制。
4. **样本安全**：克隆样本与合成音频走现有 Blob 私有存储，服务端鉴权（与 `uploads` 同机制），不外泄。
5. **降级透明**：回退到 `speechSynthesis` 时，界面已注明"设备朗读 · 非家人原声"，保持诚实不误导。

---

## 7. 实施阶段建议

- **Phase 0（厂商无关）**：`lib/voice.mjs` 抽象层 + `voice_cache` + 兜底链。不依赖任何密钥即可本地运行（兜底生效）。
- **Phase 1（首发接入）**：填 `cosyvoice.js`（推荐），接 `enroll` / `speak`。
- **Phase 2（UI）**：成员卡片录制入口 + 老人端播放器切换 + "AI 合成"标识。
- **Phase 3（可选）**：本地 GPT-SoVITS 作为桌面版离线 provider；或多 provider 热切换。

---

## 8. 需要你拍板的决策点

1. **选哪家厂商**？（推荐首发：阿里云 CosyVoice-v3-Flash，克隆免费 + 1 元/万字符 + 国内直连）
2. **是否先落地 Phase 0 抽象层**（不绑死厂商、本地可跑），还是直接接阿里？
3. **样本最短时长 / 质量门槛**（如 ≥8s 清晰人声），影响克隆成功率与体验。
4. **是否允许"用我的声音朗读任意文字"**，还是仅限已确认的家庭记忆/留言（更克制、更合规）。

选定后我会直接动手实现对应 Phase，密钥走环境变量，并保留 `speechSynthesis` 兜底。
