import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [html, app, css] = await Promise.all([
  readFile(new URL("../site/index.html", import.meta.url), "utf8"),
  readFile(new URL("../site/js/app.js", import.meta.url), "utf8"),
  readFile(new URL("../site/styles.css", import.meta.url), "utf8"),
]);

test("reader includes accessible search and both filters", () => {
  for (const marker of ["search-input", "category-filter", "tag-filter", "aria-live"]) {
    assert.match(html, new RegExp(marker));
  }
  assert.match(app, /record\.authors/);
  assert.match(app, /record\.categories/);
  assert.match(app, /record\.tags/);
});

test("detail view separates arXiv and AI-generated content with honest provenance", () => {
  assert.match(app, /arXiv 原始信息/);
  assert.match(app, /AI 生成内容/);
  assert.match(app, /unknown \(runtime default\)/);
  assert.match(app, /AGE-23/);
  assert.match(app, /full_text_stored/);
  assert.match(app, /learning_highlights_zh/);
});

test("styles define mobile layout and safe long-text wrapping", () => {
  assert.match(css, /\[hidden\] \{ display: none !important; \}/);
  assert.match(css, /@media \(max-width: 740px\)/);
  assert.match(css, /@media \(max-width: 390px\)/);
  assert.match(css, /overflow-wrap: anywhere/);
});
