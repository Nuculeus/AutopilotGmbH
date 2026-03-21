import {
  EMPTY_COMPANY_HQ_PROFILE,
  normalizeCompanyHqProfile,
  type CompanyHqProfile,
} from "@/lib/company-hq";

export type CompanyHqDraftResult = {
  mode: "openai" | "fallback";
  profile: CompanyHqProfile;
};

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";

function buildFallbackDraft(idea: string): CompanyHqDraftResult {
  const trimmedIdea = idea.trim();

  return {
    mode: "fallback",
    profile: {
      ...EMPTY_COMPANY_HQ_PROFILE,
      companyGoal: trimmedIdea,
      offer:
        "Formuliere daraus ein klares Angebot mit Ergebnis, Lieferumfang und Nutzen fuer den Kunden.",
      audience:
        "Benenne hier die wichtigste Zielgruppe, die von diesem Vorhaben am meisten profitiert.",
      tone: "Klar, vertrauenswuerdig, pragmatisch und ohne Buzzword-Sprache.",
      priorities:
        "Ersten funktionierenden Use Case definieren, Angebot schaerfen und erste Nachfrage testen.",
    },
  };
}

function extractOpenAiMessageContent(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const choices = (payload as { choices?: Array<{ message?: { content?: unknown } }> }).choices;
  const content = choices?.[0]?.message?.content;
  return typeof content === "string" ? content : null;
}

async function generateOpenAiDraft(idea: string) {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return null;
  }

  const response = await fetch(OPENAI_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: process.env.OPENAI_BRIEFING_MODEL ?? "gpt-4o-mini",
      temperature: 0.3,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "company_hq_draft",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            required: ["companyGoal", "offer", "audience", "tone", "priorities"],
            properties: {
              companyGoal: { type: "string" },
              offer: { type: "string" },
              audience: { type: "string" },
              tone: { type: "string" },
              priorities: { type: "string" },
            },
          },
        },
      },
      messages: [
        {
          role: "system",
          content:
            "Du bist ein deutscher Onboarding-Assistent fuer ein Produkt, das Firmen, Kanaele, Automationen und operative KI-Setups startet. Erzeuge kurze, klare deutsche Vorschlaege fuer ein editierbares Firmenbriefing. Keine Marketingfloskeln, keine langen Saetze, keine JSON-Zusatzfelder.",
        },
        {
          role: "user",
          content: `Leitfrage: Was moechtest du aufbauen?\n\nAntwort:\n${idea.trim()}`,
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI draft request failed with status ${response.status}`);
  }

  const payload = await response.json();
  const content = extractOpenAiMessageContent(payload);

  if (!content) {
    throw new Error("OpenAI draft response was empty");
  }

  const parsed = JSON.parse(content);

  return {
    mode: "openai" as const,
    profile: {
      ...EMPTY_COMPANY_HQ_PROFILE,
      ...normalizeCompanyHqProfile(parsed),
    },
  };
}

export async function generateCompanyHqDraft(idea: string): Promise<CompanyHqDraftResult> {
  const trimmedIdea = idea.trim();

  if (!trimmedIdea) {
    return buildFallbackDraft("");
  }

  try {
    const openAiDraft = await generateOpenAiDraft(trimmedIdea);
    if (openAiDraft) {
      return openAiDraft;
    }
  } catch {
    // Fall back to a manual draft so onboarding remains usable.
  }

  return buildFallbackDraft(trimmedIdea);
}
