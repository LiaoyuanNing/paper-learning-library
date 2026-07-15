# AI 内容审核清单

复制以下清单到审核记录的 `reason` 或关联 issue：

- [ ] 原始字段、AI 译文 / 亮点、研究 claim 在数据结构和界面中分区。
- [ ] `generated_at`、精确模型、provider、工作流版本和输入证据指针均存在且可访问。
- [ ] 译文未改变数字、限定语、否定关系或可核验引用；亮点能回指到来源。
- [ ] claim 有 claim → evidence → source、强度、范围与反证；immutable snapshot digest 仍匹配。
- [ ] 未发现低置信、来源矛盾、不可达引用、test/mock/fake 痕迹或未授权全文。
- [ ] `review` 记录审核人、时间、结论与理由；替换 / 撤回时填写关系字段。
- [ ] 拟进入长期知识的内容已提交 Librarian 去重与复核，不以报告审核替代知识库审核。

拒绝示例：译文把「may improve」写成「能够提升」；高亮宣称摘要未报告的百分比；模型只有 `runtime default` 而没有历史豁免；`full_text_stored=true` 但无可核验许可。

再生成示例：来源链接恢复后重新生成；补入相反证据后重写综合；模型 / provider 或工作流版本无法精确追溯时，以受控新生成替代而不是猜测旧值。
