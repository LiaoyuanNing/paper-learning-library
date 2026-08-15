import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";

export const AI_REVIEW_STATUSES = new Set(["pending", "approved", "rejected", "regenerate"]);
export const LEGACY_UNKNOWN_MODEL = "unknown (runtime default)";

const PUBLIC_RECORD_FIELDS = new Set([
  "id", "arxiv_id", "arxiv_version", "title", "authors", "categories",
  "primary_category", "published_at", "updated_at", "abstract", "links",
  "source", "copyright", "tags", "ai_generated",
]);
const AI_ONLY_RECORD_FIELDS = new Set([
  "abstract_zh", "learning_highlights_zh", "generated_at", "source_model",
  "provider", "workflow_version", "input_evidence", "review",
]);
const PROHIBITED_PUBLIC_CONTENT_KEY = /(?:^|_)(?:full_?text|paper_?text|pdf_(?:content|data)|raw_(?:body|text)|source_(?:body|text|content|document)|latex|html|document_body|body_text)(?:_|$)/i;
const TEST_ONLY_CONTENT = /\[test only\]|test[-_ ]?(?:only|fake|fixture)|mock[-_ ]?(?:content|data)|fake[-_ ]?(?:provider|content|data)/i;

export class GovernanceValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "GovernanceValidationError";
  }
}

function fail(message) {
  throw new GovernanceValidationError(message);
}

function requireObject(value, label) {
  if (!value || Array.isArray(value) || typeof value !== "object") fail(`${label} must be an object`);
  return value;
}

function requireString(value, label) {
  if (typeof value !== "string" || !value.trim()) fail(`${label} must be a non-empty string`);
  return value;
}

function requireDate(value, label, { allowDayPrecision = false } = {}) {
  requireString(value, label);
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);
  if ((dateOnly && !allowDayPrecision) || Number.isNaN(Date.parse(value))) {
    fail(`${label} must be an ISO-8601 timestamp${allowDayPrecision ? " or date" : ""}`);
  }
}

function hasLegacyGrant(value) {
  return value?.legacy_grandfathered?.approved === true
    && typeof value.legacy_grandfathered.reason === "string"
    && value.legacy_grandfathered.reason.trim()
    && typeof value.legacy_grandfathered.recorded_at === "string"
    && value.legacy_grandfathered.recorded_at.trim();
}

function validateInputEvidence(value, label) {
  if (!Array.isArray(value) || value.length === 0) fail(`${label} must contain at least one source/evidence pointer`);
  for (const [index, item] of value.entries()) {
    requireObject(item, `${label}[${index}]`);
    requireString(item.kind, `${label}[${index}].kind`);
    if (!item.url && !item.reference) fail(`${label}[${index}] needs url or reference`);
    if (item.url) requireString(item.url, `${label}[${index}].url`);
    if (item.reference) requireString(item.reference, `${label}[${index}].reference`);
  }
}

export function validateProvenance(provenance, label, options = {}) {
  const value = requireObject(provenance, label);
  const allowDayPrecision = options.allowDayPrecision === true;
  requireDate(value.generated_at, `${label}.generated_at`, { allowDayPrecision });
  requireString(value.source_model, `${label}.source_model`);
  requireString(value.provider, `${label}.provider`);
  requireString(value.workflow_version, `${label}.workflow_version`);
  validateInputEvidence(value.input_evidence, `${label}.input_evidence`);

  if (value.provider.toLowerCase() === "unknown") {
    fail(`${label}.provider must identify the provider; unknown is not publishable`);
  }
  if (value.source_model === LEGACY_UNKNOWN_MODEL && !hasLegacyGrant(value)) {
    fail(`${label}.source_model=${LEGACY_UNKNOWN_MODEL} requires an explicit legacy_grandfathered record`);
  }
  if (value.source_model !== LEGACY_UNKNOWN_MODEL && /^(unknown|runtime default)$/i.test(value.source_model.trim())) {
    fail(`${label}.source_model must be exact; use ${LEGACY_UNKNOWN_MODEL} only with an explicit legacy grant`);
  }

  const review = requireObject(value.review, `${label}.review`);
  if (!AI_REVIEW_STATUSES.has(review.status)) {
    fail(`${label}.review.status must be one of ${[...AI_REVIEW_STATUSES].join(", ")}`);
  }
  if (review.status !== "pending") {
    requireString(review.reviewer, `${label}.review.reviewer`);
    requireDate(review.reviewed_at, `${label}.review.reviewed_at`, { allowDayPrecision });
    requireString(review.reason, `${label}.review.reason`);
  }
  for (const field of ["replaces", "withdrawn_by"]) {
    if (review[field] !== undefined && review[field] !== null) requireString(review[field], `${label}.review.${field}`);
  }
  if (options.requireApproved && review.status !== "approved") {
    fail(`${label}.review.status=${review.status}; public AI content must be approved before publication`);
  }
  return value;
}

function validatePublicTextBoundary(value, label, path = []) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => validatePublicTextBoundary(item, label, [...path, String(index)]));
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    const keyPath = [...path, key];
    const printablePath = `${label}.${keyPath.join(".")}`;
    const isCopyrightControl = keyPath.join(".") === "copyright.full_text_stored"
      || keyPath.join(".") === "copyright.full_text_license"
      || keyPath.join(".") === "copyright.license_checked_for_full_text";
    if (PROHIBITED_PUBLIC_CONTENT_KEY.test(key) && !isCopyrightControl) {
      fail(`${printablePath} is a prohibited full-text/PDF/raw-body field in public data`);
    }
    validatePublicTextBoundary(child, label, keyPath);
  }
}

function validateNoTestOnlyContent(value, label) {
  if (typeof value === "string" && TEST_ONLY_CONTENT.test(value)) {
    fail(`${label} contains test/mock/fake content and cannot be published`);
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => validateNoTestOnlyContent(item, `${label}[${index}]`));
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) validateNoTestOnlyContent(child, `${label}.${key}`);
}

function validateCopyright(value, label) {
  const copyright = requireObject(value.copyright, `${label}.copyright`);
  if (typeof copyright.full_text_stored !== "boolean") fail(`${label}.copyright.full_text_stored must be boolean`);
  if (copyright.full_text_stored) {
    const license = requireObject(copyright.full_text_license, `${label}.copyright.full_text_license`);
    for (const field of ["license_id", "reuse_basis", "verified_at", "verified_source"]) {
      if (field === "verified_at") requireDate(license[field], `${label}.copyright.full_text_license.${field}`);
      else requireString(license[field], `${label}.copyright.full_text_license.${field}`);
    }
  }
}

export function validatePublicRecord(record, label) {
  const value = requireObject(record, label);
  for (const key of Object.keys(value)) {
    if (AI_ONLY_RECORD_FIELDS.has(key)) fail(`${label}.${key} is an AI field and must be nested under ai_generated`);
    if (!PUBLIC_RECORD_FIELDS.has(key)) fail(`${label}.${key} is not an allowed raw/source/AI record field`);
  }
  requireObject(value.source, `${label}.source`);
  const sourceKind = value.source.kind ?? "arxiv";
  if (!["arxiv", "repository_preprint"].includes(sourceKind)) {
    fail(`${label}.source.kind must be arxiv or repository_preprint`);
  }
  for (const field of ["title", "abstract", "published_at", "updated_at", "primary_category"]) {
    requireString(value[field], `${label}.${field}`);
  }
  if (sourceKind === "arxiv") {
    for (const field of ["arxiv_id", "arxiv_version"]) requireString(value[field], `${label}.${field}`);
  } else {
    requireString(value.id, `${label}.id`);
  }
  for (const field of ["authors", "categories", "tags"]) {
    if (!Array.isArray(value[field]) || value[field].length === 0) fail(`${label}.${field} must be a non-empty array`);
  }
  requireObject(value.links, `${label}.links`);
  requireString(value.links.abstract, `${label}.links.abstract`);
  if (sourceKind === "arxiv") {
    for (const field of ["pdf", "doi"]) requireString(value.links[field], `${label}.links.${field}`);
  } else {
    for (const field of ["pdf", "doi"]) {
      if (value.links[field] !== undefined && typeof value.links[field] !== "string") fail(`${label}.links.${field} must be a string when supplied`);
    }
  }
  requireString(value.source.url, `${label}.source.url`);
  validateCopyright(value, label);
  validateProvenance(value.ai_generated, `${label}.ai_generated`, { requireApproved: true });
  if (!value.ai_generated.abstract_zh) fail(`${label}.ai_generated.abstract_zh is required`);
  if (!Array.isArray(value.ai_generated.learning_highlights_zh) || value.ai_generated.learning_highlights_zh.length !== 4) {
    fail(`${label}.ai_generated.learning_highlights_zh must contain exactly 4 items`);
  }
  validatePublicTextBoundary(value, label);
  validateNoTestOnlyContent(value, label);
  return value;
}

export function validatePublicDataset(data, label = "public dataset") {
  const value = requireObject(data, label);
  if (!Array.isArray(value.records)) fail(`${label}.records must be an array`);
  if (value.record_count !== value.records.length) fail(`${label}.record_count must match records.length`);
  const ids = new Set();
  for (const [index, record] of value.records.entries()) {
    validatePublicRecord(record, `${label}.records[${index}]`);
    const identifier = record.source?.kind === "repository_preprint" ? record.id : record.arxiv_id;
    if (ids.has(identifier)) fail(`${label}: duplicate public record identifier ${identifier}`);
    ids.add(identifier);
  }
  return value;
}

export function validateEnrichmentArtifact(enrichment, label, { allowTestOnly = false } = {}) {
  const value = requireObject(enrichment, label);
  const jobs = requireObject(value.jobs, `${label}.jobs`);
  for (const name of ["translation", "highlight"]) {
    const job = requireObject(jobs[name], `${label}.jobs.${name}`);
    if (job.state !== "succeeded") continue;
    validateProvenance(job, `${label}.jobs.${name}`);
    if (!allowTestOnly) validateNoTestOnlyContent(job, `${label}.jobs.${name}`);
  }
  return value;
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

function evidencePayload(manifest) {
  const payload = structuredClone(manifest);
  delete payload.snapshot_digest;
  delete payload.stable_url;
  delete payload.immutable_url;
  delete payload.evidence_snapshot_url;
  delete payload.evidence_snapshot;
  delete payload.validation?.manifest_consumer_trial;
  delete payload.validation?.consumer_attestation;
  return payload;
}

export function validateToolReliabilityConsumerContract(manifest, audit) {
  const contract = requireObject(manifest.consumer_contract, "age-396 consumer contract");
  if (!Array.isArray(contract.questions) || contract.questions.length !== 3) fail("age-396 needs exactly three consumer questions");
  const sources = new Map(manifest.sources.map((item) => [item.source_id, item]));
  const evidence = new Map(manifest.evidence.map((item) => [item.evidence_id, item]));
  const claims = new Map(manifest.claims.map((item) => [item.claim_id, item]));
  const predecessors = new Map(manifest.predecessor_releases?.map((item) => [item.artifact_id, item]));
  const rejectAnswerKeys = (value, label = "consumer contract") => {
    if (Array.isArray(value)) return value.forEach((item, index) => rejectAnswerKeys(item, `${label}[${index}]`));
    if (!value || typeof value !== "object") return;
    for (const [key, child] of Object.entries(value)) {
      if (/^(?:expected|gold)_?answer$|^answer$/i.test(key)) fail(`${label} publishes an answer key: ${key}`);
      rejectAnswerKeys(child, `${label}.${key}`);
    }
  };
  rejectAnswerKeys(contract);
  for (const question of contract.questions) {
    requireString(question.question_id, "age-396 consumer question id");
    requireString(question.question, `age-396 ${question.question_id} question`);
    if (!Array.isArray(question.evidence_refs) || question.evidence_refs.length === 0) fail(`age-396 ${question.question_id} lacks evidence references`);
    for (const ref of question.evidence_refs) {
      const item = evidence.get(ref.evidence_id);
      if (!item) fail(`age-396 ${question.question_id} points to missing evidence ${ref.evidence_id}`);
      if (!sources.has(ref.source_id) || item.source_id !== ref.source_id) fail(`age-396 ${question.question_id} has mismatched evidence/source reference`);
    }
    if (!Array.isArray(question.claim_refs) || question.claim_refs.length === 0) fail(`age-396 ${question.question_id} lacks claim references`);
    for (const claimId of question.claim_refs) {
      const claim = claims.get(claimId);
      if (!claim) fail(`age-396 ${question.question_id} points to missing claim ${claimId}`);
      if (!question.evidence_refs.some((ref) => claim.supporting_evidence_ids.includes(ref.evidence_id))) fail(`age-396 ${question.question_id} claim is not supported by its cited evidence`);
    }
    for (const predecessorId of question.predecessor_release_ids ?? []) {
      const predecessor = predecessors.get(predecessorId);
      if (!predecessor?.snapshot_digest || !predecessor?.pinned_commit || !predecessor?.immutable_snapshot_url) fail(`age-396 ${question.question_id} points to an incomplete predecessor release`);
    }
  }
  if (!Array.isArray(audit.records) || audit.records.length !== manifest.sources.length) fail("age-396 metadata audit does not cover every source");
  const auditIds = new Set();
  for (const record of audit.records) {
    if (!sources.has(record.source_id) || auditIds.has(record.source_id)) fail("age-396 metadata audit source coverage is invalid");
    auditIds.add(record.source_id);
    if (record.verification_status === "unverified") { requireString(record.reason, `age-396 audit ${record.source_id} unverified reason`); continue; }
    if (record.verification_status !== "verified" || !Array.isArray(record.observations) || record.observations.length === 0) fail(`age-396 audit ${record.source_id} makes an unsupported verification claim`);
    const source = sources.get(record.source_id);
    for (const observation of record.observations) {
      for (const field of ["checked_url", "observed_title", "observed_arxiv_id", "observed_version", "checked_at", "verifier", "method", "match"]) requireString(observation[field], `age-396 audit ${record.source_id}.${field}`);
      if (observation.match !== "match" || observation.checked_url !== source.official_url || observation.observed_title !== source.title || observation.observed_arxiv_id !== source.arxiv_id || observation.observed_version !== source.version) fail(`age-396 audit ${record.source_id} observation does not match its source`);
    }
  }
}

async function validateToolReliabilityArtifact(registry, root) {
  const artifact = registry.governed_artifacts?.find((item) => item.artifact_id === "age-396-v1");
  if (!artifact || artifact.immutable !== true || artifact.release_status !== "immutable_release") fail("age-396-v1 must be recorded as an immutable release");
  validateProvenance(artifact.provenance, "age-396-v1.provenance", { requireApproved: true });
  if (artifact.provenance.source_model === LEGACY_UNKNOWN_MODEL) fail("age-396-v1 cannot use the legacy unknown-model exemption");
  const release = artifact.immutable_snapshot;
  const manifest = JSON.parse(await readFile(join(root, release.manifest_path), "utf8"));
  const snapshot = JSON.parse(await readFile(join(root, release.snapshot_path), "utf8"));
  const rawPrefix = "https://raw.githubusercontent.com/LiaoyuanNing/paper-learning-library/";
  const snapshotPath = "site/reports/tool-reliability-2026/data/evidence-snapshot.v1.json";
  if (manifest.artifact_id !== "age-396-v1" || manifest.immutable !== true || manifest.release_status !== "immutable_release") fail("age-396-v1 manifest release status is invalid");
  if (manifest.stable_url !== `${rawPrefix}main/${snapshotPath}` || manifest.immutable_url !== `${rawPrefix}age-396-v1/${snapshotPath}`) fail("age-396-v1 release URLs are invalid");
  if (manifest.snapshot_digest !== release.snapshot_digest || snapshot.snapshot_digest !== manifest.snapshot_digest || snapshot.release_status !== "immutable_release" || snapshot.immutable !== true) fail("age-396-v1 digest differs from governed immutable record");
  if (snapshot.stable_url !== manifest.stable_url || snapshot.immutable_url !== manifest.immutable_url) fail("age-396-v1 snapshot release URLs differ from manifest");
  if (sha256(evidencePayload(manifest)) !== manifest.snapshot_digest) fail("age-396-v1 manifest digest no longer verifies");
  assert.deepEqual(snapshot.evidence_payload, evidencePayload(manifest), "AGE-396 snapshot payload must equal the digest-covered manifest payload");
  const sourceIds = new Set(manifest.sources.map((item) => item.source_id));
  const evidenceIds = new Set(manifest.evidence.map((item) => item.evidence_id));
  if (manifest.claims.filter((item) => item.type === "direct_answer").length !== 10) fail("age-396 needs exactly 10 direct answers");
  if (manifest.claims.filter((item) => item.type === "product_recommendation").length !== 8) fail("age-396 needs exactly 8 product recommendations");
  if (manifest.critic_records?.length !== 5) fail("age-396 needs five critic records");
  for (const evidence of manifest.evidence) {
    if (!sourceIds.has(evidence.source_id) || !evidence.locator || !evidence.faithful_summary) fail(`age-396 evidence is not closed: ${evidence.evidence_id}`);
  }
  for (const claim of manifest.claims) for (const id of [...claim.supporting_evidence_ids, ...claim.contradicting_evidence_ids]) if (!evidenceIds.has(id)) fail(`age-396 claim points to missing evidence: ${claim.claim_id}`);
  for (const source of manifest.sources) {
    if (!/^https:\/\/arxiv\.org\/abs\/\d{4}\.\d{4,5}v\d+$/.test(source.official_url)) fail(`age-396 source URL is not a versioned arXiv record: ${source.source_id}`);
    if (!source.publication_status || !source.venue_status) fail(`age-396 source lacks publication status: ${source.source_id}`);
  }
  const audit = JSON.parse(await readFile(join(root, manifest.validation.metadata_audit), "utf8"));
  validateToolReliabilityConsumerContract(manifest, audit);
}

export async function validateAgentResearchGovernance(root) {
  const registryPath = join(root, "governance", "agent-research-governance.v1.json");
  const registry = JSON.parse(await readFile(registryPath, "utf8"));
  if (registry.policy_version !== "1.0.0") fail("agent research governance registry must reference policy version 1.0.0");
  const artifact = registry.governed_artifacts?.find((item) => item.artifact_id === "age-174-v2");
  if (!artifact) fail("agent research governance registry is missing age-174-v2");
  if (artifact.immutable !== true) fail("age-174-v2 must remain marked immutable");
  validateProvenance(artifact.provenance, "age-174-v2.provenance", { allowDayPrecision: true, requireApproved: true });
  if (!hasLegacyGrant(artifact.provenance)) fail("age-174-v2 unknown historical model must have an explicit legacy grant");
  if (artifact.promotion?.requires_librarian_review !== true) {
    fail("age-174-v2 promotion contract must require Librarian deduplication and review");
  }

  const manifestPath = join(root, artifact.immutable_snapshot?.manifest_path ?? "");
  const snapshotPath = join(root, artifact.immutable_snapshot?.snapshot_path ?? "");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  const snapshot = JSON.parse(await readFile(snapshotPath, "utf8"));
  const expectedDigest = artifact.immutable_snapshot?.snapshot_digest;
  if (manifest.manifest_version !== artifact.immutable_snapshot?.manifest_version) fail("AGE-174 manifest version differs from its governed immutable record");
  if (manifest.snapshot_digest !== expectedDigest || snapshot.snapshot_digest !== expectedDigest) {
    fail("AGE-174 immutable snapshot digest differs from its governed record");
  }
  if (sha256(evidencePayload(manifest)) !== expectedDigest) fail("AGE-174 manifest digest no longer verifies");
  assert.deepEqual(snapshot.evidence_payload, evidencePayload(manifest), "AGE-174 snapshot payload must remain byte-contract compatible");
  if (sha256(snapshot.evidence_payload) !== expectedDigest) fail("AGE-174 snapshot payload digest no longer verifies");

  const evidenceIds = new Set(manifest.evidence.map((item) => item.evidence_id));
  const sourceIds = new Set(manifest.sources.map((item) => item.source_id));
  for (const claim of manifest.claims) {
    if (!claim.claim_id || !claim.strength || !Array.isArray(claim.supporting_evidence_ids) || !Array.isArray(claim.contradicting_evidence_ids)) {
      fail(`AGE-174 claim is missing claim/evidence/strength contract fields: ${claim.claim_id ?? "unknown"}`);
    }
    for (const evidenceId of [...claim.supporting_evidence_ids, ...claim.contradicting_evidence_ids]) {
      if (!evidenceIds.has(evidenceId)) fail(`AGE-174 claim ${claim.claim_id} points to missing evidence ${evidenceId}`);
    }
  }
  for (const item of manifest.evidence) {
    if (!sourceIds.has(item.source_id)) fail(`AGE-174 evidence ${item.evidence_id} points to missing source ${item.source_id}`);
  }
  validateNoTestOnlyContent(manifest, "AGE-174 manifest");
  await validateToolReliabilityArtifact(registry, root);
  return registry;
}

async function listFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await listFiles(path));
    else if (entry.isFile()) files.push(path);
  }
  return files;
}

export async function validatePublishedGovernance(root) {
  for (const file of await listFiles(join(root, "site"))) {
    if (file.endsWith(".json")) {
      const data = JSON.parse(await readFile(file, "utf8"));
      validateNoTestOnlyContent(data, `published ${relative(root, file)}`);
      if (Array.isArray(data.records)) validatePublicDataset(data, `published ${relative(root, file)}`);
    }
    if (/\.(?:html|js|css|svg)$/i.test(file)) {
      validateNoTestOnlyContent(await readFile(file, "utf8"), `published ${relative(root, file)}`);
    }
  }
  await validateAgentResearchGovernance(root);
}
