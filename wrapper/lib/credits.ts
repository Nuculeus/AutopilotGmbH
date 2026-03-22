export const CREDIT_POLICY = {
  freeTrialCredits: 20,
  launchBonusCredits: 100,
  starterMonthlyCredits: 50,
  proMonthlyCredits: 200,
  launchBonusExpiryDays: 30,
  topUpPricePerCreditEur: 0.5,
} as const;

export type AutopilotPlan = "free" | "launch" | "starter" | "pro";

export type CreditLedgerEventKind =
  | "grant"
  | "debit"
  | "refund"
  | "technical_reversal";

export type CreditLedgerEntry = {
  id: string;
  eventKind: CreditLedgerEventKind;
  creditsDelta: number;
  euroCostCents: number;
  providerCostCents: number;
  note?: string;
  externalRef?: string;
  createdAt: string;
};

export type CreditMetadata = {
  plan?: AutopilotPlan;
  launchBonusClaimed?: boolean;
  launchBonusClaimedAt?: string;
  launchBonusExpiresAt?: string;
  consumedCredits?: number;
  manualCredits?: number;
  stripeCustomerId?: string;
  lastCheckoutSessionId?: string;
  creditLedgerEntries?: CreditLedgerEntry[];
  processedStripeEventIds?: string[];
};

export type CreditSummary = {
  plan: AutopilotPlan;
  freeTrialCredits: number;
  launchBonusCredits: number;
  monthlyPlanCredits: number;
  manualCredits: number;
  consumedCredits: number;
  availableCredits: number;
  launchBonusClaimed: boolean;
  launchBonusExpiresAt: string | null;
  bonusEligible: boolean;
};

export type NormalizedCreditMetadata =
  Required<
    Pick<
      CreditMetadata,
      | "plan"
      | "launchBonusClaimed"
      | "consumedCredits"
      | "manualCredits"
      | "creditLedgerEntries"
      | "processedStripeEventIds"
    >
  > &
    Omit<
      CreditMetadata,
      | "plan"
      | "launchBonusClaimed"
      | "consumedCredits"
      | "manualCredits"
      | "creditLedgerEntries"
      | "processedStripeEventIds"
    >;

export function normalizeCreditMetadata(
  value: unknown,
): NormalizedCreditMetadata {
  const source = value && typeof value === "object" ? (value as CreditMetadata) : {};

  return {
    plan:
      source.plan === "launch" ||
      source.plan === "starter" ||
      source.plan === "pro"
        ? source.plan
        : "free",
    launchBonusClaimed: Boolean(source.launchBonusClaimed),
    launchBonusClaimedAt: source.launchBonusClaimedAt,
    launchBonusExpiresAt: source.launchBonusExpiresAt,
    consumedCredits: Number(source.consumedCredits ?? 0),
    manualCredits: Number(source.manualCredits ?? 0),
    stripeCustomerId: source.stripeCustomerId,
    lastCheckoutSessionId: source.lastCheckoutSessionId,
    creditLedgerEntries: Array.isArray(source.creditLedgerEntries)
      ? source.creditLedgerEntries
          .filter((entry): entry is CreditLedgerEntry => Boolean(entry) && typeof entry === "object")
          .map((entry) => ({
            id: typeof entry.id === "string" ? entry.id : crypto.randomUUID(),
            eventKind:
              entry.eventKind === "debit" ||
              entry.eventKind === "refund" ||
              entry.eventKind === "technical_reversal"
                ? entry.eventKind
                : "grant",
            creditsDelta: Number(entry.creditsDelta ?? 0),
            euroCostCents: Number(entry.euroCostCents ?? 0),
            providerCostCents: Number(entry.providerCostCents ?? 0),
            note: typeof entry.note === "string" ? entry.note : undefined,
            externalRef: typeof entry.externalRef === "string" ? entry.externalRef : undefined,
            createdAt:
              typeof entry.createdAt === "string" && entry.createdAt.length > 0
                ? entry.createdAt
                : new Date(0).toISOString(),
          }))
      : [],
    processedStripeEventIds: Array.isArray(source.processedStripeEventIds)
      ? source.processedStripeEventIds.filter((eventId): eventId is string => typeof eventId === "string")
      : [],
  };
}

export function appendCreditLedgerEntry(
  current: unknown,
  entry: CreditLedgerEntry,
) {
  const metadata = normalizeCreditMetadata(current);
  if (metadata.creditLedgerEntries.some((currentEntry) => currentEntry.id === entry.id)) {
    return metadata;
  }

  return {
    ...metadata,
    creditLedgerEntries: [...metadata.creditLedgerEntries, entry],
  };
}

export function markStripeEventProcessed(current: unknown, eventId: string) {
  const metadata = normalizeCreditMetadata(current);
  if (!eventId || metadata.processedStripeEventIds.includes(eventId)) {
    return metadata;
  }

  return {
    ...metadata,
    processedStripeEventIds: [...metadata.processedStripeEventIds, eventId],
  };
}

export function getPlanCredits(plan: AutopilotPlan) {
  switch (plan) {
    case "starter":
      return CREDIT_POLICY.starterMonthlyCredits;
    case "pro":
      return CREDIT_POLICY.proMonthlyCredits;
    default:
      return 0;
  }
}

export function summarizeCredits(value: unknown): CreditSummary {
  const metadata = normalizeCreditMetadata(value);
  const freeTrialCredits = CREDIT_POLICY.freeTrialCredits;
  const usesLedger = metadata.creditLedgerEntries.length > 0;
  const ledgerLaunchBonusCredits = metadata.creditLedgerEntries.reduce((sum, entry) => {
    if (entry.note === "launch_bonus" && entry.creditsDelta > 0) {
      return sum + entry.creditsDelta;
    }
    return sum;
  }, 0);
  const launchBonusCredits = usesLedger
    ? ledgerLaunchBonusCredits
    : metadata.launchBonusClaimed
      ? CREDIT_POLICY.launchBonusCredits
      : 0;
  const monthlyPlanCredits = getPlanCredits(metadata.plan);
  const ledgerCreditsDelta = metadata.creditLedgerEntries.reduce(
    (sum, entry) => sum + entry.creditsDelta,
    0,
  );
  const ledgerPositiveCredits = metadata.creditLedgerEntries.reduce((sum, entry) => {
    if (entry.creditsDelta > 0) {
      return sum + entry.creditsDelta;
    }
    return sum;
  }, 0);
  const ledgerConsumedCredits = metadata.creditLedgerEntries.reduce((sum, entry) => {
    if (entry.creditsDelta < 0) {
      return sum + Math.abs(entry.creditsDelta);
    }
    return sum;
  }, 0);
  const ledgerRefundedCredits = metadata.creditLedgerEntries.reduce((sum, entry) => {
    if (entry.eventKind === "refund" || entry.eventKind === "technical_reversal") {
      return sum + Math.max(0, entry.creditsDelta);
    }
    return sum;
  }, 0);
  const availableCredits = Math.max(
    usesLedger
      ? freeTrialCredits + monthlyPlanCredits + ledgerCreditsDelta
      : freeTrialCredits +
          launchBonusCredits +
          monthlyPlanCredits +
          metadata.manualCredits -
          metadata.consumedCredits,
    0,
  );

  return {
    plan: metadata.plan,
    freeTrialCredits,
    launchBonusCredits,
    monthlyPlanCredits,
    manualCredits: usesLedger ? ledgerPositiveCredits : metadata.manualCredits,
    consumedCredits: usesLedger ? Math.max(ledgerConsumedCredits - ledgerRefundedCredits, 0) : metadata.consumedCredits,
    availableCredits,
    launchBonusClaimed: metadata.launchBonusClaimed,
    launchBonusExpiresAt: metadata.launchBonusExpiresAt ?? null,
    bonusEligible: !metadata.launchBonusClaimed,
  };
}

export function getLaunchBonusExpiryDate(now = new Date()) {
  const expiry = new Date(now);
  expiry.setDate(expiry.getDate() + CREDIT_POLICY.launchBonusExpiryDays);
  return expiry.toISOString();
}

export function formatPlanLabel(plan: AutopilotPlan) {
  switch (plan) {
    case "launch":
      return "Launch";
    case "starter":
      return "Starter";
    case "pro":
      return "Pro";
    default:
      return "Free";
  }
}
