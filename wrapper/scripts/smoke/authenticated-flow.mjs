#!/usr/bin/env node

const appUrl = (process.env.SMOKE_APP_URL || process.env.APP_BASE_URL || "https://autopilotgmbh.de").replace(/\/$/, "");
const sessionCookie = process.env.SMOKE_CLERK_SESSION_COOKIE || process.env.E2E_SESSION_COOKIE;

if (!sessionCookie) {
  console.error("Missing SMOKE_CLERK_SESSION_COOKIE (or E2E_SESSION_COOKIE).");
  process.exit(1);
}

const cookieHeader = `__session=${sessionCookie}`;
const results = [];

function logStep(name, ok, detail) {
  results.push({ name, ok, detail });
  const icon = ok ? "PASS" : "FAIL";
  console.log(`[${icon}] ${name}${detail ? ` - ${detail}` : ""}`);
}

async function request(path, init = {}) {
  const url = `${appUrl}${path}`;
  const headers = new Headers(init.headers || {});
  headers.set("cookie", cookieHeader);
  if (!headers.has("content-type") && init.body) {
    headers.set("content-type", "application/json");
  }

  return fetch(url, {
    redirect: "manual",
    ...init,
    headers,
  });
}

async function run() {
  try {
    const launchRes = await request("/launch");
    const launchLocation = launchRes.headers.get("location") || "";
    const launchUnauthorizedRedirect =
      launchRes.status >= 300 &&
      launchRes.status < 400 &&
      launchLocation.includes("/sign-in");
    logStep(
      "Authenticated launch access",
      !launchUnauthorizedRedirect,
      `status=${launchRes.status}${launchLocation ? ` location=${launchLocation}` : ""}`,
    );

    const connectionsRes = await request("/app/connections");
    const connectionsLocation = connectionsRes.headers.get("location") || "";
    const connectionsUnauthorizedRedirect =
      connectionsRes.status >= 300 &&
      connectionsRes.status < 400 &&
      connectionsLocation.includes("/sign-in");
    logStep(
      "Connections page access",
      !connectionsUnauthorizedRedirect,
      `status=${connectionsRes.status}${connectionsLocation ? ` location=${connectionsLocation}` : ""}`,
    );

    const readinessRes = await request("/api/connections/llm-readiness", {
      method: "POST",
    });
    const readinessBody = await readinessRes.text();
    logStep(
      "LLM readiness endpoint",
      readinessRes.status !== 401,
      `status=${readinessRes.status} body=${readinessBody.slice(0, 180)}`,
    );

    const checkoutRes = await request("/api/stripe/checkout", {
      method: "POST",
    });
    const checkoutLocation = checkoutRes.headers.get("location") || "";
    const isAdminBypass = checkoutLocation.includes("checkout=admin_bypass");
    const isStripeHosted =
      checkoutLocation.startsWith("https://checkout.stripe.com/") ||
      checkoutLocation.startsWith("https://billing.stripe.com/");
    logStep(
      "Stripe checkout entry",
      checkoutRes.status === 303 && (isAdminBypass || isStripeHosted),
      `status=${checkoutRes.status}${checkoutLocation ? ` location=${checkoutLocation}` : ""}`,
    );

    const failed = results.filter((entry) => !entry.ok);
    if (failed.length > 0) {
      console.error(`Smoke failed: ${failed.length} step(s)`);
      process.exit(1);
    }

    console.log("Authenticated smoke passed.");
  } catch (error) {
    console.error("Smoke failed with runtime error:", error);
    process.exit(1);
  }
}

run();
