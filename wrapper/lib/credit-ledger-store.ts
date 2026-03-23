import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { resolveControlPlaneDatabaseUrl } from "@/lib/db/client";
import { ensureControlPlaneSchema } from "@/lib/db/schema";
import type { SqlClient, VentureRow, WorkspaceRow } from "@/lib/db/types";
import type { CreditLedgerEventKind } from "@/lib/credits";

type CreditLedgerEventInput = {
  ventureId?: string | null;
  eventKind: CreditLedgerEventKind;
  creditsDelta: number;
  euroCostCents?: number;
  providerCostCents?: number;
  note?: string | null;
  metadata?: Record<string, unknown>;
  createdAt?: string;
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

async function ensureLedgerSchema(sql: SqlClient) {
  if (!schemaReady) {
    schemaReady = ensureControlPlaneSchema(sql);
  }

  await schemaReady;
}

function toJson(value: unknown) {
  return JSON.stringify(value ?? {});
}

async function ensureWorkspace(sql: SqlClient, clerkUserId: string) {
  const existing = await sql<WorkspaceRow[]>`
    SELECT id, clerk_user_id, company_id, company_name, bridge_principal_id
    FROM workspaces
    WHERE clerk_user_id = ${clerkUserId}
    LIMIT 1
  `;

  if (existing[0]) {
    return existing[0];
  }

  const inserted = await sql<WorkspaceRow[]>`
    INSERT INTO workspaces (id, clerk_user_id)
    VALUES (${`ws_${randomUUID()}`}, ${clerkUserId})
    RETURNING id, clerk_user_id, company_id, company_name, bridge_principal_id
  `;

  return inserted[0];
}

async function getPrimaryVenture(sql: SqlClient, workspaceId: string) {
  const rows = await sql<VentureRow[]>`
    SELECT id, workspace_id, name, revenue_track, status
    FROM ventures
    WHERE workspace_id = ${workspaceId}
    ORDER BY created_at ASC
    LIMIT 1
  `;

  return rows[0] ?? null;
}

async function getOwnedVenture(sql: SqlClient, clerkUserId: string, ventureId: string) {
  const rows = await sql<VentureRow[]>`
    SELECT v.id, v.workspace_id, v.name, v.revenue_track, v.status
    FROM ventures v
    JOIN workspaces w ON w.id = v.workspace_id
    WHERE v.id = ${ventureId} AND w.clerk_user_id = ${clerkUserId}
    LIMIT 1
  `;

  return rows[0] ?? null;
}

export async function recordCreditLedgerEventForUser(input: {
  clerkUserId: string;
  event: CreditLedgerEventInput;
}) {
  const sql = getSql();
  if (!sql) {
    return null;
  }
  await ensureLedgerSchema(sql);

  const workspace = await ensureWorkspace(sql, input.clerkUserId);
  const venture = input.event.ventureId
    ? await getOwnedVenture(sql, input.clerkUserId, input.event.ventureId)
    : await getPrimaryVenture(sql, workspace.id);

  const ledgerId = `ledger_${randomUUID()}`;
  await sql`
    INSERT INTO credit_ledger (
      id,
      workspace_id,
      venture_id,
      event_kind,
      credits_delta,
      euro_cost_cents,
      provider_cost_cents,
      note,
      metadata_json,
      created_at
    )
    VALUES (
      ${ledgerId},
      ${workspace.id},
      ${venture?.id ?? null},
      ${input.event.eventKind},
      ${Math.trunc(input.event.creditsDelta)},
      ${Math.max(0, Math.trunc(input.event.euroCostCents ?? 0))},
      ${Math.max(0, Math.trunc(input.event.providerCostCents ?? 0))},
      ${input.event.note ?? null},
      ${toJson(input.event.metadata ?? {})}::jsonb,
      ${input.event.createdAt ?? new Date().toISOString()}
    )
  `;

  return {
    ledgerId,
    workspaceId: workspace.id,
    ventureId: venture?.id ?? null,
  };
}
