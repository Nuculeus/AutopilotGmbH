import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.fn();
const getUserMock = vi.fn();
const updateUserMetadataMock = vi.fn();

vi.mock("@clerk/nextjs/server", () => ({
  auth: authMock,
  clerkClient: vi.fn(async () => ({
    users: {
      getUser: getUserMock,
      updateUserMetadata: updateUserMetadataMock,
    },
  })),
}));

describe("POST /api/revenue/events", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("records first value creation and advances milestone", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-21T20:15:00.000Z"));

    authMock.mockResolvedValue({ userId: "user_123" });
    getUserMock.mockResolvedValue({
      id: "user_123",
      publicMetadata: {},
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

    const { POST } = await import("@/app/api/revenue/events/route");
    const response = await POST(
      new Request("http://localhost/api/revenue/events", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          event: "first_value_created",
          summary: "Erster produktiver Output fuer Pilotkunde erzeugt.",
        }),
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.nextMilestone).toBe("first_value_created");
    expect(updateUserMetadataMock).toHaveBeenCalledWith(
      "user_123",
      expect.objectContaining({
        privateMetadata: expect.objectContaining({
          autopilotCompanyHq: expect.objectContaining({
            nextMilestone: "first_value_created",
          }),
          autopilotRevenue: expect.objectContaining({
            firstValueEvent: expect.objectContaining({
              summary: "Erster produktiver Output fuer Pilotkunde erzeugt.",
            }),
          }),
        }),
      }),
    );

    vi.useRealTimers();
  });
});
