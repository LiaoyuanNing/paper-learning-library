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
const ARXIV_PROVIDER = "arxiv-cli-tools";
const PROVIDER_MIN_REQUEST_INTERVAL_MS = 3_000;
const JOB_STATES = new Set(["pending", "running", "succeeded", "failed"]);
const APPROVED_RAW_METADATA_FIELDS = [
  "id",
  "short_id",
  "title",
  "summary",
  "authors",
  "categories",
  "primary_category",
  "published",
  "updated",
  "pdf_url",
  "doi",
];
const APPROVED_RAW_METADATA_FIELD_SET = new Set(APPROVED_RAW_METADATA_FIELDS);
const PROHIBITED_CONTENT_FIELD = /(?:^|_)(?:full_?text|paper_?text|body|content|text|source(?:_?text|_?content)?|latex|html|document|pdf_(?:text|content|data))(?:_|$)/;
const PYTHON_ADAPTER_IDENTITY_PROBE = String.raw`
import hashlib
import importlib.metadata as metadata
import importlib.util
import json
from pathlib import Path
import sys

def sha256_file(path):
    try:
        digest = hashlib.sha256()
        with open(path, "rb") as handle:
            for chunk in iter(lambda: handle.read(1024 * 1024), b""):
                digest.update(chunk)
        return digest.hexdigest()
    except OSError:
        return None

def sha256_json(value):
    encoded = json.dumps(value, sort_keys=True, separators=(",", ":")).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()

def distribution_identity(name):
    try:
        distribution = metadata.distribution(name)
    except metadata.PackageNotFoundError:
        return None

    files = []
    content_manifest = []
    record_sha256 = None
    for package_file in sorted(distribution.files or [], key=str):
        relative_path = str(package_file)
        files.append(relative_path)
        resolved_path = distribution.locate_file(package_file)
        content_sha256 = sha256_file(resolved_path)
        content_manifest.append({"path": relative_path, "sha256": content_sha256})
        if relative_path.endswith(".dist-info/RECORD") or relative_path == "RECORD":
            record_sha256 = content_sha256
    return {
        "version": distribution.version,
        "metadata_path": str(getattr(distribution, "_path", distribution.locate_file(""))),
        "file_count": len(files),
        "files_manifest_sha256": sha256_json(files),
        "files_content_sha256": sha256_json(content_manifest),
        "record_sha256": record_sha256,
    }

def console_entry_point(name):
    try:
        entry_points = metadata.entry_points()
        if hasattr(entry_points, "select"):
            matches = list(entry_points.select(group="console_scripts", name=name))
        else:
            matches = [entry for entry in entry_points.get("console_scripts", []) if entry.name == name]
        if not matches:
            return None
        entry_point = matches[0]
        module = entry_point.value.split(":", 1)[0].split("[", 1)[0].strip()
        spec = importlib.util.find_spec(module)
        origin = spec.origin if spec else None
        return {
            "name": entry_point.name,
            "value": entry_point.value,
            "module": module,
            "path": origin,
            "sha256": sha256_file(origin) if origin else None,
        }
    except Exception:
        return None

distributions = {}
for name in ("arxiv-cli-tools", "arxiv"):
    distributions[name] = distribution_identity(name)

modules = {}
for name in ("arxiv_cli", "arxiv_cli_tools", "arxiv"):
    spec = importlib.util.find_spec(name)
    origin = spec.origin if spec else None
    modules[name] = {
        "path": origin,
        "sha256": sha256_file(origin) if origin else None,
    } if origin else None

print(json.dumps({
    "version": sys.version,
    "executable": sys.executable,
    "distributions": distributions,
    "modules": modules,
    "console_entry_point": console_entry_point("arxiv-cli"),
}))
`;

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
  const cleaned = String(input)
    .trim()
    .replace(/^https?:\/\/(?:www\.)?arxiv\.org\/(?:abs|pdf)\//i, "")
    .replace(/\.pdf(?=$|[?#])/i, "")
    .replace(/[?#].*$/, "");
  const match = cleaned.match(/^(?<id>(?:\d{4}\.\d{4,5}|[a-z-]+\/\d{7}))(?<version>v\d+)?$/i);
  if (!match?.groups) throw new Error(`Invalid arXiv ID/version: ${input}`);
  return { id: match.groups.id.toLowerCase(), version: match.groups.version?.toLowerCase() ?? null };
}

function parsedShortId(record) {
  const identity = recordIdentity(record);
  if (!identity.candidates.length) throw new Error("Provider record is missing a parseable arXiv identity");
  if (identity.conflict) throw new Error("Provider record has conflicting arXiv identity fields");
  return identity.resolved;
}

function recordIdentity(record) {
  const candidates = [];
  const addCandidate = (field, value) => {
    if (typeof value !== "string") return;
    try {
      candidates.push({ field, identity: canonicalId(value) });
    } catch {
      // An arbitrary URL or opaque provider field is not arXiv identity evidence.
    }
  };
  const addLinkCandidates = (field, value) => {
    if (typeof value === "string") {
      addCandidate(field, value);
      return;
    }
    if (Array.isArray(value)) {
      value.forEach((nested, index) => addLinkCandidates(`${field}.${index}`, nested));
      return;
    }
    if (value && typeof value === "object") {
      for (const [key, nested] of Object.entries(value)) {
        addLinkCandidates(`${field}.${key}`, nested);
      }
    }
  };
  for (const field of ["id", "short_id", "pdf_url", "abstract_url", "abs_url", "url"]) {
    addCandidate(field, record?.[field]);
  }
  // arXiv clients commonly return links as [{ href, rel, type }]. Preserve
  // the complete field path in provenance so an embedded contradictory link
  // cannot bypass the exact-ID and batch-validation gates.
  addLinkCandidates("links", record?.links);
  const unique = [...new Map(candidates.map((candidate) => [paperKey(candidate.identity.id, candidate.identity.version), candidate])).values()];
  const ids = [...new Set(candidates.map((candidate) => candidate.identity.id))];
  const versions = [...new Set(candidates
    .map((candidate) => candidate.identity.version)
    .filter((version) => version !== null))];
  // A source URL without a version identifies the same paper as a versioned
  // `id`/`short_id`; two explicit versions never do.
  const conflict = ids.length > 1 || versions.length > 1;
  const resolved = ids.length ? { id: ids[0], version: versions[0] ?? null } : null;
  return { candidates, unique, resolved, conflict };
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

function sleep(milliseconds) {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, milliseconds));
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
  index.provider_rate_limits ??= {};
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

function safeStderrEvidence(stderr) {
  return {
    stderr_sha256: digest(stderr),
    stderr_bytes: Buffer.byteLength(stderr),
    stderr_diagnostic: stderr.length ? "provider_stderr_present" : "none",
  };
}

async function reserveProviderCall(dataDir, index, provider) {
  index.provider_rate_limits ??= {};
  const previous = index.provider_rate_limits[provider]?.last_completed_at
    ?? index.provider_rate_limits[provider]?.last_started_at
    ?? null;
  const elapsed = previous ? Date.now() - Date.parse(previous) : Number.POSITIVE_INFINITY;
  const waitMs = Number.isFinite(elapsed) ? Math.max(0, PROVIDER_MIN_REQUEST_INTERVAL_MS - elapsed) : 0;
  if (waitMs) await sleep(waitMs + 1);
  const startedAt = now();
  index.provider_rate_limits[provider] = {
    minimum_interval_ms: PROVIDER_MIN_REQUEST_INTERVAL_MS,
    last_started_at: startedAt,
  };
  // Persist the reservation before process creation. Under the store lock this
  // carries the rate limit across independent CLI processes and fallback calls.
  await saveIndex(dataDir, index);
  return {
    minimum_interval_ms: PROVIDER_MIN_REQUEST_INTERVAL_MS,
    waited_ms: waitMs,
    started_at: startedAt,
  };
}

async function completeProviderCall(dataDir, index, provider, rateLimit) {
  const completedAt = now();
  index.provider_rate_limits[provider] = {
    ...index.provider_rate_limits[provider],
    minimum_interval_ms: PROVIDER_MIN_REQUEST_INTERVAL_MS,
    last_completed_at: completedAt,
  };
  rateLimit.completed_at = completedAt;
  await saveIndex(dataDir, index);
}

async function findExecutable(command) {
  const candidates = command.includes(sep)
    ? [resolve(command)]
    : (process.env.PATH ?? "").split(":").filter(Boolean).map((directory) => join(directory, command));
  for (const candidate of candidates) {
    try {
      await access(candidate, constants.X_OK);
      return candidate;
    } catch (error) {
      if (!["ENOENT", "EACCES"].includes(error.code)) throw error;
    }
  }
  return null;
}

async function resolveExecutable(command) {
  const executable = await findExecutable(command);
  return executable ? realpath(executable) : null;
}

function adapterInterpreterFromShebang(executableText) {
  const line = executableText.slice(0, 1024).split(/\r?\n/, 1)[0];
  if (!line.startsWith("#!")) return { shebang: null, interpreter: null };
  const parts = line.slice(2).trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return { shebang: line, interpreter: null };
  if (basename(parts[0]) !== "env") return { shebang: line, interpreter: parts[0] };
  const environmentArgs = parts.slice(1);
  if (environmentArgs[0] === "-S") environmentArgs.shift();
  return {
    shebang: line,
    interpreter: environmentArgs.find((part) => !part.startsWith("-")) ?? null,
  };
}

async function pythonAdapterRuntimeIdentity(executablePath) {
  let executableText;
  try {
    executableText = await readFile(executablePath, "utf8");
  } catch (error) {
    return { kind: "unknown", probe_error: `Could not inspect executable: ${error.message}` };
  }
  const { shebang, interpreter } = adapterInterpreterFromShebang(executableText);
  if (!interpreter || !/python(?:\d+(?:\.\d+)?)?$/i.test(basename(interpreter))) {
    return {
      kind: "non_python",
      shebang,
      interpreter: interpreter ?? null,
    };
  }

  // Run the interpreter referenced by the console script, not its realpath:
  // pipx/venv Python shims select their isolated site-packages through that
  // invocation path. The realpath is retained separately as audit evidence.
  const invokedInterpreter = await findExecutable(interpreter);
  if (!invokedInterpreter) {
    return {
      kind: "python",
      shebang,
      interpreter,
      python: null,
      distributions: null,
      modules: null,
      probe_error: `Could not resolve Python interpreter ${interpreter}`,
    };
  }
  const resolvedInterpreter = await realpath(invokedInterpreter);
  try {
    const result = await processCommand(invokedInterpreter, ["-c", PYTHON_ADAPTER_IDENTITY_PROBE]);
    if (result.code !== 0) {
      return {
        kind: "python",
        shebang,
        interpreter,
        python: {
          executable: invokedInterpreter,
          resolved_executable: resolvedInterpreter,
          sha256: digest(await readFile(resolvedInterpreter)),
        },
        distributions: null,
        modules: null,
        console_entry_point: null,
        probe_error: `Python identity probe exited ${result.code}`,
      };
    }
    const probe = JSON.parse(result.stdout);
    return {
      kind: "python",
      shebang,
      interpreter,
      python: {
        executable: probe.executable,
        invoked_executable: invokedInterpreter,
        resolved_executable: resolvedInterpreter,
        sha256: digest(await readFile(resolvedInterpreter)),
        version: probe.version,
      },
      distributions: probe.distributions,
      modules: probe.modules,
      console_entry_point: probe.console_entry_point,
      probe_error: null,
    };
  } catch (error) {
    return {
      kind: "python",
      shebang,
      interpreter,
      python: {
        executable: invokedInterpreter,
        resolved_executable: resolvedInterpreter,
        sha256: digest(await readFile(resolvedInterpreter)),
      },
      distributions: null,
      modules: null,
      console_entry_point: null,
      probe_error: `Python identity probe failed: ${error.message}`,
    };
  }
}

async function executableIdentity(command) {
  const executablePath = await resolveExecutable(command);
  if (!executablePath) {
    return {
      executable: command,
      resolved_executable: null,
      executable_sha256: null,
      runtime: null,
    };
  }
  return {
    executable: command,
    resolved_executable: executablePath,
    executable_sha256: digest(await readFile(executablePath)),
    runtime: await pythonAdapterRuntimeIdentity(executablePath),
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

function observedCandidates(records) {
  if (!Array.isArray(records)) return [];
  return records.map((record) => {
    const candidate = { payload_sha256: digest(JSON.stringify(record)) };
    const identity = recordIdentity(record);
    candidate.identity_fields = identity.candidates.map(({ field }) => field);
    if (!identity.candidates.length) {
      candidate.identity_status = "missing";
      candidate.arxiv_id = null;
      candidate.arxiv_version = null;
    } else if (identity.conflict) {
      candidate.identity_status = "conflict";
      candidate.arxiv_id = null;
      candidate.arxiv_version = null;
      candidate.identity_candidates = identity.unique.map(({ identity: parsed }) => ({
        arxiv_id: parsed.id,
        arxiv_version: parsed.version,
      }));
    } else {
      const parsed = identity.resolved;
      candidate.identity_status = "consistent";
      candidate.arxiv_id = parsed.id;
      candidate.arxiv_version = parsed.version;
    }
    return candidate;
  });
}

function uniqueObservedCandidates(executions) {
  const observed = executions.flatMap((execution) => execution.observed_candidates ?? []);
  return [...new Map(observed.map((candidate) => [JSON.stringify(candidate), candidate])).values()];
}

function assertConsistentRecordIdentities(records, evidence) {
  const invalid = records.find((record) => {
    const identity = recordIdentity(record);
    return !identity.candidates.length || identity.conflict;
  });
  if (!invalid) return;
  const identity = recordIdentity(invalid);
  const message = identity.conflict
    ? "Provider record has conflicting arXiv identity fields"
    : "Provider record is missing a parseable arXiv identity";
  throw new PipelineFailure(message, {
    evidence: { ...evidence, observed_candidates: observedCandidates(records) },
  });
}

async function runArxivCliAttempt(dataDir, index, command, args, identity) {
  const rateLimit = await reserveProviderCall(dataDir, index, ARXIV_PROVIDER);
  let result;
  try {
    result = await processCommand(command, args);
  } catch (error) {
    await completeProviderCall(dataDir, index, ARXIV_PROVIDER, rateLimit);
    throw new PipelineFailure(`arxiv-cli could not start: ${error.message}`, {
      evidence: {
        provider: ARXIV_PROVIDER,
        adapter_identity: identity,
        argv: args,
        rate_limit: rateLimit,
        execution_error: {
          code: error.code ?? null,
          diagnostic: "provider_process_start_failed",
        },
      },
    });
  }
  await completeProviderCall(dataDir, index, ARXIV_PROVIDER, rateLimit);
  const execution = {
    argv: args,
    exit_code: result.code,
    stdout_sha256: digest(result.stdout),
    rate_limit: rateLimit,
    ...safeStderrEvidence(result.stderr),
  };
  if (result.code !== 0) {
    throw new PipelineFailure(`arxiv-cli failed (exit ${result.code}; ${execution.stderr_diagnostic})`, {
      evidence: { provider: ARXIV_PROVIDER, adapter_identity: identity, ...execution },
    });
  }
  let records;
  try {
    records = JSON.parse(result.stdout);
  } catch {
    throw new PipelineFailure("arxiv-cli returned non-JSON output", {
      evidence: { provider: "arxiv-cli-tools", adapter_identity: identity, ...execution },
    });
  }
  if (!Array.isArray(records)) {
    throw new PipelineFailure("arxiv-cli returned JSON that was not a record array", {
      evidence: { provider: "arxiv-cli-tools", adapter_identity: identity, ...execution },
    });
  }
  execution.observed_candidates = observedCandidates(records);
  assertConsistentRecordIdentities(records, { provider: ARXIV_PROVIDER, adapter_identity: identity, ...execution });
  return { records, execution };
}

async function callArxivCli(dataDir, index, options, kind, input) {
  const command = options.arxivCliBin ?? process.env.ARXIV_CLI_BIN ?? "arxiv-cli";
  const identity = await executableIdentity(command);
  if (kind !== "id") {
    const args = ["search", input.query, "--max-results", String(input.limit), "--sort", "updated", "--json"];
    for (const author of input.authors ?? []) args.push("--author", author);
    for (const category of input.categories ?? []) args.push("--category", category);
    const result = await runArxivCliAttempt(dataDir, index, command, args, identity);
    return {
      records: result.records,
      evidence: {
        provider: ARXIV_PROVIDER,
        adapter_identity: identity,
        request: input,
        executions: [result.execution],
        observed_candidates: uniqueObservedCandidates([result.execution]),
      },
    };
  }

  const requested = canonicalId(input.value);
  const requestedId = `${requested.id}${requested.version ?? ""}`;
  const exactArgs = ["search", "--id", requestedId, "--max-results", "1", "--json"];
  const exact = await runArxivCliAttempt(dataDir, index, command, exactArgs, identity);
  const executions = [exact.execution];
  let records = exact.records;

  // arxiv-cli-tools 0.1.0 can return an empty array for --id in some
  // environments. A textual fallback is accepted only after the same exact
  // canonical ID/version check below; it can never substitute a newer version.
  if (!records.some((record) => isExactRecord(record, requested))) {
    const fallbackArgs = ["search", requestedId, "--max-results", "1", "--json"];
    const fallback = await runArxivCliAttempt(dataDir, index, command, fallbackArgs, identity);
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
      observed_candidates: uniqueObservedCandidates(executions),
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
  const evidence = {
    provider: "fixture-adapter",
    adapter_identity: { fixture: basename(fixturePath), fixture_sha256: digest(fixtureText), test_only: true },
    request: kind === "id" ? { id: input.value } : input,
    stdout_sha256: digest(JSON.stringify(records)),
    observed_candidates: observedCandidates(records),
  };
  assertConsistentRecordIdentities(records, evidence);
  return {
    records,
    evidence,
  };
}

async function fetchRecords(dataDir, index, options, kind, input) {
  if (options.adapter === "arxiv-cli") return callArxivCli(dataDir, index, options, kind, input);
  if (options.adapter === "fixture") return callFixture(options, kind, input);
  throw new PipelineFailure(`Unsupported adapter: ${options.adapter}`);
}

function projectApprovedRawMetadata(record) {
  if (!record || typeof record !== "object" || Array.isArray(record)) {
    throw new PipelineFailure("Provider record must be a JSON object");
  }
  for (const field of Object.keys(record)) {
    const normalizedField = field.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_");
    if (!APPROVED_RAW_METADATA_FIELD_SET.has(field) && PROHIBITED_CONTENT_FIELD.test(normalizedField)) {
      throw new PipelineFailure(`Provider record contains prohibited full-text field: ${field}`);
    }
  }

  const projected = {};
  for (const field of APPROVED_RAW_METADATA_FIELDS) {
    if (record[field] !== undefined) projected[field] = record[field];
  }
  const nullableMetadataFields = new Set(["published", "updated", "pdf_url", "doi"]);
  for (const field of ["id", "short_id", "title", "summary", "primary_category", "published", "updated", "pdf_url", "doi"]) {
    if (projected[field] !== undefined && projected[field] !== null && typeof projected[field] !== "string") {
      throw new PipelineFailure(`Provider record field ${field} must be a string`);
    }
    if (projected[field] === null && !nullableMetadataFields.has(field)) {
      throw new PipelineFailure(`Provider record field ${field} cannot be null`);
    }
  }
  for (const field of ["authors", "categories"]) {
    if (projected[field] !== undefined
      && (!Array.isArray(projected[field]) || projected[field].some((value) => typeof value !== "string"))) {
      throw new PipelineFailure(`Provider record field ${field} must be an array of strings`);
    }
  }
  if (projected.summary && projected.summary.length > 100_000) {
    throw new PipelineFailure("Provider record summary exceeds the metadata-only content limit");
  }

  const { id, version } = parsedShortId(projected);
  normalizeRecord(projected, id, version);
  return projected;
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

function createCapture(record, evidence, input, selectedOriginalPayloadSha256) {
  const retrievedAt = now();
  const payloadSha256 = digest(JSON.stringify(record));
  return {
    capture_id: `capture_${digest(JSON.stringify({
      retrieved_at: retrievedAt,
      input,
      evidence,
      payload_sha256: payloadSha256,
      selected_original_payload_sha256: selectedOriginalPayloadSha256,
    }))}`,
    payload_sha256: payloadSha256,
    selected_original_payload_sha256: selectedOriginalPayloadSha256,
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
  const capture = createCapture(record, source.evidence, source.input, source.selectedOriginalPayloadSha256);
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
    selected_original_payload_sha256: capture.selected_original_payload_sha256,
    source_captures: raw.captures.length,
    statuses: statusForPaper(paper, enrichment),
  };
}

function newIngestionRun(options, kind, input, retryParent = null) {
  const createdAt = now();
  const runId = `ingest_${randomUUID()}`;
  return {
    run_id: runId,
    state: "pending",
    retryable: true,
    adapter: options.adapter,
    input: { kind, ...input },
    retry_of: retryParent?.run_id ?? null,
    retry_root_id: retryParent?.retry_root_id ?? retryParent?.run_id ?? runId,
    retry_retired_at: null,
    retry_retired_reason: null,
    superseded_by_run_id: null,
    created_at: createdAt,
    started_at: null,
    finished_at: null,
    state_history: [{ state: "pending", at: createdAt }],
    provider_execution: null,
    error: null,
    result: null,
  };
}

function isRetryableIngestionLeaf(index, run) {
  return run.state === "failed"
    && run.retryable
    && !run.superseded_by_run_id
    && !index.ingestion_runs.some((candidate) => candidate.retry_of === run.run_id);
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
    retry_root_id: run.retry_root_id ?? run.run_id,
    retry_retired_at: run.retry_retired_at ?? null,
    retry_retired_reason: run.retry_retired_reason ?? null,
    superseded_by_run_id: run.superseded_by_run_id ?? null,
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
  const retryParent = retryOf
    ? index.ingestion_runs.find((candidate) => candidate.run_id === retryOf)
    : null;
  if (retryOf && !retryParent) throw new Error(`Cannot retry unknown ingestion run ${retryOf}`);
  if (retryParent && !isRetryableIngestionLeaf(index, retryParent)) {
    throw new Error(`Ingestion run ${retryParent.run_id} is no longer the current retryable lineage leaf`);
  }
  const run = newIngestionRun(options, kind, input, retryParent);
  if (retryParent) {
    retryParent.retryable = false;
    retryParent.retry_retired_at = run.created_at;
    retryParent.retry_retired_reason = "superseded_by_retry";
    retryParent.superseded_by_run_id = run.run_id;
  }
  index.ingestion_runs.push(run);
  await saveIndex(dataDir, index);
  transitionIngestionRun(run, "running");
  await saveIndex(dataDir, index);

  let response;
  try {
    response = await fetchRecords(dataDir, index, options, kind, input);
    if (!Array.isArray(response.records)) {
      throw new PipelineFailure("Provider response must contain a JSON array of records", { evidence: response.evidence });
    }
    const unique = new Map();
    for (const record of response.records) {
      const projected = projectApprovedRawMetadata(record);
      const { id, version } = parsedShortId(projected);
      unique.set(paperKey(id, version), {
        projected,
        selectedOriginalPayloadSha256: digest(JSON.stringify(record)),
      });
    }
    // Validate the selected response batch completely before the first capture,
    // normalized record, or enrichment file is written. A bad later record can
    // therefore only leave the failed run ledger, never a partial paper batch.
    let selected = unique;
    if (kind === "id") {
      const requested = canonicalId(input.value);
      const exact = [...unique.entries()].find(([, selection]) => isExactRecord(selection.projected, requested));
      if (!exact) {
        throw new PipelineFailure(`Provider returned no exact record for ${input.value}`, { evidence: response.evidence });
      }
      selected = new Map([exact]);
    }
    const results = [];
    for (const selection of selected.values()) {
      results.push(await ingestOne(dataDir, index, options, selection.projected, {
        evidence: response.evidence,
        input,
        selectedOriginalPayloadSha256: selection.selectedOriginalPayloadSha256,
      }));
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
    run.result = {
      ingested: results.map(({
        id,
        version,
        created,
        capture_id,
        selected_original_payload_sha256,
      }) => ({ id, version, created, capture_id, selected_original_payload_sha256 })),
    };
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
    failed_ingestions: ingestionRuns.filter((run) => isRetryableIngestionLeaf(index, run)),
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
  const failures = index.ingestion_runs.filter((run) => isRetryableIngestionLeaf(index, run));
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
