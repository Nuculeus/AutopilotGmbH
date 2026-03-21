import { auth, clerkClient } from "@clerk/nextjs/server";
import { summarizeAutopilotState } from "@/lib/autopilot-metadata";
import { hasStoredCompanyHqBriefing, normalizeCompanyHqProfile } from "@/lib/company-hq";
import { summarizeCredits } from "@/lib/credits";
import { hasConnectedLlmProvider } from "@/lib/llm-connections";
import { BridgeError, type PaperclipCompanySecret, readPaperclipBridgeJson } from "@/lib/paperclip-bridge";

async function resolveHasLlmConnection(input: {
  userId: string;
  autopilotState: ReturnType<typeof summarizeAutopilotState>;
}) {
  if (!input.autopilotState.canOpenWorkspace) {
    return false;
  }

  try {
    const secrets = await readPaperclipBridgeJson<PaperclipCompanySecret[]>({
      request: new Request("http://localhost/api/paperclip/secrets"),
      pathSegments: ["secrets"],
      userId: input.userId,
      autopilotState: input.autopilotState,
    });

    return hasConnectedLlmProvider(secrets);
  } catch (error) {
    if (error instanceof BridgeError) {
      return false;
    }
    throw error;
  }
}

export async function getCurrentUserState() {
  const { userId } = await auth();

  if (!userId) {
    return {
      userId: null,
      user: null,
      companyHqProfile: normalizeCompanyHqProfile(null),
      hasCompanyHqBriefing: false,
      hasLlmConnection: false,
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
  const hasLlmConnection = await resolveHasLlmConnection({ userId, autopilotState });

  return {
    userId,
    user,
    companyHqProfile,
    hasCompanyHqBriefing,
    hasLlmConnection,
    creditSummary,
    autopilotState,
  };
}
