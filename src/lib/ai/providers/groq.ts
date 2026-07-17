import "server-only";
import type { AiGenerateRequest, AiGenerateResult, AiProvider } from "./types";

const GROQ_CHAT_COMPLETIONS_URL = "https://api.groq.com/openai/v1/chat/completions";
const REQUEST_TIMEOUT_MS = 20_000;

/**
 * Groq's chat-completions endpoint is OpenAI-compatible, so this is a plain
 * `fetch` — no vendor SDK dependency. `apiKey` is passed in explicitly by the
 * caller (`getAiProvider()` in `./index.ts`), which reads it from
 * `getAiConfig()` — this class never reads `process.env` itself, and is only
 * ever imported by server-side code (`import "server-only"` above). The key
 * is used exactly once, in the `Authorization` header of this one request;
 * it is never logged, never echoed back in an error message, and never
 * reaches a response the browser can read.
 */
export class GroqAiProvider implements AiProvider {
  readonly name = "groq";

  constructor(
    private readonly apiKey: string,
    private readonly model: string,
  ) {}

  async generate(request: AiGenerateRequest): Promise<AiGenerateResult> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(GROQ_CHAT_COMPLETIONS_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          messages: request.messages.map((m) => ({ role: m.role, content: m.content })),
          max_tokens: request.maxOutputTokens,
          temperature: 0.2,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        // Never surface the provider's own response body — it can include
        // request-echoing diagnostics we don't want to expose to a caller.
        return { ok: false, error: `AI provider request failed (status ${response.status}).` };
      }

      const data = (await response.json()) as {
        choices?: { message?: { content?: string } }[];
      };
      const text = data.choices?.[0]?.message?.content?.trim();
      if (!text) {
        return { ok: false, error: "AI provider returned an empty response." };
      }
      return { ok: true, text };
    } catch (error) {
      const isAbort = error instanceof Error && error.name === "AbortError";
      return { ok: false, error: isAbort ? "AI provider request timed out." : "AI provider request failed." };
    } finally {
      clearTimeout(timeout);
    }
  }
}
