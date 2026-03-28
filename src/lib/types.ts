export type RowSentiment = "positive" | "neutral" | "negative";
export type RowAssignmentType =
  | "clustered"
  | "unclustered"
  | "excluded_short"
  | "excluded_taglike";
export type ThemeSource = "model" | "fallback" | "system";
export type ThemeKind = "cluster" | "unclustered";

export interface ParsedWorkbookRow {
  rowNumber: number;
  values: Record<string, string>;
}

export interface ParsedWorkbook {
  fileName: string;
  sheetName: string;
  totalRows: number;
  columns: string[];
  rows: ParsedWorkbookRow[];
}

export interface ColumnCandidate {
  name: string;
  score: number;
  reasons: string[];
  sample: string;
}

export interface DatasetPreview {
  fileName: string;
  sheetName: string;
  totalRows: number;
  nonEmptyRows: number;
  columns: string[];
  candidateTextColumns: ColumnCandidate[];
  suggestedTextColumn: string | null;
  suggestedMetadataColumns: string[];
  sampleRows: ParsedWorkbookRow[];
  languageHint: string;
  validationNotes: string[];
}

export interface AnalysisPayloadRow {
  id: string;
  rowNumber: number;
  text: string;
  metadata: Record<string, string>;
}

export interface AnalysisRequestPayload {
  fileName: string;
  sheetName: string;
  totalRows: number;
  textColumn: string;
  metadataColumns: string[];
  languageHint: string;
  rows: AnalysisPayloadRow[];
}

export interface EvidenceRow {
  id: string;
  rowNumber: number;
  text: string;
  metadata: Record<string, string>;
  sentiment: RowSentiment;
  themeId: string | null;
  assignmentType: RowAssignmentType;
  assignmentConfidence: number | null;
}

export interface SentimentBreakdown {
  positive: number;
  neutral: number;
  negative: number;
}

export interface ThemeDiagnostics {
  uniqueCommentCount: number;
  lowConfidenceRowCount: number;
}

export interface ThemeInsight {
  id: string;
  kind: ThemeKind;
  label: string;
  generatedLabel: string;
  description: string;
  keywords: string[];
  count: number;
  share: number;
  confidence: number | null;
  sampleQuotes: string[];
  sentimentBreakdown: SentimentBreakdown;
  rowIds: string[];
  source: ThemeSource;
  diagnostics: ThemeDiagnostics;
}

export interface ReportOutline {
  headline: string;
  overview: string;
  takeaways: string[];
}

export interface AnalysisDiagnostics {
  clusteringMethod: string;
  embeddingModel: string;
  labelingModel: string | null;
  usedFallbackClustering: boolean;
  clusterCount: number;
  clusteredRows: number;
  unclusteredRows: number;
  excludedShortRows: number;
  excludedTagLikeRows: number;
  lowConfidenceRows: number;
  noiseRatio: number;
  averageThemeConfidence: number | null;
  reassignedNoiseRows: number;
}

export interface AnalysisSummary {
  fileName: string;
  sheetName: string;
  totalRows: number;
  usableRows: number;
  analyzedRows: number;
  uniqueRows: number;
  removedEmptyRows: number;
  duplicateRows: number;
  sampledOutRows: number;
  textColumn: string;
  metadataColumns: string[];
  languageHint: string;
  engine: string;
  notes: string[];
  diagnostics: AnalysisDiagnostics;
}

export interface AnalysisResponse {
  summary: AnalysisSummary;
  themes: ThemeInsight[];
  rows: EvidenceRow[];
  metadataValueCounts: Record<string, Array<{ value: string; count: number }>>;
  report: ReportOutline;
  generatedAt: string;
}

export interface EditableTheme extends ThemeInsight {
  hidden: boolean;
}

export type WorkflowStep = "upload" | "inspect" | "insights" | "report";

export interface SessionHistoryEntry {
  id: string;
  fileName: string;
  headline: string;
  topThemeLabel: string | null;
  analyzedRows: number;
  updatedAt: string;
}

export interface WorkspaceSnapshot {
  id: string;
  step: WorkflowStep;
  fileName: string | null;
  preview: DatasetPreview | null;
  analysis: AnalysisResponse | null;
  themes: EditableTheme[];
  textColumn: string;
  metadataColumns: string[];
  selectedThemeId: string | null;
  updatedAt: string | null;
}

export interface WorkspaceSessionPayload {
  workspace: WorkspaceSnapshot;
  history: SessionHistoryEntry[];
}
