export const CREDIT_POLICY = {
  freeTrialCredits: 20,
  launchBonusCredits: 100,
  starterMonthlyCredits: 50,
  proMonthlyCredits: 200,
  launchBonusExpiryDays: 30,
  topUpPricePerCreditEur: 0.5,
} as const;

export type AutopilotPlan = "free" | "launch" | "starter" | "pro";

export type CreditMetadata = {
  plan?: AutopilotPlan;
  launchBonusClaimed?: boolean;
  launchBonusClaimedAt?: string;
  launchBonusExpiresAt?: string;
  consumedCredits?: number;
  manualCredits?: number;
  stripeCustomerId?: string;
  lastCheckoutSessionId?: string;
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

export function normalizeCreditMetadata(
  value: unknown,
): Required<Pick<CreditMetadata, "plan" | "launchBonusClaimed" | "consumedCredits" | "manualCredits">> &
  Omit<CreditMetadata, "plan" | "launchBonusClaimed" | "consumedCredits" | "manualCredits"> {
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
  const launchBonusCredits = metadata.launchBonusClaimed
    ? CREDIT_POLICY.launchBonusCredits
    : 0;
  const monthlyPlanCredits = getPlanCredits(metadata.plan);
  const availableCredits = Math.max(
    freeTrialCredits +
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
    manualCredits: metadata.manualCredits,
    consumedCredits: metadata.consumedCredits,
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
