# Candidate ledger

“扩展”表示不进入 18 篇核心集合，不表示论文无价值。核心中的 `More Agents` 被明确标注为无通信 ensemble，用作强制基线而非团队协作证据。

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
| 9 | MacNet / 2406.07155 | 拓扑、规模 | 核心 | 大规模 DAG；需与负规模研究对读 |
| 10 | MaAS / 2502.04180 | 架构搜索 | 核心 | 查询条件化 supernet 与成本目标 |
| 11 | MasRouter / 2502.11133 | 联合路由 | 核心 | 模式、角色、模型的级联路由 |
| 12 | MultiAgentBench / 2503.01935 | 评测 | 核心 | 任务、里程碑、通信与拓扑联合评估 |
| 13 | Why Do Multi-Agent LLM Systems Fail? / 2503.13657 | 失败 | 核心 | 1,642 traces；14 类 taxonomy |
| 14 | ExtAgents / 2505.21471 | 分布式上下文 | 核心 | 超上下文知识分片与聚合 |
| 15 | LatentMAS / 2511.20639 | latent 通信 | 核心 | 连续状态协作与通信效率 |
| 16 | Towards a Science of Scaling Agent Systems / 2512.08296 | 规模效应 | 核心 | 等提示/工具/计算受控的正负结果 |
| 17 | Understanding Agent Scaling via Diversity / 2602.03794 | 多样性 | 核心 | 有效信息通道解释同质饱和 |
| 18 | FS-Researcher / 2602.01566 | 持久工件 | 核心 | 文件系统作共享协调介质 |
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

## Critic 补充的后续候选

本轮未改变冻结的 18 篇核心集，但下一版优先复核：Multi-Agent Teams Hold Experts Back（2602.01011v4）、Zero-Cost Collaboration（2604.07821v2）、SILO-BENCH（2603.01045v2）、Collab-Overcooked（2502.20073v3）、Faulty Agents（2408.00989v4）、Prompt Infection（2410.07283v1）、Scalable Oversight（2407.04622v2）、Communication Topologies（2505.23352v1）。它们分别补专家稀释、合作性、规模协调税、长链、故障传播、攻击面、debate 边界与拓扑双刃效应。
