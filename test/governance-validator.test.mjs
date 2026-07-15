import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  GovernanceValidationError,
  validateAgentResearchGovernance,
  validateEnrichmentArtifact,
  validatePublicRecord,
} from "../scripts/governance-validator.mjs";

const root = new URL("../", import.meta.url);
const [dataset, fixtures] = await Promise.all([
  readFile(new URL("../site/data/paper_learning_mvp_sample.json", import.meta.url), "utf8").then(JSON.parse),
  readFile(new URL("fixtures/governance-cases.json", import.meta.url), "utf8").then(JSON.parse),
]);

function clone(value) {
  return structuredClone(value);
}

function pathTarget(value, path, { create = false } = {}) {
  const parts = path.split(".");
  const key = parts.pop();
  const target = parts.reduce((current, part) => {
    if (create && current[part] === undefined) current[part] = {};
    return current[part];
  }, value);
  return { target, key };
}

function setPath(value, path, next) {
  const { target, key } = pathTarget(value, path, { create: true });
  target[key] = next;
}

function deletePath(value, path) {
  const { target, key } = pathTarget(value, path);
  delete target[key];
}

function applyScenario(scenario) {
  const record = clone(dataset.records[0]);
  if (scenario.operation === "set") setPath(record, scenario.path, scenario.value);
  if (scenario.operation === "delete") deletePath(record, scenario.path);
  if (scenario.operation === "set_many") {
    for (const [path, value] of Object.entries(scenario.values)) setPath(record, path, value);
  }
  for (const path of scenario.deletes ?? []) deletePath(record, path);
  return record;
}

test("governance fixtures accept only records that satisfy provenance, review, and copyright gates", () => {
  for (const scenario of fixtures.scenarios) {
    const record = applyScenario(scenario);
    if (scenario.valid) {
      assert.doesNotThrow(() => validatePublicRecord(record, `fixture:${scenario.name}`), scenario.name);
    } else {
      assert.throws(
        () => validatePublicRecord(record, `fixture:${scenario.name}`),
        (error) => error instanceof GovernanceValidationError && new RegExp(scenario.error, "i").test(error.message),
        scenario.name,
      );
    }
  }
});

test("pipeline AI artifacts keep provenance and review fields even in isolated fake mode", () => {
  const enrichment = {
    jobs: {
      translation: {
        state: "succeeded",
        generated_at: "2026-07-15T00:00:00Z",
        source_model: "test-fake-provider/v1",
        provider: "test-fixture",
        workflow_version: "arxiv-ingest-fixture-v1",
        input_evidence: [{ kind: "test_fixture", reference: "--ai-mode fake" }],
        review: { status: "pending", reviewer: null, reviewed_at: null, reason: null },
        content: "[TEST ONLY] Fake translated abstract.",
      },
      highlight: { state: "pending" },
    },
  };
  assert.doesNotThrow(() => validateEnrichmentArtifact(enrichment, "fixture enrichment", { allowTestOnly: true }));
  assert.throws(() => validateEnrichmentArtifact(enrichment, "fixture enrichment"), /test\/mock\/fake/);
});

test("AGE-174 v2 remains governed through a sidecar without changing its immutable payload", async () => {
  await assert.doesNotReject(validateAgentResearchGovernance(root.pathname));
});
