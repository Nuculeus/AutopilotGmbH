import { describe, expect, it } from "vitest";
import {
  processNextQueuedRun,
  RetryableRunError,
  transitionDraftRunToAwaitingApproval,
  transitionDraftRunToQueued,
  type QueuedRunRecord,
  type RunQueueDriver,
} from "@/lib/run-engine";

class MemoryRunQueueDriver implements RunQueueDriver {
  private queue: QueuedRunRecord[];
  events: string[] = [];

  constructor(runs: QueuedRunRecord[]) {
    this.queue = [...runs];
  }

  async claimNextQueuedRun() {
    const next = this.queue.shift() ?? null;
    if (next) {
      this.events.push(`claim:${next.id}:attempt-${next.attempt}`);
    }
    return next;
  }

  async markRunRunning(input: { runId: string; workerId: string; attempt: number }) {
    this.events.push(`running:${input.runId}:${input.workerId}:attempt-${input.attempt}`);
  }

  async appendRunStep(input: { runId: string; stepKey: string; status: string; errorCode?: string | null }) {
    this.events.push(`step:${input.runId}:${input.stepKey}:${input.status}:${input.errorCode ?? "none"}`);
  }

  async markRunQueued(input: { runId: string; attempt: number; errorMessage?: string | null }) {
    this.events.push(`queued:${input.runId}:attempt-${input.attempt}:${input.errorMessage ?? "none"}`);
  }

  async markRunSucceeded(input: { runId: string; output?: unknown; spentCents?: number }) {
    this.events.push(`succeeded:${input.runId}:${input.spentCents ?? 0}:${JSON.stringify(input.output ?? {})}`);
  }

  async markRunFailed(input: { runId: string; errorMessage: string; errorCode?: string | null }) {
    this.events.push(`failed:${input.runId}:${input.errorCode ?? "none"}:${input.errorMessage}`);
  }
}

describe("run engine", () => {
  it("moves a draft run into queued and then through running to succeeded", async () => {
    const draft = {
      id: "run_1",
      ventureId: "venture_1",
      kind: "service_offer_iteration",
      status: "draft" as const,
      attempt: 1,
      requestedBudgetCents: 1500,
      payload: { angle: "proof-first" },
    };

    const queued = transitionDraftRunToQueued(draft);
    const driver = new MemoryRunQueueDriver([queued]);

    const result = await processNextQueuedRun({
      workerId: "worker_1",
      driver,
      handlers: {
        service_offer_iteration: async () => ({
          output: { offerId: "offer_1" },
          spentCents: 220,
        }),
      },
    });

    expect(result).toEqual({
      status: "succeeded",
      runId: "run_1",
    });
    expect(driver.events).toEqual([
      "claim:run_1:attempt-1",
      "running:run_1:worker_1:attempt-1",
      "step:run_1:service_offer_iteration:running:none",
      'step:run_1:service_offer_iteration:succeeded:none',
      'succeeded:run_1:220:{"offerId":"offer_1"}',
    ]);
  });

  it("requeues retryable failures with incremented attempt counts", async () => {
    const driver = new MemoryRunQueueDriver([
      {
        id: "run_retry",
        ventureId: "venture_1",
        kind: "service_offer_iteration",
        status: "queued",
        attempt: 1,
        requestedBudgetCents: 800,
        payload: {},
      },
    ]);

    const result = await processNextQueuedRun({
      workerId: "worker_retry",
      driver,
      handlers: {
        service_offer_iteration: async () => {
          throw new RetryableRunError("transient upstream failure");
        },
      },
      maxAttempts: 3,
    });

    expect(result).toEqual({
      status: "requeued",
      runId: "run_retry",
      nextAttempt: 2,
    });
    expect(driver.events).toEqual([
      "claim:run_retry:attempt-1",
      "running:run_retry:worker_retry:attempt-1",
      "step:run_retry:service_offer_iteration:running:none",
      "step:run_retry:service_offer_iteration:failed:retryable_error",
      "queued:run_retry:attempt-2:transient upstream failure",
    ]);
  });

  it("keeps approval-gated draft runs out of the queue", async () => {
    const awaitingApproval = transitionDraftRunToAwaitingApproval({
      id: "run_gate",
      ventureId: "venture_1",
      kind: "service_offer_iteration",
      status: "draft",
      attempt: 1,
      requestedBudgetCents: 5000,
      payload: { approvalGateId: "gate_1" },
    });

    expect(awaitingApproval).toEqual(
      expect.objectContaining({
        id: "run_gate",
        status: "awaiting_approval",
      }),
    );
  });

  it("fails timed out runs instead of leaving them hanging", async () => {
    const driver = new MemoryRunQueueDriver([
      {
        id: "run_timeout",
        ventureId: "venture_1",
        kind: "service_offer_iteration",
        status: "queued",
        attempt: 1,
        requestedBudgetCents: 900,
        payload: {},
      },
    ]);

    const result = await processNextQueuedRun({
      workerId: "worker_timeout",
      driver,
      handlers: {
        service_offer_iteration: async () => {
          await new Promise((resolve) => setTimeout(resolve, 20));
          return { output: { late: true }, spentCents: 100 };
        },
      },
      timeoutMs: 5,
      maxAttempts: 1,
    });

    expect(result).toEqual({
      status: "failed",
      runId: "run_timeout",
      errorCode: "timeout",
    });
    expect(driver.events).toEqual([
      "claim:run_timeout:attempt-1",
      "running:run_timeout:worker_timeout:attempt-1",
      "step:run_timeout:service_offer_iteration:running:none",
      "step:run_timeout:service_offer_iteration:failed:timeout",
      "failed:run_timeout:timeout:Run timed out after 5ms",
    ]);
  });
});
