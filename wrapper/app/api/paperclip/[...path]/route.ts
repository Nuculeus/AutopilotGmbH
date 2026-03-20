import { auth, clerkClient } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { summarizeAutopilotState } from "@/lib/autopilot-metadata";
import { BridgeError, bridgePaperclipRequest } from "@/lib/paperclip-bridge";

type RouteContext = {
  params: Promise<{
    path: string[];
  }>;
};

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

    return new Response(await upstream.text(), {
      status: upstream.status,
      headers: {
        "content-type": upstream.headers.get("content-type") ?? "application/json",
      },
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
