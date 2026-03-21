import { describe, expect, it } from "vitest";
import { normalizeCompanyHqProfile } from "@/lib/company-hq";

describe("normalizeCompanyHqProfile", () => {
  it("returns empty defaults for missing data", () => {
    expect(normalizeCompanyHqProfile(null)).toEqual({
      companyGoal: "",
      offer: "",
      audience: "",
      tone: "",
      priorities: "",
      updatedAt: null,
    });
  });

  it("keeps only string fields from stored metadata", () => {
    expect(
      normalizeCompanyHqProfile({
        companyGoal: "Goal",
        offer: "Offer",
        audience: "Audience",
        tone: "Tone",
        priorities: "Priorities",
        updatedAt: "2026-03-21T00:00:00.000Z",
        ignored: 123,
      }),
    ).toEqual({
      companyGoal: "Goal",
      offer: "Offer",
      audience: "Audience",
      tone: "Tone",
      priorities: "Priorities",
      updatedAt: "2026-03-21T00:00:00.000Z",
    });
  });
});
