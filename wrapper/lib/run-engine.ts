export type DurableRunStatus =
  | "draft"
  | "queued"
  | "running"
  | "awaiting_approval"
  | "succeeded"
  | "failed"
  | "canceled";

export type DraftRunRecord = {
  id: string;
  ventureId: string;
  kind: string;
  status: "draft";
  attempt: number;
  requestedBudgetCents: number;
  payload: unknown;
};

export type QueuedRunRecord = Omit<DraftRunRecord, "status"> & {
  status: "queued";
};

type AwaitingApprovalRunRecord = Omit<DraftRunRecord, "status"> & {
  status: "awaiting_approval";
};

export type RunHandlerResult = {
  output?: unknown;
  spentCents?: number;
};

export type RunHandler = (run: QueuedRunRecord) => Promise<RunHandlerResult>;
export type RunHandlerMap = Record<string, RunHandler>;

export type RunQueueDriver = {
  claimNextQueuedRun(): Promise<QueuedRunRecord | null>;
  markRunRunning(input: { runId: string; workerId: string; attempt: number }): Promise<void>;
  appendRunStep(input: {
    runId: string;
    stepKey: string;
    status: "running" | "succeeded" | "failed";
    errorCode?: string | null;
  }): Promise<void>;
  markRunQueued(input: { runId: string; attempt: number; errorMessage?: string | null }): Promise<void>;
  markRunSucceeded(input: { runId: string; output?: unknown; spentCents?: number }): Promise<void>;
  markRunFailed(input: { runId: string; errorMessage: string; errorCode?: string | null }): Promise<void>;
};

export class RetryableRunError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RetryableRunError";
  }
}

class RunTimeoutError extends Error {
  timeoutMs: number;

  constructor(timeoutMs: number) {
    super(`Run timed out after ${timeoutMs}ms`);
    this.name = "RunTimeoutError";
    this.timeoutMs = timeoutMs;
  }
}

export function transitionDraftRunToQueued(run: DraftRunRecord): QueuedRunRecord {
  return {
    ...run,
    status: "queued",
  };
}

export function transitionDraftRunToAwaitingApproval(
  run: DraftRunRecord,
): AwaitingApprovalRunRecord {
  return {
    ...run,
    status: "awaiting_approval",
  };
}

function runWithTimeout<T>(promise: Promise<T>, timeoutMs: number) {
  return Promise.race<T>([
    promise,
    new Promise<T>((_, reject) => {
      const timer = setTimeout(() => reject(new RunTimeoutError(timeoutMs)), timeoutMs);
      promise.finally(() => clearTimeout(timer)).catch(() => undefined);
    }),
  ]);
}

export async function processNextQueuedRun(input: {
  workerId: string;
  driver: RunQueueDriver;
  handlers: RunHandlerMap;
  maxAttempts?: number;
  timeoutMs?: number;
}) {
  const run = await input.driver.claimNextQueuedRun();
  if (!run) {
    return { status: "idle" as const };
  }

  const handler = input.handlers[run.kind];
  if (!handler) {
    await input.driver.markRunFailed({
      runId: run.id,
      errorMessage: `No handler registered for run kind ${run.kind}`,
      errorCode: "handler_missing",
    });

    return {
      status: "failed" as const,
      runId: run.id,
      errorCode: "handler_missing" as const,
    };
  }

  const maxAttempts = Math.max(1, input.maxAttempts ?? 3);
  const timeoutMs = Math.max(1, input.timeoutMs ?? 30_000);

  await input.driver.markRunRunning({
    runId: run.id,
    workerId: input.workerId,
    attempt: run.attempt,
  });
  await input.driver.appendRunStep({
    runId: run.id,
    stepKey: run.kind,
    status: "running",
  });

  try {
    const result = await runWithTimeout(handler(run), timeoutMs);

    await input.driver.appendRunStep({
      runId: run.id,
      stepKey: run.kind,
      status: "succeeded",
    });
    await input.driver.markRunSucceeded({
      runId: run.id,
      output: result.output,
      spentCents: result.spentCents,
    });

    return {
      status: "succeeded" as const,
      runId: run.id,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Run failed";
    const isTimeout = error instanceof RunTimeoutError;
    const isRetryable = error instanceof RetryableRunError || isTimeout;
    const canRetry = isRetryable && run.attempt < maxAttempts;

    await input.driver.appendRunStep({
      runId: run.id,
      stepKey: run.kind,
      status: "failed",
      errorCode: isTimeout ? "timeout" : isRetryable ? "retryable_error" : "run_failed",
    });

    if (canRetry) {
      const nextAttempt = run.attempt + 1;
      await input.driver.markRunQueued({
        runId: run.id,
        attempt: nextAttempt,
        errorMessage: message,
      });

      return {
        status: "requeued" as const,
        runId: run.id,
        nextAttempt,
      };
    }

    const errorCode = isTimeout ? "timeout" : isRetryable ? "retryable_error" : "run_failed";
    await input.driver.markRunFailed({
      runId: run.id,
      errorMessage: message,
      errorCode,
    });

    return {
      status: "failed" as const,
      runId: run.id,
      errorCode,
    };
  }
}
