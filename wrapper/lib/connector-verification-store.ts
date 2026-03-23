import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { resolveControlPlaneDatabaseUrl } from "@/lib/db/client";
import { getConnectionBindingByVentureIdAndKind, getPrimaryVentureByWorkspaceId, getWorkspaceByClerkUserId } from "@/lib/db/read-repository";
import { ensureControlPlaneSchema } from "@/lib/db/schema";
import type { SqlClient, VentureRow, WorkspaceRow } from "@/lib/db/types";
import { upsertConnectionBinding } from "@/lib/db/write-repository";
import type { AutopilotState } from "@/lib/autopilot-metadata";
import {
  buildStaleLlmConnectorVerification,
  toAutopilotLlmReadinessFromConnectorVerification,
  type ConnectorVerificationSnapshot,
} from "@/lib/connector-verification";
import type { AutopilotLlmReadinessMetadata } from "@/lib/llm-readiness";

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

async function ensureStoreSchema(sql: SqlClient) {
  if (!schemaReady) {
    schemaReady = ensureControlPlaneSchema(sql);
  }

  await schemaReady;
}

async function ensureWorkspace(input: {
  sql: SqlClient;
  clerkUserId: string;
  autopilotState?: Pick<AutopilotState, "companyId" | "companyName" | "bridgePrincipalId">;
}) {
  const existing = await getWorkspaceByClerkUserId(input.sql, input.clerkUserId);
  const nextCompanyId = input.autopilotState?.companyId ?? null;
  const nextCompanyName = input.autopilotState?.companyName ?? null;
  const nextBridgePrincipalId = input.autopilotState?.bridgePrincipalId ?? null;

  if (existing) {
    if (
      existing.company_id !== nextCompanyId ||
      existing.company_name !== nextCompanyName ||
      existing.bridge_principal_id !== nextBridgePrincipalId
    ) {
      const rows = await input.sql<WorkspaceRow[]>`
        UPDATE workspaces
        SET
          company_id = ${nextCompanyId},
          company_name = ${nextCompanyName},
          bridge_principal_id = ${nextBridgePrincipalId},
          updated_at = NOW()
        WHERE id = ${existing.id}
        RETURNING id, clerk_user_id, company_id, company_name, bridge_principal_id
      `;

      return rows[0];
    }

    return existing;
  }

  const rows = await input.sql<WorkspaceRow[]>`
    INSERT INTO workspaces (id, clerk_user_id, company_id, company_name, bridge_principal_id)
    VALUES (${`ws_${randomUUID()}`}, ${input.clerkUserId}, ${nextCompanyId}, ${nextCompanyName}, ${nextBridgePrincipalId})
    RETURNING id, clerk_user_id, company_id, company_name, bridge_principal_id
  `;

  return rows[0];
}

async function ensurePrimaryVenture(input: {
  sql: SqlClient;
  workspace: WorkspaceRow;
}) {
  const existing = await getPrimaryVentureByWorkspaceId(input.sql, input.workspace.id);
  if (existing) {
    return existing;
  }

  const rows = await input.sql<VentureRow[]>`
    INSERT INTO ventures (id, workspace_id, name, revenue_track, status)
    VALUES (${`venture_${randomUUID()}`}, ${input.workspace.id}, ${input.workspace.company_name ?? "Main Venture"}, 'service_business', 'active')
    RETURNING id, workspace_id, name, revenue_track, status
  `;

  return rows[0];
}

async function resolvePrimaryVenture(input: {
  sql: SqlClient;
  clerkUserId: string;
  autopilotState?: Pick<AutopilotState, "companyId" | "companyName" | "bridgePrincipalId">;
}) {
  const workspace = await ensureWorkspace({
    sql: input.sql,
    clerkUserId: input.clerkUserId,
    autopilotState: input.autopilotState,
  });

  const venture = await ensurePrimaryVenture({
    sql: input.sql,
    workspace,
  });

  return {
    workspace,
    venture,
  };
}

async function writeVerificationForVenture(input: {
  sql: SqlClient;
  ventureId: string;
  verification: ConnectorVerificationSnapshot;
}) {
  return upsertConnectionBinding(input.sql, {
    id: `binding_${randomUUID()}`,
    ventureId: input.ventureId,
    bindingKind: "llm_readiness",
    provider: input.verification.provider,
    externalRef: input.verification.externalRef,
    status: input.verification.status,
    metadataJson: input.verification.metadata,
  });
}

export async function persistLlmConnectorVerificationForUser(input: {
  clerkUserId: string;
  autopilotState?: Pick<AutopilotState, "companyId" | "companyName" | "bridgePrincipalId">;
  verification: ConnectorVerificationSnapshot;
}) {
  const sql = getSql();
  if (!sql) {
    return null;
  }

  await ensureStoreSchema(sql);
  const { workspace, venture } = await resolvePrimaryVenture({
    sql,
    clerkUserId: input.clerkUserId,
    autopilotState: input.autopilotState,
  });

  const bindingId = await writeVerificationForVenture({
    sql,
    ventureId: venture.id,
    verification: input.verification,
  });

  return {
    bindingId,
    workspaceId: workspace.id,
    ventureId: venture.id,
  };
}

export async function resolvePersistedLlmReadinessForUser(input: {
  clerkUserId: string;
  fallback?: AutopilotLlmReadinessMetadata | null;
}) {
  const sql = getSql();
  if (!sql) {
    return input.fallback ?? null;
  }

  await ensureStoreSchema(sql);
  const workspace = await getWorkspaceByClerkUserId(sql, input.clerkUserId);
  if (!workspace) {
    return input.fallback ?? null;
  }

  const venture = await getPrimaryVentureByWorkspaceId(sql, workspace.id);
  if (!venture) {
    return input.fallback ?? null;
  }

  const binding = await getConnectionBindingByVentureIdAndKind(sql, venture.id, "llm_readiness");
  if (!binding) {
    return input.fallback ?? null;
  }

  return toAutopilotLlmReadinessFromConnectorVerification(binding);
}

export async function markLlmConnectorVerificationStaleForUser(input: {
  clerkUserId: string;
  autopilotState?: Pick<AutopilotState, "companyId" | "companyName" | "bridgePrincipalId">;
  summary: string;
  provider?: string | null;
}) {
  const sql = getSql();
  if (!sql) {
    return null;
  }

  await ensureStoreSchema(sql);
  const { workspace, venture } = await resolvePrimaryVenture({
    sql,
    clerkUserId: input.clerkUserId,
    autopilotState: input.autopilotState,
  });

  const staleVerification = buildStaleLlmConnectorVerification({
    provider: input.provider,
    summary: input.summary,
  });

  const existingBinding = await getConnectionBindingByVentureIdAndKind(sql, venture.id, "llm_readiness");

  if (!input.provider && existingBinding) {
    staleVerification.provider = existingBinding.provider === "openai"
      || existingBinding.provider === "anthropic"
      || existingBinding.provider === "gemini"
      ? existingBinding.provider
      : "unknown";
  }

  const bindingId = await writeVerificationForVenture({
    sql,
    ventureId: venture.id,
    verification: staleVerification,
  });

  return {
    bindingId,
    workspaceId: workspace.id,
    ventureId: venture.id,
  };
}
