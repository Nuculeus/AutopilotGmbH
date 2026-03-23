import { auth, clerkClient } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { normalizeCompanyHqProfile } from "@/lib/company-hq";
import { recordRevenueEventForUser, upsertCompanyHqForUser } from "@/lib/control-plane-store";
import {
  advanceMilestoneFromEvent,
  normalizeAutopilotRevenueMetadata,
  withFirstValueEvent,
  withRevenueEvent,
} from "@/lib/revenue-events";
import { defaultServiceRevenueSummary } from "@/lib/service-engine";

type RevenueEventPayload = {
  event:
    | "first_value_created"
    | "first_offer_live"
    | "offer_live"
    | "checkout_live"
    | "first_checkout_live"
    | "revenue_recorded"
    | "first_revenue_recorded"
    | "payment_failed";
  summary?: string;
  source?: "workspace" | "stripe" | "system";
  attribution?: string;
  runId?: string;
  amountCents?: number;
  currency?: string;
  externalRef?: string;
  ventureId?: string;
};

function isValidPayload(value: unknown): value is RevenueEventPayload {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const source = value as Record<string, unknown>;
  return (
    source.event === "first_value_created" ||
    source.event === "first_offer_live" ||
    source.event === "offer_live" ||
    source.event === "checkout_live" ||
    source.event === "first_checkout_live" ||
    source.event === "revenue_recorded" ||
    source.event === "first_revenue_recorded" ||
    source.event === "payment_failed"
  );
}

function normalizeEventName(event: RevenueEventPayload["event"]) {
  if (event === "first_offer_live") return "offer_live" as const;
  if (event === "first_checkout_live") return "checkout_live" as const;
  if (event === "first_revenue_recorded") return "revenue_recorded" as const;
  return event;
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

  const client = await clerkClient();
  const user = await client.users.getUser(userId);
  const normalizedEvent = normalizeEventName(body.event);
  const now = new Date().toISOString();
  const currentProfile = normalizeCompanyHqProfile(user.privateMetadata?.autopilotCompanyHq);
  const summary =
    typeof body.summary === "string" && body.summary.trim().length > 0
      ? body.summary.trim()
      : currentProfile.revenueTrack === "service_business"
        ? defaultServiceRevenueSummary({
            event: normalizedEvent,
            profile: currentProfile,
          })
        : "";
  const source = body.source === "workspace" || body.source === "stripe" ? body.source : "system";
  const currentRevenue = normalizeAutopilotRevenueMetadata(
    user.privateMetadata?.autopilotRevenue,
  );

  const nextRevenue =
    normalizedEvent === "first_value_created"
      ? withFirstValueEvent({
          current: currentRevenue,
          createdAt: now,
          summary: summary || null,
          revenueTrack: currentProfile.revenueTrack,
        })
      : withRevenueEvent({
          current: currentRevenue,
          event: {
            kind: normalizedEvent,
            createdAt: now,
            source,
            amountCents: typeof body.amountCents === "number" ? body.amountCents : null,
            currency: typeof body.currency === "string" ? body.currency : null,
            externalRef: typeof body.externalRef === "string" ? body.externalRef : null,
          },
        });

  const nextMilestone = advanceMilestoneFromEvent({
    current: currentProfile.nextMilestone,
    kind: normalizedEvent,
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
  await upsertCompanyHqForUser({
    clerkUserId: userId,
    profile: nextProfile,
  });
  const controlPlaneRevenue = await recordRevenueEventForUser({
    clerkUserId: userId,
    event: {
      ventureId: typeof body.ventureId === "string" ? body.ventureId : nextProfile.ventureId,
      kind: normalizedEvent,
      source,
      attribution: typeof body.attribution === "string" ? body.attribution : null,
      runId: typeof body.runId === "string" ? body.runId : null,
      amountCents: typeof body.amountCents === "number" ? body.amountCents : null,
      currency: typeof body.currency === "string" ? body.currency : null,
      externalRef: typeof body.externalRef === "string" ? body.externalRef : null,
      summary: summary || null,
      createdAt: now,
    },
  });

  return NextResponse.json({
    nextMilestone,
    profile: nextProfile,
    revenue: nextRevenue,
    controlPlaneRevenue,
  });
}
