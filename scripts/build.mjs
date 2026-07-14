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
];

await Promise.all(requiredFiles.map((file) => access(file)));
console.log("Static site/ is complete and ready for GitHub Pages.");
