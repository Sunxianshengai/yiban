# 主动联系 · 独立交互预览

仅用于用户确认方案。不接真实聊天、账号、模型、积分、推送或云调度，不请求浏览器权限；保存仅在当前页面内存中生效。

方案以 `d5220ef` 为当前应用基线。用户已选择「应用内消息＋可选浏览器通知」；联系频率仍待确认，预览暂用每天最多 1 次，并可演示每天最多 3 次。这些次数是上限，不是发送任务。

样式按 `companion-warm-preview/warm.css` → `proactive.css` 加载，沿用已有小满头像与贴纸素材。画布、近白面、深棕操作、鼠尾草绿用户气泡和无衬线字体延续 Familia 暖色语言。预览继承的渐变底、浮起的白色圆角栏、气泡阴影和 900px 手机断点，与当前正式聊天 `app/companion-chat.css` 的实色工作区、紧凑圆角和 768px 断点有差异；它用于评审主动联系流程，不作为正式聊天逐像素替换稿。

新增样式仅属于此独立预览：轻量主动联系标签、未读分隔、原因面板、频率与免打扰设置、通知示意、暂停／静默状态。桌面右侧设置面板为 360px，中间尺寸为 340px；900px 及以下为全屏面板。预览局部提高辅助文字的可读性，并沿用可见焦点及减少动态支持。这些局部值不升级为全站 token；`DESIGN.md` 与 `.impeccable/design.json` 保持现状。

在项目根目录运行 `node scripts/serve-proactive-preview.mjs`（本地辅助服务器）后访问：

- `http://127.0.0.1:3849/design-preview/proactive-contact-preview/`
- `?screen=settings` 主动联系设置
- `?screen=contacts` 会话未读
- `?screen=reason` 为什么提起
- `?screen=device` 当前设备通知
- `?screen=notification` 系统通知视觉示意
- `?screen=paused` 暂停联系
- `?screen=quiet` 免打扰
- `?case=tea` 兴趣偏好的另一条示例

快捷回复只填入输入框，由用户确认发送；通知卡及设备开关均为页面内演示。刷新页面会重置状态。正式实现仍需用户确认后的服务端发送、账号与伙伴隔离、真实未读、设备订阅及调度；本轮没有安装权限链路、Service Worker 或调度器，没有创建云资源或改变生产行为。

更完整的产品规则、技术边界与验收口径见 `docs/proactive-contact-proposal.md`。

截图脚本：`node scripts/shoot-proactive-preview.mjs`，输出到 `.impeccable/review/proactive-contact-preview/`。现有 15 张截图：桌面 1440×1000，包含 chat、settings、reason、notification、paused、quiet、device；手机 390×844，另含 contacts。脚本同时检查横向溢出、页面异常及演示开关／保存；截图和这些检查不证明真实离线送达或系统通知可用。独立界面评审已在「仅预览」范围给出 SHIP，无实质问题；这不代表用户已批准方案或部署。
