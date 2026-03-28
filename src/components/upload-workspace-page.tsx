"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, RefreshCw, UploadCloud } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { useWorkspace } from "@/components/workspace-provider";
import {
  BusyLabel,
  EmptyState,
  MainSection,
  PageHeader,
  SectionIntro,
  SurfaceCard,
  WorkspaceError,
} from "@/components/workspace-ui";

export function UploadWorkspacePage() {
  const router = useRouter();
  const { busyAction, error, inspectFile, resetWorkspace, workspace } = useWorkspace();
  const [file, setFile] = useState<File | null>(null);

  async function handleInspect() {
    if (!file) return;
    await inspectFile(file);
    router.push("/app/inspect");
  }

  return (
    <>
      <PageHeader
        eyebrow="Upload"
        title="Bring a dataset into the workspace."
        description="Start with a CSV or spreadsheet export. ThemeLens prepares a working session so you can inspect the structure, confirm the text field, and move straight into analysis."
        descriptionPlacement="popover"
        descriptionInfoLabel="What happens when you upload"
        actions={
          workspace.preview ? (
            <Button asChild variant="secondary">
              <Link href="/app/inspect">Continue current workspace</Link>
            </Button>
          ) : undefined
        }
      />

      {error ? <WorkspaceError message={error} /> : null}

      <section className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <MainSection className="px-1 sm:px-2">
          <div className="flex items-start gap-4">
            <div className="rounded-3xl bg-[rgba(16,98,95,0.12)] p-4 text-(--accent-strong)">
              <UploadCloud className="h-6 w-6" />
            </div>
            <div>
              <SectionIntro
                eyebrow="Primary action"
                title="Upload your source file"
                description="Accepted formats are `CSV`, `XLSX`, and `XLS`. The uploaded workbook is parsed once and kept in the active session so the rest of the workflow can happen across multiple pages."
                descriptionPlacement="popover"
                descriptionInfoLabel="Supported formats and session behavior"
              />
            </div>
          </div>

          <label className="mt-8 flex cursor-pointer flex-col gap-5 rounded-[28px] border border-dashed border-[rgba(24,36,40,0.18)] bg-[rgba(255,255,255,0.56)] px-6 py-8 transition hover:border-[rgba(24,36,40,0.3)]">
            <div>
              <p className="text-lg font-semibold text-foreground">Choose a file</p>
              <p className="mt-2 text-sm leading-7 text-muted-foreground">
                Pick the raw export you want to inspect. ThemeLens will infer the likely
                feedback column and suggest the metadata fields worth keeping around.
              </p>
            </div>

            <input
              type="file"
              accept=".csv,.xlsx,.xls"
              className="sr-only"
              onChange={(event) => {
                setFile(event.target.files?.[0] ?? null);
              }}
            />

            <div className="flex flex-wrap items-center gap-3">
              <span className="inline-flex h-11 items-center rounded-full bg-[linear-gradient(135deg,var(--accent-strong),var(--accent-deep))] px-5 text-sm font-semibold text-white shadow-[0_16px_28px_rgba(16,98,95,0.22)]">
                {file ? "Replace selected file" : "Browse files"}
              </span>
              <span className="text-sm text-muted-foreground">
                {file ? file.name : "No file selected yet"}
              </span>
            </div>
          </label>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Button
              type="button"
              onClick={handleInspect}
              disabled={!file || busyAction !== null}
            >
              {busyAction === "preview" ? (
                <BusyLabel label="Inspecting file" />
              ) : (
                <>
                  Inspect file
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>

            <Button
              type="button"
              onClick={() => void resetWorkspace()}
              disabled={busyAction !== null}
              variant="secondary"
            >
              <RefreshCw className="h-4 w-4" />
              Reset workspace
            </Button>
          </div>
        </MainSection>

        <div className="space-y-6">
          <SurfaceCard>
            {workspace.preview ? (
              <>
                <SectionIntro
                  eyebrow="Current draft"
                  title={workspace.fileName ?? "Current workspace"}
                  description="A preview is already available for this workspace. Continue to inspect the columns or jump into the results if analysis has already been completed."
                  descriptionPlacement="popover"
                  descriptionInfoLabel="About this workspace draft"
                />
                <div className="mt-5 flex flex-wrap gap-3">
                  <Button asChild variant="secondary">
                    <Link href="/app/inspect">Open inspect page</Link>
                  </Button>
                  {workspace.analysis ? (
                    <Button asChild>
                      <Link href="/app/insights">Open insights</Link>
                    </Button>
                  ) : null}
                </div>
              </>
            ) : (
              <EmptyState
                title="No active dataset"
                description="Upload a file to start a new workspace. Your progress will then follow you through inspect, insights, and report pages."
              />
            )}
          </SurfaceCard>
        </div>
      </section>
    </>
  );
}
