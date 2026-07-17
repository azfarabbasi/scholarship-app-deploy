import "server-only";
import { getAiConfig } from "../config";
import { GroqAiProvider } from "./groq";
import { MockAiProvider } from "./mock";
import type { AiProvider } from "./types";

export type { AiChatMessage, AiGenerateRequest, AiGenerateResult, AiProvider } from "./types";
export { MockAiProvider } from "./mock";
export { GroqAiProvider } from "./groq";

/**
 * Resolves the configured provider, or `null` when AI isn't actually usable
 * (disabled, or `groq` selected with no key) — callers must treat `null` as
 * "show the AI-unavailable state," never throw. `AI_PROVIDER=mock` is valid
 * in any environment (tests, or a deliberate no-network local run); `groq`
 * requires `GROQ_API_KEY` to be set, checked via `getAiConfig().isAvailable`.
 */
export function getAiProvider(): AiProvider | null {
  const config = getAiConfig();
  if (!config.isAvailable) return null;

  if (config.provider === "mock") {
    return new MockAiProvider();
  }
  if (config.provider === "groq" && config.groqApiKey) {
    return new GroqAiProvider(config.groqApiKey, config.groqModel);
  }
  return null;
}
