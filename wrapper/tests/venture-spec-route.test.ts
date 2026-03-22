import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.fn();
const patchVentureSpecForUserMock = vi.fn();

vi.mock("@clerk/nextjs/server", () => ({
  auth: authMock,
}));

vi.mock("@/lib/control-plane-store", () => ({
  patchVentureSpecForUser: patchVentureSpecForUserMock,
}));

describe("PATCH /api/ventures/[id]/spec", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    authMock.mockResolvedValue({ userId: null });

    const { PATCH } = await import("@/app/api/ventures/[id]/spec/route");
    const response = await PATCH(
      new Request("http://localhost/api/ventures/v1/spec", {
        method: "PATCH",
      }),
      {
        params: Promise.resolve({ id: "v1" }),
      },
    );

    expect(response.status).toBe(401);
    expect(patchVentureSpecForUserMock).not.toHaveBeenCalled();
  });

  it("updates the venture spec for the owner", async () => {
    authMock.mockResolvedValue({ userId: "user_123" });
    patchVentureSpecForUserMock.mockResolvedValue({
      ventureId: "v1",
      revenueTrack: "service_business",
      companyGoal: "Wir bauen einen zahlbaren AGaaS-Use-Case.",
      nextMilestone: "first_value_created",
    });

    const { PATCH } = await import("@/app/api/ventures/[id]/spec/route");
    const response = await PATCH(
      new Request("http://localhost/api/ventures/v1/spec", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyGoal: "Wir bauen einen zahlbaren AGaaS-Use-Case.",
          offer: "Voice-Rezeption fuer Handwerksbetriebe.",
          audience: "KMU in DACH.",
          priorities: "Erste 3 Kunden gewinnen.",
          proofTarget: "Erster zahlender Kunde in 14 Tagen",
          budgetCapCents: 15000,
        }),
      }),
      {
        params: Promise.resolve({ id: "v1" }),
      },
    );

    expect(response.status).toBe(200);
    expect(patchVentureSpecForUserMock).toHaveBeenCalledWith({
      clerkUserId: "user_123",
      ventureId: "v1",
      patch: expect.objectContaining({
        companyGoal: "Wir bauen einen zahlbaren AGaaS-Use-Case.",
        proofTarget: "Erster zahlender Kunde in 14 Tagen",
        budgetCapCents: 15000,
      }),
    });
  });
});
