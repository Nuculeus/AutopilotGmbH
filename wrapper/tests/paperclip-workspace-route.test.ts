import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.fn();
const getUserMock = vi.fn();

vi.mock("@clerk/nextjs/server", () => ({
  auth: authMock,
  clerkClient: vi.fn(async () => ({
    users: {
      getUser: getUserMock,
    },
  })),
}));

describe("GET /api/paperclip/[...path] workspace host", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    process.env.PAPERCLIP_INTERNAL_URL = "http://paperclip:3100";
    process.env.INTERNAL_BRIDGE_SECRET = "bridge-secret";
  });

  it("rewrites workspace HTML so assets and API stay inside the wrapper proxy", async () => {
    authMock.mockResolvedValue({ userId: "user_123" });
    getUserMock.mockResolvedValue({
      id: "user_123",
      publicMetadata: {
        autopilotCredits: {
          plan: "free",
        },
        autopilotProvisioning: {
          companyId: "cmp_123",
          companyName: "Meine Autopilot GmbH",
          provisioningStatus: "active",
          workspaceStatus: "ready",
          bridgePrincipalId: "clerk:user_123",
        },
      },
      privateMetadata: {
        autopilotLlmReadiness: {
          status: "ready",
          summary: "LLM-Zugang ist lauffähig.",
          checkedAt: "2026-03-22T10:00:00.000Z",
          probedAdapterType: "codex_local",
        },
      },
    });

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          `<!doctype html><html><head><script type="module" src="/assets/index.js"></script><link rel="icon" href="/favicon.svg"></head><body><div id="root"></div></body></html>`,
          {
            status: 200,
            headers: { "content-type": "text/html; charset=utf-8" },
          },
        ),
      ),
    );

    const { GET } = await import("@/app/api/paperclip/[...path]/route");
    const response = await GET(new Request("http://localhost/api/paperclip/workspace"), {
      params: Promise.resolve({
        path: ["workspace"],
      }),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/html");

    const html = await response.text();
    expect(html).toContain('/api/paperclip/workspace-assets/assets/index.js');
    expect(html).toContain('/api/paperclip/workspace-assets/favicon.svg');
    expect(html).toContain('window.__PAPERCLIP_API_BASE__="/api/paperclip/workspace-api"');
    expect(html).toContain('window.__PAPERCLIP_BASENAME__="/api/paperclip/workspace"');
    expect(html).toContain('window.__PAPERCLIP_DISABLE_SW__=true');
    expect(html).toContain('window.__PAPERCLIP_DISABLE_LIVE_SOCKETS__=true');
  });

  it("blocks direct workspace proxy access until llm readiness is verified", async () => {
    authMock.mockResolvedValue({ userId: "user_123" });
    getUserMock.mockResolvedValue({
      id: "user_123",
      publicMetadata: {
        autopilotProvisioning: {
          companyId: "cmp_123",
          companyName: "Meine Autopilot GmbH",
          provisioningStatus: "active",
          workspaceStatus: "ready",
          bridgePrincipalId: "clerk:user_123",
        },
      },
      privateMetadata: {
        autopilotLlmReadiness: {
          status: "warning",
          summary: "OpenAI probe failed",
          checkedAt: "2026-03-22T10:00:00.000Z",
          probedAdapterType: "codex_local",
        },
      },
    });

    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const { GET } = await import("@/app/api/paperclip/[...path]/route");
    const response = await GET(new Request("http://localhost/api/paperclip/workspace"), {
      params: Promise.resolve({
        path: ["workspace"],
      }),
    });

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({
        error: expect.stringContaining("LLM"),
      }),
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
