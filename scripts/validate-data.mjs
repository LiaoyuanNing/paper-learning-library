import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const data = JSON.parse(await readFile(new URL("../site/data/paper_learning_mvp_sample.json", import.meta.url), "utf8"));

assert.equal(data.record_count, 8, "Dataset must declare 8 MVP records");
assert.equal(data.records.length, 8, "Dataset must contain 8 MVP records");
assert.equal(new Set(data.records.map((record) => record.arxiv_id)).size, 8, "arXiv IDs must be unique");

for (const record of data.records) {
  for (const key of ["arxiv_id", "arxiv_version", "title", "abstract", "published_at", "updated_at", "primary_category"]) {
    assert.ok(record[key], `${record.arxiv_id}: missing ${key}`);
  }
  assert.ok(record.authors.length, `${record.arxiv_id}: requires authors`);
  assert.ok(record.categories.length, `${record.arxiv_id}: requires categories`);
  assert.ok(record.tags.length, `${record.arxiv_id}: requires tags`);
  for (const key of ["abstract", "pdf", "doi"]) assert.ok(record.links?.[key], `${record.arxiv_id}: missing ${key} link`);
  assert.equal(record.copyright?.full_text_stored, false, `${record.arxiv_id}: full text must not be stored`);
  assert.ok(record.ai_generated?.generated_at, `${record.arxiv_id}: missing AI generation time`);
  assert.ok(record.ai_generated?.source_model, `${record.arxiv_id}: missing source model provenance`);
  assert.ok(record.ai_generated?.abstract_zh, `${record.arxiv_id}: missing Chinese abstract`);
  assert.equal(record.ai_generated?.learning_highlights_zh?.length, 4, `${record.arxiv_id}: requires 4 learning highlights`);
}

console.log(`Validated ${data.records.length} records with unique arXiv IDs and required MVP fields.`);
