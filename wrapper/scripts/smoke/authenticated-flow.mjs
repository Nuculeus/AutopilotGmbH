#!/usr/bin/env node

const appUrl = (process.env.SMOKE_APP_URL || process.env.APP_BASE_URL || "https://autopilotgmbh.de").replace(/\/$/, "");
const sessionCookie = process.env.SMOKE_CLERK_SESSION_COOKIE || process.env.E2E_SESSION_COOKIE;
const smokeClerkUserId = process.env.SMOKE_CLERK_USER_ID;
const clerkSecretKey = process.env.CLERK_SECRET_KEY;

const authMode = sessionCookie ? "cookie" : smokeClerkUserId && clerkSecretKey ? "bearer" : null;

if (!authMode) {
  console.error(
    "Missing auth for smoke: provide SMOKE_CLERK_SESSION_COOKIE (or E2E_SESSION_COOKIE), "
      + "or set SMOKE_CLERK_USER_ID + CLERK_SECRET_KEY for bearer mode.",
  );
  process.exit(1);
}

let bearerToken = null;
const results = [];

function logStep(name, ok, detail) {
  results.push({ name, ok, detail });
  const icon = ok ? "PASS" : "FAIL";
  console.log(`[${icon}] ${name}${detail ? ` - ${detail}` : ""}`);
}

async function request(path, init = {}) {
  const url = `${appUrl}${path}`;
  const headers = new Headers(init.headers || {});
  if (authMode === "cookie") {
    headers.set("cookie", `__session=${sessionCookie}`);
  } else if (bearerToken) {
    headers.set("authorization", `Bearer ${bearerToken}`);
  }
  if (!headers.has("content-type") && init.body) {
    headers.set("content-type", "application/json");
  }

  return fetch(url, {
    redirect: "manual",
    ...init,
    headers,
  });
}

async function createSessionBearerToken() {
  if (!smokeClerkUserId || !clerkSecretKey) {
    throw new Error("Missing SMOKE_CLERK_USER_ID or CLERK_SECRET_KEY");
  }

  const sessionResponse = await fetch("https://api.clerk.com/v1/sessions", {
    method: "POST",
    headers: {
      authorization: `Bearer ${clerkSecretKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      user_id: smokeClerkUserId,
    }),
  });

  if (!sessionResponse.ok) {
    const body = await sessionResponse.text();
    throw new Error(`Failed to create Clerk session: ${sessionResponse.status} ${body}`);
  }

  const session = await sessionResponse.json();
  const tokenResponse = await fetch(`https://api.clerk.com/v1/sessions/${session.id}/tokens`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${clerkSecretKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({}),
  });

  if (!tokenResponse.ok) {
    const body = await tokenResponse.text();
    throw new Error(`Failed to create Clerk session token: ${tokenResponse.status} ${body}`);
  }

  const tokenPayload = await tokenResponse.json();
  if (!tokenPayload.jwt || typeof tokenPayload.jwt !== "string") {
    throw new Error("Missing Clerk session JWT in token response.");
  }

  return tokenPayload.jwt;
}

async function run() {
  try {
    if (authMode === "bearer") {
      bearerToken = await createSessionBearerToken();
      logStep("Bearer auth bootstrap", true, "Clerk session token issued");
    }

    if (authMode === "cookie") {
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
    } else {
      const profileRes = await request("/api/company-hq");
      const profileBody = await profileRes.text();
      logStep(
        "Company HQ API auth access",
        profileRes.status !== 401,
        `status=${profileRes.status} body=${profileBody.slice(0, 180)}`,
      );
    }

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
