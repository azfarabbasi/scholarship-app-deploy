import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getAiConfig, resetAiConfigCacheForTests } from "@/lib/ai/config";
import { estimateTokenCount } from "@/lib/ai/token-estimate";

const AI_ENV_KEYS = [
  "AI_ENABLED",
  "AI_PROVIDER",
  "GROQ_API_KEY",
  "GROQ_MODEL",
  "AI_MAX_INPUT_TOKENS",
  "AI_MAX_OUTPUT_TOKENS",
  "AI_DAILY_GUEST_LIMIT",
  "AI_DAILY_USER_LIMIT",
  "AI_LOG_RETENTION_DAYS",
] as const;

let originalEnv: Record<string, string | undefined>;

beforeEach(() => {
  originalEnv = Object.fromEntries(AI_ENV_KEYS.map((key) => [key, process.env[key]]));
  for (const key of AI_ENV_KEYS) delete process.env[key];
  resetAiConfigCacheForTests();
});

afterEach(() => {
  for (const key of AI_ENV_KEYS) {
    if (originalEnv[key] === undefined) delete process.env[key];
    else process.env[key] = originalEnv[key];
  }
  resetAiConfigCacheForTests();
});

describe("getAiConfig", () => {
  it("defaults to disabled and unavailable when no AI env vars are set at all", () => {
    const config = getAiConfig();
    expect(config.enabled).toBe(false);
    expect(config.isAvailable).toBe(false);
  });

  it("stays unavailable when AI_ENABLED=true but the groq provider has no API key configured", () => {
    process.env.AI_ENABLED = "true";
    process.env.AI_PROVIDER = "groq";
    const config = getAiConfig();
    expect(config.enabled).toBe(true);
    expect(config.groqApiKey).toBeNull();
    expect(config.isAvailable).toBe(false);
  });

  it("is available when AI_ENABLED=true and the mock provider is selected, with no key required", () => {
    process.env.AI_ENABLED = "true";
    process.env.AI_PROVIDER = "mock";
    const config = getAiConfig();
    expect(config.isAvailable).toBe(true);
  });

  it("is available when AI_ENABLED=true, groq is selected, and a key is present", () => {
    process.env.AI_ENABLED = "true";
    process.env.AI_PROVIDER = "groq";
    process.env.GROQ_API_KEY = "gsk_test_key";
    const config = getAiConfig();
    expect(config.isAvailable).toBe(true);
    expect(config.groqApiKey).toBe("gsk_test_key");
  });

  it("never throws on a malformed numeric env var — falls back to safe defaults instead", () => {
    process.env.AI_ENABLED = "true";
    process.env.AI_MAX_INPUT_TOKENS = "not-a-number";
    expect(() => getAiConfig()).not.toThrow();
    const config = getAiConfig();
    expect(config.maxInputTokens).toBeGreaterThan(0);
  });

  it("treats a blank GROQ_API_KEY as not configured", () => {
    process.env.AI_ENABLED = "true";
    process.env.AI_PROVIDER = "groq";
    process.env.GROQ_API_KEY = "   ";
    const config = getAiConfig();
    expect(config.groqApiKey).toBeNull();
    expect(config.isAvailable).toBe(false);
  });
});

describe("estimateTokenCount", () => {
  it("is roughly proportional to text length", () => {
    expect(estimateTokenCount("")).toBe(0);
    expect(estimateTokenCount("a".repeat(400))).toBe(100);
  });
});
