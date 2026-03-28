import "server-only";

import { randomUUID } from "node:crypto";

import { cookies } from "next/headers";

import type {
  AnalysisResponse,
  DatasetPreview,
  EditableTheme,
  ParsedWorkbook,
  SessionHistoryEntry,
  WorkspaceSessionPayload,
  WorkspaceSnapshot,
} from "@/lib/types";

const BROWSER_SESSION_COOKIE = "themelens-browser-session";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

interface StoredWorkspaceSnapshot extends WorkspaceSnapshot {
  parsedWorkbook: ParsedWorkbook | null;
}

interface StoredBrowserSession {
  id: string;
  workspace: StoredWorkspaceSnapshot;
  history: SessionHistoryEntry[];
}

declare global {
  var __themeLensBrowserSessions__: Map<string, StoredBrowserSession> | undefined;
}

const browserSessions =
  globalThis.__themeLensBrowserSessions__ ??
  (globalThis.__themeLensBrowserSessions__ = new Map<string, StoredBrowserSession>());

function now() {
  return new Date().toISOString();
}

function buildEditableThemes(themes: AnalysisResponse["themes"]): EditableTheme[] {
  return themes.map((theme) => ({
    ...theme,
    hidden: false,
  }));
}

function createWorkspaceSnapshot(): StoredWorkspaceSnapshot {
  return {
    id: randomUUID(),
    step: "upload",
    fileName: null,
    preview: null,
    analysis: null,
    themes: [],
    textColumn: "",
    metadataColumns: [],
    selectedThemeId: null,
    updatedAt: null,
    parsedWorkbook: null,
  };
}

function createBrowserSession(sessionId: string): StoredBrowserSession {
  return {
    id: sessionId,
    workspace: createWorkspaceSnapshot(),
    history: [],
  };
}

function toWorkspaceSnapshot(
  workspace: StoredWorkspaceSnapshot,
): WorkspaceSnapshot {
  return {
    id: workspace.id,
    step: workspace.step,
    fileName: workspace.fileName,
    preview: workspace.preview,
    analysis: workspace.analysis,
    themes: workspace.themes,
    textColumn: workspace.textColumn,
    metadataColumns: workspace.metadataColumns,
    selectedThemeId: workspace.selectedThemeId,
    updatedAt: workspace.updatedAt,
  };
}

function toPayload(session: StoredBrowserSession): WorkspaceSessionPayload {
  return {
    workspace: toWorkspaceSnapshot(session.workspace),
    history: session.history,
  };
}

async function readBrowserSessionId() {
  const cookieStore = await cookies();
  return cookieStore.get(BROWSER_SESSION_COOKIE)?.value ?? null;
}

async function persistBrowserSessionId(sessionId: string) {
  const cookieStore = await cookies();
  cookieStore.set(BROWSER_SESSION_COOKIE, sessionId, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    maxAge: COOKIE_MAX_AGE,
  });
}

function getOrCreateStoredSession(sessionId: string) {
  const existing = browserSessions.get(sessionId);
  if (existing) {
    return existing;
  }

  const next = createBrowserSession(sessionId);
  browserSessions.set(sessionId, next);
  return next;
}

function pushHistoryEntry(session: StoredBrowserSession, analysis: AnalysisResponse) {
  const visibleThemes = session.workspace.themes.filter((theme) => !theme.hidden);
  const topTheme = visibleThemes.find((theme) => theme.kind === "cluster") ?? null;
  const entry: SessionHistoryEntry = {
    id: session.workspace.id,
    fileName: analysis.summary.fileName,
    headline: analysis.report.headline,
    topThemeLabel: topTheme?.label ?? null,
    analyzedRows: analysis.summary.analyzedRows,
    updatedAt: now(),
  };

  session.history = [
    entry,
    ...session.history.filter((item) => item.id !== entry.id),
  ].slice(0, 8);
}

export async function getWorkspaceSessionPayload() {
  const sessionId = await readBrowserSessionId();

  if (!sessionId) {
    return {
      workspace: toWorkspaceSnapshot(createWorkspaceSnapshot()),
      history: [],
    } satisfies WorkspaceSessionPayload;
  }

  return toPayload(getOrCreateStoredSession(sessionId));
}

export async function ensureWorkspaceSession() {
  let sessionId = await readBrowserSessionId();

  if (!sessionId) {
    sessionId = randomUUID();
    await persistBrowserSessionId(sessionId);
  }

  return getOrCreateStoredSession(sessionId);
}

export async function storePreviewSession(input: {
  parsedWorkbook: ParsedWorkbook;
  preview: DatasetPreview;
}) {
  const session = await ensureWorkspaceSession();
  const updatedAt = now();

  session.workspace = {
    ...createWorkspaceSnapshot(),
    id: randomUUID(),
    step: "inspect",
    fileName: input.preview.fileName,
    preview: input.preview,
    textColumn:
      input.preview.suggestedTextColumn ?? input.preview.columns[0] ?? "",
    metadataColumns: input.preview.suggestedMetadataColumns,
    updatedAt,
    parsedWorkbook: input.parsedWorkbook,
  };

  return toPayload(session);
}

export async function storeAnalysisSession(input: {
  analysis: AnalysisResponse;
  textColumn: string;
  metadataColumns: string[];
}) {
  const session = await ensureWorkspaceSession();
  const updatedAt = now();
  const themes = buildEditableThemes(input.analysis.themes);

  session.workspace = {
    ...session.workspace,
    step: "insights",
    fileName: input.analysis.summary.fileName,
    analysis: input.analysis,
    themes,
    textColumn: input.textColumn,
    metadataColumns: input.metadataColumns,
    selectedThemeId: themes[0]?.id ?? null,
    updatedAt,
  };

  pushHistoryEntry(session, input.analysis);
  return toPayload(session);
}

export async function patchWorkspaceSession(
  patch: Partial<
    Pick<
      WorkspaceSnapshot,
      | "step"
      | "textColumn"
      | "metadataColumns"
      | "themes"
      | "selectedThemeId"
      | "fileName"
    >
  >,
) {
  const session = await ensureWorkspaceSession();

  session.workspace = {
    ...session.workspace,
    ...patch,
    updatedAt: now(),
  };

  return toPayload(session);
}

export async function resetWorkspaceSession() {
  const session = await ensureWorkspaceSession();
  session.workspace = createWorkspaceSnapshot();
  return toPayload(session);
}

export async function getParsedWorkbookForCurrentSession() {
  const session = await ensureWorkspaceSession();
  return session.workspace.parsedWorkbook;
}
