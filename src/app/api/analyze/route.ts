import {
  buildAnalysisPayload,
  requestPythonAnalysis,
} from "@/lib/analysis-client";
import { buildPreview, parseSpreadsheet, validateUpload } from "@/lib/dataset";

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

    if (!(file instanceof File)) {
      return Response.json(
        { error: "Upload a CSV or Excel file to continue." },
        { status: 400 },
      );
    }

    validateUpload(file);
    const parsedWorkbook = await parseSpreadsheet(file);
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
    const result = await requestPythonAnalysis(
      resolvePythonAnalysisUrl(request),
      payload,
    );

    return Response.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Analysis failed for this dataset.";
    return Response.json({ error: message }, { status: 400 });
  }
}
