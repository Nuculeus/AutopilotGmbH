import { beforeEach, describe, expect, it, vi } from "vitest";

const processNextQueuedRunMock = vi.fn();
const createRunQueueDriverMock = vi.fn();

vi.mock("@/lib/run-engine", () => ({
  processNextQueuedRun: processNextQueuedRunMock,
}));

vi.mock("@/lib/run-store", () => ({
  createRunQueueDriver: createRunQueueDriverMock,
}));

describe("run worker entrypoint", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("builds a postgres-backed driver and delegates work execution", async () => {
    const driver = { name: "pg-driver" };
    createRunQueueDriverMock.mockReturnValue(driver);
    processNextQueuedRunMock.mockResolvedValue({
      status: "succeeded",
      runId: "run_1",
    });

    const { workNextQueuedRun } = await import("@/lib/run-worker");
    const result = await workNextQueuedRun({
      workerId: "worker_1",
      handlers: {
        service_offer_iteration: async () => ({
          output: { offerId: "offer_1" },
        }),
      },
      maxAttempts: 4,
      timeoutMs: 12_000,
    });

    expect(createRunQueueDriverMock).toHaveBeenCalledTimes(1);
    expect(processNextQueuedRunMock).toHaveBeenCalledWith({
      workerId: "worker_1",
      driver,
      handlers: expect.any(Object),
      maxAttempts: 4,
      timeoutMs: 12_000,
    });
    expect(result).toEqual({
      status: "succeeded",
      runId: "run_1",
    });
  });
});
