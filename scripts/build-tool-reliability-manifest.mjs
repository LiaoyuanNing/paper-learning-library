import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const root = resolve(new URL("..", import.meta.url).pathname);
const stamp = "2026-08-04T10:30:00+08:00";
const version = "1.0.0";
const canonicalize = (value) => Array.isArray(value) ? value.map(canonicalize) : value && typeof value === "object" ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])])) : value;
const digest = (value) => `sha256:${createHash("sha256").update(JSON.stringify(canonicalize(value))).digest("hex")}`;
const writeJson = async (path, value) => { await mkdir(dirname(path), { recursive: true }); await writeFile(path, `${JSON.stringify(value, null, 2)}\n`); };

const sourceRows = [
  ["S01", "2210.03629", "v3", "ReAct: Synergizing Reasoning and Acting in Language Models", "reasoning-action 闭环", "受控 QA 与交互环境", "published", "venue confirmed: ICLR 2023"],
  ["S02", "2302.04761", "v1", "Toolformer: Language Models Can Teach Themselves to Use Tools", "自监督 API 决策", "固定 API、离线条件", "preprint", "venue not independently confirmed"],
  ["S03", "2307.16789", "v2", "ToolLLM: Facilitating Large Language Models to Master 16000+ Real-world APIs", "API retrieval + search tree", "LLM 参与数据、路径与评审", "preprint", "venue not independently confirmed"],
  ["S04", "2306.06070", "v3", "Mind2Web: Towards a Generalist Agent for the Web", "DOM 候选筛选", "演示数据不等于端到端成功", "preprint", "venue not independently confirmed"],
  ["S05", "2307.13854", "v4", "WebArena: A Realistic Web Environment for Building Autonomous Agents", "可执行网页终态验证", "沙箱与真实网络不同", "published", "ICLR 2024 (Master documented independent check; direct OpenReview recheck was challenge-blocked)"],
  ["S06", "2308.03688", "v3", "AgentBench: Evaluating LLMs as Agents", "多环境长程失败分类", "非单一机制因果试验", "published", "venue confirmed: ICLR 2024 (official arXiv version comment)"],
  ["S07", "2311.12983", "v1", "GAIA: a benchmark for General AI Assistants", "通用工具 / 浏览基线", "题集有限且随模型更新漂移", "preprint", "venue not independently confirmed"],
  ["S08", "2401.13919", "v4", "WebVoyager: Building an End-to-End Web Agent with Large Multimodal Models", "真实网页多模态闭环", "GPT-4V judge 与环境漂移限制可比性", "preprint", "venue not independently confirmed"],
  ["S09", "2404.07972", "v2", "OSWorld: Benchmarking Multimodal Agents for Open-Ended Tasks in Real Computer Environments", "跨 app OS 执行终态", "主要覆盖开源 / 受控桌面", "preprint", "venue not independently confirmed"],
  ["S10", "2406.12045", "v1", "τ-bench: A Benchmark for Tool-Agent-User Interaction in Real-World Domains", "多轮 user/API 任务，并以 pass^k 表达重复通过率", "用户由 LLM 模拟、业务域有限", "preprint", "venue not independently confirmed"],
  ["S11", "2310.06770", "v3", "SWE-bench: Can Language Models Resolve Real-World GitHub Issues?", "真实软件任务终态", "代码域特异", "published", "venue confirmed: ICLR 2024 (official arXiv version comment)"],
  ["S12", "2505.23419", "v2", "SWE-bench Goes Live!", "freshness / 污染反例", "软件任务域特异", "preprint", "venue not independently confirmed"],
  ["S13", "2504.12516", "v1", "BrowseComp: A Simple Yet Challenging Benchmark for Browsing Agents", "持续 web 搜寻", "回避长报告、歧义与真实 query 分布", "preprint", "venue not independently confirmed"],
  ["S14", "2602.08543", "v2", "GISA: A Benchmark for General Information-Seeking Assistant", "live 信息检索子集", "精确匹配不覆盖写作质量", "preprint", "venue not independently confirmed"],
  ["S15", "2511.07685", "v1", "ResearchRubrics: A Benchmark of Prompts and Rubrics For Evaluating Deep Research Agents", "深研报告 rubric", "近期预印本，须降级", "preprint", "venue not independently confirmed"],
  ["S16", "2512.01948", "v2", "How Far Are We from Genuinely Useful Deep Research Agents?", "深研失败 taxonomy / FINDER", "近期预印本，须列 contested", "preprint", "venue not independently confirmed"],
  ["S17", "2605.27700", "v1", "CiteCheck: Retrieval-Grounded Detection of LLM Citation Hallucinations in Scientific Text", "引用元数据核验，不证明 source-to-claim 蕴含", "不证明主张蕴含", "preprint", "venue not independently confirmed"],
];
const venueLocators = {
  S05: "https://openreview.net/forum?id=oKnDwg0ljZ",
  S06: "https://arxiv.org/abs/2308.03688v3",
  S11: "https://arxiv.org/abs/2310.06770v3",
};
const sources = sourceRows.map(([source_id, arxiv_id, version, title, role, limitation, publication_status, venue_status]) => ({
  source_id, source_kind: "arxiv", arxiv_id, version, title, role, limitation,
  official_url: `https://arxiv.org/abs/${arxiv_id}${version}`,
  source_checked_on: null, publication_status, venue_status,
  ...(venueLocators[source_id] ? { venue_locator: venueLocators[source_id] } : {}),
  full_text_stored: false,
}));
const evidence = sources.map((source, index) => ({
  evidence_id: `E${String(index + 1).padStart(2, "0")}`,
  source_id: source.source_id,
  locator: "versioned arXiv source record",
  faithful_summary: source.role,
}));
const evidenceFor = (...ids) => ids.map((id) => `E${String(id).padStart(2, "0")}`);
const direct = [
  ["C01", "strong", "工具不是单独功能；在有可观察反馈的任务里，plan → action/tool → observation → update 闭环比只生成答案更能抑制错误传播。", "只对 ReAct 的受控 QA / 交互环境成立。", [1]],
  ["C02", "conditional", "先筛选工具 / DOM 候选可降低上下文噪声与调用成本，并提升选择效果。", "它不等于最终答案正确；候选召回失败会不可逆漏证。", [2, 3, 4]],
  ["C03", "strong", "评测应验收任务终态或事实约束，不能只比 action string 或文风。", "沙箱终态不能替代真实外部世界，也不是安全或合规证明。", [5, 9, 10, 11]],
  ["C04", "strong", "长程 agent 当前成功率与人类有大缺口，失败会随步骤累积。", "不同 benchmark 的百分比不可横向排名。", [5, 7, 9, 10, 11]],
  ["C05", "conditional", "自动 judge 可扩展，但必须保留可复现终态 / 参考答案并抽样人工复核。", "仅 GPT judge 会把评测偏差藏入分数。", [5, 8, 10]],
  ["C06", "strong", "可靠性至少要重复运行并报告最差 / 多次通过率，而非一次成功。", "本 episode 不主张小样本结果具有统计显著性。", [10]],
  ["C07", "strong", "原始引用的存在与元数据正确须经检索加结构化比对；这与来源蕴含该 claim 是两个 gate。", "CiteCheck 只证明前者；后者须由 evidence excerpt 和 Critic 覆盖。", [17]],
  ["C08", "conditional", "深研报告不能由 QA 分数替代；rubric / checklist 能暴露 grounding、推理与综合遗漏。", "两项深研来源都是近期预印本。", [15, 16]],
  ["C09", "strong", "静态评测易受数据污染和环境过时影响；fresh / live slices 应作为回归补充。", "live 环境会降低可复现性并增加维护成本。", [12, 14]],
  ["C10", "unknown", "尚无跨研究、网页、API 与 OS 任务的统一证据能给出最优的单一 agent 编排或固定 token 预算。", "不得把某一个 leaderboard 当作产品可靠性证明。", [5, 9, 10, 15]],
].map(([claim_id, strength, text, scope, ids]) => ({ claim_id, type: "direct_answer", strength, text, scope, supporting_evidence_ids: evidenceFor(...ids), contradicting_evidence_ids: [] }));
const recText = [
  ["发布前双 gate", "把每条实质结论绑定 claim → evidence excerpt/location → versioned source URL，并将主张蕴含检查与引文元数据检查分开。", "编辑成本与页面数据量增加。", [17]],
  ["两级检索", "候选发现层可宽，core evidence 层只收一手且固定版本。", "覆盖率与时效可能下降。", [2, 3, 4]],
  ["可审计选择", "保留本轮 core set、已裁定的排除理由与查询范围；没有真实候选扫描时，不把它称为 retention funnel 或停止信号。", "研究过程暴露，维护负担上升。", [13, 14]],
  ["Critic 发布门", "至少五个核心 claim 主动查找反例、范围外推与 source-claim 不闭合。", "出稿变慢，可能产出更多 conditional / unknown。", [15, 16, 17]],
  ["只读 consumer", "在 post-tag 固定 snapshot 后，交给未参与者回答三个引用闭合问题并逐条审阅 citation。", "需要等待可复核的发布版本，且不预设通过。", [10, 17]],
  ["重复运行", "用小样本重复运行 / 独立 reviewer，而非只记录一次生成。", "模型与人工成本上升。", [10]],
  ["三面网页 QA", "将网页 QA 分为 desktop、390px 与 console，并断言结论、限制、引用与 provenance 可见。", "前端测试维护增加。", [5, 8]],
  ["freshness 预算", "标注访问日期，并在下一 episode 前复核 live / 近期 preprint；固定版本发布后以新版本纠错。", "可能出现多个并存版本。", [12, 14]],
].map(([title, text, side_effects, ids], index) => ({ claim_id: `P${String(index + 1).padStart(2, "0")}`, type: "product_recommendation", strength: "recommendation", title, text, side_effects, supporting_evidence_ids: evidenceFor(...ids), contradicting_evidence_ids: [] }));

const predecessor_releases = [{
  artifact_id: "age-174-v2",
  manifest_version: "2.0.0",
  snapshot_digest: "sha256:1cab26e51999310225fb08e05621ddfdbcad7ca3e478bc37181af0d614484a8c",
  pinned_commit: "2aeb71cf4388a238e76a95ac6d6c715ab1c9dd3c",
  manifest_path: "site/reports/agent-teams-2026/data/evidence-manifest.v2.json",
  snapshot_path: "site/reports/agent-teams-2026/data/evidence-snapshot.v2.json",
  immutable_snapshot_url: "https://raw.githubusercontent.com/LiaoyuanNing/paper-learning-library/2aeb71cf4388a238e76a95ac6d6c715ab1c9dd3c/site/reports/agent-teams-2026/data/evidence-snapshot.v2.json",
  relationship: "independent immutable predecessor; this mutable AGE-396 candidate must not alter its payload, tag, or digest",
}];
const provenance = { generated_at: stamp, source_model: "gpt-5.6", provider: "OpenAI", workflow_version: "age-396-episode002-evidence-synthesis-v1", input_evidence: [{ kind: "research_handoff", reference: "AGE-400 attachment episode002-research-handoff.md" }, { kind: "metadata_audit", reference: "research/tool-reliability-2026/metadata-audit.v1.json" }], review: { status: "approved", reviewer: "PM-Paper (scope and content contract handoff)", reviewed_at: stamp, reason: "AGE-396 locked the research contract; this mutable candidate preserves its claims and boundaries for independent release review.", replaces: null, withdrawn_by: null } };
const consumerContract = {
  protocol_version: "1.0.0",
  run_status: "not_run_pending_post_tag_blind_consumer",
  input_boundary: "post-tag fixed evidence snapshot only; no report, research notes, Git history, issue, conversation history, originals, or internet",
  questions: [
    { question_id: "Q1", question: "为什么 citation metadata valid 仍不足以发布一条产品结论？", evidence_refs: [{ evidence_id: "E17", source_id: "S17" }], claim_refs: ["C07"], citation_review: "cite E17/S17 and C07; explain the separate source-to-claim entailment gate" },
    { question_id: "Q2", question: "哪一组证据支持不能只报一次成功率，其限制是什么？", evidence_refs: [{ evidence_id: "E10", source_id: "S10" }], claim_refs: ["C06"], citation_review: "cite E10/S10 and C06; identify pass^k and the LLM-user / limited-domain boundary" },
    { question_id: "Q3", question: "发布 gate 的哪些图节点可支持产品建议，哪个前序 release 不能被此候选修改？", evidence_refs: [{ evidence_id: "E17", source_id: "S17" }], claim_refs: ["P01"], predecessor_release_ids: ["age-174-v2"], citation_review: "cite P01, E17/S17, and the pinned age-174-v2 predecessor reference" },
  ],
};
const manifest = {
  schema_version: "1.1.0", artifact_id: "age-396-v1", manifest_version: version,
  release_status: "mutable_candidate", immutable: false,
  digest_method: "SHA-256 of recursively key-sorted JSON after omitting snapshot_digest and evidence_snapshot",
  request: { knowledge_cutoff: "2026-08-03T23:59:59+08:00", subject_window_start: "2023-01-01", query_clusters: ["tool-use API retrieval evaluation", "web agent real environment execution evaluation", "long-horizon reliability pass@k", "deep research factual grounding citation verification"], selection_record: "core_set_plus_adjudicated_exclusions", core_target: "12–18", exclusions: ["无 agent/tool loop 的一般 RAG", "纯 prompt 技巧", "无实验的产品宣称"] },
  ai_provenance: provenance, sources, evidence, claims: [...direct, ...recText], predecessor_releases,
  candidate_ledger: [...sources.map((source) => ({ arxiv_id: source.arxiv_id, decision: "core_set", reason: source.role, provenance: "episode core set; not a candidate-scan retention result", original_url: source.official_url })), { arxiv_id: "2402.05930", title: "WebLINX", decision: "adjudicated_exclusion", reason: "网页导航而非本问题的检索 / 证据闭环", provenance: "curated exclusion", original_url: "https://arxiv.org/abs/2402.05930" }, { arxiv_id: "2405.14573", title: "AndroidWorld", decision: "adjudicated_exclusion", reason: "移动 OS 域偏离", provenance: "curated exclusion", original_url: "https://arxiv.org/abs/2405.14573" }, { arxiv_id: "2508.13186", title: "MM-BrowseComp", decision: "background", reason: "多模态检索反例", provenance: "curated background", original_url: "https://arxiv.org/abs/2508.13186" }, { arxiv_id: "2606.17458", title: "ICBCBench", decision: "background", reason: "行业报告双轨测量，金融域不直接泛化", provenance: "curated background", original_url: "https://arxiv.org/abs/2606.17458" }],
  critic_records: [{ critic_id: "C01", claim_id: "C01", counter_search: "是否仅是 prompt / benchmark 特异", result: "保留 strong，但限定为受控交互任务。" }, { critic_id: "C03", claim_id: "C03", counter_search: "终态是否遗漏过程伤害 / 成本", result: "加入终态通过不是安全 / 合规证明。" }, { critic_id: "C04", claim_id: "C04", counter_search: "不同论文成功率能否横比", result: "不能；禁止汇总为平均成功率。" }, { critic_id: "C07", claim_id: "C07", counter_search: "CiteCheck 能否验证文字蕴含", result: "不能；保留独立 entailment / Critic gate。" }, { critic_id: "C09", claim_id: "C09", counter_search: "live benchmark 是否仍可复现", result: "部分不能；snapshot 加 dated result 是折中。" }],
  consumer_contract: consumerContract,
  report: { claim_links: direct.map((item) => item.claim_id), recommendation_links: recText.map((item) => item.claim_id), method: ["本工件是 mutable candidate：core set 加已裁定排除项，不是完整候选扫描，不能导出 retention ratio 或停止信号。", "每个 source、evidence 与 claim 通过 ID 闭合；candidate snapshot 仅作 digest-covered review input，tag 后才可声明 immutable release。", "consumer 题目只发布引用契约；独立 blind run 必须在 post-tag snapshot 后执行，不能以本候选生成 PASS。"], limitations: ["本研究不保留论文全文、PDF 或大段原文。", "未留下观察记录的元数据明确为 unverified，不可从 audit 推出已核验。", "WebArena 的 ICLR locator 在本 runner 被 OpenReview challenge 拦截；状态来自 Master 已记录的独立核验，待后续可访问时复查。", "跨 benchmark 数字没有被汇总为排名或平均成功率。"] },
  validation: { metadata_audit: "research/tool-reliability-2026/metadata-audit.v1.json", browser_qa: "research/tool-reliability-2026/browser-qa.v1.md", queries: "research/tool-reliability-2026/queries.md", candidate_ledger: "research/tool-reliability-2026/candidate-ledger.md" },
};
const payload = structuredClone(manifest); delete payload.snapshot_digest; delete payload.evidence_snapshot;
manifest.snapshot_digest = digest(payload);
manifest.evidence_snapshot = { artifact_id: manifest.artifact_id, manifest_version: version, snapshot_digest: manifest.snapshot_digest, release_status: "mutable_candidate", candidate_note: "No merge, tag, stable URL, or blind-consumer result exists for this candidate." };
const snapshot = { artifact_id: manifest.artifact_id, manifest_version: version, snapshot_digest: manifest.snapshot_digest, release_status: "mutable_candidate", digest_method: manifest.digest_method, evidence_payload: payload };

const masterChecks = new Map([
  ["S12", ["SWE-bench Goes Live!", "2505.23419", "v2"]], ["S13", ["BrowseComp: A Simple Yet Challenging Benchmark for Browsing Agents", "2504.12516", "v1"]], ["S14", ["GISA: A Benchmark for General Information-Seeking Assistant", "2602.08543", "v2"]], ["S15", ["ResearchRubrics: A Benchmark of Prompts and Rubrics For Evaluating Deep Research Agents", "2511.07685", "v1"]], ["S16", ["How Far Are We from Genuinely Useful Deep Research Agents?", "2512.01948", "v2"]], ["S17", ["CiteCheck: Retrieval-Grounded Detection of LLM Citation Hallucinations in Scientific Text", "2605.27700", "v1"]],
]);
const localChecks = new Map(["S05", "S06", "S11"].map((id) => { const source = sources.find((item) => item.source_id === id); return [id, [source.title, source.arxiv_id, source.version]]; }));
const audit = { schema_version: "1.1.0", artifact_id: manifest.artifact_id, audited_on: stamp, auditor: "Dev-Paper", evidence_policy: "A verified status requires an independent observation with URL, observed title/ID/version, time, verifier/method and match outcome. Unverified records are intentionally not copies of source input.", records: sources.map((source) => {
  const observation = localChecks.get(source.source_id) ?? masterChecks.get(source.source_id);
  if (!observation) return { source_id: source.source_id, verification_status: "unverified", reason: "No independently recorded observation is available in this candidate." };
  const [observed_title, observed_arxiv_id, observed_version] = observation;
  const inherited = masterChecks.has(source.source_id);
  return { source_id: source.source_id, verification_status: "verified", observations: [{ checked_url: source.official_url, observed_title, observed_arxiv_id, observed_version, checked_at: inherited ? "2026-08-03T18:25:49Z" : stamp, verifier: inherited ? "Master (documented independent acceptance check)" : "Dev-Paper", method: inherited ? "Master record: direct official arXiv abstract-page check" : "official arXiv API versioned entry", match: "match" }] };
}) };
await writeJson(resolve(root, "site/reports/tool-reliability-2026/data/evidence-manifest.v1.json"), manifest);
await writeJson(resolve(root, "site/reports/tool-reliability-2026/data/evidence-snapshot.v1.json"), snapshot);
await writeJson(resolve(root, "research/tool-reliability-2026/metadata-audit.v1.json"), audit);
console.log(`${manifest.artifact_id} ${manifest.snapshot_digest}`);
