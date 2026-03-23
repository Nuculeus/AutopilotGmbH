import { describe, expect, it } from "vitest";
import {
  buildLlmConnectorVerification,
  buildStaleLlmConnectorVerification,
  toAutopilotLlmReadinessFromConnectorVerification,
} from "@/lib/connector-verification";

describe("connector verification", () => {
  it("builds a verified connector snapshot with provider-specific capabilities", () => {
    const verification = buildLlmConnectorVerification({
      readiness: {
        status: "ready",
        summary: "LLM-Zugang ist lauffaehig.",
        probedAdapterType: "codex_local",
        checkedAt: "2026-03-23T10:00:00.000Z",
      },
      agents: [
        {
          id: "agent_ceo",
          name: "CEO",
          role: "ceo",
          adapterType: "codex_local",
          adapterConfig: {
            env: {
              OPENAI_API_KEY: {
                type: "secret_ref",
                secretId: "sec_openai",
                version: "latest",
              },
            },
          },
        },
      ],
    });

    expect(verification.status).toBe("verified");
    expect(verification.provider).toBe("openai");
    expect(verification.metadata.summary).toBe("LLM-Zugang ist lauffaehig.");
    expect(verification.metadata.providerCapabilities.openai).toEqual({
      configured: true,
      runnable: true,
      adapterTypes: ["codex_local"],
    });
  });

  it("marks stale snapshots explicitly when a secret mutation invalidates the last check", () => {
    const verification = buildStaleLlmConnectorVerification({
      provider: "openai",
      summary: "LLM-Verbindung wurde aktualisiert. Bitte erneut pruefen.",
    });

    expect(verification.status).toBe("stale");
    expect(verification.provider).toBe("openai");
    expect(verification.metadata.summary).toContain("erneut pruefen");
  });

  it("converts persisted blocked or stale connector state back into workspace gating metadata", () => {
    expect(
      toAutopilotLlmReadinessFromConnectorVerification({
        binding_kind: "llm_readiness",
        provider: "openai",
        status: "blocked",
        external_ref: "codex_local",
        metadata_json: {
          summary: "OpenAI probe failed",
          checkedAt: "2026-03-23T10:00:00.000Z",
        },
      }),
    ).toEqual({
      status: "blocked",
      summary: "OpenAI probe failed",
      probedAdapterType: "codex_local",
      checkedAt: "2026-03-23T10:00:00.000Z",
    });

    expect(
      toAutopilotLlmReadinessFromConnectorVerification({
        binding_kind: "llm_readiness",
        provider: "openai",
        status: "stale",
        external_ref: null,
        metadata_json: {
          summary: "LLM-Verbindung wurde aktualisiert. Bitte erneut pruefen.",
          checkedAt: null,
        },
      }),
    ).toEqual({
      status: "blocked",
      summary: "LLM-Verbindung wurde aktualisiert. Bitte erneut pruefen.",
      probedAdapterType: null,
      checkedAt: null,
    });
  });
});
