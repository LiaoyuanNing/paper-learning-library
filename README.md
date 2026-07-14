# Paper Learning Library

Persistent repository for the Multica project "Paper Learning Library".

## Repository contract

- Default branch: `main`
- Static app source and built output for the current MVP live in `site/`
- GitHub Pages is deployed by `.github/workflows/pages.yml`
- Do not commit secrets, API keys, `.env` files, generated tokens, or private
  source documents

## Dev-Paper quick start

```bash
multica repo checkout https://github.com/LiaoyuanNing/paper-learning-library --ref main
cd paper-learning-library
python3 -m http.server 4173 --directory site
```

Open `http://localhost:4173` for local static preview.

## Publish

Push changes to `main`. The `Deploy static site to GitHub Pages` workflow
uploads `site/` and publishes the project to GitHub Pages.

Deployment URL:

```text
https://liaoyuanning.github.io/paper-learning-library/
```

## Content policy notes

- Store arXiv metadata, abstracts, translation, highlights, and original links
  by default.
- Store full paper text only when the license permits it.
- AI-generated translation and highlights must record generation time and model.
