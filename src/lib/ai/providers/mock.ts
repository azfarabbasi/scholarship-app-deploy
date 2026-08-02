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
 * trusting a provider — mock or real — to police itself. Every answer below
 * ends with an `[E<id>]` citation tag naming the id of the `<source>`/
 * `<structured-fact>` it was built from, matching the real citation
 * contract every provider (mock or real) must follow — see
 * `src/lib/ai/safety/verify-citations.ts`.
 */

/** Finds the single line (each tag is rendered on its own line by `buildPromptMessages`) containing `needle`, and pulls its own `id="..."` attribute, if any. */
function findEvidenceId(context: string, needle: string): string | null {
  const line = context.split("\n").find((candidate) => candidate.includes(needle));
  if (!line) return null;
  const match = line.match(/\bid="([^"]*)"/);
  return match?.[1] ?? null;
}

/**
 * Inserts the citation tag before the *first* sentence's ending punctuation
 * — every one of this provider's answers states its factual claim in the
 * first sentence and a verify-before-acting disclaimer afterward, so the tag
 * must attach there, not at the end of the whole (possibly multi-sentence)
 * text. This is also the documented convention (`prompt.ts`'s system
 * rules): the tag goes before the punctuation of the sentence it belongs to,
 * e.g. "...2027 [E1]." not "...2027. [E1]" — the latter would let
 * sentence-splitting separate the tag from its claim.
 */
function withCitation(text: string, evidenceId: string | null): string {
  if (!evidenceId) return text;
  const match = text.match(/[.!?]/);
  if (match && typeof match.index === "number") {
    return `${text.slice(0, match.index)} [${evidenceId}]${text.slice(match.index)}`;
  }
  return `${text} [${evidenceId}]`;
}

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
      const evidenceId = findEvidenceId(systemAndContext, 'kind="deadline"');
      if (precision === "exact" && verification === "verified") {
        const dateMatch = systemAndContext.match(/deadline-date="([^"]*)"/);
        return {
          ok: true,
          text: withCitation(
            `Based on ScholarTrack's stored source data, the deadline is ${dateMatch?.[1] ?? "recorded as exact and verified"}. Always verify on the official website before making plans.`,
            evidenceId,
          ),
        };
      }
      return {
        ok: true,
        text: withCitation(
          `The deadline is ${precision}/${verification}, so verify before planning — the available source does not confirm an exact, verified date.`,
          evidenceId,
        ),
      };
    }

    if (/\brequired document|documents\b/.test(question)) {
      const countMatch = systemAndContext.match(/document-count="(\d+)"/);
      const count = countMatch ? Number(countMatch[1]) : 0;
      const evidenceId = findEvidenceId(systemAndContext, 'kind="documents"');
      if (count > 0) {
        return {
          ok: true,
          text: withCitation(
            `Based on ScholarTrack's stored source data, ${count} required-document record(s) are on file for this opportunity. Check the official source for the exact list before applying.`,
            evidenceId,
          ),
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
      const evidenceId = findEvidenceId(systemAndContext, 'kind="matching"');
      if (label) {
        return {
          ok: true,
          text: withCitation(
            `This looks like a ${label.replace(/-/g, " ")}, but it is not a final eligibility decision. Always verify with the official source before applying.`,
            evidenceId,
          ),
        };
      }
      return {
        ok: true,
        text: "I do not have enough verified information to answer that eligibility question — the available source does not confirm it.",
      };
    }

    const citedTitles = sourceTitles.slice(0, 2).join(" and ");
    const firstSourceId = sourceTitles.length > 0 ? findEvidenceId(systemAndContext, `title="${sourceTitles[0]}"`) : null;
    const firstFactId = findEvidenceId(systemAndContext, "<structured-fact");
    const evidenceId = firstSourceId ?? firstFactId;
    return {
      ok: true,
      text: withCitation(
        citedTitles
          ? `Based on ScholarTrack's stored source data (${citedTitles}), here is what's on file — always verify with the official source before relying on it.`
          : "Based on ScholarTrack's stored source data, here is what's on file — always verify with the official source before relying on it.",
        evidenceId,
      ),
    };
  }
}
