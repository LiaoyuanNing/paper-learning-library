# Independent manifest consumer validation · v2

## Input boundary

- Consumer identity: Codex native sub-agent `/root/manifest_consumer_v2_final`.
- Prior involvement: none; spawned only after the evidence graph, digest, and immutable evidence snapshot were frozen.
- Only readable research input: `site/reports/agent-teams-2026/data/evidence-manifest.v2.json`.
- Prohibited and not read: report page, other research files, Git, Multica issue/comments, conversation history, paper originals, web/internet.
- Manifest version: `2.0.0`.
- Snapshot digest: `sha256:118f88a9b4151ec49c76b77189da8cddc388aeb891d583c9cb897dccdec992ec`.
- Immutable input URL: `https://raw.githubusercontent.com/LiaoyuanNing/paper-learning-library/f6ee325dd1100c30de818429ce016e6e43536403/site/reports/agent-teams-2026/data/evidence-manifest.v2.json`.
- Run date: 2026-07-15.
- Consumer did not modify files.

## Verbatim consumer answers

### Q1 · Expert dilution

- 来源 ID：`S21`
- 证据 ID：`E22`
- 官方 URL：https://arxiv.org/abs/2602.01011v4
- 证据定位：`§4.1 Table 1; §4.2 Table 2; §4.3; Appendix H`
- 结论：入选原因是“ICML 2026”“直接揭示专家稀释”“重审共识与规模结论所需反证”。即使明确告知团队谁是专家，团队仍未匹配最佳个体；报告差距为 `6.3%–41.1%`，精确最大差距为 `41.1%`。
- 边界：实验是四类受控协作/排序任务及多种模型、团队构成，不等同于生产组织。共识有时可提高鲁棒性，但可能牺牲最佳专家信号，不能外推为所有团队讨论必然有害。

### Q2 · Equal thinking-token budget

- 来源 ID：`S22`
- 证据 ID：`E23`
- 官方 URL：https://arxiv.org/abs/2604.02460v2
- 证据定位：`§4.4 Table 1; §5.1; §5.3 Figure 3; Appendix F Tables 3–10`
- 结论：不。在该直接配平实验中，single-agent scaling 在大多数条件下匹配或超过 MAS。
- 边界：证据覆盖三个模型家族、两个 multi-hop reasoning 数据集和多个预算点；MAS 优势主要出现在单 agent 上下文被人为退化时。它不覆盖持续行动、异构权限或外部状态任务，因此不是跨任务普遍定律。

### Q3 · Homogeneous workflow collapse

- 来源 ID：`S23`
- 证据 ID：`E24`
- 官方 URL：https://arxiv.org/abs/2601.12307v1
- 证据定位：`§4.2 Tables 1–2; §4.2.3 Table 3; §4.2.4 Table 4`
- 结论：不必须。OneFlow 让单 agent 顺序执行同质 MAS workflow 节点，可匹配或略优于原系统，并减少 KV-cache 与通信开销。
- 边界：结论只针对同质 workflow。异构模型、不同权限、独立信息源或真实并行环境交互不保证可折叠，这些场景仍可能需要多 agent 或并发执行。

### Q4 · Negative answerability

- 结论：`unknown`
- `S16` / `E17` / https://arxiv.org/abs/2512.08296v3 / `§4.2–§4.4; Figure 1; Table 2`
- `S17` / `E18` / https://arxiv.org/abs/2602.03794v1 / `§4.1–§4.3; Figures 2–4; Tables 1–2`
- `S21` / `E22` / https://arxiv.org/abs/2602.01011v4 / `§4.1 Table 1; §4.2 Table 2; §4.3; Appendix H`
- 边界：manifest 没有真实企业生产任务上的 `100 vs 10` 直接实验。现有证据仅显示受控 benchmark 中收益可从 `+80.8%` 到 `-70.0%`、2 个多样化 agent 可匹配或超过 16 个同质 agent，以及扩员可能稀释专家判断；这些结果既不支持单调规模律，也不足以直接判定 100 对 10 的生产效果。

Consumer closing statement: the answers used only the specified local manifest; the consumer did not read Git, issue/comments, report, other research files, paper originals, conversation history, or the internet.

## PM-Paper manual review

Reviewer: PM-Paper. Review method: for each answer, resolve the cited evidence ID to source ID, compare official URL and locator against the manifest, then confirm that wording stays within source and claim limitations.

| Question | IDs/URL/locator resolve | Answer matches manifest | Boundary preserved | Result |
|---|---|---|---|---|
| Expert dilution | S21 → E22; exact URL and locator | 6.3%–41.1%, expert reveal and core reason present | Controlled-task/robustness trade-off retained | PASS |
| Matched budget | S22 → E23; exact URL and locator | Single-agent majority result and degraded-context exception present | Multi-hop scope and interaction-budget caveat retained | PASS |
| Workflow collapse | S23 → E24; exact URL and locator | OneFlow effect and KV/communication saving present | Heterogeneous/permission/parallel limits retained | PASS |
| Negative answerability | S16/S17/S21 all resolve | Correctly answered unknown; no unsupported production conclusion | No 100-vs-10 production extrapolation | PASS |

Overall: **4/4 PASS**. This proves manifest-only answerability for these four questions; it does not prove the underlying papers or the research corpus are error-free.
