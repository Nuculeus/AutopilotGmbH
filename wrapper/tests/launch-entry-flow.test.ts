import { describe, expect, it } from "vitest";
import { resolveLaunchEntryDecision } from "@/lib/launch-entry";

describe("resolveLaunchEntryDecision", () => {
  it("lets a new user move from sign-in to start flow and finally into the workspace", () => {
    const unauthenticated = resolveLaunchEntryDecision({
      userId: null,
      hasCompanyHqBriefing: false,
      hasLlmConnection: false,
      availableCredits: 0,
      plan: "free",
      companyId: null,
      provisioningStatus: "not_started",
      canOpenWorkspace: false,
    });

    expect(unauthenticated.step).toBe("sign_in");
    expect(unauthenticated.href).toContain("/sign-in");

    const readyToProvision = resolveLaunchEntryDecision({
      userId: "user_123",
      hasCompanyHqBriefing: true,
      hasLlmConnection: false,
      availableCredits: 120,
      plan: "launch",
      companyId: null,
      provisioningStatus: "not_started",
      canOpenWorkspace: false,
    });

    expect(readyToProvision.step).toBe("provision");
    expect(readyToProvision.href).toBe("/start");

    const workspaceReady = resolveLaunchEntryDecision({
      userId: "user_123",
      hasCompanyHqBriefing: true,
      hasLlmConnection: true,
      availableCredits: 118,
      plan: "launch",
      companyId: "cmp_123",
      provisioningStatus: "active",
      canOpenWorkspace: true,
    });

    expect(workspaceReady.step).toBe("workspace");
    expect(workspaceReady.href).toBe("/app/chat");
  });

  it("sends a paid user without a company into provisioning before workspace access", () => {
    const decision = resolveLaunchEntryDecision({
      userId: "user_123",
      hasCompanyHqBriefing: true,
      hasLlmConnection: false,
      availableCredits: 50,
      plan: "starter",
      companyId: null,
      provisioningStatus: "not_started",
      canOpenWorkspace: false,
    });

    expect(decision.step).toBe("provision");
    expect(decision.href).toBe("/start");
  });

  it("keeps a failed provisioning user on wrapper-owned recovery UI", () => {
    const decision = resolveLaunchEntryDecision({
      userId: "user_123",
      hasCompanyHqBriefing: true,
      hasLlmConnection: false,
      availableCredits: 20,
      plan: "launch",
      companyId: null,
      provisioningStatus: "failed",
      canOpenWorkspace: false,
    });

    expect(decision.step).toBe("recovery");
    expect(decision.href).toBe("/start?entry=recovery");
  });

  it("routes a signed-in user without a saved briefing into guided onboarding before provisioning", () => {
    const decision = resolveLaunchEntryDecision({
      userId: "user_123",
      hasCompanyHqBriefing: false,
      hasLlmConnection: false,
      availableCredits: 120,
      plan: "launch",
      companyId: null,
      provisioningStatus: "not_started",
      canOpenWorkspace: false,
    });

    expect(decision.step).toBe("briefing");
    expect(decision.href).toBe("/onboarding");
  });

  it("routes a provisioned user without an llm connection into connections before workspace", () => {
    const decision = resolveLaunchEntryDecision({
      userId: "user_123",
      hasCompanyHqBriefing: true,
      hasLlmConnection: false,
      availableCredits: 118,
      plan: "launch",
      companyId: "cmp_123",
      provisioningStatus: "active",
      canOpenWorkspace: true,
    });

    expect(decision.step).toBe("connections");
    expect(decision.href).toBe("/app/connections");
  });
});
