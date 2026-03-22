import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { ControlPlaneError, createVentureForUser } from "@/lib/control-plane-store";
import { normalizeRevenueTrack, type RevenueTrack } from "@/lib/revenue-track";

function readBody(value: unknown): {
  name: string;
  revenueTrack: RevenueTrack;
} {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {
      name: "Neues Venture",
      revenueTrack: "service_business",
    };
  }

  const source = value as Record<string, unknown>;
  const name = typeof source.name === "string" && source.name.trim().length > 0
    ? source.name.trim()
    : "Neues Venture";
  const revenueTrack = (normalizeRevenueTrack(source.revenueTrack) ?? "service_business") as RevenueTrack;

  return {
    name,
    revenueTrack,
  };
}

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const input = readBody(body);

  try {
    const venture = await createVentureForUser({
      clerkUserId: userId,
      name: input.name,
      revenueTrack: input.revenueTrack,
    });

    return NextResponse.json(venture, { status: 201 });
  } catch (error) {
    if (error instanceof ControlPlaneError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json(
      { error: "Venture konnte nicht erstellt werden." },
      { status: 500 },
    );
  }
}
