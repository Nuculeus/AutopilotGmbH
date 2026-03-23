import type { CompanyHqProfile } from "@/lib/company-hq";
import type { LaunchRevenueMilestone } from "@/lib/revenue-track";

type ServiceEngineAction = {
  label: string;
  href: string;
  method?: "GET" | "POST";
  payload?: Record<string, string>;
};

type ServiceEnginePath = {
  title: string;
  description: string;
  checklistTail: string;
  actions: ServiceEngineAction[];
};

type ServiceStarterTemplate = {
  id: string;
  title: string;
  description: string;
  kickoffPrompt: string;
};

const SERVICE_ENGINE_DEFAULTS = {
  proofTarget: "Erster zahlender Pilotkunde in 14 Tagen.",
  acquisitionChannel: "Outbound + Referral + Demo-Call",
  paymentNode: "Stripe Checkout Link",
  deliveryNode: "Kickoff-Call + 14-Tage-Umsetzung",
} as const;

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function serviceOfferLabel(profile: CompanyHqProfile) {
  return normalizeText(profile.offer) || "dein erstes Service-Angebot";
}

export function applyServiceEngineProfileDefaults(profile: CompanyHqProfile): CompanyHqProfile {
  if (profile.revenueTrack !== "service_business") {
    return profile;
  }

  return {
    ...profile,
    proofTarget: normalizeText(profile.proofTarget) || SERVICE_ENGINE_DEFAULTS.proofTarget,
    acquisitionChannel:
      normalizeText(profile.acquisitionChannel) || SERVICE_ENGINE_DEFAULTS.acquisitionChannel,
    paymentNode: normalizeText(profile.paymentNode) || SERVICE_ENGINE_DEFAULTS.paymentNode,
    deliveryNode: normalizeText(profile.deliveryNode) || SERVICE_ENGINE_DEFAULTS.deliveryNode,
  };
}

export function buildServiceEnginePath(profile: CompanyHqProfile): ServiceEnginePath {
  const normalizedProfile = applyServiceEngineProfileDefaults(profile);
  const milestone = normalizedProfile.nextMilestone as LaunchRevenueMilestone | null;

  switch (milestone) {
    case "first_revenue_recorded":
      return {
        title: "Revenue-Loop ausbauen",
        description:
          "Der erste Umsatz ist verifiziert. Jetzt wird aus deinem ersten Service-Fall ein wiederholbarer Vertriebspfad.",
        checklistTail: "Nächster Schritt: Gewinnerpfad wiederholen",
        actions: [
          { label: "Nächsten Sprint planen", href: "/app/chat" },
          { label: "Connections prüfen", href: "/app/connections" },
        ],
      };
    case "first_checkout_live":
      return {
        title: "Ersten Umsatz verifizieren",
        description:
          "Checkout ist aktiv. Jetzt geht es darum, den ersten erfolgreichen Zahlungseingang sauber im Revenue-Loop zu verbuchen.",
        checklistTail: "Nächster Schritt: Zahlungseingang absichern",
        actions: [
          { label: "Launch-Status öffnen", href: "/launch" },
          { label: "Im Workspace weiter", href: "/app/chat" },
        ],
      };
    case "first_offer_live":
      return {
        title: "Checkout aktivieren",
        description:
          "Dein Service-Angebot ist teilbar und klar genug. Jetzt aktivierst du den Zahlungsweg für den ersten zahlenden Kunden.",
        checklistTail: "Nächster Schritt: Checkout aktivieren",
        actions: [
          { label: "Checkout aktivieren", href: "/api/stripe/checkout", method: "POST" },
          { label: "Angebot prüfen", href: "/app/company-hq" },
        ],
      };
    case "first_value_created":
      return {
        title: "Service-Angebot live stellen",
        description:
          "Das Proof-Asset steht. Jetzt machst du aus der internen Delivery ein klares, extern teilbares Service-Angebot.",
        checklistTail: "Nächster Schritt: Service-Angebot live stellen",
        actions: [
          {
            label: "Service-Angebot live stellen",
            href: "/api/revenue/events",
            method: "POST",
            payload: {
              event: "first_offer_live",
            },
          },
          { label: "Connections prüfen", href: "/app/connections" },
        ],
      };
    default:
      return {
        title: "Erstes Offer-Asset erzeugen",
        description:
          "Bevor du verkaufst, brauchst du ein klares Proof-Asset: Angebot, Nutzen, CTA und Lieferbild müssen in einer nutzbaren Form stehen.",
        checklistTail: "Nächster Schritt: Proof-Asset fertigstellen",
        actions: [
          {
            label: "Proof-Asset fertigstellen",
            href: "/api/revenue/events",
            method: "POST",
            payload: {
              event: "first_value_created",
            },
          },
          { label: "Firmenprofil prüfen", href: "/app/company-hq" },
        ],
      };
  }
}

export function defaultServiceRevenueSummary(input: {
  event:
    | "first_value_created"
    | "offer_live"
    | "checkout_live"
    | "revenue_recorded"
    | "payment_failed";
  profile: CompanyHqProfile;
}) {
  const offerLabel = serviceOfferLabel(input.profile);

  switch (input.event) {
    case "first_value_created":
      return `Offer-Asset fertiggestellt: ${offerLabel}.`;
    case "offer_live":
      return `Service-Angebot live gestellt: ${offerLabel}.`;
    case "checkout_live":
      return `Checkout aktiviert für ${offerLabel}.`;
    case "revenue_recorded":
      return `Erster Umsatz verifiziert für ${offerLabel}.`;
    case "payment_failed":
      return `Checkout fehlgeschlagen für ${offerLabel}.`;
  }
}

export function buildServiceStarterTemplates(profile: CompanyHqProfile): ServiceStarterTemplate[] {
  const normalizedProfile = applyServiceEngineProfileDefaults(profile);
  const offerLabel = serviceOfferLabel(normalizedProfile);
  const audienceLabel = normalizeText(normalizedProfile.audience) || "deine Zielkunden";

  return [
    {
      id: "service-offer-proof",
      title: "Offer-Asset",
      description: "Verdichte Nutzen, Proof und CTA zu einem verkaufbaren Erstangebot.",
      kickoffPrompt: `Erstelle ein deutsches Offer-Asset für ${offerLabel} mit klarem Nutzen, Proof-Bausteinen und einem starken CTA für ${audienceLabel}.`,
    },
    {
      id: "pilot-outreach",
      title: "Pilotkunden-Shortlist",
      description: "Baue die erste Liste qualifizierter Kontakte für den schnellsten Vertriebsstart.",
      kickoffPrompt: `Erstelle eine Pilotkunden-Shortlist mit 20 passenden Kontakten für ${audienceLabel} und leite drei Outreach-Angles für ${offerLabel} ab.`,
    },
    {
      id: "checkout-activation",
      title: "Checkout-Aktivierung",
      description: "Mache den Zahlungsweg und die Delivery für den ersten Kunden sofort verständlich.",
      kickoffPrompt: `Leite aus ${offerLabel} einen einfachen Stripe-Checkout-Pfad, eine Deliverable-Zusammenfassung und die ersten Onboarding-Schritte ab.`,
    },
  ];
}
