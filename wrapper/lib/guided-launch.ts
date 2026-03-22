import {
  getRevenueTrackBlueprint,
  type RequiredConnectionId,
  type RevenueTrack,
} from "@/lib/revenue-track";

export type GuidedSection = {
  field: "companyGoal" | "offer" | "audience" | "tone" | "priorities";
  title: string;
  prompt: string;
  helper: string;
};

export type PriorityConnectionTemplate = {
  id: string;
  label: string;
  description: string;
  presetName: string;
  providerHint: string;
};

export type AppStarterTemplate = {
  id: string;
  title: string;
  description: string;
  kickoffPrompt: string;
};

export type RevenueTrackOption = {
  id: RevenueTrack;
  label: string;
  description: string;
  valueModel: string;
  firstActionTitle: string;
  firstActionPrompt: string;
  requiredConnections: RequiredConnectionId[];
};

export const companyHqSetupSections: GuidedSection[] = [
  {
    field: "companyGoal",
    title: "Wofür gibt es diese Firma?",
    prompt: "Beschreibe in einem Satz das Hauptziel deiner Firma.",
    helper: "Beispiel: Wir automatisieren Kundensupport für kleine E-Commerce-Marken in DACH.",
  },
  {
    field: "offer",
    title: "Was verkauft oder liefert sie?",
    prompt: "Formuliere das Angebot so, dass ein Außenstehender es sofort versteht.",
    helper: "Beispiel: Wir bauen Landingpages, qualifizieren Leads und liefern wöchentliche Wachstumsreports.",
  },
  {
    field: "audience",
    title: "Für wen ist sie gedacht?",
    prompt: "Nenne die wichtigste Zielgruppe oder den Zielkunden.",
    helper: "Beispiel: Solo-Selbstständige, KMU oder Agenturen im deutschsprachigen Raum.",
  },
  {
    field: "tone",
    title: "Wie soll sie auftreten?",
    prompt: "Lege Tonalität und Markenstil in wenigen Worten fest.",
    helper: "Beispiel: Klar, vertrauenswürdig, deutsch, pragmatisch, ohne Buzzword-Sprache.",
  },
  {
    field: "priorities",
    title: "Was ist jetzt am wichtigsten?",
    prompt: "Definiere die drei Prioritäten der nächsten 30 Tage.",
    helper: "Beispiel: erste Kunden gewinnen, Zahlungsfluss einrichten, Website live bringen.",
  },
];

export const priorityConnectionTemplates: PriorityConnectionTemplate[] = [
  {
    id: "openai",
    label: "OpenAI hinterlegen",
    description: "Empfohlen für GPT-5.4 und den schnellsten Start deiner ersten Operatoren.",
    presetName: "openai_api_key",
    providerHint: "local_encrypted",
  },
  {
    id: "anthropic",
    label: "Anthropic hinterlegen",
    description: "Empfohlen für Claude-Workflows und als zweite starke Modelloption.",
    presetName: "anthropic_api_key",
    providerHint: "local_encrypted",
  },
  {
    id: "gemini",
    label: "Gemini hinterlegen",
    description: "Optional, wenn du Google-Modelle bevorzugst oder mehrere Modellpfade parallel halten willst.",
    presetName: "gemini_api_key",
    providerHint: "local_encrypted",
  },
];

export const appStarterTemplates: AppStarterTemplate[] = [
  {
    id: "landing-page",
    title: "Landingpage",
    description: "Starte mit einer klaren deutschen Seite für Angebot, Proof und ersten CTA.",
    kickoffPrompt:
      "Erstelle eine deutsche Landingpage für mein Angebot mit klarem Nutzen, Vertrauenselementen und einem starken Call-to-Action.",
  },
  {
    id: "lead-capture",
    title: "Lead-Erfassung",
    description: "Baue einen einfachen Funnel, um die ersten Kontakte strukturiert einzusammeln.",
    kickoffPrompt:
      "Baue einen Lead-Capture-Flow für meine Firma, inklusive Formular, Dankeseite und Follow-up-E-Mail.",
  },
  {
    id: "seo-page",
    title: "SEO-Seite",
    description: "Lege eine erste organische Einstiegsseite für einen klaren Suchbegriff an.",
    kickoffPrompt:
      "Erstelle eine SEO-Seite auf Deutsch für meinen wichtigsten Suchbegriff inklusive Gliederung, Copy und CTA.",
  },
  {
    id: "support-flow",
    title: "Support-Workflow",
    description: "Richte einen einfachen Ablauf für häufige Kundenfragen und Antworten ein.",
    kickoffPrompt:
      "Lege einen Support-Workflow für häufige Kundenfragen an, inklusive Antwortstil, Eskalationsregeln und Vorlagen.",
  },
  {
    id: "ops-board",
    title: "Operations-Board",
    description: "Mache die wichtigsten Aufgaben, Prioritäten und Verantwortlichkeiten sichtbar.",
    kickoffPrompt:
      "Erstelle ein einfaches Operations-Board für die nächsten 30 Tage mit Prioritäten, Aufgaben und Verantwortlichkeiten.",
  },
];

export const revenueTrackOptions: RevenueTrackOption[] = [
  {
    id: "service_business",
    label: "Service Business",
    description:
      "Schnellster Weg zu erstem Umsatz: klares Angebot, erste Kunden, monatlicher Retainer.",
    ...getRevenueTrackBlueprint("service_business"),
  },
  {
    id: "content_business",
    label: "Content Business",
    description:
      "Audience und Inhalte als Motor für Leads, Sponsorings oder digitale Produkte.",
    ...getRevenueTrackBlueprint("content_business"),
  },
  {
    id: "software_business",
    label: "Software Business",
    description:
      "Micro-SaaS oder Tool-Angebot mit klarer Checkout- und Deploy-Route.",
    ...getRevenueTrackBlueprint("software_business"),
  },
];
