# Independent evidence-snapshot consumer transcript · v2 candidate

## Attested input boundary

- Consumer identity: `/root/manifest_consumer_v2_candidate4`
- Prior research involvement: none
- Manifest version: `2.0.0`
- Snapshot digest: `sha256:71e586bf10fdd6cdf7b59c1a71cb8c358c31275e187dad17050c8eb04ea5cb8d`
- Immutable input URL: `https://raw.githubusercontent.com/LiaoyuanNing/paper-learning-library/62c2d1b4c2e0736456a8d02fbe16b55fb60ea429/site/reports/agent-teams-2026/data/evidence-snapshot.v2.json`
- Allowed input: only the named local copy of that immutable snapshot; substantive answers use only `evidence_payload`.
- Forbidden inputs: release manifest, report, research notes, Git, issue/comments, conversation history, paper originals and internet.
- Trial status: candidate-only; rerun after Librarian promotion before final digest/release.

## Verbatim consumer response

### INPUT BOUNDARY

Sole input:
paper-learning-library/site/reports/agent-teams-2026/data/evidence-snapshot.v2.json

Snapshot identity:
manifest_version: 2.0.0
snapshot_digest: sha256:71e586bf10fdd6cdf7b59c1a71cb8c358c31275e187dad17050c8eb04ea5cb8d
immutable input URL: https://raw.githubusercontent.com/LiaoyuanNing/paper-learning-library/62c2d1b4c2e0736456a8d02fbe16b55fb60ea429/site/reports/agent-teams-2026/data/evidence-snapshot.v2.json

The version and digest above identify the snapshot only. All substantive answers below derive solely from evidence_payload.

### Q1

2602.01011v4 is core because it is direct ICML 2026 counterevidence to the assumption that a team preserves a known expert’s superior judgment. It compares no-expert, implicit-expert, explicitly revealed-expert, and identified-best-individual conditions across four collaboration/ranking task classes and varying team compositions. Even when the expert was explicitly revealed, the team did not match the best individual: gaps ranged from 6.3% to 41.1%, and adding members intensified consensus-driven expert dilution. [Source ID: S21 | official URL: https://arxiv.org/abs/2602.01011v4 | Evidence ID: E22 | locator: §4.1 Table 1; §4.2 Table 2; §4.3; Appendix H]

This does not establish that consensus is always harmful. The evidence_payload says consensus can sometimes improve robustness, but may trade away the strongest expert signal. Its tasks are controlled experiments, not production organizations, so production authority design and long-horizon external validity remain unknown. [Source ID: S21 | official URL: https://arxiv.org/abs/2602.01011v4 | Evidence ID: E22 | locator: §4.1 Table 1; §4.2 Table 2; §4.3; Appendix H]

2604.07821v2 is core because it directly separates individual capability from zero-cost cooperation and includes protocol and incentive interventions. Capability did not predict cooperation: o3 reached only 17% of optimal collective performance, versus 50% for o3-mini. Explicit protocols doubled performance for some lower-capability models, while micro-incentives improved weakly cooperative models. [Source ID: S24 | official URL: https://arxiv.org/abs/2604.07821v2 | Evidence ID: E25 | locator: Abstract; §4–§6; Table 3]

The boundary is important: these are zero-cost collaboration games, not long-running tool workflows. The protocol and micro-incentive effects therefore do not establish a universal cooperation remedy. [Source ID: S24 | official URL: https://arxiv.org/abs/2604.07821v2 | Evidence ID: E25 | locator: Abstract; §4–§6; Table 3]

Together, the two core papers counter two simple assumptions: known expertise plus consensus does not guarantee preservation of the expert answer, and stronger individual capability does not guarantee stronger unpriced cooperation.

### Q2

No. Under equal thinking-token budgets, the evidence does not support saying that MAS universally outperforms a single agent. Across three model families, two multi-hop reasoning datasets, multiple budget points, and information-degradation conditions, single-agent scaling matched or exceeded MAS in most matched-budget conditions. MAS showed a bounded advantage mainly when the single agent’s context was artificially degraded. [Source ID: S22 | official URL: https://arxiv.org/abs/2604.02460v2 | Evidence ID: E23 | locator: §4.4 Table 1; §5.1; §5.3 Figure 3; Appendix F Tables 3–10]

That result is not a universal claim that single agents always win either. It is concentrated on multi-hop reasoning and does not replace evaluation of persistent action, heterogeneous permissions, external state, or environment-interaction budgets. [Source ID: S22 | official URL: https://arxiv.org/abs/2604.02460v2 | Evidence ID: E23 | locator: §4.4 Table 1; §5.1; §5.3 Figure 3; Appendix F Tables 3–10]

A homogeneous workflow also does not necessarily require multiple concurrently running agents. OneFlow replayed homogeneous MAS workflow nodes sequentially through one agent, reused KV cache, matched or slightly exceeded the original systems, and reduced communication/KV-cache overhead. [Source ID: S23 | official URL: https://arxiv.org/abs/2601.12307v1 | Evidence ID: E24 | locator: §4.2 Tables 1–2; §4.2.3 Table 3; §4.2.4 Table 4]

The foldability boundary is explicit: heterogeneous models and genuinely parallel interactions are not guaranteed to collapse. Distinct permissions, independent information sources, or concurrent environment actions may still require multiple running agents; whether they do in any particular production workflow is unknown from this evidence. [Source ID: S23 | official URL: https://arxiv.org/abs/2601.12307v1 | Evidence ID: E24 | locator: §4.2 Tables 1–2; §4.2.3 Table 3; §4.2.4 Table 4]

### Q3

Silo-Bench tests whether agents can transform siloed private information into correct joint reasoning, explicitly separating message availability from successful reasoning over those messages. Its exact scale is 30 tasks across 6 team sizes × 3 communication protocols × 3 models, yielding 54 configurations and 1,620 experiments. [Source ID: S25 | official URL: https://arxiv.org/abs/2603.01045v2 | Evidence ID: E26 | locator: §3–§5; §5.2 Table 4; Figures 4–6]

Its reported diagnostic is the Communication–Reasoning Gap plus a failure decomposition, not the 30.1%/80.7% accuracy comparison below. The principal failure labels and shares are Premature Submission, 37.2%; Consensus Failure, 29.9%; and Computation Error, 28.6%. Consensus Failure means multiple agents submitted different answers and did not synchronize; it does not mean that the agents reached a shared but wrong consensus. [Source ID: S25 | official URL: https://arxiv.org/abs/2603.01045v2 | Evidence ID: E26 | locator: §3–§5; §5.2 Table 4; Figures 4–6]

The manifest does not provide an aggregate Silo-Bench accuracy or task-completion percentage, so either value is unknown. Its controlled environment also does not capture all production permission, latency, and asynchronous-failure behavior. [Source ID: S25 | official URL: https://arxiv.org/abs/2603.01045v2 | Evidence ID: E26 | locator: §3–§5; §5.2 Table 4; Figures 4–6]

The exact v4 official title of 2505.11556v4 is “Systematic Failures in Collective Reasoning under Distributed Information in Multi-Agent LLMs.” Its HiddenBench setup contains 65 hidden-profile tasks and 15 models, comparing a distributed MAS whose necessary information is split among agents against a single agent given the complete information. [Source ID: S26 | official URL: https://arxiv.org/abs/2505.11556v4 | Evidence ID: E27 | locator: Abstract; §3; §4.2; Tables 1–2; §5]

Here the reported result terminology is accuracy, not completion: distributed MAS accuracy was 30.1%, while full-information single-agent accuracy was 80.7%. Increasing model scale did not reliably remove the integration failure. [Source ID: S26 | official URL: https://arxiv.org/abs/2505.11556v4 | Evidence ID: E27 | locator: Abstract; §3; §4.2; Tables 1–2; §5]

Thus, Silo-Bench diagnoses where coordination fails after communication, while HiddenBench quantifies the outcome gap between distributed and centrally complete information. They cross-check the same broad distinction—information exchange is not correct integration—but use different task structures and metrics. HiddenBench’s 65 controlled tasks do not represent all long-horizon collaboration, and the manifest establishes no additional experiment axes beyond those listed above. [Source ID: S26 | official URL: https://arxiv.org/abs/2505.11556v4 | Evidence ID: E27 | locator: Abstract; §3; §4.2; Tables 1–2; §5]

### Q4

No. LatentMAS headline results do not prove that learned alignment matrices or cross-agent transfer are universally necessary. The original work reported, over nine benchmarks, up to +14.6 accuracy, a 70.8%–83.7% reduction in output tokens, and roughly 4–4.3× speed. Those are system-level headline results, not necessity tests for every internal component. [Source ID: S15 | official URL: https://arxiv.org/abs/2511.20639v3 | Evidence ID: E16 | locator: §4.1 Table 1; Appendix D Tables 3–5]

Direct counterevidence found no significant degradation from replacing the learned alignment matrix with an identity matrix. On some tasks, removing cross-agent transfer was equivalent or better, and on code tasks textual communication outperformed latent communication. Universal necessity is therefore contradicted directly. [Source ID: S27 | official URL: https://openreview.net/forum?id=manXhfpRH3 | Evidence ID: E28 | locator: §4.1 Table 1; §4.2–§4.3; Appendix C]

At the 2026-07-15 cutoff, the evidence also does not support claiming that 100 production agents are necessarily stronger than 10. A system operating at thousand-node scale establishes scalability, not an equal-budget, cross-task performance law. [Source ID: S09 | official URL: https://arxiv.org/abs/2406.07155v3 | Evidence ID: E09 | locator: Abstract; §3–§5]

Across 260 configurations, six agentic benchmarks, and three LLM families, MAS effects relative to single-agent systems ranged from +80.8% to -70.0%, showing that architecture-task alignment can reverse the direction of benefit. [Source ID: S16 | official URL: https://arxiv.org/abs/2512.08296v3 | Evidence ID: E17 | locator: §4.2–§4.4; Figure 1; Table 2]

Additional counterevidence shows that two diverse agents could match or exceed sixteen homogeneous agents, although that result comes from a workshop paper and its diversity measure is not yet established as a production-online metric. [Source ID: S17 | official URL: https://arxiv.org/abs/2602.03794v1 | Evidence ID: E18 | locator: §4.1–§4.3; Figures 2–4; Tables 1–2]

Larger teams can also worsen explicitly identified expert dilution rather than strengthen performance. [Source ID: S21 | official URL: https://arxiv.org/abs/2602.01011v4 | Evidence ID: E22 | locator: §4.1 Table 1; §4.2 Table 2; §4.3; Appendix H]

The evidence_payload’s curation ledger contains 49 candidate papers and 18 core papers, specifically 8 foundation/typical and 10 frontier papers. These are literature-selection counts, not evidence that any particular production agent count is optimal.

Unknown and non-extrapolable at the cutoff: there is no direct 10-versus-100 production-agent comparison in this snapshot; no established monotonic production scaling law; and no supported universal answer for long-horizon work with permissions, asynchronous external actions, correlated failures, latency, auditability, interoperability, safety, or full lifecycle cost. Those propositions remain unknown.

### COMPLIANCE STATEMENT

I read only the specified local manifest. I did not inspect any other file, Git history, issue/comment, conversation, report, research note, paper original, or internet source. I used the top-level manifest_version and snapshot_digest only to identify the snapshot. Every substantive research claim came from evidence_payload and includes its source ID, official URL, evidence ID, and locator. Unsupported propositions were marked unknown. No files were edited.

## PM manual review

`4/4 PASS`. PM-Paper resolved every cited evidence ID to its source ID, official URL and stable locator in the immutable snapshot. The review specifically confirmed the v4 title `Systematic Failures in Collective Reasoning under Distributed Information in Multi-Agent LLMs`, accuracy rather than completion for 30.1%/80.7%, the 6 × 3 × 3 SILO-BENCH axes, and the exact Table 4 labels and shares. The machine-readable review is `consumer-attestation.v2.json`; its digest is independently recomputable and excluded from the evidence snapshot digest.
