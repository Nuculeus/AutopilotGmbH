import { redirect } from "next/navigation";
import { getCurrentUserState } from "@/lib/current-user";
import { resolveLaunchEntryDecision } from "@/lib/launch-entry";

export default async function LaunchEntryPage() {
  const { userId, creditSummary, autopilotState } = await getCurrentUserState();
  const decision = resolveLaunchEntryDecision({
    userId,
    availableCredits: creditSummary.availableCredits,
    plan: creditSummary.plan,
    companyId: autopilotState.companyId,
    provisioningStatus: autopilotState.provisioningStatus,
    canOpenWorkspace: autopilotState.canOpenWorkspace,
  });

  redirect(decision.href);
}
