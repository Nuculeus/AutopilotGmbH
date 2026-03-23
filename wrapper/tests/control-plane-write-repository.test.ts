import { describe, expect, it } from "vitest";
import {
  insertBillableEvent,
  insertCreditLedgerEntry,
  insertUsageEvent,
  upsertConnectionBinding,
} from "@/lib/db/write-repository";

function createSqlMock(responses: unknown[][] = []) {
  const calls: Array<{ query: string; values: unknown[] }> = [];

  const sql = (strings: TemplateStringsArray, ...values: unknown[]) => {
    const query = strings.join("?");
    calls.push({ query, values });
    return Promise.resolve((responses.shift() ?? []) as never);
  };

  return {
    sql: sql as never,
    calls,
  };
}

describe("control plane write repository", () => {
  it("upserts connector verification state durably", async () => {
    const { sql, calls } = createSqlMock([[{ id: "binding_1" }]]);

    const bindingId = await upsertConnectionBinding(sql, {
      id: "binding_1",
      ventureId: "venture_1",
      bindingKind: "llm_readiness",
      provider: "openai",
      externalRef: "codex_local",
      status: "verified",
      metadataJson: { summary: "ready" },
    });

    expect(bindingId).toBe("binding_1");
    expect(calls[0]?.query).toContain("INSERT INTO connection_bindings");
    expect(calls[0]?.query).toContain("ON CONFLICT (venture_id, binding_kind, provider) DO UPDATE");
    expect(calls[0]?.values).toEqual([
      "binding_1",
      "venture_1",
      "llm_readiness",
      "openai",
      "codex_local",
      "verified",
      JSON.stringify({ summary: "ready" }),
    ]);
  });

  it("inserts billable events separately from raw usage meters", async () => {
    const { sql, calls } = createSqlMock();

    await insertBillableEvent(sql, {
      id: "billable_1",
      workspaceId: "ws_1",
      ventureId: "venture_1",
      runId: "run_1",
      eventType: "auto_product",
      productKey: "offer_sprint_v1",
      creditsCost: 12,
      idempotencyKey: "run_1:offer_sprint_v1",
      approvalGateId: null,
      metadataJson: { source: "run_completion" },
      createdAt: "2026-03-23T08:00:00.000Z",
      settledAt: null,
    });

    expect(calls[0]?.query).toContain("INSERT INTO billable_events");
    expect(calls[0]?.query).toContain("ON CONFLICT (idempotency_key) DO NOTHING");
    expect(calls[0]?.values).toEqual([
      "billable_1",
      "ws_1",
      "venture_1",
      "run_1",
      "auto_product",
      "offer_sprint_v1",
      12,
      "run_1:offer_sprint_v1",
      null,
      JSON.stringify({ source: "run_completion" }),
      "2026-03-23T08:00:00.000Z",
      null,
    ]);
  });

  it("inserts immutable credit ledger entries", async () => {
    const { sql, calls } = createSqlMock();

    await insertCreditLedgerEntry(sql, {
      id: "ledger_1",
      workspaceId: "ws_1",
      ventureId: "venture_1",
      eventKind: "grant",
      creditsDelta: 100,
      euroCostCents: 0,
      providerCostCents: 0,
      note: "launch_bonus",
      metadataJson: { source: "launch" },
      createdAt: "2026-03-23T08:00:00.000Z",
    });

    expect(calls[0]?.query).toContain("INSERT INTO credit_ledger");
    expect(calls[0]?.values).toEqual([
      "ledger_1",
      "ws_1",
      "venture_1",
      "grant",
      100,
      0,
      0,
      "launch_bonus",
      JSON.stringify({ source: "launch" }),
      "2026-03-23T08:00:00.000Z",
    ]);
  });

  it("inserts usage events for internal provider cost tracking", async () => {
    const { sql, calls } = createSqlMock();

    await insertUsageEvent(sql, {
      id: "usage_1",
      workspaceId: "ws_1",
      ventureId: "venture_1",
      runId: "run_1",
      provider: "internal_worker",
      category: "run_execution",
      unitCount: 1,
      estimatedCostCents: 0,
      finalCostCents: 240,
      metadataJson: { kind: "service_offer_iteration" },
      createdAt: "2026-03-23T08:05:00.000Z",
    });

    expect(calls[0]?.query).toContain("INSERT INTO usage_events");
    expect(calls[0]?.values).toEqual([
      "usage_1",
      "ws_1",
      "venture_1",
      "run_1",
      "internal_worker",
      "run_execution",
      1,
      0,
      240,
      JSON.stringify({ kind: "service_offer_iteration" }),
      "2026-03-23T08:05:00.000Z",
    ]);
  });
});
