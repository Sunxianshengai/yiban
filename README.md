# Journey Replica (Web)

本仓库现在承载 **Journey Desktop 6.0.1 独立复刻** 的 Web 版（Nuxt 4 + Dexie），取代原忆伴 Web 源码（2026-11-09 经仓库所有者授权替换；旧忆伴代码保留在 git 历史，tag/commit `2625f27` 及之前）。

开发主目录：`C:/Users/25641/Desktop/journey-replica`（证据、交接、进度文档在那里）。

## 运行

```bash
npm install
npm run dev     # 开发
npm run build   # 生产构建（Vercel 自动执行）
```

## 桌宠（瞌睡小羊）

网页 `/pet` 是一个只留小羊的透明页；`electron/` 是把它变成桌面挂件的壳（透明置顶窗口、空白处鼠标穿透、托盘）。

```bash
npm run desktop        # 生产站 https://yiban-memory.eu.cc
npm run desktop:dev    # 连本机 dev server（需先 npm run dev，端口 4321）
```

- 托盘：打开日记 / 显示桌宠 / 隐藏桌宠 / 退出
- 点小羊 → 说今天记了几笔；双击 → 打开日记；右键 → 写一句、全部同步等
- `Esc` 立即隐藏桌宠（安全阀）；`Ctrl+Shift+Q` 退出
- 站点地址与 IP 钉在 `electron/desktop-config.json`（`resolveIp` 用于绕开本机 DNS 污染，不需要改 hosts）
- 受限环境下 Chromium 沙箱起不来，`launch.cjs` 默认加 `--no-sandbox`；正常桌面可用 `node electron/launch.cjs --sandbox` 打开沙箱

## 数据与设计来源

- 数据层：Dexie `JourneyDB` v1，表结构逐字镜像原版（`evidence/derived/dexie-schema.json`），IndexedDB 本地持久化
- 主题：Material-3 token 提取自原版 bundle（主色 `#00687B`，见 `evidence/derived/theme-tokens.json`）
- 字体：原版为商业字体（Gotham Rounded/Verlag），公开部署使用系统字体栈
- 图标：@mdi/js（Apache-2.0）

## 已实现（里程碑 1）

Timeline + Stories 卡片 + 条目编辑器（富文本基础）+ 详情面板 + 收藏（Search Results 式）+ 复制 + 回收站软删除 + IndexedDB 重启持久化。已通过浏览器端到端验证。

## 未实现

云同步、地图、AI、会员、导入导出等服务端依赖功能 —— 逐项见 `journey-replica/docs/feature-matrix.csv`，不以假成功交差。
