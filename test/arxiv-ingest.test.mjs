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

function runRaw(args, { cwd = root.pathname, env = process.env } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [script, ...args], { cwd, env });
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
  assert.deepEqual(Object.keys(raw.captures[0].raw_metadata).sort(), [
    "authors", "categories", "doi", "id", "pdf_url", "primary_category", "published", "short_id", "summary", "title", "updated",
  ]);
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
  assert.equal(execution.adapter_identity.runtime.kind, "non_python");
  assert.deepEqual(execution.executions[0].argv.slice(0, 4), ["search", "--id", "9900.00001v2", "--max-results"]);
  assert.deepEqual(execution.observed_candidates.map(({ arxiv_id, arxiv_version }) => ({ arxiv_id, arxiv_version })), [
    { arxiv_id: "9900.00001", arxiv_version: "v2" },
  ]);
});

test("fingerprints the Python console entry point and installed distribution contents", async () => {
  const workspace = await mkdtemp(join(tmpdir(), "paper-learning-python-identity-"));
  const dataDir = join(workspace, "store");
  const pythonSite = join(workspace, "python-site");
  const packageDir = join(pythonSite, "arxiv_cli");
  const distInfo = join(pythonSite, "arxiv_cli_tools-0.0.0.dist-info");
  const cli = join(workspace, "fake-python-arxiv-cli");
  const record = {
    id: "http://arxiv.org/abs/9900.00003v1",
    short_id: "9900.00003v1",
    title: "Python identity fixture",
    summary: "Metadata only.",
    published: "2026-01-01T00:00:00+00:00",
    updated: "2026-01-01T00:00:00+00:00",
    authors: ["Test Author"],
    primary_category: "cs.AI",
    categories: ["cs.AI"],
    pdf_url: "https://arxiv.org/pdf/9900.00003v1",
    doi: null,
  };
  await mkdir(packageDir, { recursive: true });
  await mkdir(distInfo, { recursive: true });
  await writeFile(join(packageDir, "__init__.py"), "", "utf8");
  await writeFile(join(packageDir, "cli.py"), "def main():\n    return 0\n", "utf8");
  await writeFile(join(distInfo, "METADATA"), "Metadata-Version: 2.1\nName: arxiv-cli-tools\nVersion: 0.0.0\n", "utf8");
  await writeFile(join(distInfo, "entry_points.txt"), "[console_scripts]\narxiv-cli = arxiv_cli.cli:main\n", "utf8");
  await writeFile(join(distInfo, "RECORD"), [
    "arxiv_cli/__init__.py,,",
    "arxiv_cli/cli.py,,",
    "arxiv_cli_tools-0.0.0.dist-info/METADATA,,",
    "arxiv_cli_tools-0.0.0.dist-info/entry_points.txt,,",
    "arxiv_cli_tools-0.0.0.dist-info/RECORD,,",
  ].join("\n"), "utf8");
  await writeFile(cli, [
    "#!/usr/bin/env python3",
    "import json",
    `print(${JSON.stringify(JSON.stringify([record]))})`,
  ].join("\n"), "utf8");
  await chmod(cli, 0o755);

  const result = await run([
    "--data-dir", dataDir,
    "--adapter", "arxiv-cli",
    "--arxiv-cli-bin", cli,
    "id", "9900.00003v1",
  ], {
    env: {
      ...process.env,
      PYTHONPATH: [pythonSite, process.env.PYTHONPATH].filter(Boolean).join(":"),
    },
  });
  assert.equal(result.ingested[0].version, "v1");
  const index = JSON.parse(await readFile(join(dataDir, "index.json"), "utf8"));
  const runtime = index.ingestion_runs[0].provider_execution.adapter_identity.runtime;
  assert.equal(runtime.kind, "python");
  assert.equal(runtime.console_entry_point.name, "arxiv-cli");
  assert.match(runtime.console_entry_point.path, /arxiv_cli[\\/]cli\.py$/);
  assert.ok(runtime.console_entry_point.sha256);
  const distribution = runtime.distributions["arxiv-cli-tools"];
  assert.equal(distribution.version, "0.0.0");
  assert.equal(distribution.file_count, 5);
  assert.ok(distribution.files_manifest_sha256);
  assert.ok(distribution.files_content_sha256);
  assert.ok(distribution.record_sha256);
});

test("never stores raw provider stderr in successful or failed ingestion evidence", async () => {
  const workspace = await mkdtemp(join(tmpdir(), "paper-learning-stderr-boundary-"));
  const dataDir = join(workspace, "store");
  const cli = join(workspace, "fake-arxiv-cli.mjs");
  const forbidden = "full_text: PROHIBITED_STORED_PAPER_BODY";
  const record = {
    id: "http://arxiv.org/abs/9900.00004v1",
    short_id: "9900.00004v1",
    title: "Stderr boundary fixture",
    summary: "Metadata only.",
    published: "2026-01-01T00:00:00+00:00",
    updated: "2026-01-01T00:00:00+00:00",
    authors: ["Test Author"],
    primary_category: "cs.AI",
    categories: ["cs.AI"],
    pdf_url: "https://arxiv.org/pdf/9900.00004v1",
    doi: null,
  };
  await writeFile(cli, [
    "#!/usr/bin/env node",
    `process.stdout.write(${JSON.stringify(JSON.stringify([record]))});`,
    `process.stderr.write(${JSON.stringify(forbidden)});`,
  ].join("\n"), "utf8");
  await chmod(cli, 0o755);

  await run([
    "--data-dir", dataDir,
    "--adapter", "arxiv-cli",
    "--arxiv-cli-bin", cli,
    "id", "9900.00004v1",
  ]);
  let index = JSON.parse(await readFile(join(dataDir, "index.json"), "utf8"));
  const successExecution = index.ingestion_runs[0].provider_execution.executions[0];
  assert.ok(successExecution.stderr_sha256);
  assert.equal(successExecution.stderr_bytes, Buffer.byteLength(forbidden));
  assert.equal(successExecution.stderr_diagnostic, "provider_stderr_present");
  assert.equal(Object.hasOwn(successExecution, "stderr"), false);
  assert.equal(JSON.stringify(index).includes(forbidden), false);

  await writeFile(cli, [
    "#!/usr/bin/env node",
    `process.stderr.write(${JSON.stringify(forbidden)});`,
    "process.exit(7);",
  ].join("\n"), "utf8");
  const failed = await runFailure([
    "--data-dir", dataDir,
    "--adapter", "arxiv-cli",
    "--arxiv-cli-bin", cli,
    "id", "9900.00004v1",
  ]);
  assert.equal(failed.stderr.includes(forbidden), false);
  index = JSON.parse(await readFile(join(dataDir, "index.json"), "utf8"));
  const failedExecution = index.ingestion_runs.at(-1).provider_execution;
  assert.equal(failedExecution.stderr_diagnostic, "provider_stderr_present");
  assert.ok(failedExecution.stderr_sha256);
  assert.equal(Object.hasOwn(failedExecution, "stderr"), false);
  assert.equal(JSON.stringify(index).includes(forbidden), false);
});

test("rejects conflicting ID, short ID, and source-link identities before any paper write", async () => {
  const workspace = await mkdtemp(join(tmpdir(), "paper-learning-identity-conflict-"));
  const dataDir = join(workspace, "store");
  const cli = join(workspace, "conflicting-arxiv-cli.mjs");
  const record = {
    id: "http://arxiv.org/abs/9900.00005v2",
    short_id: "9900.00005v2",
    title: "Conflicting identity fixture",
    summary: "Metadata only.",
    published: "2026-01-01T00:00:00+00:00",
    updated: "2026-01-01T00:00:00+00:00",
    authors: ["Test Author"],
    primary_category: "cs.AI",
    categories: ["cs.AI"],
    pdf_url: "https://arxiv.org/pdf/9900.00005v3",
    doi: null,
  };
  await writeFile(cli, [
    "#!/usr/bin/env node",
    `process.stdout.write(${JSON.stringify(JSON.stringify([record]))});`,
  ].join("\n"), "utf8");
  await chmod(cli, 0o755);

  const failed = await runFailure([
    "--data-dir", dataDir,
    "--adapter", "arxiv-cli",
    "--arxiv-cli-bin", cli,
    "id", "9900.00005v2",
  ]);
  assert.match(failed.stderr, /conflicting arXiv identity fields/);
  const status = await run(["--data-dir", dataDir, "status"]);
  assert.equal(status.paper_count, 0);
  assert.equal(status.failed_ingestions.length, 1);
  const candidate = status.failed_ingestions[0].provider_execution.observed_candidates[0];
  assert.equal(candidate.identity_status, "conflict");
  assert.deepEqual(candidate.identity_candidates, [
    { arxiv_id: "9900.00005", arxiv_version: "v2" },
    { arxiv_id: "9900.00005", arxiv_version: "v3" },
  ]);
  await assert.rejects(access(join(dataDir, "raw")));
  await assert.rejects(access(join(dataDir, "papers")));
});

test("persists the three-second arXiv interval across fallback and separate runs", async () => {
  const workspace = await mkdtemp(join(tmpdir(), "paper-learning-rate-limit-"));
  const dataDir = join(workspace, "store");
  const cli = join(workspace, "rate-limited-arxiv-cli.mjs");
  const callLog = join(workspace, "provider-calls.log");
  const currentRecord = {
    id: "http://arxiv.org/abs/9900.00006v3",
    short_id: "9900.00006v3",
    title: "Rate limit fixture",
    summary: "Metadata only.",
    published: "2026-01-01T00:00:00+00:00",
    updated: "2026-03-01T00:00:00+00:00",
    authors: ["Test Author"],
    primary_category: "cs.AI",
    categories: ["cs.AI"],
    pdf_url: "https://arxiv.org/pdf/9900.00006v3",
    doi: null,
  };
  await writeFile(cli, [
    "#!/usr/bin/env node",
    "import { appendFileSync } from 'node:fs';",
    "appendFileSync(process.env.ARXIV_RATE_LOG, `${Date.now()}\\n`);",
    `process.stdout.write(${JSON.stringify(JSON.stringify([currentRecord]))});`,
  ].join("\n"), "utf8");
  await chmod(cli, 0o755);
  const options = {
    env: { ...process.env, ARXIV_RATE_LOG: callLog },
  };
  const base = ["--data-dir", dataDir, "--adapter", "arxiv-cli", "--arxiv-cli-bin", cli];

  await runFailure([...base, "id", "9900.00006v2"], options);
  await run([...base, "id", "9900.00006v3"], options);

  const callTimes = (await readFile(callLog, "utf8")).trim().split("\n").map(Number);
  assert.equal(callTimes.length, 3, "exact lookup, fallback, and later run all call the provider");
  assert.ok(callTimes[1] - callTimes[0] >= 3_000, `fallback is rate limited: ${callTimes.join(", ")}`);
  assert.ok(callTimes[2] - callTimes[1] >= 3_000, `a separate run is rate limited: ${callTimes.join(", ")}`);
  const index = JSON.parse(await readFile(join(dataDir, "index.json"), "utf8"));
  assert.equal(index.provider_rate_limits["arxiv-cli-tools"].minimum_interval_ms, 3_000);
  assert.ok(index.provider_rate_limits["arxiv-cli-tools"].last_started_at);
  const executions = index.ingestion_runs.flatMap((ingestionRun) => ingestionRun.provider_execution?.executions ?? []);
  assert.equal(executions.length, 3);
  assert.ok(executions.every((execution) => execution.rate_limit.minimum_interval_ms === 3_000));
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
  assert.deepEqual(status.failed_ingestions[0].provider_execution.observed_candidates.map(({ arxiv_id, arxiv_version }) => ({ arxiv_id, arxiv_version })), [
    { arxiv_id: "9900.00001", arxiv_version: "v3" },
  ]);
  assert.ok(status.failed_ingestions[0].provider_execution.observed_candidates[0].payload_sha256);
});

test("retries only the current failed ingestion lineage leaf and retires it after success", async () => {
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
  assert.equal(secondStatus.failed_ingestions.length, 1, "only the newest failed lineage leaf remains retryable");
  const rootFailure = secondStatus.ingestion_runs.find((run) => run.run_id === firstStatus.failed_ingestions[0].run_id);
  const firstRetry = secondStatus.failed_ingestions[0];
  assert.equal(firstRetry.retry_of, rootFailure.run_id);
  assert.equal(rootFailure.retryable, false);
  assert.equal(rootFailure.superseded_by_run_id, firstRetry.run_id);
  assert.equal(firstRetry.retry_root_id, rootFailure.run_id);

  const retriedAgain = await run([...base, "retry", "--job", "ingestion"]);
  assert.equal(retriedAgain.retried.length, 1, "a second retry cannot rerun retired ancestors");
  const thirdStatus = await run(["--data-dir", dataDir, "status"]);
  assert.equal(thirdStatus.failed_ingestions.length, 1);
  const secondRetry = thirdStatus.failed_ingestions[0];
  const retiredFirstRetry = thirdStatus.ingestion_runs.find((run) => run.run_id === firstRetry.run_id);
  assert.equal(secondRetry.retry_of, firstRetry.run_id);
  assert.equal(retiredFirstRetry.superseded_by_run_id, secondRetry.run_id);

  const recoveredRecord = {
    id: "http://arxiv.org/abs/9900.00001v1",
    short_id: "9900.00001v1",
    title: "Recovered record",
    summary: "Metadata only.",
    published: "2026-01-01T00:00:00+00:00",
    updated: "2026-01-01T00:00:00+00:00",
    authors: ["Test Author"],
    primary_category: "cs.AI",
    categories: ["cs.AI"],
    pdf_url: "https://arxiv.org/pdf/9900.00001v1",
    doi: null,
  };
  await writeFile(absentCli, [
    "#!/usr/bin/env node",
    `process.stdout.write(${JSON.stringify(JSON.stringify([recoveredRecord]))});`,
  ].join("\n"), "utf8");
  await chmod(absentCli, 0o755);

  const recovered = await run([...base, "retry", "--job", "ingestion"]);
  assert.equal(recovered.retried.length, 1);
  assert.equal(recovered.retried[0].state, "succeeded");
  const finalStatus = await run(["--data-dir", dataDir, "status"]);
  assert.equal(finalStatus.paper_count, 1);
  assert.equal(finalStatus.failed_ingestions.length, 0, "a successful child leaves no active failed retry in its lineage");
  const recoveryRun = finalStatus.ingestion_runs.find((run) => run.retry_of === secondRetry.run_id);
  const retiredSecondRetry = finalStatus.ingestion_runs.find((run) => run.run_id === secondRetry.run_id);
  assert.equal(recoveryRun.state, "succeeded");
  assert.equal(retiredSecondRetry.superseded_by_run_id, recoveryRun.run_id);
  assert.equal(recoveryRun.retry_root_id, rootFailure.run_id);
});

test("rejects full-text fields and validates a whole provider batch before writing papers", async () => {
  const workspace = await mkdtemp(join(tmpdir(), "paper-learning-metadata-boundary-"));
  const dataDir = join(workspace, "store");
  const fixturePath = join(workspace, "unsafe-fixture.json");
  const fixtureRecords = JSON.parse(await readFile(fixture, "utf8")).papers;
  const unsafeRecord = { ...fixtureRecords[1], full_text: "This must never be persisted." };
  await writeFile(fixturePath, JSON.stringify({
    papers: fixtureRecords,
    searches: { unsafe: [fixtureRecords[0], unsafeRecord] },
  }), "utf8");

  const failed = await runFailure([
    "--data-dir", dataDir,
    "--adapter", "fixture",
    "--fixture", fixturePath,
    "search", "--query", "unsafe", "--limit", "2",
  ]);
  assert.match(failed.stderr, /prohibited full-text field: full_text/);
  const status = await run(["--data-dir", dataDir, "status"]);
  assert.equal(status.paper_count, 0);
  assert.equal(status.failed_ingestions.length, 1);
  assert.ok(status.failed_ingestions[0].provider_execution.stdout_sha256, "the full provider output remains auditable by hash");
  assert.equal(status.failed_ingestions[0].provider_execution.observed_candidates.length, 2);
  await assert.rejects(access(join(dataDir, "raw")));
  await assert.rejects(access(join(dataDir, "papers")));
  await assert.rejects(access(join(dataDir, "enrichments")));
  assert.deepEqual(await readdir(dataDir), ["index.json"]);
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
