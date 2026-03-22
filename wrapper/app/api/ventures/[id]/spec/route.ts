import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import type { CompanyHqProfile } from "@/lib/company-hq";
import { ControlPlaneError, patchVentureSpecForUser } from "@/lib/control-plane-store";
import {
  normalizeLaunchRevenueMilestone,
  normalizeRequiredConnections,
  normalizeRevenueTrack,
} from "@/lib/revenue-track";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

function parsePatch(body: unknown): Partial<CompanyHqProfile> {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return {};
  }

  const source = body as Record<string, unknown>;
  const next: Partial<CompanyHqProfile> = {};

  const stringFields: Array<keyof CompanyHqProfile> = [
    "companyGoal",
    "offer",
    "audience",
    "tone",
    "priorities",
    "valueModel",
    "proofTarget",
    "acquisitionChannel",
    "paymentNode",
    "deliveryNode",
  ];

  for (const field of stringFields) {
    const value = source[field];
    if (typeof value === "string") {
      next[field] = value.trim() as never;
    }
  }

  const revenueTrack = normalizeRevenueTrack(source.revenueTrack);
  if (revenueTrack) {
    next.revenueTrack = revenueTrack;
  }

  const requiredConnections = normalizeRequiredConnections(source.requiredConnections);
  if (requiredConnections.length > 0) {
    next.requiredConnections = requiredConnections;
  }

  const nextMilestone = normalizeLaunchRevenueMilestone(source.nextMilestone);
  if (nextMilestone) {
    next.nextMilestone = nextMilestone;
  }

  if (typeof source.budgetCapCents === "number" && Number.isFinite(source.budgetCapCents)) {
    next.budgetCapCents = Math.max(0, Math.floor(source.budgetCapCents));
  }

  if (
    source.autonomyLevel === "guided" ||
    source.autonomyLevel === "semi_auto" ||
    source.autonomyLevel === "auto"
  ) {
    next.autonomyLevel = source.autonomyLevel;
  }

  return next;
}

export async function PATCH(request: Request, context: RouteContext) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  if (!id || id.trim().length === 0) {
    return NextResponse.json({ error: "Venture ID fehlt." }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const patch = parsePatch(body);

  try {
    const profile = await patchVentureSpecForUser({
      clerkUserId: userId,
      ventureId: id,
      patch,
    });

    return NextResponse.json({
      ventureId: id,
      profile,
    });
  } catch (error) {
    if (error instanceof ControlPlaneError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json(
      { error: "Venture-Spec konnte nicht aktualisiert werden." },
      { status: 500 },
    );
  }
}
