# 论文学习库 / Paper Learning Library

面向 arXiv 学习的静态 MVP 阅读页。它展示元数据、原始摘要、中文学习摘要、学习亮点和原文链接；不存储或渲染论文全文。

## 前沿研究报告

- [Agent Team 前沿研究：组建更多 Agent，不等于拥有更好的团队](https://liaoyuanning.github.io/paper-learning-library/reports/agent-teams-2026/)
- [机器可读证据包 v2](https://liaoyuanning.github.io/paper-learning-library/reports/agent-teams-2026/data/evidence-manifest.v2.json)

报告正文直接从 v2 evidence manifest 渲染；每条综合主张必须闭合到 evidence 与固定版本的一手来源。v2 包含 49 篇 machine-readable 候选、18 篇核心、27 个来源与 28 条 evidence，并配有独立 evidence snapshot/consumer attestation；v1 保留为 superseded 历史版本。

## 本地验证与预览

需要 Node.js 18 或更新版本。

```bash
npm run check
npm run preview
```

打开终端显示的地址（默认 `http://127.0.0.1:4173`）。可直接打开单篇详情，例如 `http://127.0.0.1:4173/?paper=2210.03629`。

`npm run check` 会验证 8 条阅读基线记录、唯一 arXiv ID、必填字段、四条学习亮点、不存全文姿态，以及 v2 研究证据包的 49 篇候选、18 篇核心、27 个来源、28 条 evidence、长期知识指针与独立消费契约。它也会拒绝缺 provenance / review 的公开 AI 内容、未许可全文、test/mock/fake 内容、AI/raw 混写，并校验 AGE-174 v2 的 sidecar 治理登记没有改动 digest-covered payload。`site/` 是 GitHub Pages 的直接发布目录。

## 本地学习工作流（AGE-24）

阅读状态（待阅读、阅读中、已读、已归档）、自定义标签、纯文本笔记、AI 中文摘要/学习亮点审核结论和保存的筛选组合均只保存在当前浏览器的 `localStorage`。它们以 canonical arXiv ID 为键，采用版本化 schema；无效或旧数据会安全回退为空状态，且不会影响 8 篇基线论文。清除浏览器数据、使用隐私模式或换设备后，这些学习数据不会保留。

来源主题和 arXiv 分类始终来自静态数据；自定义标签不会改写 `site/data/`。笔记按文本安全转义后显示，不作为 HTML 注入。`npm test` 覆盖学习数据 CRUD、组合筛选、saved view、刷新持久化、损坏存储恢复和 XSS 文本边界。

## 数据与 AI 披露

数据来自经独立验收的 AGE-23 附件 `paper_learning_mvp_sample.json`。公开页将原始 arXiv 字段与 AI 生成中文内容分区显示，并保留生成日期、模型 / provider、工作流版本、输入证据、发布审核与 `full_text_stored=false` 版权姿态。完整操作政策见 [`docs/ai-provenance-review-copyright-policy.md`](docs/ai-provenance-review-copyright-policy.md)，审核时可复制 [`docs/ai-review-checklist.md`](docs/ai-review-checklist.md)。

历史记录无法恢复精确模型 slug，因此页面统一显示 `unknown (runtime default)`，不猜测具体模型；每条都在 policy v1 的显式 grandfathered 记录下发布。新内容不得使用这项豁免。若需把其他预政策数据迁移到同一契约，运行 `npm run migrate:governance`，再运行 `npm run check`。

## 可重复的 arXiv 采集（AGE-21）

阅读页的 8 条基线数据保持在 `site/data/`；采集 pipeline 只写入单独的 `data/arxiv-ingestion/`（已被 Git 忽略），因此未经 review 的条目和测试用的 fake AI 内容不会公开发布。程序会在创建任何文件前拒绝 `site/` 及其子目录（包括符号链接解析后的路径）。默认只存 arXiv 元数据、摘要、来源链接、来源证据与 AI enrichment；不会下载 PDF 或全文。

先按 `docs/ingestion-runbook.md` 安装并实测 `arxiv-cli-tools`，随后可运行：

```bash
# 单篇 ID / 版本；ARXIV_CLI_BIN 适用于未加入 PATH 的本地安装
ARXIV_CLI_BIN="$HOME/Library/Python/3.9/bin/arxiv-cli" npm run ingest -- id 2210.03629v3

# 显式 query + limit，也支持 repeatable author/category 条件
ARXIV_CLI_BIN="$HOME/Library/Python/3.9/bin/arxiv-cli" npm run ingest -- search \
  --query "agent reasoning" --limit 2 --category cs.AI

# 由配置批量执行 paper IDs、topics/query、authors 与 categories
ARXIV_CLI_BIN="$HOME/Library/Python/3.9/bin/arxiv-cli" npm run ingest -- config \
  --config config/arxiv-ingest.example.json

# 查看所有 ingestion / translation / highlight / review / publish 状态
npm run ingest -- status

# 仅重试可重试的失败 AI 任务；没有凭据时会重新排入可观察的 pending
npm run ingest -- retry --job translation

# 失败采集只会重试每条 lineage 的最新失败叶节点；重试会生成子审计 run 并退役父 run
ARXIV_CLI_BIN="$HOME/Library/Python/3.9/bin/arxiv-cli" npm run ingest -- retry --job ingestion
```

相同 canonical arXiv ID + version 会追加不可变来源 capture 而不会新增 paper/version；normalized record 永远指向首次生成它的 `capture_id`，最新 capture 则由 index 单独记录。每个 capture 保存 allowlist 投影的 SHA-256、关联的原始 provider payload SHA-256、实际 adapter/runtime/distribution/module 指纹，以及脱敏的候选 ID/version+payload hash；`raw_metadata` 仅保留 allowlist 元数据，任何全文/body/content 字段都会在整批写入前被拒绝。新版本会保留独立版本文件，并按版本顺序重建 `supersedes` / `superseded_by` 关系。指定历史版本只有在 adapter 返回相同 ID + version 时才会入库；绝不会以当前版本替代历史版本。`--adapter fixture` 和 `--ai-mode fake|fail:translation|fail:highlight` 是测试专用选项，不能作为正式采集或发布内容来源。完整命令、来源证据结构、adapter 选择与限制见 runbook。

## 发布

推送到 `main` 会由 GitHub Actions 将 `site/` 发布到 GitHub Pages：

https://liaoyuanning.github.io/paper-learning-library/

仓库不应提交 secrets、`.env`、令牌、论文全文或未经许可的源文档。
