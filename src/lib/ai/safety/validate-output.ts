import { MATCH_DISCLAIMER } from "@/lib/matching/types";

/**
 * Post-generation safety net, independent of the pre-flight intent
 * classifier (`./intent-classifier.ts`) and of whichever provider produced
 * the text. Even a legitimate, on-topic question can produce an
 * over-confident answer from a real model — this scans the *output* for the
 * exact classes of claim Checkpoint 5 prohibits (final eligibility
 * guarantees, invented certainty, leaked-secret-shaped strings) and strips
 * only the offending sentence(s) rather than discarding an otherwise-useful
 * answer.
 */

const PROHIBITED_CLAIM_PATTERNS = [
  /you\s+are\s+eligible\b/gi,
  /you('re| are)\s+guaranteed\b/gi,
  /you\s+will\s+(definitely\s+)?get\s+(this|the)\s+(scholarship|internship|opportunity|award)/gi,
  /you\s+will\s+(be\s+)?(accepted|admitted)\b/gi,
  /\b100%\s+eligible\b/gi,
  /guaranteed\s+(admission|acceptance|eligibility)/gi,
  /I\s+checked\s+the\s+website\s+today/gi,
];

/** Groq/OpenAI-style key prefixes and generic bearer-token shapes — defense in depth; a provider should never echo one of these. */
const SECRET_SHAPED_PATTERNS = [/\bgsk_[A-Za-z0-9]{10,}/g, /\bsk-[A-Za-z0-9]{10,}/g, /\bBearer\s+[A-Za-z0-9._-]{20,}/gi];

function splitIntoSentences(text: string): string[] {
  return text.split(/(?<=[.!?])\s+/).filter((s) => s.trim().length > 0);
}

export interface OutputValidationResult {
  text: string;
  /** True when at least one sentence was removed or a secret-shaped string was redacted. */
  modified: boolean;
}

/**
 * Removes any sentence containing a prohibited claim and redacts any
 * secret-shaped substring wherever it appears. If every sentence is removed,
 * falls back to the standard cautious "not enough information" phrasing
 * rather than returning an empty string.
 */
export function validateAssistantOutput(rawText: string): OutputValidationResult {
  let modified = false;
  let text = rawText;

  for (const pattern of SECRET_SHAPED_PATTERNS) {
    if (pattern.test(text)) {
      modified = true;
      text = text.replace(pattern, "[redacted]");
    }
  }

  const sentences = splitIntoSentences(text);
  const kept = sentences.filter((sentence) => {
    const isProhibited = PROHIBITED_CLAIM_PATTERNS.some((pattern) => new RegExp(pattern.source, pattern.flags).test(sentence));
    if (isProhibited) modified = true;
    return !isProhibited;
  });

  if (kept.length === 0) {
    return { text: "I do not have enough verified information to answer that.", modified: true };
  }

  let result = kept.join(" ").trim();
  if (modified && !result.includes(MATCH_DISCLAIMER) && !/verify (this|the|with)/i.test(result)) {
    result = `${result} Always verify with the official source before relying on this.`;
  }
  return { text: result, modified };
}
