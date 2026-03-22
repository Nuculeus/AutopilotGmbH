import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.fn();
const getRunForUserMock = vi.fn();

vi.mock("@clerk/nextjs/server", () => ({
  auth: authMock,
}));

vi.mock("@/lib/run-store", () => ({
  getRunForUser: getRunForUserMock,
}));

describe("GET /api/runs/[id]", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    authMock.mockResolvedValue({ userId: null });

    const { GET } = await import("@/app/api/runs/[id]/route");
    const response = await GET(
      new Request("http://localhost/api/runs/run_1"),
      { params: Promise.resolve({ id: "run_1" }) },
    );

    expect(response.status).toBe(401);
  });

  it("returns 404 when the run does not belong to the user", async () => {
    authMock.mockResolvedValue({ userId: "user_123" });
    getRunForUserMock.mockResolvedValue(null);

    const { GET } = await import("@/app/api/runs/[id]/route");
    const response = await GET(
      new Request("http://localhost/api/runs/run_1"),
      { params: Promise.resolve({ id: "run_1" }) },
    );

    expect(response.status).toBe(404);
  });

  it("returns the durable run status, steps, and final charge summary", async () => {
    authMock.mockResolvedValue({ userId: "user_123" });
    getRunForUserMock.mockResolvedValue({
      id: "run_1",
      ventureId: "venture_1",
      kind: "service_offer_iteration",
      status: "running",
      requestedBudgetCents: 2500,
      spentCents: 500,
      errorMessage: null,
      steps: [
        {
          id: "step_1",
          stepKey: "prepare_offer",
          status: "succeeded",
          errorCode: null,
          errorMessage: null,
          startedAt: "2026-03-22T10:00:00.000Z",
          finishedAt: "2026-03-22T10:01:00.000Z",
        },
      ],
      logsSummary: "1 step recorded",
      finalCharge: {
        credits: 5,
        euroCostCents: 0,
        providerCostCents: 500,
      },
    });

    const { GET } = await import("@/app/api/runs/[id]/route");
    const response = await GET(
      new Request("http://localhost/api/runs/run_1"),
      { params: Promise.resolve({ id: "run_1" }) },
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual(
      expect.objectContaining({
        id: "run_1",
        status: "running",
        steps: expect.any(Array),
        finalCharge: expect.objectContaining({
          providerCostCents: 500,
        }),
      }),
    );
  });
});
