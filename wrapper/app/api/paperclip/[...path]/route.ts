import { auth, clerkClient } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { summarizeAutopilotState } from "@/lib/autopilot-metadata";
import {
  isLlmReadinessReady,
  normalizeAutopilotLlmReadinessMetadata,
} from "@/lib/llm-readiness";
import {
  buildAgentConfigWithLlmSecret,
  getCanonicalLlmSecretName,
  planAgentLlmBindings,
  resolveLlmProviderFromSecretName,
} from "@/lib/llm-connections";
import { canTargetCompany, listCompanyAgents, updateAgentAdapterConfig } from "@/lib/paperclip-admin";
import {
  BridgeError,
  bridgePaperclipRequest,
  readPaperclipBridgeJson,
  type PaperclipCompanySecret,
} from "@/lib/paperclip-bridge";

type RouteContext = {
  params: Promise<{
    path: string[];
  }>;
};

const WORKSPACE_BASE = "/api/paperclip/workspace";
const WORKSPACE_ASSET_BASE = "/api/paperclip/workspace-assets";
const WORKSPACE_API_BASE = "/api/paperclip/workspace-api";

function isWorkspaceHtml(path: string[], contentType: string | null) {
  return path[0] === "workspace" && (contentType ?? "").includes("text/html");
}

function injectWorkspaceRuntimeConfig(html: string) {
  const runtimeScript = `<script>window.__PAPERCLIP_API_BASE__="${WORKSPACE_API_BASE}";window.__PAPERCLIP_AUTH_BASE__="${WORKSPACE_API_BASE}/auth";window.__PAPERCLIP_BASENAME__="${WORKSPACE_BASE}";window.__PAPERCLIP_SW_PATH__="${WORKSPACE_ASSET_BASE}/sw.js";window.__PAPERCLIP_DISABLE_SW__=true;window.__PAPERCLIP_DISABLE_LIVE_SOCKETS__=true;</script>`;
  return html.includes("</head>") ? html.replace("</head>", `${runtimeScript}</head>`) : `${runtimeScript}${html}`;
}

function rewriteWorkspaceHtml(html: string) {
  return injectWorkspaceRuntimeConfig(
    html
      .replaceAll('"/assets/', `"${WORKSPACE_ASSET_BASE}/assets/`)
      .replaceAll("'/assets/", `'${WORKSPACE_ASSET_BASE}/assets/`)
      .replaceAll('"/sw.js"', `"${WORKSPACE_ASSET_BASE}/sw.js"`)
      .replaceAll("'/sw.js'", `'${WORKSPACE_ASSET_BASE}/sw.js'`)
      .replace(
        /(["'])\/((?:favicon|apple-touch-icon|android-chrome|site\.webmanifest)[^"']*)/g,
        `$1${WORKSPACE_ASSET_BASE}/$2`,
      ),
  );
}

function isSecretCreate(path: string[], method: string) {
  return path.length === 1 && path[0] === "secrets" && method.toUpperCase() === "POST";
}

function isSecretDelete(path: string[], method: string) {
  return path.length === 2 && path[0] === "secrets" && method.toUpperCase() === "DELETE";
}

function isSavedSecretPayload(payload: unknown): payload is { id: string; name: string } {
  return Boolean(
    payload
    && typeof payload === "object"
    && "id" in payload
    && typeof payload.id === "string"
    && "name" in payload
    && typeof payload.name === "string",
  );
}

function asRecord(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
}

function llmReadinessResetSummary(secretName: string) {
  const provider = resolveLlmProviderFromSecretName(secretName);
  if (!provider) {
    return null;
  }

  return "LLM-Verbindung wurde aktualisiert. Bitte den Readiness-Check erneut ausführen, bevor du den Workspace nutzt.";
}

type NormalizedSecretCreatePayload = {
  name: string;
  value: string;
  provider: string;
  description: string | null;
  externalRef: string | null;
} & Record<string, unknown>;

function isAlreadyExistsConflict(status: number, payload: unknown) {
  if (status !== 409 || !payload || typeof payload !== "object") {
    return false;
  }

  const error =
    "error" in payload && typeof payload.error === "string"
      ? payload.error.toLowerCase()
      : "";

  return error.includes("already exists");
}

function normalizeSecretCreatePayload(rawPayload: unknown) {
  if (!rawPayload || typeof rawPayload !== "object" || Array.isArray(rawPayload)) {
    throw new BridgeError(400, "Invalid secret payload.");
  }

  const payload = rawPayload as Record<string, unknown>;
  const originalName = typeof payload.name === "string" ? payload.name.trim() : "";
  const value = typeof payload.value === "string" ? payload.value.trim() : "";
  const provider = typeof payload.provider === "string" ? payload.provider.trim() : "";
  const description =
    typeof payload.description === "string" ? payload.description.trim() : null;
  const externalRef =
    typeof payload.externalRef === "string" ? payload.externalRef.trim() : null;

  if (!originalName || !value || !provider) {
    throw new BridgeError(400, "Name, value and provider are required for secret creation.");
  }

  const llmProvider = resolveLlmProviderFromSecretName(originalName);
  const name = llmProvider
    ? getCanonicalLlmSecretName(llmProvider)
    : originalName;

  return {
    ...payload,
    name,
    value,
    provider,
    description: description || null,
    externalRef: externalRef || null,
  };
}

async function rotateExistingSecret(input: {
  normalizedPayload: NormalizedSecretCreatePayload;
  userId: string;
  autopilotState: ReturnType<typeof summarizeAutopilotState>;
}) {
  const secrets = await readPaperclipBridgeJson<PaperclipCompanySecret[]>({
    request: new Request("http://localhost/api/paperclip/secrets"),
    pathSegments: ["secrets"],
    userId: input.userId,
    autopilotState: input.autopilotState,
  });

  const existing = secrets.find((secret) => secret.name === input.normalizedPayload.name);
  if (!existing) {
    return null;
  }

  const rotateRequest = new Request(
    `http://localhost/api/paperclip/secrets/${existing.id}/rotate`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        value: input.normalizedPayload.value,
        externalRef: input.normalizedPayload.externalRef,
      }),
    },
  );
  const rotateResponse = await bridgePaperclipRequest({
    request: rotateRequest,
    pathSegments: ["secrets", existing.id, "rotate"],
    userId: input.userId,
    autopilotState: input.autopilotState,
  });

  const rotatePayload = await rotateResponse.json().catch(() => null);
  if (!rotateResponse.ok) {
    return {
      status: rotateResponse.status,
      payload: rotatePayload,
    };
  }

  if (
    input.normalizedPayload.description !== null
    && input.normalizedPayload.description !== existing.description
  ) {
    const patchRequest = new Request(`http://localhost/api/paperclip/secrets/${existing.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ description: input.normalizedPayload.description }),
    });

    await bridgePaperclipRequest({
      request: patchRequest,
      pathSegments: ["secrets", existing.id],
      userId: input.userId,
      autopilotState: input.autopilotState,
    }).catch(() => null);
  }

  return {
    status: rotateResponse.status,
    payload: rotatePayload,
  };
}

type CreatedAgentPayload = {
  id: string;
  name: string;
  role: string;
  adapterType: string;
  adapterConfig: Record<string, unknown>;
};

function isWorkspaceAgentCreate(path: string[], method: string) {
  return path.length === 2
    && path[0] === "workspace-api"
    && path[1] === "agents"
    && method.toUpperCase() === "POST";
}

function isWorkspaceExecutionPath(path: string[]) {
  return path[0] === "workspace" || path[0] === "workspace-api";
}

function isCreatedAgentPayload(payload: unknown): payload is CreatedAgentPayload {
  return Boolean(
    payload
      && typeof payload === "object"
      && "id" in payload
      && typeof payload.id === "string"
      && "name" in payload
      && typeof payload.name === "string"
      && "role" in payload
      && typeof payload.role === "string"
      && "adapterType" in payload
      && typeof payload.adapterType === "string"
      && "adapterConfig" in payload
      && typeof payload.adapterConfig === "object"
      && payload.adapterConfig !== null
      && !Array.isArray(payload.adapterConfig),
  );
}

async function bindSavedLlmSecretToCompanyAgents(input: {
  autopilotState: ReturnType<typeof summarizeAutopilotState>;
  secret: { id: string; name: string };
}) {
  const target = input.autopilotState;

  if (!canTargetCompany(target)) {
    return;
  }

  const agents = await listCompanyAgents({
    companyId: target.companyId,
    bridgePrincipalId: target.bridgePrincipalId,
  });

  const updates = planAgentLlmBindings({
    secretId: input.secret.id,
    secretName: input.secret.name,
    agents: agents.map((agent) => ({
      id: agent.id,
      name: agent.name,
      role: agent.role,
      adapterType: agent.adapterType,
      adapterConfig:
        typeof agent.adapterConfig === "object" && agent.adapterConfig !== null && !Array.isArray(agent.adapterConfig)
          ? agent.adapterConfig
          : {},
    })),
  });

  await Promise.all(
    updates.map((update) =>
      updateAgentAdapterConfig({
        agentId: update.agentId,
        bridgePrincipalId: target.bridgePrincipalId,
        adapterConfig: update.nextAdapterConfig,
      }),
    ),
  );
}

async function bindExistingLlmSecretToCreatedAgent(input: {
  userId: string;
  autopilotState: ReturnType<typeof summarizeAutopilotState>;
  agent: CreatedAgentPayload;
}) {
  const target = input.autopilotState;
  if (!canTargetCompany(target)) {
    return;
  }

  const secrets = await readPaperclipBridgeJson<PaperclipCompanySecret[]>({
    request: new Request("http://localhost/api/paperclip/secrets"),
    pathSegments: ["secrets"],
    userId: input.userId,
    autopilotState: input.autopilotState,
  });

  for (const secret of secrets) {
    const nextAdapterConfig = buildAgentConfigWithLlmSecret({
      agentAdapterType: input.agent.adapterType,
      adapterConfig: input.agent.adapterConfig,
      secretId: secret.id,
      secretName: secret.name,
    });

    if (!nextAdapterConfig) {
      continue;
    }

    await updateAgentAdapterConfig({
      agentId: input.agent.id,
      bridgePrincipalId: target.bridgePrincipalId,
      adapterConfig: nextAdapterConfig,
    });

    return;
  }
}

async function handleBridgeRequest(request: Request, context: RouteContext) {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { path } = await context.params;
  const client = await clerkClient();
  const user = await client.users.getUser(userId);
  const autopilotState = summarizeAutopilotState(user.publicMetadata, userId);
  const privateMetadata = asRecord(user.privateMetadata);
  const llmReadiness = normalizeAutopilotLlmReadinessMetadata(
    privateMetadata.autopilotLlmReadiness,
  );

  if (isWorkspaceExecutionPath(path) && !isLlmReadinessReady(llmReadiness)) {
    return NextResponse.json(
      {
        error:
          "LLM-Zugang ist noch nicht als bereit verifiziert. Bitte zuerst in Connections den Readiness-Check erfolgreich abschließen.",
        summary: llmReadiness.summary,
        nextStepHref: "/app/connections?preset=openai",
      },
      { status: 409 },
    );
  }

  try {
    let bridgeRequest = request;
    let normalizedSecretPayload: NormalizedSecretCreatePayload | null = null;
    if (isSecretCreate(path, request.method)) {
      const rawPayload = await request.json().catch(() => null);
      const normalizedPayload = normalizeSecretCreatePayload(rawPayload);
      normalizedSecretPayload = normalizedPayload;
      const headers = new Headers(request.headers);
      headers.set("content-type", "application/json");
      bridgeRequest = new Request(request.url, {
        method: request.method,
        headers,
        body: JSON.stringify(normalizedPayload),
      });
    }

    const upstream = await bridgePaperclipRequest({
      request: bridgeRequest,
      pathSegments: path,
      userId,
      autopilotState,
    });

    const contentType = upstream.headers.get("content-type");
    const headers = new Headers();
    if (contentType) {
      headers.set("content-type", contentType);
    }
    const cacheControl = upstream.headers.get("cache-control");
    if (cacheControl) {
      headers.set("cache-control", cacheControl);
    }

    if (isWorkspaceHtml(path, contentType)) {
      return new Response(rewriteWorkspaceHtml(await upstream.text()), {
        status: upstream.status,
        headers,
      });
    }

    if (isSecretCreate(path, request.method) && (contentType ?? "").includes("application/json")) {
      let responseStatus = upstream.status;
      let payload = await upstream.json().catch(() => null);

      if (
        normalizedSecretPayload
        && isAlreadyExistsConflict(upstream.status, payload)
      ) {
        const rotated = await rotateExistingSecret({
          normalizedPayload: normalizedSecretPayload,
          userId,
          autopilotState,
        });

        if (rotated) {
          responseStatus = rotated.status;
          payload = rotated.payload;
        }
      }

      if (responseStatus >= 200 && responseStatus < 300 && isSavedSecretPayload(payload)) {
        await bindSavedLlmSecretToCompanyAgents({
          autopilotState,
          secret: payload,
        });

        const resetSummary = llmReadinessResetSummary(payload.name);
        if (resetSummary) {
          await client.users.updateUserMetadata(userId, {
            privateMetadata: {
              ...privateMetadata,
              autopilotLlmReadiness: {
                status: "blocked",
                summary: resetSummary,
                probedAdapterType: null,
                checkedAt: null,
              },
            },
          });
        }
      }

      return NextResponse.json(payload, { status: responseStatus, headers });
    }

    if (isSecretDelete(path, request.method) && (contentType ?? "").includes("application/json")) {
      const payload = await upstream.json().catch(() => null);

      if (upstream.ok) {
        await client.users.updateUserMetadata(userId, {
          privateMetadata: {
            ...privateMetadata,
            autopilotLlmReadiness: {
              status: "blocked",
              summary:
                "LLM-Verbindung wurde entfernt. Bitte in Connections einen aktiven Key speichern und den Readiness-Check erneut ausführen.",
              probedAdapterType: null,
              checkedAt: null,
            },
          },
        });
      }

      return NextResponse.json(payload, { status: upstream.status, headers });
    }

    if (isWorkspaceAgentCreate(path, request.method) && (contentType ?? "").includes("application/json")) {
      const payload = await upstream.json().catch(() => null);

      if (upstream.ok && isCreatedAgentPayload(payload)) {
        await bindExistingLlmSecretToCreatedAgent({
          userId,
          autopilotState,
          agent: payload,
        });
      }

      return NextResponse.json(payload, { status: upstream.status, headers });
    }

    return new Response(await upstream.arrayBuffer(), {
      status: upstream.status,
      headers,
    });
  } catch (error) {
    if (error instanceof BridgeError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    throw error;
  }
}

export async function GET(request: Request, context: RouteContext) {
  return handleBridgeRequest(request, context);
}

export async function POST(request: Request, context: RouteContext) {
  return handleBridgeRequest(request, context);
}

export async function PUT(request: Request, context: RouteContext) {
  return handleBridgeRequest(request, context);
}

export async function PATCH(request: Request, context: RouteContext) {
  return handleBridgeRequest(request, context);
}

export async function DELETE(request: Request, context: RouteContext) {
  return handleBridgeRequest(request, context);
}
