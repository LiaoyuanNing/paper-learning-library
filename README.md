# 论文学习库 / Paper Learning Library

面向 arXiv 学习的静态 MVP 阅读页。它展示元数据、原始摘要、中文学习摘要、学习亮点和原文链接；不存储或渲染论文全文。

## 本地验证与预览

需要 Node.js 18 或更新版本。

```bash
npm run check
npm run preview
```

打开终端显示的地址（默认 `http://127.0.0.1:4173`）。可直接打开单篇详情，例如 `http://127.0.0.1:4173/?paper=2210.03629`。

`npm run check` 会验证 8 条记录、唯一 arXiv ID、必填字段、四条学习亮点、不存全文姿态，以及阅读页的关键筛选/披露标记。`site/` 是 GitHub Pages 的直接发布目录。

## 数据与 AI 披露

数据来自经独立验收的 AGE-23 附件 `paper_learning_mvp_sample.json`。公开页将原始 arXiv 字段与 AI 生成中文内容分区显示，并保留生成日期、数据集来源与 `full_text_stored=false` 版权姿态。

历史记录无法恢复精确模型 slug，因此页面统一显示 `unknown (runtime default)`，不猜测具体模型。

## 发布

推送到 `main` 会由 GitHub Actions 将 `site/` 发布到 GitHub Pages：

https://liaoyuanning.github.io/paper-learning-library/

仓库不应提交 secrets、`.env`、令牌、论文全文或未经许可的源文档。
