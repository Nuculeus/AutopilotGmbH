import { clerkClient } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { CREDIT_POLICY, normalizeCreditMetadata } from "@/lib/credits";
import { getStripe } from "@/lib/stripe";

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  const secret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!process.env.STRIPE_SECRET_KEY || !secret || !signature) {
    return NextResponse.json(
      { error: "Missing Stripe webhook configuration" },
      { status: 400 },
    );
  }

  const payload = await request.text();

  try {
    const stripe = getStripe();
    const event = stripe.webhooks.constructEvent(payload, signature, secret);

    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const clerkUserId = session.metadata?.clerkUserId;
      const targetPlan = session.metadata?.targetPlan;

      if (clerkUserId) {
        const client = await clerkClient();
        const user = await client.users.getUser(clerkUserId);
        const current = normalizeCreditMetadata(
          user.publicMetadata?.autopilotCredits,
        );

        await client.users.updateUserMetadata(clerkUserId, {
          publicMetadata: {
            autopilotCredits: {
              ...current,
              plan: targetPlan === "pro" ? "pro" : "starter",
            },
          },
          privateMetadata: {
            stripeCustomerId:
              typeof session.customer === "string" ? session.customer : null,
            lastCheckoutSessionId: session.id,
          },
        });
      }

      console.log("stripe.checkout.session.completed", {
        checkoutSessionId: session.id,
        clerkUserId,
        targetPlan,
        starterMonthlyCredits: CREDIT_POLICY.starterMonthlyCredits,
      });
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown webhook error";

    return NextResponse.json({ error: message }, { status: 400 });
  }
}
