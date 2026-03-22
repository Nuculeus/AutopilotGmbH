type BootstrapCompanyInput = {
  clerkUserId: string;
  name: string;
  idea?: string | null;
};

export type BootstrapCompanyResult = {
  paperclipCompanyId: string;
  companyName: string;
  bridgePrincipalId: string;
  status: "bootstrapped";
};

export type PaperclipAgentConfiguration = {
  id: string;
  name: string;
  role: string;
  adapterType: string;
  adapterConfig: Record<string, unknown>;
};

export type PaperclipAdapterEnvironmentCheck = {
  code: string;
  level: "info" | "warn" | "error";
  message: string;
  hint?: string;
  detail?: string;
};

export type PaperclipAdapterEnvironmentTestResult = {
  adapterType: string;
  status: "pass" | "warn" | "fail";
  checks: PaperclipAdapterEnvironmentCheck[];
  testedAt: string;
};

function getPaperclipInternalUrl() {
  return (
    process.env.PAPERCLIP_INTERNAL_URL?.trim()
    || process.env.PAPERCLIP_API_URL?.trim()
    || "http://paperclip:3100"
  );
}

function getPaperclipInternalOrigin() {
  try {
    return new URL(getPaperclipInternalUrl()).origin;
  } catch {
    return "http://paperclip:3100";
  }
}

function getInternalSecret() {
  const internalSecret = process.env.INTERNAL_BRIDGE_SECRET?.trim();

  if (!internalSecret) {
    throw new Error("Missing INTERNAL_BRIDGE_SECRET");
  }

  return internalSecret;
}

function getBridgeHeaders(bridgePrincipalId?: string | null) {
  const headers = new Headers({
    "Content-Type": "application/json",
    Accept: "application/json",
    Origin: getPaperclipInternalOrigin(),
    "X-Internal-Secret": getInternalSecret(),
  });

  if (bridgePrincipalId) {
    headers.set("X-Bridge-Principal", bridgePrincipalId);
  }

  return headers;
}

async function readInternalJson<T>(input: {
  path: string;
  method?: "GET" | "PATCH" | "POST";
  bridgePrincipalId?: string | null;
  body?: Record<string, unknown>;
}) {
  const response = await fetch(`${getPaperclipInternalUrl()}${input.path}`, {
    method: input.method ?? "GET",
    headers: getBridgeHeaders(input.bridgePrincipalId),
    body: input.body ? JSON.stringify(input.body) : undefined,
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(
      payload && typeof payload === "object" && "error" in payload
        ? String(payload.error)
        : `Paperclip request failed with status ${response.status}`,
    );
  }

  return payload as T;
}

export async function listCompanyAgents(input: {
  companyId: string;
  bridgePrincipalId: string;
}) {
  return readInternalJson<PaperclipAgentConfiguration[]>({
    path: `/api/companies/${input.companyId}/agents`,
    bridgePrincipalId: input.bridgePrincipalId,
  });
}

export async function updateAgentAdapterConfig(input: {
  agentId: string;
  bridgePrincipalId: string;
  adapterConfig: Record<string, unknown>;
}) {
  return readInternalJson<unknown>({
    path: `/api/agents/${input.agentId}`,
    method: "PATCH",
    bridgePrincipalId: input.bridgePrincipalId,
    body: {
      adapterConfig: input.adapterConfig,
    },
  });
}

export async function testAdapterEnvironment(input: {
  companyId: string;
  bridgePrincipalId: string;
  adapterType: string;
  adapterConfig: Record<string, unknown>;
}) {
  return readInternalJson<PaperclipAdapterEnvironmentTestResult>({
    path: `/api/companies/${input.companyId}/adapters/${input.adapterType}/test-environment`,
    method: "POST",
    bridgePrincipalId: input.bridgePrincipalId,
    body: {
      adapterConfig: input.adapterConfig,
    },
  });
}

export async function bootstrapCompany(
  input: BootstrapCompanyInput,
): Promise<BootstrapCompanyResult> {
  const response = await fetch(`${getPaperclipInternalUrl()}/api/internal/bootstrap-company`, {
    method: "POST",
    headers: getBridgeHeaders(),
    body: JSON.stringify(input),
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(
      payload && typeof payload === "object" && "error" in payload
        ? String(payload.error)
        : `Paperclip bootstrap failed with status ${response.status}`,
    );
  }

  return payload as BootstrapCompanyResult;
}

export function canTargetCompany(input: {
  companyId: string;
  bridgePrincipalId: string;
} | {
  companyId: string | null;
  bridgePrincipalId: string | null;
}): input is {
  companyId: string;
  bridgePrincipalId: string;
} {
  return Boolean(input.companyId && input.bridgePrincipalId);
}
