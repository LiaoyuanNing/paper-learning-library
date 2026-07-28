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
  for (const field of ["arxiv_id", "arxiv_version", "title", "abstract", "published_at", "updated_at", "primary_category"]) {
    requireString(value[field], `${label}.${field}`);
  }
  for (const field of ["authors", "categories", "tags"]) {
    if (!Array.isArray(value[field]) || value[field].length === 0) fail(`${label}.${field} must be a non-empty array`);
  }
  requireObject(value.links, `${label}.links`);
  for (const field of ["abstract", "pdf", "doi"]) requireString(value.links[field], `${label}.links.${field}`);
  requireObject(value.source, `${label}.source`);
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
    if (ids.has(record.arxiv_id)) fail(`${label}: duplicate arXiv ID ${record.arxiv_id}`);
    ids.add(record.arxiv_id);
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
  delete payload.evidence_snapshot_url;
  delete payload.evidence_snapshot;
  delete payload.validation?.manifest_consumer_trial;
  delete payload.validation?.consumer_attestation;
  return payload;
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
