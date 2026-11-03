# 声音克隆接入说明（阿里云百炼 CosyVoice-v3-Flash）

为「我的家人」每位成员复刻其真实声音，老人在端听故事时优先用该成员已克隆的音色朗读，
失败自动回退到浏览器设备朗读。合成语音在界面明确标注「AI 合成」。

## 1. 开通与拿 Key
1. 登录 https://dashscope.console.aliyun.com/ 开通「语音合成 / 声音复刻」。
2. 在「API-KEY 管理」创建密钥，得到 `DASHSCOPE_API_KEY`。
3. 可选：记录北京地域的**业务空间 ID**，填到 `DASHSCOPE_WORKSPACE_ID`。
   此变量只填写 ID，不填写域名；未配置时使用 `dashscope.aliyuncs.com` 公共网关。
   当前实现的专属域名仅支持北京地域。

## 2. 配置环境变量
在 `.env.local`（本地）或 Vercel 项目环境变量（线上）加入：

```
DASHSCOPE_API_KEY=sk-xxxxxxxx
# 可选：北京地域业务空间 ID（不是域名）
# DASHSCOPE_WORKSPACE_ID=你的业务空间ID
```

> 录音可保存在本地或私有 Vercel Blob。后端鉴权读取后，将音频以 Base64 Data URI
> 提交给复刻服务，不要求样本公开可访问。线上部署仍需连接 Blob 保存媒体。
> 请求遵循[官方 HTTP API](https://help.aliyun.com/zh/model-studio/voice-clone-design-http-api)：
> `model: voice-enrollment`、`input.action: create_voice`，成功结果读取 `output.voice_id`。

## 3. 使用流程（页面内）
1. 家属端「我的家人」→ 点成员卡上的 **复刻我的声音**。
2. 现场录 5–20 秒清晰中文，或上传音频 → 保存。勾选「本人同意」→ 复刻。
3. 后端调用 `/api/voice/enroll` → 阿里云克隆 → 回写成员 `voiceId`。
4. 老人端听故事时，若该段记忆的讲述人已复刻声音，自动用其音色朗读并标注「AI 合成」。

## 4. 计费与缓存
- 克隆（复刻）：当前免费；合成约 **1 元 / 万字符**。
- 每段 (voiceId, 文本, 参数) 的合成结果写入 `voice_cache` 集合并落盘 Blob，
  命中缓存不再计费。
- 估算：家庭每天 2 段 500 字故事 ≈ 3 元/月；加缓存后约 0.6–1 元/月。

## 5. 接口速查
- `GET /api/voice/status` → `{configured, provider}`
- `POST /api/voice/enroll` `{memberId, audioUrl, consent}` → 更新成员 `voiceId`
- `POST /api/voice/speak` `{memberId, text, options?}` → `{audioUrl, cached, voiceId}`
  （命中 `voice_cache` 直接返回 blobUrl）

## 6. 合规提醒
- 仅复刻**本人**声音，且需本人勾选同意（界面已强制）。
- 合成语音一律标注「AI 合成声音」（老人端 `player-source` 已显示）。
- 已故亲人声音建议比赛版不做；《生成式人工智能服务管理暂行办法》要求显著标识 AI 生成内容。

## 7. 未联网兜底
未配置 `DASHSCOPE_API_KEY` 时，`/api/voice/status` 返回 `configured:false`，
页面不会出现复刻入口，老人端照常使用设备朗读，不影响其它功能。
