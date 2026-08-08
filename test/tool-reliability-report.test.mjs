import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { GovernanceValidationError, validateToolReliabilityConsumerContract } from "../scripts/governance-validator.mjs";

const root = new URL("../", import.meta.url);
const [manifest, snapshot, audit, html, script, researchReadme] = await Promise.all([
  readFile(new URL("site/reports/tool-reliability-2026/data/evidence-manifest.v1.json", root), "utf8").then(JSON.parse),
  readFile(new URL("site/reports/tool-reliability-2026/data/evidence-snapshot.v1.json", root), "utf8").then(JSON.parse),
  readFile(new URL("research/tool-reliability-2026/metadata-audit.v1.json", root), "utf8").then(JSON.parse),
  readFile(new URL("site/reports/tool-reliability-2026/index.html", root), "utf8"),
  readFile(new URL("site/reports/tool-reliability-2026/report.js", root), "utf8"),
  readFile(new URL("research/tool-reliability-2026/README.md", root), "utf8"),
]);
const canonicalize = (value) => Array.isArray(value) ? value.map(canonicalize) : value && typeof value === "object" ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])])) : value;
const digest = (value) => `sha256:${createHash("sha256").update(JSON.stringify(canonicalize(value))).digest("hex")}`;
function payload(value) { const result = structuredClone(value); delete result.snapshot_digest; delete result.stable_url; delete result.immutable_url; delete result.evidence_snapshot; return result; }

test("AGE-396 immutable release is a closed evidence graph without an answer key", () => {
  assert.equal(manifest.artifact_id, "age-396-v1");
  assert.equal(manifest.immutable, true); assert.equal(manifest.release_status, "immutable_release");
  assert.equal(manifest.snapshot_digest, digest(payload(manifest)));
  assert.deepEqual(snapshot.evidence_payload, payload(manifest)); assert.equal(snapshot.snapshot_digest, manifest.snapshot_digest);
  assert.equal(snapshot.release_status, "immutable_release"); assert.equal(snapshot.immutable, true);
  assert.equal(manifest.stable_url, "https://raw.githubusercontent.com/LiaoyuanNing/paper-learning-library/main/site/reports/tool-reliability-2026/data/evidence-snapshot.v1.json");
  assert.equal(manifest.immutable_url, "https://raw.githubusercontent.com/LiaoyuanNing/paper-learning-library/age-396-v1/site/reports/tool-reliability-2026/data/evidence-snapshot.v1.json");
  assert.equal(snapshot.stable_url, manifest.stable_url); assert.equal(snapshot.immutable_url, manifest.immutable_url);
  assert.equal(manifest.ai_provenance.provider, "OpenAI"); assert.equal(manifest.ai_provenance.source_model, "gpt-5.6");
  assert.equal(manifest.claims.filter((item) => item.type === "direct_answer").length, 10);
  assert.equal(manifest.claims.filter((item) => item.type === "product_recommendation").length, 8);
  assert.equal(manifest.critic_records.length, 5); assert.equal(manifest.consumer_contract.questions.length, 3);
  assert.equal(manifest.predecessor_releases[0].artifact_id, "age-174-v2");
  assert.equal(manifest.predecessor_releases[0].snapshot_digest, "sha256:1cab26e51999310225fb08e05621ddfdbcad7ca3e478bc37181af0d614484a8c");
  assert.doesNotMatch(JSON.stringify(manifest), /expected_answer|gold_?answer|consumer-attestation/i);
  assert.doesNotMatch(JSON.stringify(snapshot), /expected_answer|gold_?answer|consumer-attestation/i);
  validateToolReliabilityConsumerContract(manifest, audit);
});

test("consumer gate rejects absent and mismatched published evidence references", () => {
  const missing = structuredClone(manifest); missing.consumer_contract.questions[0].evidence_refs[0].evidence_id = "E404";
  assert.throws(() => validateToolReliabilityConsumerContract(missing, audit), (error) => error instanceof GovernanceValidationError && /missing evidence/.test(error.message));
  const mismatched = structuredClone(manifest); mismatched.consumer_contract.questions[1].evidence_refs[0].source_id = "S01";
  assert.throws(() => validateToolReliabilityConsumerContract(mismatched, audit), (error) => error instanceof GovernanceValidationError && /mismatched evidence\/source/.test(error.message));
});

test("metadata audit distinguishes independent observations from unverified source input", () => {
  assert.equal(audit.records.length, manifest.sources.length);
  const verified = audit.records.filter((item) => item.verification_status === "verified");
  const unverified = audit.records.filter((item) => item.verification_status === "unverified");
  assert.ok(verified.length >= 6); assert.ok(unverified.length > 0);
  for (const record of verified) for (const observation of record.observations) {
    assert.equal(observation.match, "match"); assert.ok(observation.checked_url); assert.ok(observation.observed_title); assert.ok(observation.observed_version); assert.ok(observation.checked_at); assert.ok(observation.verifier); assert.ok(observation.method);
  }
});

test("report exposes a post-tag blind-consumer protocol, not a fabricated result", () => {
  assert.match(script, /evidence-manifest\.v1\.json/); assert.match(html, /10 条结论/); assert.match(html, /8 条产品建议/); assert.match(html, /source-grid/); assert.match(html, /model-disclosure/);
  assert.match(researchReadme, /prior_involvement: none/); assert.match(researchReadme, /post-tag/); assert.doesNotMatch(researchReadme, /3\/3 structural PASS/);
});
