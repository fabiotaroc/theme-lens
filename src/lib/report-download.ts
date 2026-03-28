"use client";

import type { AnalysisResponse, EditableTheme, EvidenceRow } from "@/lib/types";

import {
  assignmentLabel,
  buildReportSnapshot,
  formatConfidence,
  formatPercent,
} from "@/lib/workspace-presenters";

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function downloadReport(
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
          <p class="meta">Theme type: ${escapeHtml(theme.kind)} · Keywords: ${escapeHtml(theme.keywords.join(", "))}</p>
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
      <title>${escapeHtml(analysis.summary.fileName)} - ThemeLens report</title>
      <style>
        body {
          margin: 0;
          padding: 40px;
          font-family: "Segoe UI", sans-serif;
          color: #182428;
          background: #f5f1e8;
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
        <p class="meta">ThemeLens report</p>
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
