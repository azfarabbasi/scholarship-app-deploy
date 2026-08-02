import type { StructuredFact } from "./types";

/**
 * Deadline and eligibility questions are the two highest-stakes categories an
 * assistant can get wrong — an invented deadline can cause a missed
 * application, and an invented eligibility guarantee can cause a wasted or
 * misdirected one. For these two categories, when the retrieval already
 * contains the relevant `StructuredFact`(s), this module answers directly
 * from a fixed template built from those facts' own fields — never calling
 * an AI provider at all, so there is zero hallucination surface for exactly
 * the two claim types Checkpoint 5's safety policy singles out.
 *
 * Returns `null` when the question doesn't clearly match the category, or
 * when no relevant fact was retrieved — in both cases the caller falls
 * through to the normal provider-backed path (or, if there's no context at
 * all, the not-enough-info fast path in `src/lib/ai/assistant.ts`).
 */

const DEADLINE_QUESTION_PATTERN = /\bdeadline\b|\bdue\s+date\b|\bwhen\s+(is|are)\s+(the\s+)?applications?\s+due\b/i;
const ELIGIBILITY_QUESTION_PATTERN = /\beligib|\bam\s+i\s+(a\s+)?(good\s+)?fit\b|\bqualif/i;

export interface DeterministicAnswer {
  text: string;
  /** The exact facts this answer was built from — the caller cites exactly these, nothing more. */
  usedFacts: StructuredFact[];
}

export function isDeadlineQuestion(question: string): boolean {
  return DEADLINE_QUESTION_PATTERN.test(question);
}

export function isEligibilityQuestion(question: string): boolean {
  return ELIGIBILITY_QUESTION_PATTERN.test(question);
}

function deadlineSentence(fact: StructuredFact): string {
  const title = fact.opportunityTitle ?? "This opportunity";
  const precision = fact.attributes.precision ?? "unknown";
  const verification = fact.attributes["deadline-verification"] ?? "unverified";
  const date = fact.attributes["deadline-date"];
  const statusText = fact.attributes["deadline-status-text"];

  if (precision === "exact" && verification === "verified" && date) {
    return `${title}'s deadline is ${date}, according to ScholarTrack's stored source data.`;
  }
  if (statusText) {
    return `${title}: ${statusText}`;
  }
  return `${title}'s deadline is recorded as ${precision}/${verification} — the available source does not confirm an exact, verified date.`;
}

/** Returns `null` if the question isn't a deadline question or no deadline fact was retrieved. */
export function buildDeterministicDeadlineAnswer(question: string, facts: readonly StructuredFact[]): DeterministicAnswer | null {
  if (!isDeadlineQuestion(question)) return null;
  const deadlineFacts = facts.filter((fact) => fact.kind === "deadline");
  if (deadlineFacts.length === 0) return null;

  const sentences = deadlineFacts.map(deadlineSentence);
  const text = `${sentences.join(" ")} Always verify with the official source before making plans.`;
  return { text, usedFacts: [...deadlineFacts] };
}

function matchSentence(fact: StructuredFact): string {
  const title = fact.opportunityTitle ?? "This opportunity";
  const label = (fact.attributes["match-label"] ?? "possible fit").replace(/-/g, " ");
  return `${title} looks like a ${label} based on ScholarTrack's deterministic matching engine.`;
}

/** Returns `null` if the question isn't an eligibility question or no matching fact was retrieved. */
export function buildDeterministicEligibilityAnswer(question: string, facts: readonly StructuredFact[]): DeterministicAnswer | null {
  if (!isEligibilityQuestion(question)) return null;
  const matchFacts = facts.filter((fact) => fact.kind === "matching");
  if (matchFacts.length === 0) return null;

  const sentences = matchFacts.map(matchSentence);
  const text = `${sentences.join(" ")} This is not a final eligibility decision — always verify with the official source before applying.`;
  return { text, usedFacts: [...matchFacts] };
}
