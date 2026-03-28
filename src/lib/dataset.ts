import * as XLSX from "xlsx";

import { LANGUAGE_STOPWORDS } from "@/lib/stopwords";
import type {
  ColumnCandidate,
  DatasetPreview,
  ParsedWorkbook,
  ParsedWorkbookRow,
} from "@/lib/types";

const ACCEPTED_EXTENSIONS = [".csv", ".xlsx", ".xls"];

function normalizeCellValue(value: unknown): string {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function uniqueHeaderName(rawHeader: string, index: number, seen: Set<string>) {
  const base = rawHeader || `Column ${index + 1}`;
  let candidate = base;
  let counter = 2;

  while (seen.has(candidate)) {
    candidate = `${base} (${counter})`;
    counter += 1;
  }

  seen.add(candidate);
  return candidate;
}

export function validateUpload(file: File) {
  const lowerName = file.name.toLowerCase();
  if (!ACCEPTED_EXTENSIONS.some((extension) => lowerName.endsWith(extension))) {
    throw new Error("Upload a CSV or Excel file (.csv, .xlsx, .xls).");
  }

  if (file.size === 0) {
    throw new Error("The uploaded file is empty.");
  }

  if (file.size > 10 * 1024 * 1024) {
    throw new Error("The MVP supports files up to 10 MB.");
  }
}

export async function parseSpreadsheet(file: File): Promise<ParsedWorkbook> {
  validateUpload(file);
  const buffer = Buffer.from(await file.arrayBuffer());
  return parseSpreadsheetBuffer(buffer, file.name);
}

export function parseSpreadsheetBuffer(
  buffer: Buffer,
  fileName: string,
): ParsedWorkbook {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const firstSheet = workbook.SheetNames[0];

  if (!firstSheet) {
    throw new Error("The workbook has no readable sheets.");
  }

  const worksheet = workbook.Sheets[firstSheet];
  const matrix = XLSX.utils.sheet_to_json<Array<string | number | null>>(
    worksheet,
    {
      header: 1,
      raw: false,
      blankrows: false,
    },
  );

  if (matrix.length < 2) {
    throw new Error("The file needs a header row and at least one data row.");
  }

  const headerRow = matrix[0] ?? [];
  const seen = new Set<string>();
  const columns = headerRow.map((cell, index) =>
    uniqueHeaderName(normalizeCellValue(cell), index, seen),
  );

  const rows: ParsedWorkbookRow[] = matrix.slice(1).map((cells, rowIndex) => {
    const values: Record<string, string> = {};

    columns.forEach((column, columnIndex) => {
      values[column] = normalizeCellValue(cells?.[columnIndex] ?? "");
    });

    return {
      rowNumber: rowIndex + 2,
      values,
    };
  });

  return {
    fileName,
    sheetName: firstSheet,
    totalRows: rows.length,
    columns,
    rows,
  };
}

function tokenize(text: string) {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s'-]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function average(values: number[]) {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function scoreTextColumns(rows: ParsedWorkbookRow[], columns: string[]) {
  const rowCount = Math.max(rows.length, 1);
  const candidates: ColumnCandidate[] = [];

  for (const column of columns) {
    const values = rows
      .map((row) => row.values[column])
      .filter((value) => value.length > 0);

    if (values.length === 0) continue;

    const lengths = values.map((value) => value.length);
    const tokens = values.map((value) => tokenize(value));
    const avgWords = average(tokens.map((value) => value.length));
    const avgLength = average(lengths);
    const uniqueRatio =
      new Set(values.map((value) => value.toLowerCase())).size / values.length;
    const alphaRatio = average(
      values.map((value) => {
        const letters = (value.match(/\p{L}/gu) ?? []).length;
        return letters / Math.max(value.length, 1);
      }),
    );
    const numericRatio =
      values.filter((value) => /^[\d\s.,/%-]+$/.test(value)).length /
      values.length;
    const fillRatio = values.length / rowCount;

    const score =
      fillRatio * 2.2 +
      Math.min(avgWords / 10, 2) +
      Math.min(avgLength / 90, 2) +
      uniqueRatio +
      alphaRatio -
      numericRatio * 2.5;

    const reasons = [];

    if (avgWords >= 6) reasons.push("looks like long-form text");
    if (uniqueRatio >= 0.6) reasons.push("high variation across rows");
    if (fillRatio >= 0.7) reasons.push("well-populated column");
    if (numericRatio <= 0.1) reasons.push("mostly non-numeric values");

    candidates.push({
      name: column,
      score,
      reasons,
      sample: values[0]?.slice(0, 140) ?? "",
    });
  }

  return candidates.sort((left, right) => right.score - left.score);
}

export function suggestMetadataColumns(
  rows: ParsedWorkbookRow[],
  columns: string[],
  textColumn: string | null,
) {
  const candidates = columns
    .filter((column) => column !== textColumn)
    .map((column) => {
      const values = rows
        .map((row) => row.values[column])
        .filter((value) => value.length > 0);

      if (values.length === 0) {
        return null;
      }

      const fillRatio = values.length / Math.max(rows.length, 1);
      const uniqueRatio =
        new Set(values.map((value) => value.toLowerCase())).size / values.length;
      const avgLength = average(values.map((value) => value.length));
      const score =
        fillRatio * 2 -
        Math.abs(uniqueRatio - 0.25) * 2 -
        Math.max(avgLength - 36, 0) / 60;

      return {
        name: column,
        fillRatio,
        uniqueRatio,
        avgLength,
        score,
      };
    })
    .filter(
      (
        candidate,
      ): candidate is {
        name: string;
        fillRatio: number;
        uniqueRatio: number;
        avgLength: number;
        score: number;
      } =>
        candidate !== null &&
        candidate.fillRatio >= 0.25 &&
        candidate.uniqueRatio >= 0.02 &&
        candidate.uniqueRatio <= 0.8 &&
        candidate.avgLength <= 48,
    )
    .sort((left, right) => right.score - left.score);

  return candidates.slice(0, 4).map((candidate) => candidate.name);
}

export function detectLanguageHint(texts: string[]) {
  const joined = texts
    .slice(0, 150)
    .join(" ")
    .toLowerCase();
  const tokens = tokenize(joined);
  const tokenSet = new Set(tokens);

  let bestLanguage = "Mixed / unknown";
  let bestScore = 0;

  for (const [language, stopwords] of Object.entries(LANGUAGE_STOPWORDS)) {
    const score = stopwords.reduce(
      (sum, stopword) => sum + Number(tokenSet.has(stopword)),
      0,
    );

    if (score > bestScore) {
      bestScore = score;
      bestLanguage = language;
    }
  }

  return bestScore >= 3 ? bestLanguage : "Mixed / unknown";
}

export function buildPreview(parsedWorkbook: ParsedWorkbook): DatasetPreview {
  const candidateTextColumns = scoreTextColumns(
    parsedWorkbook.rows,
    parsedWorkbook.columns,
  );
  const suggestedTextColumn = candidateTextColumns[0]?.name ?? null;

  const nonEmptyRows = parsedWorkbook.rows.filter((row) =>
    Object.values(row.values).some((value) => value.length > 0),
  ).length;

  const previewTexts = suggestedTextColumn
    ? parsedWorkbook.rows
        .map((row) => row.values[suggestedTextColumn])
        .filter((value) => value.length > 0)
    : [];

  const validationNotes = [
    "Empty rows are dropped before analysis.",
    "Exact duplicate text rows are deduplicated for clustering, then expanded back into counts.",
    "Language handling is heuristic and surfaced as a hint, not a guarantee.",
  ];

  return {
    fileName: parsedWorkbook.fileName,
    sheetName: parsedWorkbook.sheetName,
    totalRows: parsedWorkbook.totalRows,
    nonEmptyRows,
    columns: parsedWorkbook.columns,
    candidateTextColumns,
    suggestedTextColumn,
    suggestedMetadataColumns: suggestMetadataColumns(
      parsedWorkbook.rows,
      parsedWorkbook.columns,
      suggestedTextColumn,
    ),
    sampleRows: parsedWorkbook.rows.slice(0, 6),
    languageHint: detectLanguageHint(previewTexts),
    validationNotes,
  };
}
