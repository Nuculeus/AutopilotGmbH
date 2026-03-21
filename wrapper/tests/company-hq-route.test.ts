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
          }),
        }),
      }),
    );
  });
});
