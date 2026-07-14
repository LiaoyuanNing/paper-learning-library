import assert from "node:assert/strict";
import { access, chmod, mkdir, mkdtemp, readFile, readdir, symlink, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

const root = new URL("..", import.meta.url);
const script = new URL("../scripts/arxiv-ingest.mjs", import.meta.url).pathname;
const fixture = new URL("./fixtures/arxiv-cli-fixture.json", import.meta.url).pathname;
const config = new URL("./fixtures/arxiv-ingest-config.fixture.json", import.meta.url).pathname;

function runRaw(args, { cwd = root.pathname } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [script, ...args], { cwd });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.once("error", reject);
    child.once("close", (code) => resolve({ code, stdout, stderr }));
  });
}

async function run(args, options) {
  const result = await runRaw(args, options);
  if (result.code !== 0) throw new Error(`pipeline exited ${result.code}: ${result.stderr}`);
  return JSON.parse(result.stdout);
}

async function runFailure(args, options) {
  const result = await runRaw(args, options);
  assert.notEqual(result.code, 0, "pipeline command should fail");
  return result;
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

  const failedAfterSuccess = await run([...base, "--ai-mode", "fail:translation", "id", "9900.00001v1"]);
  assert.equal(failedAfterSuccess.ingested[0].statuses.translation.state, "failed");

  const index = JSON.parse(await readFile(join(dataDir, "index.json"), "utf8"));
  const v1 = index.papers["9900.00001"].versions.v1;
  const v2 = index.papers["9900.00001"].versions.v2;
  const raw = JSON.parse(await readFile(join(dataDir, v1.raw_path), "utf8"));
  const normalizedV1 = JSON.parse(await readFile(join(dataDir, v1.normalized_path), "utf8"));
  const normalizedV2 = JSON.parse(await readFile(join(dataDir, v2.normalized_path), "utf8"));
  const enrichment = JSON.parse(await readFile(join(dataDir, v1.enrichment_path), "utf8"));
  assert.equal(raw.captures.length, 4, "each retrieval keeps provider execution evidence");
  assert.ok(raw.captures[0].capture_id);
  assert.ok(raw.captures[0].payload_sha256);
  assert.equal(raw.captures[0].provider_execution.provider, "fixture-adapter");
  assert.ok(raw.captures[0].raw_metadata.title);
  assert.equal(normalizedV1.copyright.full_text_stored, false);
  assert.equal(normalizedV1.normalized_from_capture_id, raw.captures[0].capture_id);
  assert.equal(normalizedV1.source_capture.capture_id, raw.captures[0].capture_id);
  assert.equal(normalizedV1.superseded_by, "v2");
  assert.equal(normalizedV2.supersedes, "v1");
  assert.equal(enrichment.jobs.translation.state, "failed");
  assert.equal(enrichment.jobs.translation.content, null, "a failed job cannot retain a successful artifact");
  assert.equal(enrichment.jobs.translation.generated_at, null);
  assert.equal(enrichment.jobs.translation.source_model, null);
  assert.equal(index.ingestion_runs.filter((run) => run.state === "succeeded").length, 7);
  assert.deepEqual((await readdir(dataDir)).sort(), ["enrichments", "index.json", "papers", "raw"]);
});

test("rebuilds supersession links when versions arrive out of order", async () => {
  const dataDir = await mkdtemp(join(tmpdir(), "paper-learning-version-order-"));
  const base = ["--data-dir", dataDir, "--adapter", "fixture", "--fixture", fixture];

  await run([...base, "id", "9900.00001v2"]);
  await run([...base, "id", "9900.00001v1"]);

  const index = JSON.parse(await readFile(join(dataDir, "index.json"), "utf8"));
  const v1 = JSON.parse(await readFile(join(dataDir, index.papers["9900.00001"].versions.v1.normalized_path), "utf8"));
  const v2 = JSON.parse(await readFile(join(dataDir, index.papers["9900.00001"].versions.v2.normalized_path), "utf8"));
  assert.equal(index.papers["9900.00001"].latest_version, "v2");
  assert.equal(v1.superseded_by, "v2");
  assert.equal(v2.supersedes, "v1");
});

test("uses the arxiv-cli exact-ID contract and preserves its runtime identity", async () => {
  const workspace = await mkdtemp(join(tmpdir(), "paper-learning-cli-contract-"));
  const dataDir = join(workspace, "store");
  const cli = join(workspace, "fake-arxiv-cli.mjs");
  const record = {
    id: "http://arxiv.org/abs/9900.00001v2",
    short_id: "9900.00001v2",
    title: "Exact adapter contract fixture",
    summary: "Metadata only.",
    published: "2026-01-01T00:00:00+00:00",
    updated: "2026-02-01T00:00:00+00:00",
    authors: ["Test Author"],
    primary_category: "cs.AI",
    categories: ["cs.AI"],
    pdf_url: "https://arxiv.org/pdf/9900.00001v2",
    doi: null,
  };
  await writeFile(cli, [
    "#!/usr/bin/env node",
    "if (!process.argv.includes('--id')) { process.stderr.write('missing --id'); process.exit(9); }",
    `process.stdout.write(${JSON.stringify(JSON.stringify([record]))});`,
  ].join("\n"), "utf8");
  await chmod(cli, 0o755);

  const result = await run([
    "--data-dir", dataDir,
    "--adapter", "arxiv-cli",
    "--arxiv-cli-bin", cli,
    "id", "9900.00001v2",
  ]);
  assert.equal(result.ingested[0].version, "v2");
  const index = JSON.parse(await readFile(join(dataDir, "index.json"), "utf8"));
  const execution = index.ingestion_runs[0].provider_execution;
  assert.equal(execution.provider, "arxiv-cli-tools");
  assert.ok(execution.adapter_identity.executable_sha256);
  assert.deepEqual(execution.executions[0].argv.slice(0, 4), ["search", "--id", "9900.00001v2", "--max-results"]);
});

test("does not substitute a newer version when a historical ID cannot be returned", async () => {
  const workspace = await mkdtemp(join(tmpdir(), "paper-learning-history-mismatch-"));
  const dataDir = join(workspace, "store");
  const cli = join(workspace, "current-only-arxiv-cli.mjs");
  const currentRecord = {
    id: "http://arxiv.org/abs/9900.00001v3",
    short_id: "9900.00001v3",
    title: "Current version only",
    summary: "Metadata only.",
    published: "2026-01-01T00:00:00+00:00",
    updated: "2026-03-01T00:00:00+00:00",
    authors: ["Test Author"],
    primary_category: "cs.AI",
    categories: ["cs.AI"],
    pdf_url: "https://arxiv.org/pdf/9900.00001v3",
    doi: null,
  };
  await writeFile(cli, [
    "#!/usr/bin/env node",
    `process.stdout.write(${JSON.stringify(JSON.stringify([currentRecord]))});`,
  ].join("\n"), "utf8");
  await chmod(cli, 0o755);

  const failed = await runFailure([
    "--data-dir", dataDir,
    "--adapter", "arxiv-cli",
    "--arxiv-cli-bin", cli,
    "id", "9900.00001v2",
  ]);
  assert.match(failed.stderr, /Provider returned no exact record for 9900\.00001v2/);
  const status = await run(["--data-dir", dataDir, "status"]);
  assert.equal(status.paper_count, 0);
  assert.equal(status.failed_ingestions.length, 1);
  assert.equal(status.failed_ingestions[0].input.value, "9900.00001v2");
  assert.equal(status.failed_ingestions[0].provider_execution.executions.length, 2);
});

test("persists failed ingestion attempts, exposes them in status, and retries them", async () => {
  const dataDir = await mkdtemp(join(tmpdir(), "paper-learning-failed-ingestion-"));
  const absentCli = join(dataDir, "missing-arxiv-cli");
  const base = ["--data-dir", dataDir, "--adapter", "arxiv-cli", "--arxiv-cli-bin", absentCli];

  const failed = await runFailure([...base, "id", "9900.00001v1"]);
  assert.match(failed.stderr, /arxiv-cli could not start/);

  const firstStatus = await run(["--data-dir", dataDir, "status"]);
  assert.equal(firstStatus.paper_count, 0);
  assert.equal(firstStatus.failed_ingestions.length, 1);
  assert.equal(firstStatus.failed_ingestions[0].state, "failed");
  assert.equal(firstStatus.failed_ingestions[0].input.value, "9900.00001v1");
  assert.ok(firstStatus.failed_ingestions[0].provider_execution.execution_error);
  assert.match(firstStatus.failed_ingestions[0].error.message, /could not start/);
  assert.deepEqual(firstStatus.failed_ingestions[0].state_history.map((entry) => entry.state), ["pending", "running", "failed"]);

  const retried = await run([...base, "retry", "--job", "ingestion"]);
  assert.equal(retried.retried.length, 1);
  assert.equal(retried.retried[0].state, "failed");
  const secondStatus = await run(["--data-dir", dataDir, "status"]);
  assert.equal(secondStatus.failed_ingestions.length, 2, "the retry is a separately auditable attempt");
  assert.equal(secondStatus.failed_ingestions[1].retry_of, firstStatus.failed_ingestions[0].run_id);
});

test("refuses public site directories before any pipeline file is written", async () => {
  const project = await mkdtemp(join(tmpdir(), "paper-learning-public-guard-"));
  const site = join(project, "site");
  await mkdir(site);
  const base = ["--adapter", "fixture", "--fixture", fixture, "id", "9900.00001v1"];

  const direct = await runFailure(["--data-dir", join(site, "data"), ...base], { cwd: project });
  assert.match(direct.stderr, /Refusing --data-dir inside public site directory/);
  await assert.rejects(access(join(site, "data", "index.json")));

  const linkedSite = join(project, "site-link");
  await symlink(site, linkedSite);
  const viaSymlink = await runFailure(["--data-dir", join(linkedSite, "data"), ...base], { cwd: project });
  assert.match(viaSymlink.stderr, /Refusing --data-dir inside public site directory/);
  await assert.rejects(access(join(site, "data", "index.json")));
});

test("rejects non-positive configured search limits", async () => {
  const workspace = await mkdtemp(join(tmpdir(), "paper-learning-config-limit-"));
  const configPath = join(workspace, "invalid-config.json");
  await writeFile(configPath, JSON.stringify({ searches: [{ query: "fixture agents", limit: -1 }] }), "utf8");
  const failed = await runFailure([
    "--data-dir", join(workspace, "store"),
    "--adapter", "fixture",
    "--fixture", fixture,
    "config", "--config", configPath,
  ]);
  assert.match(failed.stderr, /Configured search 1 limit must be a positive integer/);
});
