# Independent evidence-snapshot consumer transcript · v2 candidate

## Attested input boundary

- Consumer identity: `/root/manifest_consumer_v2_candidate2`
- Prior research involvement: none
- Manifest version: `2.0.0`
- Snapshot digest: `sha256:cbe74d0293139ee118fccc4abc106f2bb713d492db4c049a9371203bb29941f3`
- Immutable input URL: `https://raw.githubusercontent.com/LiaoyuanNing/paper-learning-library/a6d4385ffc87efbe2572edfaae8eb9e49e39e20e/site/reports/agent-teams-2026/data/evidence-snapshot.v2.json`
- Allowed input: only the named local copy of that immutable snapshot; substantive answers use only `evidence_payload`.
- Forbidden inputs: release manifest, report, research notes, Git, issue/comments, conversation history, paper originals and internet.
- Trial status: candidate-only; rerun after Librarian promotion before final digest/release.

## Verbatim consumer response

### INPUT BOUNDARY

I read only:
`paper-learning-library/site/reports/agent-teams-2026/data/evidence-snapshot.v2.json`

Substantive answers use only its evidence_payload. I used the top-level manifest_version and snapshot_digest solely to identify the snapshot. I did not read Git, issues, conversation history, paper originals, other files, or the internet.

manifest_version: 2.0.0

snapshot_digest: sha256:cbe74d0293139ee118fccc4abc106f2bb713d492db4c049a9371203bb29941f3
knowledge cutoff: 2026-07-15

### Q1

2602.01011v4 is core because it is ICML 2026 evidence directly testing whether team consensus preserves a known expert’s judgment. Even when the team was explicitly told who the expert was, it failed to match the best individual across four conditions: the gaps were 6.3%–41.1%, and adding members intensified consensus pressure and expert dilution. This is direct counterevidence to treating consensus or team size as a correctness guarantee.

Citation: S21 | https://arxiv.org/abs/2602.01011v4 | E22 | §4.1 Table 1; §4.2 Table 2; §4.3; Appendix H

Boundary: these are controlled collaboration/ranking tasks, not production organizations. Consensus may sometimes improve robustness, but can sacrifice the strongest expert signal.

2604.07821v2 is core because it is an ICML 2026 main-conference study that directly separates individual capability from zero-cost cooperation and tests interventions. Capability did not predict cooperation: o3 achieved only 17% of optimal collective performance, versus 50% for o3-mini. Explicit protocols doubled performance for some lower-capability models, and micro-incentives improved weak cooperators. Thus stronger models are not automatically better collaborators, while cooperation can depend on protocol and incentives.

Citation: S24 | https://arxiv.org/abs/2604.07821v2 | E25 | Abstract; §4–§6; Table 3

Boundary: zero-cost games do not cover long-running tool workflows, and neither structured protocols nor micro-incentives are established as universal cooperation solutions.

### Q2

No. Under equal thinking-token budgets, the snapshot does not support universal MAS superiority. Across three model families, two multi-hop datasets, and several budget points, single-agent scaling usually matched or exceeded MAS. MAS advantages appeared mainly when the single agent’s context was deliberately degraded.

Citation: S22 | https://arxiv.org/abs/2604.02460v2 | E23 | §4.4 Table 1; §5.1; §5.3 Figure 3; Appendix F Tables 3–10

Boundary: this directly concerns multi-hop reasoning. It does not establish the answer for persistent action, heterogeneous permissions, independent external state, or long-running production workflows. Outcomes in those settings are unknown without matched-budget evaluation.

A homogeneous workflow does not necessarily require multiple live agents. OneFlow had one agent execute the nodes of a same-model MAS workflow sequentially while reusing KV cache; it matched or slightly outperformed the original MAS and reduced KV-cache and communication overhead.

Citation: S23 | https://arxiv.org/abs/2601.12307v1 | E24 | §4.2 Tables 1–2; §4.2.3 Table 3; §4.2.4 Table 4

Boundary: the result is limited to homogeneous workflows. Heterogeneous models, distinct permissions, genuinely parallel environment interaction, or independent information sources may not be collapsible and can still require multiple live agents.

### Q3

Silo-Bench separates communication from reasoning within the distributed team. It places private information in agent silos, observes whether information was exchanged, and independently checks whether the distributed state was correctly integrated into the answer. Across 30 tasks, 54 configurations, and 1,620 experiments, it found a Communication–Reasoning Gap: messages could be exchanged without successful joint reasoning. Premature conclusions, false consensus, and calculation errors were major failure modes.

Citation: S25 | https://arxiv.org/abs/2603.01045v2 | E26 | §3–§5; §5.2 Table 4; Figures 4–6

HiddenBench uses a complementary outcome comparison. It distributes task-critical information among agents, then compares the resulting MAS against a single agent given the complete input. Across 65 hidden-profile tasks, distributed MAS completed 30.1%, versus 80.7% for the full-information single agent; increasing model scale did not reliably remove the integration failure.

Citation: S26 | https://arxiv.org/abs/2505.11556v4 | E27 | Abstract; §3; §4.2; Tables 1–2; §5

Together, Silo-Bench diagnoses “messages arrived but reasoning failed,” while HiddenBench quantifies the loss caused by distributing information relative to centralized full information.

Boundaries: both use controlled tasks. Their task structures differ, and neither captures all production complications such as permissions, latency, asynchronous failures, or long-horizon organizational dynamics.

### Q4

No. LatentMAS’s headline results do not prove that learned alignment matrices or cross-agent transfer are universally necessary. The original work reported, over nine benchmarks, gains as high as +14.6 accuracy points, output-token reductions of 70.8%–83.7%, and roughly 4× speed. These are performance results, not universal necessity proofs.

Citation: S15 | https://arxiv.org/abs/2511.20639v3 | E16 | §4.1 Table 1; Appendix D Tables 3–5

Direct follow-up counterevidence found no significant decline with an identity matrix; on some tasks, removing cross-agent transfer was equal or better; and text communication outperformed latent communication on coding tasks.

Citation: S27 | https://openreview.net/forum?id=manXhfpRH3 | E28 | §4.1 Table 1; §4.2–§4.3; Appendix C

Boundary: the counterevidence is an ICML 2026 workshop study, so it narrows the claim rather than proving latent mechanisms are never useful. General auditability, interoperability, security, and cross-task necessity remain unresolved.

At the cutoff, we cannot assert that 100 production agents are necessarily stronger than 10. The exact 100-versus-10 production comparison is absent, so that proposition is unknown. Available evidence argues against a monotonic size law:

MacNet showed that systems can run at thousand-node scale, but did not establish a cross-task, equal-budget universal scaling advantage.

Citation: S09 | https://arxiv.org/abs/2406.07155v3 | E09 | Abstract; §3–§5

Across 260 controlled configurations, MAS performance relative to a single agent ranged from +80.8% to −70.0%, showing that architecture-task alignment can reverse the direction of benefit.

Citation: S16 | https://arxiv.org/abs/2512.08296v3 | E17 | §4.2–§4.4; Figure 1; Table 2

Known-expert experiments also found that additional members could worsen expert dilution.

Citation: S21 | https://arxiv.org/abs/2602.01011v4 | E22 | §4.1 Table 1; §4.2 Table 2; §4.3; Appendix H

The manifest screened 49 candidate papers and selected 18 core papers—8 foundational/typical and 10 frontier—with 27 source records. These are manifest selection statistics, not evidence that exhausts the literature or validates a production scaling law. The corpus is not a systematic-review-level exhaustive sample, benchmarks skew toward mathematics, code, QA, and software engineering, and production incentives, permissions, security, long-term learning, model drift, concurrency, and budget effects remain insufficiently tested.

### COMPLIANCE STATEMENT

I complied with the stated boundary: only the named immutable snapshot was read, substantive claims came only from evidence_payload, every used research source is identified by source ID, official URL, evidence ID, and locator, and unsupported propositions are marked unknown.

## PM manual review

`4/4 PASS`. Every cited evidence ID was resolved to its source ID, official URL and stable locator in the immutable snapshot. Numbers, selection counts, unknowns and scope boundaries matched the same input. The machine-readable review is `consumer-attestation.v2.json`; its digest is independently recomputable and excluded from the evidence snapshot digest.
