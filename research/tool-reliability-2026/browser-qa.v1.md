# Local browser QA · `age-396-v1`

- Run date: 2026-08-03; scope is local `site/` preview only, not a deployment claim.
- Page: `http://127.0.0.1:4176/reports/tool-reliability-2026/index.html` (desktop) and port `4177` (mobile).
- Manifest: HTTP 200, `application/json; charset=utf-8`, version `1.0.0`, digest `sha256:14cc3adc689441c97596cdf039625747f06ac816cbb34dd8b3aaf4818adbbe62`.
- Render assertions: 10 direct answers, 8 product recommendations, 17 sources, versioned source links, model disclosure and footer digest visible.

## Desktop · 1440 × 1000

- Document width / viewport width: 1440 / 1440 px; no page-level horizontal overflow.
- Full-page height: 5,839 px.
- Console: 0 errors, 0 warnings.
- Capture: `output/playwright/age400-desktop-1440.png`.
- SHA-256: `e8a72e705dbca1465aa9298ac9268fd7a8565541dafaca9ddb29563e73093c75`.

## Mobile · 390 × 844

- Document width / viewport width: 390 / 390 px; `horizontalOverflow: false`.
- Full-page height: 10,993 px.
- Console: 0 errors, 0 warnings.
- Capture: `output/playwright/age400-mobile-390.png`.
- SHA-256: `12af019541b9a938e29766cdee0fb305647316de750c2e2c049f2994153921f0`.
