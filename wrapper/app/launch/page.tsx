import { redirect } from "next/navigation";
import { advanceRevenueMilestone } from "@/lib/revenue-track";
import { getCurrentUserState } from "@/lib/current-user";
import { resolveLaunchEntryDecision } from "@/lib/launch-entry";
import { resolveLaunchFlowState } from "@/lib/launch-flow";

export default async function LaunchEntryPage() {
  const {
    userId,
    hasCompanyHqBriefing,
    hasRunnableLlmConnection,
    hasRequiredRevenueConnections,
    companyHqProfile,
    creditSummary,
    autopilotState,
  } = await getCurrentUserState();
  const flow = resolveLaunchFlowState({
    availableCredits: creditSummary.availableCredits,
    plan: creditSummary.plan,
    hasCompanyHqBriefing,
    companyId: autopilotState.companyId,
    provisioningStatus: autopilotState.provisioningStatus,
    canOpenWorkspace: autopilotState.canOpenWorkspace,
    hasRunnableLlmConnection,
    hasRequiredRevenueConnections,
    revenueMilestone: autopilotState.canOpenWorkspace
      ? advanceRevenueMilestone(companyHqProfile.nextMilestone, hasRequiredRevenueConnections ? "workspace_ready" : "model_ready")
      : companyHqProfile.nextMilestone,
  });
  const decision = resolveLaunchEntryDecision({
    userId,
    hasCompanyHqBriefing,
    hasRunnableLlmConnection,
    hasRequiredRevenueConnections,
    availableCredits: creditSummary.availableCredits,
    plan: creditSummary.plan,
    companyId: autopilotState.companyId,
    provisioningStatus: autopilotState.provisioningStatus,
    canOpenWorkspace: autopilotState.canOpenWorkspace,
  });

  redirect(flow.stage === "model_ready" ? "/app/connections?preset=openai" : decision.href);
}
