import postgres from "postgres";
import { resolveControlPlaneDatabaseUrl } from "@/lib/db/client";
import { ensureControlPlaneSchema } from "@/lib/db/schema";
import type { SqlClient } from "@/lib/db/types";

type RunExecutionRow = {
  id: string;
  venture_id: string;
  run_kind: string;
  status: string;
  requested_budget_cents: number;
  spent_cents: number;
  error_message: string | null;
};

type RunStepRow = {
  id: string;
  step_key: string;
  status: string;
  error_code: string | null;
  error_message: string | null;
  started_at: string | null;
  finished_at: string | null;
};

let sqlClient: SqlClient | null = null;
let schemaReady: Promise<void> | null = null;

function getSql() {
  const dbUrl = resolveControlPlaneDatabaseUrl(process.env.DATABASE_URL);
  if (!dbUrl) {
    return null;
  }

  if (!sqlClient) {
    sqlClient = postgres(dbUrl, {
      max: 3,
      prepare: false,
      idle_timeout: 10,
    });
  }

  return sqlClient;
}

async function ensureRunSchema(sql: SqlClient) {
  if (!schemaReady) {
    schemaReady = ensureControlPlaneSchema(sql);
  }

  await schemaReady;
}

export async function getRunForUser(input: { clerkUserId: string; runId: string }) {
  const sql = getSql();
  if (!sql) {
    return null;
  }
  await ensureRunSchema(sql);

  const runs = await sql<RunExecutionRow[]>`
    SELECT
      r.id,
      r.venture_id,
      r.run_kind,
      r.status,
      r.requested_budget_cents,
      r.spent_cents,
      r.error_message
    FROM run_executions r
    JOIN ventures v ON v.id = r.venture_id
    JOIN workspaces w ON w.id = v.workspace_id
    WHERE r.id = ${input.runId} AND w.clerk_user_id = ${input.clerkUserId}
    LIMIT 1
  `;

  const run = runs[0];
  if (!run) {
    return null;
  }

  const steps = await sql<RunStepRow[]>`
    SELECT
      id,
      step_key,
      status,
      error_code,
      error_message,
      started_at::text,
      finished_at::text
    FROM run_steps
    WHERE run_id = ${run.id}
    ORDER BY created_at ASC
  `;

  return {
    id: run.id,
    ventureId: run.venture_id,
    kind: run.run_kind,
    status: run.status,
    requestedBudgetCents: run.requested_budget_cents,
    spentCents: run.spent_cents,
    errorMessage: run.error_message,
    steps: steps.map((step) => ({
      id: step.id,
      stepKey: step.step_key,
      status: step.status,
      errorCode: step.error_code,
      errorMessage: step.error_message,
      startedAt: step.started_at,
      finishedAt: step.finished_at,
    })),
    logsSummary:
      steps.length > 0
        ? `${steps.length} step${steps.length === 1 ? "" : "s"} recorded`
        : "No steps recorded yet",
    finalCharge: {
      credits: 0,
      euroCostCents: 0,
      providerCostCents: run.spent_cents,
    },
  };
}
