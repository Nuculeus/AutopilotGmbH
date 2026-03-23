import type { SqlClient } from "@/lib/db/types";

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
