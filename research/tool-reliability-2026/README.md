# Tool reliability research episode 002

AGE-396 的可复用研究资产。页面由唯一 `evidence-manifest.v1.json` 渲染；快照、逐篇 metadata audit、curated set 记录、查询、Critic、blind-consumer 协议与 browser QA 均在本目录。只保存元数据、短定位与综合判断，不保存论文正文或 PDF。

`age-396-v1` 目前是 PR #6 上的 mutable candidate，不是 immutable release；不得以 stable URL、tag 或已完成 consumer 测试宣称发布。它包含指向 `age-174-v2` 的 pinned predecessor（artifact identity、commit 和 digest），但不修改其 payload、tag 或 digest。

## Blind-consumer protocol（仅 post-tag 后执行）

1. 向一位未参与本 episode 的 consumer 只提供 tagged fixed snapshot，并先记录 `prior_involvement: none`。
2. Consumer 独立回答 Q1–Q3；每题必须提交 manifest 中的 evidence/source/claim（Q3 另含 predecessor）引用。
3. Reviewer 逐条检查 citation 是否能解析、source 是否匹配、claim 是否由所引 evidence 支撑，并记录通过或失败。

本候选没有 blind-consumer 运行结果，也不预设 PASS。
