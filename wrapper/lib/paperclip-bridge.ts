import type { AutopilotState } from "@/lib/autopilot-metadata";

type BridgeAlias = "dashboard-summary" | "secret-providers" | "secrets";
type BridgeMethod = "GET" | "POST";

type BridgeContext = {
  request: Request;
  pathSegments: string[];
  userId: string;
  autopilotState: Pick<
    AutopilotState,
    "companyId" | "bridgePrincipalId" | "provisioningStatus" | "workspaceStatus" | "canOpenWorkspace"
  >;
};

type RouteSpec = {
  alias: BridgeAlias;
  method: BridgeMethod;
  targetPath: string;
};

export type PaperclipDashboardSummary = {
  companyId: string;
  agents: {
    active: number;
    running: number;
    paused: number;
    error: number;
  };
  tasks: {
    open: number;
    inProgress: number;
    blocked: number;
    done: number;
  };
  costs: {
    monthSpendCents: number;
    monthBudgetCents: number;
    monthUtilizationPercent: number;
  };
  pendingApprovals: number;
  budgets: {
    activeIncidents: number;
    pendingApprovals: number;
    pausedAgents: number;
    pausedProjects: number;
  };
};

export type PaperclipSecretProvider = {
  id: string;
  label: string;
  requiresExternalRef: boolean;
};

export type PaperclipCompanySecret = {
  id: string;
  name: string;
  provider: string;
  externalRef: string | null;
  latestVersion: number;
  description: string | null;
  updatedAt: string;
};

export class BridgeError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "BridgeError";
    this.status = status;
  }
}

const rateLimitAttempts = new Map<string, number[]>();

function parsePositiveInt(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function readLimitForMethod(method: BridgeMethod) {
  if (method === "POST") {
    return parsePositiveInt(process.env.PAPERCLIP_BRIDGE_WRITES_PER_MINUTE, 6);
  }

  return parsePositiveInt(process.env.PAPERCLIP_BRIDGE_READS_PER_MINUTE, 30);
}

function assertRateLimit(userId: string, companyId: string, alias: BridgeAlias, method: BridgeMethod) {
  const limit = readLimitForMethod(method);
  const now = Date.now();
  const windowStart = now - 60_000;
  const key = `${userId}:${companyId}:${method}:${alias}`;
  const attempts = (rateLimitAttempts.get(key) ?? []).filter((timestamp) => timestamp > windowStart);

  if (attempts.length >= limit) {
    throw new BridgeError(
      429,
      "Zu viele Bridge-Anfragen in kurzer Zeit. Bitte warte einen Moment, bevor du es erneut versuchst.",
    );
  }

  attempts.push(now);
  rateLimitAttempts.set(key, attempts);
}

function requireWorkspaceAccess(
  autopilotState: BridgeContext["autopilotState"],
): { companyId: string; bridgePrincipalId: string } {
  if (!autopilotState.companyId || !autopilotState.bridgePrincipalId || !autopilotState.canOpenWorkspace) {
    throw new BridgeError(
      403,
      "Workspace ist noch nicht freigeschaltet. Provisioning, Billing oder Company-Zuordnung fehlen noch.",
    );
  }

  return {
    companyId: autopilotState.companyId,
    bridgePrincipalId: autopilotState.bridgePrincipalId,
  };
}

function filterSearchParams(requestUrl: URL) {
  const searchParams = new URLSearchParams(requestUrl.search);
  searchParams.delete("companyId");
  const serialized = searchParams.toString();
  return serialized ? `?${serialized}` : "";
}

function resolveRouteSpec(
  pathSegments: string[],
  method: string,
  companyId: string,
  requestUrl: URL,
): RouteSpec {
  const alias = pathSegments.join("/");
  const normalizedMethod = method.toUpperCase() as BridgeMethod;
  const search = filterSearchParams(requestUrl);

  if (alias === "dashboard-summary" && normalizedMethod === "GET") {
    return {
      alias: "dashboard-summary",
      method: normalizedMethod,
      targetPath: `/api/companies/${companyId}/dashboard${search}`,
    };
  }

  if (alias === "secret-providers" && normalizedMethod === "GET") {
    return {
      alias: "secret-providers",
      method: normalizedMethod,
      targetPath: `/api/companies/${companyId}/secret-providers`,
    };
  }

  if (alias === "secrets" && (normalizedMethod === "GET" || normalizedMethod === "POST")) {
    return {
      alias: "secrets",
      method: normalizedMethod,
      targetPath: `/api/companies/${companyId}/secrets`,
    };
  }

  throw new BridgeError(404, "Diese Paperclip-Fläche ist im Launch-Wrapper noch nicht freigegeben.");
}

function getPaperclipBaseUrl() {
  const value = process.env.PAPERCLIP_INTERNAL_URL ?? process.env.PAPERCLIP_API_URL ?? "http://paperclip:3100";
  return value.replace(/\/$/, "");
}

async function readForwardBody(request: Request) {
  if (request.method === "GET" || request.method === "HEAD") {
    return undefined;
  }

  const text = await request.text();
  return text.length > 0 ? text : undefined;
}

export function resetBridgeRateLimits() {
  rateLimitAttempts.clear();
}

export async function bridgePaperclipRequest(input: BridgeContext) {
  const { companyId, bridgePrincipalId } = requireWorkspaceAccess(input.autopilotState);
  const requestUrl = new URL(input.request.url);
  const route = resolveRouteSpec(input.pathSegments, input.request.method, companyId, requestUrl);

  assertRateLimit(input.userId, companyId, route.alias, route.method);

  const bridgeSecret = process.env.INTERNAL_BRIDGE_SECRET;
  if (!bridgeSecret) {
    throw new BridgeError(500, "Internal bridge secret is not configured.");
  }

  const baseUrl = getPaperclipBaseUrl();
  const upstreamUrl = `${baseUrl}${route.targetPath}`;
  const baseOrigin = new URL(baseUrl).origin;
  const body = await readForwardBody(input.request);
  const headers = new Headers();

  headers.set("accept", "application/json");
  headers.set("origin", baseOrigin);
  headers.set("x-internal-secret", bridgeSecret);
  headers.set("x-bridge-principal", bridgePrincipalId);

  const contentType = input.request.headers.get("content-type");
  if (contentType) {
    headers.set("content-type", contentType);
  }

  return fetch(upstreamUrl, {
    method: route.method,
    headers,
    body,
  });
}

export async function readPaperclipBridgeJson<T>(input: BridgeContext) {
  const response = await bridgePaperclipRequest(input);
  const data = await response.json();

  if (!response.ok) {
    const message =
      data && typeof data === "object" && "error" in data && typeof data.error === "string"
        ? data.error
        : "Paperclip bridge request failed";
    throw new BridgeError(response.status, message);
  }

  return data as T;
}
