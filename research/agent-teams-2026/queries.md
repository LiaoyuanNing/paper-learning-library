# Retrieval protocol

- 截止日：2026-07-15
- “近 18 个月”：2025-01-15 至 2026-07-15
- 范围：有通信/行动/持续状态的 LLM agent team；经典 MARL、纯 ensemble、纯人类团队不系统覆盖
- 工具：优先 oo-arxiv；本环境缺 `oo`，回退 `arxiv-cli`。CLI 对部分已知 ID 返回空结果时，转为逐篇 arXiv 与正式 venue 官方页核验。

## 实际查询

```text
LLM multi-agent collaboration
large language model multi-agent communication
large language model agent debate consensus
LLM agent dynamic team routing
multi-agent LLM benchmark collaboration
LLM multi-agent shared memory
LLM agent orchestration planning
LLM multi-agent safety failure
multi-agent expert dilution reveal expert consensus
single agent multi-agent equal thinking token budget
single agent baseline multi-agent workflow homogeneous collapse
zero-cost collaboration capability protocol incentive LLM agents
distributed coordination communication reasoning gap multi-agent LLM
HiddenBench hidden profile collective reasoning multi-agent
LatentMAS learned alignment matrix identity no transfer
```

概念复核：

```text
("large language model" OR LLM) AND ("multi-agent" OR "agent team")
AND (role OR specialization OR "division of labor")

... AND (communication OR coordination OR "message passing")
... AND (memory OR workspace OR provenance OR "shared state")
... AND (planning OR decomposition OR orchestrator)
... AND (debate OR critique OR consensus OR persuasion)
... AND (dynamic OR routing OR architecture search OR topology)
... AND (scaling OR diversity OR "agent count")
... AND (benchmark OR evaluation OR taxonomy)
... AND (safety OR failure OR drift OR attack)
```

## 筛选规则

核心集合按直接相关性、机制代表性、对照实验、跨任务证据、正式 venue、artifact 和与其他论文的互补性选择。新论文不自动优先；preprint 必须降级；同一数字在不同版本变化时只引用截止日最新版。
