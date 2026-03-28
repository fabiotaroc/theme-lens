# ThemeLens

ThemeLens is a qualitative insights workspace for turning raw feedback exports into structured themes, evidence-backed findings, and ready-to-share reports.

The product flow is:

1. Upload a `CSV` or Excel dataset.
2. Inspect the inferred text column and supporting metadata fields.
3. Generate a dashboard of high-level insights and theme clusters.
4. Refine themes by renaming, merging, or hiding them.
5. Review the report page and export a lightweight HTML report.

## Experience

ThemeLens now ships as a route-based multi-page app:

- `/` for the product landing page
- `/app/upload` for dataset intake
- `/app/inspect` for column confirmation and sample-row review
- `/app/insights` for the main dashboard and theme workspace
- `/app/report` for the share-ready summary view

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

In this repository:

- Next.js handles the product UI, route-based workflow, session-backed workspace state, spreadsheet parsing, and report export
- Python handles preprocessing, OpenAI embeddings, PCA, HDBSCAN topic discovery, and stable label generation
- The app separates high-level insights from cluster-level detail so users can scan the summary before inspecting evidence
- Technical diagnostics remain available, but they are secondary to upload, inspect, and actionable findings

## Session model

- The app uses a server-side workspace session abstraction so preview and analysis state can persist across the multi-page flow.
- The current adapter in this repo is memory-backed and designed to be replaced by a durable store when deploying beyond local or single-instance use.
- Theme edits such as rename, merge, hide, and selected-theme state are synchronized back into the workspace session.

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
- Short comments are retained for semantic clustering; only obvious code-like tag entries are excluded and reported separately.
- HDBSCAN is the primary clustering method, using a small parameter search and nearest-theme reassignment for noise points; deterministic k-means is used only when none of the HDBSCAN candidates produce a reasonable topic split.
- Rows that do not fit a dense theme stay visible in an `Unclustered feedback` bucket instead of being silently forced into a topic.
- Sentiment is heuristic and directional only.