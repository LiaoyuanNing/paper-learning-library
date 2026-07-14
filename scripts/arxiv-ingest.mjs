#!/usr/bin/env node

/**
 * Filesystem-backed arXiv ingestion MVP.
 *
 * Production reads arXiv only through arxiv-cli-tools. The fixture adapter is
 * deliberately test-only. Neither adapter can write to the public site/ tree.
 */
import { createHash, randomUUID } from "node:crypto";
import { constants } from "node:fs";
import { access, mkdir, open, readFile, realpath, rename, unlink, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { basename, dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = process.cwd();
const REPOSITORY_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_DATA_DIR = "data/arxiv-ingestion";
const JOB_STATES = new Set(["pending", "running", "succeeded", "failed"]);

class PipelineFailure extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = "PipelineFailure";
    this.evidence = details.evidence ?? null;
  }
}

function usage(message) {
  if (message) console.error(`Error: ${message}\n`);
  console.error(`Usage:
  node scripts/arxiv-ingest.mjs [options] id <arxiv-id-or-version>
  node scripts/arxiv-ingest.mjs [options] search --query <query> --limit <n> [--author <name>] [--category <code>]
  node scripts/arxiv-ingest.mjs [options] config --config <file>
  node scripts/arxiv-ingest.mjs [options] status
  node scripts/arxiv-ingest.mjs [options] retry --job <ingestion|translation|highlight>

Options:
  --data-dir <path>        Separate pipeline store (default: ${DEFAULT_DATA_DIR})
  --adapter <name>         arxiv-cli (default) or fixture (test only)
  --fixture <path>         Fixture JSON required by the fixture adapter
  --ai-mode <mode>         pending (default), fake, fail:translation, fail:highlight,
                           running:translation, or running:highlight
  --arxiv-cli-bin <path>   arxiv-cli executable (or set ARXIV_CLI_BIN)

No paper full text or PDF is downloaded or stored.`);
  process.exitCode = 2;
}

function parseArgs(argv) {
  const options = {
    dataDir: DEFAULT_DATA_DIR,
    adapter: "arxiv-cli",
    aiMode: "pending",
    authors: [],
    categories: [],
  };
  const positional = [];
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (!value.startsWith("--")) {
      positional.push(value);
      continue;
    }
    const name = value.slice(2);
    const next = argv[index + 1];
    if (name === "author" || name === "category") {
      if (!next || next.startsWith("--")) throw new Error(`--${name} requires a value`);
      options[name === "author" ? "authors" : "categories"].push(next);
      index += 1;
      continue;
    }
    const field = {
      "data-dir": "dataDir",
      adapter: "adapter",
      fixture: "fixture",
      "ai-mode": "aiMode",
      "arxiv-cli-bin": "arxivCliBin",
      query: "query",
      limit: "limit",
      config: "config",
      job: "job",
    }[name];
    if (!field) throw new Error(`Unknown option --${name}`);
    if (!next || next.startsWith("--")) throw new Error(`--${name} requires a value`);
    options[field] = next;
    index += 1;
  }
  return { options, positional };
}

function canonicalId(input) {
  const cleaned = String(input).trim().replace(/^https?:\/\/arxiv\.org\/abs\//i, "");
  const match = cleaned.match(/^(?<id>(?:\d{4}\.\d{4,5}|[a-z-]+\/\d{7}))(?<version>v\d+)?$/i);
  if (!match?.groups) throw new Error(`Invalid arXiv ID/version: ${input}`);
  return { id: match.groups.id.toLowerCase(), version: match.groups.version?.toLowerCase() ?? null };
}

function parsedShortId(record) {
  return canonicalId(record.short_id ?? record.id);
}

function paperKey(id, version) {
  return `${id}@${version}`;
}

function safeId(id) {
  return id.replaceAll("/", "_");
}

function now() {
  return new Date().toISOString();
}

function digest(value) {
  return createHash("sha256").update(value).digest("hex");
}

function relativeToData(dataDir, path) {
  return relative(dataDir, path).split("\\").join("/");
}

function versionNumber(version) {
  return Number(version.replace(/^v/, ""));
}

function compareVersions(left, right) {
  return versionNumber(left) - versionNumber(right);
}

function parsePositiveLimit(value, label) {
  const limit = Number(value);
  if (!Number.isInteger(limit) || limit < 1) throw new Error(`${label} must be a positive integer`);
  return limit;
}

function isWithin(candidate, boundary) {
  return candidate === boundary || candidate.startsWith(`${boundary}${sep}`);
}

async function canonicalizePath(path) {
  const missing = [];
  let cursor = resolve(path);
  while (true) {
    try {
      const existing = await realpath(cursor);
      return resolve(existing, ...missing.reverse());
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      const parent = dirname(cursor);
      if (parent === cursor) throw error;
      missing.push(basename(cursor));
      cursor = parent;
    }
  }
}

async function assertSafeDataDir(requestedPath) {
  const dataDir = await canonicalizePath(requestedPath);
  const publicRoots = await Promise.all([
    canonicalizePath(join(REPOSITORY_ROOT, "site")),
    canonicalizePath(join(ROOT, "site")),
  ]);
  for (const publicRoot of publicRoots) {
    if (isWithin(dataDir, publicRoot)) {
      throw new Error(`Refusing --data-dir inside public site directory: ${dataDir}`);
    }
  }
  return dataDir;
}

async function readJson(path, fallback) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return fallback;
    throw error;
  }
}

async function writeJson(path, value) {
  await mkdir(dirname(path), { recursive: true });
  const temporary = join(dirname(path), `.${basename(path)}.${process.pid}.${randomUUID()}.tmp`);
  try {
    await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, "utf8");
    await rename(temporary, path);
  } finally {
    await unlink(temporary).catch((error) => {
      if (error.code !== "ENOENT") throw error;
    });
  }
}

async function withStoreLock(dataDir, operation) {
  await mkdir(dataDir, { recursive: true });
  const lockPath = join(dataDir, ".ingest.lock");
  let handle;
  try {
    handle = await open(lockPath, "wx");
  } catch (error) {
    if (error.code === "EEXIST") {
      throw new Error(`Another ingestion command is already writing ${dataDir}; wait for it to finish before retrying`);
    }
    throw error;
  }
  try {
    await handle.writeFile(`${JSON.stringify({ pid: process.pid, acquired_at: now() })}\n`, "utf8");
    return await operation();
  } finally {
    await handle?.close();
    await unlink(lockPath).catch((error) => {
      if (error.code !== "ENOENT") throw error;
    });
  }
}

function newIndex() {
  return {
    schema_version: "0.2.0",
    created_at: now(),
    papers: {},
    ingestion_runs: [],
    content_policy: {
      full_text_stored: false,
      stored_content: ["metadata", "abstract", "AI enrichment when generated", "source links", "source evidence"],
    },
  };
}

async function loadIndex(dataDir) {
  const index = await readJson(join(dataDir, "index.json"), newIndex());
  index.schema_version ??= "0.2.0";
  index.papers ??= {};
  index.ingestion_runs ??= [];
  index.content_policy ??= newIndex().content_policy;
  return index;
}

async function saveIndex(dataDir, index) {
  index.updated_at = now();
  await writeJson(join(dataDir, "index.json"), index);
}

function pathsFor(dataDir, id, version) {
  const stem = join(safeId(id), version);
  return {
    raw: join(dataDir, "raw", `${stem}.json`),
    paper: join(dataDir, "papers", `${stem}.json`),
    enrichment: join(dataDir, "enrichments", `${stem}.json`),
  };
}

function processCommand(command, args) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, { shell: false });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.once("error", reject);
    child.once("close", (code) => resolvePromise({ code, stdout, stderr }));
  });
}

async function resolveExecutable(command) {
  const candidates = command.includes(sep)
    ? [resolve(command)]
    : (process.env.PATH ?? "").split(":").filter(Boolean).map((directory) => join(directory, command));
  for (const candidate of candidates) {
    try {
      await access(candidate, constants.X_OK);
      return realpath(candidate);
    } catch (error) {
      if (!["ENOENT", "EACCES"].includes(error.code)) throw error;
    }
  }
  return null;
}

async function executableIdentity(command) {
  const executablePath = await resolveExecutable(command);
  if (!executablePath) {
    return { executable: command, resolved_executable: null, executable_sha256: null };
  }
  return {
    executable: command,
    resolved_executable: executablePath,
    executable_sha256: digest(await readFile(executablePath)),
  };
}

function isExactRecord(record, requested) {
  try {
    const candidate = parsedShortId(record);
    return candidate.id === requested.id && (!requested.version || candidate.version === requested.version);
  } catch {
    return false;
  }
}

async function runArxivCliAttempt(command, args, identity) {
  let result;
  try {
    result = await processCommand(command, args);
  } catch (error) {
    throw new PipelineFailure(`arxiv-cli could not start: ${error.message}`, {
      evidence: {
        provider: "arxiv-cli-tools",
        adapter_identity: identity,
        argv: args,
        execution_error: error.message,
      },
    });
  }
  const execution = {
    argv: args,
    exit_code: result.code,
    stdout_sha256: digest(result.stdout),
    stderr: result.stderr.trim() || null,
  };
  if (result.code !== 0) {
    throw new PipelineFailure(`arxiv-cli failed (exit ${result.code}): ${result.stderr.trim() || "no stderr"}`, {
      evidence: { provider: "arxiv-cli-tools", adapter_identity: identity, ...execution },
    });
  }
  try {
    return { records: JSON.parse(result.stdout), execution };
  } catch {
    throw new PipelineFailure("arxiv-cli returned non-JSON output", {
      evidence: { provider: "arxiv-cli-tools", adapter_identity: identity, ...execution },
    });
  }
}

async function callArxivCli(options, kind, input) {
  const command = options.arxivCliBin ?? process.env.ARXIV_CLI_BIN ?? "arxiv-cli";
  const identity = await executableIdentity(command);
  if (kind !== "id") {
    const args = ["search", input.query, "--max-results", String(input.limit), "--sort", "updated", "--json"];
    for (const author of input.authors ?? []) args.push("--author", author);
    for (const category of input.categories ?? []) args.push("--category", category);
    const result = await runArxivCliAttempt(command, args, identity);
    return {
      records: result.records,
      evidence: {
        provider: "arxiv-cli-tools",
        adapter_identity: identity,
        request: input,
        executions: [result.execution],
      },
    };
  }

  const requested = canonicalId(input.value);
  const requestedId = `${requested.id}${requested.version ?? ""}`;
  const exactArgs = ["search", "--id", requestedId, "--max-results", "1", "--json"];
  const exact = await runArxivCliAttempt(command, exactArgs, identity);
  const executions = [exact.execution];
  let records = exact.records;

  // arxiv-cli-tools 0.1.0 can return an empty array for --id in some
  // environments. A textual fallback is accepted only after the same exact
  // canonical ID/version check below; it can never substitute a newer version.
  if (!records.some((record) => isExactRecord(record, requested))) {
    const fallbackArgs = ["search", requestedId, "--max-results", "1", "--json"];
    const fallback = await runArxivCliAttempt(command, fallbackArgs, identity);
    executions.push(fallback.execution);
    records = fallback.records;
  }
  return {
    records,
    evidence: {
      provider: "arxiv-cli-tools",
      adapter_identity: identity,
      request: { id: requestedId, exact_version_required: Boolean(requested.version) },
      executions,
    },
  };
}

async function callFixture(options, kind, input) {
  if (!options.fixture) throw new PipelineFailure("--fixture is required with --adapter fixture");
  const fixturePath = resolve(options.fixture);
  const fixtureText = await readFile(fixturePath, "utf8");
  const fixture = JSON.parse(fixtureText);
  let records;
  if (kind === "id") {
    const requested = canonicalId(input.value);
    records = (fixture.papers ?? []).filter((record) => {
      const found = parsedShortId(record);
      return found.id === requested.id && (!requested.version || found.version === requested.version);
    }).slice(0, 1);
  } else {
    records = (fixture.searches?.[input.query] ?? []).slice(0, input.limit);
  }
  return {
    records,
    evidence: {
      provider: "fixture-adapter",
      adapter_identity: { fixture: basename(fixturePath), fixture_sha256: digest(fixtureText), test_only: true },
      request: kind === "id" ? { id: input.value } : input,
      stdout_sha256: digest(JSON.stringify(records)),
    },
  };
}

async function fetchRecords(options, kind, input) {
  if (options.adapter === "arxiv-cli") return callArxivCli(options, kind, input);
  if (options.adapter === "fixture") return callFixture(options, kind, input);
  throw new PipelineFailure(`Unsupported adapter: ${options.adapter}`);
}

function normalizeRecord(record, id, version) {
  if (!record.title || !record.summary || !record.primary_category) {
    throw new Error(`${id}${version}: provider record is missing required metadata`);
  }
  return {
    schema_version: "0.2.0",
    record_id: `arxiv:${id}@${version}`,
    arxiv_id: id,
    arxiv_version: version,
    title: record.title,
    authors: record.authors ?? [],
    categories: record.categories ?? [],
    primary_category: record.primary_category,
    published_at: record.published,
    updated_at: record.updated,
    abstract: record.summary,
    links: {
      abstract: `https://arxiv.org/abs/${id}${version}`,
      pdf: record.pdf_url ?? `https://arxiv.org/pdf/${id}${version}`,
      doi: record.doi ? `https://doi.org/${record.doi}` : null,
    },
    copyright: {
      full_text_stored: false,
      license_checked_for_full_text: false,
      stored_content: ["metadata", "abstract", "source links"],
    },
  };
}

function initialEnrichment(id, version) {
  const job = () => ({
    state: "pending",
    retryable: true,
    attempts: 0,
    last_error: null,
    generated_at: null,
    source_model: null,
    content: null,
  });
  return {
    schema_version: "0.2.0",
    arxiv_id: id,
    arxiv_version: version,
    disclosure: "AI enrichment is not published until independent review. Fake provider content is test-only.",
    jobs: { translation: job(), highlight: job() },
  };
}

function clearActiveArtifact(job) {
  job.generated_at = null;
  job.source_model = null;
  job.content = null;
}

function applyAiMode(enrichment, mode, onlyJob = null) {
  if (mode === "pending") {
    if (onlyJob) {
      const job = enrichment.jobs[onlyJob];
      job.state = "pending";
      job.retryable = true;
      job.last_error = null;
      clearActiveArtifact(job);
    }
    return enrichment;
  }
  const match = mode.match(/^(fake|fail|running):(translation|highlight)$/) ?? (mode === "fake" ? ["fake", "fake", null] : null);
  if (!match) throw new Error(`Unsupported --ai-mode: ${mode}`);
  const action = match[1];
  const targeted = match[2];
  for (const [jobName, job] of Object.entries(enrichment.jobs)) {
    if (onlyJob && jobName !== onlyJob) continue;
    if (targeted && jobName !== targeted) continue;
    job.attempts += 1;
    if (action === "running") {
      job.state = "running";
      job.retryable = true;
      job.last_error = null;
      clearActiveArtifact(job);
      continue;
    }
    if (action === "fail") {
      job.state = "failed";
      job.retryable = true;
      job.last_error = `Injected test failure for ${jobName}`;
      clearActiveArtifact(job);
      continue;
    }
    job.state = "succeeded";
    job.retryable = false;
    job.last_error = null;
    job.generated_at = now();
    job.source_model = "test-fake-provider/v1";
    job.content = jobName === "translation"
      ? "[TEST ONLY] Fake translated abstract. This is never copied to site/data."
      : ["[TEST ONLY] Fake highlight one.", "[TEST ONLY] Fake highlight two."];
  }
  return enrichment;
}

function statusForPaper(paper, enrichment) {
  return {
    ingestion: paper.statuses.ingestion,
    translation: enrichment.jobs.translation,
    highlight: enrichment.jobs.highlight,
    review: paper.statuses.review,
    publish: paper.statuses.publish,
  };
}

function createCapture(record, evidence, input) {
  const retrievedAt = now();
  const payloadSha256 = digest(JSON.stringify(record));
  return {
    capture_id: `capture_${digest(JSON.stringify({ retrieved_at: retrievedAt, input, evidence, payload_sha256: payloadSha256 }))}`,
    payload_sha256: payloadSha256,
    provider: evidence.provider,
    input,
    retrieved_at: retrievedAt,
    provider_execution: evidence,
    raw_metadata: record,
  };
}

async function rebuildVersionRelations(dataDir, index, id) {
  const entry = index.papers[id];
  const versions = Object.keys(entry.versions).sort(compareVersions);
  entry.latest_version = versions.at(-1) ?? null;
  for (let indexPosition = 0; indexPosition < versions.length; indexPosition += 1) {
    const version = versions[indexPosition];
    const paperPath = join(dataDir, entry.versions[version].normalized_path);
    const paper = await readJson(paperPath, null);
    if (!paper) throw new Error(`Missing normalized paper while rebuilding version relations: ${id}${version}`);
    delete paper.supersedes;
    delete paper.superseded_by;
    if (indexPosition > 0) paper.supersedes = versions[indexPosition - 1];
    if (indexPosition < versions.length - 1) paper.superseded_by = versions[indexPosition + 1];
    await writeJson(paperPath, paper);
  }
}

async function ingestOne(dataDir, index, options, record, source) {
  const { id, version } = parsedShortId(record);
  const filePaths = pathsFor(dataDir, id, version);
  const raw = await readJson(filePaths.raw, {
    schema_version: "0.2.0",
    arxiv_id: id,
    arxiv_version: version,
    captures: [],
  });
  const capture = createCapture(record, source.evidence, source.input);
  raw.captures.push(capture);
  await writeJson(filePaths.raw, raw);

  const existingPaper = await readJson(filePaths.paper, null);
  const wasNewVersion = !existingPaper;
  const paper = existingPaper ?? normalizeRecord(record, id, version);
  if (!existingPaper) {
    paper.normalized_from_capture_id = capture.capture_id;
    paper.source_capture = {
      raw_path: relativeToData(dataDir, filePaths.raw),
      capture_id: capture.capture_id,
      payload_sha256: capture.payload_sha256,
      retrieved_at: capture.retrieved_at,
    };
  }
  paper.statuses ??= {};
  paper.statuses.ingestion = { state: "succeeded", retryable: false, updated_at: capture.retrieved_at };
  paper.statuses.review ??= { state: "needs_review", retryable: false, updated_at: null };
  paper.statuses.publish ??= { state: "unpublished", retryable: false, updated_at: null };
  paper.copyright = { ...paper.copyright, full_text_stored: false };

  const enrichment = await readJson(filePaths.enrichment, initialEnrichment(id, version));
  applyAiMode(enrichment, options.aiMode);
  await writeJson(filePaths.enrichment, enrichment);
  await writeJson(filePaths.paper, paper);

  const entry = index.papers[id] ?? {
    canonical_arxiv_id: id,
    latest_version: null,
    versions: {},
  };
  entry.versions[version] = {
    normalized_path: relativeToData(dataDir, filePaths.paper),
    raw_path: relativeToData(dataDir, filePaths.raw),
    enrichment_path: relativeToData(dataDir, filePaths.enrichment),
    first_ingested_at: entry.versions[version]?.first_ingested_at ?? capture.retrieved_at,
    latest_source_capture_at: capture.retrieved_at,
    latest_capture_id: capture.capture_id,
  };
  index.papers[id] = entry;
  await rebuildVersionRelations(dataDir, index, id);
  return {
    id,
    version,
    created: wasNewVersion,
    capture_id: capture.capture_id,
    source_captures: raw.captures.length,
    statuses: statusForPaper(paper, enrichment),
  };
}

function newIngestionRun(options, kind, input, retryOf = null) {
  const createdAt = now();
  return {
    run_id: `ingest_${randomUUID()}`,
    state: "pending",
    retryable: true,
    adapter: options.adapter,
    input: { kind, ...input },
    retry_of: retryOf,
    created_at: createdAt,
    started_at: null,
    finished_at: null,
    state_history: [{ state: "pending", at: createdAt }],
    provider_execution: null,
    error: null,
    result: null,
  };
}

function transitionIngestionRun(run, state) {
  const at = now();
  run.state = state;
  run.state_history ??= [];
  run.state_history.push({ state, at });
  if (state === "running") run.started_at = at;
  if (state === "succeeded" || state === "failed") run.finished_at = at;
}

function runSummary(run) {
  return {
    run_id: run.run_id,
    state: run.state,
    retryable: run.retryable,
    adapter: run.adapter,
    input: run.input,
    retry_of: run.retry_of,
    created_at: run.created_at,
    started_at: run.started_at,
    finished_at: run.finished_at,
    state_history: run.state_history,
    provider_execution: run.provider_execution,
    error: run.error,
    result: run.result,
  };
}

async function executeIngestion(dataDir, options, kind, input, retryOf = null) {
  const index = await loadIndex(dataDir);
  const run = newIngestionRun(options, kind, input, retryOf);
  index.ingestion_runs.push(run);
  await saveIndex(dataDir, index);
  transitionIngestionRun(run, "running");
  await saveIndex(dataDir, index);

  let response;
  try {
    response = await fetchRecords(options, kind, input);
    const records = response.records ?? [];
    if (kind === "id") {
      const requested = canonicalId(input.value);
      const found = records.find((record) => isExactRecord(record, requested));
      if (!found) {
        throw new PipelineFailure(`Provider returned no exact record for ${input.value}`, { evidence: response.evidence });
      }
      response.records = [found];
    }
    const unique = new Map();
    for (const record of response.records) {
      const { id, version } = parsedShortId(record);
      unique.set(paperKey(id, version), record);
    }
    const results = [];
    for (const record of unique.values()) {
      results.push(await ingestOne(dataDir, index, options, record, { evidence: response.evidence, input }));
    }
    const result = {
      command: "ingest",
      adapter: options.adapter,
      input,
      ingested: results,
      paper_count: Object.keys(index.papers).length,
      version_count: Object.values(index.papers).reduce((total, entry) => total + Object.keys(entry.versions).length, 0),
      full_text_stored: false,
    };
    transitionIngestionRun(run, "succeeded");
    run.retryable = false;
    run.provider_execution = response.evidence;
    run.result = { ingested: results.map(({ id, version, created, capture_id }) => ({ id, version, created, capture_id })) };
    await saveIndex(dataDir, index);
    return result;
  } catch (error) {
    transitionIngestionRun(run, "failed");
    run.retryable = true;
    run.provider_execution = error.evidence ?? response?.evidence ?? null;
    run.error = { name: error.name, message: error.message };
    await saveIndex(dataDir, index);
    throw error;
  }
}

async function runConfiguredIngestion(dataDir, options) {
  if (!options.config) throw new Error("config requires --config <file>");
  const configPath = resolve(options.config);
  const config = await readJson(configPath);
  const configuredSearches = (config.searches ?? []).map((search, index) => {
    if (!search?.query) throw new Error(`Configured search ${index + 1} needs query`);
    return {
      query: search.query,
      limit: parsePositiveLimit(search.limit, `Configured search ${index + 1} limit`),
      authors: search.authors ?? [],
      categories: search.categories ?? [],
      configured_by: basename(configPath),
    };
  });
  const results = [];
  for (const id of config.paper_ids ?? []) {
    results.push(await executeIngestion(dataDir, options, "id", { value: id, configured_by: basename(configPath) }));
  }
  for (const search of configuredSearches) {
    results.push(await executeIngestion(dataDir, options, "search", search));
  }
  return { command: "config", config: basename(configPath), runs: results, full_text_stored: false };
}

async function showStatus(dataDir) {
  const index = await loadIndex(dataDir);
  const records = [];
  for (const [id, entry] of Object.entries(index.papers)) {
    for (const [version, paths] of Object.entries(entry.versions)) {
      const paper = await readJson(join(dataDir, paths.normalized_path));
      const enrichment = await readJson(join(dataDir, paths.enrichment_path));
      records.push({ arxiv_id: id, arxiv_version: version, statuses: statusForPaper(paper, enrichment) });
    }
  }
  const ingestionRuns = index.ingestion_runs.map(runSummary).sort((left, right) => left.created_at.localeCompare(right.created_at));
  return {
    command: "status",
    data_dir: dataDir,
    paper_count: Object.keys(index.papers).length,
    version_count: records.length,
    records: records.sort((left, right) => paperKey(left.arxiv_id, left.arxiv_version).localeCompare(paperKey(right.arxiv_id, right.arxiv_version))),
    ingestion_runs: ingestionRuns,
    failed_ingestions: ingestionRuns.filter((run) => run.state === "failed" && run.retryable),
    full_text_stored: false,
  };
}

async function retryAiJobs(dataDir, options) {
  if (!new Set(["translation", "highlight"]).has(options.job)) {
    throw new Error("retry requires --job ingestion, translation, or highlight");
  }
  const index = await loadIndex(dataDir);
  const retried = [];
  for (const [id, entry] of Object.entries(index.papers)) {
    for (const [version, paths] of Object.entries(entry.versions)) {
      const enrichmentPath = join(dataDir, paths.enrichment_path);
      const enrichment = await readJson(enrichmentPath);
      const job = enrichment.jobs[options.job];
      if (job.state !== "failed" || !job.retryable) continue;
      applyAiMode(enrichment, options.aiMode, options.job);
      await writeJson(enrichmentPath, enrichment);
      retried.push({ arxiv_id: id, arxiv_version: version, job: options.job, status: enrichment.jobs[options.job] });
    }
  }
  return { command: "retry", job: options.job, retried, paper_count: Object.keys(index.papers).length, full_text_stored: false };
}

async function retryIngestionRuns(dataDir, options) {
  const index = await loadIndex(dataDir);
  const failures = index.ingestion_runs.filter((run) => run.state === "failed" && run.retryable);
  const retried = [];
  for (const failedRun of failures) {
    const { kind, ...input } = failedRun.input;
    try {
      const result = await executeIngestion(dataDir, options, kind, input, failedRun.run_id);
      retried.push({ retry_of: failedRun.run_id, state: "succeeded", result });
    } catch (error) {
      retried.push({ retry_of: failedRun.run_id, state: "failed", error: error.message });
    }
  }
  return { command: "retry", job: "ingestion", retried, failed_run_count: failures.length, full_text_stored: false };
}

async function main() {
  let parsed;
  try {
    parsed = parseArgs(process.argv.slice(2));
  } catch (error) {
    usage(error.message);
    return;
  }
  const { options, positional } = parsed;
  const [command, value] = positional;
  if (!command || command === "--help" || command === "help") return usage();
  if (!JOB_STATES.has("pending")) throw new Error("Invalid job state schema");
  try {
    const dataDir = await assertSafeDataDir(options.dataDir);
    let output;
    if (command === "id") {
      if (!value) throw new Error("id requires an arXiv ID or version");
      output = await withStoreLock(dataDir, () => executeIngestion(dataDir, options, "id", { value }));
    } else if (command === "search") {
      if (!options.query || options.limit === undefined) throw new Error("search requires --query and --limit");
      const limit = parsePositiveLimit(options.limit, "--limit");
      output = await withStoreLock(dataDir, () => executeIngestion(dataDir, options, "search", {
        query: options.query,
        limit,
        authors: options.authors,
        categories: options.categories,
      }));
    } else if (command === "config") {
      output = await withStoreLock(dataDir, () => runConfiguredIngestion(dataDir, options));
    } else if (command === "status") {
      output = await showStatus(dataDir);
    } else if (command === "retry") {
      output = await withStoreLock(dataDir, () => options.job === "ingestion"
        ? retryIngestionRuns(dataDir, options)
        : retryAiJobs(dataDir, options));
    } else {
      throw new Error(`Unknown command: ${command}`);
    }
    console.log(JSON.stringify(output, null, 2));
  } catch (error) {
    console.error(`Pipeline failed: ${error.message}`);
    process.exitCode = 1;
  }
}

await main();
