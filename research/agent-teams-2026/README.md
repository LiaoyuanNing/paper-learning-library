# Agent Team research episode 001

AGE-174 的可复用研究资产。正式报告由 `site/reports/agent-teams-2026/data/evidence-manifest.v1.json` 单一数据源驱动；本目录保留检索、筛选、独立消费验收与变更记录，不保存论文全文。

## 研究闭环

1. 明确知识缺口与截止日，先写可回答问题。
2. 用 `queries.md` 的机制路径检索，在 `candidate-ledger.md` 记录纳入/排除理由。
3. Reader 按研究问题、机制、实验、结果、限制、locator 提取；不要直接把摘要当结论。
4. Synthesizer 只创建能闭合到 evidence/source ID 的主张。
5. Critic 搜索相反结果、预算不等、oracle baseline、样本过小、版本漂移和外推越界。
6. 另一 agent 只读 manifest 回答 `manifest-consumer-questions.md`；结果写入 `manifest-consumer-validation.md`。
7. 只有通过来源闭包、构建、移动端、控制台和线上验证，才发布 immutable tag。
8. 只有跨任务复用、经 Librarian 去重的结论才有资格晋升长期知识；本包中的 `candidate` 不是 `promoted`。

## 更新策略

- 语义版本：修正文案但不改变结论为 patch；新增兼容字段/论文为 minor；改变 claim/evidence 语义为 major。
- 每个版本冻结 `knowledge_cutoff`、arXiv 版本、发表状态与 immutable raw URL。
- `snapshot_digest` 为移除该字段后，对递归键排序 JSON 计算 SHA-256；格式化差异不改变摘要。
- 新版不可覆盖旧 tag；通过 `supersedes` 和 `CHANGELOG.md` 建立链路。

## 版权边界

仅保存元数据、必要短证据定位、忠实摘要和综合判断。正文、图表与大段原文留在 arXiv 或正式 proceedings。
