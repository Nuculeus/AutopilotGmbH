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
        revenueTrack: "software_business",
        valueModel: "Subscription",
        requiredConnections: ["llm_any", "stripe", "deploy_stack"],
        nextMilestone: "first_offer_live",
        ventureId: "venture_1",
        proofTarget: "Erster zahlender Kunde in 7 Tagen.",
        budgetCapCents: 12000,
        acquisitionChannel: "outreach",
        paymentNode: "stripe_checkout",
        deliveryNode: "service_delivery",
        autonomyLevel: "semi_auto",
        updatedAt: "2026-03-21T00:00:00.000Z",
        ignored: 123,
      }),
    ).toEqual({
      companyGoal: "Goal",
      offer: "Offer",
      audience: "Audience",
      tone: "Tone",
      priorities: "Priorities",
      revenueTrack: "software_business",
      valueModel: "Subscription",
      requiredConnections: ["llm_any", "stripe", "deploy_stack"],
      nextMilestone: "first_offer_live",
      ventureId: "venture_1",
      proofTarget: "Erster zahlender Kunde in 7 Tagen.",
      budgetCapCents: 12000,
      acquisitionChannel: "outreach",
      paymentNode: "stripe_checkout",
      deliveryNode: "service_delivery",
      autonomyLevel: "semi_auto",
      updatedAt: "2026-03-21T00:00:00.000Z",
    });
  });

  it("derives a valid revenue track context for legacy profiles without new fields", () => {
    const profile = normalizeCompanyHqProfile({
      companyGoal: "Wir bauen KI-Services fuer regionale Betriebe.",
      offer: "Automationen als monatlicher Retainer.",
      audience: "KMU in DACH.",
      priorities: "Pilotkunden gewinnen.",
    });

    expect(profile.revenueTrack).toBe("service_business");
    expect(profile.valueModel.length).toBeGreaterThan(0);
    expect(profile.requiredConnections.length).toBeGreaterThan(0);
    expect(profile.nextMilestone).toBe("briefing_ready");
    expect(profile.proofTarget).toContain("Pilotkunde");
    expect(profile.acquisitionChannel).toContain("Outbound");
    expect(profile.paymentNode).toContain("Stripe");
    expect(profile.deliveryNode).toContain("Kickoff");
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
