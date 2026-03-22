import {
  processNextQueuedRun,
  type RunHandlerMap,
} from "@/lib/run-engine";
import { createRunQueueDriver } from "@/lib/run-store";

type WorkNextQueuedRunInput = {
  workerId: string;
  handlers: RunHandlerMap;
  maxAttempts?: number;
  timeoutMs?: number;
};

export async function workNextQueuedRun(input: WorkNextQueuedRunInput) {
  return processNextQueuedRun({
    workerId: input.workerId,
    driver: createRunQueueDriver(),
    handlers: input.handlers,
    maxAttempts: input.maxAttempts,
    timeoutMs: input.timeoutMs,
  });
}
