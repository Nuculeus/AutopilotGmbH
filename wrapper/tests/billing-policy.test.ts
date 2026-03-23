import { describe, expect, it } from "vitest";
import {
  BILLING_POLICY_V1,
  classifyUsageMeter,
  getApprovedExtensionPackCredits,
  getAutoBillableProductCredits,
  settleCompletedBillableItem,
} from "@/lib/billing-policy";

describe("billing policy v1", () => {
  it("keeps raw provider usage internal unless explicitly approval-gated", () => {
    expect(classifyUsageMeter("llm_input_tokens")).toBe("internal_included");
    expect(classifyUsageMeter("search_call")).toBe("internal_included");
    expect(classifyUsageMeter("connector_healthcheck")).toBe("internal_included");
    expect(classifyUsageMeter("video_render_second")).toBe("approval_required");
    expect(classifyUsageMeter("unknown_future_meter")).toBe("non_billable");
  });

  it("prices named customer-facing product packages from the versioned policy", () => {
    expect(BILLING_POLICY_V1.version).toBe("billing_policy_v1");
    expect(getAutoBillableProductCredits("offer_sprint_v1")).toBe(12);
    expect(getAutoBillableProductCredits("lead_batch_50_v1")).toBe(15);
    expect(getApprovedExtensionPackCredits("extra_scripts_5_v1")).toBe(4);
  });

  it("settles a completed sprint to a fixed debit instead of mirroring raw usage", () => {
    const settlement = settleCompletedBillableItem({
      billableEventId: "bill_evt_offer_1",
      billableKind: "auto_product",
      productKey: "offer_sprint_v1",
      status: "completed",
    });

    expect(settlement).toEqual({
      ledgerEntry: {
        eventKind: "debit",
        creditsDelta: -12,
        note: "offer_sprint_v1",
      },
      creditsCost: 12,
      policyVersion: "billing_policy_v1",
    });
  });

  it("only settles approved extension packs and never charges failed work", () => {
    expect(
      settleCompletedBillableItem({
        billableEventId: "bill_evt_failed_validation",
        billableKind: "auto_product",
        productKey: "validation_sprint_v1",
        status: "failed",
      }),
    ).toBeNull();

    expect(
      settleCompletedBillableItem({
        billableEventId: "bill_evt_extra_leads_pending",
        billableKind: "approved_extension_pack",
        productKey: "extra_leads_25_v1",
        status: "completed",
        approvalGranted: false,
      }),
    ).toBeNull();

    expect(
      settleCompletedBillableItem({
        billableEventId: "bill_evt_extra_leads_approved",
        billableKind: "approved_extension_pack",
        productKey: "extra_leads_25_v1",
        status: "completed",
        approvalGranted: true,
      }),
    ).toEqual({
      ledgerEntry: {
        eventKind: "debit",
        creditsDelta: -5,
        note: "extra_leads_25_v1",
      },
      creditsCost: 5,
      policyVersion: "billing_policy_v1",
    });
  });
});
