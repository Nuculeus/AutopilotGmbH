import { auth, clerkClient } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { normalizeCompanyHqProfile } from "@/lib/company-hq";
import {
  advanceMilestoneFromEvent,
  normalizeAutopilotRevenueMetadata,
  withFirstValueEvent,
  withRevenueEvent,
} from "@/lib/revenue-events";

type RevenueEventPayload =
  | {
      event: "first_value_created";
      summary?: string;
    }
  | {
      event: "first_offer_live";
      summary?: string;
    };

function isValidPayload(value: unknown): value is RevenueEventPayload {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const source = value as Record<string, unknown>;
  return source.event === "first_value_created" || source.event === "first_offer_live";
}

export async function POST(request: Request) {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!isValidPayload(body)) {
    return NextResponse.json({ error: "Invalid revenue event payload" }, { status: 400 });
  }

  const now = new Date().toISOString();
  const summary = typeof body.summary === "string" ? body.summary.trim() : "";
  const client = await clerkClient();
  const user = await client.users.getUser(userId);
  const currentProfile = normalizeCompanyHqProfile(user.privateMetadata?.autopilotCompanyHq);
  const currentRevenue = normalizeAutopilotRevenueMetadata(
    user.privateMetadata?.autopilotRevenue,
  );

  const nextRevenue =
    body.event === "first_value_created"
      ? withFirstValueEvent({
          current: currentRevenue,
          createdAt: now,
          summary: summary || null,
          revenueTrack: currentProfile.revenueTrack,
        })
      : withRevenueEvent({
          current: currentRevenue,
          event: {
            kind: "offer_live",
            createdAt: now,
            source: "workspace",
            amountCents: null,
            currency: null,
            externalRef: null,
          },
        });

  const nextMilestone = advanceMilestoneFromEvent({
    current: currentProfile.nextMilestone,
    kind: body.event === "first_value_created" ? "first_value_created" : "offer_live",
  });
  const nextProfile = {
    ...currentProfile,
    nextMilestone,
    updatedAt: now,
  };

  await client.users.updateUserMetadata(userId, {
    privateMetadata: {
      ...user.privateMetadata,
      autopilotCompanyHq: nextProfile,
      autopilotRevenue: nextRevenue,
    },
  });

  return NextResponse.json({
    nextMilestone,
    profile: nextProfile,
    revenue: nextRevenue,
  });
}
