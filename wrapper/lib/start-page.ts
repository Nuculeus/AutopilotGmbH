import type { RevenueTrack } from "@/lib/revenue-track";
import {
  getAutoBillableProductCredits,
  type AutoBillableProductKey,
} from "@/lib/billing-policy";

type StartSprintDefinition = {
  key: AutoBillableProductKey;
  label: string;
  deliverable: string;
  successCondition: string;
};

export type StartSprintCard = StartSprintDefinition & {
  estimatedCredits: number;
  maxCredits: number;
  refundPolicy: string;
};

export type StartPageModel = {
  headline: string;
  intro: string;
  budgetSummary: string;
  safetyNotice: string;
  sprints: StartSprintCard[];
};

const SPRINT_DEFINITIONS: Record<AutoBillableProductKey, StartSprintDefinition> = {
  offer_sprint_v1: {
    key: "offer_sprint_v1",
    label: "Offer Sprint",
    deliverable: "Positionierung, Angebotsseite, CTA und Checkout-Ansatz fuer dein erstes verkaufbares Angebot.",
    successCondition: "Angebot, CTA und Checkout-Ansatz sind fachlich nutzbar fertig.",
  },
  validation_sprint_v1: {
    key: "validation_sprint_v1",
    label: "Validation Sprint",
    deliverable: "Problem-Analyse, Konkurrenzbild, Proof-Ziel und klarer Scope fuer den ersten Revenue-Pfad.",
    successCondition: "Problem, Zielkunde und Proof-Ziel sind klar fuer den naechsten Run verdichtet.",
  },
  lead_batch_50_v1: {
    key: "lead_batch_50_v1",
    label: "Lead Engine Batch",
    deliverable: "50 verifizierte Leads mit Zielkunden-Fokus und nutzbarer Ausgangsliste fuer Outreach.",
    successCondition: "50 verifizierte Leads sind fachlich nutzbar abgeschlossen.",
  },
  content_batch_v1: {
    key: "content_batch_v1",
    label: "Content Batch",
    deliverable: "Hooks, Skripte und CTA-Struktur fuer einen ersten Content-Run mit Umsatzbezug.",
    successCondition: "Content-Pack und CTA-Plan sind fachlich nutzbar fertig.",
  },
  publish_action_v1: {
    key: "publish_action_v1",
    label: "Publish Action",
    deliverable: "Ein kontrollierter Versand- oder Publishing-Schritt fuer den naechsten Markt-Test.",
    successCondition: "Eine echte Send- oder Publish-Aktion ist fachlich und technisch abgeschlossen.",
  },
};

const TRACK_SPRINTS: Record<RevenueTrack, AutoBillableProductKey[]> = {
  service_business: ["offer_sprint_v1", "validation_sprint_v1", "lead_batch_50_v1"],
  content_business: ["content_batch_v1", "validation_sprint_v1", "publish_action_v1"],
  software_business: ["validation_sprint_v1", "offer_sprint_v1", "publish_action_v1"],
};

export function buildStartPageModel(input: {
  revenueTrack: RevenueTrack | null;
  availableCredits: number;
  reversedCredits: number;
}): StartPageModel {
  const safetyNotice =
    "Bei technischem Fehler entsteht keine finale Belastung. Retries und Infrastrukturfehler bleiben intern.";
  const revenueTrack = input.revenueTrack ?? "service_business";
  const sprintKeys = TRACK_SPRINTS[revenueTrack];

  return {
    headline: "Drei klare Sprints statt Kreditnebel",
    intro:
      "Du startest hier keine abstrakten Tokens, sondern klare Arbeitspakete mit festem Ergebnisrahmen und sichtbarer Kostenobergrenze.",
    budgetSummary: `${input.availableCredits} Credits aktuell verfuegbar`,
    safetyNotice,
    sprints: sprintKeys.map((key) => ({
      ...SPRINT_DEFINITIONS[key],
      estimatedCredits: getAutoBillableProductCredits(key),
      maxCredits: getAutoBillableProductCredits(key),
      refundPolicy: safetyNotice,
    })),
  };
}
