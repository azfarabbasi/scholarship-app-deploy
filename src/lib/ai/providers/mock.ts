import type { AiGenerateRequest, AiGenerateResult, AiProvider } from "./types";

/**
 * Deterministic, dependency-free provider used by every automated test and
 * available as `AI_PROVIDER=mock` for local development without a Groq key.
 * It never calls the network. It answers only from the context block the
 * caller already assembled (see `src/lib/ai/assistant.ts`) — it does not
 * "know" anything beyond what's in the prompt, which is exactly what makes
 * its behaviour reproducible in unit and e2e tests.
 *
 * This is intentionally simple pattern matching, not a language model: the
 * safety guarantees Checkpoint 5 requires (never invent a deadline, never
 * claim eligibility, never leak secrets) are enforced by
 * `src/lib/ai/safety/*` *before* and *after* any provider call, never by
 * trusting a provider — mock or real — to police itself.
 */
export class MockAiProvider implements AiProvider {
  readonly name = "mock";

  async generate(request: AiGenerateRequest): Promise<AiGenerateResult> {
    // `buildPromptMessages` always emits [rules, context, user] — only the
    // context message actually carries retrieved material. Scanning every
    // system message (including the rules message, which necessarily
    // *mentions* the tag names while explaining them) would let the mock
    // falsely detect "sources present" from the instructions alone.
    const systemMessages = request.messages.filter((m) => m.role === "system");
    const systemAndContext = systemMessages.at(-1)?.content ?? "";
    const userMessage = request.messages.filter((m) => m.role === "user").map((m) => m.content).join("\n") ?? "";

    const hasSources = /<source\b/i.test(systemAndContext);
    const hasStructuredFacts = /<structured-fact\b/i.test(systemAndContext);
    const question = userMessage.toLowerCase();

    const sourceTitles = [...systemAndContext.matchAll(/<source[^>]*title="([^"]*)"/gi)].map((m) => m[1]);

    if (!hasSources && !hasStructuredFacts) {
      return { ok: true, text: "I do not have enough verified information to answer that." };
    }

    if (/\bdeadline\b/.test(question)) {
      const precisionMatch = systemAndContext.match(/precision="([^"]*)"/);
      const verificationMatch = systemAndContext.match(/deadline-verification="([^"]*)"/);
      const precision = precisionMatch?.[1] ?? "unknown";
      const verification = verificationMatch?.[1] ?? "unverified";
      if (precision === "exact" && verification === "verified") {
        const dateMatch = systemAndContext.match(/deadline-date="([^"]*)"/);
        return {
          ok: true,
          text: `Based on ScholarTrack's stored source data, the deadline is ${dateMatch?.[1] ?? "recorded as exact and verified"}. Always verify on the official website before making plans.`,
        };
      }
      return {
        ok: true,
        text: `The deadline is ${precision}/${verification}, so verify before planning — the available source does not confirm an exact, verified date.`,
      };
    }

    if (/\brequired document|documents\b/.test(question)) {
      const countMatch = systemAndContext.match(/document-count="(\d+)"/);
      const count = countMatch ? Number(countMatch[1]) : 0;
      if (count > 0) {
        return {
          ok: true,
          text: `Based on ScholarTrack's stored source data, ${count} required-document record(s) are on file for this opportunity. Check the official source for the exact list before applying.`,
        };
      }
      return {
        ok: true,
        text: "The available source does not confirm specific document requirements for this opportunity yet.",
      };
    }

    if (/\beligib/.test(question)) {
      const labelMatch = systemAndContext.match(/match-label="([^"]*)"/);
      const label = labelMatch?.[1];
      if (label) {
        return {
          ok: true,
          text: `This looks like a ${label.replace(/-/g, " ")}, but it is not a final eligibility decision. Always verify with the official source before applying.`,
        };
      }
      return {
        ok: true,
        text: "I do not have enough verified information to answer that eligibility question — the available source does not confirm it.",
      };
    }

    const citedTitles = sourceTitles.slice(0, 2).join(" and ");
    return {
      ok: true,
      text: citedTitles
        ? `Based on ScholarTrack's stored source data (${citedTitles}), here is what's on file — always verify with the official source before relying on it.`
        : "Based on ScholarTrack's stored source data, here is what's on file — always verify with the official source before relying on it.",
    };
  }
}
