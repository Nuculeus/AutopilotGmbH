import { describe, expect, it } from "vitest";
import { hasStoredCompanyHqBriefing, normalizeCompanyHqProfile } from "@/lib/company-hq";

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

  it("recognizes when a launch-briefing is complete enough to continue", () => {
    expect(
      hasStoredCompanyHqBriefing({
        companyGoal: "Wir automatisieren Kundensupport.",
        offer: "KI-gestuetzte Rezeption und Workflow-Automation.",
        audience: "Regionale KMU in DACH.",
        tone: "",
        priorities: "Ersten Use Case live bringen.",
      }),
    ).toBe(true);

    expect(
      hasStoredCompanyHqBriefing({
        companyGoal: "Wir automatisieren Kundensupport.",
        offer: "",
        audience: "Regionale KMU in DACH.",
        tone: "",
        priorities: "Ersten Use Case live bringen.",
      }),
    ).toBe(false);
  });
});
