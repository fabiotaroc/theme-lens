import type {
  AnalysisResponse,
  EditableTheme,
  EvidenceRow,
  SentimentBreakdown,
} from "@/lib/types";

export function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`;
}

export function formatConfidence(value: number | null) {
  if (value === null) return "n/a";
  return `${Math.round(value * 100)}%`;
}

export function sentimentTone(breakdown: SentimentBreakdown) {
  if (breakdown.negative > breakdown.positive) return "Mostly negative";
  if (breakdown.positive > breakdown.negative) return "Mostly positive";
  return "Mixed";
}

export function assignmentLabel(assignmentType: EvidenceRow["assignmentType"]) {
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

export function methodQualityLabel(analysis: AnalysisResponse) {
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

export function sortedThemes(themes: EditableTheme[]) {
  return [...themes].sort((left, right) => {
    if (left.hidden !== right.hidden) return Number(left.hidden) - Number(right.hidden);
    if (left.kind !== right.kind) return left.kind === "unclustered" ? 1 : -1;
    return right.count - left.count;
  });
}

export function buildReportSnapshot(
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
    topThemes,
    unclusteredTheme,
  };
}

export function collectThemeRows(rows: EvidenceRow[], rowIds: string[]) {
  const rowIdSet = new Set(rowIds);
  return rows.filter((row) => rowIdSet.has(row.id));
}
