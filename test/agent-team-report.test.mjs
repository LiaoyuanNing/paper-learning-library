import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const manifestPath = new URL("site/reports/agent-teams-2026/data/evidence-manifest.v2.json", root);
const snapshotPath = new URL("site/reports/agent-teams-2026/data/evidence-snapshot.v2.json", root);
const auditPath = new URL("research/agent-teams-2026/metadata-audit.v2.json", root);
const attestationPath = new URL("research/agent-teams-2026/consumer-attestation.v2.json", root);
const transcriptPath = new URL("research/agent-teams-2026/manifest-consumer-validation.v2.md", root);

const [manifest, localSnapshot, audit, attestation, transcript, v1Manifest, html, script, css, rootReadme, researchReadme, changelog, browserQa] = await Promise.all([
  readFile(manifestPath, "utf8").then(JSON.parse),
  readFile(snapshotPath, "utf8").then(JSON.parse),
  readFile(auditPath, "utf8").then(JSON.parse),
  readFile(attestationPath, "utf8").then(JSON.parse),
  readFile(transcriptPath, "utf8"),
  readFile(new URL("site/reports/agent-teams-2026/data/evidence-manifest.v1.json", root), "utf8").then(JSON.parse),
  readFile(new URL("site/reports/agent-teams-2026/index.html", root), "utf8"),
  readFile(new URL("site/reports/agent-teams-2026/report.js", root), "utf8"),
  readFile(new URL("site/reports/agent-teams-2026/report.css", root), "utf8"),
  readFile(new URL("README.md", root), "utf8"),
  readFile(new URL("research/agent-teams-2026/README.md", root), "utf8"),
  readFile(new URL("research/agent-teams-2026/CHANGELOG.md", root), "utf8"),
  readFile(new URL("research/agent-teams-2026/browser-qa.v2.md", root), "utf8"),
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

function sha256(value) {
  return `sha256:${createHash("sha256").update(JSON.stringify(canonicalize(value))).digest("hex")}`;
}

function evidencePayload(value) {
  const payload = structuredClone(value);
  delete payload.snapshot_digest;
  delete payload.stable_url;
  delete payload.evidence_snapshot_url;
  delete payload.evidence_snapshot;
  delete payload.validation?.manifest_consumer_trial;
  delete payload.validation?.consumer_attestation;
  return payload;
}

function attestationPayload(value) {
  const payload = structuredClone(value);
  delete payload.attestation_digest;
  return payload;
}

function immutableRaw(url, expectedPath) {
  const parsed = new URL(url);
  assert.equal(parsed.protocol, "https:");
  assert.equal(parsed.hostname, "raw.githubusercontent.com");
  const [, owner, repo, ref, ...parts] = parsed.pathname.split("/");
  assert.equal(`${owner}/${repo}`, "LiaoyuanNing/paper-learning-library");
  assert.match(ref, /^[0-9a-f]{40}$/);
  const path = parts.join("/");
  assert.equal(path, expectedPath);
  return { ref, path };
}

function gitShowJson(url, expectedPath) {
  const { ref, path } = immutableRaw(url, expectedPath);
  return JSON.parse(execFileSync("git", ["show", `${ref}:${path}`], { cwd: new URL(root), encoding: "utf8" }));
}

function gitShowText(url, expectedPath) {
  const { ref, path } = immutableRaw(url, expectedPath);
  return execFileSync("git", ["show", `${ref}:${path}`], { cwd: new URL(root), encoding: "utf8" });
}

test("v1 supersedes digest is independently recomputed with the v1 algorithm", () => {
  const v1Payload = structuredClone(v1Manifest);
  delete v1Payload.snapshot_digest;
  const recomputed = sha256(v1Payload);
  assert.equal(recomputed, "sha256:194c019808da705ac100cccd215155c5b09f67a86f9499abb0d808ab2a855170");
  assert.equal(manifest.supersedes[0].manifest_version, "1.0.0");
  assert.equal(manifest.supersedes[0].snapshot_digest, recomputed);
  immutableRaw(manifest.supersedes[0].immutable_url, "site/reports/agent-teams-2026/data/evidence-manifest.v1.json");
});

test("v2 evidence snapshot is an immutable digest-covered payload", () => {
  assert.equal(manifest.schema_version, "1.0.0");
  assert.equal(manifest.manifest_version, "2.0.0");
  assert.equal(manifest.request.knowledge_cutoff, "2026-07-15");
  assert.equal(manifest.request.time_precision, "day");
  assert.equal("retrieved_at" in manifest.request, false);
  assert.equal(manifest.snapshot_digest, sha256(evidencePayload(manifest)));
  assert.equal(manifest.evidence_snapshot.snapshot_digest, manifest.snapshot_digest);
  assert.equal(manifest.evidence_snapshot.immutable_url, manifest.evidence_snapshot_url);

  const remoteSnapshot = gitShowJson(
    manifest.evidence_snapshot_url,
    "site/reports/agent-teams-2026/data/evidence-snapshot.v2.json",
  );
  assert.deepEqual(remoteSnapshot, localSnapshot);
  assert.equal(remoteSnapshot.manifest_version, manifest.manifest_version);
  assert.equal(remoteSnapshot.snapshot_digest, manifest.snapshot_digest);
  assert.equal(remoteSnapshot.snapshot_digest, sha256(remoteSnapshot.evidence_payload));
  assert.deepEqual(remoteSnapshot.evidence_payload, evidencePayload(manifest));
});

test("source, evidence, claim and candidate graphs are closed and audited", () => {
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

  const included = manifest.papers.filter((paper) => paper.selection.decision === "included");
  assert.equal(manifest.papers.length, 49);
  assert.equal(manifest.selection_protocol.candidate_count, 49);
  assert.equal(manifest.sources.length, 27);
  assert.equal(manifest.selection_protocol.source_count, 27);
  assert.equal(manifest.evidence.length, 28);
  assert.equal(included.length, 18);
  assert.equal(manifest.selection_protocol.core_count, 18);
  assert.equal(included.filter((paper) => paper.group === "foundation").length, 8);
  assert.equal(included.filter((paper) => paper.group === "frontier").length, 10);
  for (const paperId of ["2602.01011", "2604.02460", "2601.12307", "2604.07821", "2603.01045"]) {
    assert.ok(included.some((paper) => paper.paper_id === paperId), `${paperId} must be core`);
  }
  for (const paperId of ["2406.07155", "2502.11133", "2505.21471", "2602.03794", "2602.01566", "2505.11556"]) {
    assert.equal(included.some((paper) => paper.paper_id === paperId), false, `${paperId} must be extended`);
  }

  const synthesis = manifest.claims.filter((claim) => claim.type === "synthesis");
  assert.equal(manifest.validation.critic_checks.length, 11);
  for (const claim of synthesis) {
    assert.ok(claim.counter_search.scope && claim.counter_search.revision_reason);
    if (claim.counter_search.findings.length === 0) assert.ok(claim.counter_search.no_contrary_note);
  }
  assert.equal(synthesis.find((claim) => claim.claim_id === "C05").strength, "conditional");
  assert.doesNotMatch(synthesis.find((claim) => claim.claim_id === "C04").text, /只在/);
  assert.ok(synthesis.find((claim) => claim.claim_id === "C11").contradicting_evidence_ids.includes("E28"));
  assert.match(manifest.evidence.find((item) => item.evidence_id === "E14").faithful_summary, /组合式/);
});

test("durable knowledge promotion mappings are exact, reviewable and resolvable", () => {
  const expected = {
    C01: ["AGE-185", "c807b74e-b65f-4424-b2b9-38ada71b0aad"],
    C05: ["AGE-186", "5e7a4332-0f1d-4e0c-831d-e6ed7431395f"],
    C09: ["AGE-187", "f0a25456-ddd4-46c1-9ae7-94e6ed43fbd4"],
  };
  const promotions = new Map(manifest.promotion_candidates.map((item) => [item.claim_id, item]));
  for (const [claimId, [knowledgeId, issueUuid]] of Object.entries(expected)) {
    const item = promotions.get(claimId);
    assert.equal(item.eligibility, "promoted");
    assert.equal(item.durable_knowledge_id, knowledgeId);
    assert.equal(item.issue_uuid, issueUuid);
    assert.equal(item.issue_pointer, `mention://issue/${issueUuid}`);
    const pointer = new URL(item.issue_pointer);
    assert.equal(pointer.protocol, "mention:");
    assert.equal(pointer.hostname, "issue");
    assert.equal(pointer.pathname, `/${issueUuid}`);
    assert.equal(item.promotion_reviewed_on, "2026-07-15");
    assert.equal(item.next_review_on, "2026-10-15");
    assert.ok(item.revalidation_triggers.length >= 3);
  }
  for (const claimId of ["C08", "C11"]) {
    assert.equal(promotions.get(claimId).eligibility, "not_eligible");
    assert.equal("durable_knowledge_id" in promotions.get(claimId), false);
  }
  assert.deepEqual(manifest.promotion.promoted_claim_ids, ["C01", "C05", "C09"]);
  assert.deepEqual(manifest.promotion.not_eligible_claim_ids, ["C08", "C11"]);
  assert.equal(manifest.promotion.promotion_reviewed_on, "2026-07-15");
  assert.equal(manifest.promotion.next_review_on, "2026-10-15");
  assert.equal(manifest.promotion.bidirectional_pointer_status, "complete");
  assert.equal(manifest.claims.find((claim) => claim.claim_id === "C05").strength, "conditional");
});

test("all source metadata matches the immutable audit, including non-arXiv evidence", () => {
  const remoteAudit = gitShowJson(manifest.outputs.metadata_audit_url, "research/agent-teams-2026/metadata-audit.v2.json");
  assert.deepEqual(remoteAudit, audit);
  assert.equal(audit.records.length, manifest.sources.length);
  const auditById = new Map(audit.records.map((record) => [record.source_id, record]));
  const fields = ["source_kind", "title", "authors", "version", "submission_year", "venue_year", "publication_status", "venue", "track", "official_url", "venue_url"];
  for (const source of manifest.sources) {
    assert.ok(["arxiv", "openreview"].includes(source.source_kind));
    if (source.source_kind === "arxiv") {
      assert.match(source.official_url, /^https:\/\/arxiv\.org\/abs\/\d{4}\.\d{4,5}v\d+$/);
      assert.match(source.version, /^v\d+$/);
    } else {
      assert.equal(source.source_id, "S27");
      assert.match(source.official_url, /^https:\/\/openreview\.net\/forum\?id=/);
      assert.ok(source.external_id);
    }
    assert.equal(Number.isInteger(source.submission_year), true);
    assert.equal("year" in source, false);
    const record = auditById.get(source.source_id);
    assert.deepEqual(record.checked_fields, fields);
    assert.deepEqual(record.snapshot, Object.fromEntries(fields.map((key) => [key, source[key]])));
  }

  const byId = new Map(manifest.sources.map((source) => [source.source_id, source]));
  assert.deepEqual(byId.get("S13").authors.slice(6), ["Kurt Keutzer", "Aditya Parameswaran", "Dan Klein", "Kannan Ramchandran", "Matei Zaharia", "Joseph E. Gonzalez", "Ion Stoica"]);
  assert.equal(byId.get("S14").title, "Scaling External Knowledge Input Beyond Context Windows of LLMs via Multi-Agent Collaboration");
  assert.equal(byId.get("S16").submission_year, 2025);
  assert.equal(byId.get("S16").venue_year, null);
  assert.deepEqual(byId.get("S25").authors.slice(0, 3), ["Yuzhe Zhang", "Feiran Liu", "Yi Shan"]);
  assert.equal(byId.get("S26").title, "Systematic Failures in Collective Reasoning under Distributed Information in Multi-Agent LLMs");

  const papersBySource = new Map(manifest.papers.map((paper) => [paper.source_id, paper]));
  assert.equal(papersBySource.get("S25").experiment, "30 个任务；6 种团队规模 × 3 种通信协议 × 3 个模型 = 54 个配置，共 1,620 次实验。");
  assert.match(papersBySource.get("S25").result, /Premature Submission（过早提交）37\.2%.*Consensus Failure（共识失败：多个 agent 提交不同答案且未同步）29\.9%.*Computation Error（计算错误）28\.6%/);
  assert.doesNotMatch(papersBySource.get("S25").result, /错误共识/);
  assert.match(papersBySource.get("S26").research_question, /分布式信息.*集体决策推理/);
  assert.match(papersBySource.get("S26").experiment, /65 个 hidden-profile 任务、15 个模型/);
  assert.match(papersBySource.get("S26").result, /准确率 30\.1%.*准确率 80\.7%/);
  assert.doesNotMatch(papersBySource.get("S26").result, /完成率/);

  const evidenceById = new Map(manifest.evidence.map((item) => [item.evidence_id, item]));
  assert.match(evidenceById.get("E26").faithful_summary, /6 种团队规模 × 3 种通信协议 × 3 个模型.*1,620 次实验/);
  assert.match(evidenceById.get("E26").faithful_summary, /Premature Submission（过早提交）37\.2%.*Consensus Failure（共识失败：多个 agent 提交不同答案且未同步）29\.9%.*Computation Error（计算错误）28\.6%/);
  assert.doesNotMatch(evidenceById.get("E26").faithful_summary, /错误共识/);
  assert.match(evidenceById.get("E27").faithful_summary, /65 个 hidden-profile 任务和 15 个模型.*准确率.*30\.1%.*80\.7%/);
  assert.doesNotMatch(evidenceById.get("E27").faithful_summary, /完成率/);
});

test("consumer attestation is immutable, independently digested and bound to the snapshot triple", () => {
  const pointer = manifest.validation.consumer_attestation;
  const remoteAttestation = gitShowJson(pointer.attestation_url, "research/agent-teams-2026/consumer-attestation.v2.json");
  const remoteTranscript = gitShowText(pointer.transcript_url, "research/agent-teams-2026/manifest-consumer-validation.v2.md");
  assert.deepEqual(remoteAttestation, attestation);
  assert.equal(remoteTranscript, transcript);
  assert.equal(attestation.attestation_digest, sha256(attestationPayload(attestation)));
  assert.equal(pointer.attestation_digest, attestation.attestation_digest);
  for (const item of [pointer, attestation]) {
    assert.equal(item.consumer_identity, attestation.consumer_identity);
    assert.equal(item.manifest_version, manifest.manifest_version);
    assert.equal(item.snapshot_digest, manifest.snapshot_digest);
    assert.equal(item.input_url, manifest.evidence_snapshot_url);
  }
  assert.equal(attestation.question_results.length, 4);
  assert.ok(attestation.question_results.every((item) => item.result === "PASS"));
  assert.equal(attestation.manual_review.result, "4/4 PASS");
  for (const exact of [attestation.consumer_identity, manifest.manifest_version, manifest.snapshot_digest, manifest.evidence_snapshot_url]) {
    assert.ok(transcript.includes(exact), `transcript must contain ${exact}`);
  }
  assert.match(transcript, /Systematic Failures in Collective Reasoning under Distributed Information in Multi-Agent LLMs/);
  assert.match(transcript, /accuracy was 30\.1%/);
  assert.match(transcript, /80\.7% accuracy/);
  assert.doesNotMatch(transcript, /completed 30\.1%|30\.1% completion/i);
  assert.match(transcript, /Premature Submission.*37\.2%.*Consensus Failure.*29\.9%.*Computation Error.*28\.6%/s);
  assert.equal(attestation.durable_pointer_review.result, "PASS");
  assert.deepEqual(attestation.durable_pointer_review.promoted_claim_ids, ["C01", "C05", "C09"]);
  assert.deepEqual(attestation.durable_pointer_review.not_eligible_claim_ids, ["C08", "C11"]);
  for (const exact of ["AGE-185", "AGE-186", "AGE-187", "mention://issue/c807b74e-b65f-4424-b2b9-38ada71b0aad", "mention://issue/5e7a4332-0f1d-4e0c-831d-e6ed7431395f", "mention://issue/f0a25456-ddd4-46c1-9ae7-94e6ed43fbd4"]) {
    assert.ok(transcript.includes(exact), `transcript must verify durable pointer ${exact}`);
  }
});

test("all machine output URLs resolve to the intended absolute artifact", () => {
  const expectedPublic = {
    report_url: "/paper-learning-library/reports/agent-teams-2026/",
    manifest_url: "/paper-learning-library/reports/agent-teams-2026/data/evidence-manifest.v2.json",
  };
  for (const [key, pathname] of Object.entries(expectedPublic)) {
    const url = new URL(manifest.outputs[key]);
    assert.equal(url.protocol, "https:");
    assert.equal(url.hostname, "liaoyuanning.github.io");
    assert.equal(url.pathname, pathname);
  }
  immutableRaw(manifest.outputs.metadata_audit_url, "research/agent-teams-2026/metadata-audit.v2.json");
  immutableRaw(manifest.evidence_snapshot_url, "site/reports/agent-teams-2026/data/evidence-snapshot.v2.json");
  immutableRaw(manifest.validation.consumer_attestation.attestation_url, "research/agent-teams-2026/consumer-attestation.v2.json");
  immutableRaw(manifest.validation.consumer_attestation.transcript_url, "research/agent-teams-2026/manifest-consumer-validation.v2.md");
  assert.equal(manifest.outputs.release_state, "release_v2");
  assert.equal(manifest.promotion.state, "partially_promoted");
  assert.equal(manifest.evidence_snapshot.status, "immutable_release_v2");
  assert.equal(manifest.validation.consumer_attestation.status, "passed_release_v2_trial");
});

test("release-facing artifacts contain no dynamic candidate-state residue", () => {
  const stale = /review candidate|review_candidate_not_deployed|public Pages remains|公开 Pages 仍|not deployed|下一步再补 immutable|下一步再补 consumer/i;
  for (const [label, value] of [
    ["manifest", JSON.stringify(manifest)],
    ["snapshot", JSON.stringify(localSnapshot)],
    ["root README", rootReadme],
    ["research README", researchReadme],
    ["CHANGELOG", changelog],
    ["browser QA", browserQa],
    ["report HTML", html],
  ]) {
    assert.doesNotMatch(value, stale, `${label} contains stale release-candidate copy`);
  }
});

test("report surfaces render the v2 manifest without unsafe HTML", () => {
  for (const marker of ["main-content", "summary-groups", "paper-grid", "recommendations", "references", "limitations-list"]) {
    assert.match(html, new RegExp(`id="${marker}"`));
  }
  assert.match(html, /skip-link/);
  assert.match(script, /fetch\("\.\/data\/evidence-manifest\.v2\.json"\)/);
  assert.match(script, /generated_on/);
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
  visit(localSnapshot);
});
