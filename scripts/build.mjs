import { access } from "node:fs/promises";

const requiredFiles = [
  "site/index.html",
  "site/styles.css",
  "site/favicon.svg",
  "site/js/app.js",
  "site/js/safe-html.js",
  "site/js/study-filters.js",
  "site/js/study-store.js",
  "site/data/paper_learning_mvp_sample.json",
  "site/reports/agent-teams-2026/index.html",
  "site/reports/agent-teams-2026/report.css",
  "site/reports/agent-teams-2026/report.js",
  "site/reports/agent-teams-2026/data/evidence-manifest.v1.json",
  "site/reports/agent-teams-2026/data/evidence-manifest.v2.json",
  "site/reports/agent-teams-2026/data/evidence-snapshot.v2.json",
  "governance/agent-research-governance.v1.json",
  "docs/ai-provenance-review-copyright-policy.md",
  "docs/ai-review-checklist.md",
];

await Promise.all(requiredFiles.map((file) => access(file)));
console.log("Static site/ is complete and ready for GitHub Pages.");
