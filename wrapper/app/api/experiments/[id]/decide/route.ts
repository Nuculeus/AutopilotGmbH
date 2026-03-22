import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { ControlPlaneError, decideExperimentForUser } from "@/lib/control-plane-store";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

function parseBody(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const source = value as Record<string, unknown>;
  const decision = source.decision === "keep" || source.decision === "discard"
    ? source.decision
    : null;

  if (!decision) {
    return null;
  }

  return {
    decision,
    reason:
      typeof source.reason === "string" && source.reason.trim().length > 0
        ? source.reason.trim()
        : null,
  } as {
    decision: "keep" | "discard";
    reason: string | null;
  };
}

export async function POST(request: Request, context: RouteContext) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  if (!id || id.trim().length === 0) {
    return NextResponse.json({ error: "Experiment ID fehlt." }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const payload = parseBody(body);
  if (!payload) {
    return NextResponse.json(
      { error: "Invalid decision payload" },
      { status: 400 },
    );
  }

  try {
    const result = await decideExperimentForUser({
      clerkUserId: userId,
      experimentId: id,
      decision: payload.decision,
      reason: payload.reason,
    });

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    if (error instanceof ControlPlaneError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json(
      { error: "Experiment-Entscheidung konnte nicht gespeichert werden." },
      { status: 500 },
    );
  }
}
