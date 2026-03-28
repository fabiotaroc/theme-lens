"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  FileUp,
  FolderClock,
  Search,
  Share2,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useWorkspace } from "@/components/workspace-provider";
import {
  CollapsiblePanel,
  Eyebrow,
  MetricCard,
  StrongSurfaceCard,
  SurfaceCard,
} from "@/components/workspace-ui";
import { formatPercent } from "@/lib/workspace-presenters";

const navItems = [
  {
    href: "/app/upload",
    label: "Upload",
    description: "Bring in a dataset",
    icon: FileUp,
  },
  {
    href: "/app/inspect",
    label: "Inspect",
    description: "Confirm columns",
    icon: Search,
  },
  {
    href: "/app/insights",
    label: "Insights",
    description: "Review findings",
    icon: BarChart3,
  },
  {
    href: "/app/report",
    label: "Report",
    description: "Share the story",
    icon: Share2,
  },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { history, workspace } = useWorkspace();
  const topTheme =
    workspace.themes.find((theme) => !theme.hidden && theme.kind === "cluster") ?? null;

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[1440px] gap-8 px-4 py-4 sm:px-6 lg:px-8">
      <aside className="hidden w-80 shrink-0 flex-col gap-5 xl:flex">
        <StrongSurfaceCard className="bg-[radial-gradient(circle_at_top_right,rgba(145,219,208,0.16),transparent_34%),radial-gradient(circle_at_bottom_left,rgba(255,227,168,0.18),transparent_28%),linear-gradient(180deg,rgba(255,255,255,0.97),rgba(248,244,236,0.94))] p-6">
          <Link href="/" className="inline-flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,var(--accent),var(--accent-strong))] text-sm font-semibold text-white shadow-[0_16px_30px_rgba(19,114,110,0.28)]">
              TL
            </span>
            <div>
              <p className="text-sm font-semibold text-foreground">ThemeLens</p>
              <p className="text-sm text-foreground/72">Qualitative insight workspace</p>
            </div>
          </Link>

          <div className="mt-8 space-y-2">
            {navItems.map((item) => {
              const active = pathname === item.href;
              const Icon = item.icon;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`group flex items-center gap-4 rounded-2xl px-4 py-4 transition ${
                    active
                      ? "bg-[rgba(16,98,95,0.1)] text-foreground shadow-[inset_0_0_0_1px_rgba(16,98,95,0.16)]"
                      : "text-foreground/82 hover:bg-[rgba(24,36,40,0.04)] hover:text-foreground"
                  }`}
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-(--accent-strong) shadow-[0_12px_24px_rgba(15,25,28,0.08)]">
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold">{item.label}</span>
                    <span
                      className={`block text-sm ${
                        active
                          ? "text-foreground/72"
                          : "text-foreground/62 group-hover:text-foreground/74"
                      }`}
                    >
                      {item.description}
                    </span>
                  </span>
                </Link>
              );
            })}
          </div>
        </StrongSurfaceCard>

        <SurfaceCard>
          <Eyebrow>Current workspace</Eyebrow>
          <h2 className="mt-3 text-xl font-semibold text-foreground">
            {workspace.fileName ?? "No dataset selected"}
          </h2>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <MetricCard label="Stage" value={workspace.step} valueClassName="capitalize" />
            <MetricCard label="Themes" value={workspace.themes.length} />
            <MetricCard
              label="Rows analyzed"
              value={workspace.analysis?.summary.analyzedRows ?? 0}
            />
            <MetricCard label="Lead signal" value={topTheme ? formatPercent(topTheme.share) : "n/a"} />
          </div>
          {topTheme ? (
            <div className="mt-5 rounded-2xl bg-[rgba(16,98,95,0.08)] px-4 py-4 text-sm leading-6 text-foreground">
              <p className="font-semibold">{topTheme.label}</p>
              <p className="mt-1 text-muted-foreground">{topTheme.description}</p>
            </div>
          ) : (
            <div className="mt-5 rounded-2xl border border-dashed border-[rgba(24,36,40,0.12)] px-4 py-4 text-sm leading-6 text-muted-foreground">
              Upload a dataset to generate a working insight summary.
            </div>
          )}
        </SurfaceCard>

        <CollapsiblePanel
          eyebrow="Recent sessions"
          title="Past workspaces"
          description="Older runs stay tucked away until you need them."
          defaultOpen={history.length > 0}
        >
          <div className="space-y-3">
            {history.length > 0 ? (
              history.map((entry) => (
                <div
                  key={entry.id}
                  className="rounded-2xl border border-[rgba(24,36,40,0.08)] bg-white/72 px-4 py-4"
                >
                  <div className="flex items-center gap-2">
                    <FolderClock className="h-4 w-4 text-(--accent-strong)" />
                    <p className="text-sm font-semibold text-foreground">{entry.fileName}</p>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">{entry.headline}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Badge variant="outline">{entry.analyzedRows} rows</Badge>
                    {entry.topThemeLabel ? (
                      <Badge variant="outline">{entry.topThemeLabel}</Badge>
                    ) : null}
                  </div>
                </div>
              ))
            ) : (
              <p className="rounded-2xl border border-dashed border-[rgba(24,36,40,0.12)] px-4 py-4 text-sm leading-6 text-muted-foreground">
                Completed analyses will appear here for quick recall across the app.
              </p>
            )}
          </div>
        </CollapsiblePanel>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col gap-6">
        <div className="rounded-[28px] border-b border-(--line-strong) px-1 py-4 xl:hidden">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <Link href="/" className="inline-flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,var(--accent),var(--accent-strong))] text-sm font-semibold text-white">
                TL
              </span>
              <div>
                <p className="text-sm font-semibold text-foreground">ThemeLens</p>
                <p className="text-xs text-muted-foreground">
                  {workspace.fileName ?? "No active dataset"}
                </p>
              </div>
            </Link>
            <div className="flex flex-wrap gap-2">
              {navItems.map((item) => {
                const active = pathname === item.href;
                return (
                  <Button key={item.href} asChild variant={active ? "default" : "secondary"} size="sm">
                    <Link href={item.href}>{item.label}</Link>
                  </Button>
                );
              })}
            </div>
          </div>
        </div>

        {children}
      </div>
    </div>
  );
}
