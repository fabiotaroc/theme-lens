import { AppShell } from "@/components/app-shell";
import { WorkspaceProvider } from "@/components/workspace-provider";
import { getWorkspaceSessionPayload } from "@/lib/session-store";

export default async function WorkspaceLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const initialSession = await getWorkspaceSessionPayload();

  return (
    <WorkspaceProvider initialSession={initialSession}>
      <AppShell>{children}</AppShell>
    </WorkspaceProvider>
  );
}
