import { auth, clerkClient } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { normalizeCompanyHqProfile } from "@/lib/company-hq";

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
  };

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json(
      { error: "Invalid Company HQ payload" },
      { status: 400 },
    );
  }

  const client = await clerkClient();
  const user = await client.users.getUser(userId);
  const current = normalizeCompanyHqProfile(user.privateMetadata?.autopilotCompanyHq);
  const nextProfile = {
    ...current,
    ...nextInput,
    updatedAt: new Date().toISOString(),
  };

  await client.users.updateUserMetadata(userId, {
    privateMetadata: {
      ...user.privateMetadata,
      autopilotCompanyHq: nextProfile,
    },
  });

  return NextResponse.json({ profile: nextProfile });
}
