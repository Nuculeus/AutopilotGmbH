export type RevenueTrack =
  | "service_business"
  | "content_business"
  | "software_business";

export type RequiredConnectionId =
  | "llm_any"
  | "stripe"
  | "outreach_channel"
  | "publishing_channel"
  | "deploy_stack";

export type LaunchRevenueMilestone =
  | "briefing_ready"
  | "model_ready"
  | "workspace_ready"
  | "first_value_created"
  | "first_offer_live"
  | "first_checkout_live"
  | "first_revenue_recorded";

type RevenueTrackBlueprint = {
  valueModel: string;
  requiredConnections: RequiredConnectionId[];
  firstActionTitle: string;
  firstActionPrompt: string;
};

const REVENUE_TRACKS = new Set<RevenueTrack>([
  "service_business",
  "content_business",
  "software_business",
]);

const REQUIRED_CONNECTIONS = new Set<RequiredConnectionId>([
  "llm_any",
  "stripe",
  "outreach_channel",
  "publishing_channel",
  "deploy_stack",
]);

const trackBlueprints: Record<RevenueTrack, RevenueTrackBlueprint> = {
  service_business: {
    valueModel:
      "Dienstleistung mit klaren Ergebnissen (Done-for-you oder Done-with-you) und monatlichem Retainer.",
    requiredConnections: ["llm_any", "stripe", "outreach_channel"],
    firstActionTitle: "Erstes zahlbares Service-Angebot starten",
    firstActionPrompt:
      "Formuliere ein konkretes Erstangebot, definiere Lieferumfang in 14 Tagen und erstelle die erste Outreach-Liste mit 20 Zielkontakten.",
  },
  content_business: {
    valueModel:
      "Content Engine mit Reichweite als Input und Leads, Sponsorings oder digitalen Produkten als Monetisierung.",
    requiredConnections: ["llm_any", "publishing_channel"],
    firstActionTitle: "Content-System live schalten",
    firstActionPrompt:
      "Lege eine 14-Tage Content-Serie mit klaren Themenclustern an und veröffentliche den ersten Asset-Entwurf auf dem Zielkanal.",
  },
  software_business: {
    valueModel:
      "Klares Micro-SaaS oder Tool-Angebot mit Subscription oder Setup+Monatsgebühr.",
    requiredConnections: ["llm_any", "stripe", "deploy_stack"],
    firstActionTitle: "Erstes lauffähiges Produktangebot bauen",
    firstActionPrompt:
      "Definiere den kleinsten bezahlbaren Scope, setze eine erste deploybare Version auf und aktiviere einen Checkout-Pfad.",
  },
};

const milestoneOrder: LaunchRevenueMilestone[] = [
  "briefing_ready",
  "model_ready",
  "workspace_ready",
  "first_value_created",
  "first_offer_live",
  "first_checkout_live",
  "first_revenue_recorded",
];

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function includesAny(source: string, needles: string[]) {
  return needles.some((needle) => source.includes(needle));
}

export function normalizeRevenueTrack(value: unknown): RevenueTrack | null {
  return typeof value === "string" && REVENUE_TRACKS.has(value as RevenueTrack)
    ? (value as RevenueTrack)
    : null;
}

export function deriveRevenueTrackFromText(text: string): RevenueTrack {
  const source = text.toLowerCase();

  if (
    includesAny(source, [
      "youtube",
      "content",
      "kanal",
      "newsletter",
      "creator",
      "social",
      "medien",
      "publishing",
    ])
  ) {
    return "content_business";
  }

  if (
    includesAny(source, [
      "saas",
      "software",
      "app",
      "tool",
      "plattform",
      "produkt",
      "template",
      "plugin",
    ])
  ) {
    return "software_business";
  }

  return "service_business";
}

export function normalizeRequiredConnections(value: unknown): RequiredConnectionId[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const unique = new Set<RequiredConnectionId>();

  for (const entry of value) {
    if (typeof entry === "string" && REQUIRED_CONNECTIONS.has(entry as RequiredConnectionId)) {
      unique.add(entry as RequiredConnectionId);
    }
  }

  return Array.from(unique);
}

export function normalizeLaunchRevenueMilestone(
  value: unknown,
): LaunchRevenueMilestone | null {
  return typeof value === "string" &&
    milestoneOrder.includes(value as LaunchRevenueMilestone)
    ? (value as LaunchRevenueMilestone)
    : null;
}

export function getRevenueTrackBlueprint(track: RevenueTrack): RevenueTrackBlueprint {
  return trackBlueprints[track];
}

export function getRequiredConnectionLabel(id: RequiredConnectionId) {
  switch (id) {
    case "llm_any":
      return "LLM-Zugang";
    case "stripe":
      return "Stripe / Zahlungsweg";
    case "outreach_channel":
      return "Outreach-/Kommunikationskanal";
    case "publishing_channel":
      return "Publishing-/Media-Kanal";
    case "deploy_stack":
      return "Deploy-/Produktions-Stack";
  }
}

export function deriveRevenueContext(input: {
  companyGoal: string;
  offer: string;
  audience: string;
  priorities: string;
  track: RevenueTrack | null;
  valueModel: string;
  requiredConnections: RequiredConnectionId[];
  nextMilestone: LaunchRevenueMilestone | null;
}) {
  const inferenceText = [
    input.companyGoal,
    input.offer,
    input.audience,
    input.priorities,
  ]
    .join(" ")
    .trim();
  const resolvedTrack = input.track ?? deriveRevenueTrackFromText(inferenceText);
  const blueprint = getRevenueTrackBlueprint(resolvedTrack);

  return {
    revenueTrack: resolvedTrack,
    valueModel: normalizeText(input.valueModel) || blueprint.valueModel,
    requiredConnections:
      input.requiredConnections.length > 0
        ? input.requiredConnections
        : blueprint.requiredConnections,
    nextMilestone: input.nextMilestone ?? "briefing_ready",
  };
}

export function evaluateRequiredConnections(input: {
  hasLlmConnection: boolean;
  requiredConnections: RequiredConnectionId[];
  secretNames: string[];
}) {
  const normalizedNames = input.secretNames.map((name) => name.toUpperCase());

  const hasStripe = normalizedNames.some((name) => name.includes("STRIPE"));
  const hasOutreachChannel = normalizedNames.some((name) =>
    includesAny(name, [
      "GMAIL",
      "SMTP",
      "TWILIO",
      "WHATSAPP",
      "SLACK",
      "HUBSPOT",
      "CALENDLY",
    ]),
  );
  const hasPublishingChannel = normalizedNames.some((name) =>
    includesAny(name, [
      "YOUTUBE",
      "TIKTOK",
      "INSTAGRAM",
      "X_API",
      "TWITTER",
      "WEBFLOW",
      "WORDPRESS",
      "GHOST",
    ]),
  );
  const hasDeployStack = normalizedNames.some((name) =>
    includesAny(name, [
      "VERCEL",
      "NETLIFY",
      "RAILWAY",
      "RENDER",
      "CLOUDFLARE",
      "AWS",
      "AZURE",
      "GCP",
    ]),
  );

  const missing = input.requiredConnections.filter((connection) => {
    switch (connection) {
      case "llm_any":
        return !input.hasLlmConnection;
      case "stripe":
        return !hasStripe;
      case "outreach_channel":
        return !hasOutreachChannel;
      case "publishing_channel":
        return !hasPublishingChannel;
      case "deploy_stack":
        return !hasDeployStack;
    }
  });

  return {
    hasRequiredConnections: missing.length === 0,
    missingConnections: missing,
  };
}

export function advanceRevenueMilestone(
  baseline: LaunchRevenueMilestone | null,
  target: LaunchRevenueMilestone,
): LaunchRevenueMilestone {
  if (!baseline) {
    return target;
  }

  const baselineIndex = milestoneOrder.indexOf(baseline);
  const targetIndex = milestoneOrder.indexOf(target);

  if (baselineIndex === -1 || targetIndex === -1) {
    return target;
  }

  return targetIndex > baselineIndex ? target : baseline;
}

export function isLaunchMilestoneAtLeast(input: {
  current: LaunchRevenueMilestone | null;
  target: LaunchRevenueMilestone;
}) {
  if (!input.current) {
    return false;
  }

  return milestoneOrder.indexOf(input.current) >= milestoneOrder.indexOf(input.target);
}
