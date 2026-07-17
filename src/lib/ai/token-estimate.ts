/**
 * Deliberately has no `server-only` guard (unlike `./config.ts`) and touches
 * no environment variables — pure string arithmetic, safe to import from a
 * CLI script (`scripts/ai-sources-reindex.ts`), a client component, or a
 * server module alike.
 */

/** Rough, dependency-free token estimate (≈4 characters per token) — good enough for a soft input cap, not a real tokenizer. */
export function estimateTokenCount(text: string): number {
  return Math.ceil(text.length / 4);
}
