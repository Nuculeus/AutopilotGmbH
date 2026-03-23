import type { ProvisioningStatus } from "@/lib/autopilot-metadata";

type ProvisioningRunSnapshot = {
  id: string;
  status: "pending" | "running" | "succeeded" | "failed" | "canceled";
  lastError: string | null;
  retryEligible: boolean;
} | null;

export function buildStartReliabilityModel(input: {
  provisioningStatus: ProvisioningStatus;
  provisioningRun: ProvisioningRunSnapshot;
}) {
  const chargeProtection =
    "Bei technischem Fehler entsteht keine doppelte Belastung. Der naechste Versuch bleibt geschuetzt.";

  if (!input.provisioningRun) {
    return {
      runLabel: "Noch kein Run gestartet",
      stateLabel: "Bereit fuer den ersten sicheren Start",
      failureReason: null,
      chargeProtection,
      nextStepCopy:
        "Sobald du startest, verfolgen wir den Lauf sichtbar und halten technische Fehler vom Billing fern.",
    };
  }

  if (input.provisioningStatus === "failed" || input.provisioningRun.status === "failed") {
    return {
      runLabel: `Run-ID: ${input.provisioningRun.id}`,
      stateLabel: "Fehler erkannt",
      failureReason: input.provisioningRun.lastError ?? "Unbekannter Infrastrukturfehler",
      chargeProtection,
      nextStepCopy: input.provisioningRun.retryEligible
        ? "Du kannst diesen Lauf kostenlos erneut versuchen. Bestehende Belastungen werden nicht dupliziert."
        : "Dieser Lauf braucht zuerst eine manuelle Klaerung, bevor ein neuer Versuch startet.",
    };
  }

  if (input.provisioningStatus === "pending" || input.provisioningRun.status === "pending" || input.provisioningRun.status === "running") {
    return {
      runLabel: `Run-ID: ${input.provisioningRun.id}`,
      stateLabel: "Retry-sicher in Bearbeitung",
      failureReason: null,
      chargeProtection,
      nextStepCopy:
        "Der aktuelle Lauf bleibt sichtbar. Wenn die Infrastruktur stolpert, wird derselbe Start nicht doppelt belastet.",
    };
  }

  return {
    runLabel: `Run-ID: ${input.provisioningRun.id}`,
    stateLabel: "Run abgeschlossen",
    failureReason: null,
    chargeProtection,
    nextStepCopy:
      "Der letzte Lauf ist abgeschlossen. Du kannst jetzt kontrolliert in den naechsten Schritt gehen.",
  };
}
