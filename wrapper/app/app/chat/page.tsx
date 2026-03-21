import { WorkspaceHostFrame } from "@/components/workspace-host-frame";
import { buildAppShellModel } from "@/lib/app-shell";
import { getCurrentUserState } from "@/lib/current-user";

export default async function AppChatPage() {
  const { creditSummary, autopilotState, companyHqProfile } = await getCurrentUserState();
  const model = buildAppShellModel({
    currentPath: "/app/chat",
    companyHqProfile,
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

  return <WorkspaceHostFrame handoff={model.workspaceHandoff} />;
}
