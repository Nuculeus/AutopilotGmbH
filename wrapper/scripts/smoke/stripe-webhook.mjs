#!/usr/bin/env node

import Stripe from "stripe";

const appUrl = (process.env.SMOKE_APP_URL || process.env.APP_BASE_URL || "https://autopilotgmbh.de").replace(/\/$/, "");
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
const clerkUserId = process.env.SMOKE_CLERK_USER_ID;
const amountCents = Number(process.env.SMOKE_AMOUNT_CENTS || 4900);

if (!webhookSecret) {
  console.error("Missing STRIPE_WEBHOOK_SECRET.");
  process.exit(1);
}

if (!clerkUserId) {
  console.error("Missing SMOKE_CLERK_USER_ID.");
  process.exit(1);
}

const eventPayload = {
  id: `evt_smoke_${Date.now()}`,
  object: "event",
  type: "checkout.session.completed",
  data: {
    object: {
      id: `cs_smoke_${Date.now()}`,
      object: "checkout.session",
      customer: `cus_smoke_${Date.now()}`,
      payment_status: "paid",
      amount_total: amountCents,
      currency: "eur",
      metadata: {
        clerkUserId,
        targetPlan: "starter",
        flow: "autopilot-company-start",
      },
      client_reference_id: clerkUserId,
    },
  },
};

const payload = JSON.stringify(eventPayload);
const signature = Stripe.webhooks.generateTestHeaderString({
  payload,
  secret: webhookSecret,
});

async function run() {
  try {
    const res = await fetch(`${appUrl}/api/stripe/webhook`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "stripe-signature": signature,
      },
      body: payload,
    });

    const body = await res.text();
    const ok = res.status >= 200 && res.status < 300;
    console.log(`Webhook smoke status=${res.status} body=${body.slice(0, 220)}`);

    if (!ok) {
      process.exit(1);
    }
  } catch (error) {
    console.error("Stripe webhook smoke failed:", error);
    process.exit(1);
  }
}

run();
