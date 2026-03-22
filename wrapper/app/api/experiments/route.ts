import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { ControlPlaneError, createExperimentForUser } from "@/lib/control-plane-store";

type ExperimentPayload = {
  ventureId: string;
  hypothesis: string;
  targetMetric: string;
  guardrails?: Record<string, unknown> | null;
  variants: Array<{
    label: string;
    payload: Record<string, unknown>;
    trafficWeight?: number;
  }>;
};

function parsePayload(value: unknown): ExperimentPayload | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const source = value as Record<string, unknown>;
  const ventureId = typeof source.ventureId === "string" ? source.ventureId.trim() : "";
  const hypothesis = typeof source.hypothesis === "string" ? source.hypothesis.trim() : "";
  const targetMetric = typeof source.targetMetric === "string" ? source.targetMetric.trim() : "";

  if (!ventureId || !hypothesis || !targetMetric) {
    return null;
  }

  const rawVariants = Array.isArray(source.variants) ? source.variants : [];
  const variants = rawVariants
    .map((item) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) {
        return null;
      }
      const row = item as Record<string, unknown>;
      const label = typeof row.label === "string" ? row.label.trim() : "";
      const payload =
        row.payload && typeof row.payload === "object" && !Array.isArray(row.payload)
          ? (row.payload as Record<string, unknown>)
          : {};

      if (!label) {
        return null;
      }

      return {
        label,
        payload,
        trafficWeight:
          typeof row.trafficWeight === "number" && Number.isFinite(row.trafficWeight)
            ? Math.max(1, Math.floor(row.trafficWeight))
            : undefined,
      };
    })
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));

  if (variants.length === 0) {
    return null;
  }

  const guardrails =
    source.guardrails && typeof source.guardrails === "object" && !Array.isArray(source.guardrails)
      ? (source.guardrails as Record<string, unknown>)
      : null;

  return {
    ventureId,
    hypothesis,
    targetMetric,
    guardrails,
    variants,
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
    return NextResponse.json({ error: "Invalid experiment payload" }, { status: 400 });
  }

  try {
    const result = await createExperimentForUser({
      clerkUserId: userId,
      input: payload,
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof ControlPlaneError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json({ error: "Experiment konnte nicht erstellt werden." }, { status: 500 });
  }
}
