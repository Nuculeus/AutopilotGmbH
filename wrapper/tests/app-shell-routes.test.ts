import { describe, expect, it } from "vitest";
import { buildAppShellModel } from "@/lib/app-shell";
import { EMPTY_COMPANY_HQ_PROFILE } from "@/lib/company-hq";

describe("buildAppShellModel", () => {
  it("renders the launch navigation structure", () => {
    const model = buildAppShellModel({
      currentPath: "/app/overview",
      companyHqProfile: EMPTY_COMPANY_HQ_PROFILE,
      hasRunnableLlmConnection: true,
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
      hasRunnableLlmConnection: false,
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
      hasRunnableLlmConnection: false,
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
      hasRunnableLlmConnection: true,
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
      llmReadiness: {
        status: "ready",
        summary: "LLM-Zugang ist lauffähig.",
        checkedAt: "2026-03-22T06:00:00.000Z",
        probedAdapterType: "codex_local",
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
        revenueTrack: "service_business",
        valueModel: "Retainer fuer laufende Automationsbetreuung.",
        requiredConnections: ["llm_any", "stripe", "outreach_channel"],
        nextMilestone: "workspace_ready",
        updatedAt: "2026-03-21T12:00:00.000Z",
      },
      hasRunnableLlmConnection: true,
      hasRequiredRevenueConnections: true,
      llmReadiness: {
        status: "ready",
        summary: "LLM-Zugang ist lauffähig.",
        checkedAt: "2026-03-22T06:00:00.000Z",
        probedAdapterType: "codex_local",
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
    expect(model.nextStep.title).toBe("Erstes Offer-Asset erzeugen");
    expect(model.nextStep.href).toBe("/app/chat");
    expect(model.checklist).toEqual([
      "Briefing gespeichert",
      "Workspace verbunden",
      "Nächster Schritt: Proof-Asset fertigstellen",
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
        label: "Revenue-Track",
        value: "Service Business",
      },
      {
        label: "Proof-Ziel",
        value: "Erster zahlender Pilotkunde in 14 Tagen.",
      },
    ]);
    expect(model.workspaceHandoff?.actions[0]).toEqual(
      expect.objectContaining({
        label: "Proof-Asset fertigstellen",
        href: "/api/revenue/events",
        method: "POST",
      }),
    );
  });

  it("blocks chat until a runnable llm connection exists", () => {
    const model = buildAppShellModel({
      currentPath: "/app/chat",
      companyHqProfile: {
        companyGoal: "Wir bauen einen KI-gestuetzten Telefonservice fuer regionale Dienstleister.",
        offer: "Voice-Rezeption mit Terminhandling und Lead-Qualifizierung.",
        audience: "KMU aus Handwerk, Praxen und Gastronomie im DACH-Raum.",
        tone: "klar, deutsch, vertrauenswuerdig",
        priorities: "Ersten Pilotkunden live nehmen und Verbindungen anschliessen.",
        revenueTrack: "service_business",
        valueModel: "Retainer fuer laufende Automationsbetreuung.",
        requiredConnections: ["llm_any", "stripe", "outreach_channel"],
        nextMilestone: "workspace_ready",
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
      hasRunnableLlmConnection: false,
    });

    expect(model.access).toBe("blocked");
    expect(model.blockedMessage).toContain("LLM-Pfad");
    expect(model.nextStep.href).toBe("/app/connections?preset=openai");
  });

  it("keeps chat blocked until llm readiness is verified as ready", () => {
    const model = buildAppShellModel({
      currentPath: "/app/chat",
      companyHqProfile: {
        companyGoal: "Wir bauen einen KI-gestuetzten Telefonservice fuer regionale Dienstleister.",
        offer: "Voice-Rezeption mit Terminhandling und Lead-Qualifizierung.",
        audience: "KMU aus Handwerk, Praxen und Gastronomie im DACH-Raum.",
        tone: "klar, deutsch, vertrauenswuerdig",
        priorities: "Ersten Pilotkunden live nehmen und Verbindungen anschliessen.",
        revenueTrack: "service_business",
        valueModel: "Retainer fuer laufende Automationsbetreuung.",
        requiredConnections: ["llm_any", "stripe", "outreach_channel"],
        nextMilestone: "workspace_ready",
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
      hasRunnableLlmConnection: true,
      llmReadiness: {
        status: "warning",
        summary: "OpenAI probe failed with unauthorized.",
        checkedAt: "2026-03-22T06:00:00.000Z",
        probedAdapterType: "codex_local",
      },
      hasRequiredRevenueConnections: true,
    });

    expect(model.access).toBe("blocked");
    expect(model.blockedMessage).toContain("OpenAI probe failed");
    expect(model.nextStep.href).toBe("/app/connections?preset=openai");
  });

  it("keeps chat blocked until required revenue connections are complete", () => {
    const model = buildAppShellModel({
      currentPath: "/app/chat",
      companyHqProfile: {
        companyGoal: "Wir bauen einen KI-gestuetzten Telefonservice fuer regionale Dienstleister.",
        offer: "Voice-Rezeption mit Terminhandling und Lead-Qualifizierung.",
        audience: "KMU aus Handwerk, Praxen und Gastronomie im DACH-Raum.",
        tone: "klar, deutsch, vertrauenswuerdig",
        priorities: "Ersten Pilotkunden live nehmen und Verbindungen anschliessen.",
        revenueTrack: "service_business",
        valueModel: "Retainer fuer laufende Automationsbetreuung.",
        requiredConnections: ["llm_any", "stripe", "outreach_channel"],
        nextMilestone: "workspace_ready",
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
      hasRunnableLlmConnection: true,
      llmReadiness: {
        status: "ready",
        summary: "LLM-Zugang ist lauffähig.",
        checkedAt: "2026-03-22T06:00:00.000Z",
        probedAdapterType: "codex_local",
      },
      hasRequiredRevenueConnections: false,
      missingRequiredConnections: ["stripe", "outreach_channel"],
    });

    expect(model.access).toBe("blocked");
    expect(model.blockedMessage).toContain("Pflichtverbindungen");
    expect(model.nextStep.href).toBe("/app/connections");
  });

  it("updates workspace next step when first value is already created", () => {
    const model = buildAppShellModel({
      currentPath: "/app/chat",
      companyHqProfile: {
        companyGoal: "Wir bauen einen KI-gestuetzten Telefonservice fuer regionale Dienstleister.",
        offer: "Voice-Rezeption mit Terminhandling und Lead-Qualifizierung.",
        audience: "KMU aus Handwerk, Praxen und Gastronomie im DACH-Raum.",
        tone: "klar, deutsch, vertrauenswuerdig",
        priorities: "Ersten Pilotkunden live nehmen und Verbindungen anschliessen.",
        revenueTrack: "service_business",
        valueModel: "Retainer fuer laufende Automationsbetreuung.",
        requiredConnections: ["llm_any", "stripe", "outreach_channel"],
        nextMilestone: "first_value_created",
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
      hasRunnableLlmConnection: true,
      llmReadiness: {
        status: "ready",
        summary: "LLM-Zugang ist lauffähig.",
        checkedAt: "2026-03-22T06:00:00.000Z",
        probedAdapterType: "codex_local",
      },
      hasRequiredRevenueConnections: true,
    });

    expect(model.nextStep.title).toBe("Service-Angebot live stellen");
    expect(model.workspaceHandoff?.actions[0]).toEqual(
      expect.objectContaining({
        href: "/api/revenue/events",
        method: "POST",
      }),
    );
  });

  it("moves the service path from offer live into checkout activation", () => {
    const model = buildAppShellModel({
      currentPath: "/app/chat",
      companyHqProfile: {
        companyGoal: "Wir bauen einen KI-gestuetzten Telefonservice fuer regionale Dienstleister.",
        offer: "Voice-Rezeption mit Terminhandling und Lead-Qualifizierung.",
        audience: "KMU aus Handwerk, Praxen und Gastronomie im DACH-Raum.",
        tone: "klar, deutsch, vertrauenswuerdig",
        priorities: "Ersten Pilotkunden live nehmen und Verbindungen anschliessen.",
        revenueTrack: "service_business",
        valueModel: "Retainer fuer laufende Automationsbetreuung.",
        requiredConnections: ["llm_any", "stripe", "outreach_channel"],
        nextMilestone: "first_offer_live",
        updatedAt: "2026-03-21T12:00:00.000Z",
        ventureId: "venture_1",
        proofTarget: "Erster zahlender Pilotkunde in 14 Tagen.",
        budgetCapCents: null,
        acquisitionChannel: "Outbound + Demo-Call",
        paymentNode: "Stripe Checkout Link",
        deliveryNode: "Kickoff-Call + 14-Tage-Umsetzung",
        autonomyLevel: "guided",
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
      hasRunnableLlmConnection: true,
      llmReadiness: {
        status: "ready",
        summary: "LLM-Zugang ist lauffähig.",
        checkedAt: "2026-03-22T06:00:00.000Z",
        probedAdapterType: "codex_local",
      },
      hasRequiredRevenueConnections: true,
    });

    expect(model.nextStep.title).toBe("Checkout aktivieren");
    expect(model.workspaceHandoff?.actions[0]).toEqual(
      expect.objectContaining({
        label: "Checkout aktivieren",
        href: "/api/stripe/checkout",
        method: "POST",
      }),
    );
  });

  it("guides company hq toward the next operational setup step", () => {
    const model = buildAppShellModel({
      currentPath: "/app/company-hq",
      companyHqProfile: EMPTY_COMPANY_HQ_PROFILE,
      hasRunnableLlmConnection: false,
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
      hasRunnableLlmConnection: false,
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
      hasRunnableLlmConnection: false,
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
