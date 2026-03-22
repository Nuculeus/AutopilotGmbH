import { describe, expect, it } from "vitest";
import { validateSecretForLaunch } from "@/lib/connection-key-validation";

describe("validateSecretForLaunch", () => {
  it("blocks obvious non-secret OpenAI keys", () => {
    const result = validateSecretForLaunch({
      name: "openai_api_key",
      value: "pk_test_abc123",
    });

    expect(result.ok).toBe(false);
    expect(result.message).toContain("Secret Key");
  });

  it("accepts OpenAI secret-style keys", () => {
    const result = validateSecretForLaunch({
      name: "openai_api_key",
      value: "sk-proj_abc123456789",
    });

    expect(result.ok).toBe(true);
  });

  it("blocks malformed Anthropic keys", () => {
    const result = validateSecretForLaunch({
      name: "anthropic_api_key",
      value: "sk-abc",
    });

    expect(result.ok).toBe(false);
    expect(result.message).toContain("sk-ant-");
  });

  it("does not block non-llm secrets", () => {
    const result = validateSecretForLaunch({
      name: "stripe_api_key",
      value: "rk_live_example",
    });

    expect(result.ok).toBe(true);
  });
});
