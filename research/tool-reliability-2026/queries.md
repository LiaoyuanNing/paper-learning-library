# Retrieval protocol

- cutoff：2026-08-03T23:59:59+08:00；主体窗口：2023-01-01 至 cutoff。
- 范围：tool use、web/retrieval、citation/evidence verification、long-horizon evaluation、失败模式。
- 排除：无 agent/tool loop 的一般 RAG、纯 prompt 技巧、无实验产品宣称。
- core 目标 12–18。本候选没有执行可审计的完整 candidate scan，因此不声称 candidate cap、留存率或连续无变化停止信号。

实际检索簇：`tool-use API retrieval evaluation`、`web agent real environment execution evaluation`、`long-horizon reliability pass@k`、`deep research factual grounding citation verification`。

首选 oo-arXiv；本运行中 `oo` 不可执行，因此回退各篇官方 arXiv abstract page。arxiv-cli 的关键词检索曾返回无关最新条目，未将其作为事实来源。
