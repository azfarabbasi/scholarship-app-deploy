import { splitIntoSentences } from "./validate-output";

/**
 * Enforces the citation rule from `src/lib/ai/rag/prompt.ts`'s system
 * message: every factual sentence must carry at least one `[E<number>]`
 * citation tag naming a real evidence id from this request's own retrieval
 * result. This is what turns "please cite your sources" from a prompt-level
 * request (which a model can ignore or hallucinate) into an enforced
 * guarantee — a sentence with no citation, or citing only an id that was
 * never actually provided, is stripped from the answer rather than trusted.
 *
 * A small allowlist of non-factual "meta" sentences (disclaimers, the
 * standard not-enough-information fallback, verify-with-source reminders) is
 * exempt — requiring a citation on "Always verify with the official source"
 * would be nonsensical.
 */

const CITATION_TAG_PATTERN = /\[\s*(E\d+(?:\s*,\s*E\d+)*)\s*\]/gi;

const UNCITED_ALLOWLIST_PATTERNS = [
  /do not have enough verified information/i,
  /verify (this|the|with|critical)/i,
  /always verify/i,
  /not a final (eligibility|admission|funding)?\s*decision/i,
  /planning aids? only/i,
  /check the official source/i,
];

function extractCitedIds(sentence: string): string[] {
  const ids: string[] = [];
  for (const match of sentence.matchAll(CITATION_TAG_PATTERN)) {
    for (const raw of match[1].split(",")) {
      ids.push(raw.trim().toUpperCase());
    }
  }
  return ids;
}

function stripCitationTags(sentence: string): string {
  // Consumes a preceding space along with the tag itself — "2027 [E1]." must
  // become "2027." not "2027 ." — then collapses any remaining doubled
  // whitespace left by removing a tag from mid-sentence.
  return sentence
    .replace(/\s*\[\s*E\d+(?:\s*,\s*E\d+)*\s*\]/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isExemptFromCitation(sentence: string): boolean {
  return UNCITED_ALLOWLIST_PATTERNS.some((pattern) => pattern.test(sentence));
}

const CITATION_ONLY_PATTERN = /^\[\s*E\d+(?:\s*,\s*E\d+)*\s*\]$/i;

/**
 * The documented convention (`src/lib/ai/rag/prompt.ts`'s system rules) puts
 * a citation tag *before* a sentence's final punctuation specifically so
 * sentence-splitting never separates it from its claim — but a real
 * provider won't always follow that exactly. If it puts the tag *after* the
 * period instead, `splitIntoSentences` turns the tag into its own trailing
 * fragment (a "sentence" that's nothing but "[E1]"), which would otherwise
 * make the real claim before it look uncited. Re-attaching any such
 * fragment to the sentence before it makes verification robust to either
 * placement.
 */
function mergeTrailingCitationFragments(sentences: readonly string[]): string[] {
  const merged: string[] = [];
  for (const sentence of sentences) {
    if (CITATION_ONLY_PATTERN.test(sentence.trim()) && merged.length > 0) {
      merged[merged.length - 1] = `${merged[merged.length - 1]} ${sentence.trim()}`;
    } else {
      merged.push(sentence);
    }
  }
  return merged;
}

export interface CitationVerificationResult {
  /** The answer text with every `[E#]` marker removed — never shown raw to the end user. */
  text: string;
  /** Every evidence id actually cited by a sentence that survived verification — the only ids `buildCitations` should turn into a citation. */
  citedEvidenceIds: ReadonlySet<string>;
  /** True if at least one sentence was stripped for lacking a valid citation. */
  modified: boolean;
}

/**
 * `validEvidenceIds` must be the exact set assigned to this request's own
 * retrieval result (see `src/lib/ai/rag/evidence.ts`) — never a wider or
 * previous-request set, or a hallucinated id from an unrelated prior answer
 * could pass as "valid".
 */
export function verifyCitations(rawText: string, validEvidenceIds: ReadonlySet<string>): CitationVerificationResult {
  const citedEvidenceIds = new Set<string>();
  let modified = false;

  const sentences = mergeTrailingCitationFragments(splitIntoSentences(rawText));

  const kept = sentences.filter((sentence) => {
    const citedIds = extractCitedIds(sentence);

    if (citedIds.length === 0) {
      if (isExemptFromCitation(sentence)) return true;
      modified = true;
      return false;
    }

    const allValid = citedIds.every((id) => validEvidenceIds.has(id));
    if (!allValid) {
      // At least one cited id doesn't exist in this request's evidence —
      // either hallucinated or left over from unrelated context. Strip the
      // whole sentence rather than guessing which part of it is trustworthy.
      modified = true;
      return false;
    }

    citedIds.forEach((id) => citedEvidenceIds.add(id));
    return true;
  });

  if (kept.length === 0) {
    return { text: "I do not have enough verified information to answer that.", citedEvidenceIds: new Set(), modified: true };
  }

  return { text: kept.map(stripCitationTags).join(" ").trim(), citedEvidenceIds, modified };
}
