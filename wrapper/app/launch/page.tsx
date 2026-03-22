import { redirect } from "next/navigation";
import { advanceRevenueMilestone } from "@/lib/revenue-track";
import { getCurrentUserState } from "@/lib/current-user";
import { resolveLaunchEntryDecision } from "@/lib/launch-entry";
import { resolveLaunchFlowState } from "@/lib/launch-flow";

export default async function LaunchEntryPage() {
  const {
    userId,
    hasCompanyHqBriefing,
    hasBillingBypass,
    hasRunnableLlmConnection,
    hasVerifiedLlmReadiness,
    hasRequiredRevenueConnections,
    companyHqProfile,
    creditSummary,
    autopilotState,
  } = await getCurrentUserState();
  const hasReadyLlmConnection =
    hasRunnableLlmConnection && hasVerifiedLlmReadiness;
  const flow = resolveLaunchFlowState({
    availableCredits: creditSummary.availableCredits,
    plan: creditSummary.plan,
    hasBillingBypass,
    hasCompanyHqBriefing,
    companyId: autopilotState.companyId,
    provisioningStatus: autopilotState.provisioningStatus,
    canOpenWorkspace: autopilotState.canOpenWorkspace,
    hasRunnableLlmConnection: hasReadyLlmConnection,
    hasRequiredRevenueConnections,
    revenueMilestone: autopilotState.canOpenWorkspace
      ? advanceRevenueMilestone(companyHqProfile.nextMilestone, hasRequiredRevenueConnections && hasReadyLlmConnection ? "workspace_ready" : "model_ready")
      : companyHqProfile.nextMilestone,
  });
  const decision = resolveLaunchEntryDecision({
    userId,
    hasCompanyHqBriefing,
    hasRunnableLlmConnection: hasReadyLlmConnection,
    hasRequiredRevenueConnections,
    hasBillingBypass,
    availableCredits: creditSummary.availableCredits,
    plan: creditSummary.plan,
    companyId: autopilotState.companyId,
    provisioningStatus: autopilotState.provisioningStatus,
    canOpenWorkspace: autopilotState.canOpenWorkspace,
  });

  redirect(flow.stage === "model_ready" ? "/app/connections?preset=openai" : decision.href);
}
