import "server-only";
import { z } from "zod";

/**
 * AI configuration — deliberately isolated from `src/lib/env.ts`'s
 * `getServerEnv()`. That function throws when Supabase/database config is
 * missing, which would make an unrelated AI env problem take down every
 * other feature. This module never throws: a missing/malformed AI variable
 * always resolves to a safe "AI unavailable" default, never a build or
 * request failure. See `docs/checkpoint-5/checkpoint-5-architecture.md`.
 */

const AI_PROVIDERS = ["groq", "mock"] as const;
export type AiProviderName = (typeof AI_PROVIDERS)[number];

const booleanFlag = z
  .string()
  .optional()
  .transform((value) => value === "true")
  .pipe(z.boolean());

const aiEnvSchema = z.object({
  AI_ENABLED: booleanFlag,
  AI_PROVIDER: z.enum(AI_PROVIDERS).default("groq"),
  GROQ_API_KEY: z.string().optional(),
  GROQ_MODEL: z.string().min(1).default("llama-3.1-8b-instant"),
  AI_MAX_INPUT_TOKENS: z.coerce.number().int().positive().max(32_000).default(2000),
  AI_MAX_OUTPUT_TOKENS: z.coerce.number().int().positive().max(4000).default(700),
  AI_DAILY_GUEST_LIMIT: z.coerce.number().int().nonnegative().default(10),
  AI_DAILY_USER_LIMIT: z.coerce.number().int().nonnegative().default(30),
  AI_LOG_RETENTION_DAYS: z.coerce.number().int().positive().max(365).default(30),
});

export interface AiConfig {
  enabled: boolean;
  provider: AiProviderName;
  groqApiKey: string | null;
  groqModel: string;
  maxInputTokens: number;
  maxOutputTokens: number;
  dailyGuestLimit: number;
  dailyUserLimit: number;
  logRetentionDays: number;
  /** True only when AI is enabled AND the configured provider can actually run (mock always can; groq needs a key). */
  isAvailable: boolean;
}

const DEFAULTS = aiEnvSchema.parse({});

let cached: AiConfig | null = null;

/**
 * Never throws. Reads `process.env` fresh only the first call (cached after
 * that, matching `getPublicEnv()`'s pattern) and always returns a complete,
 * safe-by-default config — an unset or malformed variable degrades to
 * "AI unavailable", never a crash.
 */
export function getAiConfig(): AiConfig {
  if (cached) return cached;

  const result = aiEnvSchema.safeParse({
    AI_ENABLED: process.env.AI_ENABLED,
    AI_PROVIDER: process.env.AI_PROVIDER,
    GROQ_API_KEY: process.env.GROQ_API_KEY,
    GROQ_MODEL: process.env.GROQ_MODEL,
    AI_MAX_INPUT_TOKENS: process.env.AI_MAX_INPUT_TOKENS,
    AI_MAX_OUTPUT_TOKENS: process.env.AI_MAX_OUTPUT_TOKENS,
    AI_DAILY_GUEST_LIMIT: process.env.AI_DAILY_GUEST_LIMIT,
    AI_DAILY_USER_LIMIT: process.env.AI_DAILY_USER_LIMIT,
    AI_LOG_RETENTION_DAYS: process.env.AI_LOG_RETENTION_DAYS,
  });

  const data = result.success ? result.data : DEFAULTS;
  const groqApiKey = data.GROQ_API_KEY?.trim() ? data.GROQ_API_KEY.trim() : null;
  const providerReady = data.AI_PROVIDER === "mock" || Boolean(groqApiKey);

  cached = {
    enabled: data.AI_ENABLED,
    provider: data.AI_PROVIDER,
    groqApiKey,
    groqModel: data.GROQ_MODEL,
    maxInputTokens: data.AI_MAX_INPUT_TOKENS,
    maxOutputTokens: data.AI_MAX_OUTPUT_TOKENS,
    dailyGuestLimit: data.AI_DAILY_GUEST_LIMIT,
    dailyUserLimit: data.AI_DAILY_USER_LIMIT,
    logRetentionDays: data.AI_LOG_RETENTION_DAYS,
    isAvailable: data.AI_ENABLED && providerReady,
  };
  return cached;
}

/** Test-only: clears the module-level cache so a test can simulate a different env. */
export function resetAiConfigCacheForTests(): void {
  cached = null;
}
