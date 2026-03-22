import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { resolveControlPlaneDatabaseUrl } from "@/lib/db/client";
import { ensureControlPlaneSchema } from "@/lib/db/schema";
import type { SqlClient } from "@/lib/db/types";

export type ProvisioningRunStatus =
  | "pending"
  | "running"
  | "succeeded"
  | "failed"
  | "canceled";

export type ProvisioningRunRecord = {
  id: string;
  clerkUserId: string;
  requestKey: string;
  companyName: string;
  idea: string | null;
  status: ProvisioningRunStatus;
  paperclipCompanyId: string | null;
  bridgePrincipalId: string | null;
  lastError: string | null;
  retryEligible: boolean;
};

type ProvisioningRunRow = {
  id: string;
  clerk_user_id: string;
  request_key: string;
  company_name: string;
  idea: string | null;
  status: ProvisioningRunStatus;
  paperclip_company_id: string | null;
  bridge_principal_id: string | null;
  last_error: string | null;
  retry_eligible: boolean;
};

type ProvisioningClaimResult =
  | { action: "start"; record: ProvisioningRunRecord }
  | { action: "pending"; record: ProvisioningRunRecord }
  | { action: "existing"; record: ProvisioningRunRecord };

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

async function ensureProvisioningSchema(sql: SqlClient) {
  if (!schemaReady) {
    schemaReady = (async () => {
      await ensureControlPlaneSchema(sql);
      await sql.unsafe(`
        CREATE TABLE IF NOT EXISTS provisioning_runs (
          id TEXT PRIMARY KEY,
          clerk_user_id TEXT NOT NULL,
          request_key TEXT NOT NULL UNIQUE,
          company_name TEXT NOT NULL,
          idea TEXT NULL,
          status TEXT NOT NULL,
          paperclip_company_id TEXT NULL,
          bridge_principal_id TEXT NULL,
          last_error TEXT NULL,
          retry_eligible BOOLEAN NOT NULL DEFAULT TRUE,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          started_at TIMESTAMPTZ NULL,
          finished_at TIMESTAMPTZ NULL,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE INDEX IF NOT EXISTS provisioning_runs_clerk_user_idx
        ON provisioning_runs(clerk_user_id, created_at DESC);
      `);
    })();
  }

  await schemaReady;
}

function toProvisioningRunRecord(row: ProvisioningRunRow): ProvisioningRunRecord {
  return {
    id: row.id,
    clerkUserId: row.clerk_user_id,
    requestKey: row.request_key,
    companyName: row.company_name,
    idea: row.idea,
    status: row.status,
    paperclipCompanyId: row.paperclip_company_id,
    bridgePrincipalId: row.bridge_principal_id,
    lastError: row.last_error,
    retryEligible: row.retry_eligible,
  };
}

export function buildProvisioningRequestKey(clerkUserId: string) {
  return `provision:${clerkUserId}`;
}

export async function getProvisioningRunForUser(input: { clerkUserId: string }) {
  const sql = getSql();
  if (!sql) return null;
  await ensureProvisioningSchema(sql);

  const rows = await sql<ProvisioningRunRow[]>`
    SELECT
      id,
      clerk_user_id,
      request_key,
      company_name,
      idea,
      status,
      paperclip_company_id,
      bridge_principal_id,
      last_error,
      retry_eligible
    FROM provisioning_runs
    WHERE clerk_user_id = ${input.clerkUserId}
    ORDER BY created_at DESC
    LIMIT 1
  `;

  return rows[0] ? toProvisioningRunRecord(rows[0]) : null;
}

export async function claimProvisioningRunForUser(input: {
  clerkUserId: string;
  companyName: string;
  idea: string | null;
}) : Promise<ProvisioningClaimResult | null> {
  const sql = getSql();
  if (!sql) return null;
  await ensureProvisioningSchema(sql);

  const requestKey = buildProvisioningRequestKey(input.clerkUserId);
  const existing = await getProvisioningRunForUser({ clerkUserId: input.clerkUserId });

  if (existing?.status === "succeeded" && existing.paperclipCompanyId) {
    return { action: "existing", record: existing };
  }

  if (existing?.status === "pending" || existing?.status === "running") {
    return { action: "pending", record: existing };
  }

  if (existing && (existing.status === "failed" || existing.status === "canceled")) {
    const rows = await sql<ProvisioningRunRow[]>`
      UPDATE provisioning_runs
      SET
        company_name = ${input.companyName},
        idea = ${input.idea},
        status = 'pending',
        last_error = NULL,
        retry_eligible = TRUE,
        paperclip_company_id = NULL,
        bridge_principal_id = NULL,
        started_at = NULL,
        finished_at = NULL,
        updated_at = NOW()
      WHERE id = ${existing.id}
      RETURNING
        id,
        clerk_user_id,
        request_key,
        company_name,
        idea,
        status,
        paperclip_company_id,
        bridge_principal_id,
        last_error,
        retry_eligible
    `;

    return { action: "start", record: toProvisioningRunRecord(rows[0]) };
  }

  const createdId = `prov_${randomUUID()}`;
  const inserted = await sql<ProvisioningRunRow[]>`
    INSERT INTO provisioning_runs (
      id,
      clerk_user_id,
      request_key,
      company_name,
      idea,
      status,
      retry_eligible
    )
    VALUES (
      ${createdId},
      ${input.clerkUserId},
      ${requestKey},
      ${input.companyName},
      ${input.idea},
      'pending',
      TRUE
    )
    ON CONFLICT (request_key) DO NOTHING
    RETURNING
      id,
      clerk_user_id,
      request_key,
      company_name,
      idea,
      status,
      paperclip_company_id,
      bridge_principal_id,
      last_error,
      retry_eligible
  `;

  if (inserted[0]) {
    return { action: "start", record: toProvisioningRunRecord(inserted[0]) };
  }

  const claimed = await getProvisioningRunForUser({ clerkUserId: input.clerkUserId });
  if (!claimed) {
    return null;
  }

  if (claimed.status === "succeeded" && claimed.paperclipCompanyId) {
    return { action: "existing", record: claimed };
  }

  return { action: "pending", record: claimed };
}

export async function markProvisioningRunStarted(input: { runId: string }) {
  const sql = getSql();
  if (!sql) return;
  await ensureProvisioningSchema(sql);

  await sql`
    UPDATE provisioning_runs
    SET status = 'running', started_at = NOW(), updated_at = NOW()
    WHERE id = ${input.runId}
  `;
}

export async function markProvisioningRunSucceeded(input: {
  runId: string;
  paperclipCompanyId: string;
  bridgePrincipalId: string;
}) {
  const sql = getSql();
  if (!sql) return;
  await ensureProvisioningSchema(sql);

  await sql`
    UPDATE provisioning_runs
    SET
      status = 'succeeded',
      paperclip_company_id = ${input.paperclipCompanyId},
      bridge_principal_id = ${input.bridgePrincipalId},
      last_error = NULL,
      retry_eligible = FALSE,
      finished_at = NOW(),
      updated_at = NOW()
    WHERE id = ${input.runId}
  `;
}

export async function markProvisioningRunFailed(input: {
  runId: string;
  error: string;
  retryEligible: boolean;
}) {
  const sql = getSql();
  if (!sql) return;
  await ensureProvisioningSchema(sql);

  await sql`
    UPDATE provisioning_runs
    SET
      status = 'failed',
      last_error = ${input.error},
      retry_eligible = ${input.retryEligible},
      finished_at = NOW(),
      updated_at = NOW()
    WHERE id = ${input.runId}
  `;
}
