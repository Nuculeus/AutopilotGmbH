import { randomUUID } from "node:crypto";
import postgres from "postgres";
import type { AutopilotState } from "@/lib/autopilot-metadata";
import type { CompanyHqProfile } from "@/lib/company-hq";
import { resolveControlPlaneDatabaseUrl } from "@/lib/db/client";
import {
  getPrimaryVentureByWorkspaceId,
  getVentureSpecByVentureId,
  getWorkspaceByClerkUserId,
  listRevenueEventsByVentureId,
} from "@/lib/db/read-repository";
import { ensureControlPlaneSchema } from "@/lib/db/schema";
import type {
  RevenueEventRow,
  SqlClient,
  VentureRow,
  VentureSpecRow,
  WorkspaceRow,
} from "@/lib/db/types";
import {
  advanceMilestoneFromEvent,
  type AutopilotRevenueMetadata,
  type RevenueEvent,
} from "@/lib/revenue-events";
import {
  getRevenueTrackBlueprint,
  normalizeRevenueTrack,
  type LaunchRevenueMilestone,
  type RequiredConnectionId,
  type RevenueTrack,
} from "@/lib/revenue-track";

type QueueRunInput = {
  ventureId: string;
  kind: string;
  payload?: unknown;
  requestedBudgetCents?: number | null;
  heavyUsage?: boolean;
  allowHeavyPassThrough?: boolean;
};

type QueueRunResult =
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

type CreateExperimentInput = {
  ventureId: string;
  hypothesis: string;
  targetMetric: string;
  guardrails?: Record<string, unknown> | null;
  variants: Array<{
    label: string;
    payload: Record<string, unknown>;
    trafficWeight?: number;
  }>;
};

type ExperimentDecision = "keep" | "discard";

export type ControlPlaneSnapshot = {
  workspaceId: string;
  ventureId: string;
  profile: CompanyHqProfile;
  revenue: AutopilotRevenueMetadata;
};

export class ControlPlaneError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ControlPlaneError";
    this.status = status;
  }
}

let sqlClient: SqlClient | null = null;
let schemaReady: Promise<void> | null = null;

function getDatabaseUrl() {
  return resolveControlPlaneDatabaseUrl(process.env.DATABASE_URL);
}

function parseRequiredConnections(value: unknown): RequiredConnectionId[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is RequiredConnectionId => typeof item === "string") as RequiredConnectionId[];
  }

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed)
        ? parsed.filter((item): item is RequiredConnectionId => typeof item === "string") as RequiredConnectionId[]
        : [];
    } catch {
      return [];
    }
  }

  return [];
}

function toJson(value: unknown) {
  return JSON.stringify(value ?? {});
}

function getSql(strict: true): SqlClient;
function getSql(strict: false): SqlClient | null;
function getSql(strict = true): SqlClient | null {
  const dbUrl = getDatabaseUrl();

  if (!dbUrl) {
    if (strict) {
      throw new ControlPlaneError(503, "DATABASE_URL fehlt. Control-Plane ist nicht verfuegbar.");
    }
    return null;
  }

  if (!sqlClient) {
    sqlClient = postgres(dbUrl, {
      max: 5,
      prepare: false,
      idle_timeout: 10,
    });
  }

  return sqlClient;
}

async function ensureSchema(sql: SqlClient) {
  if (!schemaReady) {
    schemaReady = (async () => {
      await ensureControlPlaneSchema(sql);
    })();
  }

  await schemaReady;
}

async function ensureWorkspace(input: {
  sql: SqlClient;
  clerkUserId: string;
  autopilotState?: Pick<AutopilotState, "companyId" | "companyName" | "bridgePrincipalId">;
}) {
  const existing = await input.sql<WorkspaceRow[]>`
    SELECT id, clerk_user_id, company_id, company_name, bridge_principal_id
    FROM workspaces
    WHERE clerk_user_id = ${input.clerkUserId}
    LIMIT 1
  `;

  const nextCompanyId = input.autopilotState?.companyId ?? null;
  const nextCompanyName = input.autopilotState?.companyName ?? null;
  const nextBridgePrincipalId = input.autopilotState?.bridgePrincipalId ?? null;

  if (existing[0]) {
    const workspace = existing[0];

    if (
      workspace.company_id !== nextCompanyId ||
      workspace.company_name !== nextCompanyName ||
      workspace.bridge_principal_id !== nextBridgePrincipalId
    ) {
      const updated = await input.sql<WorkspaceRow[]>`
        UPDATE workspaces
        SET
          company_id = ${nextCompanyId},
          company_name = ${nextCompanyName},
          bridge_principal_id = ${nextBridgePrincipalId},
          updated_at = NOW()
        WHERE id = ${workspace.id}
        RETURNING id, clerk_user_id, company_id, company_name, bridge_principal_id
      `;
      return updated[0];
    }

    return workspace;
  }

  const inserted = await input.sql<WorkspaceRow[]>`
    INSERT INTO workspaces (id, clerk_user_id, company_id, company_name, bridge_principal_id)
    VALUES (${`ws_${randomUUID()}`}, ${input.clerkUserId}, ${nextCompanyId}, ${nextCompanyName}, ${nextBridgePrincipalId})
    RETURNING id, clerk_user_id, company_id, company_name, bridge_principal_id
  `;

  return inserted[0];
}

async function getPrimaryVenture(input: { sql: SqlClient; workspaceId: string }) {
  const rows = await input.sql<VentureRow[]>`
    SELECT id, workspace_id, name, revenue_track, status
    FROM ventures
    WHERE workspace_id = ${input.workspaceId}
    ORDER BY created_at ASC
    LIMIT 1
  `;

  return rows[0] ?? null;
}

async function ensurePrimaryVenture(input: {
  sql: SqlClient;
  workspaceId: string;
  name?: string;
  revenueTrack?: RevenueTrack;
}) {
  const existing = await getPrimaryVenture({
    sql: input.sql,
    workspaceId: input.workspaceId,
  });

  if (existing) {
    return existing;
  }

  const revenueTrack = input.revenueTrack ?? "service_business";
  const inserted = await input.sql<VentureRow[]>`
    INSERT INTO ventures (id, workspace_id, name, revenue_track, status)
    VALUES (${`venture_${randomUUID()}`}, ${input.workspaceId}, ${input.name ?? "Main Venture"}, ${revenueTrack}, 'active')
    RETURNING id, workspace_id, name, revenue_track, status
  `;

  return inserted[0];
}

async function getOwnedVenture(input: {
  sql: SqlClient;
  clerkUserId: string;
  ventureId: string;
}) {
  const rows = await input.sql<Array<VentureRow & { clerk_user_id: string }>>`
    SELECT v.id, v.workspace_id, v.name, v.revenue_track, v.status, w.clerk_user_id
    FROM ventures v
    JOIN workspaces w ON w.id = v.workspace_id
    WHERE v.id = ${input.ventureId} AND w.clerk_user_id = ${input.clerkUserId}
    LIMIT 1
  `;

  return rows[0] ?? null;
}

async function upsertVentureSpec(input: {
  sql: SqlClient;
  ventureId: string;
  revenueTrack: RevenueTrack;
  profile: CompanyHqProfile;
}) {
  const blueprint = getRevenueTrackBlueprint(input.revenueTrack);
  const requiredConnections =
    input.profile.requiredConnections.length > 0
      ? input.profile.requiredConnections
      : blueprint.requiredConnections;

  const result = await input.sql<VentureSpecRow[]>`
    INSERT INTO venture_specs (
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
      updated_at
    )
    VALUES (
      ${input.ventureId},
      ${input.profile.companyGoal},
      ${input.profile.offer},
      ${input.profile.audience},
      ${input.profile.tone},
      ${input.profile.priorities},
      ${input.revenueTrack},
      ${input.profile.valueModel || blueprint.valueModel},
      ${JSON.stringify(requiredConnections)}::jsonb,
      ${input.profile.nextMilestone},
      ${input.profile.proofTarget || ""},
      ${input.profile.budgetCapCents},
      ${input.profile.acquisitionChannel || ""},
      ${input.profile.paymentNode || ""},
      ${input.profile.deliveryNode || ""},
      ${input.profile.autonomyLevel || "guided"},
      NOW()
    )
    ON CONFLICT (venture_id)
    DO UPDATE SET
      company_goal = EXCLUDED.company_goal,
      offer = EXCLUDED.offer,
      audience = EXCLUDED.audience,
      tone = EXCLUDED.tone,
      priorities = EXCLUDED.priorities,
      revenue_track = EXCLUDED.revenue_track,
      value_model = EXCLUDED.value_model,
      required_connections_json = EXCLUDED.required_connections_json,
      next_milestone = EXCLUDED.next_milestone,
      proof_target = EXCLUDED.proof_target,
      budget_cap_cents = EXCLUDED.budget_cap_cents,
      acquisition_channel = EXCLUDED.acquisition_channel,
      payment_node = EXCLUDED.payment_node,
      delivery_node = EXCLUDED.delivery_node,
      autonomy_level = EXCLUDED.autonomy_level,
      updated_at = NOW()
    RETURNING
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
  `;

  return result[0];
}

function toCompanyProfile(row: VentureSpecRow): CompanyHqProfile {
  return {
    companyGoal: row.company_goal,
    offer: row.offer,
    audience: row.audience,
    tone: row.tone,
    priorities: row.priorities,
    revenueTrack: row.revenue_track,
    valueModel: row.value_model,
    requiredConnections: parseRequiredConnections(row.required_connections_json),
    nextMilestone: row.next_milestone,
    ventureId: row.venture_id,
    proofTarget: row.proof_target ?? "",
    budgetCapCents: row.budget_cap_cents ?? null,
    acquisitionChannel: row.acquisition_channel ?? "",
    paymentNode: row.payment_node ?? "",
    deliveryNode: row.delivery_node ?? "",
    autonomyLevel:
      row.autonomy_level === "semi_auto" || row.autonomy_level === "auto"
        ? row.autonomy_level
        : "guided",
    updatedAt: row.updated_at ?? null,
  };
}

function mapRevenueKind(kind: string): RevenueEvent["kind"] | null {
  if (
    kind === "offer_live" ||
    kind === "checkout_live" ||
    kind === "revenue_recorded" ||
    kind === "payment_failed"
  ) {
    return kind;
  }
  return null;
}

function mapRevenueSource(source: string): RevenueEvent["source"] {
  if (source === "workspace" || source === "stripe") return source;
  return "system";
}

function toRevenueMetadata(rows: RevenueEventRow[]): AutopilotRevenueMetadata {
  const mappedEvents = rows
    .map((row) => ({
      kind: mapRevenueKind(row.kind),
      createdAt: row.created_at,
      source: mapRevenueSource(row.source),
      amountCents: row.amount_cents,
      currency: row.currency,
      externalRef: row.external_ref,
    }))
    .filter((row): row is RevenueEvent => row.kind !== null);

  const firstValue = rows.find((row) => row.kind === "first_value_created");

  const latest = mappedEvents[mappedEvents.length - 1];
  const payoutStatus =
    latest?.kind === "revenue_recorded"
      ? {
          status: "paid" as const,
          lastUpdatedAt: latest.createdAt,
          lastPayoutAt: latest.createdAt,
          note: "control_plane_revenue_recorded",
        }
      : {
          status: "not_ready" as const,
          lastUpdatedAt: rows[rows.length - 1]?.created_at ?? null,
          lastPayoutAt: null,
          note: null,
        };

  return {
    firstValueEvent: firstValue
      ? {
          createdAt: firstValue.created_at,
          source: firstValue.source === "workspace" ? "workspace" : "system",
          summary: firstValue.summary,
          revenueTrack: null,
        }
      : null,
    revenueEvents: mappedEvents,
    processedStripeEventIds: [],
    payoutStatus,
    updatedAt: rows[rows.length - 1]?.created_at ?? null,
  };
}

export async function upsertCompanyHqForUser(input: {
  clerkUserId: string;
  profile: CompanyHqProfile;
  autopilotState?: Pick<AutopilotState, "companyId" | "companyName" | "bridgePrincipalId">;
}) {
  const sql = getSql(false);
  if (!sql) return null;

  await ensureSchema(sql);
  const workspace = await ensureWorkspace({
    sql,
    clerkUserId: input.clerkUserId,
    autopilotState: input.autopilotState,
  });

  const track = normalizeRevenueTrack(input.profile.revenueTrack) ?? "service_business";
  const venture =
    input.profile.ventureId
      ? await getOwnedVenture({
          sql,
          clerkUserId: input.clerkUserId,
          ventureId: input.profile.ventureId,
        })
      : null;

  const targetVenture =
    venture ??
    (await ensurePrimaryVenture({
      sql,
      workspaceId: workspace.id,
      name: input.autopilotState?.companyName ?? "Main Venture",
      revenueTrack: track,
    }));

  await sql`
    UPDATE ventures
    SET revenue_track = ${track}, updated_at = NOW()
    WHERE id = ${targetVenture.id}
  `;

  const spec = await upsertVentureSpec({
    sql,
    ventureId: targetVenture.id,
    revenueTrack: track,
    profile: {
      ...input.profile,
      ventureId: targetVenture.id,
    },
  });

  return {
    workspaceId: workspace.id,
    ventureId: targetVenture.id,
    profile: toCompanyProfile(spec),
  };
}

export async function createVentureForUser(input: {
  clerkUserId: string;
  name: string;
  revenueTrack: RevenueTrack;
}) {
  const sql = getSql(true);
  await ensureSchema(sql);

  const workspace = await ensureWorkspace({
    sql,
    clerkUserId: input.clerkUserId,
  });

  const track = normalizeRevenueTrack(input.revenueTrack) ?? "service_business";
  const ventureId = `venture_${randomUUID()}`;
  const ventureRows = await sql<VentureRow[]>`
    INSERT INTO ventures (id, workspace_id, name, revenue_track, status)
    VALUES (${ventureId}, ${workspace.id}, ${input.name.trim() || "Neues Venture"}, ${track}, 'active')
    RETURNING id, workspace_id, name, revenue_track, status
  `;
  const venture = ventureRows[0];
  const blueprint = getRevenueTrackBlueprint(track);

  await upsertVentureSpec({
    sql,
    ventureId: venture.id,
    revenueTrack: track,
    profile: {
      companyGoal: "",
      offer: "",
      audience: "",
      tone: "",
      priorities: "",
      revenueTrack: track,
      valueModel: blueprint.valueModel,
      requiredConnections: blueprint.requiredConnections,
      nextMilestone: "briefing_ready",
      ventureId: venture.id,
      proofTarget: "",
      budgetCapCents: null,
      acquisitionChannel: "",
      paymentNode: "",
      deliveryNode: "",
      autonomyLevel: "guided",
      updatedAt: new Date().toISOString(),
    },
  });

  return {
    id: venture.id,
    workspaceId: venture.workspace_id,
    name: venture.name,
    revenueTrack: venture.revenue_track,
    status: venture.status,
  };
}

export async function patchVentureSpecForUser(input: {
  clerkUserId: string;
  ventureId: string;
  patch: Partial<CompanyHqProfile>;
}) {
  const sql = getSql(true);
  await ensureSchema(sql);

  const venture = await getOwnedVenture({
    sql,
    clerkUserId: input.clerkUserId,
    ventureId: input.ventureId,
  });

  if (!venture) {
    throw new ControlPlaneError(404, "Venture nicht gefunden.");
  }

  const currentRows = await sql<VentureSpecRow[]>`
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
    WHERE venture_id = ${venture.id}
    LIMIT 1
  `;

  const current = currentRows[0]
    ? toCompanyProfile(currentRows[0])
    : ({
        companyGoal: "",
        offer: "",
        audience: "",
        tone: "",
        priorities: "",
        revenueTrack: venture.revenue_track,
        valueModel: "",
        requiredConnections: [],
        nextMilestone: "briefing_ready",
        ventureId: venture.id,
        proofTarget: "",
        budgetCapCents: null,
        acquisitionChannel: "",
        paymentNode: "",
        deliveryNode: "",
        autonomyLevel: "guided",
        updatedAt: null,
      } as CompanyHqProfile);

  const next: CompanyHqProfile = {
    ...current,
    ...input.patch,
    ventureId: venture.id,
    updatedAt: new Date().toISOString(),
  };

  const track = normalizeRevenueTrack(next.revenueTrack) ?? venture.revenue_track;
  await sql`
    UPDATE ventures
    SET revenue_track = ${track}, updated_at = NOW()
    WHERE id = ${venture.id}
  `;

  const spec = await upsertVentureSpec({
    sql,
    ventureId: venture.id,
    revenueTrack: track,
    profile: next,
  });

  return toCompanyProfile(spec);
}

async function createApprovalGate(input: {
  sql: SqlClient;
  ventureId: string;
  gateType: string;
  reason: string;
  payload: Record<string, unknown>;
}) {
  const gateId = `gate_${randomUUID()}`;
  await input.sql`
    INSERT INTO approval_gates (id, venture_id, gate_type, status, reason, payload_json)
    VALUES (${gateId}, ${input.ventureId}, ${input.gateType}, 'pending', ${input.reason}, ${toJson(input.payload)}::jsonb)
  `;
  return gateId;
}

export async function queueRunForUser(input: {
  clerkUserId: string;
  input: QueueRunInput;
}): Promise<QueueRunResult> {
  const sql = getSql(true);
  await ensureSchema(sql);

  const venture = await getOwnedVenture({
    sql,
    clerkUserId: input.clerkUserId,
    ventureId: input.input.ventureId,
  });

  if (!venture) {
    throw new ControlPlaneError(404, "Venture nicht gefunden.");
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

    return {
      status: "blocked",
      reason: "heavy_usage_pass_through_required",
      approvalGateId: gateId,
    };
  }

  const specRows = await sql<Array<{ budget_cap_cents: number | null }>>`
    SELECT budget_cap_cents
    FROM venture_specs
    WHERE venture_id = ${venture.id}
    LIMIT 1
  `;
  const budgetCap = specRows[0]?.budget_cap_cents ?? null;
  const requestedBudget = Math.max(0, input.input.requestedBudgetCents ?? 0);

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

      return {
        status: "blocked",
        reason: "budget_cap_exceeded",
        approvalGateId: gateId,
      };
    }
  }

  const runId = `run_${randomUUID()}`;

  await sql`
    INSERT INTO run_executions (
      id,
      venture_id,
      run_kind,
      status,
      input_json,
      requested_budget_cents,
      updated_at
    )
    VALUES (
      ${runId},
      ${venture.id},
      ${input.input.kind},
      'queued',
      ${toJson(input.input.payload ?? {})}::jsonb,
      ${requestedBudget},
      NOW()
    )
  `;

  return {
    status: "queued",
    run: {
      id: runId,
      ventureId: venture.id,
      status: "queued",
    },
  };
}

export async function createExperimentForUser(input: {
  clerkUserId: string;
  input: CreateExperimentInput;
}) {
  const sql = getSql(true);
  await ensureSchema(sql);

  const venture = await getOwnedVenture({
    sql,
    clerkUserId: input.clerkUserId,
    ventureId: input.input.ventureId,
  });

  if (!venture) {
    throw new ControlPlaneError(404, "Venture nicht gefunden.");
  }

  const experimentId = `exp_${randomUUID()}`;
  const experimentRows = await sql<
    Array<{ id: string; venture_id: string; status: string; target_metric: string; hypothesis: string }>
  >`
    INSERT INTO experiments (id, venture_id, hypothesis, target_metric, guardrails_json, status, updated_at)
    VALUES (
      ${experimentId},
      ${venture.id},
      ${input.input.hypothesis.trim()},
      ${input.input.targetMetric.trim()},
      ${toJson(input.input.guardrails ?? {})}::jsonb,
      'draft',
      NOW()
    )
    RETURNING id, venture_id, status, target_metric, hypothesis
  `;

  const variants = [];
  for (const variant of input.input.variants) {
    const variantId = `var_${randomUUID()}`;
    const rows = await sql<Array<{ id: string; label: string; traffic_weight: number }>>`
      INSERT INTO experiment_variants (
        id,
        experiment_id,
        label,
        payload_json,
        traffic_weight,
        status,
        updated_at
      )
      VALUES (
        ${variantId},
        ${experimentId},
        ${variant.label.trim()},
        ${toJson(variant.payload ?? {})}::jsonb,
        ${Math.max(1, variant.trafficWeight ?? 100)},
        'active',
        NOW()
      )
      RETURNING id, label, traffic_weight
    `;
    variants.push({
      id: rows[0].id,
      label: rows[0].label,
      trafficWeight: rows[0].traffic_weight,
    });
  }

  return {
    experiment: {
      id: experimentRows[0].id,
      ventureId: experimentRows[0].venture_id,
      status: experimentRows[0].status,
      targetMetric: experimentRows[0].target_metric,
      hypothesis: experimentRows[0].hypothesis,
    },
    variants,
  };
}

export async function decideExperimentForUser(input: {
  clerkUserId: string;
  experimentId: string;
  decision: ExperimentDecision;
  reason: string | null;
}) {
  const sql = getSql(true);
  await ensureSchema(sql);

  const rows = await sql<Array<{ id: string; venture_id: string }>>`
    SELECT e.id, e.venture_id
    FROM experiments e
    JOIN ventures v ON v.id = e.venture_id
    JOIN workspaces w ON w.id = v.workspace_id
    WHERE e.id = ${input.experimentId} AND w.clerk_user_id = ${input.clerkUserId}
    LIMIT 1
  `;

  if (!rows[0]) {
    throw new ControlPlaneError(404, "Experiment nicht gefunden.");
  }

  const updated = await sql<
    Array<{ id: string; status: string; decision: string | null; decision_reason: string | null }>
  >`
    UPDATE experiments
    SET
      status = 'decided',
      decision = ${input.decision},
      decision_reason = ${input.reason},
      updated_at = NOW()
    WHERE id = ${input.experimentId}
    RETURNING id, status, decision, decision_reason
  `;

  return {
    experimentId: updated[0].id,
    status: updated[0].status,
    decision: (updated[0].decision ?? input.decision) as ExperimentDecision,
    reason: updated[0].decision_reason,
  };
}

export async function recordRevenueEventForUser(input: {
  clerkUserId: string;
  event: {
    ventureId?: string | null;
    kind:
      | "first_value_created"
      | "offer_live"
      | "checkout_live"
      | "revenue_recorded"
      | "payment_failed";
    source: RevenueEvent["source"];
    attribution?: string | null;
    runId?: string | null;
    amountCents?: number | null;
    currency?: string | null;
    externalRef?: string | null;
    summary?: string | null;
    createdAt?: string;
    metadata?: Record<string, unknown>;
  };
}) {
  const sql = getSql(false);
  if (!sql) return null;
  await ensureSchema(sql);

  const workspace = await ensureWorkspace({
    sql,
    clerkUserId: input.clerkUserId,
  });

  const venture =
    input.event.ventureId
      ? await getOwnedVenture({
          sql,
          clerkUserId: input.clerkUserId,
          ventureId: input.event.ventureId,
        })
      : await getPrimaryVenture({
          sql,
          workspaceId: workspace.id,
        });

  if (!venture) {
    return null;
  }

  const eventId = `rev_${randomUUID()}`;
  const createdAt = input.event.createdAt ?? new Date().toISOString();
  await sql`
    INSERT INTO revenue_events (
      id,
      workspace_id,
      venture_id,
      kind,
      source,
      attribution,
      run_id,
      amount_cents,
      currency,
      external_ref,
      summary,
      metadata_json,
      created_at
    )
    VALUES (
      ${eventId},
      ${workspace.id},
      ${venture.id},
      ${input.event.kind},
      ${input.event.source},
      ${input.event.attribution ?? null},
      ${input.event.runId ?? null},
      ${input.event.amountCents ?? null},
      ${input.event.currency ?? null},
      ${input.event.externalRef ?? null},
      ${input.event.summary ?? null},
      ${toJson(input.event.metadata ?? {})}::jsonb,
      ${createdAt}
    )
  `;

  const specRows = await sql<Array<{ next_milestone: LaunchRevenueMilestone | null }>>`
    SELECT next_milestone
    FROM venture_specs
    WHERE venture_id = ${venture.id}
    LIMIT 1
  `;
  const currentMilestone = specRows[0]?.next_milestone ?? "briefing_ready";

  const milestoneKind =
    input.event.kind === "first_value_created"
      ? "first_value_created"
      : input.event.kind === "offer_live"
        ? "offer_live"
        : input.event.kind === "checkout_live"
          ? "checkout_live"
          : input.event.kind === "revenue_recorded"
            ? "revenue_recorded"
            : "payment_failed";

  const nextMilestone = advanceMilestoneFromEvent({
    current: currentMilestone,
    kind: milestoneKind,
  });

  await sql`
    UPDATE venture_specs
    SET next_milestone = ${nextMilestone}, updated_at = NOW()
    WHERE venture_id = ${venture.id}
  `;

  return {
    eventId,
    ventureId: venture.id,
    nextMilestone,
  };
}

export async function syncLegacyUserState(input: {
  clerkUserId: string;
  autopilotState: Pick<AutopilotState, "companyId" | "companyName" | "bridgePrincipalId">;
  profile: CompanyHqProfile;
  revenue: AutopilotRevenueMetadata;
}) {
  const upserted = await upsertCompanyHqForUser({
    clerkUserId: input.clerkUserId,
    profile: input.profile,
    autopilotState: input.autopilotState,
  });
  if (!upserted) {
    return null;
  }

  const sql = getSql(false);
  if (!sql) {
    return upserted;
  }
  await ensureSchema(sql);

  const existing = await sql<Array<{ count: number }>>`
    SELECT COUNT(*)::int AS count
    FROM revenue_events
    WHERE venture_id = ${upserted.ventureId}
  `;

  if ((existing[0]?.count ?? 0) === 0) {
    const now = new Date().toISOString();

    if (input.revenue.firstValueEvent) {
      await recordRevenueEventForUser({
        clerkUserId: input.clerkUserId,
        event: {
          ventureId: upserted.ventureId,
          kind: "first_value_created",
          source: input.revenue.firstValueEvent.source,
          summary: input.revenue.firstValueEvent.summary,
          createdAt: input.revenue.firstValueEvent.createdAt || now,
          metadata: { migrated: true },
        },
      });
    }

    for (const event of input.revenue.revenueEvents) {
      await recordRevenueEventForUser({
        clerkUserId: input.clerkUserId,
        event: {
          ventureId: upserted.ventureId,
          kind: event.kind,
          source: event.source,
          amountCents: event.amountCents,
          currency: event.currency,
          externalRef: event.externalRef,
          createdAt: event.createdAt,
          metadata: { migrated: true },
        },
      });
    }
  }

  return upserted;
}

export async function getPrimaryControlPlaneSnapshotForUser(input: {
  clerkUserId: string;
}): Promise<ControlPlaneSnapshot | null> {
  const sql = getSql(false);
  if (!sql) {
    return null;
  }
  await ensureSchema(sql);

  const workspace = await getWorkspaceByClerkUserId(sql, input.clerkUserId);
  if (!workspace) {
    return null;
  }

  const venture = await getPrimaryVentureByWorkspaceId(sql, workspace.id);
  if (!venture) {
    return null;
  }

  const spec = await getVentureSpecByVentureId(sql, venture.id);
  if (!spec) {
    return null;
  }

  const revenueRows = await listRevenueEventsByVentureId(sql, venture.id);

  return {
    workspaceId: workspace.id,
    ventureId: venture.id,
    profile: toCompanyProfile(spec),
    revenue: toRevenueMetadata(revenueRows),
  };
}
