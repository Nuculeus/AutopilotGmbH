import { describe, expect, it } from "vitest";
import { resolveLaunchFlowState } from "@/lib/launch-flow";

describe("resolveLaunchFlowState", () => {
  it("shows company creation CTA when user has credits but no company", () => {
    const flow = resolveLaunchFlowState({
      availableCredits: 20,
      plan: "free",
      hasCompanyHqBriefing: true,
      companyId: null,
      provisioningStatus: "not_started",
      canOpenWorkspace: false,
      hasRunnableLlmConnection: false,
      hasRequiredRevenueConnections: false,
      revenueMilestone: "briefing_ready",
    });

    expect(flow.stage).toBe("briefing_ready");
    expect(flow.canProvisionCompany).toBe(true);
    expect(flow.canOpenWorkspace).toBe(false);
    expect(flow.primaryAction.href).toBe("/api/companies/provision");
  });

  it("shows provisioning state when company creation is pending", () => {
    const flow = resolveLaunchFlowState({
      availableCredits: 20,
      plan: "launch",
      hasCompanyHqBriefing: true,
      companyId: "cmp_123",
      provisioningStatus: "pending",
      canOpenWorkspace: false,
      hasRunnableLlmConnection: false,
      hasRequiredRevenueConnections: false,
      revenueMilestone: "briefing_ready",
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
      hasCompanyHqBriefing: true,
      companyId: "cmp_123",
      provisioningStatus: "active",
      canOpenWorkspace: true,
      hasRunnableLlmConnection: true,
      hasRequiredRevenueConnections: true,
      revenueMilestone: "workspace_ready",
    });

    expect(flow.stage).toBe("workspace_ready");
    expect(flow.canProvisionCompany).toBe(false);
    expect(flow.canOpenWorkspace).toBe(true);
    expect(flow.primaryAction.href).toBe("/app/chat");
  });

  it("blocks workspace until a runnable model path exists", () => {
    const flow = resolveLaunchFlowState({
      availableCredits: 20,
      plan: "starter",
      hasCompanyHqBriefing: true,
      companyId: "cmp_123",
      provisioningStatus: "active",
      canOpenWorkspace: true,
      hasRunnableLlmConnection: false,
      hasRequiredRevenueConnections: false,
      revenueMilestone: "briefing_ready",
    });

    expect(flow.stage).toBe("model_ready");
    expect(flow.primaryAction.href).toBe("/app/connections?preset=openai");
  });
});
