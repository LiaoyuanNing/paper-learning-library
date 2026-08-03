import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const [manifest, snapshot, audit, attestation, html, script] = await Promise.all([
  readFile(new URL("site/reports/tool-reliability-2026/data/evidence-manifest.v1.json", root), "utf8").then(JSON.parse),
  readFile(new URL("site/reports/tool-reliability-2026/data/evidence-snapshot.v1.json", root), "utf8").then(JSON.parse),
  readFile(new URL("research/tool-reliability-2026/metadata-audit.v1.json", root), "utf8").then(JSON.parse),
  readFile(new URL("research/tool-reliability-2026/consumer-attestation.v1.json", root), "utf8").then(JSON.parse),
  readFile(new URL("site/reports/tool-reliability-2026/index.html", root), "utf8"),
  readFile(new URL("site/reports/tool-reliability-2026/report.js", root), "utf8"),
]);
const canonicalize = (value) => Array.isArray(value) ? value.map(canonicalize) : value && typeof value === "object" ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])])) : value;
const digest = (value) => `sha256:${createHash("sha256").update(JSON.stringify(canonicalize(value))).digest("hex")}`;
function payload(value) { const result = structuredClone(value); delete result.snapshot_digest; delete result.stable_url; delete result.evidence_snapshot_url; delete result.evidence_snapshot; delete result.validation.consumer_attestation; return result; }

test("AGE-396 manifest is an immutable closed evidence graph with exact new provenance", () => {
  assert.equal(manifest.artifact_id, "age-396-v1"); assert.equal(manifest.immutable, true);
  assert.equal(manifest.snapshot_digest, digest(payload(manifest)));
  assert.deepEqual(snapshot.evidence_payload, payload(manifest)); assert.equal(snapshot.snapshot_digest, manifest.snapshot_digest);
  assert.equal(manifest.ai_provenance.provider, "OpenAI"); assert.equal(manifest.ai_provenance.source_model, "gpt-5.6");
  assert.equal(manifest.claims.filter((item) => item.type === "direct_answer").length, 10);
  assert.equal(manifest.claims.filter((item) => item.type === "product_recommendation").length, 8);
  assert.equal(manifest.critic_records.length, 5); assert.equal(manifest.consumer_contract.questions.length, 3);
  const sourceIds = new Set(manifest.sources.map((item) => item.source_id)); const evidenceIds = new Set(manifest.evidence.map((item) => item.evidence_id));
  assert.equal(manifest.sources.length, 17); assert.equal(audit.records.length, manifest.sources.length);
  for (const source of manifest.sources) { assert.match(source.official_url, /arxiv\.org\/abs\/\d{4}\.\d{4,5}v\d+$/); assert.ok(source.venue_status); }
  for (const item of manifest.evidence) assert.ok(sourceIds.has(item.source_id));
  for (const claim of manifest.claims) for (const id of claim.supporting_evidence_ids) assert.ok(evidenceIds.has(id));
  assert.equal(attestation.snapshot_digest, manifest.snapshot_digest); assert.ok(attestation.question_results.every((item) => item.result === "PASS"));
});

test("report renders solely from the v1 manifest and exposes disclosure", () => {
  assert.match(script, /evidence-manifest\.v1\.json/); assert.match(html, /10 条结论/); assert.match(html, /8 条产品建议/); assert.match(html, /source-grid/); assert.match(html, /model-disclosure/);
});
