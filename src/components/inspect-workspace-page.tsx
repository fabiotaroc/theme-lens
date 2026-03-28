"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { Sparkles } from "lucide-react";

import { cn } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useWorkspace } from "@/components/workspace-provider";
import {
  BusyLabel,
  EmptyState,
  MainSection,
  MetricCard,
  PageHeader,
  SectionIntro,
  WorkspaceError,
} from "@/components/workspace-ui";

export function InspectWorkspacePage() {
  const router = useRouter();
  const { busyAction, error, patchWorkspace, runAnalysis, workspace } = useWorkspace();
  const preview = workspace.preview;

  const visibleColumns = useMemo(() => {
    if (!preview) return [];
    const sheetOrder = preview.columns;
    const text = workspace.textColumn?.trim();
    const meta = new Set(workspace.metadataColumns);
    const out: string[] = [];
    if (text && sheetOrder.includes(text)) out.push(text);
    for (const c of sheetOrder) {
      if (c !== text && meta.has(c)) out.push(c);
    }
    return out;
  }, [preview, workspace.textColumn, workspace.metadataColumns]);

  async function handleAnalyze() {
    await runAnalysis();
    router.push("/app/insights");
  }

  if (!preview) {
    return (
      <>
        <PageHeader
          eyebrow="Inspect"
          title="Confirm the structure before analysis."
          description="Choose the feedback column, keep the metadata that helps later filtering, and verify that the sample rows look right."
          descriptionPlacement="popover"
          descriptionInfoLabel="What to do on this page"
        />
        <EmptyState
          title="No file has been inspected yet"
          description="Start on the upload page, inspect the workbook, and then return here to confirm the structure."
        />
      </>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="Inspect"
        title="Confirm what ThemeLens should read."
        description="ThemeLens has already profiled the workbook. Pick the primary text column, keep the metadata fields that help evidence review, and launch the analysis when the structure looks right."
        descriptionPlacement="popover"
        descriptionInfoLabel="What to confirm before analysis"
        variant="plain"
        actions={
          <Button asChild variant="secondary">
            <Link href="/app/upload">Replace dataset</Link>
          </Button>
        }
      />

      {error ? <WorkspaceError message={error} /> : null}

      <div className="space-y-8">
        <MainSection variant="plain" className="border-b-0 pb-8">
          <div className="space-y-8">
            <div>
              <SectionIntro
                eyebrow="Dataset summary"
                title={preview.fileName}
                description="Confirm the core shape of the file first, then tell ThemeLens which column is the primary feedback source and which fields should stay available as context later."
                descriptionPlacement="popover"
                descriptionInfoLabel="How to use the dataset summary"
              />
              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <MetricCard label="Rows" value={preview.totalRows} />
                <MetricCard label="Sheet" value={preview.sheetName} />
                <MetricCard label="Language hint" value={preview.languageHint} />
              </div>
            </div>

            <div className="space-y-5">
              <div>
                <label className="text-sm font-semibold text-foreground">
                  Primary text column
                </label>
                <Select
                  value={workspace.textColumn}
                  onValueChange={(value) => void patchWorkspace({ textColumn: value })}
                >
                  <SelectTrigger className="mt-2">
                    <SelectValue placeholder="Select a text column" />
                  </SelectTrigger>
                  <SelectContent>
                    {preview.columns.map((column) => (
                      <SelectItem key={column} value={column}>
                        {column}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <label className="text-sm font-semibold text-foreground">
                    Supporting metadata (optional)
                  </label>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {preview.columns
                    .filter((column) => column !== workspace.textColumn)
                    .map((column) => {
                      const active = workspace.metadataColumns.includes(column);

                      return (
                        <Button
                          key={column}
                          type="button"
                          className="shadow-none hover:translate-y-0"
                          onClick={() =>
                            void patchWorkspace({
                              metadataColumns: active
                                ? workspace.metadataColumns.filter(
                                    (value) => value !== column,
                                  )
                                : [...workspace.metadataColumns, column],
                            })
                          }
                          variant={active ? "default" : "outline"}
                          size="sm"
                        >
                          {column}
                        </Button>
                      );
                    })}
                </div>
              </div>
            </div>
          </div>
        </MainSection>

        <MainSection variant="plain" className="mt-2 border-b-0 pt-2">
          <SectionIntro
            eyebrow="Sample rows"
            title="Check what the analysis will actually read"
            description="The table shows only your primary text column and selected metadata, in sheet order. The primary column is highlighted."
            descriptionPlacement="popover"
            descriptionInfoLabel="How the sample table works"
          />
          <div className="mt-6 overflow-hidden rounded-[24px] border border-[rgba(24,36,40,0.12)] bg-white/88 shadow-[inset_0_1px_0_rgba(255,255,255,0.55)]">
            <ScrollArea className="max-h-[460px] bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(250,246,238,0.88))]">
              <Table>
                <TableHeader className="sticky top-0 z-10 bg-[rgba(244,240,231,0.96)] backdrop-blur">
                  <TableRow>
                    <TableHead className="w-14">Row</TableHead>
                    {visibleColumns.length === 0 ? (
                      <TableHead className="text-muted-foreground">
                        No columns selected
                      </TableHead>
                    ) : (
                      visibleColumns.map((column) => {
                        const isPrimary = column === workspace.textColumn;
                        return (
                          <TableHead
                            key={column}
                            className={cn(
                              "min-w-28 max-w-[20rem]",
                              isPrimary &&
                                "border-l-2 border-l-(--accent-strong) bg-[rgba(16,98,95,0.1)] text-(--accent-strong)",
                            )}
                          >
                            <span className="block truncate font-semibold" title={column}>
                              {column}
                            </span>
                            {isPrimary ? (
                              <span className="mt-0.5 block text-[10px] font-semibold uppercase tracking-wide text-(--accent-strong)/85">
                                Primary text
                              </span>
                            ) : null}
                          </TableHead>
                        );
                      })
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibleColumns.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={2}
                        className="py-10 text-center text-sm text-muted-foreground"
                      >
                        Choose a primary text column and/or toggle supporting metadata above to
                        preview those fields here.
                      </TableCell>
                    </TableRow>
                  ) : (
                    preview.sampleRows.map((row) => (
                      <TableRow key={row.rowNumber}>
                        <TableCell className="text-muted-foreground">{row.rowNumber}</TableCell>
                        {visibleColumns.map((column) => {
                          const isPrimary = column === workspace.textColumn;
                          return (
                            <TableCell
                              key={`${row.rowNumber}-${column}`}
                              className={cn(
                                "align-top",
                                isPrimary &&
                                  "border-l-2 border-l-(--accent-strong) bg-[rgba(16,98,95,0.06)]",
                              )}
                            >
                              {row.values[column] || "—"}
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </ScrollArea>
          </div>
        </MainSection>

        <div className="flex flex-col items-center justify-end gap-4 pt-4 sm:flex-row">
          <Button asChild variant="secondary" size="lg" className="w-full sm:w-auto">
            <Link href="/app/upload">Back to upload</Link>
          </Button>
          <Button
            type="button"
            onClick={handleAnalyze}
            disabled={!workspace.textColumn || busyAction !== null}
            size="lg"
            className="w-full sm:w-auto"
          >
            {busyAction === "analysis" ? (
              <BusyLabel label="Generating insights" />
            ) : (
              <>
                Generate insights
                <Sparkles className="h-5 w-5" />
              </>
            )}
          </Button>
        </div>
      </div>
    </>
  );
}
