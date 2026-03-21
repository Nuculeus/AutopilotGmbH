import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.fn();
const generateCompanyHqDraftMock = vi.fn();

vi.mock("@clerk/nextjs/server", () => ({
  auth: authMock,
}));

vi.mock("@/lib/company-hq-draft", () => ({
  generateCompanyHqDraft: generateCompanyHqDraftMock,
}));

describe("POST /api/company-hq/draft", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("returns a draft for a signed-in user", async () => {
    authMock.mockResolvedValue({ userId: "user_123" });
    generateCompanyHqDraftMock.mockResolvedValue({
      mode: "fallback",
      profile: {
        companyGoal: "Wir bauen einen YouTube-Kanal fuer KI-Automation.",
        offer: "Wir liefern Videos und Templates.",
        audience: "KMU in DACH.",
        tone: "Klar und pragmatisch.",
        priorities: "Pilotfolge veroeffentlichen.",
        updatedAt: null,
      },
    });

    const { POST } = await import("@/app/api/company-hq/draft/route");
    const response = await POST(
      new Request("http://localhost/api/company-hq/draft", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          idea: "Ich moechte einen YouTube-Kanal fuer KI-Automation aufbauen.",
        }),
      }),
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(generateCompanyHqDraftMock).toHaveBeenCalledWith(
      "Ich moechte einen YouTube-Kanal fuer KI-Automation aufbauen.",
    );
    expect(data.mode).toBe("fallback");
  });
});
