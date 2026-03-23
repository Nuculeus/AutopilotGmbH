import { auth, clerkClient } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { summarizeAutopilotState } from "@/lib/autopilot-metadata";
import { normalizeCompanyHqProfile } from "@/lib/company-hq";
import { upsertCompanyHqForUser } from "@/lib/control-plane-store";
import {
  normalizeLaunchRevenueMilestone,
  normalizeRequiredConnections,
  normalizeRevenueTrack,
} from "@/lib/revenue-track";

function readField(body: unknown, key: string) {
  const value = body && typeof body === "object" ? (body as Record<string, unknown>)[key] : undefined;
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(request: Request) {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const nextInput = {
    companyGoal: readField(body, "companyGoal"),
    offer: readField(body, "offer"),
    audience: readField(body, "audience"),
    tone: readField(body, "tone"),
    priorities: readField(body, "priorities"),
    revenueTrack: normalizeRevenueTrack(
      body && typeof body === "object" ? (body as Record<string, unknown>).revenueTrack : null,
    ),
    valueModel: readField(body, "valueModel"),
    proofTarget: readField(body, "proofTarget"),
    acquisitionChannel: readField(body, "acquisitionChannel"),
    paymentNode: readField(body, "paymentNode"),
    deliveryNode: readField(body, "deliveryNode"),
    requiredConnections: normalizeRequiredConnections(
      body && typeof body === "object" ? (body as Record<string, unknown>).requiredConnections : null,
    ),
    nextMilestone: normalizeLaunchRevenueMilestone(
      body && typeof body === "object" ? (body as Record<string, unknown>).nextMilestone : null,
    ),
    autonomyLevel:
      body && typeof body === "object"
        ? ((body as Record<string, unknown>).autonomyLevel === "semi_auto" ||
            (body as Record<string, unknown>).autonomyLevel === "auto"
            ? (body as Record<string, unknown>).autonomyLevel
            : "guided")
        : "guided",
  };

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json(
      { error: "Invalid Company HQ payload" },
      { status: 400 },
    );
  }

  const client = await clerkClient();
  const user = await client.users.getUser(userId);
  const autopilotState = summarizeAutopilotState(user.publicMetadata, userId);
  const current = normalizeCompanyHqProfile(user.privateMetadata?.autopilotCompanyHq);
  const nextProfile = {
    ...normalizeCompanyHqProfile({
      ...current,
      ...nextInput,
    }),
    updatedAt: new Date().toISOString(),
  };

  await upsertCompanyHqForUser({
    clerkUserId: userId,
    profile: nextProfile,
    autopilotState: {
      companyId: autopilotState.companyId,
      companyName: autopilotState.companyName,
      bridgePrincipalId: autopilotState.bridgePrincipalId,
    },
  });

  await client.users.updateUserMetadata(userId, {
    privateMetadata: {
      ...user.privateMetadata,
      autopilotCompanyHq: nextProfile,
    },
  });

  return NextResponse.json({ profile: nextProfile });
}
