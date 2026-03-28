"use client";

import {
  createContext,
  startTransition,
  useContext,
  useState,
} from "react";

import type {
  AnalysisResponse,
  EditableTheme,
  WorkspaceSessionPayload,
  WorkspaceSnapshot,
} from "@/lib/types";

type BusyAction = "preview" | "analysis" | "workspace" | null;

interface WorkspaceContextValue {
  session: WorkspaceSessionPayload;
  workspace: WorkspaceSnapshot;
  history: WorkspaceSessionPayload["history"];
  busyAction: BusyAction;
  error: string | null;
  clearError: () => void;
  inspectFile: (file: File) => Promise<void>;
  runAnalysis: () => Promise<void>;
  patchWorkspace: (
    patch: Partial<
      Pick<
        WorkspaceSnapshot,
        "step" | "textColumn" | "metadataColumns" | "themes" | "selectedThemeId" | "fileName"
      >
    >,
  ) => Promise<void>;
  resetWorkspace: () => Promise<void>;
  replaceThemes: (
    themes: EditableTheme[],
    selectedThemeId?: string | null,
  ) => Promise<void>;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

async function readJsonResponse<T>(response: Response): Promise<T> {
  const payload = (await response.json()) as T & { error?: string };

  if (!response.ok) {
    throw new Error(payload.error ?? "The request failed.");
  }

  return payload;
}

export function WorkspaceProvider({
  children,
  initialSession,
}: {
  children: React.ReactNode;
  initialSession: WorkspaceSessionPayload;
}) {
  const [session, setSession] = useState(initialSession);
  const [busyAction, setBusyAction] = useState<BusyAction>(null);
  const [error, setError] = useState<string | null>(null);

  async function patchWorkspace(
    patch: Partial<
      Pick<
        WorkspaceSnapshot,
        "step" | "textColumn" | "metadataColumns" | "themes" | "selectedThemeId" | "fileName"
      >
    >,
  ) {
    setBusyAction("workspace");
    setError(null);

    try {
      const payload = await readJsonResponse<WorkspaceSessionPayload>(
        await fetch("/api/workspace", {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(patch),
        }),
      );

      setSession(payload);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Could not update the current workspace.",
      );
      throw requestError;
    } finally {
      setBusyAction(null);
    }
  }

  async function inspectFile(file: File) {
    setBusyAction("preview");
    setError(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const payload = await readJsonResponse<WorkspaceSessionPayload>(
        await fetch("/api/preview", {
          method: "POST",
          body: formData,
        }),
      );

      setSession(payload);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "ThemeLens could not inspect the file.",
      );
      throw requestError;
    } finally {
      setBusyAction(null);
    }
  }

  async function runAnalysis() {
    setBusyAction("analysis");
    setError(null);

    try {
      const formData = new FormData();
      formData.append("textColumn", session.workspace.textColumn);
      formData.append(
        "metadataColumns",
        JSON.stringify(session.workspace.metadataColumns),
      );

      const payload = await readJsonResponse<WorkspaceSessionPayload>(
        await fetch("/api/analyze", {
          method: "POST",
          body: formData,
        }),
      );

      setSession(payload);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "ThemeLens could not generate insights for this dataset.",
      );
      throw requestError;
    } finally {
      setBusyAction(null);
    }
  }

  async function replaceThemes(
    themes: EditableTheme[],
    selectedThemeId?: string | null,
  ) {
    await patchWorkspace({
      themes,
      selectedThemeId:
        selectedThemeId === undefined
          ? session.workspace.selectedThemeId
          : selectedThemeId,
    });
  }

  async function resetWorkspace() {
    setBusyAction("workspace");
    setError(null);

    try {
      const payload = await readJsonResponse<WorkspaceSessionPayload>(
        await fetch("/api/workspace", {
          method: "DELETE",
        }),
      );

      setSession(payload);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Could not reset the current workspace.",
      );
      throw requestError;
    } finally {
      setBusyAction(null);
    }
  }

  const value: WorkspaceContextValue = {
    session,
    workspace: session.workspace,
    history: session.history,
    busyAction,
    error,
    clearError: () => setError(null),
    inspectFile: async (file: File) => {
      await new Promise<void>((resolve, reject) => {
        startTransition(() => {
          inspectFile(file).then(resolve).catch(reject);
        });
      });
    },
    runAnalysis: async () => {
      await new Promise<void>((resolve, reject) => {
        startTransition(() => {
          runAnalysis().then(resolve).catch(reject);
        });
      });
    },
    patchWorkspace: async (patch) => {
      await patchWorkspace(patch);
    },
    resetWorkspace: async () => {
      await resetWorkspace();
    },
    replaceThemes: async (themes, selectedThemeId) => {
      await replaceThemes(themes, selectedThemeId);
    },
  };

  return (
    <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext);

  if (context === null) {
    throw new Error("useWorkspace must be used within a WorkspaceProvider.");
  }

  return context;
}

export function useWorkspaceAnalysis() {
  const { workspace } = useWorkspace();
  return workspace.analysis as AnalysisResponse | null;
}
