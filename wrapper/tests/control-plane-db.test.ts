import { describe, expect, it } from "vitest";
import {
  CONTROL_PLANE_FOUNDATION_TABLES,
  CONTROL_PLANE_SCHEMA_SQL,
} from "@/lib/db/schema";
import { resolveControlPlaneDatabaseUrl } from "@/lib/db/client";

describe("control plane db foundation", () => {
  it("defines the required foundation tables in the schema bootstrap sql", () => {
    expect(CONTROL_PLANE_FOUNDATION_TABLES).toEqual([
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
    ]);

    for (const tableName of CONTROL_PLANE_FOUNDATION_TABLES) {
      expect(CONTROL_PLANE_SCHEMA_SQL).toContain(`CREATE TABLE IF NOT EXISTS ${tableName}`);
    }
  });

  it("normalizes the database url from environment-style input", () => {
    expect(resolveControlPlaneDatabaseUrl("  postgres://example  ")).toBe("postgres://example");
    expect(resolveControlPlaneDatabaseUrl("")).toBeNull();
    expect(resolveControlPlaneDatabaseUrl("   ")).toBeNull();
    expect(resolveControlPlaneDatabaseUrl(undefined)).toBeNull();
  });
});
