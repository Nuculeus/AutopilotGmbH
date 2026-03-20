import type { AutopilotPlan } from "@/lib/credits";
import type { ProvisioningStatus } from "@/lib/autopilot-metadata";

export type LaunchFlowStage =
  | "needs_access"
  | "ready_to_provision"
  | "provisioning_pending"
  | "workspace_ready"
  | "provisioning_failed"
  | "workspace_suspended";

export type LaunchFlowAction = {
  href: string;
  label: string;
  method?: "GET" | "POST";
};

export type LaunchFlowState = {
  stage: LaunchFlowStage;
  canProvisionCompany: boolean;
  canOpenWorkspace: boolean;
  title: string;
  description: string;
  primaryAction: LaunchFlowAction;
};

export type LaunchFlowInput = {
  availableCredits: number;
  plan: AutopilotPlan;
  companyId: string | null;
  provisioningStatus: ProvisioningStatus;
  canOpenWorkspace: boolean;
};

function hasPlanAccess(plan: AutopilotPlan) {
  return plan === "starter" || plan === "pro" || plan === "launch";
}

export function resolveLaunchFlowState(input: LaunchFlowInput): LaunchFlowState {
  const hasBudget = input.availableCredits > 0 || hasPlanAccess(input.plan);

  if (input.provisioningStatus === "failed") {
    return {
      stage: "provisioning_failed",
      canProvisionCompany: hasBudget,
      canOpenWorkspace: false,
      title: "Provisioning braucht einen neuen Versuch",
      description: "Die Company wurde noch nicht sauber angelegt. Retry und Support bleiben vorerst in der Wrapper-Schicht.",
      primaryAction: {
        href: "/api/companies/provision",
        label: "Provisioning erneut starten",
        method: "POST",
      },
    };
  }

  if (input.provisioningStatus === "suspended") {
    return {
      stage: "workspace_suspended",
      canProvisionCompany: false,
      canOpenWorkspace: false,
      title: "Workspace vorübergehend gesperrt",
      description: "Billing oder Compliance blockiert den operativen Zugriff. Die Klärung bleibt im Wrapper.",
      primaryAction: {
        href: "/start",
        label: "Status prüfen",
      },
    };
  }

  if (input.provisioningStatus === "pending" || (input.companyId && !input.canOpenWorkspace)) {
    return {
      stage: "provisioning_pending",
      canProvisionCompany: false,
      canOpenWorkspace: false,
      title: "Provisioning läuft",
      description: "Paperclip bootstrapped gerade deine Company, die Skills und den stabilen Bridge-Principal.",
      primaryAction: {
        href: "/start",
        label: "Provisioning Status ansehen",
      },
    };
  }

  if (input.canOpenWorkspace && input.companyId && input.provisioningStatus === "active") {
    return {
      stage: "workspace_ready",
      canProvisionCompany: false,
      canOpenWorkspace: true,
      title: "Workspace ist bereit",
      description: "Die Company ist aktiv und kann jetzt über die Wrapper-Shell in den operativen Bereich wechseln.",
      primaryAction: {
        href: "/app/chat",
        label: "Workspace öffnen",
      },
    };
  }

  if (hasBudget) {
    return {
      stage: "ready_to_provision",
      canProvisionCompany: true,
      canOpenWorkspace: false,
      title: "Company kann jetzt erstellt werden",
      description: "Credits oder Plan sind vorhanden. Als Nächstes erstellen wir die Company und den stabilen Bridge-Principal.",
      primaryAction: {
        href: "/api/companies/provision",
        label: "Firma jetzt bootstrappen",
        method: "POST",
      },
    };
  }

  return {
    stage: "needs_access",
    canProvisionCompany: false,
    canOpenWorkspace: false,
    title: "Zuerst Credits oder Plan aktivieren",
    description: "Ohne Credits oder aktiven Plan starten wir noch keine Company, damit Launch-Nutzer sauber durch Billing und Limits geführt werden.",
    primaryAction: {
      href: "/api/stripe/checkout",
      label: "Starter Checkout starten",
      method: "POST",
    },
  };
}
