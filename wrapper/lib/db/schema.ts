import postgres from "postgres";

type SqlClient = postgres.Sql<Record<string, unknown>>;

export const CONTROL_PLANE_FOUNDATION_TABLES = [
  "workspaces",
  "ventures",
  "venture_specs",
  "connection_bindings",
  "run_executions",
  "experiments",
  "experiment_variants",
  "metric_events",
  "revenue_events",
  "credit_ledger",
  "approval_gates",
] as const;

export const CONTROL_PLANE_SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS workspaces (
    id TEXT PRIMARY KEY,
    clerk_user_id TEXT NOT NULL UNIQUE,
    company_id TEXT NULL,
    company_name TEXT NULL,
    bridge_principal_id TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS ventures (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    revenue_track TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE INDEX IF NOT EXISTS ventures_workspace_idx ON ventures(workspace_id);

  CREATE TABLE IF NOT EXISTS venture_specs (
    venture_id TEXT PRIMARY KEY REFERENCES ventures(id) ON DELETE CASCADE,
    company_goal TEXT NOT NULL DEFAULT '',
    offer TEXT NOT NULL DEFAULT '',
    audience TEXT NOT NULL DEFAULT '',
    tone TEXT NOT NULL DEFAULT '',
    priorities TEXT NOT NULL DEFAULT '',
    revenue_track TEXT NOT NULL,
    value_model TEXT NOT NULL DEFAULT '',
    required_connections_json JSONB NOT NULL DEFAULT '[]'::jsonb,
    next_milestone TEXT NULL,
    proof_target TEXT NOT NULL DEFAULT '',
    budget_cap_cents INTEGER NULL,
    acquisition_channel TEXT NOT NULL DEFAULT '',
    payment_node TEXT NOT NULL DEFAULT '',
    delivery_node TEXT NOT NULL DEFAULT '',
    autonomy_level TEXT NOT NULL DEFAULT 'guided',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS connection_bindings (
    id TEXT PRIMARY KEY,
    venture_id TEXT NOT NULL REFERENCES ventures(id) ON DELETE CASCADE,
    binding_kind TEXT NOT NULL,
    provider TEXT NOT NULL,
    external_ref TEXT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE INDEX IF NOT EXISTS connection_bindings_venture_idx ON connection_bindings(venture_id);

  CREATE TABLE IF NOT EXISTS run_executions (
    id TEXT PRIMARY KEY,
    venture_id TEXT NOT NULL REFERENCES ventures(id) ON DELETE CASCADE,
    run_kind TEXT NOT NULL,
    status TEXT NOT NULL,
    input_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    output_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    attempt INTEGER NOT NULL DEFAULT 1,
    requested_budget_cents INTEGER NOT NULL DEFAULT 0,
    spent_cents INTEGER NOT NULL DEFAULT 0,
    error_message TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    started_at TIMESTAMPTZ NULL,
    finished_at TIMESTAMPTZ NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE INDEX IF NOT EXISTS run_executions_venture_idx ON run_executions(venture_id, created_at DESC);

  CREATE TABLE IF NOT EXISTS experiments (
    id TEXT PRIMARY KEY,
    venture_id TEXT NOT NULL REFERENCES ventures(id) ON DELETE CASCADE,
    hypothesis TEXT NOT NULL,
    target_metric TEXT NOT NULL,
    guardrails_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    status TEXT NOT NULL DEFAULT 'draft',
    decision TEXT NULL,
    decision_reason TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE INDEX IF NOT EXISTS experiments_venture_idx ON experiments(venture_id, created_at DESC);

  CREATE TABLE IF NOT EXISTS experiment_variants (
    id TEXT PRIMARY KEY,
    experiment_id TEXT NOT NULL REFERENCES experiments(id) ON DELETE CASCADE,
    label TEXT NOT NULL,
    payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    traffic_weight INTEGER NOT NULL DEFAULT 100,
    status TEXT NOT NULL DEFAULT 'active',
    result_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE INDEX IF NOT EXISTS experiment_variants_experiment_idx ON experiment_variants(experiment_id);

  CREATE TABLE IF NOT EXISTS metric_events (
    id TEXT PRIMARY KEY,
    venture_id TEXT NOT NULL REFERENCES ventures(id) ON DELETE CASCADE,
    experiment_id TEXT NULL REFERENCES experiments(id) ON DELETE SET NULL,
    variant_id TEXT NULL REFERENCES experiment_variants(id) ON DELETE SET NULL,
    metric_key TEXT NOT NULL,
    metric_value DOUBLE PRECISION NOT NULL,
    currency TEXT NULL,
    context_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE INDEX IF NOT EXISTS metric_events_venture_idx ON metric_events(venture_id, occurred_at DESC);

  CREATE TABLE IF NOT EXISTS revenue_events (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    venture_id TEXT NOT NULL REFERENCES ventures(id) ON DELETE CASCADE,
    kind TEXT NOT NULL,
    source TEXT NOT NULL,
    attribution TEXT NULL,
    run_id TEXT NULL REFERENCES run_executions(id) ON DELETE SET NULL,
    amount_cents INTEGER NULL,
    currency TEXT NULL,
    external_ref TEXT NULL,
    summary TEXT NULL,
    metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE INDEX IF NOT EXISTS revenue_events_venture_idx ON revenue_events(venture_id, created_at DESC);

  CREATE TABLE IF NOT EXISTS credit_ledger (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    venture_id TEXT NULL REFERENCES ventures(id) ON DELETE SET NULL,
    event_kind TEXT NOT NULL,
    credits_delta INTEGER NOT NULL DEFAULT 0,
    euro_cost_cents INTEGER NOT NULL DEFAULT 0,
    provider_cost_cents INTEGER NOT NULL DEFAULT 0,
    note TEXT NULL,
    metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE INDEX IF NOT EXISTS credit_ledger_workspace_idx ON credit_ledger(workspace_id, created_at DESC);
  CREATE INDEX IF NOT EXISTS credit_ledger_venture_idx ON credit_ledger(venture_id, created_at DESC);

  CREATE TABLE IF NOT EXISTS approval_gates (
    id TEXT PRIMARY KEY,
    venture_id TEXT NOT NULL REFERENCES ventures(id) ON DELETE CASCADE,
    gate_type TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    reason TEXT NOT NULL,
    payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    decided_by TEXT NULL,
    decided_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE INDEX IF NOT EXISTS approval_gates_venture_idx ON approval_gates(venture_id, status, created_at DESC);
`;

export async function ensureControlPlaneSchema(sql: SqlClient) {
  await sql.unsafe(CONTROL_PLANE_SCHEMA_SQL);
}
