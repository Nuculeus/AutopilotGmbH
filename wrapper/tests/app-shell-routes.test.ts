import { describe, expect, it } from "vitest";
import { buildAppShellModel } from "@/lib/app-shell";
import { EMPTY_COMPANY_HQ_PROFILE } from "@/lib/company-hq";

describe("buildAppShellModel", () => {
  it("renders the launch navigation structure", () => {
    const model = buildAppShellModel({
      currentPath: "/app/overview",
      companyHqProfile: EMPTY_COMPANY_HQ_PROFILE,
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
      companyHqProfile: EMPTY_COMPANY_HQ_PROFILE,
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
      companyHqProfile: EMPTY_COMPANY_HQ_PROFILE,
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
      companyHqProfile: EMPTY_COMPANY_HQ_PROFILE,
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

  it("turns chat into a guided continuation of the saved briefing", () => {
    const model = buildAppShellModel({
      currentPath: "/app/chat",
      companyHqProfile: {
        companyGoal: "Wir bauen einen KI-gestuetzten Telefonservice fuer regionale Dienstleister.",
        offer: "Voice-Rezeption mit Terminhandling und Lead-Qualifizierung.",
        audience: "KMU aus Handwerk, Praxen und Gastronomie im DACH-Raum.",
        tone: "klar, deutsch, vertrauenswuerdig",
        priorities: "Ersten Pilotkunden live nehmen und Verbindungen anschliessen.",
        updatedAt: "2026-03-21T12:00:00.000Z",
      },
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

    expect(model.page.title).toBe("Dein Arbeitsbereich ist bereit");
    expect(model.nextStep.title).toBe("Erste Verbindungen anschließen");
    expect(model.nextStep.href).toBe("/app/connections");
    expect(model.checklist).toEqual([
      "Briefing gespeichert",
      "Workspace verbunden",
      "Nächster Schritt: Verbindungen anschließen",
    ]);
    expect(model.workspaceHandoff?.headline).toBe("Deine Richtung steht. Jetzt geht es in die Ausführung.");
    expect(model.workspaceHandoff?.highlights).toEqual([
      {
        label: "Angebot",
        value: "Voice-Rezeption mit Terminhandling und Lead-Qualifizierung.",
      },
      {
        label: "Zielgruppe",
        value: "KMU aus Handwerk, Praxen und Gastronomie im DACH-Raum.",
      },
      {
        label: "Nächster Fokus",
        value: "Ersten Pilotkunden live nehmen und Verbindungen anschliessen.",
      },
    ]);
  });

  it("guides company hq toward the next operational setup step", () => {
    const model = buildAppShellModel({
      currentPath: "/app/company-hq",
      companyHqProfile: EMPTY_COMPANY_HQ_PROFILE,
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
      companyHqProfile: EMPTY_COMPANY_HQ_PROFILE,
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
      companyHqProfile: EMPTY_COMPANY_HQ_PROFILE,
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
