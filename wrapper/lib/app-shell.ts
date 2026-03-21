import { formatPlanLabel, type AutopilotPlan } from "@/lib/credits";
import type { ProvisioningStatus, WorkspaceStatus } from "@/lib/autopilot-metadata";

type ShellInput = {
  currentPath: string;
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

export function buildAppShellModel(input: ShellInput): AppShellModel {
  const canOpenWorkspace = input.autopilotState.canOpenWorkspace;
  const isChatFocus = input.currentPath === "/app/chat";
  const pageCopy = pageCopyForPath(input.currentPath);

  return {
    navigation,
    layoutMode: isChatFocus ? "focus" : "default",
    page: {
      eyebrow: pageCopy.eyebrow,
      title: pageCopy.title,
      description: pageCopy.description,
    },
    access: canOpenWorkspace ? "ready" : "blocked",
    blockedMessage: canOpenWorkspace
      ? null
      : blockedMessageForStatus(input.autopilotState.provisioningStatus),
    status: {
      companyLabel: input.autopilotState.companyName ?? "Noch keine Company",
      planLabel: formatPlanLabel(input.creditSummary.plan),
      creditsLabel: `${input.creditSummary.availableCredits} Credits`,
      provisioningLabel: `${input.autopilotState.provisioningStatus} / ${input.autopilotState.workspaceStatus}`,
    },
    nextStep: pageCopy.nextStep,
    checklist: pageCopy.checklist,
  };
}
