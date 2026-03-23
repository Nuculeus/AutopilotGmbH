import { describe, expect, it } from "vitest";
import { buildStartReliabilityModel } from "@/lib/start-reliability";

describe("buildStartReliabilityModel", () => {
  it("shows a visible run id and duplicate-charge protection while provisioning is pending", () => {
    const model = buildStartReliabilityModel({
      provisioningStatus: "pending",
      provisioningRun: {
        id: "prov_123",
        status: "pending",
        lastError: null,
        retryEligible: true,
      },
    });

    expect(model.runLabel).toBe("Run-ID: prov_123");
    expect(model.stateLabel).toBe("Retry-sicher in Bearbeitung");
    expect(model.chargeProtection).toBe(
      "Bei technischem Fehler entsteht keine doppelte Belastung. Der naechste Versuch bleibt geschuetzt.",
    );
  });

  it("shows the explicit failure reason and a retry-safe next step when provisioning failed", () => {
    const model = buildStartReliabilityModel({
      provisioningStatus: "failed",
      provisioningRun: {
        id: "prov_999",
        status: "failed",
        lastError: "Paperclip bridge timeout",
        retryEligible: true,
      },
    });

    expect(model.runLabel).toBe("Run-ID: prov_999");
    expect(model.stateLabel).toBe("Fehler erkannt");
    expect(model.failureReason).toBe("Paperclip bridge timeout");
    expect(model.nextStepCopy).toContain("kostenlos erneut");
  });

  it("falls back to a calm generic status when no durable run exists yet", () => {
    const model = buildStartReliabilityModel({
      provisioningStatus: "not_started",
      provisioningRun: null,
    });

    expect(model.runLabel).toBe("Noch kein Run gestartet");
    expect(model.failureReason).toBeNull();
  });
});
