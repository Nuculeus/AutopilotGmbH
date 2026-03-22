import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { ControlPlaneError, queueRunForUser } from "@/lib/control-plane-store";

type RunPayload = {
  ventureId: string;
  kind: string;
  payload?: unknown;
  requestedBudgetCents?: number | null;
  heavyUsage?: boolean;
  allowHeavyPassThrough?: boolean;
};

function parsePayload(value: unknown): RunPayload | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const source = value as Record<string, unknown>;
  const ventureId = typeof source.ventureId === "string" ? source.ventureId.trim() : "";
  const kind = typeof source.kind === "string" ? source.kind.trim() : "";

  if (!ventureId || !kind) {
    return null;
  }

  return {
    ventureId,
    kind,
    payload: source.payload,
    requestedBudgetCents:
      typeof source.requestedBudgetCents === "number" && Number.isFinite(source.requestedBudgetCents)
        ? Math.max(0, Math.floor(source.requestedBudgetCents))
        : null,
    heavyUsage: source.heavyUsage === true,
    allowHeavyPassThrough: source.allowHeavyPassThrough === true,
  };
}

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const payload = parsePayload(body);
  if (!payload) {
    return NextResponse.json(
      { error: "Invalid run payload" },
      { status: 400 },
    );
  }

  try {
    const result = await queueRunForUser({
      clerkUserId: userId,
      input: payload,
    });

    if (result.status === "blocked") {
      return NextResponse.json(
        {
          error: "Run blocked by approval gate",
          reason: result.reason,
          approvalGateId: result.approvalGateId,
        },
        { status: 409 },
      );
    }

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof ControlPlaneError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json({ error: "Run konnte nicht gestartet werden." }, { status: 500 });
  }
}
