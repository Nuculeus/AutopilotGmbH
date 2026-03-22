import { auth, clerkClient } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { hasAdminBillingBypass } from "@/lib/admin-access";
import { summarizeAutopilotState } from "@/lib/autopilot-metadata";
import { hasStoredCompanyHqBriefing, normalizeCompanyHqProfile } from "@/lib/company-hq";
import { bootstrapCompany } from "@/lib/paperclip-admin";

function isBrowserNavigation(request: Request) {
  const accept = request.headers.get("accept") ?? "";
  const contentType = request.headers.get("content-type") ?? "";
  const secFetchMode = request.headers.get("sec-fetch-mode") ?? "";

  return (
    accept.includes("text/html") ||
    contentType.includes("application/x-www-form-urlencoded") ||
    secFetchMode === "navigate"
  );
}

function redirectToLaunch(request: Request) {
  return NextResponse.redirect(new URL("/launch", request.url), { status: 303 });
}

export async function POST(request: Request) {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const client = await clerkClient();
  const user = await client.users.getUser(userId);
  const autopilotState = summarizeAutopilotState(user.publicMetadata, userId);
  const hasBillingBypass = hasAdminBillingBypass(
    user as Parameters<typeof hasAdminBillingBypass>[0],
  );
  const browserNavigation = isBrowserNavigation(request);

  if (autopilotState.companyId && autopilotState.provisioningStatus === "active") {
    const payload = {
      paperclipCompanyId: autopilotState.companyId,
      companyName: autopilotState.companyName,
      bridgePrincipalId: autopilotState.bridgePrincipalId,
      status: "existing",
    };

    return browserNavigation ? redirectToLaunch(request) : NextResponse.json(payload);
  }

  if (autopilotState.creditSummary.availableCredits <= 0 && !hasBillingBypass) {
    return NextResponse.json(
      { error: "No credits or active plan available" },
      { status: 402 },
    );
  }

  const briefingProfile = normalizeCompanyHqProfile(user.privateMetadata?.autopilotCompanyHq);
  if (!hasStoredCompanyHqBriefing(briefingProfile)) {
    return NextResponse.json(
      { error: "Briefing fehlt. Bitte schliesse zuerst das Guided Onboarding ab." },
      { status: 409 },
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

    return browserNavigation ? redirectToLaunch(request) : NextResponse.json(result);
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
