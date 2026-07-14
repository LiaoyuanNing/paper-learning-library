import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir } from "node:fs/promises";
import { spawn } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

const root = new URL("..", import.meta.url);
const script = new URL("../scripts/arxiv-ingest.mjs", import.meta.url).pathname;
const fixture = new URL("./fixtures/arxiv-cli-fixture.json", import.meta.url).pathname;
const config = new URL("./fixtures/arxiv-ingest-config.fixture.json", import.meta.url).pathname;

function run(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [script, ...args], { cwd: root.pathname });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.once("error", reject);
    child.once("close", (code) => {
      if (code !== 0) return reject(new Error(`pipeline exited ${code}: ${stderr}`));
      resolve(JSON.parse(stdout));
    });
  });
}

test("pipeline is idempotent, audit-ready, and retries a failed AI job without publishing it", async () => {
  const dataDir = await mkdtemp(join(tmpdir(), "paper-learning-ingestion-"));
  const base = ["--data-dir", dataDir, "--adapter", "fixture", "--fixture", fixture];

  const first = await run([...base, "--ai-mode", "fail:translation", "id", "9900.00001v1"]);
  assert.equal(first.paper_count, 1);
  assert.equal(first.version_count, 1);
  assert.equal(first.ingested[0].created, true);
  assert.equal(first.ingested[0].statuses.translation.state, "failed");
  assert.equal(first.ingested[0].statuses.translation.retryable, true);

  const second = await run([...base, "id", "9900.00001v1"]);
  assert.equal(second.paper_count, 1, "re-ingesting an identical ID/version must not add a paper");
  assert.equal(second.version_count, 1, "re-ingesting an identical ID/version must not add a version");
  assert.equal(second.ingested[0].created, false);
  assert.equal(second.ingested[0].source_captures, 2, "source retrievals remain auditable");

  const configured = await run([...base, "config", "--config", config]);
  assert.equal(configured.runs.length, 2, "configured IDs and query rules both run");

  const versionTwo = await run([...base, "id", "9900.00001v2"]);
  assert.equal(versionTwo.paper_count, 2);
  assert.equal(versionTwo.version_count, 3, "a newer version is retained rather than silently overwritten");

  const beforeRetry = await run([...base, "status"]);
  const v1BeforeRetry = beforeRetry.records.find((record) => record.arxiv_id === "9900.00001" && record.arxiv_version === "v1");
  assert.equal(v1BeforeRetry.statuses.translation.state, "failed");
  assert.equal(v1BeforeRetry.statuses.review.state, "needs_review");
  assert.equal(v1BeforeRetry.statuses.publish.state, "unpublished");

  const retried = await run([...base, "--ai-mode", "fake", "retry", "--job", "translation"]);
  assert.equal(retried.paper_count, 2, "retrying a job must not create a paper record");
  assert.equal(retried.retried.length, 1);
  assert.equal(retried.retried[0].status.state, "succeeded");
  assert.equal(retried.retried[0].status.source_model, "test-fake-provider/v1");

  const failedHighlight = await run([...base, "--ai-mode", "fail:highlight", "id", "9900.00001v2"]);
  assert.equal(failedHighlight.ingested[0].statuses.highlight.state, "failed");
  const requeuedHighlight = await run([...base, "retry", "--job", "highlight"]);
  assert.equal(requeuedHighlight.retried.length, 1);
  assert.equal(requeuedHighlight.retried[0].status.state, "pending", "without a provider, retry stays visible as queued work");

  const index = JSON.parse(await readFile(join(dataDir, "index.json"), "utf8"));
  const v1 = index.papers["9900.00001"].versions.v1;
  const v2 = index.papers["9900.00001"].versions.v2;
  const raw = JSON.parse(await readFile(join(dataDir, v1.raw_path), "utf8"));
  const normalizedV1 = JSON.parse(await readFile(join(dataDir, v1.normalized_path), "utf8"));
  const normalizedV2 = JSON.parse(await readFile(join(dataDir, v2.normalized_path), "utf8"));
  const enrichment = JSON.parse(await readFile(join(dataDir, v1.enrichment_path), "utf8"));
  assert.equal(raw.captures.length, 3, "each retrieval keeps provider execution evidence");
  assert.equal(raw.captures[0].provider_execution.provider, "fixture-adapter");
  assert.ok(raw.captures[0].raw_metadata.title);
  assert.equal(normalizedV1.copyright.full_text_stored, false);
  assert.equal(normalizedV1.superseded_by, "v2");
  assert.equal(normalizedV2.supersedes, "v1");
  assert.equal(enrichment.jobs.translation.content.startsWith("[TEST ONLY]"), true);
  assert.deepEqual((await readdir(dataDir)).sort(), ["enrichments", "index.json", "papers", "raw"]);
});
