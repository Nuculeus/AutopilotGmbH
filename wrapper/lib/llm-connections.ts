type LlmProvider = "openai" | "anthropic" | "gemini";

type KnownSecret = {
  id: string;
  name: string;
  provider: string;
};

type BindableAgent = {
  id: string;
  name: string;
  role: string;
  adapterType: string;
  adapterConfig: Record<string, unknown>;
};

const SECRET_NAME_TO_PROVIDER: Record<string, LlmProvider> = {
  OPENAI_API_KEY: "openai",
  ANTHROPIC_API_KEY: "anthropic",
  GEMINI_API_KEY: "gemini",
};

const ADAPTER_ENV_MAP: Record<LlmProvider, { envKey: string; adapters: string[] }> = {
  openai: {
    envKey: "OPENAI_API_KEY",
    adapters: ["codex_local", "opencode_local"],
  },
  anthropic: {
    envKey: "ANTHROPIC_API_KEY",
    adapters: ["claude_local"],
  },
  gemini: {
    envKey: "GEMINI_API_KEY",
    adapters: ["gemini_local"],
  },
};

function normalizeSecretName(name: string) {
  return name.trim().toUpperCase();
}

export function resolveLlmProviderFromSecretName(name: string): LlmProvider | null {
  return SECRET_NAME_TO_PROVIDER[normalizeSecretName(name)] ?? null;
}

export function hasConnectedLlmProvider(secrets: KnownSecret[]) {
  return secrets.some((secret) => resolveLlmProviderFromSecretName(secret.name) !== null);
}

export function buildAgentConfigWithLlmSecret(input: {
  agentAdapterType: string;
  adapterConfig: Record<string, unknown>;
  secretId: string;
  secretName: string;
}) {
  const provider = resolveLlmProviderFromSecretName(input.secretName);
  if (!provider) return null;

  const providerConfig = ADAPTER_ENV_MAP[provider];
  if (!providerConfig.adapters.includes(input.agentAdapterType)) {
    return null;
  }

  const currentEnv =
    typeof input.adapterConfig.env === "object" &&
    input.adapterConfig.env !== null &&
    !Array.isArray(input.adapterConfig.env)
      ? (input.adapterConfig.env as Record<string, unknown>)
      : {};

  return {
    ...input.adapterConfig,
    env: {
      ...currentEnv,
      [providerConfig.envKey]: {
        type: "secret_ref",
        secretId: input.secretId,
        version: "latest",
      },
    },
  };
}

export function planAgentLlmBindings(input: {
  secretId: string;
  secretName: string;
  agents: BindableAgent[];
}): Array<{ agentId: string; nextAdapterConfig: Record<string, unknown> }> {
  return input.agents.reduce<Array<{ agentId: string; nextAdapterConfig: Record<string, unknown> }>>((updates, agent) => {
      const nextAdapterConfig = buildAgentConfigWithLlmSecret({
        agentAdapterType: agent.adapterType,
        adapterConfig: agent.adapterConfig,
        secretId: input.secretId,
        secretName: input.secretName,
      });

      if (!nextAdapterConfig) {
        return updates;
      }

      updates.push({
        agentId: agent.id,
        nextAdapterConfig,
      });

      return updates;
    }, []);
}

export type { BindableAgent, LlmProvider };
