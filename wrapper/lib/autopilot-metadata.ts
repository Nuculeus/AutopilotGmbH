import { summarizeCredits, type CreditSummary } from "@/lib/credits";

export type ProvisioningStatus =
  | "not_started"
  | "pending"
  | "active"
  | "failed"
  | "suspended";

export type WorkspaceStatus = "locked" | "provisioning" | "ready" | "attention" | "suspended";

export type ProvisioningMetadata = {
  companyId?: string;
  companyName?: string;
  provisioningStatus?: ProvisioningStatus;
  workspaceStatus?: WorkspaceStatus;
  bridgePrincipalId?: string;
  lastError?: string;
};

export type AutopilotPublicMetadata = {
  autopilotCredits?: unknown;
  autopilotProvisioning?: ProvisioningMetadata;
};

export type AutopilotState = {
  companyId: string | null;
  companyName: string | null;
  provisioningStatus: ProvisioningStatus;
  workspaceStatus: WorkspaceStatus;
  bridgePrincipalId: string | null;
  lastError: string | null;
  canOpenWorkspace: boolean;
  creditSummary: CreditSummary;
};

function normalizeProvisioningStatus(value: unknown): ProvisioningStatus {
  switch (value) {
    case "pending":
    case "active":
    case "failed":
    case "suspended":
      return value;
    default:
      return "not_started";
  }
}

function normalizeWorkspaceStatus(
  status: ProvisioningStatus,
  value: unknown,
): WorkspaceStatus {
  if (value === "locked" || value === "provisioning" || value === "ready" || value === "attention" || value === "suspended") {
    return value;
  }

  switch (status) {
    case "pending":
      return "provisioning";
    case "active":
      return "ready";
    case "failed":
      return "attention";
    case "suspended":
      return "suspended";
    default:
      return "locked";
  }
}

export function toBridgePrincipalId(clerkUserId: string | null | undefined) {
  return clerkUserId ? `clerk:${clerkUserId}` : null;
}

export function summarizeAutopilotState(
  value: unknown,
  clerkUserId?: string | null,
): AutopilotState {
  const source = value && typeof value === "object" ? (value as AutopilotPublicMetadata) : {};
  const provisioning =
    source.autopilotProvisioning && typeof source.autopilotProvisioning === "object"
      ? source.autopilotProvisioning
      : {};
  const provisioningStatus = normalizeProvisioningStatus(provisioning.provisioningStatus);
  const workspaceStatus = normalizeWorkspaceStatus(provisioningStatus, provisioning.workspaceStatus);

  return {
    companyId: typeof provisioning.companyId === "string" ? provisioning.companyId : null,
    companyName: typeof provisioning.companyName === "string" ? provisioning.companyName : null,
    provisioningStatus,
    workspaceStatus,
    bridgePrincipalId:
      typeof provisioning.bridgePrincipalId === "string"
        ? provisioning.bridgePrincipalId
        : toBridgePrincipalId(clerkUserId),
    lastError: typeof provisioning.lastError === "string" ? provisioning.lastError : null,
    canOpenWorkspace: provisioningStatus === "active" && workspaceStatus === "ready",
    creditSummary: summarizeCredits(source.autopilotCredits),
  };
}
