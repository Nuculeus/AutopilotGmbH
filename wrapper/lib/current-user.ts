import { auth, clerkClient } from "@clerk/nextjs/server";
import { summarizeAutopilotState } from "@/lib/autopilot-metadata";
import { hasStoredCompanyHqBriefing, normalizeCompanyHqProfile } from "@/lib/company-hq";
import { hasAdminBillingBypass } from "@/lib/admin-access";
import {
  getPrimaryControlPlaneSnapshotForUser,
  syncLegacyUserState,
} from "@/lib/control-plane-store";
import { resolveControlPlaneStateSources } from "@/lib/control-plane-resolution";
import { summarizeCredits } from "@/lib/credits";
import { evaluateRequiredConnections } from "@/lib/revenue-track";
import { hasConnectedLlmProvider, hasRunnableLlmBinding } from "@/lib/llm-connections";
import {
  isLlmReadinessReady,
  normalizeAutopilotLlmReadinessMetadata,
} from "@/lib/llm-readiness";
import { normalizeAutopilotRevenueMetadata, summarizeRevenueStatus } from "@/lib/revenue-events";
import { canTargetCompany, listCompanyAgents } from "@/lib/paperclip-admin";
import { BridgeError, type PaperclipCompanySecret, readPaperclipBridgeJson } from "@/lib/paperclip-bridge";

type ModelConnectionState = {
  secretNames: string[];
  hasConnectedLlmProvider: boolean;
  hasRunnableLlmConnection: boolean;
};

async function resolveModelConnectionState(input: {
  userId: string;
  autopilotState: ReturnType<typeof summarizeAutopilotState>;
}): Promise<ModelConnectionState> {
  if (!input.autopilotState.canOpenWorkspace) {
    return {
      secretNames: [],
      hasConnectedLlmProvider: false,
      hasRunnableLlmConnection: false,
    };
  }

  try {
    const secrets = await readPaperclipBridgeJson<PaperclipCompanySecret[]>({
      request: new Request("http://localhost/api/paperclip/secrets"),
      pathSegments: ["secrets"],
      userId: input.userId,
      autopilotState: input.autopilotState,
    });

    const hasConnectedProvider = hasConnectedLlmProvider(secrets);
    const secretNames = secrets.map((secret) => secret.name);

    if (!hasConnectedProvider || !canTargetCompany(input.autopilotState)) {
      return {
        secretNames,
        hasConnectedLlmProvider: hasConnectedProvider,
        hasRunnableLlmConnection: false,
      };
    }

    const agents = await listCompanyAgents({
      companyId: input.autopilotState.companyId,
      bridgePrincipalId: input.autopilotState.bridgePrincipalId,
    });

    return {
      secretNames,
      hasConnectedLlmProvider: hasConnectedProvider,
      hasRunnableLlmConnection: hasRunnableLlmBinding(
        agents.map((agent) => ({
          id: agent.id,
          name: agent.name,
          role: agent.role,
          adapterType: agent.adapterType,
          adapterConfig:
            typeof agent.adapterConfig === "object" &&
            agent.adapterConfig !== null &&
            !Array.isArray(agent.adapterConfig)
              ? agent.adapterConfig
              : {},
        })),
      ),
    };
  } catch (error) {
    if (error instanceof BridgeError) {
      return {
        secretNames: [],
        hasConnectedLlmProvider: false,
        hasRunnableLlmConnection: false,
      };
    }
    throw error;
  }
}

export async function getCurrentUserState() {
  const { userId } = await auth();

  if (!userId) {
    const revenue = normalizeAutopilotRevenueMetadata(null);
    const llmReadiness = normalizeAutopilotLlmReadinessMetadata(null);
    return {
      userId: null,
      user: null,
      companyHqProfile: normalizeCompanyHqProfile(null),
      hasCompanyHqBriefing: false,
      hasBillingBypass: false,
      hasLlmConnection: false,
      hasRunnableLlmConnection: false,
      llmReadiness,
      hasVerifiedLlmReadiness: false,
      hasRequiredRevenueConnections: false,
      missingRequiredConnections: [],
      revenueStatus: summarizeRevenueStatus(revenue),
      creditSummary: summarizeCredits(null),
      autopilotState: summarizeAutopilotState(null),
    };
  }

  const client = await clerkClient();
  const user = await client.users.getUser(userId);
  const creditSummary = summarizeCredits(user.publicMetadata?.autopilotCredits);
  const autopilotState = summarizeAutopilotState(user.publicMetadata, userId);
  const legacyCompanyHqProfile = normalizeCompanyHqProfile(user.privateMetadata?.autopilotCompanyHq);
  const legacyRevenue = normalizeAutopilotRevenueMetadata(user.privateMetadata?.autopilotRevenue);
  await syncLegacyUserState({
    clerkUserId: userId,
    autopilotState: {
      companyId: autopilotState.companyId,
      companyName: autopilotState.companyName,
      bridgePrincipalId: autopilotState.bridgePrincipalId,
    },
    profile: legacyCompanyHqProfile,
    revenue: legacyRevenue,
  });
  const controlPlaneSnapshot = await getPrimaryControlPlaneSnapshotForUser({
    clerkUserId: userId,
  });
  const resolvedState = resolveControlPlaneStateSources({
    controlPlaneSnapshot,
    legacyCompanyHqProfile,
    legacyRevenue,
  });
  const companyHqProfile = resolvedState.companyHqProfile;
  const revenue = resolvedState.revenue;
  const llmReadiness = normalizeAutopilotLlmReadinessMetadata(
    user.privateMetadata?.autopilotLlmReadiness,
  );
  const hasCompanyHqBriefing = hasStoredCompanyHqBriefing(companyHqProfile);
  const hasBillingBypass = hasAdminBillingBypass(user as Parameters<typeof hasAdminBillingBypass>[0]);
  const modelConnection = await resolveModelConnectionState({ userId, autopilotState });
  const requiredConnections = evaluateRequiredConnections({
    hasLlmConnection: modelConnection.hasRunnableLlmConnection,
    requiredConnections: companyHqProfile.requiredConnections,
    secretNames: modelConnection.secretNames,
  });

  return {
    userId,
    user,
    companyHqProfile,
    hasCompanyHqBriefing,
    hasBillingBypass,
    hasLlmConnection: modelConnection.hasConnectedLlmProvider,
    hasRunnableLlmConnection: modelConnection.hasRunnableLlmConnection,
    llmReadiness,
    hasVerifiedLlmReadiness: isLlmReadinessReady(llmReadiness),
    hasRequiredRevenueConnections: requiredConnections.hasRequiredConnections,
    missingRequiredConnections: requiredConnections.missingConnections,
    revenueStatus: summarizeRevenueStatus(revenue),
    creditSummary,
    autopilotState,
  };
}
