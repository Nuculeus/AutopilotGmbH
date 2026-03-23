import postgres from "postgres";
import { resolveControlPlaneDatabaseUrl } from "@/lib/db/client";
import { ensureControlPlaneSchema } from "@/lib/db/schema";
import { insertUsageEvent } from "@/lib/db/write-repository";
import type { SqlClient } from "@/lib/db/types";
import type { RevenueTrack } from "@/lib/revenue-track";
import type {
  DraftRunRecord,
  QueuedRunRecord,
  RunQueueDriver,
} from "@/lib/run-engine";
import {
  transitionDraftRunToAwaitingApproval,
  transitionDraftRunToQueued,
} from "@/lib/run-engine";

type VentureOwnershipRow = {
  id: string;
  workspace_id: string;
  name: string;
  revenue_track: RevenueTrack;
  status: string;
  clerk_user_id: string;
};

type RunExecutionRow = {
  id: string;
  venture_id: string;
  run_kind: string;
  status: string;
  input_json?: unknown;
  attempt?: number;
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

export type QueueRunInput = {
  ventureId: string;
  kind: string;
  payload?: unknown;
  requestedBudgetCents?: number | null;
  heavyUsage?: boolean;
  allowHeavyPassThrough?: boolean;
};

export type QueueRunResult =
  | {
      status: "queued";
      run: {
        id: string;
        ventureId: string;
        status: "queued";
      };
    }
  | {
      status: "blocked";
      reason: "budget_cap_exceeded" | "heavy_usage_pass_through_required";
      approvalGateId: string;
    };

export class RunStoreError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "RunStoreError";
    this.status = status;
  }
}

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

function toJson(value: unknown) {
  return JSON.stringify(value ?? {});
}

function toDraftRunRecord(input: {
  ventureId: string;
  kind: string;
  payload?: unknown;
  requestedBudgetCents: number;
}): DraftRunRecord {
  return {
    id: `run_${crypto.randomUUID()}`,
    ventureId: input.ventureId,
    kind: input.kind,
    status: "draft",
    attempt: 1,
    requestedBudgetCents: input.requestedBudgetCents,
    payload: input.payload ?? {},
  };
}

async function getOwnedVenture(input: {
  sql: SqlClient;
  clerkUserId: string;
  ventureId: string;
}) {
  const rows = await input.sql<VentureOwnershipRow[]>`
    SELECT v.id, v.workspace_id, v.name, v.revenue_track, v.status, w.clerk_user_id
    FROM ventures v
    JOIN workspaces w ON w.id = v.workspace_id
    WHERE v.id = ${input.ventureId} AND w.clerk_user_id = ${input.clerkUserId}
    LIMIT 1
  `;

  return rows[0] ?? null;
}

async function createApprovalGate(input: {
  sql: SqlClient;
  ventureId: string;
  gateType: string;
  reason: string;
  payload: Record<string, unknown>;
}) {
  const gateId = `gate_${crypto.randomUUID()}`;
  await input.sql`
    INSERT INTO approval_gates (id, venture_id, gate_type, status, reason, payload_json)
    VALUES (${gateId}, ${input.ventureId}, ${input.gateType}, 'pending', ${input.reason}, ${toJson(input.payload)}::jsonb)
  `;
  return gateId;
}

async function persistDraftRun(input: {
  sql: SqlClient;
  draft: DraftRunRecord;
}) {
  await input.sql`
    INSERT INTO run_executions (
      id,
      venture_id,
      run_kind,
      status,
      input_json,
      requested_budget_cents,
      attempt,
      updated_at
    )
    VALUES (
      ${input.draft.id},
      ${input.draft.ventureId},
      ${input.draft.kind},
      ${input.draft.status},
      ${toJson(input.draft.payload)}::jsonb,
      ${input.draft.requestedBudgetCents},
      ${input.draft.attempt},
      NOW()
    )
  `;
}

async function updateRunStatus(input: {
  sql: SqlClient;
  runId: string;
  status: string;
  errorMessage?: string | null;
  output?: unknown;
}) {
  await input.sql`
    UPDATE run_executions
    SET
      status = ${input.status},
      error_message = ${input.errorMessage ?? null},
      output_json = ${toJson(input.output ?? {})}::jsonb,
      updated_at = NOW()
    WHERE id = ${input.runId}
  `;
}

async function getRunWorkspaceContext(input: { sql: SqlClient; runId: string }) {
  const rows = await input.sql<Array<{ workspace_id: string; venture_id: string }>>`
    SELECT v.workspace_id, r.venture_id
    FROM run_executions r
    JOIN ventures v ON v.id = r.venture_id
    WHERE r.id = ${input.runId}
    LIMIT 1
  `;

  return rows[0] ?? null;
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

export async function queueRunForUser(input: {
  clerkUserId: string;
  input: QueueRunInput;
}): Promise<QueueRunResult> {
  const sql = getSql();
  if (!sql) {
    throw new RunStoreError(503, "DATABASE_URL fehlt. Run-Store ist nicht verfuegbar.");
  }
  await ensureRunSchema(sql);

  const venture = await getOwnedVenture({
    sql,
    clerkUserId: input.clerkUserId,
    ventureId: input.input.ventureId,
  });

  if (!venture) {
    throw new RunStoreError(404, "Venture nicht gefunden.");
  }

  const specRows = await sql<Array<{ budget_cap_cents: number | null }>>`
    SELECT budget_cap_cents
    FROM venture_specs
    WHERE venture_id = ${venture.id}
    LIMIT 1
  `;
  const budgetCap = specRows[0]?.budget_cap_cents ?? null;
  const requestedBudget = Math.max(0, input.input.requestedBudgetCents ?? 0);
  const draft = toDraftRunRecord({
    ventureId: venture.id,
    kind: input.input.kind,
    payload: input.input.payload,
    requestedBudgetCents: requestedBudget,
  });

  await persistDraftRun({
    sql,
    draft,
  });

  if (budgetCap && budgetCap > 0) {
    const spendRows = await sql<Array<{ current_spend: number }>>`
      SELECT COALESCE(SUM(provider_cost_cents), 0)::int AS current_spend
      FROM credit_ledger
      WHERE venture_id = ${venture.id}
      AND DATE_TRUNC('month', created_at) = DATE_TRUNC('month', NOW())
    `;
    const currentSpend = spendRows[0]?.current_spend ?? 0;

    if (currentSpend + requestedBudget > budgetCap) {
      const gateId = await createApprovalGate({
        sql,
        ventureId: venture.id,
        gateType: "budget_cap",
        reason: "budget_cap_exceeded",
        payload: {
          budgetCapCents: budgetCap,
          currentSpendCents: currentSpend,
          requestedBudgetCents: requestedBudget,
          runKind: input.input.kind,
        },
      });

      const awaitingApproval = transitionDraftRunToAwaitingApproval(draft);
      await updateRunStatus({
        sql,
        runId: awaitingApproval.id,
        status: awaitingApproval.status,
        output: { approvalGateId: gateId, reason: "budget_cap_exceeded" },
      });

      return {
        status: "blocked",
        reason: "budget_cap_exceeded",
        approvalGateId: gateId,
      };
    }
  }

  if (input.input.heavyUsage && !input.input.allowHeavyPassThrough) {
    const gateId = await createApprovalGate({
      sql,
      ventureId: venture.id,
      gateType: "heavy_usage_pass_through",
      reason: "heavy_usage_pass_through_required",
      payload: {
        kind: input.input.kind,
      },
    });

    const awaitingApproval = transitionDraftRunToAwaitingApproval(draft);
    await updateRunStatus({
      sql,
      runId: awaitingApproval.id,
      status: awaitingApproval.status,
      output: { approvalGateId: gateId, reason: "heavy_usage_pass_through_required" },
    });

    return {
      status: "blocked",
      reason: "heavy_usage_pass_through_required",
      approvalGateId: gateId,
    };
  }
  const queued = transitionDraftRunToQueued(draft);
  await updateRunStatus({
    sql,
    runId: queued.id,
    status: queued.status,
  });

  return {
    status: "queued",
    run: {
      id: queued.id,
      ventureId: queued.ventureId,
      status: queued.status,
    },
  };
}

function mapQueuedRun(row: RunExecutionRow): QueuedRunRecord {
  return {
    id: row.id,
    ventureId: row.venture_id,
    kind: row.run_kind,
    status: "queued",
    attempt: row.attempt ?? 1,
    requestedBudgetCents: row.requested_budget_cents,
    payload: row.input_json ?? {},
  };
}

export function createRunQueueDriver(): RunQueueDriver {
  return {
    async claimNextQueuedRun() {
      const sql = getSql();
      if (!sql) {
        throw new RunStoreError(503, "DATABASE_URL fehlt. Run-Store ist nicht verfuegbar.");
      }
      await ensureRunSchema(sql);

      return sql.begin(async (transaction) => {
        const tx = transaction as unknown as SqlClient;

        const rows = await tx<RunExecutionRow[]>`
          SELECT
            id,
            venture_id,
            run_kind,
            status,
            input_json,
            attempt,
            requested_budget_cents,
            spent_cents,
            error_message
          FROM run_executions
          WHERE status = 'queued'
          ORDER BY created_at ASC
          FOR UPDATE SKIP LOCKED
          LIMIT 1
        `;

        const run = rows[0];
        if (!run) {
          return null;
        }

        await tx`
          UPDATE run_executions
          SET status = 'running', started_at = COALESCE(started_at, NOW()), updated_at = NOW()
          WHERE id = ${run.id}
        `;

        return mapQueuedRun(run);
      });
    },

    async markRunRunning(input) {
      const sql = getSql();
      if (!sql) {
        throw new RunStoreError(503, "DATABASE_URL fehlt. Run-Store ist nicht verfuegbar.");
      }
      await ensureRunSchema(sql);

      await sql`
        UPDATE run_executions
        SET status = 'running', attempt = ${input.attempt}, started_at = COALESCE(started_at, NOW()), updated_at = NOW()
        WHERE id = ${input.runId}
      `;
    },

    async appendRunStep(input) {
      const sql = getSql();
      if (!sql) {
        throw new RunStoreError(503, "DATABASE_URL fehlt. Run-Store ist nicht verfuegbar.");
      }
      await ensureRunSchema(sql);

      if (input.status === "running") {
        await sql`
          INSERT INTO run_steps (id, run_id, step_key, status, started_at, updated_at)
          VALUES (${`step_${crypto.randomUUID()}`}, ${input.runId}, ${input.stepKey}, 'running', NOW(), NOW())
        `;
        return;
      }

      const updated = await sql<Array<{ id: string }>>`
        UPDATE run_steps
        SET
          status = ${input.status},
          error_code = ${input.errorCode ?? null},
          finished_at = NOW(),
          updated_at = NOW()
        WHERE id = (
          SELECT id
          FROM run_steps
          WHERE run_id = ${input.runId} AND step_key = ${input.stepKey}
          ORDER BY created_at DESC
          LIMIT 1
        )
        RETURNING id
      `;

      if (!updated[0]) {
        await sql`
          INSERT INTO run_steps (
            id,
            run_id,
            step_key,
            status,
            error_code,
            started_at,
            finished_at,
            updated_at
          )
          VALUES (
            ${`step_${crypto.randomUUID()}`},
            ${input.runId},
            ${input.stepKey},
            ${input.status},
            ${input.errorCode ?? null},
            NOW(),
            NOW(),
            NOW()
          )
        `;
      }
    },

    async markRunQueued(input) {
      const sql = getSql();
      if (!sql) {
        throw new RunStoreError(503, "DATABASE_URL fehlt. Run-Store ist nicht verfuegbar.");
      }
      await ensureRunSchema(sql);

      await sql`
        UPDATE run_executions
        SET
          status = 'queued',
          attempt = ${input.attempt},
          error_message = ${input.errorMessage ?? null},
          updated_at = NOW()
        WHERE id = ${input.runId}
      `;
    },

    async markRunSucceeded(input) {
      const sql = getSql();
      if (!sql) {
        throw new RunStoreError(503, "DATABASE_URL fehlt. Run-Store ist nicht verfuegbar.");
      }
      await ensureRunSchema(sql);
      const spentCents = Math.max(0, input.spentCents ?? 0);

      await sql`
        UPDATE run_executions
        SET
          status = 'succeeded',
          output_json = ${toJson(input.output ?? {})}::jsonb,
          spent_cents = ${spentCents},
          error_message = NULL,
          finished_at = NOW(),
          updated_at = NOW()
        WHERE id = ${input.runId}
      `;

      if (spentCents > 0) {
        const context = await getRunWorkspaceContext({
          sql,
          runId: input.runId,
        });

        if (context) {
          await insertUsageEvent(sql, {
            id: `usage_${crypto.randomUUID()}`,
            workspaceId: context.workspace_id,
            ventureId: context.venture_id,
            runId: input.runId,
            provider: "internal_worker",
            category: "run_execution",
            unitCount: 1,
            estimatedCostCents: 0,
            finalCostCents: spentCents,
            metadataJson: {
              source: "run_store",
            },
            createdAt: new Date().toISOString(),
          });
        }
      }
    },

    async markRunFailed(input) {
      const sql = getSql();
      if (!sql) {
        throw new RunStoreError(503, "DATABASE_URL fehlt. Run-Store ist nicht verfuegbar.");
      }
      await ensureRunSchema(sql);

      await sql`
        UPDATE run_executions
        SET
          status = 'failed',
          error_message = ${input.errorMessage},
          finished_at = NOW(),
          updated_at = NOW()
        WHERE id = ${input.runId}
      `;
    },
  };
}
