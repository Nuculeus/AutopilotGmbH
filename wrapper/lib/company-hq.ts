export type CompanyHqProfile = {
  companyGoal: string;
  offer: string;
  audience: string;
  tone: string;
  priorities: string;
  updatedAt: string | null;
};

export const EMPTY_COMPANY_HQ_PROFILE: CompanyHqProfile = {
  companyGoal: "",
  offer: "",
  audience: "",
  tone: "",
  priorities: "",
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

  return {
    companyGoal: asString(source.companyGoal),
    offer: asString(source.offer),
    audience: asString(source.audience),
    tone: asString(source.tone),
    priorities: asString(source.priorities),
    updatedAt: typeof source.updatedAt === "string" ? source.updatedAt : null,
  };
}

export function hasStoredCompanyHqBriefing(value: unknown) {
  const profile = normalizeCompanyHqProfile(value);

  return [profile.companyGoal, profile.offer, profile.audience, profile.priorities].every(
    (field) => field.trim().length > 0,
  );
}
