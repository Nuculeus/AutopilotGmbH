import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.fn();
const queueRunForUserMock = vi.fn();

vi.mock("@clerk/nextjs/server", () => ({
  auth: authMock,
}));

vi.mock("@/lib/control-plane-store", () => ({
  queueRunForUser: queueRunForUserMock,
}));

describe("POST /api/runs", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    authMock.mockResolvedValue({ userId: null });

    const { POST } = await import("@/app/api/runs/route");
    const response = await POST(
      new Request("http://localhost/api/runs", {
        method: "POST",
      }),
    );

    expect(response.status).toBe(401);
  });

  it("returns 409 when budget guard blocks the run", async () => {
    authMock.mockResolvedValue({ userId: "user_123" });
    queueRunForUserMock.mockResolvedValue({
      status: "blocked",
      reason: "budget_cap_exceeded",
      approvalGateId: "gate_1",
    });

    const { POST } = await import("@/app/api/runs/route");
    const response = await POST(
      new Request("http://localhost/api/runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ventureId: "v1",
          kind: "service_offer_iteration",
          requestedBudgetCents: 5000,
        }),
      }),
    );

    expect(response.status).toBe(409);
    const payload = await response.json();
    expect(payload).toEqual(
      expect.objectContaining({
        error: "Run blocked by approval gate",
        approvalGateId: "gate_1",
      }),
    );
  });

  it("queues a run when the guard allows it", async () => {
    authMock.mockResolvedValue({ userId: "user_123" });
    queueRunForUserMock.mockResolvedValue({
      status: "queued",
      run: {
        id: "run_1",
        ventureId: "v1",
        status: "queued",
      },
    });

    const { POST } = await import("@/app/api/runs/route");
    const response = await POST(
      new Request("http://localhost/api/runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ventureId: "v1",
          kind: "service_offer_iteration",
          requestedBudgetCents: 2500,
        }),
      }),
    );

    expect(response.status).toBe(201);
    expect(queueRunForUserMock).toHaveBeenCalledWith({
      clerkUserId: "user_123",
      input: expect.objectContaining({
        ventureId: "v1",
        kind: "service_offer_iteration",
      }),
    });
  });
});
