# Independent evidence-snapshot consumer transcript · v2

## Input boundary

- Consumer identity: `/root/manifest_consumer_v2_release5`
- Prior involvement: none; this consumer did not participate in the research or earlier consumer trials.
- Sole input: `https://raw.githubusercontent.com/LiaoyuanNing/paper-learning-library/2aeb71cf4388a238e76a95ac6d6c715ab1c9dd3c/site/reports/agent-teams-2026/data/evidence-snapshot.v2.json`
- Manifest version: `2.0.0`
- Snapshot digest: `sha256:1cab26e51999310225fb08e05621ddfdbcad7ca3e478bc37181af0d614484a8c`
- Excluded inputs: release manifest, report, research notes, Git history, issue, conversation history, paper originals and internet.
- Requested output: answer the four questions below with source ID, official URL, evidence ID and locator; report unknowns; audit the promoted durable pointers and review contract.

## Questions given to the consumer

1. Why were `2602.01011v4` and `2604.07821v2` included in core? Give key counter-results/numbers for known expert + team consensus and capability + zero-cost collaboration.
2. Under equal thinking-token budgets, can we say MAS generally outperforms a single agent? Does a homogeneous workflow necessarily require multiple concurrently running agents? Give direct evidence and boundaries.
3. How do Silo-Bench and HiddenBench distinguish messages exchanged from distributed information correctly integrated? Give experimental scales, results and boundaries.
4. Do LatentMAS headline results prove learned alignment matrices and cross-agent transfer are generally necessary? At cutoff, can we assert 100 production agents are always stronger than 10? Give direct contradictions, 49-candidate/18-core counts and non-extrapolations. Also audit C01/C05/C09 durable knowledge IDs, issue pointers for syntactic resolvability, promotion/next-review dates and revalidation triggers; confirm C05 remains `conditional` and C08/C11 remain `not_eligible`.

## Consumer response (verbatim)

Canonical agent identity: `/root/manifest_consumer_v2_release5`

- Sole input URL: `https://raw.githubusercontent.com/LiaoyuanNing/paper-learning-library/2aeb71cf4388a238e76a95ac6d6c715ab1c9dd3c/site/reports/agent-teams-2026/data/evidence-snapshot.v2.json`
- `manifest_version`: `2.0.0`
- `snapshot_digest`: `sha256:1cab26e51999310225fb08e05621ddfdbcad7ca3e478bc37181af0d614484a8c`
- Digest check: PASS. Recomputing the canonical `evidence_payload` with the manifest’s stated key-sorting and omission rules produced exactly `sha256:1cab26e51999310225fb08e05621ddfdbcad7ca3e478bc37181af0d614484a8c`, matching the outer `snapshot_digest`.

### Q1 — Why the two papers entered core

- `2602.01011v4` was included because it is ICML 2026 direct counterevidence against “known expert + team consensus” and monotonic scale claims. Even when teams were explicitly told who the expert was, they failed to match the best individual across four conditions, with gaps of 6.3%–41.1%; adding members aggravated expert dilution through consensus pressure. Source `S21`, official URL `https://arxiv.org/abs/2602.01011v4`, evidence `E22`, locator `§4.1 Table 1; §4.2 Table 2; §4.3; Appendix H`.
- `2604.07821v2` was included because it is an ICML 2026 main-conference result directly separating individual capability from zero-cost cooperation and testing protocol/incentive interventions. o3 achieved only 17% of optimal collective performance, versus 50% for o3-mini; explicit protocols doubled performance for some less-capable models, and micro-incentives improved weak cooperators. Source `S24`, official URL `https://arxiv.org/abs/2604.07821v2`, evidence `E25`, locator `Abstract; §4–§6; Table 3`.
- Boundary: controlled consensus/collaboration tasks do not establish behavior in long-running production tool workflows, and the interventions are not universal cooperation solutions.

### Q2 — Equal-budget MAS and homogeneous workflows

- No, the manifest does not support saying MAS generally outperforms a single agent under equal thinking-token budgets. Across three model families, two multi-hop datasets, and matched thinking-token budgets, single-agent scaling usually matched or exceeded MAS; MAS advantages mainly appeared when the single agent’s context was deliberately degraded. Source `S22`, official URL `https://arxiv.org/abs/2604.02460v2`, evidence `E23`, locator `§4.4 Table 1; §5.1; §5.3 Figure 3; Appendix F Tables 3–10`.
- A homogeneous workflow does not necessarily require multiple concurrently running agents. OneFlow sequentially replayed homogeneous MAS workflow nodes with one agent and KV-cache reuse, matching or slightly exceeding the original systems while reducing cache and communication overhead. Source `S23`, official URL `https://arxiv.org/abs/2601.12307v1`, evidence `E24`, locator `§4.2 Tables 1–2; §4.2.3 Table 3; §4.2.4 Table 4`.
- Boundaries: the equal-budget evidence concerns multi-hop reasoning, not persistent action, heterogeneous permissions, or external state. OneFlow’s result is confined to homogeneous workflows; heterogeneous models, independent information sources, and genuinely parallel environment interaction may still require multiple agents.

### Q3 — Messages exchanged versus information integrated

- Silo-Bench distributes private information into agent silos and varies team size and communication protocol, then separately diagnoses whether communication occurred and whether the communicated information produced correct joint reasoning—the Communication–Reasoning Gap. It used 30 tasks, 6 team sizes × 3 protocols × 3 models = 54 configurations and 1,620 experiments. Its major failures were Premature Submission 37.2%, Consensus Failure 29.9%, and Computation Error 28.6%. Source `S25`, official URL `https://arxiv.org/abs/2603.01045v2`, evidence `E26`, locator `§3–§5; §5.2 Table 4; Figures 4–6`.
- HiddenBench distributes required hidden-profile facts across agents and compares that team with a single agent given all information. Across 65 tasks and 15 models, distributed MAS accuracy was 30.1% versus 80.7% for the full-information single agent; larger models did not reliably remove the integration failure. Source `S26`, official URL `https://arxiv.org/abs/2505.11556v4`, evidence `E27`, locator `Abstract; §3; §4.2; Tables 1–2; §5`.
- Boundaries: both are controlled benchmarks. Silo-Bench does not cover the richer permissions, latency, and asynchronous failures of production systems; HiddenBench’s 65 tasks do not represent all long-term collaboration, and its task structure differs from Silo-Bench.

### Q4 — LatentMAS necessity, scale and selection boundaries

- No. LatentMAS’s headline results—up to +14.6 accuracy, 70.8%–83.7% fewer output tokens, and roughly 4× speed—show task-level performance, not that learned alignment matrices or cross-agent transfer are generally necessary. Source `S15`, official URL `https://arxiv.org/abs/2511.20639v3`, evidence `E16`, locator `§4.1 Table 1; Appendix D Tables 3–5`.
- Direct contradiction: a follow-up found no significant degradation with an identity matrix; removing cross-agent transfer was equal or better on some tasks, and text communication beat latent communication on code tasks. Source `S27`, official URL `https://openreview.net/forum?id=manXhfpRH3`, evidence `E28`, locator `§4.1 Table 1; §4.2–§4.3; Appendix C`.
- The exact proposition “100 production agents are always stronger than 10” is unknown: the manifest contains no exact 100-versus-10 production comparison. It cannot be asserted. Direct evidence also contradicts a general monotonic scale law:
  - Two diverse agents matched or exceeded 16 homogeneous agents. Source `S17`, official URL `https://arxiv.org/abs/2602.03794v1`, evidence `E18`, locator `§4.1–§4.3; Figures 2–4; Tables 1–2`.
  - More members worsened known-expert dilution. Source `S21`, official URL `https://arxiv.org/abs/2602.01011v4`, evidence `E22`, locator `§4.1 Table 1; §4.2 Table 2; §4.3; Appendix H`.
  - Thousand-node operation demonstrates scalability, not a cross-task, equal-budget performance law. Source `S09`, official URL `https://arxiv.org/abs/2406.07155v3`, evidence `E09`, locator `Abstract; §3–§5`.
- Manifest-level selection counts: 49 candidates and 18 core papers (`selection_protocol.candidate_count/core_count`); these are curation metadata, so no scholarly source/evidence ID applies. They do not justify extrapolation to all papers, post-cutoff revisions, real organizations, production-scale teams, or a universal agent-count law.

### Pointer and promotion audit

| Claim | Durable ID | Pointer audit | Reviewed / next review | Revalidation triggers |
|---|---|---|---|---|
| C01 | `AGE-185` | `mention://issue/c807b74e-b65f-4424-b2b9-38ada71b0aad` — valid URI/UUID syntax and UUID matches `issue_uuid` | 2026-07-15 / 2026-10-15 | Manifest superseded/retracted; same-budget cross-task counterevidence; application to production continuous-action workflow |
| C05 | `AGE-186` | `mention://issue/5e7a4332-0f1d-4e0c-831d-e6ed7431395f` — valid URI/UUID syntax and UUID matches `issue_uuid` | 2026-07-15 / 2026-10-15 | Budget definition or baseline changes; cross-task matched-budget counterevidence; persistent-action evaluation |
| C09 | `AGE-187` | `mention://issue/f0a25456-ddd4-46c1-9ae7-94e6ed43fbd4` — valid URI/UUID syntax and UUID matches `issue_uuid` | 2026-07-15 / 2026-10-15 | Better workflow evaluation method; material trace/cost availability change; later manifest revision |

This is a syntax/internal-consistency audit only; live issue existence or permissions are unknown under the one-file boundary. C05 remains `conditional`. C08 and C11 remain `not_eligible`.

Self-assessment: Q1 PASS · Q2 PASS · Q3 PASS · Q4 PASS · pointer audit PASS.

### Consumer Q3 addendum (same sole-input boundary)

S26 v4 title is “Systematic Failures in Collective Reasoning under Distributed Information in Multi-Agent LLMs.” Distributed MAS accuracy was 30.1%, versus 80.7% accuracy for the full-information single agent. Source `S26`; official URL `https://arxiv.org/abs/2505.11556v4`; evidence `E27`; locator `Abstract; §3; §4.2; Tables 1–2; §5`.

## PM manual review

- Result: 4/4 PASS; durable pointer audit PASS.
- Method: resolved every cited evidence ID to its source ID, official URL and stable locator inside the same immutable snapshot; checked titles, metrics, failure semantics, selection counts, unknowns and scope boundaries.
- Platform pointer check: Multica issue reads independently confirmed AGE-185/C01, AGE-186/C05 and AGE-187/C09 resolve to the listed UUIDs and link back to AGE-174. No long-term knowledge prose or atomic paper evidence is duplicated in this package.
