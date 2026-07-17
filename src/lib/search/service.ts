import "server-only";
import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { getPublishedOpportunities } from "@/lib/catalogue/db-repository";
import { evaluateDeadline } from "@/lib/deadlines/engine";
import type { CatalogueOpportunity } from "@/lib/catalogue/types";
import type { SearchQuery, SearchResponse, SearchResultItem } from "./types";
import { scoreOpportunityAgainstQuery, totalRelevanceScore } from "./rank";

let trgmAvailableCache: boolean | null = null;

/**
 * Whether the `pg_trgm` extension is installed (see
 * `drizzle/0006_discovery_grants_and_search.sql` — it's created best-effort,
 * with a documented ILIKE/Levenshtein fallback when the hosting environment
 * doesn't allow `CREATE EXTENSION`). Checked once per server process.
 */
export async function isTrgmAvailable(): Promise<boolean> {
  if (trgmAvailableCache !== null) return trgmAvailableCache;
  try {
    const db = getDb();
    const rows = await db.execute(sql`select 1 from pg_extension where extname = 'pg_trgm' limit 1`);
    trgmAvailableCache = rows.length > 0;
  } catch {
    trgmAvailableCache = false;
  }
  return trgmAvailableCache;
}

/**
 * Forces the next `isTrgmAvailable()` call to re-check the database instead
 * of trusting the cached, process-lifetime value. Used by the staff "rebuild
 * search index" action so a `pg_trgm` extension installed after this server
 * process started (e.g. by a hosting-provider database admin) is picked up
 * without a redeploy.
 */
export function resetTrgmAvailabilityCache(): void {
  trgmAvailableCache = null;
}

/** Trigram similarity scores for published opportunities whose title/provider name is at all close to `query`. Empty if pg_trgm is unavailable. */
async function trigramScores(query: string): Promise<Map<string, number>> {
  const scores = new Map<string, number>();
  if (!query.trim()) return scores;

  const db = getDb();
  try {
    const rows = await db.execute<{ id: string; score: number }>(sql`
      select o.id as id, greatest(similarity(o.title, ${query}), similarity(p.display_name, ${query})) as score
      from opportunities o
      join providers p on p.id = o.provider_id
      where o.status = 'published'
        and (similarity(o.title, ${query}) > 0.15 or similarity(p.display_name, ${query}) > 0.15)
    `);
    for (const row of rows) {
      scores.set(row.id, Number(row.score));
    }
  } catch {
    // pg_trgm not installed, or `similarity()` unavailable — caller falls back to JS scoring.
  }
  return scores;
}

function matchesFacets(opportunity: CatalogueOpportunity, evaluation: ReturnType<typeof evaluateDeadline>, query: SearchQuery): boolean {
  const intersects = (values: readonly string[], selected: readonly string[]) =>
    selected.length === 0 || values.some((v) => selected.includes(v));

  if (!intersects(opportunity.countries, query.countries)) return false;
  if (!intersects(opportunity.regions, query.regions)) return false;
  if (!intersects(opportunity.studyLevels, query.studyLevels)) return false;
  if (query.opportunityTypes.length > 0 && !query.opportunityTypes.includes(opportunity.opportunityType)) return false;
  if (query.providers.length > 0 && !(opportunity.providerName && query.providers.includes(opportunity.providerName))) return false;
  if (query.deadlineStates.length > 0 && !query.deadlineStates.includes(evaluation.lifecycleStatus)) return false;
  if (query.precisions.length > 0 && !query.precisions.includes(opportunity.deadlineInput.precision)) return false;
  if (query.verificationStatuses.length > 0 && !query.verificationStatuses.includes(opportunity.verification.status)) return false;
  if (query.requiredDocumentsOnly && opportunity.verification.documentCount === 0) return false;
  if (query.eligibilityRulesOnly && opportunity.eligibilityRules.length === 0) return false;
  if (query.fundingCategories.length > 0 && !intersects(opportunity.fundingCategories, query.fundingCategories)) return false;
  if (query.fields.length > 0) {
    const haystack = opportunity.eligibilitySummary.toLowerCase();
    if (!query.fields.some((field) => haystack.includes(field.toLowerCase()))) return false;
  }
  return true;
}

/**
 * The single server-side search entry point. Reads only what
 * `getPublishedOpportunities()` already exposes (published, non-archived,
 * non-draft) — search can never surface anything the public catalogue API
 * itself wouldn't. Filtering/sorting/pagination all happen server-side so a
 * client never needs to fetch the full record set.
 */
export async function searchOpportunities(query: SearchQuery): Promise<SearchResponse> {
  const [allOpportunities, trgmAvailable] = await Promise.all([getPublishedOpportunities(), isTrgmAvailable()]);

  const trgm = trgmAvailable && query.q.trim() ? await trigramScores(query.q) : new Map<string, number>();

  const now = new Date();
  const evaluations = new Map(allOpportunities.map((o) => [o.id, evaluateDeadline(o.deadlineInput, now)]));

  const candidates = allOpportunities.filter((o) => matchesFacets(o, evaluations.get(o.id)!, query));

  let scored: SearchResultItem[] = candidates.map((opportunity) => {
    if (!query.q.trim()) {
      return { opportunity, score: 0, matchedFields: [] };
    }
    const fieldScores = scoreOpportunityAgainstQuery(opportunity, query.q);
    const jsScore = totalRelevanceScore(fieldScores);
    const trgmScore = (trgm.get(opportunity.id) ?? 0) * 10;
    return { opportunity, score: Math.max(jsScore, trgmScore), matchedFields: fieldScores.map((f) => f.field) };
  });

  if (query.q.trim()) {
    scored = scored.filter((item) => item.score > 0);
  }

  const sorted = sortResults(scored, query.sort, evaluations);

  const total = sorted.length;
  const pageCount = Math.max(1, Math.ceil(total / query.pageSize));
  const page = Math.min(query.page, pageCount);
  const start = (page - 1) * query.pageSize;
  const pageItems = sorted.slice(start, start + query.pageSize);

  const suggestions =
    query.q.trim() && total === 0
      ? buildNoResultSuggestions(query, allOpportunities)
      : [];

  return {
    items: pageItems,
    total,
    page,
    pageSize: query.pageSize,
    pageCount,
    sort: query.sort,
    usedTrigramSimilarity: trgm.size > 0,
    suggestions,
  };
}

function sortResults(
  items: SearchResultItem[],
  sort: SearchQuery["sort"],
  evaluations: Map<string, ReturnType<typeof evaluateDeadline>>,
): SearchResultItem[] {
  const copy = [...items];
  switch (sort) {
    case "relevance":
      return copy.sort((a, b) => b.score - a.score || a.opportunity.title.localeCompare(b.opportunity.title));
    case "nearest-deadline":
      return copy.sort((a, b) => {
        const evalA = evaluations.get(a.opportunity.id)!;
        const evalB = evaluations.get(b.opportunity.id)!;
        const rankA = evalA.countdown.allowed && evalA.countdown.days !== null ? evalA.countdown.days : Number.POSITIVE_INFINITY;
        const rankB = evalB.countdown.allowed && evalB.countdown.days !== null ? evalB.countdown.days : Number.POSITIVE_INFINITY;
        return rankA - rankB;
      });
    case "verified-first":
      return copy.sort((a, b) => {
        const rank = { verified: 0, partially_verified: 1, stale: 2, unverified: 3 } as Record<string, number>;
        return (rank[a.opportunity.verification.status] ?? 9) - (rank[b.opportunity.verification.status] ?? 9);
      });
    case "title-asc":
      return copy.sort((a, b) => a.opportunity.title.localeCompare(b.opportunity.title));
    case "recently-updated":
      return copy.sort((a, b) => b.opportunity.updatedAt.localeCompare(a.opportunity.updatedAt));
    default:
      return copy;
  }
}

/** A handful of deterministic, honest suggestions — never invented facts, just "try removing X". */
function buildNoResultSuggestions(query: SearchQuery, allOpportunities: readonly CatalogueOpportunity[]): string[] {
  const suggestions: string[] = [];
  if (query.countries.length > 0 || query.regions.length > 0) {
    suggestions.push("Try removing the country/region filter.");
  }
  if (query.studyLevels.length > 0) {
    suggestions.push("Try removing the study-level filter.");
  }
  if (query.requiredDocumentsOnly || query.eligibilityRulesOnly) {
    suggestions.push("Try turning off the required-document or eligibility-data filter — not every record has structured data yet.");
  }
  if (query.q.trim()) {
    suggestions.push("Try a shorter or more general search term.");
  }
  if (suggestions.length === 0 && allOpportunities.length > 0) {
    suggestions.push("Browse the full catalogue without any filters.");
  }
  return suggestions;
}
