import type { AutopilotPlan } from "@/lib/credits";
import type { ProvisioningStatus } from "@/lib/autopilot-metadata";
import type { LaunchRevenueMilestone } from "@/lib/revenue-track";

export type LaunchFlowStage =
  | "needs_access"
  | "ready_to_provision"
  | "briefing_ready"
  | "provisioning_pending"
  | "model_ready"
  | "connections_required"
  | "workspace_ready"
  | "first_value_created"
  | "first_offer_live"
  | "first_checkout_live"
  | "first_revenue_recorded"
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
  hasBillingBypass?: boolean;
  hasCompanyHqBriefing: boolean;
  companyId: string | null;
  provisioningStatus: ProvisioningStatus;
  canOpenWorkspace: boolean;
  hasRunnableLlmConnection: boolean;
  hasRequiredRevenueConnections: boolean;
  revenueMilestone: LaunchRevenueMilestone | null;
};

function hasPlanAccess(plan: AutopilotPlan) {
  return plan === "starter" || plan === "pro" || plan === "launch";
}

export function resolveLaunchFlowState(input: LaunchFlowInput): LaunchFlowState {
  const hasBudget =
    input.availableCredits > 0 ||
    hasPlanAccess(input.plan) ||
    input.hasBillingBypass === true;

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

  if (input.canOpenWorkspace && input.companyId && input.provisioningStatus === "active" && !input.hasRunnableLlmConnection) {
    return {
      stage: "model_ready",
      canProvisionCompany: false,
      canOpenWorkspace: false,
      title: "Modellzugang fehlt noch",
      description: "Mindestens ein Agent braucht einen lauffähigen LLM-Pfad, bevor der Workspace ohne Fehlermeldung starten kann.",
      primaryAction: {
        href: "/app/connections?preset=openai",
        label: "LLM verbinden und binden",
      },
    };
  }

  if (input.canOpenWorkspace && input.companyId && input.provisioningStatus === "active" && !input.hasRequiredRevenueConnections) {
    return {
      stage: "connections_required",
      canProvisionCompany: false,
      canOpenWorkspace: false,
      title: "Pflichtverbindungen für deinen Revenue-Track fehlen",
      description: "Verbinde zuerst die track-spezifischen Kernzugänge, damit dein erster Value-Path nicht beim Start blockiert.",
      primaryAction: {
        href: "/app/connections",
        label: "Pflichtverbindungen abschließen",
      },
    };
  }

  if (input.canOpenWorkspace && input.companyId && input.provisioningStatus === "active") {
    const milestone = input.revenueMilestone;
    if (milestone === "first_value_created") {
      return {
        stage: "first_value_created",
        canProvisionCompany: false,
        canOpenWorkspace: true,
        title: "Erster Wert erzeugt",
        description: "Sehr gut. Jetzt Angebot live schalten und den ersten bezahlbaren Pfad abschließen.",
        primaryAction: {
          href: "/app/chat",
          label: "Nächsten Revenue-Schritt starten",
        },
      };
    }

    if (milestone === "first_offer_live") {
      return {
        stage: "first_offer_live",
        canProvisionCompany: false,
        canOpenWorkspace: true,
        title: "Erstes Angebot ist live",
        description: "Als Nächstes Checkout und Zahlungsfluss finalisieren, damit aus Aktivierung echter Umsatz wird.",
        primaryAction: {
          href: "/app/chat",
          label: "Checkout vorbereiten",
        },
      };
    }

    if (milestone === "first_checkout_live") {
      return {
        stage: "first_checkout_live",
        canProvisionCompany: false,
        canOpenWorkspace: true,
        title: "Checkout ist aktiv",
        description: "Nächster Zielzustand ist der erste erfolgreiche Zahlungseingang im Track.",
        primaryAction: {
          href: "/app/chat",
          label: "Erste Zahlung auslösen",
        },
      };
    }

    if (milestone === "first_revenue_recorded") {
      return {
        stage: "first_revenue_recorded",
        canProvisionCompany: false,
        canOpenWorkspace: true,
        title: "Erster Umsatz verbucht",
        description: "Jetzt die nächsten wiederholbaren Revenue-Loops ausbauen und den Betrieb stabilisieren.",
        primaryAction: {
          href: "/app/chat",
          label: "Revenue-Loop ausbauen",
        },
      };
    }

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
      stage: input.hasCompanyHqBriefing ? "briefing_ready" : "ready_to_provision",
      canProvisionCompany: true,
      canOpenWorkspace: false,
      title: input.hasCompanyHqBriefing ? "Briefing steht. Company kann jetzt erstellt werden." : "Company kann jetzt erstellt werden",
      description: input.hasCompanyHqBriefing
        ? "Der Kern ist geklärt. Als Nächstes erstellen wir die Company und den stabilen Bridge-Principal."
        : "Credits oder Plan sind vorhanden. Als Nächstes erstellen wir die Company und den stabilen Bridge-Principal.",
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
