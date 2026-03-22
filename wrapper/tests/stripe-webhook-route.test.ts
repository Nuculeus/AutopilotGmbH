import { beforeEach, describe, expect, it, vi } from "vitest";

const getUserMock = vi.fn();
const updateUserMetadataMock = vi.fn();
const constructEventMock = vi.fn();

vi.mock("@clerk/nextjs/server", () => ({
  clerkClient: vi.fn(async () => ({
    users: {
      getUser: getUserMock,
      updateUserMetadata: updateUserMetadataMock,
    },
  })),
}));

vi.mock("@/lib/stripe", () => ({
  getStripe: vi.fn(() => ({
    webhooks: {
      constructEvent: constructEventMock,
    },
  })),
}));

describe("POST /api/stripe/webhook", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env.STRIPE_SECRET_KEY = "sk_test";
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
  });

  it("advances revenue milestone and stores revenue event data on completed checkout", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-21T20:00:00.000Z"));

    constructEventMock.mockReturnValue({
      id: "evt_checkout_123",
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_test_123",
          customer: "cus_test_123",
          payment_status: "paid",
          amount_total: 4900,
          currency: "eur",
          metadata: {
            clerkUserId: "user_123",
            targetPlan: "starter",
          },
        },
      },
    });

    getUserMock.mockResolvedValue({
      id: "user_123",
      publicMetadata: {
        autopilotCredits: {
          plan: "free",
        },
      },
      privateMetadata: {
        autopilotCompanyHq: {
          companyGoal: "Wir bauen KI-Agenten fuer KMU.",
          offer: "Done-for-you Agentenbetrieb.",
          audience: "Regionale Dienstleister.",
          tone: "Klar.",
          priorities: "Erste 5 Kunden.",
          revenueTrack: "service_business",
          valueModel: "Retainer + Setup-Fee.",
          requiredConnections: ["llm_any", "stripe", "outreach_channel"],
          nextMilestone: "workspace_ready",
        },
      },
    });

    const { POST } = await import("@/app/api/stripe/webhook/route");
    const response = await POST(
      new Request("http://localhost/api/stripe/webhook", {
        method: "POST",
        headers: {
          "stripe-signature": "sig_test",
        },
        body: JSON.stringify({ id: "evt_123" }),
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.received).toBe(true);
    expect(updateUserMetadataMock).toHaveBeenCalledWith(
      "user_123",
      expect.objectContaining({
        publicMetadata: expect.objectContaining({
          autopilotCredits: expect.objectContaining({
            plan: "starter",
            stripeCustomerId: "cus_test_123",
            lastCheckoutSessionId: "cs_test_123",
            processedStripeEventIds: expect.arrayContaining(["evt_checkout_123"]),
          }),
        }),
        privateMetadata: expect.objectContaining({
          autopilotCompanyHq: expect.objectContaining({
            nextMilestone: "first_revenue_recorded",
          }),
          autopilotRevenue: expect.objectContaining({
            revenueEvents: expect.arrayContaining([
              expect.objectContaining({
                kind: "checkout_live",
              }),
              expect.objectContaining({
                kind: "revenue_recorded",
                amountCents: 4900,
                currency: "eur",
              }),
            ]),
          }),
        }),
      }),
    );

    vi.useRealTimers();
  });

  it("uses invoice parent subscription metadata when direct clerkUserId is missing", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-21T20:40:00.000Z"));

    constructEventMock.mockReturnValue({
      id: "evt_invoice_paid_parent_meta_123",
      type: "invoice.paid",
      data: {
        object: {
          id: "in_parent_123",
          amount_paid: 12900,
          currency: "eur",
          metadata: {},
          parent: {
            subscription_details: {
              metadata: {
                clerkUserId: "user_123",
              },
            },
          },
        },
      },
    });

    getUserMock.mockResolvedValue({
      id: "user_123",
      publicMetadata: {
        autopilotCredits: {
          plan: "starter",
        },
      },
      privateMetadata: {
        autopilotCompanyHq: {
          companyGoal: "Wir bauen KI-Agenten fuer KMU.",
          offer: "Done-for-you Agentenbetrieb.",
          audience: "Regionale Dienstleister.",
          tone: "Klar.",
          priorities: "Erste 5 Kunden.",
          revenueTrack: "service_business",
          valueModel: "Retainer + Setup-Fee.",
          requiredConnections: ["llm_any", "stripe", "outreach_channel"],
          nextMilestone: "first_checkout_live",
        },
      },
    });

    const { POST } = await import("@/app/api/stripe/webhook/route");
    const response = await POST(
      new Request("http://localhost/api/stripe/webhook", {
        method: "POST",
        headers: {
          "stripe-signature": "sig_test",
        },
        body: JSON.stringify({ id: "evt_invoice_paid_parent_meta_123" }),
      }),
    );

    expect(response.status).toBe(200);
    expect(updateUserMetadataMock).toHaveBeenCalledWith(
      "user_123",
      expect.objectContaining({
        privateMetadata: expect.objectContaining({
          autopilotRevenue: expect.objectContaining({
            revenueEvents: expect.arrayContaining([
              expect.objectContaining({
                kind: "revenue_recorded",
                amountCents: 12900,
              }),
            ]),
          }),
        }),
        publicMetadata: expect.objectContaining({
          autopilotCredits: expect.objectContaining({
            processedStripeEventIds: expect.arrayContaining(["evt_invoice_paid_parent_meta_123"]),
          }),
        }),
      }),
    );

    vi.useRealTimers();
  });

  it("ignores already-processed stripe events idempotently", async () => {
    constructEventMock.mockReturnValue({
      id: "evt_checkout_123",
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_test_123",
          customer: "cus_test_123",
          payment_status: "paid",
          amount_total: 4900,
          currency: "eur",
          metadata: {
            clerkUserId: "user_123",
            targetPlan: "starter",
          },
        },
      },
    });

    getUserMock.mockResolvedValue({
      id: "user_123",
      publicMetadata: {
        autopilotCredits: {
          plan: "free",
        },
      },
      privateMetadata: {
        autopilotCompanyHq: {
          companyGoal: "Wir bauen KI-Agenten fuer KMU.",
          offer: "Done-for-you Agentenbetrieb.",
          audience: "Regionale Dienstleister.",
          tone: "Klar.",
          priorities: "Erste 5 Kunden.",
          revenueTrack: "service_business",
          valueModel: "Retainer + Setup-Fee.",
          requiredConnections: ["llm_any", "stripe", "outreach_channel"],
          nextMilestone: "workspace_ready",
        },
        autopilotRevenue: {
          processedStripeEventIds: ["evt_checkout_123"],
          revenueEvents: [],
          payoutStatus: {
            status: "not_ready",
            lastUpdatedAt: null,
            lastPayoutAt: null,
            note: null,
          },
          updatedAt: null,
          firstValueEvent: null,
        },
      },
    });

    const { POST } = await import("@/app/api/stripe/webhook/route");
    const response = await POST(
      new Request("http://localhost/api/stripe/webhook", {
        method: "POST",
        headers: {
          "stripe-signature": "sig_test",
        },
        body: JSON.stringify({ id: "evt_checkout_123" }),
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.received).toBe(true);
    expect(payload.duplicate).toBe(true);
    expect(updateUserMetadataMock).not.toHaveBeenCalled();
  });

  it("records revenue for invoice.paid events", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-21T20:30:00.000Z"));

    constructEventMock.mockReturnValue({
      id: "evt_invoice_paid_123",
      type: "invoice.paid",
      data: {
        object: {
          id: "in_123",
          amount_paid: 7900,
          currency: "eur",
          metadata: {
            clerkUserId: "user_123",
          },
        },
      },
    });

    getUserMock.mockResolvedValue({
      id: "user_123",
      publicMetadata: {
        autopilotCredits: {
          plan: "starter",
        },
      },
      privateMetadata: {
        autopilotCompanyHq: {
          companyGoal: "Wir bauen KI-Agenten fuer KMU.",
          offer: "Done-for-you Agentenbetrieb.",
          audience: "Regionale Dienstleister.",
          tone: "Klar.",
          priorities: "Erste 5 Kunden.",
          revenueTrack: "service_business",
          valueModel: "Retainer + Setup-Fee.",
          requiredConnections: ["llm_any", "stripe", "outreach_channel"],
          nextMilestone: "first_checkout_live",
        },
      },
    });

    const { POST } = await import("@/app/api/stripe/webhook/route");
    const response = await POST(
      new Request("http://localhost/api/stripe/webhook", {
        method: "POST",
        headers: {
          "stripe-signature": "sig_test",
        },
        body: JSON.stringify({ id: "evt_invoice_paid_123" }),
      }),
    );

    expect(response.status).toBe(200);
    expect(updateUserMetadataMock).toHaveBeenCalledWith(
      "user_123",
      expect.objectContaining({
        privateMetadata: expect.objectContaining({
          autopilotCompanyHq: expect.objectContaining({
            nextMilestone: "first_revenue_recorded",
          }),
          autopilotRevenue: expect.objectContaining({
            revenueEvents: expect.arrayContaining([
              expect.objectContaining({
                kind: "revenue_recorded",
                amountCents: 7900,
                currency: "eur",
              }),
            ]),
          }),
        }),
        publicMetadata: expect.objectContaining({
          autopilotCredits: expect.objectContaining({
            processedStripeEventIds: expect.arrayContaining(["evt_invoice_paid_123"]),
          }),
        }),
      }),
    );

    vi.useRealTimers();
  });

  it("records billing attention for invoice.payment_failed events", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-21T20:35:00.000Z"));

    constructEventMock.mockReturnValue({
      id: "evt_invoice_failed_123",
      type: "invoice.payment_failed",
      data: {
        object: {
          id: "in_456",
          amount_due: 7900,
          currency: "eur",
          metadata: {
            clerkUserId: "user_123",
          },
        },
      },
    });

    getUserMock.mockResolvedValue({
      id: "user_123",
      publicMetadata: {
        autopilotCredits: {
          plan: "starter",
        },
      },
      privateMetadata: {
        autopilotCompanyHq: {
          companyGoal: "Wir bauen KI-Agenten fuer KMU.",
          offer: "Done-for-you Agentenbetrieb.",
          audience: "Regionale Dienstleister.",
          tone: "Klar.",
          priorities: "Erste 5 Kunden.",
          revenueTrack: "service_business",
          valueModel: "Retainer + Setup-Fee.",
          requiredConnections: ["llm_any", "stripe", "outreach_channel"],
          nextMilestone: "first_checkout_live",
        },
      },
    });

    const { POST } = await import("@/app/api/stripe/webhook/route");
    const response = await POST(
      new Request("http://localhost/api/stripe/webhook", {
        method: "POST",
        headers: {
          "stripe-signature": "sig_test",
        },
        body: JSON.stringify({ id: "evt_invoice_failed_123" }),
      }),
    );

    expect(response.status).toBe(200);
    expect(updateUserMetadataMock).toHaveBeenCalledWith(
      "user_123",
      expect.objectContaining({
        privateMetadata: expect.objectContaining({
          autopilotRevenue: expect.objectContaining({
            payoutStatus: expect.objectContaining({
              status: "pending",
            }),
            revenueEvents: expect.arrayContaining([
              expect.objectContaining({
                kind: "payment_failed",
                amountCents: 7900,
                currency: "eur",
              }),
            ]),
          }),
        }),
        publicMetadata: expect.objectContaining({
          autopilotCredits: expect.objectContaining({
            processedStripeEventIds: expect.arrayContaining(["evt_invoice_failed_123"]),
          }),
        }),
      }),
    );

    vi.useRealTimers();
  });
});
