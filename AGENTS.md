# Agent notes — Journey Replica Web

本仓库是 Journey Desktop 6.0.1 独立复刻的 Web 版（Nuxt 4）。开发与证据主目录在 `C:/Users/25641/Desktop/journey-replica`（不在本仓库内）。

写代码前：
- 数据层结构与主题 token 必须以 `journey-replica/evidence/derived/` 的提取结果为准，不要凭训练数据猜 Journey 的行为。
- 每个功能改动要对照 `journey-replica/docs/feature-matrix.csv` 登记。
- 交付前用真实浏览器验证（创建→编辑→保存→刷新持久化→删除），不用 mock 代替存储链路。

注意：仓库 `public/` 下有所有者保留的未跟踪历史资产（design-preview、perf-*），不要删除或提交它们之外再改动。
