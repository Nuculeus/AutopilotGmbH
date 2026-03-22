import { auth, clerkClient } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import {
  CREDIT_POLICY,
  appendCreditLedgerEntry,
  getLaunchBonusExpiryDate,
  normalizeCreditMetadata,
} from "@/lib/credits";

export async function POST(request: Request) {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.redirect(new URL("/sign-in", request.url), 303);
  }

  const client = await clerkClient();
  const user = await client.users.getUser(userId);
  const current = normalizeCreditMetadata(user.publicMetadata?.autopilotCredits);

  if (current.launchBonusClaimed) {
    return NextResponse.redirect(
      new URL("/launch?credits=already-claimed", request.url),
      303,
    );
  }

  await client.users.updateUserMetadata(userId, {
    publicMetadata: {
      autopilotCredits: {
        ...appendCreditLedgerEntry(current, {
          id: `ledger_launch_bonus_${new Date().toISOString()}`,
          eventKind: "grant",
          creditsDelta: CREDIT_POLICY.launchBonusCredits,
          euroCostCents: 0,
          providerCostCents: 0,
          note: "launch_bonus",
          createdAt: new Date().toISOString(),
        }),
        plan: current.plan === "free" ? "launch" : current.plan,
        launchBonusClaimed: true,
        launchBonusClaimedAt: new Date().toISOString(),
        launchBonusExpiresAt: getLaunchBonusExpiryDate(),
      },
    },
  });

  return NextResponse.redirect(
    new URL(
      `/launch?credits=claimed&bonus=${CREDIT_POLICY.launchBonusCredits}`,
      request.url,
    ),
    303,
  );
}
