"use client";

import Link from "next/link";
import { Download, Layers3, Share2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useWorkspace } from "@/components/workspace-provider";
import {
  CollapsiblePanel,
  EmptyState,
  MainSection,
  MetricCard,
  PageHeader,
  SectionIntro,
  SurfaceCard,
  WorkspaceError,
} from "@/components/workspace-ui";
import { downloadReport } from "@/lib/report-download";
import {
  buildReportSnapshot,
  formatConfidence,
  formatPercent,
} from "@/lib/workspace-presenters";

export function ReportWorkspacePage() {
  const { error, workspace } = useWorkspace();
  const analysis = workspace.analysis;

  if (!analysis) {
    return (
      <>
        <PageHeader
          eyebrow="Report"
          title="Package the story for sharing."
          description="The report view turns the current workspace into a concise, presentation-ready output that preserves the headline, the strongest themes, and the supporting evidence."
          descriptionPlacement="popover"
          descriptionInfoLabel="What the report view includes"
        />
        <EmptyState
          title="No report is available yet"
          description="Run an analysis first. The report page will then summarize the narrative and let you export a lightweight HTML report."
        />
      </>
    );
  }

  const snapshot = buildReportSnapshot(analysis, workspace.themes);

  return (
    <>
      <PageHeader
        eyebrow="Report"
        title="Prepare a crisp share-out."
        description="This page is organized like a lightweight executive report: headline and takeaways first, theme coverage next, and evidence support last."
        actions={
          <>
            <Button asChild variant="secondary">
              <Link href="/app/insights">Return to insights</Link>
            </Button>
            <Button
              type="button"
              onClick={() => downloadReport(analysis, workspace.themes, analysis.rows)}
            >
              <Download className="h-4 w-4" />
              Download HTML report
            </Button>
          </>
        }
      />

      {error ? <WorkspaceError message={error} /> : null}

      <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <MainSection className="px-1 sm:px-2">
          <div className="flex items-center gap-2">
            <Share2 className="h-4 w-4 text-(--accent-strong)" />
            <span className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">
              Executive summary
            </span>
          </div>
          <SectionIntro
            title={snapshot.headline}
            description={snapshot.overview}
            className="mt-4"
          />

          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            <MetricCard
              label="Dataset"
              value={analysis.summary.fileName}
              valueClassName="text-base"
            />
            <MetricCard label="Rows analyzed" value={analysis.summary.analyzedRows} />
            <MetricCard label="Visible themes" value={snapshot.visibleThemes.length} />
          </div>
        </MainSection>

        <SurfaceCard>
          <div className="flex items-center gap-2">
            <Layers3 className="h-4 w-4 text-(--accent-strong)" />
            <span className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">
              Takeaways
            </span>
          </div>
          <div className="mt-4 space-y-3">
            {snapshot.takeaways.map((item) => (
              <p
                key={item}
                className="rounded-2xl border border-[rgba(24,36,40,0.08)] bg-white/80 px-4 py-4 text-sm leading-7 text-foreground"
              >
                {item}
              </p>
            ))}
          </div>
        </SurfaceCard>
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.98fr_1.02fr]">
        <MainSection className="px-1 sm:px-2">
          <SectionIntro
            eyebrow="High-level insights"
            title="What should make the final cut"
            description="The main narrative belongs out in the open here. Theme cards are kept light so the page reads like a report, not a dashboard of containers."
          />
          <div className="mt-5 space-y-4">
            {snapshot.topThemes.map((theme) => (
              <div
                key={theme.id}
                className="rounded-[24px] border border-[rgba(24,36,40,0.08)] bg-white/54 p-5"
              >
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-xl font-semibold text-foreground">{theme.label}</h3>
                  <span className="text-sm font-semibold text-foreground">
                    {formatPercent(theme.share)}
                  </span>
                </div>
                <p className="mt-3 text-sm leading-7 text-muted-foreground">
                  {theme.description}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Badge variant="outline">{theme.count} rows</Badge>
                  <Badge variant="outline">
                    confidence {formatConfidence(theme.confidence)}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </MainSection>

        <div className="space-y-6">
          <CollapsiblePanel
            eyebrow="Cluster-level insights"
            title="Full visible theme list"
            description="Keep the long tail hidden by default when sharing the report view."
          >
            <div className="grid gap-3 sm:grid-cols-2">
              {snapshot.visibleThemes.map((theme) => (
                <div
                  key={theme.id}
                  className="rounded-2xl border border-[rgba(24,36,40,0.08)] bg-white/85 px-4 py-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-foreground">{theme.label}</p>
                    <Badge variant="outline" className="uppercase">
                      {theme.kind}
                    </Badge>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    {theme.description}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Badge variant="outline">{theme.count} rows</Badge>
                    <Badge variant="outline">share {formatPercent(theme.share)}</Badge>
                    <Badge variant="outline">
                      confidence {formatConfidence(theme.confidence)}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CollapsiblePanel>

          {Object.keys(analysis.metadataValueCounts).length > 0 ? (
            <CollapsiblePanel
              eyebrow="Metadata overview"
              title="Segment counts"
              description="Helpful for context, but secondary to the report story."
            >
              <div className="space-y-3">
                {Object.entries(analysis.metadataValueCounts).map(([column, items]) => (
                  <div
                    key={column}
                    className="rounded-2xl border border-[rgba(24,36,40,0.08)] bg-white/80 px-4 py-4"
                  >
                    <p className="text-sm font-semibold text-foreground">{column}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {items.map((item) => (
                        <Badge key={`${column}-${item.value}`} variant="outline">
                          {item.value}: {item.count}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </CollapsiblePanel>
          ) : null}
        </div>
      </section>
    </>
  );
}
