#!/usr/bin/env node

/**
 * Filesystem-backed arXiv ingestion MVP.
 *
 * It intentionally has no network implementation of its own: production reads
 * arXiv only through arxiv-cli-tools, while the fixture adapter exists solely
 * for deterministic tests. The public reader dataset is never written here.
 */
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, dirname, join, relative, resolve } from "node:path";
import { spawn } from "node:child_process";

const ROOT = process.cwd();
const DEFAULT_DATA_DIR = "data/arxiv-ingestion";
const JOB_STATES = new Set(["pending", "running", "succeeded", "failed"]);

function usage(message) {
  if (message) console.error(`Error: ${message}\n`);
  console.error(`Usage:
  node scripts/arxiv-ingest.mjs [options] id <arxiv-id-or-version>
  node scripts/arxiv-ingest.mjs [options] search --query <query> --limit <n> [--author <name>] [--category <code>]
  node scripts/arxiv-ingest.mjs [options] config --config <file>
  node scripts/arxiv-ingest.mjs [options] status
  node scripts/arxiv-ingest.mjs [options] retry --job <translation|highlight>

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
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function pathsFor(dataDir, id, version) {
  const stem = join(safeId(id), version);
  return {
    raw: join(dataDir, "raw", `${stem}.json`),
    paper: join(dataDir, "papers", `${stem}.json`),
    enrichment: join(dataDir, "enrichments", `${stem}.json`),
  };
}

function relativeToData(dataDir, path) {
  return relative(dataDir, path).split("\\").join("/");
}

function newIndex() {
  return {
    schema_version: "0.1.0",
    created_at: now(),
    papers: {},
    content_policy: {
      full_text_stored: false,
      stored_content: ["metadata", "abstract", "AI enrichment when generated", "source links", "source evidence"],
    },
  };
}

async function loadIndex(dataDir) {
  return readJson(join(dataDir, "index.json"), newIndex());
}

function versionNumber(version) {
  return Number(version.replace(/^v/, ""));
}

function isNewerVersion(candidate, current) {
  return !current || versionNumber(candidate) > versionNumber(current);
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

async function callArxivCli(options, kind, input) {
  const command = options.arxivCliBin ?? process.env.ARXIV_CLI_BIN ?? "arxiv-cli";
  const args = ["search"];
  if (kind === "id") {
    // arxiv-cli --id currently emits an empty JSON array in version 0.1.0.
    // Searching with the canonical ID preserves JSON output; we validate it below.
    args.push(input.value, "--max-results", "1", "--json");
  } else {
    args.push(input.query, "--max-results", String(input.limit), "--sort", "updated", "--json");
    for (const author of input.authors ?? []) args.push("--author", author);
    for (const category of input.categories ?? []) args.push("--category", category);
  }
  const result = await processCommand(command, args);
  if (result.code !== 0) {
    throw new Error(`arxiv-cli failed (exit ${result.code}): ${result.stderr.trim() || "no stderr"}`);
  }
  let records;
  try {
    records = JSON.parse(result.stdout);
  } catch {
    throw new Error("arxiv-cli returned non-JSON output; source evidence was not committed");
  }
  return {
    records,
    evidence: {
      provider: "arxiv-cli-tools",
      provider_version: "0.1.0",
      executable: command,
      argv: args,
      exit_code: result.code,
      stdout_sha256: digest(result.stdout),
      stderr: result.stderr.trim() || null,
    },
  };
}

async function callFixture(options, kind, input) {
  if (!options.fixture) throw new Error("--fixture is required with --adapter fixture");
  const fixturePath = resolve(options.fixture);
  const fixture = await readJson(fixturePath);
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
      provider_version: "test-only",
      fixture: basename(fixturePath),
      request: kind === "id" ? { id: input.value } : input,
      stdout_sha256: digest(JSON.stringify(records)),
    },
  };
}

async function fetchRecords(options, kind, input) {
  if (options.adapter === "arxiv-cli") return callArxivCli(options, kind, input);
  if (options.adapter === "fixture") return callFixture(options, kind, input);
  throw new Error(`Unsupported adapter: ${options.adapter}`);
}

function normalizeRecord(record, id, version) {
  if (!record.title || !record.summary || !record.primary_category) {
    throw new Error(`${id}${version}: provider record is missing required metadata`);
  }
  return {
    schema_version: "0.1.0",
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
    schema_version: "0.1.0",
    arxiv_id: id,
    arxiv_version: version,
    disclosure: "AI enrichment is not published until independent review. Fake provider content is test-only.",
    jobs: { translation: job(), highlight: job() },
  };
}

function applyAiMode(enrichment, mode, onlyJob = null) {
  if (mode === "pending") {
    if (onlyJob) {
      const job = enrichment.jobs[onlyJob];
      job.state = "pending";
      job.retryable = true;
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
    if (action === "running") {
      job.state = "running";
      job.retryable = true;
      job.attempts += 1;
      job.last_error = null;
      continue;
    }
    if (action === "fail") {
      job.state = "failed";
      job.retryable = true;
      job.attempts += 1;
      job.last_error = `Injected test failure for ${jobName}`;
      continue;
    }
    job.state = "succeeded";
    job.retryable = false;
    job.attempts += 1;
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

async function ingestOne(dataDir, index, options, record, source) {
  const { id, version } = parsedShortId(record);
  const filePaths = pathsFor(dataDir, id, version);
  const raw = await readJson(filePaths.raw, {
    schema_version: "0.1.0",
    arxiv_id: id,
    arxiv_version: version,
    captures: [],
  });
  const retrievedAt = now();
  raw.captures.push({
    provider: source.evidence.provider,
    input: source.input,
    retrieved_at: retrievedAt,
    provider_execution: source.evidence,
    raw_metadata: record,
  });
  await writeJson(filePaths.raw, raw);

  const existingPaper = await readJson(filePaths.paper, null);
  const wasNewVersion = !existingPaper;
  const paper = existingPaper ?? normalizeRecord(record, id, version);
  paper.source_capture = {
    path: relativeToData(dataDir, filePaths.raw),
    capture_count: raw.captures.length,
    latest_retrieved_at: retrievedAt,
  };
  paper.statuses ??= {};
  paper.statuses.ingestion = { state: "succeeded", retryable: false, updated_at: retrievedAt };
  paper.statuses.review ??= { state: "needs_review", retryable: false, updated_at: null };
  paper.statuses.publish ??= { state: "unpublished", retryable: false, updated_at: null };
  paper.copyright = { ...paper.copyright, full_text_stored: false };

  const enrichment = await readJson(filePaths.enrichment, initialEnrichment(id, version));
  applyAiMode(enrichment, options.aiMode);
  await writeJson(filePaths.enrichment, enrichment);

  const entry = index.papers[id] ?? {
    canonical_arxiv_id: id,
    latest_version: null,
    versions: {},
  };
  const priorLatest = entry.latest_version;
  if (wasNewVersion && priorLatest && isNewerVersion(version, priorLatest)) {
    const priorPaths = pathsFor(dataDir, id, priorLatest);
    const priorPaper = await readJson(priorPaths.paper, null);
    if (priorPaper) {
      priorPaper.superseded_by = version;
      await writeJson(priorPaths.paper, priorPaper);
    }
    paper.supersedes = priorLatest;
  }
  if (isNewerVersion(version, priorLatest)) entry.latest_version = version;
  entry.versions[version] = {
    normalized_path: relativeToData(dataDir, filePaths.paper),
    raw_path: relativeToData(dataDir, filePaths.raw),
    enrichment_path: relativeToData(dataDir, filePaths.enrichment),
    first_ingested_at: entry.versions[version]?.first_ingested_at ?? retrievedAt,
    latest_source_capture_at: retrievedAt,
  };
  index.papers[id] = entry;
  await writeJson(filePaths.paper, paper);
  return { id, version, created: wasNewVersion, source_captures: raw.captures.length, statuses: statusForPaper(paper, enrichment) };
}

async function ingest(dataDir, options, kind, input) {
  const response = await fetchRecords(options, kind, input);
  const records = response.records ?? [];
  if (kind === "id") {
    const requested = canonicalId(input.value);
    const found = records.find((record) => {
      const candidate = parsedShortId(record);
      return candidate.id === requested.id && (!requested.version || candidate.version === requested.version);
    });
    if (!found) throw new Error(`Provider returned no exact record for ${input.value}`);
    response.records = [found];
  }
  const unique = new Map();
  for (const record of response.records) {
    const { id, version } = parsedShortId(record);
    unique.set(paperKey(id, version), record);
  }
  const index = await loadIndex(dataDir);
  const results = [];
  for (const record of unique.values()) {
    results.push(await ingestOne(dataDir, index, options, record, { evidence: response.evidence, input }));
  }
  index.updated_at = now();
  await writeJson(join(dataDir, "index.json"), index);
  return {
    command: "ingest",
    adapter: options.adapter,
    input,
    ingested: results,
    paper_count: Object.keys(index.papers).length,
    version_count: Object.values(index.papers).reduce((total, entry) => total + Object.keys(entry.versions).length, 0),
    full_text_stored: false,
  };
}

async function runConfiguredIngestion(dataDir, options) {
  if (!options.config) throw new Error("config requires --config <file>");
  const configPath = resolve(options.config);
  const config = await readJson(configPath);
  const results = [];
  for (const id of config.paper_ids ?? []) {
    results.push(await ingest(dataDir, options, "id", { value: id, configured_by: basename(configPath) }));
  }
  for (const search of config.searches ?? []) {
    if (!search.query || !search.limit) throw new Error("Each configured search needs query and limit");
    results.push(await ingest(dataDir, options, "search", {
      query: search.query,
      limit: Number(search.limit),
      authors: search.authors ?? [],
      categories: search.categories ?? [],
      configured_by: basename(configPath),
    }));
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
  return {
    command: "status",
    data_dir: dataDir,
    paper_count: Object.keys(index.papers).length,
    version_count: records.length,
    records: records.sort((left, right) => paperKey(left.arxiv_id, left.arxiv_version).localeCompare(paperKey(right.arxiv_id, right.arxiv_version))),
    full_text_stored: false,
  };
}

async function retryJobs(dataDir, options) {
  if (!new Set(["translation", "highlight"]).has(options.job)) throw new Error("retry requires --job translation or --job highlight");
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
  const dataDir = resolve(options.dataDir);
  if (!JOB_STATES.has("pending")) throw new Error("Invalid job state schema");
  try {
    let output;
    if (command === "id") {
      if (!value) throw new Error("id requires an arXiv ID or version");
      output = await ingest(dataDir, options, "id", { value });
    } else if (command === "search") {
      if (!options.query || !options.limit) throw new Error("search requires --query and --limit");
      const limit = Number(options.limit);
      if (!Number.isInteger(limit) || limit < 1) throw new Error("--limit must be a positive integer");
      output = await ingest(dataDir, options, "search", { query: options.query, limit, authors: options.authors, categories: options.categories });
    } else if (command === "config") {
      output = await runConfiguredIngestion(dataDir, options);
    } else if (command === "status") {
      output = await showStatus(dataDir);
    } else if (command === "retry") {
      output = await retryJobs(dataDir, options);
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
