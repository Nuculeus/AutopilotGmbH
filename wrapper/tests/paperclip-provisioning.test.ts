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

describe("POST /api/companies/provision", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    process.env.PAPERCLIP_INTERNAL_URL = "http://paperclip:3100";
    process.env.INTERNAL_BRIDGE_SECRET = "bridge-secret";
  });

  it("creates one company and persists company metadata for the signed-in user", async () => {
    authMock.mockResolvedValue({ userId: "user_123" });
    getUserMock.mockResolvedValue({
      id: "user_123",
      publicMetadata: {
        autopilotCredits: {
          plan: "free",
        },
      },
      privateMetadata: {
        autopilotCompanyHq: {
          companyGoal: "Wir automatisieren Support fuer DACH-KMU.",
          offer: "KI-Agenten als Service.",
          audience: "Regionale Unternehmen.",
          tone: "Klar, pragmatisch.",
          priorities: "Ersten zahlenden Kunden gewinnen.",
        },
      },
    });

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          paperclipCompanyId: "cmp_123",
          companyName: "Meine Autopilot GmbH",
          bridgePrincipalId: "clerk:user_123",
          status: "bootstrapped",
        }),
      }),
    );

    const { POST } = await import("@/app/api/companies/provision/route");
    const response = await POST(
      new Request("http://localhost/api/companies/provision", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: "Meine Autopilot GmbH",
          idea: "KI-SEO-Agentur für DACH",
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(updateUserMetadataMock).toHaveBeenCalledWith(
      "user_123",
      expect.objectContaining({
        publicMetadata: expect.objectContaining({
          autopilotProvisioning: expect.objectContaining({
            companyId: "cmp_123",
            companyName: "Meine Autopilot GmbH",
            provisioningStatus: "active",
            bridgePrincipalId: "clerk:user_123",
          }),
        }),
      }),
    );
  });

  it("returns existing company metadata instead of creating duplicates", async () => {
    authMock.mockResolvedValue({ userId: "user_123" });
    getUserMock.mockResolvedValue({
      id: "user_123",
      publicMetadata: {
        autopilotCredits: {
          plan: "starter",
        },
        autopilotProvisioning: {
          companyId: "cmp_123",
          companyName: "Bestehende Firma",
          provisioningStatus: "active",
          bridgePrincipalId: "clerk:user_123",
        },
      },
      privateMetadata: {
        autopilotCompanyHq: {
          companyGoal: "Wir automatisieren Support fuer DACH-KMU.",
          offer: "KI-Agenten als Service.",
          audience: "Regionale Unternehmen.",
          tone: "Klar, pragmatisch.",
          priorities: "Ersten zahlenden Kunden gewinnen.",
        },
      },
    });

    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const { POST } = await import("@/app/api/companies/provision/route");
    const response = await POST(
      new Request("http://localhost/api/companies/provision", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: "Ignorieren",
          idea: "Ignorieren",
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(updateUserMetadataMock).not.toHaveBeenCalled();
  });

  it("redirects browser form submissions back into the launch flow after provisioning", async () => {
    authMock.mockResolvedValue({ userId: "user_123" });
    getUserMock.mockResolvedValue({
      id: "user_123",
      publicMetadata: {
        autopilotCredits: {
          plan: "free",
        },
      },
      privateMetadata: {
        autopilotCompanyHq: {
          companyGoal: "Wir automatisieren Support fuer DACH-KMU.",
          offer: "KI-Agenten als Service.",
          audience: "Regionale Unternehmen.",
          tone: "Klar, pragmatisch.",
          priorities: "Ersten zahlenden Kunden gewinnen.",
        },
      },
    });

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          paperclipCompanyId: "cmp_123",
          companyName: "Meine Autopilot GmbH",
          bridgePrincipalId: "clerk:user_123",
          status: "bootstrapped",
        }),
      }),
    );

    const { POST } = await import("@/app/api/companies/provision/route");
    const response = await POST(
      new Request("http://localhost/api/companies/provision", {
        method: "POST",
        headers: {
          Accept: "text/html,application/xhtml+xml",
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: "",
      }),
    );

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("http://localhost/launch");
  });

  it("marks provisioning as failed when paperclip creation errors", async () => {
    authMock.mockResolvedValue({ userId: "user_123" });
    getUserMock.mockResolvedValue({
      id: "user_123",
      publicMetadata: {
        autopilotCredits: {
          plan: "free",
        },
      },
      privateMetadata: {
        autopilotCompanyHq: {
          companyGoal: "Wir automatisieren Support fuer DACH-KMU.",
          offer: "KI-Agenten als Service.",
          audience: "Regionale Unternehmen.",
          tone: "Klar, pragmatisch.",
          priorities: "Ersten zahlenden Kunden gewinnen.",
        },
      },
    });

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({
          error: "paperclip bootstrap failed",
        }),
      }),
    );

    const { POST } = await import("@/app/api/companies/provision/route");
    const response = await POST(
      new Request("http://localhost/api/companies/provision", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: "Meine Autopilot GmbH",
          idea: "KI-SEO-Agentur für DACH",
        }),
      }),
    );

    expect(response.status).toBe(502);
    expect(updateUserMetadataMock).toHaveBeenLastCalledWith(
      "user_123",
      expect.objectContaining({
        publicMetadata: expect.objectContaining({
          autopilotProvisioning: expect.objectContaining({
            provisioningStatus: "failed",
            lastError: "paperclip bootstrap failed",
          }),
        }),
      }),
    );
  });

  it("blocks provisioning when no guided briefing has been saved yet", async () => {
    authMock.mockResolvedValue({ userId: "user_123" });
    getUserMock.mockResolvedValue({
      id: "user_123",
      publicMetadata: {
        autopilotCredits: {
          plan: "starter",
        },
      },
      privateMetadata: {},
    });

    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const { POST } = await import("@/app/api/companies/provision/route");
    const response = await POST(
      new Request("http://localhost/api/companies/provision", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: "Meine Autopilot GmbH",
        }),
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(409);
    expect(String(payload.error)).toContain("Briefing");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
