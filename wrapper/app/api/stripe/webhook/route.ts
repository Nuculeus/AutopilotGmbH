import { clerkClient } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { normalizeCompanyHqProfile } from "@/lib/company-hq";
import { CREDIT_POLICY, normalizeCreditMetadata } from "@/lib/credits";
import {
  advanceMilestoneFromEvent,
  normalizeAutopilotRevenueMetadata,
  withProcessedStripeEvent,
  withRevenueEvent,
} from "@/lib/revenue-events";
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
        const currentProfile = normalizeCompanyHqProfile(
          user.privateMetadata?.autopilotCompanyHq,
        );
        const currentRevenue = normalizeAutopilotRevenueMetadata(
          user.privateMetadata?.autopilotRevenue,
        );

        if (currentRevenue.processedStripeEventIds.includes(event.id)) {
          return NextResponse.json({ received: true, duplicate: true });
        }
        const createdAt = new Date().toISOString();

        let nextRevenue = withRevenueEvent({
          current: currentRevenue,
          event: {
            kind: "checkout_live",
            createdAt,
            source: "stripe",
            amountCents: typeof session.amount_total === "number" ? session.amount_total : null,
            currency: typeof session.currency === "string" ? session.currency : null,
            externalRef: session.id,
          },
        });
        let nextMilestone = advanceMilestoneFromEvent({
          current: currentProfile.nextMilestone,
          kind: "checkout_live",
        });

        if (session.payment_status === "paid") {
          nextRevenue = withRevenueEvent({
            current: nextRevenue,
            event: {
              kind: "revenue_recorded",
              createdAt,
              source: "stripe",
              amountCents: typeof session.amount_total === "number" ? session.amount_total : null,
              currency: typeof session.currency === "string" ? session.currency : null,
              externalRef: session.id,
            },
          });
          nextMilestone = advanceMilestoneFromEvent({
            current: nextMilestone,
            kind: "revenue_recorded",
          });
          nextRevenue = {
            ...nextRevenue,
            payoutStatus: {
              status: "paid",
              lastUpdatedAt: createdAt,
              lastPayoutAt: createdAt,
              note: "checkout_session_paid",
            },
          };
        }

        nextRevenue = withProcessedStripeEvent({
          current: nextRevenue,
          eventId: event.id,
          updatedAt: createdAt,
        });

        await client.users.updateUserMetadata(clerkUserId, {
          publicMetadata: {
            ...user.publicMetadata,
            autopilotCredits: {
              ...current,
              plan: targetPlan === "pro" ? "pro" : "starter",
            },
          },
          privateMetadata: {
            ...user.privateMetadata,
            autopilotCompanyHq: {
              ...currentProfile,
              nextMilestone,
              updatedAt: createdAt,
            },
            autopilotRevenue: nextRevenue,
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

    if (event.type === "invoice.paid") {
      const invoice = event.data.object;
      const clerkUserId = invoice.metadata?.clerkUserId;

      if (clerkUserId) {
        const client = await clerkClient();
        const user = await client.users.getUser(clerkUserId);
        const currentProfile = normalizeCompanyHqProfile(
          user.privateMetadata?.autopilotCompanyHq,
        );
        const currentRevenue = normalizeAutopilotRevenueMetadata(
          user.privateMetadata?.autopilotRevenue,
        );

        if (currentRevenue.processedStripeEventIds.includes(event.id)) {
          return NextResponse.json({ received: true, duplicate: true });
        }

        const createdAt = new Date().toISOString();
        let nextRevenue = withRevenueEvent({
          current: currentRevenue,
          event: {
            kind: "revenue_recorded",
            createdAt,
            source: "stripe",
            amountCents:
              typeof invoice.amount_paid === "number" ? invoice.amount_paid : null,
            currency: typeof invoice.currency === "string" ? invoice.currency : null,
            externalRef: typeof invoice.id === "string" ? invoice.id : null,
          },
        });
        nextRevenue = withProcessedStripeEvent({
          current: nextRevenue,
          eventId: event.id,
          updatedAt: createdAt,
        });
        nextRevenue = {
          ...nextRevenue,
          payoutStatus: {
            status: "paid",
            lastUpdatedAt: createdAt,
            lastPayoutAt: createdAt,
            note: "invoice_paid",
          },
        };

        const nextMilestone = advanceMilestoneFromEvent({
          current: currentProfile.nextMilestone,
          kind: "revenue_recorded",
        });

        await client.users.updateUserMetadata(clerkUserId, {
          publicMetadata: {
            ...user.publicMetadata,
          },
          privateMetadata: {
            ...user.privateMetadata,
            autopilotCompanyHq: {
              ...currentProfile,
              nextMilestone,
              updatedAt: createdAt,
            },
            autopilotRevenue: nextRevenue,
          },
        });
      }
    }

    if (event.type === "invoice.payment_failed") {
      const invoice = event.data.object;
      const clerkUserId = invoice.metadata?.clerkUserId;

      if (clerkUserId) {
        const client = await clerkClient();
        const user = await client.users.getUser(clerkUserId);
        const currentProfile = normalizeCompanyHqProfile(
          user.privateMetadata?.autopilotCompanyHq,
        );
        const currentRevenue = normalizeAutopilotRevenueMetadata(
          user.privateMetadata?.autopilotRevenue,
        );

        if (currentRevenue.processedStripeEventIds.includes(event.id)) {
          return NextResponse.json({ received: true, duplicate: true });
        }

        const createdAt = new Date().toISOString();
        let nextRevenue = withRevenueEvent({
          current: currentRevenue,
          event: {
            kind: "payment_failed",
            createdAt,
            source: "stripe",
            amountCents:
              typeof invoice.amount_due === "number" ? invoice.amount_due : null,
            currency: typeof invoice.currency === "string" ? invoice.currency : null,
            externalRef: typeof invoice.id === "string" ? invoice.id : null,
          },
        });
        nextRevenue = {
          ...nextRevenue,
          payoutStatus: {
            status: "pending",
            lastUpdatedAt: createdAt,
            lastPayoutAt: nextRevenue.payoutStatus.lastPayoutAt,
            note: "invoice_payment_failed",
          },
        };
        nextRevenue = withProcessedStripeEvent({
          current: nextRevenue,
          eventId: event.id,
          updatedAt: createdAt,
        });

        await client.users.updateUserMetadata(clerkUserId, {
          publicMetadata: {
            ...user.publicMetadata,
          },
          privateMetadata: {
            ...user.privateMetadata,
            autopilotCompanyHq: {
              ...currentProfile,
              updatedAt: createdAt,
            },
            autopilotRevenue: nextRevenue,
          },
        });
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown webhook error";

    return NextResponse.json({ error: message }, { status: 400 });
  }
}
