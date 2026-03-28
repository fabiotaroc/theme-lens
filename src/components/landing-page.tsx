import Link from "next/link";
import { ArrowRight, FolderSearch2, LayoutDashboard, Share2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Eyebrow,
  MainSection,
  SectionIntro,
  StrongSurfaceCard,
} from "@/components/workspace-ui";

const workflowCards = [
  {
    title: "Upload",
    description: "Bring in raw feedback exports from surveys, interviews, or support channels.",
    icon: FolderSearch2,
  },
  {
    title: "Inspect",
    description: "Confirm the text field and supporting metadata before running analysis.",
    icon: LayoutDashboard,
  },
  {
    title: "Share",
    description: "Turn the strongest signals into a clean report view and downloadable export.",
    icon: Share2,
  },
];

export function LandingPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-[1440px] flex-col gap-8 px-4 py-4 sm:px-6 lg:px-8">
      <StrongSurfaceCard className="relative px-6 py-10 sm:px-10 sm:py-14">
        <div className="absolute inset-y-0 right-0 hidden w-lg bg-[radial-gradient(circle_at_center,rgba(127,208,198,0.34),transparent_68%)] lg:block" />
        <div className="relative grid gap-10 lg:grid-cols-[1.08fr_0.92fr] lg:items-end">
          <div className="max-w-4xl">
            <Eyebrow>ThemeLens</Eyebrow>
            <h1 className="mt-5 max-w-4xl font-display text-5xl leading-[0.92] tracking-[-0.05em] text-foreground sm:text-6xl lg:text-7xl">
              Turn raw qualitative feedback into a decision-ready insight dashboard.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-muted-foreground">
              ThemeLens gives research and product teams a faster path from spreadsheet
              exports to structured findings, editable theme clusters, and polished
              reports that are ready to share.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild>
                <Link href="/app/upload">
                  Open workspace
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="secondary">
                <Link href="/app/insights">View active insights</Link>
              </Button>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
            <div className="rounded-[28px] border border-[rgba(24,36,40,0.08)] bg-white/88 p-5 shadow-[0_22px_48px_rgba(15,25,28,0.07)]">
              <p className="text-sm text-muted-foreground">Designed for</p>
              <p className="mt-2 text-xl font-semibold text-foreground">Research, CX, and product teams</p>
            </div>
            <div className="rounded-[28px] border border-[rgba(24,36,40,0.08)] bg-white/88 p-5 shadow-[0_22px_48px_rgba(15,25,28,0.07)]">
              <p className="text-sm text-muted-foreground">Core workflow</p>
              <p className="mt-2 text-xl font-semibold text-foreground">Upload, inspect, analyze, refine, report</p>
            </div>
            <div className="rounded-[28px] border border-[rgba(24,36,40,0.08)] bg-white/88 p-5 shadow-[0_22px_48px_rgba(15,25,28,0.07)]">
              <p className="text-sm text-muted-foreground">Output</p>
              <p className="mt-2 text-xl font-semibold text-foreground">Evidence-backed themes with exportable summaries</p>
            </div>
          </div>
        </div>
      </StrongSurfaceCard>

      <section className="grid gap-6 lg:grid-cols-3">
        {workflowCards.map((card) => {
          const Icon = card.icon;

          return (
            <div
              key={card.title}
              className="rounded-[28px] border-t border-[rgba(24,36,40,0.12)] px-1 py-5"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-3xl bg-[rgba(16,98,95,0.1)] text-(--accent-strong)">
                <Icon className="h-5 w-5" />
              </div>
              <h2 className="mt-5 text-2xl font-semibold text-foreground">{card.title}</h2>
              <p className="mt-3 text-sm leading-7 text-muted-foreground">{card.description}</p>
            </div>
          );
        })}
      </section>

      <MainSection className="lg:grid lg:grid-cols-[1.05fr_0.95fr] lg:gap-6">
        <SectionIntro
          eyebrow="Why it feels different"
          title="A workflow built for reading signal before diving into details."
          description="ThemeLens separates executive summaries from cluster-level evidence so teams can orient quickly, then move into editing and validation without drowning in method detail."
        />
        <div className="grid gap-4">
          {[
            "High-level insight summaries appear before cluster detail.",
            "Theme editing and evidence inspection live in a dedicated workspace.",
            "Technical diagnostics are available when needed without dominating the UI.",
          ].map((item) => (
            <div
              key={item}
              className="rounded-2xl border border-[rgba(24,36,40,0.08)] bg-white/56 px-4 py-4 text-sm leading-7 text-foreground"
            >
              {item}
            </div>
          ))}
        </div>
      </MainSection>
    </main>
  );
}
