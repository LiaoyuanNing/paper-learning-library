# Independent manifest consumer validation · v2

## Input boundary

- Consumer identity: Codex native sub-agent `/root/manifest_consumer_v2`.
- Prior involvement: none; spawned only after the evidence graph and digest were frozen.
- Only readable research input: `site/reports/agent-teams-2026/data/evidence-manifest.v2.json`.
- Prohibited and not read: report page, other research files, Git, Multica issue/comments, conversation history, paper originals, web/internet.
- Manifest version: `2.0.0`.
- Snapshot digest: `sha256:6b97d52f21e8cea60cf21c043da9d27fabdd41b90d446c556fdd57972cde857f`.
- Immutable input URL: `https://raw.githubusercontent.com/LiaoyuanNing/paper-learning-library/052010251582d8af6447357528250062a3aa1d31/site/reports/agent-teams-2026/data/evidence-manifest.v2.json`.
- Run date: 2026-07-15.
- Consumer did not modify files.

## Verbatim answers

### Q1 · Expert dilution

`2602.01011v4` 被列入 18 篇核心，是因为它是 ICML 2026 accepted paper，直接提供“专家稀释”的反证，用于重审“团队共识”和“规模增加”的正向结论。

- Source ID: `S21`
- Official URL: `https://arxiv.org/abs/2602.01011v4`
- Evidence ID: `E22`
- Locator: `§4.1 Table 1; §4.2 Table 2; §4.3; Appendix H`
- Answer: 即使团队被明确告知谁是专家，团队仍未匹配已识别的最佳个体；四类条件的报告差距为 6.3%–41.1%，最大差距是 41.1%。成员增加还可能通过共识压力稀释专家判断。
- Boundary: 来自受控协作/排序任务，不能直接等同于生产组织；manifest 同时注明，共识有时可能提升鲁棒性，但会牺牲最佳专家信号。

### Q2 · Equal thinking-token budget

不能说 MAS 普遍优于单智能体；manifest 的直接证据反而显示，在其研究范围内，强单智能体多数匹配或超过 MAS。

- Source ID: `S22`
- Official URL: `https://arxiv.org/abs/2604.02460v2`
- Evidence ID: `E23`
- Locator: `§4.4 Table 1; §5.1; §5.3 Figure 3; Appendix F Tables 3–10`
- Answer: 在三个模型家族、两个 multi-hop reasoning 数据集和相同 thinking-token 预算下，single-agent scaling 多数匹配或超过 MAS；MAS 的优势主要出现在单智能体上下文被人为退化时。
- Boundary: 证据集中于 multi-hop reasoning，不能外推为所有任务定律；持续行动、异构权限/工具、外部状态交互还需单独评测，并应额外配平工具、采样和环境交互预算。

### Q3 · Homogeneous workflow collapse

同一模型组成的多智能体 workflow 不必然需要多个运行中 Agent；manifest 给出了可由一个 Agent 顺序执行同质 workflow 的直接证据。

- Source ID: `S23`
- Official URL: `https://arxiv.org/abs/2601.12307v1`
- Evidence ID: `E24`
- Locator: `§4.2 Tables 1–2; §4.2.3 Table 3; §4.2.4 Table 4`
- Answer: OneFlow 让单智能体顺序执行同质 MAS workflow 的节点，可匹配或略优于原系统，并减少 KV-cache 与通信开销。
- Boundary: 不能外推到异构模型、不同权限、真实并行环境交互或独立信息源；这些情形不保证可以折叠为单个运行中 Agent。该来源在 manifest 中标为 preprint。

### Q4 · Negative answerability

`unknown`。manifest 没有提供“100 对 10、真实企业生产任务、其他条件配平”的直接实验，且明确指出真实组织的激励冲突、权限、安全和长期学习证据不足。

- Cutoff: `2026-07-15`
- Candidate count: 48
- Core count: 18
- `S09` / `E09` / `https://arxiv.org/abs/2406.07155v3` / `Abstract; §3–§5`: 可运行到千级节点，但不提供跨任务、等预算的普遍规模定律。
- `S16` / `E17` / `https://arxiv.org/abs/2512.08296v3` / `§4.2–§4.4; Figure 1; Table 2`: 260 个配置中效果从 +80.8% 到 -70.0%，方向取决于架构—任务匹配。
- `S21` / `E22` / `https://arxiv.org/abs/2602.01011v4` / `§4.1 Table 1; §4.2 Table 2; §4.3; Appendix H`: 更多成员可能加剧专家稀释，最大差距 41.1%。
- `S22` / `E23` / `https://arxiv.org/abs/2604.02460v2` / `§4.4 Table 1; §5.1; §5.3 Figure 3; Appendix F Tables 3–10`: 等 thinking-token 预算下，单智能体多数匹配或超过 MAS。
- `S23` / `E24` / `https://arxiv.org/abs/2601.12307v1` / `§4.2 Tables 1–2; §4.2.3 Table 3; §4.2.4 Table 4`: 同质 workflow 可被单智能体折叠。

Consumer closing statement: these answers consume the manifest's structured summaries, selection records and locators; they do not independently re-verify paper originals.

## PM-Paper manual review

Reviewer: PM-Paper. Review method: for each answer, resolve the cited evidence ID to source ID, compare official URL and locator against the manifest, then confirm that wording stays within source and claim limitations.

| Question | IDs/URL/locator resolve | Answer matches manifest | Boundary preserved | Result |
|---|---|---|---|---|
| Expert dilution | S21 → E22; exact URL and locator | 6.3%–41.1%, expert reveal and core reason present | Controlled-task/robustness trade-off retained | PASS |
| Matched budget | S22 → E23; exact URL and locator | Single-agent majority result and degraded-context exception present | Multi-hop scope and interaction-budget caveat retained | PASS |
| Workflow collapse | S23 → E24; exact URL and locator | OneFlow effect and KV/communication saving present | Heterogeneous/permission/parallel limits retained | PASS |
| Negative answerability | S09/S16/S21/S22/S23 all resolve | Correctly answered unknown; cutoff and 48/18 counts exact | No 100-vs-10 production extrapolation | PASS |

Overall: **4/4 PASS**. This proves manifest-only answerability for these four questions; it does not prove the underlying papers or the research corpus are error-free.
