import { auth, clerkClient } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { normalizeCompanyHqProfile } from "@/lib/company-hq";

function readRequiredField(body: unknown, key: string) {
  const value = body && typeof body === "object" ? (body as Record<string, unknown>)[key] : undefined;

  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export async function POST(request: Request) {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const nextInput = {
    companyGoal: readRequiredField(body, "companyGoal"),
    offer: readRequiredField(body, "offer"),
    audience: readRequiredField(body, "audience"),
    tone: readRequiredField(body, "tone"),
    priorities: readRequiredField(body, "priorities"),
  };

  if (Object.values(nextInput).some((value) => value === null)) {
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
