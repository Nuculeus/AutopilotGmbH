import { describe, expect, it } from "vitest";
import {
  getPrimaryVentureByWorkspaceId,
  getVentureSpecByVentureId,
  getWorkspaceByClerkUserId,
  listRevenueEventsByVentureId,
} from "@/lib/db/read-repository";

function createSqlMock(responses: unknown[][]) {
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

describe("control plane read repository", () => {
  it("loads a workspace by clerk user id", async () => {
    const { sql, calls } = createSqlMock([
      [
        {
          id: "ws_1",
          clerk_user_id: "user_1",
          company_id: "cmp_1",
          company_name: "Acme",
          bridge_principal_id: "clerk:user_1",
        },
      ],
    ]);

    const result = await getWorkspaceByClerkUserId(sql, "user_1");

    expect(result?.id).toBe("ws_1");
    expect(calls[0]?.query).toContain("FROM workspaces");
    expect(calls[0]?.values).toEqual(["user_1"]);
  });

  it("loads the primary venture for a workspace", async () => {
    const { sql, calls } = createSqlMock([
      [
        {
          id: "venture_1",
          workspace_id: "ws_1",
          name: "Main Venture",
          revenue_track: "service_business",
          status: "active",
        },
      ],
    ]);

    const result = await getPrimaryVentureByWorkspaceId(sql, "ws_1");

    expect(result?.id).toBe("venture_1");
    expect(calls[0]?.query).toContain("FROM ventures");
    expect(calls[0]?.values).toEqual(["ws_1"]);
  });

  it("loads the current venture spec by venture id", async () => {
    const { sql, calls } = createSqlMock([
      [
        {
          venture_id: "venture_1",
          company_goal: "Goal",
          offer: "Offer",
          audience: "Audience",
          tone: "Tone",
          priorities: "Priorities",
          revenue_track: "service_business",
          value_model: "retainer",
          required_connections_json: ["llm_any"],
          next_milestone: "briefing_ready",
          proof_target: "",
          budget_cap_cents: null,
          acquisition_channel: "",
          payment_node: "",
          delivery_node: "",
          autonomy_level: "guided",
          updated_at: "2026-03-22T00:00:00.000Z",
        },
      ],
    ]);

    const result = await getVentureSpecByVentureId(sql, "venture_1");

    expect(result?.venture_id).toBe("venture_1");
    expect(calls[0]?.query).toContain("FROM venture_specs");
    expect(calls[0]?.values).toEqual(["venture_1"]);
  });

  it("loads revenue events for a venture in chronological order", async () => {
    const { sql, calls } = createSqlMock([
      [
        {
          id: "rev_1",
          kind: "first_value_created",
          source: "workspace",
          amount_cents: null,
          currency: null,
          external_ref: null,
          summary: "First value",
          created_at: "2026-03-22T00:00:00.000Z",
        },
      ],
    ]);

    const result = await listRevenueEventsByVentureId(sql, "venture_1");

    expect(result).toHaveLength(1);
    expect(calls[0]?.query).toContain("FROM revenue_events");
    expect(calls[0]?.values).toEqual(["venture_1", 300]);
  });
});
