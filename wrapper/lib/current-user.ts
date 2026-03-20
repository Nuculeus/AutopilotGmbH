import { auth, clerkClient } from "@clerk/nextjs/server";
import { summarizeAutopilotState } from "@/lib/autopilot-metadata";
import { summarizeCredits } from "@/lib/credits";

export async function getCurrentUserState() {
  const { userId } = await auth();

  if (!userId) {
    return {
      userId: null,
      user: null,
      creditSummary: summarizeCredits(null),
      autopilotState: summarizeAutopilotState(null),
    };
  }

  const client = await clerkClient();
  const user = await client.users.getUser(userId);
  const creditSummary = summarizeCredits(user.publicMetadata?.autopilotCredits);
  const autopilotState = summarizeAutopilotState(user.publicMetadata, userId);

  return { userId, user, creditSummary, autopilotState };
}
