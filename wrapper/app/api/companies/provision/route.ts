import { auth, clerkClient } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { summarizeAutopilotState } from "@/lib/autopilot-metadata";
import { bootstrapCompany } from "@/lib/paperclip-admin";

export async function POST(request: Request) {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const client = await clerkClient();
  const user = await client.users.getUser(userId);
  const autopilotState = summarizeAutopilotState(user.publicMetadata, userId);

  if (autopilotState.companyId && autopilotState.provisioningStatus === "active") {
    return NextResponse.json({
      paperclipCompanyId: autopilotState.companyId,
      companyName: autopilotState.companyName,
      bridgePrincipalId: autopilotState.bridgePrincipalId,
      status: "existing",
    });
  }

  if (autopilotState.creditSummary.availableCredits <= 0) {
    return NextResponse.json(
      { error: "No credits or active plan available" },
      { status: 402 },
    );
  }

  const body = (await request.json().catch(() => null)) as {
    name?: string;
    idea?: string;
  } | null;
  const name = body?.name?.trim() || "Meine Autopilot GmbH";
  const idea = body?.idea?.trim() || null;

  await client.users.updateUserMetadata(userId, {
    publicMetadata: {
      ...user.publicMetadata,
      autopilotProvisioning: {
        ...((user.publicMetadata?.autopilotProvisioning as Record<string, unknown> | undefined) ?? {}),
        companyName: name,
        provisioningStatus: "pending",
        bridgePrincipalId: `clerk:${userId}`,
        lastError: null,
      },
    },
  });

  try {
    const result = await bootstrapCompany({
      clerkUserId: userId,
      name,
      idea,
    });

    await client.users.updateUserMetadata(userId, {
      publicMetadata: {
        ...user.publicMetadata,
        autopilotProvisioning: {
          companyId: result.paperclipCompanyId,
          companyName: result.companyName,
          provisioningStatus: "active",
          workspaceStatus: "ready",
          bridgePrincipalId: result.bridgePrincipalId,
          lastError: null,
        },
      },
    });

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Paperclip bootstrap failed";

    await client.users.updateUserMetadata(userId, {
      publicMetadata: {
        ...user.publicMetadata,
        autopilotProvisioning: {
          ...((user.publicMetadata?.autopilotProvisioning as Record<string, unknown> | undefined) ?? {}),
          companyName: name,
          provisioningStatus: "failed",
          bridgePrincipalId: `clerk:${userId}`,
          lastError: message,
        },
      },
    });

    return NextResponse.json({ error: message }, { status: 502 });
  }
}
