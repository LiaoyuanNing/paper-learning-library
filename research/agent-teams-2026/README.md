# Agent Team research episode 001

AGE-174 的可复用研究资产。v2 review candidate 由 `site/reports/agent-teams-2026/data/evidence-manifest.v2.json` 单一数据源驱动；本目录保留检索、筛选、元数据核对、独立消费验收与变更记录，不保存论文全文。公开 Pages 在 Master 放行前仍是 v1。

## 研究闭环

1. 明确知识缺口与截止日，先写可回答问题。
2. 用 `queries.md` 的机制路径检索，在 `candidate-ledger.md` 记录纳入/排除理由。
3. Reader 按研究问题、机制、实验、结果、限制、locator 提取；不要直接把摘要当结论。
4. Synthesizer 只创建能闭合到 evidence/source ID 的主张。
5. Critic 搜索相反结果、预算不等、oracle baseline、样本过小、版本漂移和外推越界。
6. 未参与研究的另一 agent 只读 v2 manifest 回答 `manifest-consumer-questions.v2.md`；结果写入 `manifest-consumer-validation.v2.md`，PM 再逐题人工复核。
7. 只有通过来源闭包、构建、移动端、控制台和线上验证，才发布 immutable tag。
8. 只有跨任务复用、经 Librarian 去重的结论才有资格晋升长期知识；本包中的 `candidate` 不是 `promoted`。

## 更新策略

- 语义版本：修正文案但不改变结论为 patch；新增兼容字段/论文为 minor；改变 claim/evidence 语义为 major。
- 每个版本冻结 `knowledge_cutoff`、arXiv 版本、发表状态与 immutable raw URL。
- v2 `snapshot_digest` 按 manifest 声明的 `digest_method` 计算；排除自引用字段与 `stable_url`，使后者能固定到首个 immutable commit SHA，格式化差异不改变摘要。
- `metadata-audit.v2.json` 逐 source 记录 title/authors/version/year/status/venue URL 核对快照；自动测试要求与 manifest 一致。
- 新版不可覆盖旧 tag；通过 `supersedes` 和 `CHANGELOG.md` 建立链路。

## 版权边界

仅保存元数据、必要短证据定位、忠实摘要和综合判断。正文、图表与大段原文留在 arXiv 或正式 proceedings。
