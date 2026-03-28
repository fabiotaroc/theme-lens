import {
  NEGATIVE_CUES,
  POSITIVE_CUES,
} from "@/lib/stopwords";
import type {
  AnalysisRequestPayload,
  AnalysisResponse,
  ParsedWorkbook,
  RowSentiment,
} from "@/lib/types";

function cleanText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function classifySentiment(text: string): RowSentiment {
  const lowerText = text.toLowerCase();
  let score = 0;

  for (const cue of POSITIVE_CUES) {
    if (lowerText.includes(cue)) score += 1;
  }

  for (const cue of NEGATIVE_CUES) {
    if (lowerText.includes(cue)) score -= 1;
  }

  if (score > 0) return "positive";
  if (score < 0) return "negative";
  return "neutral";
}

export function buildAnalysisPayload(
  parsedWorkbook: ParsedWorkbook,
  textColumn: string,
  metadataColumns: string[],
  languageHint: string,
): AnalysisRequestPayload {
  return {
    fileName: parsedWorkbook.fileName,
    sheetName: parsedWorkbook.sheetName,
    totalRows: parsedWorkbook.totalRows,
    textColumn,
    metadataColumns,
    languageHint,
    rows: parsedWorkbook.rows.map((row) => ({
      id: `row-${row.rowNumber}`,
      rowNumber: row.rowNumber,
      text: cleanText(row.values[textColumn] ?? ""),
      metadata: Object.fromEntries(
        metadataColumns
          .map((column) => [column, cleanText(row.values[column] ?? "")] as const)
          .filter(([, value]) => value.length > 0),
      ),
    })),
  };
}

export async function requestPythonAnalysis(
  serviceUrl: string,
  payload: AnalysisRequestPayload,
): Promise<AnalysisResponse> {
  const response = await fetch(serviceUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
    cache: "no-store",
  });

  const data = (await response.json()) as AnalysisResponse & {
    error?: string;
    detail?: string;
  };

  if (!response.ok) {
    throw new Error(data.error ?? data.detail ?? "Python analysis request failed.");
  }

  return {
    ...data,
    rows: data.rows.map((row) => ({
      ...row,
      sentiment: row.sentiment ?? classifySentiment(row.text),
    })),
  };
}
