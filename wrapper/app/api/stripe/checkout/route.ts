import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
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
  const stripe = getStripe();
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [
      {
        price: getStarterPriceId(),
        quantity: 1,
      },
    ],
    success_url: `${baseUrl}/dashboard?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${baseUrl}/start?checkout=cancelled`,
    allow_promotion_codes: true,
    metadata: {
      clerkUserId: userId,
      flow: "autopilot-company-start",
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
