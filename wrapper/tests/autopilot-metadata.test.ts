import { describe, expect, it } from "vitest";
import { summarizeAutopilotState } from "@/lib/autopilot-metadata";

describe("summarizeAutopilotState", () => {
  it("starts users in free trial state with no company", () => {
    const state = summarizeAutopilotState({});

    expect(state.companyId).toBeNull();
    expect(state.companyName).toBeNull();
    expect(state.provisioningStatus).toBe("not_started");
    expect(state.workspaceStatus).toBe("locked");
    expect(state.bridgePrincipalId).toBeNull();
    expect(state.canOpenWorkspace).toBe(false);
  });

  it("marks a provisioned company as workspace-ready", () => {
    const state = summarizeAutopilotState({
      autopilotProvisioning: {
        companyId: "cmp_123",
        companyName: "Autopilot GmbH",
        provisioningStatus: "active",
      },
    });

    expect(state.companyId).toBe("cmp_123");
    expect(state.companyName).toBe("Autopilot GmbH");
    expect(state.provisioningStatus).toBe("active");
    expect(state.workspaceStatus).toBe("ready");
    expect(state.bridgePrincipalId).toBeNull();
    expect(state.canOpenWorkspace).toBe(true);
  });

  it("derives the stable bridge principal from the clerk user id", () => {
    const state = summarizeAutopilotState(
      {
        autopilotProvisioning: {
          companyId: "cmp_123",
          provisioningStatus: "active",
        },
      },
      "user_123",
    );

    expect(state.bridgePrincipalId).toBe("clerk:user_123");
  });
});
