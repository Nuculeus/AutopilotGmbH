export type CompanyHqProfile = {
  companyGoal: string;
  offer: string;
  audience: string;
  tone: string;
  priorities: string;
  updatedAt: string | null;
};

const EMPTY_PROFILE: CompanyHqProfile = {
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
    return EMPTY_PROFILE;
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
