# 实时语音通话预览

聊天顶部电话按钮打开通话面板，支持手机和网页布局、可用音色选择、说话风格、折叠的 VAD/补充要求、静音、插话打断和挂断。

## 环境与凭据

只在 Vercel Preview（或 YIBAN_DATA_ENV=test 的本地隔离环境）设置 OMNI_CALL_PREVIEW_ENABLED=1。正式站必须额外配置 OMNI_CALL_ENABLED=1；预览开关不能启用正式站。配置 QWEN_OMNI_API_KEY，或复用 QWEN_VOICE_API_KEY。仅服务器向固定的千问 WebRTC SDP 端点发送密钥，不把密钥返回浏览器。

模型为 qwen3.8-omni-flash-realtime。OMNI_CALL_VOICES_JSON 是已有音色的服务器登记表，字段为 ownerId、id、name、model；仅返回当前用户且模型匹配的音色。可用 ownerRole: "platform-owner" 代替 ownerId，仅向已认证的平台所有者开放预置私有音色；普通家庭管理员无权使用。TTS Plus 音色不能直接用于 Omni。无专属音色时提供 Tina。

## 数据与行为

本版沿用独立通话测试的中文陪伴提示词，不读取应用聊天历史、人格或长期记忆。当前伴侣名字和头像用于展示。家庭记忆不变。字幕仅在当前面板内存中保留，可手动下载 TXT，默认不录音。数据库只保存用户隔离的通话租约及状态，不保存 SDP、音频或字幕。

应用积分本版不扣除，千问调用仍产生供应商费用。每位用户同一时间只能有一通电话；失联租约 90 秒过期。麦克风在音色配置获确认后才发往远端。挂断、关闭或离开页面均释放设备，失败不自动重新发起收费会话。

## 验证

单元测试覆盖身份、同源、音色归属、生产禁用、会话并发与失败释放。浏览器用本机原生 WebRTC 对端验证真实 RTP、数据通道、打断、静音、权限拒绝及挂断重启竞态，不调用收费服务。预览上线后另行验证实际千问连接；界面测试不等于供应商可用性验证。

参考：千问官方 realtime-api/webrtc-access、realtime-api/token-auth 与 real-time-multimodal/server-events 文档。
