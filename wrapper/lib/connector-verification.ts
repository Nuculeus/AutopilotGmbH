import type { AutopilotLlmReadinessMetadata, LlmReadinessReport } from "@/lib/llm-readiness";
import type { PaperclipAgentConfiguration } from "@/lib/paperclip-admin";

type ConnectorVerificationStatus = "verified" | "blocked" | "stale";
type ConnectorProvider = "openai" | "anthropic" | "gemini" | "unknown";

type ProviderCapability = {
  configured: boolean;
  runnable: boolean;
  adapterTypes: string[];
};

type ConnectorVerificationMetadata = {
  summary: string;
  checkedAt: string | null;
  providerCapabilities: Record<string, ProviderCapability>;
};

export type ConnectorVerificationSnapshot = {
  status: ConnectorVerificationStatus;
  provider: ConnectorProvider;
  externalRef: string | null;
  metadata: ConnectorVerificationMetadata;
};

type PersistedConnectorVerification = {
  binding_kind: string;
  provider: string;
  status: string;
  external_ref: string | null;
  metadata_json: unknown;
};

const ADAPTER_TYPE_TO_PROVIDER: Record<string, ConnectorProvider> = {
  codex_local: "openai",
  opencode_local: "openai",
  cursor: "openai",
  claude_local: "anthropic",
  gemini_local: "gemini",
};

function normalizeRecord(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
}

function asString(value: unknown) {
  return typeof value === "string" ? value : null;
}

function hasSecretRef(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const source = value as Record<string, unknown>;
  return source.type === "secret_ref" && typeof source.secretId === "string";
}

function providerFromEnvKey(envKey: string): ConnectorProvider {
  if (envKey === "OPENAI_API_KEY") return "openai";
  if (envKey === "ANTHROPIC_API_KEY") return "anthropic";
  if (envKey === "GEMINI_API_KEY") return "gemini";
  return "unknown";
}

function collectProviderCapabilities(agents: PaperclipAgentConfiguration[]) {
  const capabilities: Record<string, ProviderCapability> = {};

  for (const agent of agents) {
    const adapterConfig = normalizeRecord(agent.adapterConfig);
    const env = normalizeRecord(adapterConfig.env);

    for (const [envKey, rawValue] of Object.entries(env)) {
      const provider = providerFromEnvKey(envKey);
      if (provider === "unknown") {
        continue;
      }

      const next = capabilities[provider] ?? {
        configured: false,
        runnable: false,
        adapterTypes: [],
      };

      next.configured = next.configured || typeof rawValue === "string" || hasSecretRef(rawValue);
      next.runnable = next.runnable || hasSecretRef(rawValue);
      if (!next.adapterTypes.includes(agent.adapterType)) {
        next.adapterTypes.push(agent.adapterType);
      }

      capabilities[provider] = next;
    }
  }

  return capabilities;
}

function pickPrimaryProvider(
  capabilities: Record<string, ProviderCapability>,
  readiness: LlmReadinessReport,
): ConnectorProvider {
  const probedAdapterType = readiness.probedAdapterType;
  if (probedAdapterType) {
    const mappedProvider = ADAPTER_TYPE_TO_PROVIDER[probedAdapterType];
    if (mappedProvider) {
      return mappedProvider;
    }

    for (const [provider, capability] of Object.entries(capabilities)) {
      if (capability.adapterTypes.includes(probedAdapterType)) {
        return provider as ConnectorProvider;
      }
    }
  }

  if (capabilities.openai) return "openai";
  if (capabilities.anthropic) return "anthropic";
  if (capabilities.gemini) return "gemini";
  return "unknown";
}

export function buildLlmConnectorVerification(input: {
  readiness: LlmReadinessReport;
  agents: PaperclipAgentConfiguration[];
}): ConnectorVerificationSnapshot {
  const providerCapabilities = collectProviderCapabilities(input.agents);
  const provider = pickPrimaryProvider(providerCapabilities, input.readiness);

  return {
    status: input.readiness.status === "ready" ? "verified" : "blocked",
    provider,
    externalRef: input.readiness.probedAdapterType,
    metadata: {
      summary: input.readiness.summary,
      checkedAt: input.readiness.checkedAt,
      providerCapabilities,
    },
  };
}

export function buildStaleLlmConnectorVerification(input: {
  provider?: string | null;
  summary: string;
}): ConnectorVerificationSnapshot {
  return {
    status: "stale",
    provider:
      input.provider === "openai" || input.provider === "anthropic" || input.provider === "gemini"
        ? input.provider
        : "unknown",
    externalRef: null,
    metadata: {
      summary: input.summary,
      checkedAt: null,
      providerCapabilities: {},
    },
  };
}

export function toAutopilotLlmReadinessFromConnectorVerification(
  value: PersistedConnectorVerification,
): AutopilotLlmReadinessMetadata {
  const metadata = normalizeRecord(value.metadata_json);
  const summary =
    asString(metadata.summary)
    ?? "Kein persistierter LLM-Status vorhanden. Bitte Readiness erneut pruefen.";

  return {
    status: value.status === "verified" ? "ready" : "blocked",
    summary,
    probedAdapterType: value.external_ref,
    checkedAt: asString(metadata.checkedAt),
  };
}
