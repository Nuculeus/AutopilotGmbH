import { WorkspaceHostFrame } from "@/components/workspace-host-frame";
import { buildAppShellModel } from "@/lib/app-shell";
import { getCurrentUserState } from "@/lib/current-user";

export default async function AppChatPage() {
  const {
    creditSummary,
    autopilotState,
    companyHqProfile,
    hasRunnableLlmConnection,
    hasRequiredRevenueConnections,
    missingRequiredConnections,
  } = await getCurrentUserState();
  const model = buildAppShellModel({
    currentPath: "/app/chat",
    companyHqProfile,
    hasRunnableLlmConnection,
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

  if (model.access === "blocked") {
    return null;
  }

  return <WorkspaceHostFrame handoff={model.workspaceHandoff} />;
}
