import {
  deriveRevenueContext,
  normalizeLaunchRevenueMilestone,
  normalizeRequiredConnections,
  normalizeRevenueTrack,
  type LaunchRevenueMilestone,
  type RequiredConnectionId,
  type RevenueTrack,
} from "@/lib/revenue-track";

export type CompanyHqProfile = {
  companyGoal: string;
  offer: string;
  audience: string;
  tone: string;
  priorities: string;
  revenueTrack: RevenueTrack | null;
  valueModel: string;
  requiredConnections: RequiredConnectionId[];
  nextMilestone: LaunchRevenueMilestone | null;
  ventureId: string | null;
  proofTarget: string;
  budgetCapCents: number | null;
  acquisitionChannel: string;
  paymentNode: string;
  deliveryNode: string;
  autonomyLevel: "guided" | "semi_auto" | "auto";
  updatedAt: string | null;
};

export const EMPTY_COMPANY_HQ_PROFILE: CompanyHqProfile = {
  companyGoal: "",
  offer: "",
  audience: "",
  tone: "",
  priorities: "",
  revenueTrack: null,
  valueModel: "",
  requiredConnections: [],
  nextMilestone: null,
  ventureId: null,
  proofTarget: "",
  budgetCapCents: null,
  acquisitionChannel: "",
  paymentNode: "",
  deliveryNode: "",
  autonomyLevel: "guided",
  updatedAt: null,
};

function asString(value: unknown) {
  return typeof value === "string" ? value : "";
}

export function normalizeCompanyHqProfile(value: unknown): CompanyHqProfile {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return EMPTY_COMPANY_HQ_PROFILE;
  }

  const source = value as Record<string, unknown>;
  const companyGoal = asString(source.companyGoal);
  const offer = asString(source.offer);
  const audience = asString(source.audience);
  const priorities = asString(source.priorities);
  const revenueContext = deriveRevenueContext({
    companyGoal,
    offer,
    audience,
    priorities,
    track: normalizeRevenueTrack(source.revenueTrack),
    valueModel: asString(source.valueModel),
    requiredConnections: normalizeRequiredConnections(source.requiredConnections),
    nextMilestone: normalizeLaunchRevenueMilestone(source.nextMilestone),
  });

  return {
    companyGoal,
    offer,
    audience,
    tone: asString(source.tone),
    priorities,
    revenueTrack: revenueContext.revenueTrack,
    valueModel: revenueContext.valueModel,
    requiredConnections: revenueContext.requiredConnections,
    nextMilestone: revenueContext.nextMilestone,
    ventureId: typeof source.ventureId === "string" ? source.ventureId : null,
    proofTarget: asString(source.proofTarget),
    budgetCapCents:
      typeof source.budgetCapCents === "number" && Number.isFinite(source.budgetCapCents)
        ? source.budgetCapCents
        : null,
    acquisitionChannel: asString(source.acquisitionChannel),
    paymentNode: asString(source.paymentNode),
    deliveryNode: asString(source.deliveryNode),
    autonomyLevel:
      source.autonomyLevel === "semi_auto" || source.autonomyLevel === "auto"
        ? source.autonomyLevel
        : "guided",
    updatedAt: typeof source.updatedAt === "string" ? source.updatedAt : null,
  };
}

export function hasStoredCompanyHqBriefing(value: unknown) {
  const profile = normalizeCompanyHqProfile(value);

  return [profile.companyGoal, profile.offer, profile.audience, profile.priorities].every(
    (field) => field.trim().length > 0,
  );
}
