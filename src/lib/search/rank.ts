import type { CatalogueOpportunity } from "@/lib/catalogue/types";

/** Field weights for relevance scoring — title matches matter far more than a benefit-summary mention. */
const FIELD_WEIGHTS: Record<string, number> = {
  title: 10,
  provider: 6,
  country: 4,
  region: 3,
  fieldOfStudy: 3,
  officialSourceLabel: 2,
  benefitSummary: 1,
  eligibilitySummary: 1,
};

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .trim();
}

/** Dependency-free Levenshtein distance, capped — used only for short single-token typo tolerance, never over full sentences. */
function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    let prevDiag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const temp = prev[j];
      prev[j] = a[i - 1] === b[j - 1] ? prevDiag : 1 + Math.min(prev[j], prev[j - 1], prevDiag);
      prevDiag = temp;
    }
  }
  return prev[b.length];
}

/**
 * True if `token` typo-tolerantly matches anywhere in `haystack` (substring, or a close-edit-distance
 * word for longer query tokens). Fuzzy matching requires at least 5 characters — a 4-character token
 * (e.g. "DAAD") sits at edit-distance 2 from plenty of unrelated 4-letter words (e.g. "grad", as in
 * "graduate"), which produced real false-positive search results before this floor was raised; found
 * via the e2e catalogue search test searching "DAAD" and landing on an unrelated opportunity.
 */
function tokenMatches(haystack: string, token: string): boolean {
  if (haystack.includes(token)) return true;
  if (token.length < 5) return false;
  return haystack.split(/\s+/).some((word) => word.length >= 3 && levenshtein(word, token) <= Math.min(2, Math.floor((token.length - 4) / 3) + 1));
}

export interface FieldScore {
  field: string;
  score: number;
}

/**
 * Pure relevance scorer — no DB access, fully unit-testable. Returns 0 (no
 * match) when the query is empty is handled by the caller; this only scores
 * a non-empty query against one opportunity's public fields.
 */
export function scoreOpportunityAgainstQuery(opportunity: CatalogueOpportunity, query: string): FieldScore[] {
  const tokens = normalize(query).split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return [];

  const fields: Record<string, string> = {
    title: normalize(opportunity.title),
    provider: normalize(opportunity.providerName ?? ""),
    country: normalize(opportunity.countries.join(" ")),
    region: normalize(opportunity.regions.join(" ")),
    fieldOfStudy: normalize(opportunity.studyLevels.join(" ")),
    officialSourceLabel: normalize(opportunity.verification.officialSourceLabel ?? ""),
    benefitSummary: normalize(opportunity.benefitSummary),
    eligibilitySummary: normalize(opportunity.eligibilitySummary),
  };

  const matched: FieldScore[] = [];
  for (const [field, haystack] of Object.entries(fields)) {
    if (!haystack) continue;
    const hits = tokens.filter((token) => tokenMatches(haystack, token)).length;
    if (hits > 0) {
      matched.push({ field, score: (FIELD_WEIGHTS[field] ?? 1) * (hits / tokens.length) });
    }
  }
  return matched;
}

export function totalRelevanceScore(fieldScores: readonly FieldScore[]): number {
  return fieldScores.reduce((sum, f) => sum + f.score, 0);
}
