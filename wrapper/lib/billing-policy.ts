export type UsageEventClass =
  | "internal_included"
  | "progress_only"
  | "approval_required"
  | "non_billable";

export const BILLING_POLICY_V1 = {
  version: "billing_policy_v1",
  autoBillableProducts: {
    offer_sprint_v1: 12,
    validation_sprint_v1: 10,
    lead_batch_50_v1: 15,
    content_batch_v1: 8,
    publish_action_v1: 1,
  },
  approvedExtensionPacks: {
    extra_leads_25_v1: 5,
    extra_scripts_5_v1: 4,
    extra_image_1_v1: 2,
  },
  neverDirectlyBillableMeters: [
    "llm_input_tokens",
    "llm_output_tokens",
    "cache_read_tokens",
    "cache_write_tokens",
    "search_call",
    "browser_minute",
    "container_minute",
    "retry_attempt",
    "provision_attempt",
    "connector_healthcheck",
    "internal_eval",
  ],
  approvalRequiredMeters: [
    "video_render_second",
    "paid_ads_spend_cents",
    "third_party_subscription_cents",
    "legal_filing_cents",
  ],
} as const;

export type AutoBillableProductKey = keyof typeof BILLING_POLICY_V1.autoBillableProducts;
export type ApprovedExtensionPackKey = keyof typeof BILLING_POLICY_V1.approvedExtensionPacks;

export type BillableItemSettlementInput =
  | {
      billableEventId: string;
      billableKind: "auto_product";
      productKey: AutoBillableProductKey;
      status: "completed" | "failed" | "canceled";
    }
  | {
      billableEventId: string;
      billableKind: "approved_extension_pack";
      productKey: ApprovedExtensionPackKey;
      status: "completed" | "failed" | "canceled";
      approvalGranted: boolean;
    };

export type BillableItemSettlement = {
  policyVersion: typeof BILLING_POLICY_V1.version;
  creditsCost: number;
  ledgerEntry: {
    eventKind: "debit";
    creditsDelta: number;
    note: string;
  };
};

const INTERNAL_INCLUDED_METERS = new Set<string>(BILLING_POLICY_V1.neverDirectlyBillableMeters);
const APPROVAL_REQUIRED_METERS = new Set<string>(BILLING_POLICY_V1.approvalRequiredMeters);

export function classifyUsageMeter(meterKey: string): UsageEventClass {
  if (INTERNAL_INCLUDED_METERS.has(meterKey)) {
    return "internal_included";
  }

  if (APPROVAL_REQUIRED_METERS.has(meterKey)) {
    return "approval_required";
  }

  return "non_billable";
}

export function getAutoBillableProductCredits(productKey: AutoBillableProductKey) {
  return BILLING_POLICY_V1.autoBillableProducts[productKey];
}

export function getApprovedExtensionPackCredits(productKey: ApprovedExtensionPackKey) {
  return BILLING_POLICY_V1.approvedExtensionPacks[productKey];
}

export function settleCompletedBillableItem(
  input: BillableItemSettlementInput,
): BillableItemSettlement | null {
  if (input.status !== "completed") {
    return null;
  }

  if (input.billableKind === "approved_extension_pack" && input.approvalGranted !== true) {
    return null;
  }

  const creditsCost =
    input.billableKind === "auto_product"
      ? getAutoBillableProductCredits(input.productKey)
      : getApprovedExtensionPackCredits(input.productKey);

  return {
    policyVersion: BILLING_POLICY_V1.version,
    creditsCost,
    ledgerEntry: {
      eventKind: "debit",
      creditsDelta: -creditsCost,
      note: input.productKey,
    },
  };
}
