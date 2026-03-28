import { redirect } from "next/navigation";

import { getWorkspaceSessionPayload } from "@/lib/session-store";

export default async function WorkspaceIndexPage() {
  const { workspace } = await getWorkspaceSessionPayload();

  if (workspace.analysis) {
    redirect("/app/insights");
  }

  if (workspace.preview) {
    redirect("/app/inspect");
  }

  redirect("/app/upload");
}
