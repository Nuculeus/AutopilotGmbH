import { describe, expect, it, vi } from "vitest";
import { assessLlmReadiness } from "@/lib/llm-readiness";

describe("assessLlmReadiness", () => {
  it("blocks when no runnable llm binding exists", async () => {
    const probe = vi.fn();

    const result = await assessLlmReadiness(
      {
        companyId: "cmp_123",
        bridgePrincipalId: "clerk:user_123",
        agents: [
          {
            id: "agent_ceo",
            name: "CEO",
            role: "ceo",
            adapterType: "codex_local",
            adapterConfig: { model: "gpt-5.4" },
          },
        ],
      },
      probe,
    );

    expect(result.status).toBe("blocked");
    expect(result.probedAdapterType).toBeNull();
    expect(probe).not.toHaveBeenCalled();
  });

  it("returns ready when probe succeeds", async () => {
    const probe = vi.fn().mockResolvedValue({
      status: "pass",
      checks: [],
      testedAt: "2026-03-22T00:00:00.000Z",
    });

    const result = await assessLlmReadiness(
      {
        companyId: "cmp_123",
        bridgePrincipalId: "clerk:user_123",
        agents: [
          {
            id: "agent_ceo",
            name: "CEO",
            role: "ceo",
            adapterType: "codex_local",
            adapterConfig: {
              model: "gpt-5.4",
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
      },
      probe,
    );

    expect(result.status).toBe("ready");
    expect(result.probedAdapterType).toBe("codex_local");
    expect(probe).toHaveBeenCalledTimes(1);
  });

  it("returns blocked with hint when probe fails", async () => {
    const probe = vi.fn().mockResolvedValue({
      status: "fail",
      checks: [
        {
          code: "codex_hello_probe_failed",
          level: "error",
          message: "Codex hello probe failed.",
          hint: "Configure OPENAI_API_KEY and retry.",
        },
      ],
      testedAt: "2026-03-22T00:00:00.000Z",
    });

    const result = await assessLlmReadiness(
      {
        companyId: "cmp_123",
        bridgePrincipalId: "clerk:user_123",
        agents: [
          {
            id: "agent_ceo",
            name: "CEO",
            role: "ceo",
            adapterType: "codex_local",
            adapterConfig: {
              model: "gpt-5.4",
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
      },
      probe,
    );

    expect(result.status).toBe("blocked");
    expect(result.summary).toContain("Configure OPENAI_API_KEY");
  });
});
