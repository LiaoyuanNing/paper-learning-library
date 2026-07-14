# Deployment Runbook

This repository uses GitHub Pages with GitHub Actions. There is no local daemon,
external secret, or manual server to maintain.

## Checkout

```bash
multica repo checkout https://github.com/LiaoyuanNing/paper-learning-library --ref main
```

## Local preview

```bash
cd paper-learning-library
python3 -m http.server 4173 --directory site
```

Then open:

```text
http://localhost:4173
```

## Publish to Pages

1. Put the static MVP files in `site/`.
2. Commit the change.
3. Push to `main`.
4. Wait for the `Deploy static site to GitHub Pages` workflow.

The published URL is:

```text
https://liaoyuanning.github.io/paper-learning-library/
```

## Verification commands

```bash
gh run list --repo LiaoyuanNing/paper-learning-library --workflow pages.yml --limit 3
gh api repos/LiaoyuanNing/paper-learning-library/pages
```

## Rollback

Revert the bad commit on `main` and push. GitHub Actions will publish the
previous static state.
