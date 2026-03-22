import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.fn();
const getUserMock = vi.fn();
const updateUserMetadataMock = vi.fn();
const createCheckoutSessionMock = vi.fn();

vi.mock("@clerk/nextjs/server", () => ({
  auth: authMock,
  clerkClient: vi.fn(async () => ({
    users: {
      getUser: getUserMock,
      updateUserMetadata: updateUserMetadataMock,
    },
  })),
}));

vi.mock("@/lib/stripe", () => ({
  getStripe: vi.fn(() => ({
    checkout: {
      sessions: {
        create: createCheckoutSessionMock,
      },
    },
  })),
  getAppUrl: vi.fn(
    (origin?: string) => process.env.APP_BASE_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? origin ?? "http://localhost",
  ),
  getStarterPriceId: vi.fn(() => "price_starter"),
}));

describe("POST /api/stripe/checkout", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env.STRIPE_SECRET_KEY = "sk_test";
    delete process.env.AUTOPILOT_ENABLE_ADMIN_BILLING_BYPASS;
    delete process.env.AUTOPILOT_ADMIN_USER_IDS;
  });

  it("creates a checkout session with durable clerk metadata", async () => {
    authMock.mockResolvedValue({ userId: "user_123" });
    getUserMock.mockResolvedValue({
      id: "user_123",
      publicMetadata: {
        autopilotCredits: {
          plan: "free",
          stripeCustomerId: "cus_existing_123",
        },
      },
      privateMetadata: {},
    });
    createCheckoutSessionMock.mockResolvedValue({
      id: "cs_test_123",
      url: "https://checkout.stripe.com/c/pay/cs_test_123",
    });

    const { POST } = await import("@/app/api/stripe/checkout/route");
    const response = await POST(
      new Request("https://autopilotgmbh.de/api/stripe/checkout", {
        method: "POST",
      }),
    );

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("https://checkout.stripe.com/c/pay/cs_test_123");
    expect(createCheckoutSessionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        client_reference_id: "user_123",
        customer: "cus_existing_123",
        metadata: expect.objectContaining({
          clerkUserId: "user_123",
          targetPlan: "starter",
        }),
        subscription_data: expect.objectContaining({
          metadata: expect.objectContaining({
            clerkUserId: "user_123",
            targetPlan: "starter",
          }),
        }),
      }),
    );
  });

  it("uses admin bypass instead of Stripe when allowlisted", async () => {
    process.env.AUTOPILOT_ENABLE_ADMIN_BILLING_BYPASS = "true";
    process.env.AUTOPILOT_ADMIN_USER_IDS = "user_123";

    authMock.mockResolvedValue({ userId: "user_123" });
    getUserMock.mockResolvedValue({
      id: "user_123",
      publicMetadata: {
        autopilotCredits: {
          plan: "free",
        },
      },
      privateMetadata: {},
    });

    const { POST } = await import("@/app/api/stripe/checkout/route");
    const response = await POST(
      new Request("https://autopilotgmbh.de/api/stripe/checkout", {
        method: "POST",
      }),
    );

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("https://autopilotgmbh.de/launch?checkout=admin_bypass");
    expect(createCheckoutSessionMock).not.toHaveBeenCalled();
    expect(updateUserMetadataMock).toHaveBeenCalledWith(
      "user_123",
      expect.objectContaining({
        publicMetadata: expect.objectContaining({
          autopilotCredits: expect.objectContaining({
            plan: "starter",
          }),
        }),
      }),
    );
  });

  it("uses configured app url for admin bypass when request origin is internal", async () => {
    process.env.APP_BASE_URL = "https://autopilotgmbh.de";
    process.env.AUTOPILOT_ENABLE_ADMIN_BILLING_BYPASS = "true";
    process.env.AUTOPILOT_ADMIN_USER_IDS = "user_123";

    authMock.mockResolvedValue({ userId: "user_123" });
    getUserMock.mockResolvedValue({
      id: "user_123",
      publicMetadata: {
        autopilotCredits: {
          plan: "free",
        },
      },
      privateMetadata: {},
    });

    const { POST } = await import("@/app/api/stripe/checkout/route");
    const response = await POST(
      new Request("http://0.0.0.0:3000/api/stripe/checkout", {
        method: "POST",
      }),
    );

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("https://autopilotgmbh.de/launch?checkout=admin_bypass");
    expect(createCheckoutSessionMock).not.toHaveBeenCalled();
  });
});
