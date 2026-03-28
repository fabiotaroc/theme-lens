"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { BarChart3, Eye, EyeOff, Merge } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useWorkspace } from "@/components/workspace-provider";
import {
  CollapsiblePanel,
  EmptyState,
  MainSection,
  MetricCard,
  PageHeader,
  SectionIntro,
  SentimentMeter,
  SurfaceCard,
  WorkspaceError,
} from "@/components/workspace-ui";
import type { EditableTheme } from "@/lib/types";
import { cn } from "@/lib/utils";
import {
  buildReportSnapshot,
  collectThemeRows,
  formatConfidence,
  formatPercent,
  methodQualityLabel,
  sentimentTone,
  sortedThemes,
} from "@/lib/workspace-presenters";

export function InsightsWorkspacePage() {
  const { error, replaceThemes, patchWorkspace, workspace } = useWorkspace();
  const analysis = workspace.analysis;
  const [selectedForMerge, setSelectedForMerge] = useState<string[]>([]);
  const [mergeName, setMergeName] = useState("");

  const orderedThemes = useMemo(() => sortedThemes(workspace.themes), [workspace.themes]);
  const selectedTheme =
    orderedThemes.find((theme) => theme.id === workspace.selectedThemeId) ??
    orderedThemes[0] ??
    null;

  if (!analysis) {
    return (
      <>
        <PageHeader
          eyebrow="Insights"
          title="Review the most important findings first."
          description="This page separates the executive overview from the detailed theme workspace so users can move from summary to evidence without getting lost in the interface."
        />
        <EmptyState
          title="No analysis is available yet"
          description="Inspect the dataset and run analysis first. The dashboard will then show the top signals, theme clusters, and evidence panels here."
        />
      </>
    );
  }

  const currentAnalysis = analysis;
  const reportSnapshot = buildReportSnapshot(analysis, workspace.themes);
  const visibleThemes = orderedThemes.filter((theme) => !theme.hidden);
  const topThemes = visibleThemes.filter((theme) => theme.kind === "cluster").slice(0, 3);
  const selectedThemeRows = selectedTheme
    ? collectThemeRows(analysis.rows, selectedTheme.rowIds)
    : [];

  async function renameTheme(themeId: string, label: string) {
    await replaceThemes(
      workspace.themes.map((theme) =>
        theme.id === themeId ? { ...theme, label } : theme,
      ),
      themeId,
    );
  }

  async function toggleThemeHidden(themeId: string) {
    await replaceThemes(
      workspace.themes.map((theme) =>
        theme.id === themeId ? { ...theme, hidden: !theme.hidden } : theme,
      ),
      workspace.selectedThemeId,
    );
  }

  async function selectTheme(themeId: string) {
    await patchWorkspace({ selectedThemeId: themeId });
  }

  async function mergeThemes() {
    const selectedThemes = workspace.themes.filter((theme) =>
      selectedForMerge.includes(theme.id),
    );
    if (selectedThemes.length < 2) return;

    const rowIds = Array.from(new Set(selectedThemes.flatMap((theme) => theme.rowIds)));
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

    const label =
      mergeName.trim() ||
      selectedThemes
        .slice(0, 2)
        .map((theme) => theme.label)
        .join(" + ");

    const mergedTheme: EditableTheme = {
      id: `theme-merged-${Date.now()}`,
      kind: selectedThemes.every((theme) => theme.kind === "unclustered")
        ? "unclustered"
        : "cluster",
      label,
      generatedLabel: label,
      description: `Merged from ${selectedThemes.map((theme) => theme.label).join(", ")}.`,
      keywords: Array.from(new Set(selectedThemes.flatMap((theme) => theme.keywords))).slice(
        0,
        8,
      ),
      count: rowIds.length,
      share: rowIds.length / Math.max(currentAnalysis.summary.analyzedRows, 1),
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

    const nextThemes = sortedThemes([
      ...workspace.themes.filter((theme) => !selectedForMerge.includes(theme.id)),
      mergedTheme,
    ]);

    await replaceThemes(nextThemes, mergedTheme.id);
    setSelectedForMerge([]);
    setMergeName("");
  }

  return (
    <>
      <PageHeader
        eyebrow="Insights dashboard"
        title="Read the signal, then work the clusters."
        actions={
          <Button asChild>
            <Link href="/app/report">Open report view</Link>
          </Button>
        }
      />

      {error ? <WorkspaceError message={error} /> : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <MetricCard label="Rows analyzed" value={analysis.summary.analyzedRows} />
        <MetricCard
          label="Themes surfaced"
          value={analysis.summary.diagnostics.clusterCount}
        />
        <MetricCard
          label="Unclustered rows"
          value={analysis.summary.diagnostics.unclusteredRows}
        />
        <MetricCard
          label="Hidden themes"
          value={workspace.themes.filter((theme) => theme.hidden).length}
        />
        <MetricCard
          label="Method quality"
          value={methodQualityLabel(analysis)}
          valueClassName="text-base"
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
        <MainSection className="px-1 sm:px-2">
          <SectionIntro
            eyebrow="High-level insight"
            title={reportSnapshot.headline}
            description={reportSnapshot.overview}
          />

          <div className="mt-8 grid gap-4 lg:grid-cols-3">
            {topThemes.map((theme) => (
              <div
                key={theme.id}
                className="rounded-[24px] border border-[rgba(24,36,40,0.08)] bg-white/58 p-5"
              >
                <Badge variant="outline" className="uppercase">
                  Leading theme
                </Badge>
                <h3 className="mt-3 text-xl font-semibold text-foreground">
                  {theme.label}
                </h3>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">
                  {theme.description}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Badge variant="outline">{formatPercent(theme.share)} share</Badge>
                  <Badge variant="outline">{theme.count} rows</Badge>
                  <Badge variant="outline">{sentimentTone(theme.sentimentBreakdown)}</Badge>
                </div>
              </div>
            ))}
          </div>
        </MainSection>

        <div className="space-y-6">
          <SurfaceCard>
            <SectionIntro
              eyebrow="Read this first"
              title="Top takeaways"
            />
            <div className="mt-4 space-y-3">
              {reportSnapshot.takeaways.map((item) => (
                <p
                  key={item}
                  className="rounded-2xl border border-[rgba(24,36,40,0.08)] bg-white/74 px-4 py-4 text-sm leading-7 text-foreground"
                >
                  {item}
                </p>
              ))}
            </div>
          </SurfaceCard>

          <CollapsiblePanel
            eyebrow="Method notes"
            title="Diagnostics and caveats"
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-[rgba(24,36,40,0.08)] bg-white px-4 py-3 text-sm">
                Avg confidence:{" "}
                {formatConfidence(analysis.summary.diagnostics.averageThemeConfidence)}
              </div>
              <div className="rounded-2xl border border-[rgba(24,36,40,0.08)] bg-white px-4 py-3 text-sm">
                Low-confidence rows: {analysis.summary.diagnostics.lowConfidenceRows}
              </div>
              <div className="rounded-2xl border border-[rgba(24,36,40,0.08)] bg-white px-4 py-3 text-sm">
                Reassigned noise: {analysis.summary.diagnostics.reassignedNoiseRows}
              </div>
              <div className="rounded-2xl border border-[rgba(24,36,40,0.08)] bg-white px-4 py-3 text-sm">
                Engine: {analysis.summary.engine}
              </div>
              {analysis.summary.notes.map((note) => (
                <div
                  key={note}
                  className="rounded-2xl border border-[rgba(24,36,40,0.08)] bg-white px-4 py-3 text-sm leading-6 text-muted-foreground sm:col-span-2"
                >
                  {note}
                </div>
              ))}
            </div>
          </CollapsiblePanel>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <MainSection className="px-1 sm:px-2">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <SectionIntro
              eyebrow="Cluster-level insights"
              title="Theme workspace"
              description="This is the editing layer. Keep the strongest themes visible, merge overlaps, and use the evidence panel on the right when you need detail."
              className="flex-1"
            />

            {selectedForMerge.length > 1 ? (
              <div className="flex flex-wrap items-center gap-3 rounded-full border border-[rgba(24,36,40,0.08)] bg-[rgba(255,255,255,0.78)] px-3 py-2">
                <Input
                  value={mergeName}
                  onChange={(event) => setMergeName(event.target.value)}
                  placeholder="Merged theme name"
                  className="h-9 min-w-48 border-0 bg-transparent px-0 py-0 shadow-none focus-visible:border-0"
                />
                <Button type="button" onClick={mergeThemes} size="sm">
                  <Merge className="h-4 w-4" />
                  Merge {selectedForMerge.length}
                </Button>
              </div>
            ) : null}
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            {orderedThemes.map((theme) => {
              const active = theme.id === selectedTheme?.id;
              const marked = selectedForMerge.includes(theme.id);

              return (
                <article
                  key={theme.id}
                  className={cn(
                    "rounded-[26px] border px-5 py-5 transition",
                    active
                      ? "border-[rgba(16,98,95,0.22)] bg-[rgba(219,241,237,0.52)]"
                      : theme.hidden
                        ? "border-[rgba(24,36,40,0.08)] bg-[rgba(245,245,240,0.62)] opacity-75"
                        : "border-[rgba(24,36,40,0.08)] bg-white/46",
                  )}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="outline">
                          {theme.kind === "cluster" ? "Cluster" : "Review bucket"}
                        </Badge>
                        <Badge variant="outline">{theme.hidden ? "Hidden" : "Visible"}</Badge>
                      </div>
                      <h3 className="mt-4 text-xl font-semibold text-foreground">
                        {theme.label}
                      </h3>
                      <p className="mt-2 text-sm leading-6 text-muted-foreground">
                        {theme.description}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-semibold text-foreground">{theme.count}</p>
                      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                        {formatPercent(theme.share)}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {theme.keywords.slice(0, 5).map((keyword) => (
                      <Badge key={keyword} variant="outline">
                        {keyword}
                      </Badge>
                    ))}
                  </div>

                  <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">
                    <span>Confidence {formatConfidence(theme.confidence)}</span>
                    <span>{theme.diagnostics.uniqueCommentCount} unique comments</span>
                    <span>{theme.diagnostics.lowConfidenceRowCount} low-confidence rows</span>
                  </div>

                  <div className="mt-4">
                    <SentimentMeter breakdown={theme.sentimentBreakdown} />
                  </div>

                  {active ? (
                    <blockquote className="mt-5 rounded-2xl bg-[rgba(242,239,230,0.9)] px-4 py-4 text-sm leading-6 text-foreground">
                      “{theme.sampleQuotes[0] ?? "No representative quote available."}”
                    </blockquote>
                  ) : null}

                  <div className="mt-5 flex flex-wrap gap-2">
                    <Button
                      type="button"
                      onClick={() => void selectTheme(theme.id)}
                      variant={active ? "default" : "secondary"}
                    >
                      <Eye className="h-4 w-4" />
                      {active ? "Selected" : "Inspect evidence"}
                    </Button>
                    <Button
                      type="button"
                      onClick={() => void toggleThemeHidden(theme.id)}
                      variant="secondary"
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
                    </Button>
                    <Button
                      type="button"
                      onClick={() =>
                        setSelectedForMerge((current) =>
                          current.includes(theme.id)
                            ? current.filter((value) => value !== theme.id)
                            : [...current, theme.id],
                        )
                      }
                      variant={marked ? "default" : "secondary"}
                    >
                      <Merge className="h-4 w-4" />
                      {marked ? "Selected" : "Select to merge"}
                    </Button>
                  </div>
                </article>
              );
            })}
          </div>
        </MainSection>

        <div className="space-y-6">
          {selectedTheme ? (
            <>
              <SurfaceCard>
                <div className="flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-(--accent-strong)" />
                  <span className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">
                    Evidence panel
                  </span>
                </div>

                <SectionIntro
                  title={selectedTheme.label}
                  description="Rename the theme if needed, then expand the supporting material below."
                  className="mt-4"
                />

                <div className="mt-5">
                  <label className="text-sm font-semibold text-foreground">Theme name</label>
                  <Input
                    value={selectedTheme.label}
                    onChange={(event) =>
                      void renameTheme(selectedTheme.id, event.target.value)
                    }
                    className="mt-2"
                  />
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                  <MetricCard label="Count" value={selectedTheme.count} />
                  <MetricCard label="Share" value={formatPercent(selectedTheme.share)} />
                  <MetricCard
                    label="Confidence"
                    value={formatConfidence(selectedTheme.confidence)}
                  />
                </div>
              </SurfaceCard>

              <CollapsiblePanel
                title="Representative quotes"
                description="A quick read on how this theme sounds in the source material."
              >
                <div className="space-y-3">
                  {selectedTheme.sampleQuotes.map((quote) => (
                    <blockquote
                      key={quote}
                      className="rounded-2xl bg-white px-4 py-4 text-sm leading-6 text-foreground"
                    >
                      “{quote}”
                    </blockquote>
                  ))}
                </div>
              </CollapsiblePanel>

              <CollapsiblePanel
                title="Underlying evidence"
                description="Row-level support for validating whether this theme belongs in the final story."
                defaultOpen
              >
                <ScrollArea className="max-h-[560px] pr-1">
                  <div className="space-y-3">
                    {selectedThemeRows.slice(0, 40).map((row) => (
                      <article
                        key={row.id}
                        className="rounded-2xl border border-[rgba(24,36,40,0.08)] bg-white px-4 py-4"
                      >
                        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          <Badge variant="outline">Row {row.rowNumber}</Badge>
                          <Badge variant="outline">{row.sentiment}</Badge>
                          {Object.entries(row.metadata).map(([key, value]) => (
                            <Badge
                              key={`${row.id}-${key}`}
                              variant="outline"
                              className="bg-[rgba(242,239,230,0.9)]"
                            >
                              {key}: {value}
                            </Badge>
                          ))}
                        </div>
                        <p className="mt-3 text-sm leading-7 text-foreground">{row.text}</p>
                      </article>
                    ))}
                  </div>
                </ScrollArea>
              </CollapsiblePanel>
            </>
          ) : (
            <EmptyState
              title="Choose a theme"
              description="Select a theme row to inspect its evidence, rename it, or decide whether it belongs in the report."
            />
          )}
        </div>
      </section>
    </>
  );
}
