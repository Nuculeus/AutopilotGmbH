import { describe, expect, it } from "vitest";
import { resolveLaunchFlowState } from "@/lib/launch-flow";

describe("resolveLaunchFlowState", () => {
  it("shows company creation CTA when user has credits but no company", () => {
    const flow = resolveLaunchFlowState({
      availableCredits: 20,
      plan: "free",
      companyId: null,
      provisioningStatus: "not_started",
      canOpenWorkspace: false,
    });

    expect(flow.stage).toBe("ready_to_provision");
    expect(flow.canProvisionCompany).toBe(true);
    expect(flow.canOpenWorkspace).toBe(false);
    expect(flow.primaryAction.href).toBe("/api/companies/provision");
  });

  it("shows provisioning state when company creation is pending", () => {
    const flow = resolveLaunchFlowState({
      availableCredits: 20,
      plan: "launch",
      companyId: "cmp_123",
      provisioningStatus: "pending",
      canOpenWorkspace: false,
    });

    expect(flow.stage).toBe("provisioning_pending");
    expect(flow.canProvisionCompany).toBe(false);
    expect(flow.canOpenWorkspace).toBe(false);
    expect(flow.primaryAction.label).toContain("Provisioning");
  });

  it("offers workspace entry only when company status is active", () => {
    const flow = resolveLaunchFlowState({
      availableCredits: 20,
      plan: "starter",
      companyId: "cmp_123",
      provisioningStatus: "active",
      canOpenWorkspace: true,
    });

    expect(flow.stage).toBe("workspace_ready");
    expect(flow.canProvisionCompany).toBe(false);
    expect(flow.canOpenWorkspace).toBe(true);
    expect(flow.primaryAction.href).toBe("/app/chat");
  });
});
