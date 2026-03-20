import { beforeEach, describe, expect, it, vi } from "vitest";
import { BridgeError, bridgePaperclipRequest, resetBridgeRateLimits } from "@/lib/paperclip-bridge";

describe("paperclip bridge", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    resetBridgeRateLimits();
    process.env.PAPERCLIP_INTERNAL_URL = "http://paperclip:3100";
    process.env.INTERNAL_BRIDGE_SECRET = "bridge-secret";
  });

  it("rejects proxy requests when the signed-in user has no active company", async () => {
    await expect(
      bridgePaperclipRequest({
        request: new Request("http://localhost/api/paperclip/dashboard-summary"),
        pathSegments: ["dashboard-summary"],
        userId: "user_123",
        autopilotState: {
          companyId: null,
          bridgePrincipalId: null,
          provisioningStatus: "not_started",
          workspaceStatus: "locked",
          canOpenWorkspace: false,
        },
      }),
    ).rejects.toMatchObject<Partial<BridgeError>>({
      status: 403,
    });
  });

  it("forwards allowed paperclip paths for the mapped company only", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ companyId: "cmp_123" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await bridgePaperclipRequest({
      request: new Request("http://localhost/api/paperclip/dashboard-summary"),
      pathSegments: ["dashboard-summary"],
      userId: "user_123",
      autopilotState: {
        companyId: "cmp_123",
        bridgePrincipalId: "clerk:user_123",
        provisioningStatus: "active",
        workspaceStatus: "ready",
        canOpenWorkspace: true,
      },
    });

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledWith(
      "http://paperclip:3100/api/companies/cmp_123/dashboard",
      expect.objectContaining({
        method: "GET",
      }),
    );
  });

  it("never trusts client-supplied companyId query parameters", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await bridgePaperclipRequest({
      request: new Request(
        "http://localhost/api/paperclip/dashboard-summary?companyId=cmp_evil&view=compact",
      ),
      pathSegments: ["dashboard-summary"],
      userId: "user_123",
      autopilotState: {
        companyId: "cmp_123",
        bridgePrincipalId: "clerk:user_123",
        provisioningStatus: "active",
        workspaceStatus: "ready",
        canOpenWorkspace: true,
      },
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://paperclip:3100/api/companies/cmp_123/dashboard?view=compact",
      expect.any(Object),
    );
  });

  it("authenticates proxied workspace requests as the stable bridge principal for that user", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await bridgePaperclipRequest({
      request: new Request("http://localhost/api/paperclip/secret-providers"),
      pathSegments: ["secret-providers"],
      userId: "user_123",
      autopilotState: {
        companyId: "cmp_123",
        bridgePrincipalId: "clerk:user_123",
        provisioningStatus: "active",
        workspaceStatus: "ready",
        canOpenWorkspace: true,
      },
    });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Headers;
    expect(headers.get("x-internal-secret")).toBe("bridge-secret");
    expect(headers.get("x-bridge-principal")).toBe("clerk:user_123");
  });

  it("rate limits repeated bridge calls from the same user and surface", async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      ),
    );

    const createInput = () => ({
      request: new Request("http://localhost/api/paperclip/secrets", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "anthropic", value: "secret" }),
      }),
      pathSegments: ["secrets"] as string[],
      userId: "user_123",
      autopilotState: {
        companyId: "cmp_123",
        bridgePrincipalId: "clerk:user_123",
        provisioningStatus: "active" as const,
        workspaceStatus: "ready" as const,
        canOpenWorkspace: true,
      },
    });

    for (let index = 0; index < 6; index += 1) {
      await bridgePaperclipRequest(createInput());
    }

    await expect(bridgePaperclipRequest(createInput())).rejects.toMatchObject<Partial<BridgeError>>({
      status: 429,
    });

    vi.useRealTimers();
  });
});
