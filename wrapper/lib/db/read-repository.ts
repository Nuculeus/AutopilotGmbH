import type {
  CreditLedgerRow,
  RevenueEventRow,
  SqlClient,
  VentureRow,
  VentureSpecRow,
  WorkspaceRow,
} from "@/lib/db/types";

export async function getWorkspaceByClerkUserId(sql: SqlClient, clerkUserId: string) {
  const rows = await sql<WorkspaceRow[]>`
    SELECT id, clerk_user_id, company_id, company_name, bridge_principal_id
    FROM workspaces
    WHERE clerk_user_id = ${clerkUserId}
    LIMIT 1
  `;

  return rows[0] ?? null;
}

export async function getPrimaryVentureByWorkspaceId(sql: SqlClient, workspaceId: string) {
  const rows = await sql<VentureRow[]>`
    SELECT id, workspace_id, name, revenue_track, status
    FROM ventures
    WHERE workspace_id = ${workspaceId}
    ORDER BY created_at ASC
    LIMIT 1
  `;

  return rows[0] ?? null;
}

export async function getVentureSpecByVentureId(sql: SqlClient, ventureId: string) {
  const rows = await sql<VentureSpecRow[]>`
    SELECT
      venture_id,
      company_goal,
      offer,
      audience,
      tone,
      priorities,
      revenue_track,
      value_model,
      required_connections_json,
      next_milestone,
      proof_target,
      budget_cap_cents,
      acquisition_channel,
      payment_node,
      delivery_node,
      autonomy_level,
      updated_at::text
    FROM venture_specs
    WHERE venture_id = ${ventureId}
    LIMIT 1
  `;

  return rows[0] ?? null;
}

export async function listRevenueEventsByVentureId(
  sql: SqlClient,
  ventureId: string,
  limit = 300,
) {
  return sql<RevenueEventRow[]>`
    SELECT id, kind, source, amount_cents, currency, external_ref, summary, created_at::text
    FROM revenue_events
    WHERE venture_id = ${ventureId}
    ORDER BY created_at ASC
    LIMIT ${limit}
  `;
}

export async function listCreditLedgerEntriesByWorkspaceId(
  sql: SqlClient,
  workspaceId: string,
  limit = 500,
) {
  return sql<CreditLedgerRow[]>`
    SELECT
      id,
      workspace_id,
      venture_id,
      event_kind,
      credits_delta,
      euro_cost_cents,
      provider_cost_cents,
      note,
      metadata_json,
      created_at::text
    FROM credit_ledger
    WHERE workspace_id = ${workspaceId}
    ORDER BY created_at ASC
    LIMIT ${limit}
  `;
}
