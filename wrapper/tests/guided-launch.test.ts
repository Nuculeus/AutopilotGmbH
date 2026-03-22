import { describe, expect, it } from "vitest";
import {
  appStarterTemplates,
  companyHqSetupSections,
  priorityConnectionTemplates,
  revenueTrackOptions,
} from "@/lib/guided-launch";

describe("guided launch content", () => {
  it("defines the company hq setup flow in plain German", () => {
    expect(companyHqSetupSections.map((section) => section.title)).toEqual([
      "Wofür gibt es diese Firma?",
      "Was verkauft oder liefert sie?",
      "Für wen ist sie gedacht?",
      "Wie soll sie auftreten?",
      "Was ist jetzt am wichtigsten?",
    ]);
  });

  it("prioritizes the first three launch-safe model connections", () => {
    expect(priorityConnectionTemplates.map((item) => item.id)).toEqual([
      "openai",
      "anthropic",
      "gemini",
    ]);
  });

  it("offers a small set of realistic starter apps", () => {
    expect(appStarterTemplates.map((item) => item.id)).toEqual([
      "landing-page",
      "lead-capture",
      "seo-page",
      "support-flow",
      "ops-board",
    ]);
  });

  it("defines exactly three launch revenue tracks", () => {
    expect(revenueTrackOptions.map((item) => item.id)).toEqual([
      "service_business",
      "content_business",
      "software_business",
    ]);
  });
});
