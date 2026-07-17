/**
 * Provider-agnostic contract every AI backend implements. Deliberately
 * minimal (one-shot chat completion, no streaming, no tool-calling) — enough
 * for a source-grounded Q&A assistant, and small enough that adding a second
 * real provider later never touches call sites outside `src/lib/ai/providers/`.
 */

export interface AiChatMessage {
  role: "system" | "user";
  content: string;
}

export interface AiGenerateRequest {
  messages: readonly AiChatMessage[];
  maxOutputTokens: number;
}

export type AiGenerateResult =
  | { ok: true; text: string }
  /** `error` is always a short, safe-to-display string — never a raw provider error, stack trace, or key fragment. */
  | { ok: false; error: string };

export interface AiProvider {
  readonly name: string;
  generate(request: AiGenerateRequest): Promise<AiGenerateResult>;
}
