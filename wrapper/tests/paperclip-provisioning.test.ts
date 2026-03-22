import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.fn();
const getUserMock = vi.fn();
const updateUserMetadataMock = vi.fn();
const getProvisioningRunForUserMock = vi.fn();
const claimProvisioningRunForUserMock = vi.fn();
const markProvisioningRunStartedMock = vi.fn();
const markProvisioningRunSucceededMock = vi.fn();
const markProvisioningRunFailedMock = vi.fn();

vi.mock("@clerk/nextjs/server", () => ({
  auth: authMock,
  clerkClient: vi.fn(async () => ({
    users: {
      getUser: getUserMock,
      updateUserMetadata: updateUserMetadataMock,
    },
  })),
}));

vi.mock("@/lib/provisioning-store", () => ({
  getProvisioningRunForUser: getProvisioningRunForUserMock,
  claimProvisioningRunForUser: claimProvisioningRunForUserMock,
  markProvisioningRunStarted: markProvisioningRunStartedMock,
  markProvisioningRunSucceeded: markProvisioningRunSucceededMock,
  markProvisioningRunFailed: markProvisioningRunFailedMock,
}));

describe("POST /api/companies/provision", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    process.env.PAPERCLIP_INTERNAL_URL = "http://paperclip:3100";
    process.env.INTERNAL_BRIDGE_SECRET = "bridge-secret";
    delete process.env.AUTOPILOT_ENABLE_ADMIN_BILLING_BYPASS;
    delete process.env.AUTOPILOT_ADMIN_USER_IDS;
    getProvisioningRunForUserMock.mockResolvedValue(null);
    claimProvisioningRunForUserMock.mockResolvedValue({
      action: "start",
      record: {
        id: "prov_123",
        clerkUserId: "user_123",
        requestKey: "provision:user_123",
        companyName: "Meine Autopilot GmbH",
        idea: "KI-SEO-Agentur für DACH",
        status: "pending",
        paperclipCompanyId: null,
        bridgePrincipalId: "clerk:user_123",
        lastError: null,
        retryEligible: true,
      },
    });
    markProvisioningRunStartedMock.mockResolvedValue(undefined);
    markProvisioningRunSucceededMock.mockResolvedValue(undefined);
    markProvisioningRunFailedMock.mockResolvedValue(undefined);
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

  it("returns a durable succeeded provisioning record even when clerk metadata is stale", async () => {
    authMock.mockResolvedValue({ userId: "user_123" });
    getUserMock.mockResolvedValue({
      id: "user_123",
      publicMetadata: {
        autopilotCredits: {
          plan: "starter",
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
    getProvisioningRunForUserMock.mockResolvedValue({
      id: "prov_123",
      clerkUserId: "user_123",
      requestKey: "provision:user_123",
      companyName: "Bestehende Firma",
      idea: "Bereits provisioniert",
      status: "succeeded",
      paperclipCompanyId: "cmp_123",
      bridgePrincipalId: "clerk:user_123",
      lastError: null,
      retryEligible: false,
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
        body: JSON.stringify({ name: "Ignorieren" }),
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual(
      expect.objectContaining({
        paperclipCompanyId: "cmp_123",
        companyName: "Bestehende Firma",
        status: "existing",
      }),
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns a retry-safe pending state instead of bootstrapping twice", async () => {
    authMock.mockResolvedValue({ userId: "user_123" });
    getUserMock.mockResolvedValue({
      id: "user_123",
      publicMetadata: {
        autopilotCredits: {
          plan: "starter",
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
    claimProvisioningRunForUserMock.mockResolvedValue({
      action: "pending",
      record: {
        id: "prov_123",
        clerkUserId: "user_123",
        requestKey: "provision:user_123",
        companyName: "Meine Autopilot GmbH",
        idea: "KI-SEO-Agentur für DACH",
        status: "running",
        paperclipCompanyId: null,
        bridgePrincipalId: "clerk:user_123",
        lastError: null,
        retryEligible: true,
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
        body: JSON.stringify({ name: "Meine Autopilot GmbH" }),
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(202);
    expect(String(payload.status)).toBe("pending");
    expect(fetchMock).not.toHaveBeenCalled();
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

  it("allows provisioning without credits for allowlisted admin bypass users", async () => {
    process.env.AUTOPILOT_ENABLE_ADMIN_BILLING_BYPASS = "true";
    process.env.AUTOPILOT_ADMIN_USER_IDS = "user_123";

    authMock.mockResolvedValue({ userId: "user_123" });
    getUserMock.mockResolvedValue({
      id: "user_123",
      publicMetadata: {
        autopilotCredits: {
          plan: "free",
          consumedCredits: 20,
          manualCredits: 0,
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
        body: JSON.stringify({ name: "Meine Autopilot GmbH" }),
      }),
    );

    expect(response.status).toBe(200);
    expect(updateUserMetadataMock).toHaveBeenCalled();
  });
});
