import { describe, expect, it } from "vitest";
import {
  insertCreditLedgerEntry,
  insertUsageEvent,
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
