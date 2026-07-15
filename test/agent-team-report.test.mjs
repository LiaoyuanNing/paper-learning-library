import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const [manifest, html, script, css] = await Promise.all([
  readFile(new URL("../site/reports/agent-teams-2026/data/evidence-manifest.v1.json", import.meta.url), "utf8").then(JSON.parse),
  readFile(new URL("../site/reports/agent-teams-2026/index.html", import.meta.url), "utf8"),
  readFile(new URL("../site/reports/agent-teams-2026/report.js", import.meta.url), "utf8"),
  readFile(new URL("../site/reports/agent-teams-2026/report.css", import.meta.url), "utf8"),
]);

function unique(items, label) {
  assert.equal(new Set(items).size, items.length, `${label} IDs must be unique`);
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
  }
  return value;
}

function digest(value) {
  const snapshot = structuredClone(value);
  delete snapshot.snapshot_digest;
  return `sha256:${createHash("sha256").update(JSON.stringify(canonicalize(snapshot))).digest("hex")}`;
}

test("manifest is a versioned, immutable and closed evidence graph", () => {
  assert.equal(manifest.schema_version, "1.0");
  assert.equal(manifest.manifest_version, "1.0.0");
  assert.equal(manifest.request.knowledge_cutoff, "2026-07-15");
  assert.equal(manifest.snapshot_digest, digest(manifest));
  assert.match(manifest.stable_url, /\/age-174-v1\//);

  const sourceIds = manifest.sources.map((item) => item.source_id);
  const evidenceIds = manifest.evidence.map((item) => item.evidence_id);
  const claimIds = manifest.claims.map((item) => item.claim_id);
  unique(sourceIds, "source");
  unique(evidenceIds, "evidence");
  unique(claimIds, "claim");

  const sources = new Set(sourceIds);
  const evidence = new Set(evidenceIds);
  const claims = new Set(claimIds);
  for (const source of manifest.sources) {
    assert.match(source.official_url, /^https:\/\/(arxiv\.org|aclanthology\.org|openreview\.net|proceedings\.|papers\.|proceedings\.mlr)/);
    assert.match(source.version, /^v\d+$/);
    assert.ok(source.publication_status);
  }
  for (const item of manifest.evidence) {
    assert.ok(sources.has(item.source_id), `${item.evidence_id} source must resolve`);
    assert.ok(item.locator && item.faithful_summary && item.verified_by.length > 0);
  }
  for (const claim of manifest.claims) {
    assert.ok(claim.supporting_evidence_ids.length > 0, `${claim.claim_id} must have evidence`);
    for (const id of [...claim.supporting_evidence_ids, ...claim.contradicting_evidence_ids]) {
      assert.ok(evidence.has(id), `${claim.claim_id} evidence ${id} must resolve`);
    }
    if (claim.type === "recommendation") {
      for (const key of ["evidence_basis", "assumptions", "side_effects"]) assert.ok(claim[key]);
    }
  }
  for (const id of manifest.report.claim_links) assert.ok(claims.has(id));
});

test("report contains the promised balanced corpus and independent quality gates", () => {
  const included = manifest.papers.filter((paper) => paper.selection.decision === "included");
  assert.equal(included.length, 18);
  assert.equal(included.filter((paper) => paper.group === "foundation").length, 9);
  assert.equal(included.filter((paper) => paper.group === "frontier").length, 9);
  assert.equal(manifest.retrieval.length, 8);
  assert.ok(manifest.validation.critic_checks.length >= 5);
  assert.equal(manifest.claims.filter((claim) => claim.show_in_summary).length, 11);
  assert.equal(manifest.claims.filter((claim) => claim.type === "recommendation").length, 8);
  assert.equal(manifest.report.counterintuitive.length, 5);
  assert.equal(manifest.report.taxonomy.length, 8);
  assert.match(manifest.outputs.model_disclosure, /AI/);
  assert.match(manifest.outputs.copyright_policy, /不存储论文全文/);
});

test("web report is manifest-driven, accessible and mobile-aware", () => {
  for (const marker of ["main-content", "summary-groups", "paper-grid", "recommendations", "references", "limitations-list"]) {
    assert.match(html, new RegExp(`id="${marker}"`));
  }
  assert.match(html, /skip-link/);
  assert.match(script, /fetch\("\.\/data\/evidence-manifest\.v1\.json"\)/);
  assert.match(script, /textContent/);
  assert.doesNotMatch(script, /innerHTML/);
  assert.match(css, /@media \(max-width: 390px\)/);
  assert.match(css, /overflow-wrap: anywhere/);
});

test("evidence pack never stores paper full text", () => {
  const forbiddenKeys = new Set(["full_text", "paper_body", "pdf_content", "source_document"]);
  const visit = (value) => {
    if (Array.isArray(value)) return value.forEach(visit);
    if (!value || typeof value !== "object") return;
    for (const [key, child] of Object.entries(value)) {
      assert.equal(forbiddenKeys.has(key), false, `forbidden key ${key}`);
      visit(child);
    }
  };
  visit(manifest);
  assert.ok(root);
});
