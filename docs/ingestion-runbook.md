# arXiv ingestion runbook

## Adapter choice

The MVP adapter is `arxiv-cli-tools` 0.1.0 (Python package `arxiv` 2.4.1). It was selected because the installed CLI provides both an exact canonical-ID query and a keyword query in machine-readable JSON, without an API key. The pipeline itself does not call arXiv HTTP endpoints directly.

The `oo-arxiv` connector was checked first as required: `oo connector schema "arxiv" --action "get_paper"` and `search_papers` could not start because `oo` was absent from this runtime. Its official first-time installer was tried; the runtime did not complete the binary installation. This is retained as an environment limitation, not silently replaced by a direct API client.

`arxiv-cli-tools` was then installed through its documented pip path. Its commands were verified with:

```bash
arxiv-cli --help
arxiv-cli search --help
arxiv-cli search 2210.03629 --max-results 1 --json
arxiv-cli search "agent reasoning" --max-results 1 --json
```

The ID test returned `2210.03629v3` (ReAct); the query test returned `2607.11875v1` at the time of the run. `arxiv-cli search --id ... --json` returned an empty array in this package version even though its text display can find the paper, so the production adapter performs an ID-term JSON search and rejects any result whose canonical ID/version does not exactly match the requested input. This behaviour is documented in code and is covered by the production command's exact-match guard.

Use the CLI's default three-second delay and small explicit limits. Do not add a direct arXiv API fallback unless a new adapter selection is reviewed.

## Data layout and audit trail

The default store is `data/arxiv-ingestion/`; override it with `--data-dir` for isolated verification.

```text
data/arxiv-ingestion/
  index.json                         canonical ID -> versions and paths
  raw/<id>/<version>.json            provider input, retrieved_at, execution evidence, raw metadata
  papers/<id>/<version>.json         normalized metadata and ingest/review/publish state
  enrichments/<id>/<version>.json    translation/highlight states and AI-only fields
```

Every raw capture contains the provider, input, retrieval timestamp, executable/arguments (or test fixture request), output SHA-256, provider stderr, and unmodified provider metadata. A repeat retrieval appends another capture; it does not create another canonical paper/version. A new version receives a separate record and an auditable `supersedes` / `superseded_by` link.

`papers/` contains no AI text and `enrichments/` contains no raw provider response. The status surface includes:

- ingestion: `succeeded` / `failed` as applicable;
- translation and highlight: `pending`, `running`, `succeeded`, or `failed`, plus `retryable`, attempt count, error, generated time, and exact provider/model when generated;
- review: `needs_review`; publish: `unpublished`.

No credentialed AI provider is configured in this repository. Fresh ingest therefore leaves translation/highlight as visible, retryable `pending` jobs; a default retry requeues a failed job to `pending`. Fake provider content is explicitly `[TEST ONLY]`, stored only under the separate data directory, and cannot reach `site/data/`. Review and publishing are intentionally manual gates: the pipeline never modifies the public reader dataset.

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
```

The automated integration test uses a separate fixture adapter to prove duplicate protection, version supersession, configured ID/query ingestion, source evidence capture, injected translation failure, observable status, and retry without adding a paper record. It stores no full text and does not contact arXiv.
