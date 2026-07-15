# AI provenance、审核与版权操作政策

版本：1.0.0  
生效：2026-07-15  
适用范围：Paper Learning Library 的公开阅读数据、采集 pipeline、Agent-first 研究报告及其后续版本。

这是一份产品与工程操作政策，不是法律意见。许可、合同、隐私或司法辖区问题不明确时，采用链接优先、正文不入库的保守路径，并将需要法律顾问裁决的问题单独记录。

## 内容边界与可发布条件

| 内容类型 | 可存储 / 发布 | 禁止项与保留 / 纠错 |
| --- | --- | --- |
| arXiv / venue 原始元数据 | 可存标题、作者、版本、分类、日期、官方 URL 与检索时间；记录来源 URL 和 capture。 | 不让 AI 覆盖或伪装为原始字段。按来源版本保留；发现错误时新增更正记录并保留指向旧 capture 的关系。 |
| 原始摘要 | 只存一手页面已公开的摘要，并记录来源 URL / 检索时间。 | 不以摘要字段承载翻译、亮点或生成结论；来源撤回或纠错时更新链接并标记受影响衍生内容。 |
| 短证据定位 | 可存必要的 locator、表号、节号、短摘要和 URL，用于支持 claim。 | 不复制足以代替原文阅读的长段落；保留到对应 claim 撤回或替换后，随后删除或作撤回标记。 |
| AI 译文 | 仅在 `generated_at`、精确 `source_model`、`provider`、`workflow_version`、输入证据指针和 `review` 齐全且审核 `approved` 后发布。 | 不改变限定语、数字、否定或引用可达性；发生偏差时 `rejected` 或 `regenerate`，保留理由及替换 / 撤回关系。 |
| AI 学习亮点 | 与译文采用相同 provenance 与审核门槛；每条必须可回指到摘要或短证据。 | 不伪装成作者结论或原始元数据；无证据、低置信或来源冲突时不得发布。 |
| Agent-first claim / synthesis | 只存 claim、强度、claim → evidence → source 链、反证、范围与 immutable snapshot。版本化 manifest 必须通过 digest 校验。 | 不把推断写成论文事实。长期知识 promotion 必须先经 Librarian 去重与复核，不得绕过该步骤。 |
| PDF / 全文 | 默认不下载、不存储、不在公开数据或 Pages 产物中出现 body、raw text、PDF content 等字段。只有逐条记录明确的 `license_id`、`reuse_basis`、`verified_at` 与 `verified_source` 后，才可将 `full_text_stored=true`。 | `full_text_stored:false` 本身不是许可证明；许可不明、撤回或复用依据失效时删除正文副本，保留最小审计记录和原文链接。 |
| 用户笔记 | 仅保存在用户本地浏览器，用户可自行编辑或删除。 | 不上传到公开数据或研究 manifest；清除浏览器数据即删除。若将来同步，须单独取得同意并定义 TTL / 删除接口。 |

## 统一 provenance 与审核契约

每个可发布 AI artifact（译文、亮点、研究综合、后续报告）必须包含：

```json
{
  "generated_at": "2026-07-15T12:34:56Z",
  "source_model": "provider/model-version",
  "provider": "Provider name",
  "workflow_version": "workflow-vN",
  "input_evidence": [{ "kind": "arxiv_abstract", "url": "https://…" }],
  "review": {
    "status": "approved",
    "reviewer": "role or accountable reviewer",
    "reviewed_at": "2026-07-15T13:00:00Z",
    "reason": "evidence and wording checked",
    "replaces": null,
    "withdrawn_by": null
  }
}
```

允许的审核状态是 `pending`、`approved`、`rejected`、`regenerate`。公开页面只显示 `approved` 内容。`rejected` / `regenerate` 必须写明审核人、时间、理由；发生替换或撤回时，以 `replaces` / `withdrawn_by` 指向关联 artifact。原始字段和 AI 字段必须物理分层：阅读记录的 AI 字段只能位于 `ai_generated`，不得写进 arXiv / venue 原始字段。

以下情形必须拒绝或再生成：证据不支持、来源冲突、低置信、译文改变限定语 / 数字 / 否定、引用不可达、模型身份未知（除下述受限历史豁免）、或发现 test/mock/fake 内容。

## 历史兼容与不可变资产

历史内容若无法恢复精确模型，只能使用字面值 `unknown (runtime default)`，并同时携带显式 `legacy_grandfathered` 记录（批准标记、原因和登记时间）。该豁免只服务于已发布历史资产，绝不适用于新生成内容；provider、工作流、证据与审核信息仍须尽可能明确，不能补猜模型版本。

AGE-174 `age-174-v2` manifest 和 evidence snapshot 是 digest-covered immutable 资产，不能为补字段而改写。它的 provenance、审核、promotion 约束和 digest 绑定记录在 `governance/agent-research-governance.v1.json`；门禁会验证 registry 与 immutable snapshot 的一致性。后续版本必须新建版本化 manifest / snapshot，不能改写该版本。

## 发布门禁、纠错与回滚

`npm run check` 会拒绝以下公开产物：缺生成时间、模型、provider、工作流、输入证据或审核状态的 AI 内容；未批准内容；无许可的全文；test/mock/fake 内容；AI / raw 混写；以及常见全文、PDF、raw body 字段。采集 pipeline 的 fake 模式只能留在隔离的 pipeline store，不能复制到 `site/data`、报告 manifest 或 Pages。

审核者可按 [`ai-review-checklist.md`](./ai-review-checklist.md) 复核。纠错时：停止发布受影响 artifact → 记录 `rejected` 或 `regenerate` 与原因 → 生成并独立审核替代版本 → 设置 `replaces` / `withdrawn_by` → 重新运行 `npm run check`。若需回滚，恢复上一份已审核的 git revision 或将内容撤回为仅原文链接；不得修改已发布的 immutable snapshot。
