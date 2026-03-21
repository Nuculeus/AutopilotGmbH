import { auth, clerkClient } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { summarizeAutopilotState } from "@/lib/autopilot-metadata";
import { BridgeError, bridgePaperclipRequest } from "@/lib/paperclip-bridge";

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
