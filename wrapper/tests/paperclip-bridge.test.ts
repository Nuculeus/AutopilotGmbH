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

  it("forwards secret rotate and delete routes for the mapped company", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const autopilotState = {
      companyId: "cmp_123",
      bridgePrincipalId: "clerk:user_123",
      provisioningStatus: "active" as const,
      workspaceStatus: "ready" as const,
      canOpenWorkspace: true,
    };

    await bridgePaperclipRequest({
      request: new Request("http://localhost/api/paperclip/secrets/sec_1/rotate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ value: "sk-test" }),
      }),
      pathSegments: ["secrets", "sec_1", "rotate"],
      userId: "user_123",
      autopilotState,
    });

    await bridgePaperclipRequest({
      request: new Request("http://localhost/api/paperclip/secrets/sec_1", {
        method: "DELETE",
      }),
      pathSegments: ["secrets", "sec_1"],
      userId: "user_123",
      autopilotState,
    });

    expect(fetchMock.mock.calls[0]?.[0]).toBe("http://paperclip:3100/api/secrets/sec_1/rotate");
    expect(fetchMock.mock.calls[1]?.[0]).toBe("http://paperclip:3100/api/secrets/sec_1");
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

  it("does not collapse different workspace api endpoints into the same rate limit bucket", async () => {
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

    const autopilotState = {
      companyId: "cmp_123",
      bridgePrincipalId: "clerk:user_123",
      provisioningStatus: "active" as const,
      workspaceStatus: "ready" as const,
      canOpenWorkspace: true,
    };

    for (let index = 0; index < 30; index += 1) {
      await bridgePaperclipRequest({
        request: new Request("http://localhost/api/paperclip/workspace-api/companies"),
        pathSegments: ["workspace-api", "companies"],
        userId: "user_123",
        autopilotState,
      });
    }

    await expect(
      bridgePaperclipRequest({
        request: new Request("http://localhost/api/paperclip/workspace-api/companies/cmp_123/agents"),
        pathSegments: ["workspace-api", "companies", "cmp_123", "agents"],
        userId: "user_123",
        autopilotState,
      }),
    ).resolves.toBeInstanceOf(Response);

    vi.useRealTimers();
  });

  it("allows realistic workspace write bursts before rate limiting", async () => {
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

    const autopilotState = {
      companyId: "cmp_123",
      bridgePrincipalId: "clerk:user_123",
      provisioningStatus: "active" as const,
      workspaceStatus: "ready" as const,
      canOpenWorkspace: true,
    };

    for (let index = 0; index < 80; index += 1) {
      await expect(
        bridgePaperclipRequest({
          request: new Request("http://localhost/api/paperclip/workspace-api/issues", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ title: `issue-${index}` }),
          }),
          pathSegments: ["workspace-api", "issues"],
          userId: "user_123",
          autopilotState,
        }),
      ).resolves.toBeInstanceOf(Response);
    }

    vi.useRealTimers();
  });

  it("allows the workspace HTML entry route for a provisioned company", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response("<html><body>Paperclip</body></html>", {
        status: 200,
        headers: { "content-type": "text/html; charset=utf-8" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await bridgePaperclipRequest({
      request: new Request("http://localhost/api/paperclip/workspace"),
      pathSegments: ["workspace"],
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
      "http://paperclip:3100/",
      expect.objectContaining({
        method: "GET",
      }),
    );
  });

  it("allows workspace static assets needed by the embedded UI", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response("console.log('workspace');", {
        status: 200,
        headers: { "content-type": "application/javascript" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await bridgePaperclipRequest({
      request: new Request("http://localhost/api/paperclip/workspace-assets/assets/index.js"),
      pathSegments: ["workspace-assets", "assets", "index.js"],
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
      "http://paperclip:3100/assets/index.js",
      expect.objectContaining({
        method: "GET",
      }),
    );
  });

  it("allows workspace API calls while still blocking internal admin routes", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await bridgePaperclipRequest({
      request: new Request("http://localhost/api/paperclip/workspace-api/companies"),
      pathSegments: ["workspace-api", "companies"],
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
      "http://paperclip:3100/api/companies",
      expect.objectContaining({
        method: "GET",
      }),
    );

    await expect(
      bridgePaperclipRequest({
        request: new Request("http://localhost/api/paperclip/workspace-api/internal/bootstrap-company"),
        pathSegments: ["workspace-api", "internal", "bootstrap-company"],
        userId: "user_123",
        autopilotState: {
          companyId: "cmp_123",
          bridgePrincipalId: "clerk:user_123",
          provisioningStatus: "active",
          workspaceStatus: "ready",
          canOpenWorkspace: true,
        },
      }),
    ).rejects.toMatchObject<Partial<BridgeError>>({
      status: 404,
    });
  });
});
