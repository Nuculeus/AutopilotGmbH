import { auth, clerkClient } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { normalizeCompanyHqProfile } from "@/lib/company-hq";

const companyHqSchema = z.object({
  companyGoal: z.string().trim().min(1),
  offer: z.string().trim().min(1),
  audience: z.string().trim().min(1),
  tone: z.string().trim().min(1),
  priorities: z.string().trim().min(1),
});

export async function POST(request: Request) {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = companyHqSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid Company HQ payload", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const client = await clerkClient();
  const user = await client.users.getUser(userId);
  const current = normalizeCompanyHqProfile(user.privateMetadata?.autopilotCompanyHq);
  const nextProfile = {
    ...current,
    ...parsed.data,
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
