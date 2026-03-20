import Stripe from "stripe";

export function getStripe() {
  const secretKey = process.env.STRIPE_SECRET_KEY;

  if (!secretKey) {
    throw new Error("Missing STRIPE_SECRET_KEY");
  }

  return new Stripe(secretKey, {
    apiVersion: "2026-02-25.clover",
  });
}

export function getAppUrl(origin?: string) {
  return process.env.APP_BASE_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? origin ?? "http://localhost:3000";
}

export function getStarterPriceId() {
  const priceId = process.env.STRIPE_STARTER_PRICE_ID;

  if (!priceId) {
    throw new Error("Missing STRIPE_STARTER_PRICE_ID");
  }

  return priceId;
}
