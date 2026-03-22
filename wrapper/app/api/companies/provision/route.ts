import { auth, clerkClient } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { hasAdminBillingBypass } from "@/lib/admin-access";
import { summarizeAutopilotState } from "@/lib/autopilot-metadata";
import { hasStoredCompanyHqBriefing, normalizeCompanyHqProfile } from "@/lib/company-hq";
import { bootstrapCompany } from "@/lib/paperclip-admin";
import {
  claimProvisioningRunForUser,
  getProvisioningRunForUser,
  markProvisioningRunFailed,
  markProvisioningRunStarted,
  markProvisioningRunSucceeded,
} from "@/lib/provisioning-store";

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

  const durableProvisioning = await getProvisioningRunForUser({ clerkUserId: userId });
  if (
    durableProvisioning?.status === "succeeded" &&
    durableProvisioning.paperclipCompanyId &&
    durableProvisioning.bridgePrincipalId
  ) {
    const payload = {
      paperclipCompanyId: durableProvisioning.paperclipCompanyId,
      companyName: durableProvisioning.companyName,
      bridgePrincipalId: durableProvisioning.bridgePrincipalId,
      status: "existing",
    };

    await client.users.updateUserMetadata(userId, {
      publicMetadata: {
        ...user.publicMetadata,
        autopilotProvisioning: {
          companyId: durableProvisioning.paperclipCompanyId,
          companyName: durableProvisioning.companyName,
          provisioningStatus: "active",
          workspaceStatus: "ready",
          bridgePrincipalId: durableProvisioning.bridgePrincipalId,
          lastError: null,
        },
      },
    });

    return browserNavigation ? redirectToLaunch(request) : NextResponse.json(payload);
  }

  if (durableProvisioning?.status === "pending" || durableProvisioning?.status === "running") {
    const payload = {
      provisioningRunId: durableProvisioning.id,
      companyName: durableProvisioning.companyName,
      status: "pending",
    };

    return browserNavigation ? redirectToLaunch(request) : NextResponse.json(payload, { status: 202 });
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

  const claim = await claimProvisioningRunForUser({
    clerkUserId: userId,
    companyName: name,
    idea,
  });

  if (claim?.action === "existing" && claim.record.paperclipCompanyId && claim.record.bridgePrincipalId) {
    const payload = {
      paperclipCompanyId: claim.record.paperclipCompanyId,
      companyName: claim.record.companyName,
      bridgePrincipalId: claim.record.bridgePrincipalId,
      status: "existing",
    };

    return browserNavigation ? redirectToLaunch(request) : NextResponse.json(payload);
  }

  if (claim?.action === "pending") {
    const payload = {
      provisioningRunId: claim.record.id,
      companyName: claim.record.companyName,
      status: "pending",
    };

    return browserNavigation ? redirectToLaunch(request) : NextResponse.json(payload, { status: 202 });
  }

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
    if (claim?.record?.id) {
      await markProvisioningRunStarted({ runId: claim.record.id });
    }
    const result = await bootstrapCompany({
      clerkUserId: userId,
      name,
      idea,
    });

    if (claim?.record?.id) {
      await markProvisioningRunSucceeded({
        runId: claim.record.id,
        paperclipCompanyId: result.paperclipCompanyId,
        bridgePrincipalId: result.bridgePrincipalId,
      });
    }

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

    if (claim?.record?.id) {
      await markProvisioningRunFailed({
        runId: claim.record.id,
        error: message,
        retryEligible: true,
      });
    }

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
