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
    adapters: ["codex_local", "opencode_local", "cursor", "openclaw_gateway", "process"],
  },
  anthropic: {
    envKey: "ANTHROPIC_API_KEY",
    adapters: ["claude_local", "openclaw_gateway", "process"],
  },
  gemini: {
    envKey: "GEMINI_API_KEY",
    adapters: ["gemini_local", "openclaw_gateway", "process"],
  },
};

function normalizeAdapterConfigEnv(value: unknown) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
}

function hasConfiguredEnvKey(env: Record<string, unknown>, envKey: string) {
  const value = env[envKey];
  if (typeof value === "string" && value.trim().length > 0) {
    return true;
  }

  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }

  const secretRef = value as Record<string, unknown>;
  return secretRef.type === "secret_ref" && typeof secretRef.secretId === "string";
}

function normalizeSecretName(name: string) {
  return name.trim().toUpperCase();
}

export function resolveLlmProviderFromSecretName(name: string): LlmProvider | null {
  const normalized = normalizeSecretName(name);

  const exactMatch = SECRET_NAME_TO_PROVIDER[normalized];
  if (exactMatch) {
    return exactMatch;
  }

  if (
    normalized.includes("OPENAI")
    || normalized.includes("CHATGPT")
    || normalized.includes("GPT")
  ) {
    return "openai";
  }

  if (normalized.includes("ANTHROPIC") || normalized.includes("CLAUDE")) {
    return "anthropic";
  }

  if (normalized.includes("GEMINI")) {
    return "gemini";
  }

  return null;
}

export function hasConnectedLlmProvider(secrets: KnownSecret[]) {
  return secrets.some((secret) => resolveLlmProviderFromSecretName(secret.name) !== null);
}

export function hasRunnableLlmBinding(agents: BindableAgent[]) {
  return agents.some((agent) => {
    const env = normalizeAdapterConfigEnv(agent.adapterConfig.env);

    return Object.values(ADAPTER_ENV_MAP).some((providerConfig) => {
      if (!providerConfig.adapters.includes(agent.adapterType)) {
        return false;
      }

      return hasConfiguredEnvKey(env, providerConfig.envKey);
    });
  });
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
