import { describe, expect, it, vi } from "vitest";
import { generateCompanyHqDraft } from "@/lib/company-hq-draft";

describe("generateCompanyHqDraft", () => {
  it("falls back to a useful manual draft when no model key is configured", async () => {
    delete process.env.OPENAI_API_KEY;

    const result = await generateCompanyHqDraft(
      "Ich moechte einen YouTube-Kanal aufbauen, der lokale Unternehmen beim Einsatz von KI-Automationen zeigt.",
    );

    expect(result.mode).toBe("fallback");
    expect(result.profile.companyGoal).toContain("YouTube-Kanal");
    expect(result.profile.offer.length).toBeGreaterThan(0);
    expect(result.profile.audience.length).toBeGreaterThan(0);
  });

  it("returns a structured openai draft when an api key is available", async () => {
    process.env.OPENAI_API_KEY = "sk-test";
    process.env.OPENAI_BRIEFING_MODEL = "gpt-4o-mini";

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    companyGoal: "Wir bauen eine Content-Marke fuer KI-Automation im Mittelstand.",
                    offer: "Wir liefern Videos, Templates und Umsetzungsberatung fuer KMU.",
                    audience: "Deutsche KMU und Solo-Selbststaendige mit wenig Zeit.",
                    tone: "Klar, pragmatisch und vertrauenswuerdig.",
                    priorities: "Erste Inhalte veroeffentlichen, Angebot schaerfen, erste Leads gewinnen.",
                  }),
                },
              },
            ],
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          },
        ),
      ),
    );

    const result = await generateCompanyHqDraft(
      "Ich will eine deutschsprachige Content-Maschine fuer KI-Automation bauen.",
    );

    expect(result.mode).toBe("openai");
    expect(result.profile.offer).toContain("Videos");
    expect(result.profile.tone).toContain("pragmatisch");
  });
});
