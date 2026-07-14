# arXiv ingestion runbook

## Adapter choice

The MVP adapter is `arxiv-cli-tools`. Each run records the resolved CLI path and SHA-256, the Python interpreter path used by the console-script shebang (plus its resolved realpath, version, and hash), the installed `arxiv-cli-tools` and `arxiv` distribution versions, each distribution's file-list/content and `RECORD` digests, resolved module paths/hashes, and the `arxiv-cli` console entry-point module/path/hash. The shebang path—not its realpath—is used for the runtime probe so pipx/venv site-package selection remains faithful. This is runtime evidence rather than a hard-coded adapter version. It was selected because the installed CLI exposes both `--id` and keyword search in machine-readable JSON, without an API key. The pipeline itself does not call arXiv HTTP endpoints directly.

The `oo-arxiv` connector was checked first as required: `oo connector schema "arxiv" --action "get_paper"` and `search_papers` could not start because `oo` was absent from this runtime. Its official first-time installer was tried; the runtime did not complete the binary installation. This is retained as an environment limitation, not silently replaced by a direct API client.

`arxiv-cli-tools` was then installed through its documented `pipx` path. Its commands were verified with:

```bash
arxiv-cli --help
arxiv-cli search --help
arxiv-cli search 2210.03629 --max-results 1 --json
arxiv-cli search "agent reasoning" --max-results 1 --json
```

The ID test returned `2210.03629v3` (ReAct); the query test returned `2607.11875v1` at the time of the run. Every ID request now first calls `arxiv-cli search --id <canonical-id-and-version> --json`. In this runtime that command can return an empty array, so the adapter makes one textual candidate query only as a compatibility fallback and applies the same exact canonical ID/version check before storing anything. A requested historical version is never replaced by the current version: when neither response has the requested version, the command fails and writes a retryable ingestion ledger entry. This contract is covered by an executable-level adapter test.

The pipeline persists a three-second minimum interval for every `arxiv-cli` process start in `index.json`, while holding the store lock. That applies to an exact-ID fallback, config loop, retry, and a later process using the same store; the CLI's own delay is therefore supplementary. Use small explicit limits. Do not add a direct arXiv API fallback unless a new adapter selection is reviewed.

## Data layout and audit trail

The default store is `data/arxiv-ingestion/`; override it with `--data-dir` for isolated verification.

```text
data/arxiv-ingestion/
  index.json                         canonical ID -> versions, paths, and ingestion run ledger
  raw/<id>/<version>.json            append-only captures: immutable capture ID/hash, input, evidence, approved metadata projection
  papers/<id>/<version>.json         normalized metadata and ingest/review/publish state
  enrichments/<id>/<version>.json    translation/highlight states and AI-only fields
```

Every raw capture contains the provider, input, retrieval timestamp, executable/arguments (or test fixture request), the SHA-256 of its allowlisted metadata projection, and `selected_original_payload_sha256`, which binds that capture to the selected full provider payload hash in observed-candidate evidence. Provider stderr is never stored: evidence keeps only its SHA-256, byte length, and a controlled diagnostic code. `raw_metadata` is an allowlisted metadata projection (`id`, title, abstract/summary, authors, categories, dates, links, and DOI); a provider record that includes a prohibited full-text/body/content field is rejected. All parseable identity fields (`id`, `short_id`, and source links, including nested structured link entries) must agree before exact matching or projection; a conflict rejects the complete batch and leaves only the failed ledger. This preserves source auditability without storing arbitrary adapter output or paper text. A repeat retrieval appends another capture; it does not create another canonical paper/version. A normalized record has `normalized_from_capture_id`, so its source remains unambiguous even after later captures. A new version receives a separate record; after every insertion all versions are sorted and their `supersedes` / `superseded_by` links are rebuilt.

The complete provider response batch is type-checked and projected before the first capture, paper, or enrichment write. A malformed later record therefore leaves only a failed ingestion run ledger, not a partial batch of records. The filesystem store remains a single-writer MVP; its lock and per-file atomic rename protect normal writes, while the ledger makes interrupted or failed attempts visible for recovery.

`papers/` contains no AI text and `enrichments/` contains no raw provider response. The status surface includes:

- ingestion: a persisted run ledger with `pending` → `running` → `succeeded` or `failed`, retryability, input, adapter/provider evidence, timestamps, and error/result. A retry creates a child attempt linked by `retry_of`/`retry_root_id`, retires the parent, and exposes only the latest unresolved failed lineage leaf as retryable. A succeeding child leaves no active failed retry for that lineage;
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
ARXIV_CLI_BIN="$HOME/.local/bin/arxiv-cli" npm run ingest -- \
  --data-dir "$tmp_dir" id 2210.03629v3
ARXIV_CLI_BIN="$HOME/.local/bin/arxiv-cli" npm run ingest -- \
  --data-dir "$tmp_dir" id 2210.03629v3
ARXIV_CLI_BIN="$HOME/.local/bin/arxiv-cli" npm run ingest -- \
  --data-dir "$tmp_dir" search --query "agent reasoning" --limit 1
npm run ingest -- --data-dir "$tmp_dir" status

# A historical version that the provider cannot return exactly must stay visible as a failed, retryable run.
# Retrying creates one child attempt and retires the parent, so old failures cannot
# be retried repeatedly or amplify provider traffic.
ARXIV_CLI_BIN="$HOME/.local/bin/arxiv-cli" npm run ingest -- \
  --data-dir "$tmp_dir" id 2210.03629v2
npm run ingest -- --data-dir "$tmp_dir" status
ARXIV_CLI_BIN="$HOME/.local/bin/arxiv-cli" npm run ingest -- \
  --data-dir "$tmp_dir" retry --job ingestion
```

The automated integration test uses a separate fixture adapter to prove duplicate protection, out-of-order version supersession, immutable provenance, configured ID/query ingestion, source evidence capture, injected translation failure, observable retry states, public-directory rejection (including symlinks), and positive-limit validation. Fake `arxiv-cli` executables verify the real adapter argument contract, isolated venv entry-point/distribution fingerprints, stderr storage boundary, nested-link identity-conflict rejection with zero business writes, selected-payload-to-capture provenance binding, and persistent rate limiting without making a network request. Tests store no full text and do not contact arXiv.
