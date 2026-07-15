# Changelog

## 2.0.0 — 2026-07-15 (review candidate, not deployed)

- 重开最新/典型召回：核心集由 9+9 调整为 8 篇奠基/典型 + 10 篇前沿；纳入 `2602.01011v4`、`2604.02460v2`、`2601.12307v1`，MacNet、MasRouter、ExtAgents 退出核心但保留扩展记录。
- C03/C04/C05 与建议重写，显式覆盖专家稀释、同质 workflow 可折叠、equal-thinking-token 三个边界；C05 从 strong 降为 conditional。
- schema contract 修为 SemVer `1.0.0`；manifest major 升为 `2.0.0`，拆分 submission/venue year、publication status、venue、track，并增加 v1 `supersedes` 指针。
- 全量核对 S01–S23 一手元数据，修正 MetaGPT、AutoGen、More Agents、MacNet、MAST、ExtAgents、AgentVerse 等误差；记录见 `metadata-audit.v2.json`。
- C01–C11 每条增加完整 `counter_search`；E16–E21 改为固定节/表/图/附录 locator。
- machine-readable `papers` 扩展为 48 条候选/决策记录；未入核心项也保留 version/status/URL/reasons。
- v2 的 immutable commit URL、独立 manifest consumer transcript 和最终 QA 将在本 review candidate 的后续提交中补齐；Master 放行前不 merge/tag/deploy。

## 1.0.0 — 2026-07-15

- 冻结 37 篇候选与 18 篇核心集合。
- 发布 claim → evidence → source 闭合 manifest、中文报告与 8 条 Multica 建议。
- 纳入 Critic 对版本漂移、oracle baseline、预算不等、错误共识、规模饱和和外推风险的校准。
- 增加 manifest-only 独立 agent 消费验收与 immutable tag 策略。
