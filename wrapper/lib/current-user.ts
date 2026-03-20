import { auth, clerkClient } from "@clerk/nextjs/server";
import { summarizeCredits } from "@/lib/credits";

export async function getCurrentUserState() {
  const { userId } = await auth();

  if (!userId) {
    return { userId: null, user: null, creditSummary: summarizeCredits(null) };
  }

  const client = await clerkClient();
  const user = await client.users.getUser(userId);
  const creditSummary = summarizeCredits(user.publicMetadata?.autopilotCredits);

  return { userId, user, creditSummary };
}
