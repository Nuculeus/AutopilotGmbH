import { describe, expect, it } from "vitest";
import {
  deriveRevenueContext,
  deriveRevenueTrackFromText,
  evaluateRequiredConnections,
} from "@/lib/revenue-track";

describe("revenue track helpers", () => {
  it("derives a content track from broad creator-style ideas", () => {
    expect(
      deriveRevenueTrackFromText(
        "Ich will einen YouTube Kanal fuer KI-Automation und Lead-Generierung aufbauen.",
      ),
    ).toBe("content_business");
  });

  it("fills default revenue context when legacy profile fields are missing", () => {
    const context = deriveRevenueContext({
      companyGoal: "Wir bauen KI-Services.",
      offer: "Automationen und Support.",
      audience: "KMU in DACH.",
      priorities: "Pilotkunden gewinnen.",
      track: null,
      valueModel: "",
      requiredConnections: [],
      nextMilestone: null,
    });

    expect(context.revenueTrack).toBe("service_business");
    expect(context.requiredConnections).toEqual([
      "llm_any",
      "stripe",
      "outreach_channel",
    ]);
    expect(context.nextMilestone).toBe("briefing_ready");
  });

  it("reports missing track connections deterministically", () => {
    const result = evaluateRequiredConnections({
      hasLlmConnection: true,
      requiredConnections: ["llm_any", "stripe", "outreach_channel"],
      secretNames: ["openai_api_key"],
    });

    expect(result.hasRequiredConnections).toBe(false);
    expect(result.missingConnections).toEqual(["stripe", "outreach_channel"]);
  });
});
