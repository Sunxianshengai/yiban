# 陪伴聊天五项增强 · 验证记录

日期：2026-10-28。仅本地验收，未合并 main、未推送、未部署。

## 结果

- `npm test`：168 项通过，无失败、跳过或取消。
- `npm run build`：Next.js 生产构建通过。
- 本地隔离应用 `http://localhost:3858` 浏览器回归：18 个场景通过，包含新五项功能、聊天工作区、自动记忆、人格设置、积分和原家庭流程。
- 最后改动后再跑 `chat-five-capabilities.spec.mjs`：3 个场景全部通过，包含桌面、390px 手机、虚拟麦克风实录、上滑取消、录音上传失败保留与重试。
- `git diff --check`：通过。

## 专项覆盖

新增长期记忆和多模态链路的 16 项测试：WAV 编码；音频转写持久化、上下文与幂等；图片私有内联与后续上下文；跨账号素材和任意 URL 拒绝；ASR 失败与免重复扣费重试；自然语音偏好、拒绝和冷却；TTS 失败、实际音频存储和重试幂等；保护记忆确认修改；过期版本拒绝覆盖；遗忘范围；计划结束；搜索有效分支与置顶；转发原子提交与权限；明确主题优先；家庭数据保持不变；长转写的上下文预算；伙伴回访线索隔离。

测试过程中修复：图片附带文字发送后未清空；置顶后菜单未关闭；置顶历史影响最近联系人预览；录音上滑取消状态未传递；上传失败丢录音；明确结束的计划被上一轮无关记忆引用干扰；默认伙伴与其他伙伴回访线索混用；长音频转写未计入上下文预算；原浏览器测试在刷新后过早判断布局导致入口误判。

## 运行过的浏览器用例

```text
tests/browser/chat-five-capabilities.spec.mjs
tests/browser/chat-workspace.spec.mjs
tests/browser/companion-im.spec.mjs
tests/browser/personal-memory.spec.mjs
tests/browser/persona-editor.spec.mjs
tests/browser/credits.spec.mjs
tests/browser/familia-app.spec.mjs
```

截图位于 `.impeccable/review/companion-five/`：手机、桌面聊天；收藏；聊天内记忆确认。

## 证据边界

外部模型、ASR、视觉与 TTS 由本地模拟服务替代。测试验证实际认证、存储、计费、上传、浏览器录音和交互链路，不证明真实模型识别准确率、自然程度或百炼区域账号开通情况。演示 TTS 是测试音，不能用于判断真实音色。测试没有调用正式站、生产数据库、生产调度或收费模型。

用户已决定沿用百炼并稍后提供配置；真实素材、真实麦克风设备、真实音色及陪伴质量仍待接入后人工验收。完整步骤及环境变量见 `companion-five-acceptance.md`。
