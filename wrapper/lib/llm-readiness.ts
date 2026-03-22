import { hasRunnableLlmBinding } from "@/lib/llm-connections";
import type {
  PaperclipAdapterEnvironmentTestResult,
  PaperclipAgentConfiguration,
} from "@/lib/paperclip-admin";
import { testAdapterEnvironment } from "@/lib/paperclip-admin";

type ProbeInput = {
  companyId: string;
  bridgePrincipalId: string;
  adapterType: string;
  adapterConfig: Record<string, unknown>;
};

type ProbeFn = (
  input: ProbeInput,
) => Promise<PaperclipAdapterEnvironmentTestResult>;

export type LlmReadinessStatus = "ready" | "warning" | "blocked";

export type LlmReadinessReport = {
  status: LlmReadinessStatus;
  summary: string;
  probedAdapterType: string | null;
  checkedAt: string;
};

export type AutopilotLlmReadinessMetadata = {
  status: LlmReadinessStatus;
  summary: string;
  probedAdapterType: string | null;
  checkedAt: string | null;
};

type AssessInput = {
  companyId: string;
  bridgePrincipalId: string;
  agents: PaperclipAgentConfiguration[];
};

const ADAPTER_ENV_KEYS: Record<string, string[]> = {
  codex_local: ["OPENAI_API_KEY"],
  opencode_local: ["OPENAI_API_KEY"],
  cursor: ["OPENAI_API_KEY"],
  claude_local: ["ANTHROPIC_API_KEY"],
  gemini_local: ["GEMINI_API_KEY"],
  openclaw_gateway: ["OPENAI_API_KEY", "ANTHROPIC_API_KEY", "GEMINI_API_KEY"],
  process: ["OPENAI_API_KEY", "ANTHROPIC_API_KEY", "GEMINI_API_KEY"],
};

export const EMPTY_AUTOPILOT_LLM_READINESS: AutopilotLlmReadinessMetadata = {
  status: "blocked",
  summary:
    "Noch kein verifizierter LLM-Check vorhanden. Bitte in Connections den Readiness-Check ausführen.",
  probedAdapterType: null,
  checkedAt: null,
};

function asString(value: unknown) {
  return typeof value === "string" ? value : null;
}

export function normalizeAutopilotLlmReadinessMetadata(
  value: unknown,
): AutopilotLlmReadinessMetadata {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return EMPTY_AUTOPILOT_LLM_READINESS;
  }

  const source = value as Record<string, unknown>;
  const status =
    source.status === "ready" || source.status === "warning" ? source.status : "blocked";
  const summary =
    asString(source.summary) ??
    EMPTY_AUTOPILOT_LLM_READINESS.summary;

  return {
    status,
    summary,
    probedAdapterType: asString(source.probedAdapterType),
    checkedAt: asString(source.checkedAt),
  };
}

export function isLlmReadinessReady(value: AutopilotLlmReadinessMetadata) {
  return value.status === "ready";
}

const PROBE_ORDER = [
  "codex_local",
  "claude_local",
  "opencode_local",
  "cursor",
  "gemini_local",
  "openclaw_gateway",
  "process",
];

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

function hasAdapterLlmBinding(agent: PaperclipAgentConfiguration) {
  const env =
    typeof agent.adapterConfig.env === "object" &&
    agent.adapterConfig.env !== null &&
    !Array.isArray(agent.adapterConfig.env)
      ? (agent.adapterConfig.env as Record<string, unknown>)
      : {};

  const envKeys = ADAPTER_ENV_KEYS[agent.adapterType] ?? [];
  return envKeys.some((envKey) => hasConfiguredEnvKey(env, envKey));
}

function pickProbeCandidate(agents: PaperclipAgentConfiguration[]) {
  const ranked = [...agents]
    .filter((agent) => hasAdapterLlmBinding(agent))
    .sort((a, b) => {
      const rankA = PROBE_ORDER.indexOf(a.adapterType);
      const rankB = PROBE_ORDER.indexOf(b.adapterType);
      const safeRankA = rankA === -1 ? Number.MAX_SAFE_INTEGER : rankA;
      const safeRankB = rankB === -1 ? Number.MAX_SAFE_INTEGER : rankB;
      return safeRankA - safeRankB;
    });

  return ranked[0] ?? null;
}

function summarizeProbeFailure(result: PaperclipAdapterEnvironmentTestResult) {
  for (const check of result.checks) {
    if (check.level === "error" || check.level === "warn") {
      return check.hint?.trim() || check.message?.trim() || "Die Adapter-Umgebung konnte nicht erfolgreich getestet werden.";
    }
  }

  return "Die Adapter-Umgebung konnte nicht erfolgreich getestet werden.";
}

function summarizeProbeException(error: unknown) {
  if (error instanceof Error) {
    const normalized = error.message.toLowerCase();
    if (normalized.includes("secret not found")) {
      return "Eine hinterlegte Verbindung wurde nicht gefunden. Bitte in Connections den betroffenen Key neu speichern und den Readiness-Check erneut starten.";
    }
  }

  return "Der LLM-Check ist unerwartet fehlgeschlagen. Bitte den Check erneut starten.";
}

export async function assessLlmReadiness(
  input: AssessInput,
  probeAdapter: ProbeFn = testAdapterEnvironment,
): Promise<LlmReadinessReport> {
  const checkedAt = new Date().toISOString();

  const normalizedAgents = input.agents.map((agent) => ({
    id: agent.id,
    name: agent.name,
    role: agent.role,
    adapterType: agent.adapterType,
    adapterConfig:
      typeof agent.adapterConfig === "object" &&
      agent.adapterConfig !== null &&
      !Array.isArray(agent.adapterConfig)
        ? agent.adapterConfig
        : {},
  }));

  if (!hasRunnableLlmBinding(normalizedAgents)) {
    return {
      status: "blocked",
      summary:
        "Noch kein lauffähiger LLM-Pfad gefunden. Hinterlege einen Key und stelle sicher, dass mindestens ein Agent daran gebunden ist.",
      probedAdapterType: null,
      checkedAt,
    };
  }

  const candidate = pickProbeCandidate(normalizedAgents);

  if (!candidate) {
    return {
      status: "warning",
      summary:
        "LLM-Bindung erkannt, aber kein probe-fähiger Agent gefunden. Du kannst den Workspace testen, solltest aber den ersten Lauf beobachten.",
      probedAdapterType: null,
      checkedAt,
    };
  }

  let probe: PaperclipAdapterEnvironmentTestResult;
  try {
    probe = await probeAdapter({
      companyId: input.companyId,
      bridgePrincipalId: input.bridgePrincipalId,
      adapterType: candidate.adapterType,
      adapterConfig: candidate.adapterConfig,
    });
  } catch (error) {
    return {
      status: "blocked",
      summary: summarizeProbeException(error),
      probedAdapterType: candidate.adapterType,
      checkedAt,
    };
  }

  if (probe.status === "fail") {
    return {
      status: "blocked",
      summary: summarizeProbeFailure(probe),
      probedAdapterType: candidate.adapterType,
      checkedAt,
    };
  }

  if (probe.status === "warn") {
    return {
      status: "warning",
      summary: summarizeProbeFailure(probe),
      probedAdapterType: candidate.adapterType,
      checkedAt,
    };
  }

  return {
    status: "ready",
    summary: "LLM-Zugang ist lauffähig. Der Workspace kann ohne bekannte Model-Blocker starten.",
    probedAdapterType: candidate.adapterType,
    checkedAt,
  };
}
