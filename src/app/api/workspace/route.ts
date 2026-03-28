import { NextResponse } from "next/server";

import {
  getWorkspaceSessionPayload,
  patchWorkspaceSession,
  resetWorkspaceSession,
} from "@/lib/session-store";
import type { WorkspaceSnapshot } from "@/lib/types";

export const runtime = "nodejs";

type WorkspacePatch = Partial<
  Pick<
    WorkspaceSnapshot,
    "step" | "textColumn" | "metadataColumns" | "themes" | "selectedThemeId" | "fileName"
  >
>;

export async function GET() {
  return NextResponse.json(await getWorkspaceSessionPayload());
}

export async function PATCH(request: Request) {
  try {
    const patch = (await request.json()) as WorkspacePatch;
    return NextResponse.json(await patchWorkspaceSession(patch));
  } catch {
    return NextResponse.json(
      { error: "Could not update the current workspace." },
      { status: 400 },
    );
  }
}

export async function DELETE() {
  return NextResponse.json(await resetWorkspaceSession());
}
