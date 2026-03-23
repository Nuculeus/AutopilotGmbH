import { formatPlanLabel, type AutopilotPlan } from "@/lib/credits";
import type { ProvisioningStatus, WorkspaceStatus } from "@/lib/autopilot-metadata";
import {
  hasStoredCompanyHqBriefing,
  type CompanyHqProfile,
} from "@/lib/company-hq";
import {
  getRequiredConnectionLabel,
  isLaunchMilestoneAtLeast,
  type RequiredConnectionId,
} from "@/lib/revenue-track";
import type { AutopilotLlmReadinessMetadata } from "@/lib/llm-readiness";
import { applyServiceEngineProfileDefaults, buildServiceEnginePath } from "@/lib/service-engine";

type ShellInput = {
  currentPath: string;
  companyHqProfile: CompanyHqProfile;
  hasRunnableLlmConnection: boolean;
  llmReadiness?: AutopilotLlmReadinessMetadata;
  hasRequiredRevenueConnections?: boolean;
  missingRequiredConnections?: string[];
  creditSummary: {
    availableCredits: number;
    plan: AutopilotPlan;
  };
  autopilotState: {
    companyId: string | null;
    companyName: string | null;
    provisioningStatus: ProvisioningStatus;
    workspaceStatus: WorkspaceStatus;
    canOpenWorkspace: boolean;
  };
};

export type AppNavigationItem = {
  label: string;
  href: string;
};

export type AppShellModel = {
  navigation: AppNavigationItem[];
  layoutMode: "default" | "focus";
  page: {
    eyebrow: string;
    title: string;
    description: string;
  };
  access: "ready" | "blocked";
  blockedMessage: string | null;
  status: {
    companyLabel: string;
    planLabel: string;
    creditsLabel: string;
    provisioningLabel: string;
  };
  nextStep: {
    title: string;
    href: string;
    description: string;
  };
  checklist: string[];
  workspaceHandoff: {
    headline: string;
    summary: string;
    highlights: Array<{
      label: string;
      value: string;
    }>;
    actions: Array<{
      label: string;
      href: string;
      method?: "GET" | "POST";
      payload?: Record<string, string>;
    }>;
  } | null;
};

const navigation: AppNavigationItem[] = [
  { label: "Chat", href: "/app/chat" },
  { label: "Übersicht", href: "/app/overview" },
  { label: "Company HQ", href: "/app/company-hq" },
  { label: "Apps", href: "/app/apps" },
  { label: "Connections", href: "/app/connections" },
];

function pageCopyForPath(currentPath: string) {
  switch (currentPath) {
    case "/app/chat":
      return {
        eyebrow: "Launch Workspace",
        title: "Operativer Arbeitsbereich",
        description:
          "Die native Launch-Shell rahmt die nächsten produktiven Bereiche ein und schafft die deutsche Betriebsoberfläche.",
        nextStep: {
          title: "Unternehmenswissen festhalten",
          href: "/app/company-hq",
          description:
            "Lege Ziele, Positionierung und Kernwissen an, damit deine Operatoren sinnvoll arbeiten koennen.",
        },
        checklist: [
          "Firma aktiv",
          "Workspace verbunden",
          "Nächster Schritt: Unternehmenswissen hinterlegen",
        ],
      };
    case "/app/company-hq":
      return {
        eyebrow: "Company HQ",
        title: "Baue das Fundament deiner Firma",
        description:
          "Halte Ziel, Angebot, Zielgruppe und Prioritäten einmal klar fest, damit deine Firma konsistent arbeiten kann.",
        nextStep: {
          title: "Erste Verbindungen anschließen",
          href: "/app/connections",
          description:
            "Verbinde im nächsten Schritt genau die Werkzeuge, die deine Firma sofort handlungsfähig machen.",
        },
        checklist: [
          "Angebot klären",
          "Zielgruppe benennen",
          "Prioritäten festhalten",
        ],
      };
    case "/app/connections":
      return {
        eyebrow: "Connections",
        title: "Verbinde die ersten Werkzeuge",
        description:
          "Starte mit den Verbindungen, die direkten Nutzen bringen: Zahlungsweg, Modellzugang und Arbeitskonto.",
        nextStep: {
          title: "Ersten Baustein starten",
          href: "/app/apps",
          description:
            "Wenn die wichtigsten Zugänge stehen, kannst du daraus den ersten operativen Baustein starten.",
        },
        checklist: [
          "Zahlungsweg wählen",
          "Modellzugang hinterlegen",
          "Arbeitskonto verbinden",
        ],
      };
    case "/app/apps":
      return {
        eyebrow: "Starter Apps",
        title: "Starte den ersten Baustein",
        description:
          "Wähle einen einfachen, launch-sicheren Startpunkt statt sofort eine große Plattform zu konfigurieren.",
        nextStep: {
          title: "Im Workspace ausführen",
          href: "/app/chat",
          description:
            "Starte den gewählten Baustein im Workspace und lasse die Firma den ersten Output erzeugen.",
        },
        checklist: [
          "Startbaustein wählen",
          "Kickoff im Chat auslösen",
          "Erste Ergebnisse prüfen",
        ],
      };
    default:
      return {
        eyebrow: "Launch Workspace",
        title: "Operativer Arbeitsbereich",
        description:
          "Die native Launch-Shell rahmt die nächsten produktiven Bereiche ein und schafft die deutsche Betriebsoberfläche.",
        nextStep: {
          title: "Credits oder Plan aktivieren",
          href: "/start",
          description:
            "Pruefe Launch-Credits, Plan und Provisioning, bevor du tiefer in den Workspace gehst.",
        },
        checklist: [
          "Executive plan created",
          "Connect Stripe",
          "Set up your dashboard",
          "First app deployment",
        ],
      };
  }
}

function buildWorkspaceHandoff(profile: CompanyHqProfile) {
  const normalizedProfile = applyServiceEngineProfileDefaults(profile);
  const hasBriefing = hasStoredCompanyHqBriefing(normalizedProfile);

  if (!hasBriefing) {
    return {
      page: {
        eyebrow: "Launch Workspace",
        title: "Operativer Arbeitsbereich",
        description:
          "Die native Launch-Shell rahmt die nächsten produktiven Bereiche ein und schafft die deutsche Betriebsoberfläche.",
      },
      nextStep: {
        title: "Unternehmenswissen festhalten",
        href: "/app/company-hq",
        description:
          "Lege Ziele, Positionierung und Kernwissen an, damit deine Operatoren sinnvoll arbeiten koennen.",
      },
      checklist: [
        "Firma aktiv",
        "Workspace verbunden",
        "Nächster Schritt: Unternehmenswissen hinterlegen",
      ],
      handoff: {
        headline: "Firma aktiv. Workspace verbunden.",
        summary:
          "Als Nächstes Unternehmenswissen festhalten oder Verbindungen anschließen.",
        highlights: [],
        actions: [
          { label: "Company HQ", href: "/app/company-hq" },
          { label: "Verbindungen", href: "/app/connections" },
        ],
      },
    };
  }

  const hasFirstValue = isLaunchMilestoneAtLeast({
    current: normalizedProfile.nextMilestone,
    target: "first_value_created",
  });
  const hasFirstOffer = isLaunchMilestoneAtLeast({
    current: normalizedProfile.nextMilestone,
    target: "first_offer_live",
  });
  const hasCheckoutLive = isLaunchMilestoneAtLeast({
    current: normalizedProfile.nextMilestone,
    target: "first_checkout_live",
  });
  const hasFirstRevenue = isLaunchMilestoneAtLeast({
    current: normalizedProfile.nextMilestone,
    target: "first_revenue_recorded",
  });
  const servicePath =
    normalizedProfile.revenueTrack === "service_business"
      ? buildServiceEnginePath(normalizedProfile)
      : null;

  const nextTitle = servicePath?.title ?? (hasFirstRevenue
    ? "Revenue-Loop ausbauen"
    : hasCheckoutLive
      ? "Ersten Umsatz bestätigen"
      : hasFirstOffer
        ? "Checkout live schalten"
        : hasFirstValue
          ? "Angebot live markieren"
          : "Ersten Value-Path starten");
  const nextHref = servicePath ? "/app/chat" : (hasFirstRevenue
    ? "/app/chat"
    : hasCheckoutLive
      ? "/launch"
      : hasFirstOffer
        ? "/api/stripe/checkout"
        : hasFirstValue
          ? "/app/chat"
          : "/app/chat");
  const nextDescription = servicePath?.description ?? (hasFirstRevenue
    ? "Erster Umsatz ist verbucht. Jetzt aus einem Treffer ein wiederholbares System machen."
    : hasCheckoutLive
      ? "Checkout ist aktiv. Als Nächstes den ersten erfolgreichen Zahlungseingang absichern."
      : hasFirstOffer
        ? "Dein Angebot ist live. Jetzt den Checkout-Pfad für den ersten Zahlungseingang aktivieren."
      : hasFirstValue
        ? "Du hast bereits ersten Wert erzeugt. Jetzt das Angebot offiziell live schalten."
        : normalizedProfile.valueModel);
  const progressChecklist = servicePath
    ? [
        "Briefing gespeichert",
        "Workspace verbunden",
        servicePath.checklistTail,
      ]
    : hasFirstRevenue
    ? ["Briefing gespeichert", "Checkout aktiv", "Erster Umsatz verbucht"]
    : hasCheckoutLive
      ? ["Briefing gespeichert", "Angebot live", "Checkout aktiv"]
      : hasFirstOffer
        ? ["Briefing gespeichert", "Erster Wert erzeugt", "Angebot live"]
        : hasFirstValue
          ? ["Briefing gespeichert", "Workspace verbunden", "Erster Wert erzeugt"]
          : ["Briefing gespeichert", "Workspace verbunden", "Nächster Schritt: Ersten Wert erzeugen"];
  const progressActions = servicePath?.actions ?? (hasFirstRevenue
    ? [
        { label: "Revenue-Loop planen", href: "/app/chat" },
        { label: "Connections prüfen", href: "/app/connections" },
      ]
    : hasCheckoutLive
      ? [
          { label: "Launch-Status öffnen", href: "/launch" },
          { label: "Im Workspace weiter", href: "/app/chat" },
        ]
      : hasFirstOffer
        ? [
            { label: "Checkout starten", href: "/api/stripe/checkout", method: "POST" as const },
            { label: "Angebot prüfen", href: "/app/company-hq" },
          ]
      : hasFirstValue
        ? [
            {
              label: "Angebot live markieren",
              href: "/api/revenue/events",
              method: "POST" as const,
              payload: {
                event: "first_offer_live",
              },
            },
            { label: "Connections prüfen", href: "/app/connections" },
          ]
      : [
          {
            label: "Ersten Wert markieren",
            href: "/api/revenue/events",
            method: "POST" as const,
            payload: {
              event: "first_value_created",
              summary: "Erster wertvoller Output im Workspace erzeugt.",
            },
            },
          { label: "Firmenprofil prüfen", href: "/app/company-hq" },
        ]);

  return {
    page: {
      eyebrow: "Launch Workspace",
      title: "Dein Arbeitsbereich ist bereit",
      description:
        "Dein Profil steht. Jetzt setzt du daraus die ersten operativen Schritte, Verbindungen und Ergebnisse um.",
    },
    nextStep: {
      title: nextTitle,
      href: nextHref,
      description: nextDescription,
    },
    checklist: progressChecklist,
    handoff: {
      headline: "Deine Richtung steht. Jetzt geht es in die Ausführung.",
      summary:
        normalizedProfile.revenueTrack === "service_business"
          ? "Du startest nicht mehr bei null. Der Workspace führt dich jetzt durch Offer-Asset, Angebot, Checkout und den ersten Zahlungseingang."
          : "Du startest nicht mehr bei null. Der Workspace übernimmt jetzt Revenue-Track, Angebot und die nächsten operativen Schritte.",
      highlights: [
        { label: "Angebot", value: normalizedProfile.offer },
        { label: "Zielgruppe", value: normalizedProfile.audience },
        {
          label: "Revenue-Track",
          value:
            normalizedProfile.revenueTrack === "content_business"
              ? "Content Business"
              : normalizedProfile.revenueTrack === "software_business"
                ? "Software Business"
                : "Service Business",
        },
        {
          label: normalizedProfile.revenueTrack === "service_business" ? "Proof-Ziel" : "Nächster Fokus",
          value:
            normalizedProfile.revenueTrack === "service_business"
              ? normalizedProfile.proofTarget
              : normalizedProfile.priorities,
        },
      ],
      actions: progressActions,
    },
  };
}

function blockedMessageForStatus(status: ProvisioningStatus) {
  switch (status) {
    case "pending":
      return "Provisioning läuft noch. Die operative Oberfläche wird freigeschaltet, sobald Company, Skills und Bridge-Principal aktiv sind.";
    case "failed":
      return "Provisioning ist fehlgeschlagen. Bitte gehe zurück in den Startfluss und starte die Company erneut.";
    case "suspended":
      return "Der Workspace ist derzeit gesperrt. Bitte prüfe Billing, Credits oder Compliance-Hinweise.";
    default:
      return "Der Workspace ist noch nicht freigeschaltet. Starte zuerst die Company-Provisionierung.";
  }
}

function blockedMessageForMissingLlm() {
  return "Bevor deine Operatoren arbeiten koennen, braucht mindestens ein Agent einen lauffähigen LLM-Pfad mit gebundenem Secret (z. B. OpenAI oder Anthropic).";
}

function blockedMessageForUnverifiedLlm(input: {
  summary: string;
  checkedAt: string | null;
}) {
  const checkedAtLabel = input.checkedAt
    ? `Letzter Check: ${new Date(input.checkedAt).toLocaleString("de-DE")}.`
    : "Noch kein erfolgreicher Check aufgezeichnet.";
  return `LLM-Zugang ist noch nicht als bereit verifiziert. Fuehre den LLM-Readiness-Check in Connections aus, bis der Status auf bereit steht. ${checkedAtLabel} ${input.summary}`;
}

function blockedMessageForMissingRequiredConnections(missingRequiredConnections: string[]) {
  const missingLabels = missingRequiredConnections
    .map((connection) => getRequiredConnectionLabel(connection as RequiredConnectionId))
    .join(", ");

  return `Vor dem ersten produktiven Lauf fehlen noch Pflichtverbindungen für deinen Revenue-Track: ${missingLabels}.`;
}

export function buildAppShellModel(input: ShellInput): AppShellModel {
  const canOpenWorkspace = input.autopilotState.canOpenWorkspace;
  const isChatFocus = input.currentPath === "/app/chat";
  const llmReadiness = input.llmReadiness ?? {
    status: "blocked" as const,
    summary: "Noch kein verifizierter LLM-Check vorhanden.",
    checkedAt: null,
    probedAdapterType: null,
  };
  const pageCopy = isChatFocus
    ? buildWorkspaceHandoff(input.companyHqProfile)
    : pageCopyForPath(input.currentPath);
  const needsLlmConnection = isChatFocus && canOpenWorkspace && !input.hasRunnableLlmConnection;
  const needsLlmReadiness =
    isChatFocus &&
    canOpenWorkspace &&
    input.hasRunnableLlmConnection &&
    llmReadiness.status !== "ready";
  const needsRequiredConnections =
    isChatFocus &&
    canOpenWorkspace &&
    input.hasRunnableLlmConnection &&
    llmReadiness.status === "ready" &&
    !(input.hasRequiredRevenueConnections ?? true);
  const access =
    needsLlmConnection || needsLlmReadiness || needsRequiredConnections
      ? "blocked"
      : canOpenWorkspace
        ? "ready"
        : "blocked";
  const blockedMessage = needsLlmConnection
    ? blockedMessageForMissingLlm()
    : needsLlmReadiness
      ? blockedMessageForUnverifiedLlm({
          summary: llmReadiness.summary,
          checkedAt: llmReadiness.checkedAt,
        })
    : needsRequiredConnections
      ? blockedMessageForMissingRequiredConnections(input.missingRequiredConnections ?? [])
      : canOpenWorkspace
        ? null
        : blockedMessageForStatus(input.autopilotState.provisioningStatus);
  const nextStep = needsLlmConnection
    ? {
        title: "Modellzugang verbinden",
        href: "/app/connections?preset=openai",
        description:
          "Wähle jetzt deinen bevorzugten LLM-Zugang aus und hinterlege den API-Key, damit CEO und Operatoren sofort lauffähig sind.",
      }
    : needsLlmReadiness
      ? {
          title: "LLM-Readiness prüfen",
          href: "/app/connections?preset=openai",
          description:
            "Die Verbindung ist gespeichert, aber noch nicht als lauffähig verifiziert. Führe den Readiness-Check aus, bevor der Workspace startet.",
        }
    : needsRequiredConnections
      ? {
          title: "Pflichtverbindungen abschließen",
          href: "/app/connections",
          description:
            "Verbinde jetzt die verbleibenden Kernzugänge für deinen Revenue-Track, damit der erste Wertpfad ohne Friktion läuft.",
        }
    : pageCopy.nextStep;

  return {
    navigation,
    layoutMode: isChatFocus ? "focus" : "default",
    page: {
      eyebrow: "page" in pageCopy ? pageCopy.page.eyebrow : pageCopy.eyebrow,
      title: "page" in pageCopy ? pageCopy.page.title : pageCopy.title,
      description: "page" in pageCopy ? pageCopy.page.description : pageCopy.description,
    },
    access,
    blockedMessage,
    status: {
      companyLabel: input.autopilotState.companyName ?? "Noch keine Company",
      planLabel: formatPlanLabel(input.creditSummary.plan),
      creditsLabel: `${input.creditSummary.availableCredits} Credits`,
      provisioningLabel: `${input.autopilotState.provisioningStatus} / ${input.autopilotState.workspaceStatus}`,
    },
    nextStep,
    checklist: pageCopy.checklist,
    workspaceHandoff: "handoff" in pageCopy ? pageCopy.handoff : null,
  };
}
