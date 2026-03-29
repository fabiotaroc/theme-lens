"use client";

import { type ReactNode, useState } from "react";
import { AlertCircle, ChevronDown, Info, LoaderCircle } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { SentimentBreakdown } from "@/lib/types";
import { cn } from "@/lib/utils";

export function WorkspaceError({ message }: { message: string }) {
  return (
    <Alert variant="destructive">
      <AlertCircle className="mt-0.5" />
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  );
}

export function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <Card className="border-dashed bg-white/48 shadow-none">
      <CardContent className="px-6 py-8 text-sm leading-7 text-muted-foreground">
        <p className="text-base font-semibold text-foreground">{title}</p>
        <p className="mt-2">{description}</p>
      </CardContent>
    </Card>
  );
}

export function Eyebrow({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <p
      className={cn(
        "text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground",
        className,
      )}
    >
      {children}
    </p>
  );
}

export function SurfaceCard({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return <Card className={cn("p-5 sm:p-6", className)}>{children}</Card>;
}

export function StrongSurfaceCard({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <Card
      className={cn(
        "overflow-hidden rounded-[36px] border-(--line) bg-[radial-gradient(circle_at_top_right,rgba(145,219,208,0.22),transparent_36%),radial-gradient(circle_at_bottom_left,rgba(255,227,168,0.22),transparent_32%),linear-gradient(180deg,rgba(255,255,255,0.92),rgba(250,246,238,0.82))] shadow-[0_28px_80px_rgba(15,25,28,0.1)] backdrop-blur-[18px]",
        className,
      )}
    >
      {children}
    </Card>
  );
}

export function MetricCard({
  label,
  value,
  className,
  valueClassName,
}: {
  label: string;
  value: ReactNode;
  className?: string;
  valueClassName?: string;
}) {
  return (
    <Card className={cn("min-h-[104px] bg-white/58 p-4 shadow-none", className)}>
      <div className="flex h-full flex-col justify-between gap-4">
        <span className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">
          {label}
        </span>
        <span
          className={cn(
            "text-[1.75rem] font-bold leading-tight text-foreground wrap-break-word",
            valueClassName,
          )}
        >
          {value}
        </span>
      </div>
    </Card>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  variant = "default",
  className,
  contentClassName,
  descriptionPlacement = "below",
  descriptionInfoLabel = "More information",
}: {
  eyebrow: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  variant?: "default" | "plain";
  className?: string;
  contentClassName?: string;
  descriptionPlacement?: "below" | "popover";
  descriptionInfoLabel?: string;
}) {
  return (
    <section
      className={cn(
        "relative overflow-hidden rounded-[40px] px-1 py-4 sm:px-2 sm:py-6",
        variant === "plain" && "rounded-none px-0 py-2 sm:px-0 sm:py-3",
        className,
      )}
    >
      {variant === "default" ? (
        <div className="pointer-events-none absolute inset-0 rounded-[40px] bg-[radial-gradient(circle_at_top_right,rgba(145,219,208,0.16),transparent_36%),radial-gradient(circle_at_bottom_left,rgba(255,227,168,0.14),transparent_30%)]" />
      ) : null}
      <div
        className={cn(
          "relative flex flex-wrap items-start justify-between gap-6 border-b border-(--line-strong) pb-8",
          variant === "plain" && "pb-6",
          contentClassName,
        )}
      >
        <div className="max-w-3xl">
          <Eyebrow>{eyebrow}</Eyebrow>
          {descriptionPlacement === "popover" && description ? (
            <div className="mt-4 flex w-full items-start justify-between gap-2 sm:gap-3">
              <h1 className="min-w-0 flex-1 pr-2 font-display text-4xl leading-[0.98] tracking-[-0.04em] text-foreground sm:text-5xl">
                {title}
              </h1>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="mt-1 shrink-0 text-muted-foreground hover:text-foreground"
                    aria-label={descriptionInfoLabel}
                  >
                    <Info className="h-5 w-5" strokeWidth={2} />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="max-w-md" align="start" side="bottom">
                  <p className="text-sm leading-7 text-muted-foreground">{description}</p>
                </PopoverContent>
              </Popover>
            </div>
          ) : (
            <>
              <h1 className="mt-4 max-w-3xl font-display text-4xl leading-[0.98] tracking-[-0.04em] text-foreground sm:text-5xl">
                {title}
              </h1>
              {description ? (
                <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground">
                  {description}
                </p>
              ) : null}
            </>
          )}
        </div>
        {actions ? <div className="flex flex-wrap gap-3">{actions}</div> : null}
      </div>
    </section>
  );
}

export function MainSection({
  className,
  children,
  variant = "default",
}: {
  className?: string;
  children: ReactNode;
  variant?: "default" | "plain" | "card";
}) {
  return (
    <section
      className={cn(
        "relative overflow-hidden rounded-[36px] border-t border-(--line-strong) px-1 py-6 sm:px-2 sm:py-8",
        variant === "plain" &&
          "rounded-none border-t-0 border-b border-(--line-strong) px-0 py-0 sm:px-0 sm:py-0",
        variant === "card" &&
          "rounded-[32px] border border-[rgba(24,36,40,0.12)] bg-[linear-gradient(180deg,rgba(255,255,255,0.92),rgba(252,248,240,0.84))] px-4 py-6 shadow-[0_22px_56px_rgba(15,25,28,0.08)] sm:px-6 sm:py-8",
        className,
      )}
    >
      {variant !== "plain" ? (
        <div
          className={cn(
            "pointer-events-none absolute inset-0 rounded-[36px] bg-[linear-gradient(180deg,rgba(255,255,255,0.24),rgba(255,255,255,0.06))]",
            variant === "card" &&
              "rounded-[32px] bg-[radial-gradient(circle_at_top_right,rgba(145,219,208,0.14),transparent_30%),linear-gradient(180deg,rgba(255,255,255,0.3),rgba(255,255,255,0.08))]",
          )}
        />
      ) : null}
      <div className="relative">{children}</div>
    </section>
  );
}

export function SectionIntro({
  eyebrow,
  title,
  description,
  actions,
  className,
  descriptionPlacement = "below",
  descriptionInfoLabel = "More information",
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
  descriptionPlacement?: "below" | "popover";
  descriptionInfoLabel?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-start justify-between gap-4", className)}>
      <div className="max-w-3xl">
        {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
        {descriptionPlacement === "popover" && description ? (
          <div className="mt-3 flex w-full items-start justify-between gap-2">
            <h2 className="min-w-0 flex-1 pr-2 text-2xl font-semibold text-foreground sm:text-3xl">
              {title}
            </h2>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="mt-0.5 h-9 w-9 shrink-0 text-muted-foreground hover:text-foreground"
                  aria-label={descriptionInfoLabel}
                >
                  <Info className="h-4 w-4" strokeWidth={2} />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="max-w-md" align="start" side="bottom">
                <p className="text-sm leading-7 text-muted-foreground">{description}</p>
              </PopoverContent>
            </Popover>
          </div>
        ) : (
          <>
            <h2 className="mt-3 text-2xl font-semibold text-foreground sm:text-3xl">{title}</h2>
            {description ? (
              <p className="mt-3 max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base">
                {description}
              </p>
            ) : null}
          </>
        )}
      </div>
      {actions ? <div className="flex flex-wrap gap-3">{actions}</div> : null}
    </div>
  );
}

export function CollapsiblePanel({
  eyebrow,
  title,
  description,
  defaultOpen = false,
  children,
  className,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  defaultOpen?: boolean;
  children: ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <SurfaceCard className={className}>
      <div className="flex items-start justify-between gap-4">
        <div className="max-w-2xl">
          {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
          <h3 className="mt-3 text-xl font-semibold text-foreground">{title}</h3>
          {description ? (
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => setOpen((current) => !current)}
          className="inline-flex items-center gap-2 rounded-full border border-(--line-strong) bg-white/72 px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground hover:text-foreground"
        >
          {open ? "Hide" : "Show"}
          <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} />
        </button>
      </div>
      {open ? <div className="mt-5">{children}</div> : null}
    </SurfaceCard>
  );
}

export function BusyLabel({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <LoaderCircle className="h-4 w-4 animate-spin" />
      {label}
    </span>
  );
}

export function SentimentMeter({ breakdown }: { breakdown: SentimentBreakdown }) {
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
      <div className="flex flex-wrap gap-2">
        <Badge variant="outline">Positive {breakdown.positive}</Badge>
        <Badge variant="outline">Neutral {breakdown.neutral}</Badge>
        <Badge variant="outline">Negative {breakdown.negative}</Badge>
      </div>
    </div>
  );
}
