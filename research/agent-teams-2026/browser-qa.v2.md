# Agent Team evidence pack v2 browser QA

- Run date: 2026-07-15 (Asia/Shanghai)
- Candidate state: open-PR review candidate; not merged, tagged, or deployed
- Tested URL: `http://127.0.0.1:4173/reports/agent-teams-2026/index.html`
- Browser driver: Playwright Chromium
- Manifest request: `GET /reports/agent-teams-2026/data/evidence-manifest.v2.json` → `200 OK`

## Desktop

- Viewport: 1440 × 1000
- Full-page capture: `output/playwright/age174-v2-desktop.png` (1440 × 12813)
- SHA-256: `493e5faf5ec0004518016675b7ca5ae6f642869f0241b39afe73521455e009e8`
- Console: 0 errors, 0 warnings
- Horizontal overflow: false
- Manual visual review: hero, boundary-first summary, timeline, problem map, 18-paper core grid, recommendations, methods, references, and limitations all rendered; no clipping or broken layout observed.

## Mobile

- Viewport: 390 × 844
- Full-page capture: `output/playwright/age174-v2-mobile-390.png` (390 × 25444)
- SHA-256: `d1ac60360f4b443767a4faeabd37582fdd1187b4437d3e696fbb03f74ecb89c2`
- Console: 0 errors, 0 warnings
- Document/body width: 390 / 390; horizontal overflow: false
- Manual visual review: content collapses to the narrow layout, core cards and evidence sections remain readable, and no horizontal clipping or overlapping controls were observed.

The captures are deterministic review artifacts for the v2 branch. They are not evidence that v2 has been deployed; public Pages remains on v1 until Master approves merge/tag/deploy.
