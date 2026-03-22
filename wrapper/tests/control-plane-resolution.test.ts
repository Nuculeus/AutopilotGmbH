import { describe, expect, it } from "vitest";
import { EMPTY_COMPANY_HQ_PROFILE } from "@/lib/company-hq";
import { EMPTY_AUTOPILOT_REVENUE } from "@/lib/revenue-events";
import { resolveControlPlaneStateSources } from "@/lib/control-plane-resolution";

describe("resolveControlPlaneStateSources", () => {
  it("prefers the control plane snapshot over legacy metadata when available", () => {
    const result = resolveControlPlaneStateSources({
      controlPlaneSnapshot: {
        workspaceId: "ws_1",
        ventureId: "venture_1",
        profile: {
          ...EMPTY_COMPANY_HQ_PROFILE,
          companyGoal: "DB goal",
          offer: "DB offer",
          audience: "DB audience",
          priorities: "DB priorities",
          ventureId: "venture_1",
        },
        revenue: {
          ...EMPTY_AUTOPILOT_REVENUE,
          revenueEvents: [
            {
              kind: "revenue_recorded",
              createdAt: "2026-03-22T10:00:00.000Z",
              source: "stripe",
              amountCents: 4900,
              currency: "EUR",
              externalRef: "pi_123",
            },
          ],
        },
      },
      legacyCompanyHqProfile: {
        ...EMPTY_COMPANY_HQ_PROFILE,
        companyGoal: "Legacy goal",
        offer: "Legacy offer",
      },
      legacyRevenue: {
        ...EMPTY_AUTOPILOT_REVENUE,
        revenueEvents: [
          {
            kind: "payment_failed",
            createdAt: "2026-03-21T10:00:00.000Z",
            source: "stripe",
            amountCents: 4900,
            currency: "EUR",
            externalRef: "pi_old",
          },
        ],
      },
    });

    expect(result.source).toBe("control_plane");
    expect(result.companyHqProfile.companyGoal).toBe("DB goal");
    expect(result.revenue.revenueEvents[0]?.kind).toBe("revenue_recorded");
  });

  it("falls back to legacy metadata when no control plane snapshot exists", () => {
    const result = resolveControlPlaneStateSources({
      controlPlaneSnapshot: null,
      legacyCompanyHqProfile: {
        ...EMPTY_COMPANY_HQ_PROFILE,
        companyGoal: "Legacy goal",
        offer: "Legacy offer",
        audience: "Legacy audience",
        priorities: "Legacy priorities",
      },
      legacyRevenue: {
        ...EMPTY_AUTOPILOT_REVENUE,
        revenueEvents: [
          {
            kind: "offer_live",
            createdAt: "2026-03-21T10:00:00.000Z",
            source: "workspace",
            amountCents: null,
            currency: null,
            externalRef: null,
          },
        ],
      },
    });

    expect(result.source).toBe("legacy");
    expect(result.companyHqProfile.companyGoal).toBe("Legacy goal");
    expect(result.revenue.revenueEvents[0]?.kind).toBe("offer_live");
  });
});
