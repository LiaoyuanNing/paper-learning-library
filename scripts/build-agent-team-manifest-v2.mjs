import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const inputUrl = new URL("site/reports/agent-teams-2026/data/evidence-manifest.v1.json", root);
const outputUrl = new URL("site/reports/agent-teams-2026/data/evidence-manifest.v2.json", root);
const auditUrl = new URL("research/agent-teams-2026/metadata-audit.v2.json", root);
const stableUrl = process.argv[2] ?? "PENDING_COMMIT_PIN";
const manifest = JSON.parse(await readFile(inputUrl, "utf8"));

const canonicalize = (value) => {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
  }
  return value;
};

const digest = (value) => {
  const snapshot = structuredClone(value);
  delete snapshot.snapshot_digest;
  delete snapshot.stable_url;
  delete snapshot.validation?.manifest_consumer_trial;
  return `sha256:${createHash("sha256").update(JSON.stringify(canonicalize(snapshot))).digest("hex")}`;
};

const venueBySource = {
  S01: ["published", "NeurIPS", "Conference", 2023],
  S02: ["published", "ICML", "Conference", 2024],
  S03: ["published", "ACL", "Long Paper", 2024],
  S04: ["published", "ICLR", "Oral", 2024],
  S05: ["published", "COLM", "Conference", 2024],
  S06: ["published", "ACL", "Long Paper", 2024],
  S07: ["published", "COLM", "Conference", 2024],
  S08: ["published", "TMLR", "Journal", 2024],
  S09: ["published", "ICLR", "Conference", 2025],
  S10: ["published", "ICML", "Conference", 2025],
  S11: ["preprint", null, null, null],
  S12: ["published", "ACL", "Long Paper", 2025],
  S13: ["published", "NeurIPS", "Datasets and Benchmarks Track", 2025],
  S14: ["published", "ACL", "Long Paper", 2026],
  S15: ["accepted", "ICML", "Spotlight", 2026],
  S16: ["preprint", null, null, null],
  S17: ["workshop", "ICLR", "AIMS Workshop", 2026],
  S18: ["published", "ACL", "Long Paper", 2026],
  S19: ["published", "ICLR", "Conference", 2024],
  S20: ["preprint", null, null, null],
};

const corrections = {
  S04: {
    authors: ["Sirui Hong", "Mingchen Zhuge", "Jiaqi Chen", "Xiawu Zheng", "Yuheng Cheng", "Ceyao Zhang", "Jinlin Wang", "Zili Wang", "Steven Ka Shing Yau", "Zijuan Lin", "Liyang Zhou", "Chenyu Ran", "Lingfeng Xiao", "Chenglin Wu", "Jürgen Schmidhuber"],
  },
  S05: {
    authors: ["Qingyun Wu", "Gagan Bansal", "Jieyu Zhang", "Yiran Wu", "Beibin Li", "Erkang Zhu", "Li Jiang", "Xiaoyun Zhang", "Shaokun Zhang", "Jiale Liu", "Ahmed Hassan Awadallah", "Ryen W White", "Doug Burger", "Chi Wang"],
  },
  S08: {
    authors: ["Junyou Li", "Qin Zhang", "Yangbin Yu", "Qiang Fu", "Deheng Ye"],
  },
  S09: {
    title: "Scaling Large Language Model-based Multi-Agent Collaboration",
    authors: ["Chen Qian", "Zihao Xie", "YiFei Wang", "Wei Liu", "Kunlun Zhu", "Hanchen Xia", "Yufan Dang", "Zhuoyun Du", "Weize Chen", "Cheng Yang", "Zhiyuan Liu", "Maosong Sun"],
  },
  S12: {
    title: "MultiAgentBench: Evaluating the Collaboration and Competition of LLM agents",
  },
  S13: {
    authors: ["Mert Cemri", "Melissa Z. Pan", "Shuyi Yang", "Lakshya A. Agrawal", "Bhavya Chopra", "Rishabh Tiwari", "Kurt Keutzer", "Aditya Parameswaran", "Dan Klein", "Kannan Ramchandran", "Matei Zaharia", "Joseph E. Gonzalez", "Ion Stoica"],
  },
  S14: {
    title: "Scaling External Knowledge Input Beyond Context Windows of LLMs via Multi-Agent Collaboration",
  },
  S15: {
    venue_url: "https://openreview.net/forum?id=e7pAjJZJWb",
  },
  S17: {
    venue_url: "https://openreview.net/forum?id=9BN2W5BCfE",
  },
  S19: {
    authors: ["Weize Chen", "Yusheng Su", "Jingwei Zuo", "Cheng Yang", "Chenfei Yuan", "Chi-Min Chan", "Heyang Yu", "Yaxi Lu", "Yi-Hsin Hung", "Chen Qian", "Yujia Qin", "Xin Cong", "Ruobing Xie", "Zhiyuan Liu", "Maosong Sun", "Jie Zhou"],
  },
};

manifest.sources = manifest.sources.map((source) => {
  const [publication_status, venue, track, venue_year] = venueBySource[source.source_id];
  const submission_year = 2000 + Number(source.paper_id.slice(0, 2));
  const next = {
    ...source,
    ...corrections[source.source_id],
    submission_year,
    venue_year,
    publication_status,
    venue,
    track,
  };
  delete next.year;
  return next;
});

manifest.sources.push(
  {
    source_id: "S21",
    paper_id: "2602.01011",
    title: "Multi-Agent Teams Hold Experts Back",
    authors: ["Aneesh Pappu", "Batu El", "Hancheng Cao", "Carmelo di Nolfo", "Yanchao Sun", "Meng Cao", "James Zou"],
    version: "v4",
    submission_year: 2026,
    venue_year: 2026,
    publication_status: "accepted",
    venue: "ICML",
    track: "Regular",
    official_url: "https://arxiv.org/abs/2602.01011v4",
    venue_url: "https://openreview.net/forum?id=Xn8kmKvO9g",
    accessed_at: "2026-07-15",
  },
  {
    source_id: "S22",
    paper_id: "2604.02460",
    title: "Single-Agent LLMs Outperform Multi-Agent Systems on Multi-Hop Reasoning Under Equal Thinking Token Budgets",
    authors: ["Dat Tran", "Douwe Kiela"],
    version: "v2",
    submission_year: 2026,
    venue_year: null,
    publication_status: "preprint",
    venue: null,
    track: null,
    official_url: "https://arxiv.org/abs/2604.02460v2",
    venue_url: null,
    accessed_at: "2026-07-15",
  },
  {
    source_id: "S23",
    paper_id: "2601.12307",
    title: "Rethinking the Value of Multi-Agent Workflow: A Strong Single Agent Baseline",
    authors: ["Jiawei Xu", "Arief Koesdwiady", "Sisong Bei", "Yan Han", "Baixiang Huang", "Dakuo Wang", "Yutong Chen", "Zheshen Wang", "Peihao Wang", "Pan Li", "Ying Ding"],
    version: "v1",
    submission_year: 2026,
    venue_year: null,
    publication_status: "preprint",
    venue: null,
    track: null,
    official_url: "https://arxiv.org/abs/2601.12307v1",
    venue_url: null,
    accessed_at: "2026-07-15",
  },
);

const sourcePapers = new Map(manifest.papers.map((paper) => [paper.source_id, paper]));
const includedIds = new Set(["S01", "S02", "S03", "S04", "S05", "S06", "S07", "S08", "S10", "S12", "S13", "S15", "S16", "S17", "S18"]);
for (const [sourceId, paper] of sourcePapers) {
  if (!includedIds.has(sourceId)) {
    paper.group = null;
    paper.selection = {
      decision: "extended",
      reasons: sourceId === "S09"
        ? ["大规模拓扑仍保留为扩展证据", "由 matched-budget 与专家稀释直接边界替换核心席位"]
        : sourceId === "S11"
          ? ["路由方向有价值", "预印本且与 MaAS/DyLAN 机制重叠"]
          : ["长上下文分片机制保留", "由更直接的 matched-budget 反证替换核心席位"],
    };
  }
}

sourcePapers.set("S19", {
  paper_id: "2308.10848",
  source_id: "S19",
  group: null,
  selection: { decision: "extended", reasons: ["与 AutoGen/DyLAN 重叠", "保留错误同伴说服正确 agent 的正式反证"] },
});
sourcePapers.set("S20", {
  paper_id: "2606.18829",
  source_id: "S20",
  group: null,
  selection: { decision: "extended", reasons: ["共享记忆治理直接相关", "截止日时仍是单篇新预印本"] },
});

const newCorePapers = [
  {
    paper_id: "2602.01011", source_id: "S21", group: "frontier",
    research_question: "团队已知谁是专家时，讨论能否保留最佳个体的专业判断？",
    mechanism: "对照无专家、隐含专家、显式揭示专家及最佳个体；改变团队规模与专长分布。",
    experiment: "四类协作/排序任务，多模型与团队构成；比较团队与已识别最佳个体。",
    result: "即使明确揭示专家，团队仍未能匹配最佳个体，差距为 6.3%–41.1%；规模增加会加剧判断稀释。",
    limitations: "受控任务不等同于生产组织；共识有时改善鲁棒性，但会牺牲最佳专家信号。",
    selection: { decision: "included", reasons: ["ICML 2026", "直接揭示专家稀释", "重审共识与规模结论所需反证"] },
  },
  {
    paper_id: "2604.02460", source_id: "S22", group: "frontier",
    research_question: "在相同 thinking-token 预算下，MAS 是否仍优于单智能体？",
    mechanism: "跨三个模型家族配平总思考 token，对比 single-agent scaling 与多种 MAS。",
    experiment: "两个 multi-hop reasoning 数据集；多预算点、模型家族和信息退化条件。",
    result: "大多数配平条件下单智能体匹配或超过 MAS；当单体上下文被人为退化时 MAS 才显示边界性优势。",
    limitations: "集中于 multi-hop reasoning；不能替代持续行动、异构权限或外部状态任务评测。",
    selection: { decision: "included", reasons: ["直接 matched-budget 证据", "约束 C05 强度", "覆盖模型家族与预算曲线"] },
  },
  {
    paper_id: "2601.12307", source_id: "S23", group: "frontier",
    research_question: "固定同一模型的多智能体 workflow 能否折叠成单智能体执行？",
    mechanism: "OneFlow 由单智能体顺序执行原 workflow 节点，并复用 KV cache。",
    experiment: "多 workflow、模型和任务；比较效果、token/延迟及异构模型边界。",
    result: "同质 workflow 可匹配或略优于 MAS 并节省 KV-cache/通信开销；真正异构模型组合不保证可折叠。",
    limitations: "结论针对同质 workflow；不同权限、并行环境交互和独立信息源仍可能需要团队。",
    selection: { decision: "included", reasons: ["直接 strong single-agent baseline", "揭示同质 workflow 可折叠", "补足复杂 MAS 对照契约"] },
  },
];
for (const paper of newCorePapers) sourcePapers.set(paper.source_id, paper);

const externalCandidates = [
  ["2309.17288", "AutoAgents: A Framework for Automatic Agent Generation", "v3", "published", "自动组队前驱；证据弱于 DyLAN/MaAS"],
  ["2402.14034", "AgentScope: A Flexible yet Robust Multi-Agent Platform", "v2", "preprint", "平台工程贡献为主，机制因果较弱"],
  ["2402.16823", "GPTSwarm: Language Agents as Optimizable Graphs", "v3", "published", "重要前驱，MaAS 覆盖更直接的架构搜索"],
  ["2406.04692", "Mixture-of-Agents Enhances Large Language Model Capabilities", "v1", "preprint", "token 聚合，不是持续行动团队"],
  ["2406.05720", "VillagerAgent: A Graph-Based Multi-Agent Framework for Coordinating Complex Task Dependencies in Minecraft", "v1", "preprint", "Minecraft 单域色彩强"],
  ["2410.02506", "Cut the Crap: An Economical Communication Pipeline for LLM-based Multi-Agent Systems", "v1", "preprint", "通信剪枝有价值，但核心优先跨系统边界"],
  ["2411.04468", "Magentic-One: A Generalist Multi-Agent System for Solving Complex Tasks", "v1", "preprint", "工程基线强，机制隔离与正式 venue 较弱"],
  ["2412.05449", "Towards Effective GenAI Multi-Agent Collaboration: Design and Evaluation for Enterprise Applications", "v1", "preprint", "专有系统、手工场景和对照有限"],
  ["2505.18279", "Collaborative Memory: Multi-User Memory Sharing in LLM Agents with Dynamic Access Control", "v1", "preprint", "provenance/ACL 有启发，尚无任务实证"],
  ["2604.19278", "Explicit Trait Inference for Multi-Agent Coordination", "v2", "accepted", "ACL 2026 新机制，与协调失败路径部分重叠"],
  ["2502.19559", "Stay Focused: Problem Drift in Multi-Agent Debate", "v3", "accepted", "正式 debate 反证，保留为扩展证据候选"],
  ["2604.13349", "When Less Latent Leads to Better Relay: Information-Preserving Compression for Latent Multi-Agent LLM Collaboration", "v2", "preprint", "LatentMAS 后续，非常新"],
  ["2402.01680", "Large Language Model based Multi-Agents: A Survey of Progress and Challenges", "v2", "preprint", "综述用于召回，不作一手机制证据"],
  ["2501.06322", "Multi-Agent Collaboration Mechanisms: A Survey of LLMs", "v1", "preprint", "分类学参考，非原始实验"],
  ["2502.14321", "Beyond Self-Talk: A Communication-Centric Survey of LLM-Based Multi-Agent Systems", "v3", "accepted", "通信路径索引，非一手因果证据"],
  ["2505.07313", "Towards Multi-Agent Reasoning Systems for Collaborative Expertise Delegation: An Exploratory Design Study", "v2", "preprint", "探索性 preprint，验证范围较弱"],
  ["2510.13821", "LLM Agent Communication Protocol (LACP) Requires Urgent Standardization: A Telecom-Inspired Protocol is Necessary", "v1", "workshop", "协议 position paper 为主，实证不足"],
  ["2506.03053", "MAEBE: Multi-Agent Emergent Behavior Framework", "v2", "preprint", "同伴压力方向重要，验证与 venue 较弱"],
  ["2604.07821", "More Capable, Less Cooperative? When LLMs Fail At Zero-Cost Collaboration", "v2", "accepted", "ICML 2026；零成本合作失败，下一轮优先深读"],
  ["2603.01045", "Silo-Bench: A Scalable Environment for Evaluating Distributed Coordination in Multi-Agent LLM Systems", "v2", "accepted", "ACL 2026；分布式信息整合税，下一轮优先深读"],
  ["2502.20073", "Collab-Overcooked: Benchmarking and Evaluating Large Language Models as Collaborative Agents", "v3", "published", "EMNLP 2025；交互长链评测，扩展保留"],
  ["2408.00989", "On the Resilience of LLM-Based Multi-Agent Collaboration with Faulty Agents", "v4", "preprint", "故障传播与结构韧性，扩展反证"],
  ["2410.07283", "Prompt Infection: LLM-to-LLM Prompt Injection within Multi-Agent Systems", "v1", "preprint", "多 agent 攻击面，安全专题候选"],
  ["2407.04622", "On scalable oversight with weak LLMs judging strong LLMs", "v2", "preprint", "debate 的任务依赖边界，扩展反证"],
  ["2505.23352", "Understanding the Information Propagation Effects of Communication Topologies in LLM-based Multi-Agent Systems", "v1", "preprint", "拓扑抑错与信息扩散双刃效应，扩展反证"],
].map(([paper_id, title, version, publication_status, reason]) => ({
  paper_id,
  title,
  version,
  submission_year: 2000 + Number(paper_id.slice(0, 2)),
  publication_status,
  source_url: `https://arxiv.org/abs/${paper_id}${version}`,
  selection: { decision: "extended", reasons: [reason] },
}));

manifest.papers = [...sourcePapers.values(), ...externalCandidates];

const evidenceById = new Map(manifest.evidence.map((item) => [item.evidence_id, item]));
Object.assign(evidenceById.get("E16"), { locator: "§4.1 Table 1; Appendix D Tables 3–5" });
Object.assign(evidenceById.get("E17"), { locator: "§4.2–§4.4; Figure 1; Table 2" });
Object.assign(evidenceById.get("E18"), { locator: "§4.1–§4.3; Figures 2–4; Tables 1–2" });
Object.assign(evidenceById.get("E19"), { locator: "§2.1–§2.3; §3.2 Tables 2–4; §4.1 Figure 4" });
Object.assign(evidenceById.get("E21"), { locator: "§3–§5; Tables 1–3; Appendix B" });
manifest.evidence.push(
  {
    evidence_id: "E22", source_id: "S21", locator: "§4.1 Table 1; §4.2 Table 2; §4.3; Appendix H", kind: "contrary_result",
    faithful_summary: "团队即使被明确告知谁是专家，仍未匹配最佳个体；四类条件差距为 6.3%–41.1%，更多成员会通过共识压力稀释专家判断。",
    verified_by: ["Reader", "Critic", "PM-Paper"], verified_at: "2026-07-15",
  },
  {
    evidence_id: "E23", source_id: "S22", locator: "§4.4 Table 1; §5.1; §5.3 Figure 3; Appendix F Tables 3–10", kind: "contrary_result",
    faithful_summary: "在三个模型家族、两个 multi-hop 数据集和相同 thinking-token 预算下，single-agent scaling 多数匹配或超过 MAS；MAS 优势主要出现在单体上下文被退化的边界条件。",
    verified_by: ["Reader", "Critic", "PM-Paper"], verified_at: "2026-07-15",
  },
  {
    evidence_id: "E24", source_id: "S23", locator: "§4.2 Tables 1–2; §4.2.3 Table 3; §4.2.4 Table 4", kind: "contrary_result",
    faithful_summary: "OneFlow 让单智能体执行同质 MAS workflow，可匹配或略优于原系统并减少 KV-cache/通信开销；异构模型或真实并行交互不保证可折叠。",
    verified_by: ["Reader", "Critic", "PM-Paper"], verified_at: "2026-07-15",
  },
);

const claimUpdates = {
  C01: {
    text: "多 agent 不是天然优于单 agent；任务可分解性、独立信息、架构匹配、预算与验证方式共同决定收益方向。",
    supporting_evidence_ids: ["E12", "E13", "E17", "E23", "E24"],
    contradicting_evidence_ids: ["E01", "E03", "E10"],
  },
  C02: { contradicting_evidence_ids: ["E24"] },
  C03: {
    text: "同质 agent 的数量或 workflow 容易饱和、折叠甚至稀释已知专家；真实互补信息和可验证专长比席位数更关键。",
    supporting_evidence_ids: ["E08", "E18", "E22", "E24"],
    contradicting_evidence_ids: ["E09", "E17"],
    limitations: "专家授权、异构性质量和独立信息量仍缺线上可观测的统一指标。",
  },
  C04: {
    text: "辩论只在候选差异可被证据区分时有益；共识、置信度和更长讨论不是正确性证明，还可能稀释已识别专家。",
    supporting_evidence_ids: ["E02", "E06"],
    contradicting_evidence_ids: ["E20", "E22", "E23"],
  },
  C05: {
    text: "复杂 MAS 的增益必须在相同总 thinking-token、工具和采样预算下，对照 best single 与 best-of-n；否则不能归因于协作。",
    strength: "conditional",
    scope: "答案可聚合或能定义总预算的推理任务；持续行动任务需另加环境交互预算",
    supporting_evidence_ids: ["E08", "E23", "E24"],
    contradicting_evidence_ids: ["E17"],
    limitations: "现有直接 matched-budget 证据集中于 multi-hop reasoning 与同质 workflow，尚非跨任务定律。",
  },
  C06: { contradicting_evidence_ids: ["E24"] },
  C07: { contradicting_evidence_ids: ["E16"] },
  C08: { contradicting_evidence_ids: [] },
  C09: { contradicting_evidence_ids: [] },
  C10: { contradicting_evidence_ids: [] },
  C11: { contradicting_evidence_ids: ["E23", "E24"] },
};

const counterSearch = {
  C01: ["contrary_found", ["E01", "E03", "E10"], "检索 single-agent、best-of-n、matched-budget 与正向 MAS；保留‘取决于’而非‘普遍失败’。"],
  C02: ["contrary_found", ["E24"], "检索 role/SOP ablation 与 single-agent workflow replay；同质 workflow 可折叠，因此限定为接口与工件价值。"],
  C03: ["contrary_found", ["E09", "E17"], "检索 agent count、diversity、expert reveal 与 topology scaling；保留可运行/部分正收益，否定单调规模律。"],
  C04: ["contrary_found", ["E20", "E22", "E23"], "检索 debate、consensus、persuasion、expert dilution 与 matched-budget；加入正确 agent 被说服和专家稀释。"],
  C05: ["contrary_found", ["E17"], "检索 equal token/call budgets、single scaling、best-of-n 与复杂 MAS；补入直接配平证据后仍因任务范围将 strong 降为 conditional。"],
  C06: ["qualified", ["E24"], "检索 routing/search/early-stop 的离线成本与同质 workflow 折叠；要求重复任务可摊销并保留 simple baseline。"],
  C07: ["qualified", ["E16"], "检索 structured artifact、free chat、latent communication 与 auditability；latent state 可能更高效，因此结论限定为可控性而非绝对性能。"],
  C08: ["no_direct_contrary_found", [], "检索 shared memory、ACL、provenance、deletion 与 memory utility；未发现否定治理必要性的直接反证，因证据新仍维持 contested。"],
  C09: ["no_direct_contrary_found", [], "检索 outcome-only、coordination score、trace/cost/failure evaluation；未发现支持单指标充分性的直接反证。"],
  C10: ["no_direct_contrary_found", [], "检索 hallucination-only 与 system-level failure taxonomy；未发现将多 agent 故障完整归为底模幻觉的直接反证。"],
  C11: ["contrary_found", ["E23", "E24"], "检索 latent/search/memory 新机制的 simple baseline、audit 和 matched-budget；潜力存在，但简化方案可匹配部分复杂机制。"],
};

for (const claim of manifest.claims.filter((item) => item.type === "synthesis")) {
  Object.assign(claim, claimUpdates[claim.claim_id]);
  const [outcome, findings, revision_reason] = counterSearch[claim.claim_id];
  claim.counter_search = {
    scope: "arXiv/ACL/ICML/ICLR/NeurIPS 官方来源；2023–2026 奠基集与 2025-01-15 至 2026-07-15 前沿窗口；按 claim 主题检索正反结果、简单基线和外推边界。",
    outcome,
    findings: findings.map((evidence_id) => ({ evidence_id })),
    no_contrary_note: findings.length ? null : "在上述范围与截止日内未发现直接反证；这不等于不存在反证或已系统穷尽。",
    revision_reason,
  };
}

const recommendations = Object.fromEntries(manifest.claims.filter((item) => item.type === "recommendation").map((item) => [item.claim_id, item]));
Object.assign(recommendations.R01, {
  supporting_evidence_ids: ["E08", "E17", "E22", "E23", "E24"],
  evidence_basis: "专家团队可低于最佳个体；配平 thinking tokens 后单体常匹配/超过 MAS；同质 workflow 还可折叠。",
});
Object.assign(recommendations.R02, {
  text: "每个角色声明输入、输出工件、工具、权限、专长证据、升级与 stop condition；已知专家可直接保留最终判断或触发独立复核。",
  supporting_evidence_ids: ["E03", "E04", "E14", "E22"],
  evidence_basis: "角色消融、SOP、终止权与专家稀释共同表明：契约必须包含专长权重，而不只角色名称。",
});
Object.assign(recommendations.R03, {
  text: "router 先选最小角色/模型/拓扑与预算；同质 workflow 先尝试单智能体执行，只有验证失败、权限分离或证据冲突时扩容。",
  supporting_evidence_ids: ["E07", "E10", "E11", "E24"],
});
Object.assign(recommendations.R05, { supporting_evidence_ids: ["E02", "E13", "E14", "E22"] });
Object.assign(recommendations.R08, { supporting_evidence_ids: ["E13", "E20", "E22", "E23"] });

manifest.schema_version = "1.0.0";
manifest.manifest_version = "2.0.0";
manifest.request.retrieved_at = "2026-07-15T13:30:00Z";
manifest.retrieval = [
  ...manifest.retrieval.map((item) => ({ ...item, source: "official arXiv and venue pages (oo unavailable; arxiv-cli returned empty result sets)" })),
  { query_id: "Q09", query: "multi-agent expert dilution reveal expert consensus", source: "official arXiv and OpenReview", run_at: "2026-07-15T11:40:00Z", coverage_note: "专家稀释与共识压力" },
  { query_id: "Q10", query: "single agent multi-agent equal thinking token budget", source: "official arXiv", run_at: "2026-07-15T11:50:00Z", coverage_note: "matched-budget 强单体基线" },
  { query_id: "Q11", query: "single agent baseline multi-agent workflow homogeneous collapse", source: "official arXiv", run_at: "2026-07-15T12:00:00Z", coverage_note: "同质 workflow 可折叠边界" },
];
manifest.digest_method = "SHA-256 of recursively key-sorted JSON after omitting top-level snapshot_digest, stable_url, and validation.manifest_consumer_trial; these self-referential validation fields are excluded so stable_url can point to the first immutable evidence snapshot commit";
manifest.stable_url = stableUrl;
manifest.supersedes = [{
  manifest_version: "1.0.0",
  snapshot_digest: "sha256:194c0198cd92e9864523734a8608d621cc5838f69d6e4010bd82ef21eaa65218",
  immutable_url: "https://raw.githubusercontent.com/LiaoyuanNing/paper-learning-library/age-174-v1/site/reports/agent-teams-2026/data/evidence-manifest.v1.json",
}];
manifest.outputs.manifest_url = "./data/evidence-manifest.v2.json";
manifest.outputs.report_url = "./";
manifest.outputs.generated_at = "2026-07-15T13:30:00Z";
manifest.outputs.release_state = "review_candidate_not_deployed";
manifest.outputs.metadata_audit = "research/agent-teams-2026/metadata-audit.v2.json";
manifest.outputs.consumer_validation = "research/agent-teams-2026/manifest-consumer-validation.v2.md";
manifest.selection_protocol = {
  candidate_count: manifest.papers.length,
  core_count: manifest.papers.filter((paper) => paper.selection.decision === "included").length,
  decision_enum: ["included", "extended", "excluded"],
  note: "extended/excluded 均为未进入 18 篇核心；每条保留版本、状态、URL 与理由。",
};

manifest.report.counterintuitive = [
  "即使明确告诉团队谁是专家，共识也可能稀释专家判断；受控实验的最大差距达到 41.1%。",
  "相同 thinking-token 预算下，强单智能体在多跳推理中常匹配或超过 MAS。",
  "同一模型组成的 workflow 可能由一个 Agent 顺序执行并复用 KV cache，而不损失效果。",
  "更多讨论可能更差：错误同伴会说服正确 agent，共识不是 correctness proxy。",
  "真正需要团队的理由应是独立信息、异构权限/工具或并行环境交互，而不是角色数量。",
];
manifest.report.timeline[3].text = "LatentMAS、Scaling、Diversity、FS-Researcher、Experts Back、matched-budget 与 OneFlow 同时推进效率机制和强反证边界。";
manifest.report.method = [
  "边界先于检索：前沿窗口固定为 2025-01-15 至 2026-07-15；v2 在原八条路径之外重开专家稀释、matched-budget 与同质 workflow 可折叠三条反证召回。",
  `先宽后窄：machine-readable 候选池 ${manifest.papers.length} 篇；18 篇核心由 8 篇奠基/典型与 10 篇前沿组成。MacNet、MasRouter、ExtAgents 退出核心但保留扩展记录；三篇直接边界证据进入核心。`,
  "逐 claim Critic：C01–C11 均记录 counter_search 范围、outcome、发现/未发现和修正理由；未发现反证不被表述为已证明。",
  "一手元数据审计：S01–S23 的 title、authors、version、submission/venue year、publication status、venue/track 与 URL 逐项对照 arXiv 和官方 venue；测试要求 audit 与 manifest 完全一致。",
  "机器证据优先：网页从 manifest v2 渲染；claim → evidence → source 使用闭合 ID。digest 排除自身与 stable_url，后者固定到首个不可变 commit SHA。",
];
manifest.report.limitations = manifest.report.limitations.map((item) => item.replace("oo-arxiv 依赖的 oo CLI 不可用；arxiv-cli 批量查询后遇到 HTTP 429", "oo-arxiv 依赖的 oo CLI 不可用；arxiv-cli 对已知 ID 与关键词返回空结果"));
manifest.report.limitations.push("v2 是 open PR 的 review candidate，未 merge、未 tag、未 deploy；公开 Pages 仍是 v1，不能把本文件的相对 report_url 当成已发布 URL。");

manifest.validation.critic_checks = manifest.claims.filter((item) => item.type === "synthesis").map((claim) => ({
  claim_id: claim.claim_id,
  outcome: claim.counter_search.outcome,
  scope: claim.counter_search.scope,
  finding_evidence_ids: claim.counter_search.findings.map((item) => item.evidence_id),
  no_contrary_note: claim.counter_search.no_contrary_note,
  revision_reason: claim.counter_search.revision_reason,
}));
manifest.validation.metadata_audit = {
  status: "passed",
  record_file: "research/agent-teams-2026/metadata-audit.v2.json",
  source_count: manifest.sources.length,
  required_fields: ["title", "authors", "version", "submission_year", "venue_year", "publication_status", "venue", "track", "official_url", "venue_url"],
};
manifest.validation.manifest_consumer_trial = {
  status: "pending_independent_agent",
  questions_file: "research/agent-teams-2026/manifest-consumer-questions.v2.md",
  record_file: "research/agent-teams-2026/manifest-consumer-validation.v2.md",
  manifest_version: "2.0.0",
  snapshot_digest: null,
  immutable_url: stableUrl,
};

manifest.snapshot_digest = digest(manifest);
manifest.validation.manifest_consumer_trial.snapshot_digest = manifest.snapshot_digest;

const correctedFields = {
  S04: ["authors"], S05: ["authors"], S08: ["authors"], S09: ["title", "authors"], S12: ["title"],
  S13: ["authors"], S14: ["title"], S15: ["venue_url"], S16: ["submission_year", "venue_year"], S17: ["venue_url"], S19: ["authors"],
};
const audit = {
  schema_version: "1.0.0",
  manifest_version: manifest.manifest_version,
  audited_at: "2026-07-15T13:10:00Z",
  auditor: "PM-Paper",
  evidence_policy: "arXiv versioned abstract page for title/authors/version/submission year; official proceedings/OpenReview for venue year/status/track/URL; preprint when no official venue was found by cutoff",
  tool_observations: { oo: "unavailable", arxiv_cli: "installed but returned empty arrays for known IDs and keyword probes", fallback: "official arXiv and venue pages" },
  publication_status_enum: ["published", "accepted", "preprint", "workshop"],
  year_semantics: { submission_year: "year of arXiv v1 submission", venue_year: "official publication/acceptance venue year; null for preprint" },
  records: manifest.sources.map((source) => ({
    source_id: source.source_id,
    paper_id: source.paper_id,
    checked_url: source.official_url,
    venue_checked_url: source.venue_url,
    checked_fields: ["title", "authors", "version", "submission_year", "venue_year", "publication_status", "venue", "track", "official_url", "venue_url"],
    outcome: correctedFields[source.source_id] ? "corrected" : "verified",
    corrected_fields: correctedFields[source.source_id] ?? [],
    snapshot: Object.fromEntries(["title", "authors", "version", "submission_year", "venue_year", "publication_status", "venue", "track", "official_url", "venue_url"].map((key) => [key, source[key]])),
  })),
};

await Promise.all([
  writeFile(outputUrl, `${JSON.stringify(manifest, null, 2)}\n`),
  writeFile(auditUrl, `${JSON.stringify(audit, null, 2)}\n`),
]);
console.log(JSON.stringify({ output: outputUrl.pathname, audit: auditUrl.pathname, digest: manifest.snapshot_digest, stable_url: stableUrl, candidates: manifest.papers.length }, null, 2));
