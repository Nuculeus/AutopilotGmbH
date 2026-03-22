import { headers } from "next/headers";
import { AppShell } from "@/components/app-shell";
import { buildAppShellModel } from "@/lib/app-shell";
import { getCurrentUserState } from "@/lib/current-user";

type AppLayoutProps = {
  children: React.ReactNode;
};

export default async function AppLayout({ children }: AppLayoutProps) {
  const headerStore = await headers();
  const currentPath = headerStore.get("x-current-path") ?? "/app/overview";
  const {
    creditSummary,
    autopilotState,
    companyHqProfile,
    hasRunnableLlmConnection,
    llmReadiness,
    hasRequiredRevenueConnections,
    missingRequiredConnections,
  } = await getCurrentUserState();
  const model = buildAppShellModel({
    currentPath,
    companyHqProfile,
    hasRunnableLlmConnection,
    llmReadiness,
    hasRequiredRevenueConnections,
    missingRequiredConnections,
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

  return (
    <AppShell
      currentPath={currentPath}
      description={model.page.description}
      eyebrow={model.page.eyebrow}
      model={model}
      title={model.page.title}
    >
      {children}
    </AppShell>
  );
}
