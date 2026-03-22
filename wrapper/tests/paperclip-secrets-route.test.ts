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
    expect(fetchMock.mock.calls[0]?.[1]).toEqual(
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          name: "OPENAI_API_KEY",
          value: "sk-test",
          description: "OpenAI Zugang",
          provider: "local_encrypted",
          externalRef: null,
        }),
      }),
    );
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
    expect(updateUserMetadataMock).toHaveBeenCalledWith(
      "user_123",
      expect.objectContaining({
        privateMetadata: expect.objectContaining({
          autopilotLlmReadiness: expect.objectContaining({
            status: "blocked",
            probedAdapterType: null,
            checkedAt: null,
          }),
        }),
      }),
    );
  });

  it("sanitizes llm secret payload before forwarding to bridge", async () => {
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
            name: "OPENAI_API_KEY",
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
        new Response(JSON.stringify([]), {
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
          name: " openai_api_key ",
          value: "  sk-test  ",
          description: "  OpenAI Zugang  ",
          provider: "local_encrypted",
        }),
      }),
      { params: Promise.resolve({ path: ["secrets"] }) },
    );

    expect(response.status).toBe(201);
    expect(fetchMock.mock.calls[0]?.[1]).toEqual(
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          name: "OPENAI_API_KEY",
          value: "sk-test",
          description: "OpenAI Zugang",
          provider: "local_encrypted",
          externalRef: null,
        }),
      }),
    );
    expect(updateUserMetadataMock).toHaveBeenCalledWith(
      "user_123",
      expect.objectContaining({
        privateMetadata: expect.objectContaining({
          autopilotLlmReadiness: expect.objectContaining({
            status: "blocked",
            probedAdapterType: null,
            checkedAt: null,
          }),
        }),
      }),
    );
  });

  it("rotates existing secret when canonical name already exists", async () => {
    authMock.mockResolvedValue({ userId: "user_123" });
    getUserMock.mockResolvedValue({
      id: "user_123",
      privateMetadata: {},
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
            error: "Secret already exists: OPENAI_API_KEY",
          }),
          { status: 409, headers: { "content-type": "application/json" } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify([
            {
              id: "sec_openai",
              name: "OPENAI_API_KEY",
              provider: "local_encrypted",
              externalRef: null,
              latestVersion: 1,
              description: "OpenAI Zugang",
              updatedAt: "2026-03-21T10:00:00.000Z",
            },
          ]),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: "sec_openai",
            name: "OPENAI_API_KEY",
            provider: "local_encrypted",
            externalRef: null,
            latestVersion: 2,
            description: "OpenAI Zugang",
            updatedAt: "2026-03-22T10:00:00.000Z",
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify([]), {
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
          value: "sk-test-replaced",
          description: "OpenAI Zugang",
          provider: "local_encrypted",
        }),
      }),
      { params: Promise.resolve({ path: ["secrets"] }) },
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual(
      expect.objectContaining({
        id: "sec_openai",
        name: "OPENAI_API_KEY",
        latestVersion: 2,
      }),
    );
    expect(fetchMock.mock.calls[0]?.[0]).toBe("http://paperclip:3100/api/companies/cmp_123/secrets");
    expect(fetchMock.mock.calls[2]?.[0]).toBe("http://paperclip:3100/api/secrets/sec_openai/rotate");
    expect(fetchMock.mock.calls[2]?.[1]).toEqual(
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          value: "sk-test-replaced",
          externalRef: null,
        }),
      }),
    );
    expect(updateUserMetadataMock).toHaveBeenCalledWith(
      "user_123",
      expect.objectContaining({
        privateMetadata: expect.objectContaining({
          autopilotLlmReadiness: expect.objectContaining({
            status: "blocked",
          }),
        }),
      }),
    );
  });

  it("resets llm readiness when a secret is deleted", async () => {
    authMock.mockResolvedValue({ userId: "user_123" });
    getUserMock.mockResolvedValue({
      id: "user_123",
      privateMetadata: {},
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

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const { DELETE } = await import("@/app/api/paperclip/[...path]/route");
    const response = await DELETE(
      new Request("http://localhost/api/paperclip/secrets/sec_openai", {
        method: "DELETE",
      }),
      { params: Promise.resolve({ path: ["secrets", "sec_openai"] }) },
    );

    expect(response.status).toBe(200);
    expect(updateUserMetadataMock).toHaveBeenCalledWith(
      "user_123",
      expect.objectContaining({
        privateMetadata: expect.objectContaining({
          autopilotLlmReadiness: expect.objectContaining({
            status: "blocked",
            probedAdapterType: null,
            checkedAt: null,
          }),
        }),
      }),
    );
  });
});
