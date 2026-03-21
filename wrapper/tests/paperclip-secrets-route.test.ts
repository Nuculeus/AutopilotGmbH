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

describe("POST /api/paperclip/secrets", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    process.env.PAPERCLIP_INTERNAL_URL = "http://paperclip:3100";
    process.env.INTERNAL_BRIDGE_SECRET = "bridge-secret";
  });

  it("binds a saved OpenAI key into compatible company agents", async () => {
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
    });

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: "sec_openai",
            name: "openai_api_key",
            provider: "local_encrypted",
            externalRef: null,
            latestVersion: 1,
            description: "OpenAI Zugang",
            updatedAt: "2026-03-21T10:00:00.000Z",
          }),
          { status: 201, headers: { "content-type": "application/json" } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify([
            {
              id: "agent_ceo",
              name: "CEO",
              role: "ceo",
              adapterType: "codex_local",
              adapterConfig: { model: "gpt-5.4" },
            },
          ]),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const { POST } = await import("@/app/api/paperclip/[...path]/route");
    const response = await POST(
      new Request("http://localhost/api/paperclip/secrets", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: "openai_api_key",
          value: "sk-test",
          description: "OpenAI Zugang",
          provider: "local_encrypted",
        }),
      }),
      { params: Promise.resolve({ path: ["secrets"] }) },
    );

    expect(response.status).toBe(201);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[1]?.[0]).toBe("http://paperclip:3100/api/companies/cmp_123/agents");
    expect(fetchMock.mock.calls[2]?.[0]).toBe("http://paperclip:3100/api/agents/agent_ceo");
    expect(fetchMock.mock.calls[2]?.[1]).toEqual(
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({
          adapterConfig: {
            model: "gpt-5.4",
            env: {
              OPENAI_API_KEY: {
                type: "secret_ref",
                secretId: "sec_openai",
                version: "latest",
              },
            },
          },
        }),
      }),
    );
  });
});
