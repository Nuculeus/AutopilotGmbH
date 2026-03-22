import { describe, expect, it } from "vitest";
import {
  buildAgentConfigWithLlmSecret,
  getCanonicalLlmSecretName,
  hasConnectedLlmProvider,
  hasRunnableLlmBinding,
  LLM_PROVIDER_OPTIONS,
  planAgentLlmBindings,
  resolveLlmProviderFromSecretName,
} from "@/lib/llm-connections";

describe("llm connections helpers", () => {
  it("recognizes standard provider keys regardless of casing", () => {
    expect(resolveLlmProviderFromSecretName("openai_api_key")).toBe("openai");
    expect(resolveLlmProviderFromSecretName("openai")).toBe("openai");
    expect(resolveLlmProviderFromSecretName("gpt_access_token")).toBe("openai");
    expect(resolveLlmProviderFromSecretName("ANTHROPIC_API_KEY")).toBe("anthropic");
    expect(resolveLlmProviderFromSecretName("claude_token")).toBe("anthropic");
    expect(resolveLlmProviderFromSecretName("Gemini_Api_Key")).toBe("gemini");
    expect(resolveLlmProviderFromSecretName("stripe_api_key")).toBe(null);
  });

  it("exposes canonical secret names for dropdown-selected llm providers", () => {
    expect(getCanonicalLlmSecretName("openai")).toBe("OPENAI_API_KEY");
    expect(getCanonicalLlmSecretName("anthropic")).toBe("ANTHROPIC_API_KEY");
    expect(getCanonicalLlmSecretName("gemini")).toBe("GEMINI_API_KEY");
  });

  it("keeps dropdown options in stable launch order", () => {
    expect(LLM_PROVIDER_OPTIONS.map((entry) => entry.id)).toEqual([
      "openai",
      "anthropic",
      "gemini",
    ]);
  });

  it("detects when a company already has a connected llm provider", () => {
    expect(
      hasConnectedLlmProvider([
        { id: "sec_1", name: "openai_api_key", provider: "local_encrypted" },
      ]),
    ).toBe(true);

    expect(
      hasConnectedLlmProvider([
        { id: "sec_2", name: "stripe_api_key", provider: "local_encrypted" },
      ]),
    ).toBe(false);
  });

  it("binds an openai secret to codex agents under OPENAI_API_KEY", () => {
    const nextConfig = buildAgentConfigWithLlmSecret({
      agentAdapterType: "codex_local",
      adapterConfig: {
        model: "gpt-5.4",
        search: false,
      },
      secretId: "sec_openai",
      secretName: "openai_api_key",
    });

    expect(nextConfig).toEqual({
      model: "gpt-5.4",
      search: false,
      env: {
        OPENAI_API_KEY: {
          type: "secret_ref",
          secretId: "sec_openai",
          version: "latest",
        },
      },
    });
  });

  it("does not bind unrelated secrets to incompatible adapters", () => {
    expect(
      buildAgentConfigWithLlmSecret({
        agentAdapterType: "claude_local",
        adapterConfig: {},
        secretId: "sec_openai",
        secretName: "OPENAI_API_KEY",
      }),
    ).toBeNull();
  });

  it("binds openai secret for process adapters as well", () => {
    const nextConfig = buildAgentConfigWithLlmSecret({
      agentAdapterType: "process",
      adapterConfig: {
        command: "node",
        args: ["run.js"],
      },
      secretId: "sec_openai",
      secretName: "openai",
    });

    expect(nextConfig).toEqual({
      command: "node",
      args: ["run.js"],
      env: {
        OPENAI_API_KEY: {
          type: "secret_ref",
          secretId: "sec_openai",
          version: "latest",
        },
      },
    });
  });

  it("plans updates only for compatible default agents", () => {
    const updates = planAgentLlmBindings({
      secretId: "sec_openai",
      secretName: "openai_api_key",
      agents: [
        {
          id: "agent_ceo",
          name: "CEO",
          role: "ceo",
          adapterType: "codex_local",
          adapterConfig: { model: "gpt-5.4" },
        },
        {
          id: "agent_cto",
          name: "CTO",
          role: "cto",
          adapterType: "claude_local",
          adapterConfig: { model: "claude-sonnet-4-6" },
        },
      ],
    });

    expect(updates).toEqual([
      {
        agentId: "agent_ceo",
        nextAdapterConfig: {
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
    ]);
  });

  it("detects runnable agent bindings only when adapter env is wired", () => {
    expect(
      hasRunnableLlmBinding([
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
      ]),
    ).toBe(true);

    expect(
      hasRunnableLlmBinding([
        {
          id: "agent_ceo",
          name: "CEO",
          role: "ceo",
          adapterType: "codex_local",
          adapterConfig: {
            model: "gpt-5.4",
          },
        },
      ]),
    ).toBe(false);
  });
});
