# Local browser QA · manifest v2

- Run date: 2026-07-15 (day precision)
- Scope: local `release_v2` artifact served from `site/`; this record makes no live-environment or deployment claim.
- Page: `http://127.0.0.1:4173/reports/agent-teams-2026/index.html`
- Runner: Playwright CLI, fresh session `age174-v2-final`
- Manifest: HTTP 200, `application/json; charset=utf-8`, version `2.0.0`, digest `sha256:1cab26e51999310225fb08e05621ddfdbcad7ca3e478bc37181af0d614484a8c`
- Data rendered: 49 candidates, 18 core, 27 sources, 28 evidence records.

## Desktop · 1440 × 1000 viewport

- Document width / viewport width: 1440 / 1440 px.
- Page-level horizontal overflow: none; no element crossed the viewport boundary.
- Full-page height: 13,182 px.
- Footer: `Manifest 2.0.0 · sha256:1cab26e51999…`.
- Capture: `output/playwright/age174-v2-final-desktop-1440.png` (1440 × 13,182 px).
- SHA-256: `e725c39a6b9acd8d368c08f3c3d654b0fa083d318fbf269e632eb2445988c7df`.

## Mobile · 390 × 844 viewport

- Document width / viewport width: 390 / 390 px.
- Page-level horizontal overflow: none.
- The comparison table is intentionally contained by `.matrix-wrap` (`overflow-x: auto`; wrapper 366 px, table 830 px), so it does not widen the page.
- Full-page height: 26,384 px.
- Footer: `Manifest 2.0.0 · sha256:1cab26e51999…`.
- Capture: `output/playwright/age174-v2-final-mobile-390.png` (390 × 26,384 px).
- SHA-256: `a3c9880fb4fcaa9f74eb9c02f663da73d404d2fee1164d7c719dea4fc8e83cb9`.

## Console and network

- Console errors: 0.
- Console warnings: 0.
- The report fetched `./data/evidence-manifest.v2.json` successfully and rendered the v2 footer, 18-paper core count and digest.
