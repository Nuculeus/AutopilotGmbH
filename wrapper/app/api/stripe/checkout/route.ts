import { auth, clerkClient } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { hasAdminBillingBypass } from "@/lib/admin-access";
import { normalizeCreditMetadata } from "@/lib/credits";
import { getAppUrl, getStarterPriceId, getStripe } from "@/lib/stripe";

export async function POST(request: Request) {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.redirect(new URL("/sign-in", request.url));
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json(
      { error: "Missing STRIPE_SECRET_KEY" },
      { status: 500 },
    );
  }

  const baseUrl = getAppUrl(new URL(request.url).origin);
  const client = await clerkClient();
  const user = await client.users.getUser(userId);
  const hasBypass = hasAdminBillingBypass(
    user as Parameters<typeof hasAdminBillingBypass>[0],
  );

  if (hasBypass) {
    const credits = normalizeCreditMetadata(user.publicMetadata?.autopilotCredits);
    const startedAt = new Date().toISOString();

    await client.users.updateUserMetadata(userId, {
      publicMetadata: {
        ...user.publicMetadata,
        autopilotCredits: {
          ...credits,
          plan: credits.plan === "pro" ? "pro" : "starter",
          lastCheckoutSessionId: `admin_bypass_${Date.now()}`,
        },
      },
      privateMetadata: {
        ...user.privateMetadata,
        autopilotBillingBypass: {
          enabled: true,
          activatedAt: startedAt,
          source: "admin_checkout_bypass",
        },
      },
    });

    return NextResponse.redirect(
      new URL("/launch?checkout=admin_bypass", request.url),
      { status: 303 },
    );
  }

  const credits = normalizeCreditMetadata(user.publicMetadata?.autopilotCredits);
  const stripe = getStripe();
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [
      {
        price: getStarterPriceId(),
        quantity: 1,
      },
    ],
    success_url: `${baseUrl}/launch?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${baseUrl}/launch?checkout=cancelled`,
    allow_promotion_codes: true,
    client_reference_id: userId,
    customer: credits.stripeCustomerId || undefined,
    customer_creation: credits.stripeCustomerId ? undefined : "if_required",
    subscription_data: {
      metadata: {
        clerkUserId: userId,
        flow: "autopilot-company-start",
        targetPlan: "starter",
      },
    },
    metadata: {
      clerkUserId: userId,
      flow: "autopilot-company-start",
      targetPlan: "starter",
    },
  });

  if (!session.url) {
    return NextResponse.json(
      { error: "Stripe Checkout session URL missing" },
      { status: 500 },
    );
  }

  return NextResponse.redirect(session.url, { status: 303 });
}
