# ThemeLens

ThemeLens is an MVP web app for turning uploaded qualitative datasets into a fast first-pass insight pack.

The workflow is:

1. Upload a `CSV` or `XLSX`.
2. Inspect the suggested text column and optional metadata columns.
3. Generate initial themes with supporting evidence.
4. Rename, merge, or hide themes.
5. Download a lightweight HTML report.

## Stack

- Next.js 16 App Router
- React 19
- Tailwind CSS v4
- `xlsx` for spreadsheet parsing
- Python FastAPI backend for semantic analysis
- `openai` for embeddings and theme labeling
- `scikit-learn` + `hdbscan` for PCA, clustering, and diagnostics

The analysis approach is inspired by the reference topic-modelling project in `/Users/taro/Projects/amplifon-topic-modelling`:

- vectorize text
- reduce dimensions
- cluster similar responses
- generate readable theme labels

In this MVP:

- Next.js handles upload, spreadsheet parsing, preview, and report export
- Python handles preprocessing, OpenAI embeddings, PCA, HDBSCAN topic discovery, and stable label generation
- Short tag-like entries stay out of semantic clustering and true outliers remain visible in an unclustered bucket
- The UI surfaces run diagnostics such as cluster count, unclustered share, and theme confidence

## Run locally

```bash
npm run setup:local
cp .env.example .env
npm run dev:python
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment

Create `.env` for local development:

```bash
OPENAI_API_KEY=your_key_here
PYTHON_ANALYZE_URL=http://127.0.0.1:8000/api/python_analyze
```

`PYTHON_ANALYZE_URL` is optional on Vercel because the app can call the colocated Python function at `/api/python_analyze`.

## Notes

- Empty rows are dropped before analysis.
- Clusterable comments stay as individual rows so repeated wording can strengthen theme detection.
- Very short and tag-like entries are excluded from semantic clustering and reported separately.
- HDBSCAN is the primary clustering method, followed by a nearest-theme reassignment pass for noise points; deterministic k-means is used when density clustering still leaves too much unresolved structure.
- Rows that do not fit a dense theme stay visible in an `Unclustered feedback` bucket instead of being silently forced into a topic.
- Sentiment is heuristic and directional only.