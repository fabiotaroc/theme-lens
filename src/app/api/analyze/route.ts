import {
  buildAnalysisPayload,
  requestPythonAnalysis,
} from "@/lib/analysis-client";
import { buildPreview, parseSpreadsheet, validateUpload } from "@/lib/dataset";
import {
  getParsedWorkbookForCurrentSession,
  storeAnalysisSession,
} from "@/lib/session-store";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

function resolvePythonAnalysisUrl(request: Request) {
  const configuredUrl = process.env.PYTHON_ANALYZE_URL?.trim();
  if (configuredUrl) return configuredUrl;
  if (process.env.NODE_ENV === "development") {
    return "http://127.0.0.1:8000/api/python_analyze";
  }
  return new URL("/api/python_analyze", request.url).toString();
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const textColumn = String(formData.get("textColumn") ?? "").trim();
    const metadataColumns = JSON.parse(
      String(formData.get("metadataColumns") ?? "[]"),
    ) as string[];

    let parsedWorkbook = await getParsedWorkbookForCurrentSession();

    if (file instanceof File) {
      validateUpload(file);
      parsedWorkbook = await parseSpreadsheet(file);
    }

    if (!parsedWorkbook) {
      return NextResponse.json(
        { error: "Upload and inspect a CSV or Excel file before running analysis." },
        { status: 400 },
      );
    }

    const preview = buildPreview(parsedWorkbook);

    const finalTextColumn =
      textColumn || preview.suggestedTextColumn || preview.columns[0];

    if (!finalTextColumn) {
      return Response.json(
        { error: "ThemeLens could not find a usable text column." },
        { status: 400 },
      );
    }

    const filteredMetadataColumns = metadataColumns.filter((column) =>
      preview.columns.includes(column),
    );

    const payload = buildAnalysisPayload(
      parsedWorkbook,
      finalTextColumn,
      filteredMetadataColumns,
      preview.languageHint,
    );
    console.info("[theme-lens][analyze-route] Starting analysis request", {
      fileName: payload.fileName,
      sheetName: payload.sheetName,
      totalRows: payload.totalRows,
      textColumn: payload.textColumn,
      metadataColumnCount: payload.metadataColumns.length,
    });
    const result = await requestPythonAnalysis(
      resolvePythonAnalysisUrl(request),
      payload,
    );
    console.info("[theme-lens][analyze-route] Analysis request completed", {
      themeCount: result.themes.length,
      analyzedRows: result.summary.analyzedRows,
      clusteringMethod: result.summary.diagnostics.clusteringMethod,
    });

    return NextResponse.json(
      await storeAnalysisSession({
        analysis: result,
        textColumn: finalTextColumn,
        metadataColumns: filteredMetadataColumns,
      }),
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Analysis failed for this dataset.";
    console.error("[theme-lens][analyze-route] Analysis request failed", {
      error: message,
    });
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
