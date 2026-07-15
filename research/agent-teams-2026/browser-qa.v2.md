# Agent Team evidence pack v2 browser QA

- Run date: 2026-07-15 (Asia/Shanghai)
- Candidate state: open-PR review candidate; not merged, tagged, or deployed
- Tested URL: `http://127.0.0.1:4173/reports/agent-teams-2026/index.html`
- Browser driver: Playwright Chromium
- Manifest request: `GET /reports/agent-teams-2026/data/evidence-manifest.v2.json` → `200 OK`

## Desktop

- Viewport: 1440 × 1000
- Full-page capture: `output/playwright/age174-v2-candidate2-desktop.png` (1440 × 13176)
- SHA-256: `b3f5cf8a6a5f63288152ccab7659dc5fddf523fb9c40b49ba16f3fff886754ae`
- Console: 0 errors, 0 warnings
- Horizontal overflow: false
- Document/body width: 1440 / 1440; horizontal overflow: false
- Manual visual review: hero, boundary-first summary, timeline, problem map, 18-paper core grid, recommendations, methods, references, and limitations all rendered; the OpenReview-only LatentMAS critique renders with its source kind and year rather than an arXiv placeholder; no clipping or broken layout observed.

## Mobile

- Viewport: 390 × 844
- Full-page capture: `output/playwright/age174-v2-candidate2-mobile-390.png` (390 × 26399)
- SHA-256: `a938e02fb9903d74c8f0cb0535f1ca070454266e5b0ac188e67ffd3faaacffab`
- Console: 0 errors, 0 warnings
- Document/body width: 390 / 390; horizontal overflow: false
- Manual visual review: content collapses to the narrow layout, all 18 core cards and the Communication–Reasoning Gap, HiddenBench, and learned-alignment evidence remain readable, and no horizontal clipping or overlapping controls were observed.

The captures are deterministic review artifacts for the v2 branch. They are not evidence that v2 has been deployed; public Pages remains on v1 until Master approves merge/tag/deploy.
