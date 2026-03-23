import { describe, expect, it } from "vitest";
import { buildStartPageModel } from "@/lib/start-page";

describe("buildStartPageModel", () => {
  it("frames the service path around named sprints instead of raw credits", () => {
    const model = buildStartPageModel({
      revenueTrack: "service_business",
      availableCredits: 120,
      reversedCredits: 0,
    });

    expect(model.headline).toContain("Sprints");
    expect(model.intro).toContain("klare Arbeitspakete");
    expect(model.sprints.map((sprint) => sprint.label)).toEqual([
      "Offer Sprint",
      "Validation Sprint",
      "Lead Engine Batch",
    ]);
    expect(model.sprints[0]).toMatchObject({
      estimatedCredits: 12,
      maxCredits: 12,
      successCondition: "Angebot, CTA und Checkout-Ansatz sind fachlich nutzbar fertig.",
    });
  });

  it("shows refund-safe technical failure wording on every suggested sprint", () => {
    const model = buildStartPageModel({
      revenueTrack: "content_business",
      availableCredits: 20,
      reversedCredits: 4,
    });

    expect(model.safetyNotice).toBe(
      "Bei technischem Fehler entsteht keine finale Belastung. Retries und Infrastrukturfehler bleiben intern.",
    );
    expect(model.sprints.every((sprint) => sprint.refundPolicy === model.safetyNotice)).toBe(true);
  });

  it("keeps a fixed maximum automatic debit per sprint", () => {
    const model = buildStartPageModel({
      revenueTrack: "software_business",
      availableCredits: 20,
      reversedCredits: 0,
    });

    expect(model.sprints.map((sprint) => sprint.maxCredits)).toEqual([10, 12, 1]);
    expect(model.budgetSummary).toBe("20 Credits aktuell verfuegbar");
  });
});
