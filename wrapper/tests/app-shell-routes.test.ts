import { describe, expect, it } from "vitest";
import { buildAppShellModel } from "@/lib/app-shell";

describe("buildAppShellModel", () => {
  it("renders the launch navigation structure", () => {
    const model = buildAppShellModel({
      creditSummary: {
        availableCredits: 120,
        plan: "launch",
      },
      autopilotState: {
        companyId: "cmp_123",
        companyName: "Autopilot GmbH",
        provisioningStatus: "active",
        workspaceStatus: "ready",
        canOpenWorkspace: true,
      },
    });

    expect(model.navigation.map((item) => item.label)).toEqual([
      "Chat",
      "Übersicht",
      "Company HQ",
      "Apps",
      "Connections",
    ]);
  });

  it("shows credit and trial state from server data", () => {
    const model = buildAppShellModel({
      creditSummary: {
        availableCredits: 20,
        plan: "free",
      },
      autopilotState: {
        companyId: null,
        companyName: null,
        provisioningStatus: "not_started",
        workspaceStatus: "locked",
        canOpenWorkspace: false,
      },
    });

    expect(model.status.companyLabel).toBe("Noch keine Company");
    expect(model.status.planLabel).toBe("Free");
    expect(model.status.creditsLabel).toBe("20 Credits");
  });

  it("blocks workspace routes when provisioning is not active", () => {
    const model = buildAppShellModel({
      creditSummary: {
        availableCredits: 20,
        plan: "launch",
      },
      autopilotState: {
        companyId: "cmp_123",
        companyName: "Autopilot GmbH",
        provisioningStatus: "pending",
        workspaceStatus: "provisioning",
        canOpenWorkspace: false,
      },
    });

    expect(model.access).toBe("blocked");
    expect(model.blockedMessage).toContain("Provisioning");
  });
});
