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

  return {
    navigation,
    layoutMode: isChatFocus ? "focus" : "default",
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
    nextStep: isChatFocus
      ? {
          title: "Unternehmenswissen festhalten",
          href: "/app/company-hq",
          description:
            "Lege Ziele, Positionierung und Kernwissen an, damit deine Operatoren sinnvoll arbeiten koennen.",
        }
      : {
          title: "Credits oder Plan aktivieren",
          href: "/start",
          description:
            "Pruefe Launch-Credits, Plan und Provisioning, bevor du tiefer in den Workspace gehst.",
        },
    checklist: isChatFocus
      ? [
          "Firma aktiv",
          "Workspace verbunden",
          "Nächster Schritt: Unternehmenswissen hinterlegen",
        ]
      : [
          "Executive plan created",
          "Connect Stripe",
          "Set up your dashboard",
          "First app deployment",
        ],
  };
}
