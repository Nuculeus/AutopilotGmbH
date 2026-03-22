import { resolveLlmProviderFromSecretName } from "@/lib/llm-connections";

type ValidationResult = {
  ok: boolean;
  message?: string;
};

function hasWhitespace(value: string) {
  return /\s/.test(value);
}

export function validateSecretForLaunch(input: {
  name: string;
  value: string;
}): ValidationResult {
  const name = input.name.trim();
  const value = input.value.trim();

  if (!name || !value) {
    return {
      ok: false,
      message: "Name und Secret-Wert werden benötigt.",
    };
  }

  const provider = resolveLlmProviderFromSecretName(name);
  if (!provider) {
    return { ok: true };
  }

  if (hasWhitespace(value)) {
    return {
      ok: false,
      message:
        "Der Key enthält Leerzeichen oder Zeilenumbrüche. Bitte nur den reinen Key-Wert einfügen.",
    };
  }

  if (provider === "openai") {
    if (value.startsWith("pk_")) {
      return {
        ok: false,
        message:
          "Das sieht wie ein Publishable Key (pk_) aus. Für OpenAI brauchst du einen Secret Key (sk-...).",
      };
    }

    if (!value.startsWith("sk-")) {
      return {
        ok: false,
        message:
          "OpenAI-Keys sollten mit sk- beginnen. Bitte prüfe, ob du den richtigen Secret Key eingefügt hast.",
      };
    }
  }

  if (provider === "anthropic" && !value.startsWith("sk-ant-")) {
    return {
      ok: false,
      message:
        "Anthropic-Keys sollten mit sk-ant- beginnen. Bitte prüfe den eingefügten Wert.",
    };
  }

  return { ok: true };
}
