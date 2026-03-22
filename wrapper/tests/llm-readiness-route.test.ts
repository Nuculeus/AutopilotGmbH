import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.fn();
const getUserMock = vi.fn();
const updateUserMetadataMock = vi.fn();
const listCompanyAgentsMock = vi.fn();
const assessLlmReadinessMock = vi.fn();

vi.mock("@clerk/nextjs/server", () => ({
  auth: authMock,
  clerkClient: vi.fn(async () => ({
    users: {
      getUser: getUserMock,
      updateUserMetadata: updateUserMetadataMock,
    },
  })),
}));

vi.mock("@/lib/paperclip-admin", () => ({
  canTargetCompany: (input: { companyId: string | null; bridgePrincipalId: string | null }) =>
    Boolean(input.companyId && input.bridgePrincipalId),
  listCompanyAgents: listCompanyAgentsMock,
}));

vi.mock("@/lib/llm-readiness", () => ({
  assessLlmReadiness: assessLlmReadinessMock,
}));

describe("POST /api/connections/llm-readiness", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("returns blocked when workspace provisioning is missing", async () => {
    authMock.mockResolvedValue({ userId: "user_123" });
    getUserMock.mockResolvedValue({
      id: "user_123",
      publicMetadata: {},
    });

    const { POST } = await import("@/app/api/connections/llm-readiness/route");
    const response = await POST();
    const payload = await response.json();

    expect(response.status).toBe(409);
    expect(payload.status).toBe("blocked");
    expect(listCompanyAgentsMock).not.toHaveBeenCalled();
  });

  it("returns readiness report when company context exists", async () => {
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
    listCompanyAgentsMock.mockResolvedValue([
      {
        id: "agent_ceo",
        name: "CEO",
        role: "ceo",
        adapterType: "codex_local",
        adapterConfig: {},
      },
    ]);
    assessLlmReadinessMock.mockResolvedValue({
      status: "ready",
      summary: "LLM-Zugang ist lauffähig.",
      probedAdapterType: "codex_local",
      checkedAt: "2026-03-22T00:00:00.000Z",
    });

    const { POST } = await import("@/app/api/connections/llm-readiness/route");
    const response = await POST();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.status).toBe("ready");
    expect(listCompanyAgentsMock).toHaveBeenCalledWith({
      companyId: "cmp_123",
      bridgePrincipalId: "clerk:user_123",
    });
    expect(updateUserMetadataMock).toHaveBeenCalledWith(
      "user_123",
      expect.objectContaining({
        privateMetadata: expect.objectContaining({
          autopilotLlmReadiness: expect.objectContaining({
            status: "ready",
            summary: "LLM-Zugang ist lauffähig.",
            probedAdapterType: "codex_local",
          }),
        }),
      }),
    );
  });
});
