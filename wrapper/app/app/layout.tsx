import { headers } from "next/headers";
import { AppShell } from "@/components/app-shell";
import { buildAppShellModel } from "@/lib/app-shell";
import { getCurrentUserState } from "@/lib/current-user";

type AppLayoutProps = {
  children: React.ReactNode;
};

export default async function AppLayout({ children }: AppLayoutProps) {
  const { creditSummary, autopilotState } = await getCurrentUserState();
  const model = buildAppShellModel({
    creditSummary: {
      availableCredits: creditSummary.availableCredits,
      plan: creditSummary.plan,
    },
    autopilotState: {
      companyId: autopilotState.companyId,
      companyName: autopilotState.companyName,
      provisioningStatus: autopilotState.provisioningStatus,
      workspaceStatus: autopilotState.workspaceStatus,
      canOpenWorkspace: autopilotState.canOpenWorkspace,
    },
  });
  const headerStore = await headers();
  const currentPath = headerStore.get("x-current-path") ?? "/app/overview";

  return (
    <AppShell
      currentPath={currentPath}
      description="Die native Launch-Shell rahmt die nächsten produktiven Bereiche ein und schafft die deutsche Betriebsoberfläche."
      eyebrow="Launch Workspace"
      model={model}
      title="Operativer Arbeitsbereich"
    >
      {children}
    </AppShell>
  );
}
