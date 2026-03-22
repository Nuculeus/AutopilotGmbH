import { auth, clerkClient } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { summarizeAutopilotState } from "@/lib/autopilot-metadata";
import {
  buildAgentConfigWithLlmSecret,
  planAgentLlmBindings,
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

  try {
    const upstream = await bridgePaperclipRequest({
      request,
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
      const payload = await upstream.json().catch(() => null);

      if (upstream.ok && isSavedSecretPayload(payload)) {
        await bindSavedLlmSecretToCompanyAgents({
          autopilotState,
          secret: payload,
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
