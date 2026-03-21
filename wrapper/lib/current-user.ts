import { auth, clerkClient } from "@clerk/nextjs/server";
import { summarizeAutopilotState } from "@/lib/autopilot-metadata";
import { hasStoredCompanyHqBriefing, normalizeCompanyHqProfile } from "@/lib/company-hq";
import { summarizeCredits } from "@/lib/credits";

export async function getCurrentUserState() {
  const { userId } = await auth();

  if (!userId) {
    return {
      userId: null,
      user: null,
      companyHqProfile: normalizeCompanyHqProfile(null),
      hasCompanyHqBriefing: false,
      creditSummary: summarizeCredits(null),
      autopilotState: summarizeAutopilotState(null),
    };
  }

  const client = await clerkClient();
  const user = await client.users.getUser(userId);
  const creditSummary = summarizeCredits(user.publicMetadata?.autopilotCredits);
  const autopilotState = summarizeAutopilotState(user.publicMetadata, userId);
  const companyHqProfile = normalizeCompanyHqProfile(user.privateMetadata?.autopilotCompanyHq);
  const hasCompanyHqBriefing = hasStoredCompanyHqBriefing(companyHqProfile);

  return { userId, user, companyHqProfile, hasCompanyHqBriefing, creditSummary, autopilotState };
}
