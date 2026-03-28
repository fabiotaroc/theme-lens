"use client";

import { startTransition, useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  Download,
  Eye,
  EyeOff,
  FileSpreadsheet,
  Layers3,
  LoaderCircle,
  Merge,
  Sparkles,
  Tags,
} from "lucide-react";

import type {
  AnalysisResponse,
  DatasetPreview,
  EvidenceRow,
  SentimentBreakdown,
  ThemeInsight,
} from "@/lib/types";

type EditableTheme = ThemeInsight & {
  hidden: boolean;
};

async function readJsonResponse<T>(response: Response): Promise<T> {
  const payload = (await response.json()) as T & { error?: string };

  if (!response.ok) {
    throw new Error(payload.error ?? "The request failed.");
  }

  return payload;
}

function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`;
}

function formatConfidence(value: number | null) {
  if (value === null) return "n/a";
  return `${Math.round(value * 100)}%`;
}

function sentimentTone(breakdown: SentimentBreakdown) {
  if (breakdown.negative > breakdown.positive) return "Mostly negative";
  if (breakdown.positive > breakdown.negative) return "Mostly positive";
  return "Mixed";
}

function assignmentLabel(assignmentType: EvidenceRow["assignmentType"]) {
  switch (assignmentType) {
    case "clustered":
      return "clustered";
    case "unclustered":
      return "unclustered";
    case "excluded_short":
      return "excluded: short";
    case "excluded_taglike":
      return "excluded: tag-like";
    default:
      return assignmentType;
  }
}

function methodQualityLabel(analysis: AnalysisResponse) {
  const { diagnostics } = analysis.summary;

  if (diagnostics.usedFallbackClustering || diagnostics.clusterCount <= 1) {
    return "Needs review";
  }

  if (
    diagnostics.averageThemeConfidence !== null &&
    diagnostics.averageThemeConfidence >= 0.68 &&
    diagnostics.noiseRatio <= 0.2
  ) {
    return "Strong";
  }

  return "Moderate";
}

function sortedThemes(themes: EditableTheme[]) {
  return [...themes].sort((left, right) => {
    if (left.hidden !== right.hidden) return Number(left.hidden) - Number(right.hidden);
    if (left.kind !== right.kind) return left.kind === "unclustered" ? 1 : -1;
    return right.count - left.count;
  });
}

function buildReportSnapshot(
  analysis: AnalysisResponse,
  themes: EditableTheme[],
) {
  const visibleThemes = sortedThemes(themes).filter((theme) => !theme.hidden);
  const clusteredThemes = visibleThemes.filter((theme) => theme.kind === "cluster");
  const unclusteredTheme =
    visibleThemes.find((theme) => theme.kind === "unclustered") ?? null;
  const topThemes = clusteredThemes.slice(0, 4);
  const hiddenCount = themes.filter((theme) => theme.hidden).length;
  const headline = topThemes[0]?.label ?? analysis.report.headline;
  const overview = [
    `ThemeLens reviewed ${analysis.summary.analyzedRows} analyzed rows from ${analysis.summary.fileName}.`,
    topThemes[0]
      ? `The leading visible theme is ${topThemes[0].label} at ${formatPercent(topThemes[0].share)}.`
      : "No visible themes are currently included in the report.",
    unclusteredTheme
      ? `${unclusteredTheme.count} row${unclusteredTheme.count === 1 ? "" : "s"} remain in an unclustered review bucket.`
      : "All analyzed rows are assigned to named themes.",
    hiddenCount > 0
      ? `${hiddenCount} theme${hiddenCount === 1 ? "" : "s"} hidden from the current export.`
      : "All generated themes are currently included in the export.",
  ].join(" ");

  const takeaways = topThemes.map(
    (theme) =>
      `${theme.label}: ${theme.description} (${theme.count} rows, ${formatPercent(theme.share)}, ${sentimentTone(theme.sentimentBreakdown).toLowerCase()}).`,
  );

  return {
    headline,
    overview,
    takeaways,
    visibleThemes,
  };
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function downloadReport(
  analysis: AnalysisResponse,
  themes: EditableTheme[],
  rows: EvidenceRow[],
) {
  const snapshot = buildReportSnapshot(analysis, themes);
  const rowThemeMap = new Map<string, EditableTheme>();

  snapshot.visibleThemes.forEach((theme) => {
    theme.rowIds.forEach((rowId) => {
      rowThemeMap.set(rowId, theme);
    });
  });

  const themeSections = snapshot.visibleThemes
    .map((theme) => {
      const evidence = rows
        .filter((row) => theme.rowIds.includes(row.id))
        .slice(0, 5)
        .map(
          (row) => `
            <li>
              <strong>Row ${row.rowNumber}</strong>: ${escapeHtml(row.text)}
            </li>
          `,
        )
        .join("");

      return `
        <section class="theme">
          <div class="theme-header">
            <h3>${escapeHtml(theme.label)}</h3>
            <span>${theme.count} rows · ${formatPercent(theme.share)} · confidence ${escapeHtml(formatConfidence(theme.confidence))}</span>
          </div>
          <p>${escapeHtml(theme.description)}</p>
          <p class="meta">Kind: ${escapeHtml(theme.kind)} · Label source: ${escapeHtml(theme.source)} · Keywords: ${escapeHtml(theme.keywords.join(", "))}</p>
          <ul>${evidence}</ul>
        </section>
      `;
    })
    .join("");

  const assignmentRows = rows
    .filter((row) => rowThemeMap.has(row.id))
    .slice(0, 30)
    .map(
      (row) => `
        <tr>
          <td>${row.rowNumber}</td>
          <td>${escapeHtml(rowThemeMap.get(row.id)?.label ?? "Hidden theme")}</td>
          <td>${escapeHtml(assignmentLabel(row.assignmentType))}</td>
          <td>${escapeHtml(formatConfidence(row.assignmentConfidence))}</td>
          <td>${escapeHtml(row.sentiment)}</td>
          <td>${escapeHtml(row.text)}</td>
        </tr>
      `,
    )
    .join("");

  const html = `<!doctype html>
  <html lang="en">
    <head>
      <meta charset="utf-8" />
      <title>${escapeHtml(analysis.summary.fileName)} - ThemeLens Report</title>
      <style>
        body {
          margin: 0;
          padding: 40px;
          font-family: "Segoe UI", sans-serif;
          color: #182428;
          background: #f7f4ec;
        }
        h1, h2, h3 {
          margin: 0 0 12px;
        }
        .hero {
          padding: 32px;
          border-radius: 24px;
          background: linear-gradient(135deg, #fff7df, #dff3ef);
          border: 1px solid #d6dccd;
          margin-bottom: 24px;
        }
        .meta-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 12px;
          margin: 20px 0 0;
        }
        .meta-card, .theme {
          background: #ffffff;
          border: 1px solid #d7ddd1;
          border-radius: 18px;
          padding: 18px;
        }
        .theme {
          margin-bottom: 16px;
        }
        .theme-header {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          align-items: baseline;
        }
        .meta {
          color: #5d6b67;
          font-size: 14px;
        }
        ul {
          margin: 12px 0 0;
          padding-left: 20px;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 12px;
          background: #ffffff;
          border-radius: 18px;
          overflow: hidden;
        }
        th, td {
          border-bottom: 1px solid #e5e7df;
          padding: 10px 12px;
          text-align: left;
          vertical-align: top;
          font-size: 14px;
        }
        th {
          background: #eef3ea;
        }
      </style>
    </head>
    <body>
      <section class="hero">
        <p class="meta">ThemeLens insight pack</p>
        <h1>${escapeHtml(snapshot.headline)}</h1>
        <p>${escapeHtml(snapshot.overview)}</p>
        <div class="meta-grid">
          <div class="meta-card"><strong>Dataset</strong><br />${escapeHtml(analysis.summary.fileName)}</div>
          <div class="meta-card"><strong>Rows analyzed</strong><br />${analysis.summary.analyzedRows}</div>
          <div class="meta-card"><strong>Method</strong><br />${escapeHtml(analysis.summary.engine)}</div>
        </div>
      </section>
      <section>
        <h2>Key takeaways</h2>
        <ul>
          ${snapshot.takeaways.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
        </ul>
      </section>
      <section>
        <h2>Run diagnostics</h2>
        <div class="meta-grid">
          <div class="meta-card"><strong>Cluster count</strong><br />${analysis.summary.diagnostics.clusterCount}</div>
          <div class="meta-card"><strong>Unclustered rows</strong><br />${analysis.summary.diagnostics.unclusteredRows}</div>
          <div class="meta-card"><strong>Avg theme confidence</strong><br />${escapeHtml(formatConfidence(analysis.summary.diagnostics.averageThemeConfidence))}</div>
        </div>
      </section>
      <section>
        <h2>Theme breakdown</h2>
        ${themeSections}
      </section>
      <section>
        <h2>Evidence sample</h2>
        <table>
          <thead>
            <tr>
              <th>Row</th>
              <th>Theme</th>
              <th>Assignment</th>
              <th>Confidence</th>
              <th>Sentiment</th>
              <th>Text</th>
            </tr>
          </thead>
          <tbody>
            ${assignmentRows}
          </tbody>
        </table>
      </section>
    </body>
  </html>`;

  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${analysis.summary.fileName.replace(/\.[^.]+$/, "")}-themelens-report.html`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function SentimentMeter({ breakdown }: { breakdown: SentimentBreakdown }) {
  const total = Math.max(
    breakdown.positive + breakdown.neutral + breakdown.negative,
    1,
  );

  return (
    <div className="space-y-2">
      <div className="flex h-2 overflow-hidden rounded-full bg-[rgba(24,36,40,0.08)]">
        <div
          className="bg-(--tone-positive)"
          style={{ width: `${(breakdown.positive / total) * 100}%` }}
        />
        <div
          className="bg-(--tone-neutral)"
          style={{ width: `${(breakdown.neutral / total) * 100}%` }}
        />
        <div
          className="bg-(--tone-negative)"
          style={{ width: `${(breakdown.negative / total) * 100}%` }}
        />
      </div>
      <div className="flex flex-wrap gap-2 text-xs text-(--muted)">
        <span>Positive {breakdown.positive}</span>
        <span>Neutral {breakdown.neutral}</span>
        <span>Negative {breakdown.negative}</span>
      </div>
    </div>
  );
}

export function ThemeLensApp() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<DatasetPreview | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisResponse | null>(null);
  const [themes, setThemes] = useState<EditableTheme[]>([]);
  const [textColumn, setTextColumn] = useState("");
  const [metadataColumns, setMetadataColumns] = useState<string[]>([]);
  const [selectedThemeId, setSelectedThemeId] = useState<string | null>(null);
  const [selectedForMerge, setSelectedForMerge] = useState<string[]>([]);
  const [mergeName, setMergeName] = useState("");
  const [busyAction, setBusyAction] = useState<"preview" | "analysis" | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);

  const orderedThemes = sortedThemes(themes);
  const selectedTheme =
    orderedThemes.find((theme) => theme.id === selectedThemeId) ?? orderedThemes[0] ?? null;
  const reportSnapshot =
    analysis !== null ? buildReportSnapshot(analysis, themes) : null;

  async function inspectFile() {
    if (!file) return;

    setBusyAction("preview");
    setError(null);

    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.append("file", file);

        const payload = await readJsonResponse<DatasetPreview>(
          await fetch("/api/preview", {
            method: "POST",
            body: formData,
          }),
        );

        setPreview(payload);
        setTextColumn(payload.suggestedTextColumn ?? payload.columns[0] ?? "");
        setMetadataColumns(payload.suggestedMetadataColumns);
        setAnalysis(null);
        setThemes([]);
        setSelectedThemeId(null);
        setSelectedForMerge([]);
        setMergeName("");
      } catch (requestError) {
        setError(
          requestError instanceof Error
            ? requestError.message
            : "ThemeLens could not inspect the file.",
        );
      } finally {
        setBusyAction(null);
      }
    });
  }

  async function generateInsightPack() {
    if (!file || !textColumn) return;

    setBusyAction("analysis");
    setError(null);

    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("textColumn", textColumn);
        formData.append("metadataColumns", JSON.stringify(metadataColumns));

        const payload = await readJsonResponse<AnalysisResponse>(
          await fetch("/api/analyze", {
            method: "POST",
            body: formData,
          }),
        );

        setAnalysis(payload);
        setThemes(payload.themes.map((theme) => ({ ...theme, hidden: false })));
        setSelectedThemeId(payload.themes[0]?.id ?? null);
        setSelectedForMerge([]);
        setMergeName("");
      } catch (requestError) {
        setError(
          requestError instanceof Error
            ? requestError.message
            : "ThemeLens could not generate the insight pack.",
        );
      } finally {
        setBusyAction(null);
      }
    });
  }

  function toggleMetadata(column: string) {
    setMetadataColumns((current) =>
      current.includes(column)
        ? current.filter((value) => value !== column)
        : [...current, column],
    );
  }

  function updateTheme(themeId: string, updater: (theme: EditableTheme) => EditableTheme) {
    setThemes((current) =>
      current.map((theme) => (theme.id === themeId ? updater(theme) : theme)),
    );
  }

  function toggleThemeSelection(themeId: string) {
    setSelectedForMerge((current) =>
      current.includes(themeId)
        ? current.filter((value) => value !== themeId)
        : [...current, themeId],
    );
  }

  function mergeThemes() {
    if (!analysis || selectedForMerge.length < 2) return;

    const selectedThemes = themes.filter((theme) => selectedForMerge.includes(theme.id));
    if (selectedThemes.length < 2) return;

    const name =
      mergeName.trim() ||
      selectedThemes
        .slice(0, 2)
        .map((theme) => theme.label)
        .join(" + ");

    const rowIds = Array.from(
      new Set(selectedThemes.flatMap((theme) => theme.rowIds)),
    );
    const sentimentBreakdown = selectedThemes.reduce(
      (accumulator, theme) => ({
        positive: accumulator.positive + theme.sentimentBreakdown.positive,
        neutral: accumulator.neutral + theme.sentimentBreakdown.neutral,
        negative: accumulator.negative + theme.sentimentBreakdown.negative,
      }),
      {
        positive: 0,
        neutral: 0,
        negative: 0,
      },
    );

    const mergedTheme: EditableTheme = {
      id: `theme-merged-${Date.now()}`,
      kind: selectedThemes.every((theme) => theme.kind === "unclustered")
        ? "unclustered"
        : "cluster",
      label: name,
      generatedLabel: name,
      description: `Merged from ${selectedThemes.map((theme) => theme.label).join(", ")}.`,
      keywords: Array.from(
        new Set(selectedThemes.flatMap((theme) => theme.keywords)),
      ).slice(0, 8),
      count: rowIds.length,
      share: rowIds.length / Math.max(analysis.summary.analyzedRows, 1),
      confidence:
        selectedThemes
          .map((theme) => theme.confidence)
          .filter((value): value is number => value !== null)
          .reduce((sum, value, _, values) => sum + value / values.length, 0) || null,
      sampleQuotes: Array.from(
        new Set(selectedThemes.flatMap((theme) => theme.sampleQuotes)),
      ).slice(0, 4),
      sentimentBreakdown,
      rowIds,
      source: "fallback",
      diagnostics: {
        uniqueCommentCount: selectedThemes.reduce(
          (sum, theme) => sum + theme.diagnostics.uniqueCommentCount,
          0,
        ),
        lowConfidenceRowCount: selectedThemes.reduce(
          (sum, theme) => sum + theme.diagnostics.lowConfidenceRowCount,
          0,
        ),
      },
      hidden: false,
    };

    setThemes((current) => {
      const retained = current.filter((theme) => !selectedForMerge.includes(theme.id));
      return sortedThemes([...retained, mergedTheme]);
    });
    setSelectedThemeId(mergedTheme.id);
    setSelectedForMerge([]);
    setMergeName("");
  }

  return (
    <div className="min-h-screen px-4 py-6 sm:px-6 lg:px-10">
      <main className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <section className="grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">
          <div className="overflow-hidden rounded-[32px] border border-[rgba(24,36,40,0.08)] bg-[linear-gradient(140deg,rgba(255,247,223,0.95),rgba(223,243,239,0.82))] p-8 shadow-[0_30px_80px_rgba(24,36,40,0.08)]">
            <div className="mb-10 flex flex-wrap items-center gap-3 text-sm text-(--muted)">
              <span className="rounded-full border border-[rgba(24,36,40,0.12)] bg-white/70 px-3 py-1">
                ThemeLens MVP
              </span>
              <span>Upload qualitative text. Get an editable insight pack.</span>
            </div>
            <div className="max-w-3xl space-y-4">
              <h1 className="max-w-3xl font-display text-5xl leading-[0.95] tracking-[-0.04em] text-foreground sm:text-6xl">
                From raw feedback file to first-cut themes in one working session.
              </h1>
              <p className="max-w-2xl text-base leading-7 text-(--muted) sm:text-lg">
                This MVP follows the product brief directly: upload a CSV or Excel
                file, confirm the main text column, generate themes with evidence,
                clean them up, and export a lightweight report.
              </p>
            </div>
            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              <div className="rounded-3xl border border-[rgba(24,36,40,0.08)] bg-white/80 p-4">
                <p className="text-sm text-(--muted)">Accepted input</p>
                <p className="mt-2 font-medium">CSV, XLSX, XLS</p>
              </div>
              <div className="rounded-3xl border border-[rgba(24,36,40,0.08)] bg-white/80 p-4">
                <p className="text-sm text-(--muted)">Human control</p>
                <p className="mt-2 font-medium">Rename, merge, hide themes</p>
              </div>
              <div className="rounded-3xl border border-[rgba(24,36,40,0.08)] bg-white/80 p-4">
                <p className="text-sm text-(--muted)">Output</p>
                <p className="mt-2 font-medium">Presentation-ready HTML report</p>
              </div>
            </div>
          </div>

          <div className="rounded-[32px] border border-[rgba(24,36,40,0.08)] bg-(--card) p-6 shadow-[0_24px_60px_rgba(24,36,40,0.06)]">
            <div className="flex items-center gap-2 text-sm uppercase tracking-[0.24em] text-(--muted)">
              <Sparkles className="h-4 w-4" />
              Analysis stack
            </div>
            <div className="mt-6 space-y-4">
              <div className="rounded-3xl bg-(--surface-muted) p-4">
                <p className="text-sm text-(--muted)">Inspired by the reference project</p>
                <p className="mt-2 text-sm leading-6 text-foreground">
                  ThemeLens now keeps spreadsheet parsing in Next.js and sends normalized
                  text rows to a Python semantic-clustering backend for embeddings,
                  adaptive HDBSCAN topic discovery, noise reassignment, and
                  model-assisted labeling.
                </p>
              </div>
              <ol className="space-y-3 text-sm text-foreground">
                <li className="rounded-2xl border border-[rgba(24,36,40,0.08)] p-4">
                  1. Spreadsheet parsing with text-column scoring.
                </li>
                <li className="rounded-2xl border border-[rgba(24,36,40,0.08)] p-4">
                  2. Python semantic backend with OpenAI embeddings and per-row clustering.
                </li>
                <li className="rounded-2xl border border-[rgba(24,36,40,0.08)] p-4">
                  3. PCA reduction plus adaptive HDBSCAN, nearest-cluster reassignment, and deterministic k-means fallback only when needed.
                </li>
                <li className="rounded-2xl border border-[rgba(24,36,40,0.08)] p-4">
                  4. Reliability diagnostics, unclustered review bucket, and report export.
                </li>
              </ol>
            </div>
          </div>
        </section>

        {error ? (
          <section className="rounded-3xl border border-[rgba(190,62,62,0.18)] bg-[rgba(255,237,233,0.9)] px-5 py-4 text-sm text-(--tone-negative-ink)">
            {error}
          </section>
        ) : null}

        <section className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="rounded-[32px] border border-[rgba(24,36,40,0.08)] bg-(--card) p-6 shadow-[0_24px_60px_rgba(24,36,40,0.06)]">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-(--ink)/5 p-3 text-foreground">
                <FileSpreadsheet className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-xl font-semibold">1. Upload and inspect</h2>
                <p className="text-sm text-(--muted)">
                  Start with the raw file. ThemeLens suggests the text column and metadata.
                </p>
              </div>
            </div>

            <div className="mt-6 space-y-4">
              <label className="flex cursor-pointer flex-col gap-3 rounded-3xl border border-dashed border-[rgba(24,36,40,0.18)] bg-(--surface-muted) p-6 transition hover:border-[rgba(24,36,40,0.34)]">
                <span className="text-sm font-medium text-foreground">
                  Choose a CSV or Excel file
                </span>
                <span className="text-sm text-(--muted)">
                  Similar comments stay as individual evidence rows so dense themes are
                  easier to recover.
                </span>
                <input
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  className="sr-only"
                  onChange={(event) => {
                    const nextFile = event.target.files?.[0] ?? null;
                    setFile(nextFile);
                    setPreview(null);
                    setAnalysis(null);
                    setThemes([]);
                    setTextColumn("");
                    setMetadataColumns([]);
                    setSelectedThemeId(null);
                    setSelectedForMerge([]);
                    setMergeName("");
                  }}
                />
                <div className="flex flex-wrap items-center gap-3">
                  <span className="rounded-full bg-foreground px-4 py-2 text-sm font-medium text-white">
                    {file ? "Replace file" : "Browse file"}
                  </span>
                  <span className="text-sm text-(--muted)">
                    {file ? file.name : "No file selected"}
                  </span>
                </div>
              </label>

              <button
                type="button"
                onClick={inspectFile}
                disabled={!file || busyAction !== null}
                className="inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-3 text-sm font-medium text-white transition hover:-translate-y-px hover:bg-(--ink-strong) disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busyAction === "preview" ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                ) : (
                  <ArrowRight className="h-4 w-4" />
                )}
                Inspect file
              </button>
            </div>
          </div>

          <div className="rounded-[32px] border border-[rgba(24,36,40,0.08)] bg-(--card) p-6 shadow-[0_24px_60px_rgba(24,36,40,0.06)]">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-(--accent)/12 p-3 text-(--accent-strong)">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-xl font-semibold">2. Confirm setup</h2>
                <p className="text-sm text-(--muted)">
                  Review the inferred structure before generating the first-pass themes.
                </p>
              </div>
            </div>

            {preview ? (
              <div className="mt-6 space-y-6">
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl bg-(--surface-muted) p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-(--muted)">Rows</p>
                    <p className="mt-2 text-2xl font-semibold">{preview.totalRows}</p>
                  </div>
                  <div className="rounded-2xl bg-(--surface-muted) p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-(--muted)">Sheet</p>
                    <p className="mt-2 text-lg font-semibold">{preview.sheetName}</p>
                  </div>
                  <div className="rounded-2xl bg-(--surface-muted) p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-(--muted)">Language hint</p>
                    <p className="mt-2 text-lg font-semibold">{preview.languageHint}</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-sm font-medium">Primary text column</label>
                  <select
                    value={textColumn}
                    onChange={(event) => setTextColumn(event.target.value)}
                    className="w-full rounded-2xl border border-[rgba(24,36,40,0.12)] bg-white px-4 py-3 text-sm outline-none transition focus:border-(--accent-strong)"
                  >
                    {preview.columns.map((column) => (
                      <option key={column} value={column}>
                        {column}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <label className="text-sm font-medium">Optional metadata columns</label>
                    <span className="text-xs text-(--muted)">
                      Select anything useful for later evidence review.
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {preview.columns
                      .filter((column) => column !== textColumn)
                      .map((column) => {
                        const active = metadataColumns.includes(column);
                        return (
                          <button
                            key={column}
                            type="button"
                            onClick={() => toggleMetadata(column)}
                            className={`rounded-full border px-4 py-2 text-sm transition ${
                              active
                                ? "border-(--accent-strong) bg-(--accent)/12 text-(--accent-strong)"
                                : "border-[rgba(24,36,40,0.12)] bg-white text-foreground hover:border-[rgba(24,36,40,0.24)]"
                            }`}
                          >
                            {column}
                          </button>
                        );
                      })}
                  </div>
                </div>

                <div className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
                  <div className="rounded-3xl border border-[rgba(24,36,40,0.08)] bg-(--surface-muted) p-4">
                    <p className="text-sm font-medium">Top text-column candidates</p>
                    <div className="mt-3 space-y-3">
                      {preview.candidateTextColumns.slice(0, 4).map((candidate) => (
                        <div
                          key={candidate.name}
                          className="rounded-2xl border border-[rgba(24,36,40,0.08)] bg-white p-3"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <p className="font-medium">{candidate.name}</p>
                            <span className="text-xs text-(--muted)">
                              score {candidate.score.toFixed(2)}
                            </span>
                          </div>
                          <p className="mt-2 text-sm text-(--muted)">
                            {candidate.reasons.join(" · ")}
                          </p>
                          <p className="mt-2 line-clamp-2 text-xs text-(--muted)">
                            {candidate.sample}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-3xl border border-[rgba(24,36,40,0.08)] bg-(--surface-muted) p-4">
                    <p className="text-sm font-medium">Sample rows</p>
                    <div className="mt-3 overflow-hidden rounded-2xl border border-[rgba(24,36,40,0.08)] bg-white">
                      <div className="max-h-64 overflow-auto">
                        <table className="min-w-full text-left text-sm">
                          <thead className="sticky top-0 bg-(--surface-soft) text-(--muted)">
                            <tr>
                              <th className="px-3 py-2 font-medium">Row</th>
                              {preview.columns.slice(0, 3).map((column) => (
                                <th key={column} className="px-3 py-2 font-medium">
                                  {column}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {preview.sampleRows.map((row) => (
                              <tr
                                key={row.rowNumber}
                                className="border-t border-[rgba(24,36,40,0.06)] align-top"
                              >
                                <td className="px-3 py-2 text-(--muted)">
                                  {row.rowNumber}
                                </td>
                                {preview.columns.slice(0, 3).map((column) => (
                                  <td
                                    key={`${row.rowNumber}-${column}`}
                                    className="px-3 py-2 text-foreground"
                                  >
                                    {row.values[column] || "—"}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-2 text-sm text-(--muted)">
                  {preview.validationNotes.map((note) => (
                    <p key={note}>{note}</p>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={generateInsightPack}
                  disabled={!file || !textColumn || busyAction !== null}
                  className="inline-flex items-center gap-2 rounded-full bg-(--accent-strong) px-5 py-3 text-sm font-medium text-white transition hover:-translate-y-px hover:bg-(--accent-deep) disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {busyAction === "analysis" ? (
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}
                  Generate insight pack
                </button>
              </div>
            ) : (
              <div className="mt-6 rounded-3xl border border-dashed border-[rgba(24,36,40,0.14)] bg-(--surface-muted) p-8 text-sm leading-7 text-(--muted)">
                Upload a file and run the inspection step first. ThemeLens will return
                candidate text columns, row counts, sample rows, and metadata suggestions.
              </div>
            )}
          </div>
        </section>

        {analysis ? (
          <>
            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
              <div className="rounded-[28px] border border-[rgba(24,36,40,0.08)] bg-(--card) p-5 shadow-[0_20px_50px_rgba(24,36,40,0.06)]">
                <p className="text-sm text-(--muted)">Rows analyzed</p>
                <p className="mt-2 text-3xl font-semibold">{analysis.summary.analyzedRows}</p>
              </div>
              <div className="rounded-[28px] border border-[rgba(24,36,40,0.08)] bg-(--card) p-5 shadow-[0_20px_50px_rgba(24,36,40,0.06)]">
                <p className="text-sm text-(--muted)">Clustered themes</p>
                <p className="mt-2 text-3xl font-semibold">
                  {analysis.summary.diagnostics.clusterCount}
                </p>
              </div>
              <div className="rounded-[28px] border border-[rgba(24,36,40,0.08)] bg-(--card) p-5 shadow-[0_20px_50px_rgba(24,36,40,0.06)]">
                <p className="text-sm text-(--muted)">Unclustered rows</p>
                <p className="mt-2 text-3xl font-semibold">
                  {analysis.summary.diagnostics.unclusteredRows}
                </p>
              </div>
              <div className="rounded-[28px] border border-[rgba(24,36,40,0.08)] bg-(--card) p-5 shadow-[0_20px_50px_rgba(24,36,40,0.06)]">
                <p className="text-sm text-(--muted)">Hidden from export</p>
                <p className="mt-2 text-3xl font-semibold">
                  {themes.filter((theme) => theme.hidden).length}
                </p>
              </div>
              <div className="rounded-[28px] border border-[rgba(24,36,40,0.08)] bg-(--card) p-5 shadow-[0_20px_50px_rgba(24,36,40,0.06)]">
                <p className="text-sm text-(--muted)">Method quality</p>
                <p className="mt-2 text-base font-medium text-foreground">
                  {methodQualityLabel(analysis)}
                </p>
                <p className="mt-2 text-xs text-(--muted)">
                  {analysis.summary.engine}
                </p>
              </div>
            </section>

            <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
              <div className="rounded-[32px] border border-[rgba(24,36,40,0.08)] bg-(--card) p-6 shadow-[0_24px_60px_rgba(24,36,40,0.06)]">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 text-sm uppercase tracking-[0.24em] text-(--muted)">
                      <Layers3 className="h-4 w-4" />
                      Theme studio
                    </div>
                    <h2 className="mt-3 text-2xl font-semibold">
                      3. Review, rename, merge, hide
                    </h2>
                  </div>
                  {selectedForMerge.length > 1 ? (
                    <div className="flex flex-wrap items-center gap-3 rounded-full border border-[rgba(24,36,40,0.08)] bg-(--surface-muted) px-3 py-2">
                      <input
                        value={mergeName}
                        onChange={(event) => setMergeName(event.target.value)}
                        placeholder="Merged theme name"
                        className="min-w-48 bg-transparent text-sm outline-none placeholder:text-(--muted)"
                      />
                      <button
                        type="button"
                        onClick={mergeThemes}
                        className="inline-flex items-center gap-2 rounded-full bg-foreground px-4 py-2 text-sm font-medium text-white"
                      >
                        <Merge className="h-4 w-4" />
                        Merge {selectedForMerge.length}
                      </button>
                    </div>
                  ) : null}
                </div>

                <div className="mt-6 grid gap-4 lg:grid-cols-2">
                  {orderedThemes.map((theme) => {
                    const isSelected = theme.id === selectedTheme?.id;
                    const isMarked = selectedForMerge.includes(theme.id);

                    return (
                      <article
                        key={theme.id}
                        className={`flex h-full flex-col rounded-[28px] border p-5 transition ${
                          theme.hidden
                            ? "border-[rgba(24,36,40,0.08)] bg-[rgba(246,246,238,0.78)] opacity-70"
                            : isSelected
                              ? "border-(--accent-strong) bg-[rgba(223,243,239,0.45)] shadow-[0_20px_40px_rgba(14,127,122,0.08)]"
                              : "border-[rgba(24,36,40,0.08)] bg-white"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="space-y-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="rounded-full bg-(--surface-muted) px-3 py-1 text-xs text-(--muted)">
                                {theme.source === "model"
                                  ? "model label"
                                  : theme.source === "system"
                                    ? "system bucket"
                                    : "fallback label"}
                              </span>
                              <span className="rounded-full bg-(--surface-muted) px-3 py-1 text-xs text-(--muted)">
                                {theme.kind === "unclustered" ? "unclustered" : "cluster"}
                              </span>
                              {theme.hidden ? (
                                <span className="rounded-full bg-[rgba(24,36,40,0.08)] px-3 py-1 text-xs text-(--muted)">
                                  hidden
                                </span>
                              ) : null}
                            </div>
                            <h3 className="text-xl font-semibold">{theme.label}</h3>
                            <p className="text-sm leading-6 text-(--muted)">
                              {theme.description}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-2xl font-semibold">{theme.count}</p>
                            <p className="text-xs uppercase tracking-[0.18em] text-(--muted)">
                              {formatPercent(theme.share)}
                            </p>
                          </div>
                        </div>

                        <div className="mt-5 grid gap-3 sm:grid-cols-3">
                          <div className="rounded-2xl bg-(--surface-muted) p-3">
                            <p className="text-[11px] uppercase tracking-[0.18em] text-(--muted)">
                              Confidence
                            </p>
                            <p className="mt-2 text-lg font-semibold">
                              {formatConfidence(theme.confidence)}
                            </p>
                          </div>
                          <div className="rounded-2xl bg-(--surface-muted) p-3">
                            <p className="text-[11px] uppercase tracking-[0.18em] text-(--muted)">
                              Unique comments
                            </p>
                            <p className="mt-2 text-lg font-semibold">
                              {theme.diagnostics.uniqueCommentCount}
                            </p>
                          </div>
                          <div className="rounded-2xl bg-(--surface-muted) p-3">
                            <p className="text-[11px] uppercase tracking-[0.18em] text-(--muted)">
                              Low confidence
                            </p>
                            <p className="mt-2 text-lg font-semibold">
                              {theme.diagnostics.lowConfidenceRowCount}
                            </p>
                          </div>
                        </div>

                        <div className="mt-5">
                          <SentimentMeter breakdown={theme.sentimentBreakdown} />
                        </div>

                        <div className="mt-5 flex flex-wrap gap-2">
                          {theme.keywords.slice(0, 5).map((keyword) => (
                            <span
                              key={keyword}
                              className="rounded-full bg-(--surface-muted) px-3 py-1 text-xs text-(--muted)"
                            >
                              {keyword}
                            </span>
                          ))}
                        </div>

                        <blockquote className="mt-5 rounded-2xl bg-(--surface-muted) p-4 text-sm leading-6 text-foreground">
                          “{theme.sampleQuotes[0] ?? "No representative quote available."}”
                        </blockquote>

                        <div className="mt-5 flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setSelectedThemeId(theme.id)}
                            className="inline-flex items-center gap-2 rounded-full border border-[rgba(24,36,40,0.12)] px-4 py-2 text-sm hover:border-[rgba(24,36,40,0.24)]"
                          >
                            <Eye className="h-4 w-4" />
                            Inspect evidence
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              updateTheme(theme.id, (current) => ({
                                ...current,
                                hidden: !current.hidden,
                              }))
                            }
                            className="inline-flex items-center gap-2 rounded-full border border-[rgba(24,36,40,0.12)] px-4 py-2 text-sm hover:border-[rgba(24,36,40,0.24)]"
                          >
                            {theme.hidden ? (
                              <>
                                <Eye className="h-4 w-4" />
                                Include
                              </>
                            ) : (
                              <>
                                <EyeOff className="h-4 w-4" />
                                Hide
                              </>
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => toggleThemeSelection(theme.id)}
                            className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm ${
                              isMarked
                                ? "border-(--accent-strong) bg-(--accent)/12 text-(--accent-strong)"
                                : "border-[rgba(24,36,40,0.12)] hover:border-[rgba(24,36,40,0.24)]"
                            }`}
                          >
                            <Merge className="h-4 w-4" />
                            {isMarked ? "Selected" : "Select to merge"}
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </div>

              <div className="flex flex-col gap-6">
                <section className="rounded-[32px] border border-[rgba(24,36,40,0.08)] bg-(--card) p-6 shadow-[0_24px_60px_rgba(24,36,40,0.06)]">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2 text-sm uppercase tracking-[0.24em] text-(--muted)">
                        <Sparkles className="h-4 w-4" />
                        Report preview
                      </div>
                      <h2 className="mt-3 text-2xl font-semibold">4. Share now</h2>
                    </div>
                    <button
                      type="button"
                      onClick={() => downloadReport(analysis, themes, analysis.rows)}
                      className="inline-flex items-center gap-2 rounded-full bg-(--accent-strong) px-4 py-3 text-sm font-medium text-white hover:bg-(--accent-deep)"
                    >
                      <Download className="h-4 w-4" />
                      Download HTML report
                    </button>
                  </div>

                  {reportSnapshot ? (
                    <div className="mt-6 space-y-5">
                      <div className="rounded-3xl bg-[linear-gradient(135deg,rgba(255,247,223,0.86),rgba(223,243,239,0.82))] p-5">
                        <p className="text-xs uppercase tracking-[0.18em] text-(--muted)">
                          Headline
                        </p>
                        <h3 className="mt-2 text-2xl font-semibold leading-tight">
                          {reportSnapshot.headline}
                        </h3>
                        <p className="mt-3 text-sm leading-6 text-(--muted)">
                          {reportSnapshot.overview}
                        </p>
                      </div>

                      <div className="rounded-3xl border border-[rgba(24,36,40,0.08)] bg-(--surface-muted) p-5">
                        <p className="text-sm font-medium">Key takeaways</p>
                        <div className="mt-3 space-y-3">
                          {reportSnapshot.takeaways.map((item) => (
                            <p
                              key={item}
                              className="rounded-2xl border border-[rgba(24,36,40,0.08)] bg-white px-4 py-3 text-sm leading-6 text-foreground"
                            >
                              {item}
                            </p>
                          ))}
                        </div>
                      </div>

                      <div className="rounded-3xl border border-[rgba(24,36,40,0.08)] bg-(--surface-muted) p-5">
                        <p className="text-sm font-medium">Run diagnostics</p>
                        <div className="mt-3 grid gap-3 sm:grid-cols-2">
                          <div className="rounded-2xl border border-[rgba(24,36,40,0.08)] bg-white px-4 py-3 text-sm">
                            Clustered themes: {analysis.summary.diagnostics.clusterCount}
                          </div>
                          <div className="rounded-2xl border border-[rgba(24,36,40,0.08)] bg-white px-4 py-3 text-sm">
                            Unclustered rows: {analysis.summary.diagnostics.unclusteredRows}
                          </div>
                          <div className="rounded-2xl border border-[rgba(24,36,40,0.08)] bg-white px-4 py-3 text-sm">
                            Avg theme confidence: {formatConfidence(analysis.summary.diagnostics.averageThemeConfidence)}
                          </div>
                          <div className="rounded-2xl border border-[rgba(24,36,40,0.08)] bg-white px-4 py-3 text-sm">
                            Low-confidence rows: {analysis.summary.diagnostics.lowConfidenceRows}
                          </div>
                          <div className="rounded-2xl border border-[rgba(24,36,40,0.08)] bg-white px-4 py-3 text-sm">
                            Noise rows reassigned: {analysis.summary.diagnostics.reassignedNoiseRows}
                          </div>
                        </div>
                      </div>

                      {Object.keys(analysis.metadataValueCounts).length > 0 ? (
                        <div className="rounded-3xl border border-[rgba(24,36,40,0.08)] bg-(--surface-muted) p-5">
                          <p className="text-sm font-medium">Metadata overview</p>
                          <div className="mt-3 space-y-3">
                            {Object.entries(analysis.metadataValueCounts).map(([column, items]) => (
                              <div
                                key={column}
                                className="rounded-2xl border border-[rgba(24,36,40,0.08)] bg-white p-4"
                              >
                                <p className="text-sm font-medium">{column}</p>
                                <div className="mt-3 flex flex-wrap gap-2">
                                  {items.map((item) => (
                                    <span
                                      key={`${column}-${item.value}`}
                                      className="rounded-full bg-(--surface-muted) px-3 py-1 text-xs text-(--muted)"
                                    >
                                      {item.value}: {item.count}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null}

                      <div className="rounded-3xl border border-[rgba(24,36,40,0.08)] bg-(--surface-muted) p-5">
                        <p className="text-sm font-medium">Analysis notes</p>
                        <div className="mt-3 space-y-2 text-sm leading-6 text-(--muted)">
                          {analysis.summary.notes.map((note) => (
                            <p key={note}>{note}</p>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : null}
                </section>

                <section className="rounded-[32px] border border-[rgba(24,36,40,0.08)] bg-(--card) p-6 shadow-[0_24px_60px_rgba(24,36,40,0.06)]">
                  <div className="flex items-center gap-2 text-sm uppercase tracking-[0.24em] text-(--muted)">
                    <Tags className="h-4 w-4" />
                    Evidence panel
                  </div>

                  {selectedTheme ? (
                    <div className="mt-5 space-y-5">
                      <div>
                        <label className="text-sm font-medium">Theme name</label>
                        <input
                          value={selectedTheme.label}
                          onChange={(event) =>
                            updateTheme(selectedTheme.id, (current) => ({
                              ...current,
                              label: event.target.value,
                            }))
                          }
                          className="mt-2 w-full rounded-2xl border border-[rgba(24,36,40,0.12)] bg-white px-4 py-3 text-sm outline-none transition focus:border-(--accent-strong)"
                        />
                      </div>

                      <div className="grid gap-3 sm:grid-cols-3">
                        <div className="rounded-2xl bg-(--surface-muted) p-4">
                          <p className="text-xs uppercase tracking-[0.18em] text-(--muted)">
                            Count
                          </p>
                          <p className="mt-2 text-2xl font-semibold">{selectedTheme.count}</p>
                        </div>
                        <div className="rounded-2xl bg-(--surface-muted) p-4">
                          <p className="text-xs uppercase tracking-[0.18em] text-(--muted)">
                            Share
                          </p>
                          <p className="mt-2 text-2xl font-semibold">
                            {formatPercent(selectedTheme.share)}
                          </p>
                        </div>
                        <div className="rounded-2xl bg-(--surface-muted) p-4">
                          <p className="text-xs uppercase tracking-[0.18em] text-(--muted)">
                            Confidence
                          </p>
                          <p className="mt-2 text-2xl font-semibold">
                            {formatConfidence(selectedTheme.confidence)}
                          </p>
                        </div>
                      </div>

                      <div className="rounded-3xl border border-[rgba(24,36,40,0.08)] bg-(--surface-muted) p-4">
                        <p className="text-sm font-medium">Sentiment signal</p>
                        <div className="mt-3">
                          <SentimentMeter breakdown={selectedTheme.sentimentBreakdown} />
                        </div>
                      </div>

                      <div className="rounded-3xl border border-[rgba(24,36,40,0.08)] bg-(--surface-muted) p-4">
                        <p className="text-sm font-medium">Representative quotes</p>
                        <div className="mt-3 space-y-3">
                          {selectedTheme.sampleQuotes.map((quote) => (
                            <blockquote
                              key={quote}
                              className="rounded-2xl bg-white p-4 text-sm leading-6 text-foreground"
                            >
                              “{quote}”
                            </blockquote>
                          ))}
                        </div>
                      </div>

                      <div className="rounded-3xl border border-[rgba(24,36,40,0.08)] bg-(--surface-muted) p-4">
                        <p className="text-sm font-medium">Underlying evidence rows</p>
                        <div className="mt-3 max-h-[420px] space-y-3 overflow-auto">
                          {analysis.rows
                            .filter((row) => selectedTheme.rowIds.includes(row.id))
                            .slice(0, 40)
                            .map((row) => (
                              <article
                                key={row.id}
                                className="rounded-2xl border border-[rgba(24,36,40,0.08)] bg-white p-4"
                              >
                                <div className="flex flex-wrap items-center gap-2 text-xs text-(--muted)">
                                  <span>Row {row.rowNumber}</span>
                                  <span>•</span>
                                  <span>{row.sentiment}</span>
                                  <span>•</span>
                                  <span>{assignmentLabel(row.assignmentType)}</span>
                                  {row.assignmentConfidence !== null ? (
                                    <>
                                      <span>•</span>
                                      <span>confidence {formatConfidence(row.assignmentConfidence)}</span>
                                    </>
                                  ) : null}
                                  {Object.entries(row.metadata).map(([key, value]) => (
                                    <span key={`${row.id}-${key}`} className="rounded-full bg-(--surface-muted) px-2 py-1">
                                      {key}: {value}
                                    </span>
                                  ))}
                                </div>
                                <p className="mt-3 text-sm leading-6 text-foreground">
                                  {row.text}
                                </p>
                              </article>
                            ))}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-5 rounded-3xl border border-dashed border-[rgba(24,36,40,0.14)] bg-(--surface-muted) p-6 text-sm leading-7 text-(--muted)">
                      Select a theme card to inspect supporting rows and rename the theme.
                    </div>
                  )}
                </section>
              </div>
            </section>
          </>
        ) : null}
      </main>
    </div>
  );
}
