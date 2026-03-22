import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.fn();
const decideExperimentForUserMock = vi.fn();

vi.mock("@clerk/nextjs/server", () => ({
  auth: authMock,
}));

vi.mock("@/lib/control-plane-store", () => ({
  decideExperimentForUser: decideExperimentForUserMock,
}));

describe("POST /api/experiments/[id]/decide", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    authMock.mockResolvedValue({ userId: null });

    const { POST } = await import("@/app/api/experiments/[id]/decide/route");
    const response = await POST(
      new Request("http://localhost/api/experiments/exp_1/decide", {
        method: "POST",
      }),
      {
        params: Promise.resolve({ id: "exp_1" }),
      },
    );

    expect(response.status).toBe(401);
  });

  it("accepts keep/discard decision", async () => {
    authMock.mockResolvedValue({ userId: "user_123" });
    decideExperimentForUserMock.mockResolvedValue({
      experimentId: "exp_1",
      status: "decided",
      decision: "keep",
    });

    const { POST } = await import("@/app/api/experiments/[id]/decide/route");
    const response = await POST(
      new Request("http://localhost/api/experiments/exp_1/decide", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          decision: "keep",
          reason: "Variante B hat die beste Reply-Rate.",
        }),
      }),
      {
        params: Promise.resolve({ id: "exp_1" }),
      },
    );

    expect(response.status).toBe(200);
    expect(decideExperimentForUserMock).toHaveBeenCalledWith({
      clerkUserId: "user_123",
      experimentId: "exp_1",
      decision: "keep",
      reason: "Variante B hat die beste Reply-Rate.",
    });
  });
});
