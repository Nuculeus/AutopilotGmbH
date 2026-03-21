import type { AutopilotPlan } from "@/lib/credits";
import type { ProvisioningStatus } from "@/lib/autopilot-metadata";
import { resolveLaunchFlowState } from "@/lib/launch-flow";

export type LaunchEntryStep =
  | "sign_in"
  | "briefing"
  | "billing"
  | "provision"
  | "connections"
  | "provision_pending"
  | "recovery"
  | "workspace";

export type LaunchEntryDecision = {
  step: LaunchEntryStep;
  href: string;
  label: string;
};

type LaunchEntryInput = {
  userId: string | null;
  hasCompanyHqBriefing: boolean;
  hasLlmConnection: boolean;
  availableCredits: number;
  plan: AutopilotPlan;
  companyId: string | null;
  provisioningStatus: ProvisioningStatus;
  canOpenWorkspace: boolean;
};

export function resolveLaunchEntryDecision(
  input: LaunchEntryInput,
): LaunchEntryDecision {
  if (!input.userId) {
    return {
      step: "sign_in",
      href: "/sign-in?redirect_url=%2Flaunch",
      label: "Einloggen und weiter",
    };
  }

  if (!input.companyId && input.provisioningStatus === "not_started" && !input.hasCompanyHqBriefing) {
    return {
      step: "briefing",
      href: "/onboarding",
      label: "Aufbau klarziehen",
    };
  }

  const flow = resolveLaunchFlowState({
    availableCredits: input.availableCredits,
    plan: input.plan,
    companyId: input.companyId,
    provisioningStatus: input.provisioningStatus,
    canOpenWorkspace: input.canOpenWorkspace,
  });

  switch (flow.stage) {
    case "workspace_ready":
      if (!input.hasLlmConnection) {
        return {
          step: "connections",
          href: "/app/connections",
          label: "Modellzugang verbinden",
        };
      }
      return {
        step: "workspace",
        href: "/app/chat",
        label: "Workspace öffnen",
      };
    case "provisioning_failed":
    case "workspace_suspended":
      return {
        step: "recovery",
        href: "/start?entry=recovery",
        label: "Provisioning reparieren",
      };
    case "provisioning_pending":
      return {
        step: "provision_pending",
        href: "/start?entry=pending",
        label: "Provisioning verfolgen",
      };
    case "ready_to_provision":
      return {
        step: "provision",
        href: "/start",
        label: "Firma starten",
      };
    case "needs_access":
    default:
      return {
        step: "billing",
        href: "/start",
        label: "Credits aktivieren",
      };
  }
}
