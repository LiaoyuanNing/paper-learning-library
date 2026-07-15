import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [manifest, audit, html, script, css] = await Promise.all([
  readFile(new URL("../site/reports/agent-teams-2026/data/evidence-manifest.v2.json", import.meta.url), "utf8").then(JSON.parse),
  readFile(new URL("../research/agent-teams-2026/metadata-audit.v2.json", import.meta.url), "utf8").then(JSON.parse),
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
  delete snapshot.stable_url;
  delete snapshot.validation?.manifest_consumer_trial?.snapshot_digest;
  return `sha256:${createHash("sha256").update(JSON.stringify(canonicalize(snapshot))).digest("hex")}`;
}

test("v2 manifest has a SemVer contract, immutable entry and closed evidence graph", () => {
  assert.equal(manifest.schema_version, "1.0.0");
  assert.equal(manifest.manifest_version, "2.0.0");
  assert.equal(manifest.request.knowledge_cutoff, "2026-07-15");
  assert.equal(manifest.snapshot_digest, digest(manifest));
  assert.equal(manifest.validation.manifest_consumer_trial.snapshot_digest, manifest.snapshot_digest);
  assert.match(manifest.stable_url, /^https:\/\/raw\.githubusercontent\.com\/LiaoyuanNing\/paper-learning-library\/[0-9a-f]{40}\/site\/reports\/agent-teams-2026\/data\/evidence-manifest\.v2\.json$/);
  assert.equal(manifest.supersedes[0].manifest_version, "1.0.0");
  assert.match(manifest.supersedes[0].immutable_url, /\/age-174-v1\//);

  const sourceIds = manifest.sources.map((item) => item.source_id);
  const evidenceIds = manifest.evidence.map((item) => item.evidence_id);
  const claimIds = manifest.claims.map((item) => item.claim_id);
  unique(sourceIds, "source");
  unique(evidenceIds, "evidence");
  unique(claimIds, "claim");

  const sources = new Set(sourceIds);
  const evidence = new Set(evidenceIds);
  const claims = new Set(claimIds);
  for (const item of manifest.evidence) {
    assert.ok(sources.has(item.source_id), `${item.evidence_id} source must resolve`);
    assert.ok(item.locator && item.faithful_summary && item.verified_by.length > 0);
    assert.doesNotMatch(item.locator, /lines? \d|main results tables/i, `${item.evidence_id} must use a stable locator`);
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

test("all primary source metadata is explicit and matches the auditable record", () => {
  const statusEnum = new Set(["published", "accepted", "preprint", "workshop"]);
  assert.equal(audit.schema_version, "1.0.0");
  assert.equal(audit.manifest_version, manifest.manifest_version);
  assert.equal(audit.records.length, manifest.sources.length);
  const auditById = new Map(audit.records.map((record) => [record.source_id, record]));
  const fields = ["title", "authors", "version", "submission_year", "venue_year", "publication_status", "venue", "track", "official_url", "venue_url"];

  for (const source of manifest.sources) {
    assert.match(source.official_url, /^https:\/\/arxiv\.org\/abs\/\d{4}\.\d{4,5}v\d+$/);
    assert.match(source.version, /^v\d+$/);
    assert.ok(statusEnum.has(source.publication_status));
    assert.equal(Number.isInteger(source.submission_year), true);
    assert.equal("year" in source, false, `${source.source_id} must not use ambiguous year`);
    if (source.publication_status === "preprint") {
      assert.equal(source.venue_year, null);
      assert.equal(source.venue, null);
      assert.equal(source.track, null);
    } else {
      assert.equal(Number.isInteger(source.venue_year), true);
      assert.ok(source.venue && source.track && source.venue_url);
    }
    const record = auditById.get(source.source_id);
    assert.ok(record, `${source.source_id} audit record missing`);
    assert.deepEqual(record.checked_fields, fields);
    assert.deepEqual(record.snapshot, Object.fromEntries(fields.map((key) => [key, source[key]])));
  }

  const byId = new Map(manifest.sources.map((source) => [source.source_id, source]));
  assert.deepEqual(byId.get("S13").authors.slice(6), ["Kurt Keutzer", "Aditya Parameswaran", "Dan Klein", "Kannan Ramchandran", "Matei Zaharia", "Joseph E. Gonzalez", "Ion Stoica"]);
  assert.equal(byId.get("S14").title, "Scaling External Knowledge Input Beyond Context Windows of LLMs via Multi-Agent Collaboration");
  assert.equal(byId.get("S16").submission_year, 2025);
  assert.equal(byId.get("S16").venue_year, null);
});

test("core reselection, full candidate mapping and per-claim Critic checks are complete", () => {
  const included = manifest.papers.filter((paper) => paper.selection.decision === "included");
  assert.equal(manifest.papers.length, 48);
  assert.equal(included.length, 18);
  assert.equal(included.filter((paper) => paper.group === "foundation").length, 8);
  assert.equal(included.filter((paper) => paper.group === "frontier").length, 10);
  for (const paperId of ["2602.01011", "2604.02460", "2601.12307"]) assert.ok(included.some((paper) => paper.paper_id === paperId));
  for (const paperId of ["2406.07155", "2502.11133", "2505.21471"]) assert.equal(included.some((paper) => paper.paper_id === paperId), false);

  const statuses = new Set(["published", "accepted", "preprint", "workshop"]);
  for (const paper of manifest.papers) {
    const source = paper.source_id && manifest.sources.find((item) => item.source_id === paper.source_id);
    assert.match(paper.paper_id, /^\d{4}\.\d{4,5}$/);
    assert.ok(["included", "extended", "excluded"].includes(paper.selection.decision));
    assert.ok(paper.selection.reasons.length > 0);
    assert.match(source?.version ?? paper.version, /^v\d+$/);
    assert.ok(statuses.has(source?.publication_status ?? paper.publication_status));
    assert.match(source?.official_url ?? paper.source_url, /^https:\/\/arxiv\.org\/abs\//);
  }

  const synthesis = manifest.claims.filter((claim) => claim.type === "synthesis");
  assert.deepEqual(synthesis.map((claim) => claim.claim_id), ["C01", "C02", "C03", "C04", "C05", "C06", "C07", "C08", "C09", "C10", "C11"]);
  assert.equal(manifest.validation.critic_checks.length, synthesis.length);
  for (const claim of synthesis) {
    assert.ok(claim.counter_search.scope);
    assert.ok(["contrary_found", "qualified", "no_direct_contrary_found"].includes(claim.counter_search.outcome));
    assert.ok(claim.counter_search.revision_reason);
    if (claim.counter_search.findings.length === 0) assert.ok(claim.counter_search.no_contrary_note);
  }
  assert.equal(synthesis.find((claim) => claim.claim_id === "C05").strength, "conditional");
});

test("independent consumer record and report surfaces bind to the same v2 snapshot", () => {
  const trial = manifest.validation.manifest_consumer_trial;
  assert.equal(trial.status, "passed");
  assert.equal(trial.manifest_version, manifest.manifest_version);
  assert.equal(trial.snapshot_digest, manifest.snapshot_digest);
  assert.equal(trial.immutable_url, manifest.stable_url);
  assert.ok(trial.consumer_agent?.identity);
  assert.deepEqual(trial.question_results, ["expert_dilution:PASS", "matched_budget:PASS", "workflow_collapse:PASS", "negative_answerability:PASS"]);

  for (const marker of ["main-content", "summary-groups", "paper-grid", "recommendations", "references", "limitations-list"]) {
    assert.match(html, new RegExp(`id="${marker}"`));
  }
  assert.match(html, /skip-link/);
  assert.match(html, /evidence-manifest\.v2\.json/g);
  assert.doesNotMatch(html, /evidence-manifest\.v1\.json/);
  assert.match(script, /fetch\("\.\/data\/evidence-manifest\.v2\.json"\)/);
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
});
