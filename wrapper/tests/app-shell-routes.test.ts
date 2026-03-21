import { describe, expect, it } from "vitest";
import { buildAppShellModel } from "@/lib/app-shell";

describe("buildAppShellModel", () => {
  it("renders the launch navigation structure", () => {
    const model = buildAppShellModel({
      currentPath: "/app/overview",
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
      currentPath: "/app/overview",
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
      currentPath: "/app/overview",
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

  it("switches chat into focus mode with a compact next step", () => {
    const model = buildAppShellModel({
      currentPath: "/app/chat",
      creditSummary: {
        availableCredits: 20,
        plan: "free",
      },
      autopilotState: {
        companyId: "cmp_123",
        companyName: "Meine Autopilot GmbH",
        provisioningStatus: "active",
        workspaceStatus: "ready",
        canOpenWorkspace: true,
      },
    });

    expect(model.layoutMode).toBe("focus");
    expect(model.nextStep.title).toBe("Unternehmenswissen festhalten");
    expect(model.nextStep.href).toBe("/app/company-hq");
    expect(model.checklist).toEqual([
      "Firma aktiv",
      "Workspace verbunden",
      "Nächster Schritt: Unternehmenswissen hinterlegen",
    ]);
  });

  it("guides company hq toward the next operational setup step", () => {
    const model = buildAppShellModel({
      currentPath: "/app/company-hq",
      creditSummary: {
        availableCredits: 20,
        plan: "free",
      },
      autopilotState: {
        companyId: "cmp_123",
        companyName: "Meine Autopilot GmbH",
        provisioningStatus: "active",
        workspaceStatus: "ready",
        canOpenWorkspace: true,
      },
    });

    expect(model.page.title).toBe("Baue das Fundament deiner Firma");
    expect(model.nextStep.title).toBe("Erste Verbindungen anschließen");
    expect(model.nextStep.href).toBe("/app/connections");
  });

  it("guides connections toward plug-and-play first", () => {
    const model = buildAppShellModel({
      currentPath: "/app/connections",
      creditSummary: {
        availableCredits: 20,
        plan: "free",
      },
      autopilotState: {
        companyId: "cmp_123",
        companyName: "Meine Autopilot GmbH",
        provisioningStatus: "active",
        workspaceStatus: "ready",
        canOpenWorkspace: true,
      },
    });

    expect(model.page.title).toBe("Verbinde die ersten Werkzeuge");
    expect(model.nextStep.title).toBe("Ersten Baustein starten");
    expect(model.nextStep.href).toBe("/app/apps");
  });

  it("guides apps toward a first launch-safe starter", () => {
    const model = buildAppShellModel({
      currentPath: "/app/apps",
      creditSummary: {
        availableCredits: 20,
        plan: "free",
      },
      autopilotState: {
        companyId: "cmp_123",
        companyName: "Meine Autopilot GmbH",
        provisioningStatus: "active",
        workspaceStatus: "ready",
        canOpenWorkspace: true,
      },
    });

    expect(model.page.title).toBe("Starte den ersten Baustein");
    expect(model.nextStep.title).toBe("Im Workspace ausführen");
    expect(model.nextStep.href).toBe("/app/chat");
  });
});
