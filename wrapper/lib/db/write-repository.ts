import type { SqlClient } from "@/lib/db/types";

type InsertBillableEventInput = {
  id: string;
  workspaceId: string;
  ventureId: string | null;
  runId: string | null;
  eventType: string;
  productKey: string;
  creditsCost: number;
  idempotencyKey: string;
  approvalGateId: string | null;
  metadataJson: unknown;
  createdAt: string;
  settledAt: string | null;
};

type UpsertConnectionBindingInput = {
  id: string;
  ventureId: string;
  bindingKind: string;
  provider: string;
  externalRef: string | null;
  status: string;
  metadataJson: unknown;
};

type InsertCreditLedgerEntryInput = {
  id: string;
  workspaceId: string;
  ventureId: string | null;
  eventKind: string;
  creditsDelta: number;
  euroCostCents: number;
  providerCostCents: number;
  note: string | null;
  metadataJson: unknown;
  createdAt: string;
};

type InsertUsageEventInput = {
  id: string;
  workspaceId: string;
  ventureId: string | null;
  runId: string | null;
  provider: string;
  category: string;
  unitCount: number;
  estimatedCostCents: number;
  finalCostCents: number;
  metadataJson: unknown;
  createdAt: string;
};

function toJson(value: unknown) {
  return JSON.stringify(value ?? {});
}

export async function upsertConnectionBinding(sql: SqlClient, input: UpsertConnectionBindingInput) {
  const rows = await sql<Array<{ id: string }>>`
    INSERT INTO connection_bindings (
      id,
      venture_id,
      binding_kind,
      provider,
      external_ref,
      status,
      metadata_json
    )
    VALUES (
      ${input.id},
      ${input.ventureId},
      ${input.bindingKind},
      ${input.provider},
      ${input.externalRef},
      ${input.status},
      ${toJson(input.metadataJson)}
    )
    ON CONFLICT (venture_id, binding_kind, provider) DO UPDATE
    SET
      external_ref = EXCLUDED.external_ref,
      status = EXCLUDED.status,
      metadata_json = EXCLUDED.metadata_json,
      updated_at = NOW()
    RETURNING id
  `;

  return rows[0]?.id ?? null;
}

export async function insertBillableEvent(sql: SqlClient, input: InsertBillableEventInput) {
  const rows = await sql<Array<{ id: string }>>`
    INSERT INTO billable_events (
      id,
      workspace_id,
      venture_id,
      run_id,
      event_type,
      product_key,
      credits_cost,
      idempotency_key,
      approval_gate_id,
      metadata_json,
      created_at,
      settled_at
    )
    VALUES (
      ${input.id},
      ${input.workspaceId},
      ${input.ventureId},
      ${input.runId},
      ${input.eventType},
      ${input.productKey},
      ${input.creditsCost},
      ${input.idempotencyKey},
      ${input.approvalGateId},
      ${toJson(input.metadataJson)},
      ${input.createdAt},
      ${input.settledAt}
    )
    ON CONFLICT (idempotency_key) DO NOTHING
    RETURNING id
  `;

  return rows[0]?.id ?? null;
}

export async function insertCreditLedgerEntry(sql: SqlClient, input: InsertCreditLedgerEntryInput) {
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
      ${input.id},
      ${input.workspaceId},
      ${input.ventureId},
      ${input.eventKind},
      ${input.creditsDelta},
      ${input.euroCostCents},
      ${input.providerCostCents},
      ${input.note},
      ${toJson(input.metadataJson)},
      ${input.createdAt}
    )
  `;
}

export async function insertUsageEvent(sql: SqlClient, input: InsertUsageEventInput) {
  await sql`
    INSERT INTO usage_events (
      id,
      workspace_id,
      venture_id,
      run_id,
      provider,
      category,
      unit_count,
      estimated_cost_cents,
      final_cost_cents,
      metadata_json,
      created_at
    )
    VALUES (
      ${input.id},
      ${input.workspaceId},
      ${input.ventureId},
      ${input.runId},
      ${input.provider},
      ${input.category},
      ${input.unitCount},
      ${input.estimatedCostCents},
      ${input.finalCostCents},
      ${toJson(input.metadataJson)},
      ${input.createdAt}
    )
  `;
}
