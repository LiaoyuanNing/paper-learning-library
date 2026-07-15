# Changelog

## 2.0.0 — 2026-07-15

- 重开最新/典型召回：核心集由 9+9 调整为 8 篇奠基/典型 + 10 篇前沿；纳入 `2602.01011v4`、`2604.02460v2`、`2601.12307v1`，MacNet、MasRouter、ExtAgents 退出核心但保留扩展记录。
- 第二次窄召回纳入 ICML 2026 `2604.07821v2` 与 ACL 2026 `2603.01045v2` 核心证据；Diversity、FS-Researcher 转为扩展；HiddenBench `2505.11556v4` 进入候选、source/evidence/claim 链。
- 第三轮窄修复按 `2505.11556v4` 当前版本更新标题与 accuracy 语义，并把 SILO-BENCH 的实验轴及 Table 4 三类失败锁定为可测试字段。
- 加入 CompLearn 2026 对 LatentMAS 的直接反证；C11 与 LatentMAS 卡片收窄。MAST E14 改为 bundled role/prompt intervention，C02/R02/R05 不再把 +9.4pp 归因于终止权单项；C04 删除未经必要条件实验支持的“只在”。
- C03/C04/C05 与建议重写，显式覆盖专家稀释、同质 workflow 可折叠、equal-thinking-token 三个边界；C05 从 strong 降为 conditional。
- schema contract 修为 SemVer `1.0.0`；manifest major 升为 `2.0.0`，拆分 submission/venue year、publication status、venue、track，并增加 v1 `supersedes` 指针。
- 全量核对 S01–S27 一手元数据，含 arXiv、正式 venue 与 OpenReview；记录见 `metadata-audit.v2.json`。
- C01–C11 每条增加完整 `counter_search`；E16–E21 改为固定节/表/图/附录 locator。
- machine-readable `papers` 扩展为 49 条候选/决策记录；未入核心项也保留 version/status/URL/reasons。
- 修正 v1 supersedes digest，撤销伪精确未来时间；拆分 commit-pinned evidence snapshot 与独立 consumer attestation，输出链接全部绝对化。
- Librarian 完成 C01→AGE-185、C05→AGE-186、C09→AGE-187 晋升并回写 durable pointer、复核日期与触发条件；C08/C11 保持 `not_eligible`，C05 保持 `conditional`。

## 1.0.0 — 2026-07-15

- 冻结 37 篇候选与 18 篇核心集合。
- 发布 claim → evidence → source 闭合 manifest、中文报告与 8 条 Multica 建议。
- 纳入 Critic 对版本漂移、oracle baseline、预算不等、错误共识、规模饱和和外推风险的校准。
- 增加 manifest-only 独立 agent 消费验收与 immutable tag 策略。
