# Candidate ledger

“扩展”表示不进入 18 篇核心集合，不表示论文无价值。v2 两次重开召回后，核心仍为 18 篇；完整 49 条版本/状态/决定/理由以 machine-readable manifest v2 为准。核心中的 `More Agents` 被明确标注为无通信 ensemble，用作强制基线而非团队协作证据。

| # | 论文 / arXiv | 路径 | 决定 | 理由 |
|---:|---|---|---|---|
| 1 | CAMEL / 2303.17760 | 角色、通信 | 核心 | 双角色早期代表；正式 venue；直接对照 |
| 2 | Multiagent Debate / 2305.14325 | 辩论 | 核心 | 干净的同模型逐轮 debate 基线 |
| 3 | ChatDev / 2307.07924 | 角色、SOP | 核心 | 完整软件流水线；消融与成本 |
| 4 | MetaGPT / 2308.00352 | SOP、工件 | 核心 | 结构化交接与执行反馈代表 |
| 5 | AutoGen / 2308.08155 | 编排 | 核心 | 对话、工具、人类和代码统一接口 |
| 6 | ReConcile / 2309.13007 | 异构辩论 | 核心 | 多样模型、置信度与说服过程 |
| 7 | DyLAN / 2310.02170 | 动态组队 | 核心 | 选人、动态网络与早停 |
| 8 | More Agents Is All You Need / 2402.05120 | 规模基线 | 核心 | 无通信 sampling ensemble；复杂 MAS 必须超过的基线 |
| 9 | MacNet / 2406.07155 | 拓扑、规模 | 扩展 | 大规模 DAG 保留；由 matched-budget 与专家稀释直接边界替换核心席位 |
| 10 | MaAS / 2502.04180 | 架构搜索 | 核心 | 查询条件化 supernet 与成本目标 |
| 11 | MasRouter / 2502.11133 | 联合路由 | 扩展 | 预印本且与 MaAS/DyLAN 机制重叠 |
| 12 | MultiAgentBench / 2503.01935 | 评测 | 核心 | 任务、里程碑、通信与拓扑联合评估 |
| 13 | Why Do Multi-Agent LLM Systems Fail? / 2503.13657 | 失败 | 核心 | 1,642 traces；14 类 taxonomy |
| 14 | ExtAgents / 2505.21471 | 分布式上下文 | 扩展 | 保留超上下文分片证据；由 matched-budget 直接反证替换核心席位 |
| 15 | LatentMAS / 2511.20639 | latent 通信 | 核心 | 连续状态协作与通信效率 |
| 16 | Towards a Science of Scaling Agent Systems / 2512.08296 | 规模效应 | 核心 | 等提示/工具/计算受控的正负结果 |
| 17 | Understanding Agent Scaling via Diversity / 2602.03794 | 多样性 | 扩展 | workshop 机制证据保留；核心席位让给 2026 顶会直接协调失败研究 |
| 18 | FS-Researcher / 2602.01566 | 持久工件 | 扩展 | ACL 专门研究编排证据保留；主题直接性弱于分布式协调失败研究 |
| 18A | Multi-Agent Teams Hold Experts Back / 2602.01011 | 专家稀释 | 核心 | ICML 2026；揭示已知专家仍被共识稀释，最大差距 41.1% |
| 18B | Single-Agent LLMs Outperform MAS / 2604.02460 | matched-budget | 核心 | equal thinking-token 直接对照，约束 C05 |
| 18C | Rethinking the Value of Multi-Agent Workflow / 2601.12307 | workflow 折叠 | 核心 | 强单体 baseline；同质 workflow 可折叠 |
| 18D | More Capable, Less Cooperative? / 2604.07821 | 零成本合作 | 核心 | ICML 2026；分离能力与合作，含协议/微激励干预 |
| 18E | Silo-Bench / 2603.01045 | 分布式协调 | 核心 | ACL 2026；30 任务、54 配置、1,620 实验揭示 Communication–Reasoning Gap |
| 18F | Systematic Failures in Collective Reasoning under Distributed Information in Multi-Agent LLMs（HiddenBench）/ 2505.11556v4 | 隐藏信息整合 | 扩展反证 | ICML 2026；65 任务、15 模型的 accuracy 结果直接揭示分布式信息整合失败，与核心 Silo-Bench 边界高度重叠 |
| 19 | AgentVerse / 2308.10848 | 动态组合 | 扩展反证 | 与 AutoGen/DyLAN 重叠；保留错误同伴案例 |
| 20 | AutoAgents / 2309.17288 | 自动组队 | 扩展 | 前驱意义强，证据弱于 MaAS/DyLAN |
| 21 | AgentScope / 2402.14034 | 平台工程 | 扩展 | 基础设施贡献为主，机制因果较弱 |
| 22 | GPTSwarm / 2402.16823 | 可优化 agent graph | 扩展 | 重要前驱，后续 MaAS 覆盖更多 |
| 23 | Mixture-of-Agents / 2406.04692 | 分层聚合 | 扩展 | token 聚合，不是持续行动团队 |
| 24 | VillagerAgent / 2406.05720 | 分解、状态 | 扩展 | Minecraft 单域色彩强 |
| 25 | AgentPrune / 2410.02506 | 通信剪枝 | 扩展 | 价值高，核心优先系统级失败研究 |
| 26 | Magentic-One / 2411.04468 | 编排、工具 | 扩展 | 工程基线强，但机制隔离与正式 venue 较弱 |
| 27 | Enterprise Multi-Agent Collaboration / 2412.05449 | 企业工作流 | 扩展 | 专有系统、场景和对照有限 |
| 28 | Collaborative Memory / 2505.18279 | 权限化记忆 | 扩展 | provenance/ACL 有启发，尚为 preprint |
| 29 | Explicit Trait Inference / 2604.19278 | 伙伴建模 | 扩展 | 很新，与协调失败路径部分重叠 |
| 30 | Stay Focused / 2502.19559 | 辩论漂移 | 扩展 | 作为 debate 反例阅读 |
| 31 | When Less Latent Leads to Better Relay / 2604.13349 | latent 压缩 | 扩展 | LatentMAS 后续，非常新 |
| 32 | LLM-based Multi-Agents: A Survey / 2402.01680 | 综述 | 扩展 | 扩展检索，不作一手机制证据 |
| 33 | Multi-Agent Collaboration Mechanisms: A Survey / 2501.06322 | 综述 | 扩展 | 分类学参考，非原始实验 |
| 34 | Beyond Self-Talk / 2502.14321 | 通信综述 | 扩展 | 通信路径索引 |
| 35 | Expertise Delegation / 2505.07313 | 专长委派 | 扩展 | 探索性 preprint，artifact/验证较弱 |
| 36 | LACP / 2510.13821 | 通信协议 | 扩展 | protocol proposal 为主，实证不足 |
| 37 | MAEBE / 2506.03053 | 同伴压力、安全 | 扩展 | 方向重要，验证范围与 venue 较弱 |

## Critic 补充与 v2 决定

v2 已把 Multi-Agent Teams Hold Experts Back（2602.01011v4）、matched-budget（2604.02460v2）、strong single-agent workflow baseline（2601.12307v1）、Zero-Cost Collaboration（2604.07821v2）和 Silo-Bench（2603.01045v2）纳入核心。HiddenBench（2505.11556v4）保留扩展但进入正式证据链；CompLearn 2026 的 LatentMAS 复核作为非 arXiv source/evidence 纳入，不计入 49 篇 arXiv 候选池。
