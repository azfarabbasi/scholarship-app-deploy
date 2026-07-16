/**
 * Pure duplicate-detection signals — no DB access, so these are directly
 * unit-testable. `runDuplicateDetection` in
 * `src/lib/db/actions/duplicates.ts` fetches candidate rows and calls these
 * functions to decide what to insert into `duplicate_candidates`; detection
 * only ever creates review candidates, never merges anything automatically.
 */

export interface DuplicateDetectionCandidate {
  id: string;
  title: string;
  providerId: string;
  applicationUrl: string | null;
  officialWebsiteUrl: string | null;
  legacyMigrationReference: string | null;
}

export interface DetectedDuplicatePair {
  aId: string;
  bId: string;
  reason: string;
  confidenceScore: number;
}

function normalizeUrl(url: string | null): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    return `${parsed.hostname.replace(/^www\./, "")}${parsed.pathname.replace(/\/+$/, "")}`.toLowerCase();
  } catch {
    return url.trim().toLowerCase();
  }
}

function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Token-based Jaccard similarity — dependency-free stand-in for pg_trgm fuzzy matching. */
function titleSimilarity(a: string, b: string): number {
  const tokensA = new Set(normalizeTitle(a).split(" ").filter(Boolean));
  const tokensB = new Set(normalizeTitle(b).split(" ").filter(Boolean));
  if (tokensA.size === 0 || tokensB.size === 0) return 0;
  const intersection = [...tokensA].filter((t) => tokensB.has(t)).length;
  const union = new Set([...tokensA, ...tokensB]).size;
  return intersection / union;
}

const FUZZY_TITLE_THRESHOLD = 0.6;

export function detectDuplicatePairs(candidates: readonly DuplicateDetectionCandidate[]): DetectedDuplicatePair[] {
  const results: DetectedDuplicatePair[] = [];

  for (let i = 0; i < candidates.length; i += 1) {
    for (let j = i + 1; j < candidates.length; j += 1) {
      const a = candidates[i];
      const b = candidates[j];

      // Legacy migration collision: same legacy seed record imported twice.
      if (a.legacyMigrationReference && a.legacyMigrationReference === b.legacyMigrationReference) {
        results.push({ aId: a.id, bId: b.id, reason: "Same legacy migration reference", confidenceScore: 1 });
        continue;
      }

      const urlA = normalizeUrl(a.applicationUrl) ?? normalizeUrl(a.officialWebsiteUrl);
      const urlB = normalizeUrl(b.applicationUrl) ?? normalizeUrl(b.officialWebsiteUrl);
      if (urlA && urlB && urlA === urlB) {
        results.push({ aId: a.id, bId: b.id, reason: `Identical official URL (${urlA})`, confidenceScore: 0.95 });
        continue;
      }

      const sameProvider = a.providerId === b.providerId;
      const titleMatch = normalizeTitle(a.title) === normalizeTitle(b.title);
      if (sameProvider && titleMatch) {
        results.push({ aId: a.id, bId: b.id, reason: "Same provider and normalized title", confidenceScore: 0.9 });
        continue;
      }

      const similarity = titleSimilarity(a.title, b.title);
      if (sameProvider && similarity >= FUZZY_TITLE_THRESHOLD) {
        results.push({
          aId: a.id,
          bId: b.id,
          reason: `Similar title under the same provider (similarity ${similarity.toFixed(2)})`,
          confidenceScore: Math.min(0.85, 0.5 + similarity / 2),
        });
      }
    }
  }

  return results;
}
