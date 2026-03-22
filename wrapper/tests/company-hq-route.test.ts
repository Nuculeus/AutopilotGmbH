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

describe("POST /api/company-hq", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("persists the structured company profile in Clerk private metadata", async () => {
    authMock.mockResolvedValue({ userId: "user_123" });
    getUserMock.mockResolvedValue({
      id: "user_123",
      publicMetadata: {},
      privateMetadata: {},
    });

    const { POST } = await import("@/app/api/company-hq/route");
    const response = await POST(
      new Request("http://localhost/api/company-hq", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          companyGoal: "Wir automatisieren Support fuer DACH-Marken.",
          offer: "KI-gestuetzter Support und Lead-Qualifizierung.",
          audience: "KMU im deutschsprachigen E-Commerce.",
          tone: "Klar, vertrauenswuerdig und pragmatisch.",
          priorities: "Erste Kunden gewinnen, Zahlungsfluss aufsetzen, FAQ live bringen.",
          revenueTrack: "service_business",
          valueModel: "Retainer plus Setup-Fee.",
          requiredConnections: ["llm_any", "stripe", "outreach_channel"],
          nextMilestone: "briefing_ready",
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(updateUserMetadataMock).toHaveBeenCalledWith(
      "user_123",
      expect.objectContaining({
        privateMetadata: expect.objectContaining({
          autopilotCompanyHq: expect.objectContaining({
            companyGoal: "Wir automatisieren Support fuer DACH-Marken.",
            offer: "KI-gestuetzter Support und Lead-Qualifizierung.",
            audience: "KMU im deutschsprachigen E-Commerce.",
            tone: "Klar, vertrauenswuerdig und pragmatisch.",
            priorities: "Erste Kunden gewinnen, Zahlungsfluss aufsetzen, FAQ live bringen.",
            revenueTrack: "service_business",
            valueModel: "Retainer plus Setup-Fee.",
            requiredConnections: ["llm_any", "stripe", "outreach_channel"],
            nextMilestone: "briefing_ready",
          }),
        }),
      }),
    );
  });

  it("allows partial saves and keeps optional fields empty", async () => {
    authMock.mockResolvedValue({ userId: "user_123" });
    getUserMock.mockResolvedValue({
      id: "user_123",
      publicMetadata: {},
      privateMetadata: {},
    });

    const { POST } = await import("@/app/api/company-hq/route");
    const response = await POST(
      new Request("http://localhost/api/company-hq", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          companyGoal: "Wir bauen KI-Agenten fuer regionale Unternehmen.",
          offer: "Voice-Rezeption und Auftragsmanagement.",
          audience: "KMU in DACH.",
          tone: "",
          priorities: "Ersten Use Case bauen und verkaufen.",
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(updateUserMetadataMock).toHaveBeenCalledWith(
      "user_123",
      expect.objectContaining({
        privateMetadata: expect.objectContaining({
          autopilotCompanyHq: expect.objectContaining({
            companyGoal: "Wir bauen KI-Agenten fuer regionale Unternehmen.",
            tone: "",
            priorities: "Ersten Use Case bauen und verkaufen.",
            revenueTrack: "service_business",
            requiredConnections: ["llm_any", "stripe", "outreach_channel"],
          }),
        }),
      }),
    );
  });
});
