# arXiv ingestion runbook

## Adapter choice

The MVP adapter is `arxiv-cli-tools` (its identity is recorded at runtime as the executable path and SHA-256 rather than a hard-coded package version). It was selected because the installed CLI exposes both `--id` and keyword search in machine-readable JSON, without an API key. The pipeline itself does not call arXiv HTTP endpoints directly.

The `oo-arxiv` connector was checked first as required: `oo connector schema "arxiv" --action "get_paper"` and `search_papers` could not start because `oo` was absent from this runtime. Its official first-time installer was tried; the runtime did not complete the binary installation. This is retained as an environment limitation, not silently replaced by a direct API client.

`arxiv-cli-tools` was then installed through its documented pip path. Its commands were verified with:

```bash
arxiv-cli --help
arxiv-cli search --help
arxiv-cli search 2210.03629 --max-results 1 --json
arxiv-cli search "agent reasoning" --max-results 1 --json
```

The ID test returned `2210.03629v3` (ReAct); the query test returned `2607.11875v1` at the time of the run. Every ID request now first calls `arxiv-cli search --id <canonical-id-and-version> --json`. In this runtime that command can return an empty array, so the adapter makes one textual candidate query only as a compatibility fallback and applies the same exact canonical ID/version check before storing anything. A requested historical version is never replaced by the current version: when neither response has the requested version, the command fails and writes a retryable ingestion ledger entry. This contract is covered by an executable-level adapter test.

Use the CLI's default three-second delay and small explicit limits. Do not add a direct arXiv API fallback unless a new adapter selection is reviewed.

## Data layout and audit trail

The default store is `data/arxiv-ingestion/`; override it with `--data-dir` for isolated verification.

```text
data/arxiv-ingestion/
  index.json                         canonical ID -> versions, paths, and ingestion run ledger
  raw/<id>/<version>.json            append-only captures: immutable capture ID/hash, input, evidence, raw metadata
  papers/<id>/<version>.json         normalized metadata and ingest/review/publish state
  enrichments/<id>/<version>.json    translation/highlight states and AI-only fields
```

Every raw capture contains the provider, input, retrieval timestamp, executable/arguments (or test fixture request), output SHA-256, provider stderr, and unmodified provider metadata. It also has an immutable `capture_id` and payload hash. A repeat retrieval appends another capture; it does not create another canonical paper/version. A normalized record has `normalized_from_capture_id`, so its source remains unambiguous even after later captures. A new version receives a separate record; after every insertion all versions are sorted and their `supersedes` / `superseded_by` links are rebuilt.

`papers/` contains no AI text and `enrichments/` contains no raw provider response. The status surface includes:

- ingestion: a persisted run ledger with `pending` → `running` → `succeeded` or `failed`, retryability, input, adapter/provider evidence, timestamps, and error/result;
- translation and highlight: `pending`, `running`, `succeeded`, or `failed`, plus `retryable`, attempt count, error, generated time, and exact provider/model when generated;
- review: `needs_review`; publish: `unpublished`.

No credentialed AI provider is configured in this repository. Fresh ingest therefore leaves translation/highlight as visible, retryable `pending` jobs; a default retry requeues a failed job to `pending`. Any transition away from `succeeded` clears its active generated artifact, so failed/running jobs cannot claim successful content. Fake provider content is explicitly `[TEST ONLY]`, stored only under the separate data directory, and cannot reach `site/data/`. Review and publishing are intentionally manual gates: the pipeline never modifies the public reader dataset.

The command rejects `site/` and every descendant before any write, including a `--data-dir` that reaches it through a symlink. Every JSON file is written by atomic rename and mutating commands take a per-store exclusive lock. The store is intentionally a single-writer filesystem MVP, not a multi-process database transaction; a stale lock after a killed process must be inspected before removal rather than deleted automatically.

## Reproducible verification

```bash
npm test
npm run check

# Real read-only arXiv proof in a separate directory; run twice to verify no duplicate paper/version.
tmp_dir="$(mktemp -d)"
ARXIV_CLI_BIN="$HOME/Library/Python/3.9/bin/arxiv-cli" npm run ingest -- \
  --data-dir "$tmp_dir" id 2210.03629v3
ARXIV_CLI_BIN="$HOME/Library/Python/3.9/bin/arxiv-cli" npm run ingest -- \
  --data-dir "$tmp_dir" id 2210.03629v3
ARXIV_CLI_BIN="$HOME/Library/Python/3.9/bin/arxiv-cli" npm run ingest -- \
  --data-dir "$tmp_dir" search --query "agent reasoning" --limit 1
npm run ingest -- --data-dir "$tmp_dir" status

# A historical version that the provider cannot return exactly must stay visible as a failed, retryable run.
ARXIV_CLI_BIN="$HOME/Library/Python/3.9/bin/arxiv-cli" npm run ingest -- \
  --data-dir "$tmp_dir" id 2210.03629v2
npm run ingest -- --data-dir "$tmp_dir" status
ARXIV_CLI_BIN="$HOME/Library/Python/3.9/bin/arxiv-cli" npm run ingest -- \
  --data-dir "$tmp_dir" retry --job ingestion
```

The automated integration test uses a separate fixture adapter to prove duplicate protection, out-of-order version supersession, immutable provenance, configured ID/query ingestion, source evidence capture, injected translation failure, observable retry states, public-directory rejection (including symlinks), and positive-limit validation. A fake `arxiv-cli` executable verifies the real adapter argument contract without making a network request. Tests store no full text and do not contact arXiv.
