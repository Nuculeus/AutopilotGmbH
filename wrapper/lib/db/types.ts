import postgres from "postgres";
import type { LaunchRevenueMilestone, RevenueTrack } from "@/lib/revenue-track";
import type { RevenueEvent } from "@/lib/revenue-events";

export type SqlClient = postgres.Sql<Record<string, unknown>>;

export type WorkspaceRow = {
  id: string;
  clerk_user_id: string;
  company_id: string | null;
  company_name: string | null;
  bridge_principal_id: string | null;
};

export type VentureRow = {
  id: string;
  workspace_id: string;
  name: string;
  revenue_track: RevenueTrack;
  status: string;
};

export type VentureSpecRow = {
  venture_id: string;
  company_goal: string;
  offer: string;
  audience: string;
  tone: string;
  priorities: string;
  revenue_track: RevenueTrack;
  value_model: string;
  required_connections_json: unknown;
  next_milestone: LaunchRevenueMilestone | null;
  proof_target: string;
  budget_cap_cents: number | null;
  acquisition_channel: string;
  payment_node: string;
  delivery_node: string;
  autonomy_level: string;
  updated_at: string;
};

export type RevenueEventRow = {
  id: string;
  kind: RevenueEvent["kind"] | "first_value_created";
  source: RevenueEvent["source"];
  amount_cents: number | null;
  currency: string | null;
  external_ref: string | null;
  summary: string | null;
  created_at: string;
};

export type BillableEventRow = {
  id: string;
  workspace_id: string;
  venture_id: string | null;
  run_id: string | null;
  event_type: string;
  product_key: string;
  credits_cost: number;
  idempotency_key: string;
  approval_gate_id: string | null;
  metadata_json: unknown;
  created_at: string;
  settled_at: string | null;
};

export type CreditLedgerRow = {
  id: string;
  workspace_id: string;
  venture_id: string | null;
  event_kind: string;
  credits_delta: number;
  euro_cost_cents: number;
  provider_cost_cents: number;
  note: string | null;
  metadata_json: unknown;
  created_at: string;
};
