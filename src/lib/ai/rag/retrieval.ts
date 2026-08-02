import "server-only";
import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { getPublishedOpportunities } from "@/lib/catalogue/db-repository";
import type { CatalogueOpportunity } from "@/lib/catalogue/types";
import type { MatchResult } from "@/lib/matching/types";
import { estimateTokenCount } from "@/lib/ai/token-estimate";
import { buildMatchStructuredFact, buildOpportunityStructuredFacts } from "./structured-facts";
import { EMPTY_RETRIEVAL_RESULT, type RetrievedChunkSource, type RetrievalResult, type StructuredFact } from "./types";

/** Rough per-item overhead (tag name, attributes, id) added on top of a source/fact's own text when estimating its prompt-token cost. */
const PER_ITEM_TOKEN_OVERHEAD = 20;

/**
 * Bounds the *total* context assembled into the prompt, independent of the
 * user's own question length (`AiConfig.maxInputTokens` only bounds that).
 * Chunk count is already capped by `maxChunks`/`DEFAULT_MAX_CHUNKS` and each
 * chunk's own length by `chunking.ts`'s `maxChars`, but structured facts have
 * no such ceiling — a caller naming many opportunities (e.g. a comparison or
 * workspace-planning question) generates one set of facts per opportunity,
 * which is otherwise unbounded. Sources are already ordered by relevance
 * (`rank desc` in `searchApprovedChunks`) and facts are processed in the
 * caller-supplied order, so keeping items front-to-back until the budget is
 * spent keeps the highest-priority material.
 */
export function trimRetrievalToTokenBudget(retrieval: RetrievalResult, maxTokens: number): RetrievalResult {
  let used = 0;
  const sources: RetrievedChunkSource[] = [];
  for (const source of retrieval.sources) {
    const cost = estimateTokenCount(source.text) + PER_ITEM_TOKEN_OVERHEAD;
    if (used + cost > maxTokens) break;
    sources.push(source);
    used += cost;
  }

  const structuredFacts: StructuredFact[] = [];
  for (const fact of retrieval.structuredFacts) {
    const cost = estimateTokenCount(Object.values(fact.attributes).join(" ")) + PER_ITEM_TOKEN_OVERHEAD;
    if (used + cost > maxTokens) break;
    structuredFacts.push(fact);
    used += cost;
  }

  return { sources, structuredFacts };
}

/**
 * The RAG retrieval boundary described in
 * `docs/checkpoint-5/checkpoint-5-architecture.md`: the ONLY two kinds of
 * material that ever reach the assistant prompt are (a) approved,
 * publicly-retrievable source chunks, found here via PostgreSQL's built-in
 * full-text search (`tsvector`/`websearch_to_tsquery` — no extension, no
 * embeddings provider required), and (b) deterministically computed
 * structured facts derived from the same published data the public catalogue
 * already exposes. Draft/rejected/stale chunks, unpublished opportunities,
 * and staff-only tables are never queried here at all — not filtered out
 * after the fact, simply never selected.
 */

const DEFAULT_MAX_CHUNKS = 6;

interface ChunkRow {
  [key: string]: unknown;
  chunk_id: string;
  document_id: string;
  opportunity_id: string | null;
  opportunity_title: string | null;
  official_source_id: string | null;
  official_source_label: string | null;
  official_url: string | null;
  title: string;
  text: string;
  /**
   * A `coalesce(...)` of two timestamp columns, not a plain column
   * reference — `postgres-js`'s raw `db.execute()` (unlike the typed query
   * builder) doesn't reliably parse a computed expression's result back into
   * a JS `Date`, so this can arrive as either a `Date` or an ISO string
   * depending on environment. `toChunkSource` below normalizes it with
   * `new Date(...)`, which accepts both.
   */
  checked_at: Date | string | null;
  rank: number;
}

function toChunkSource(row: ChunkRow): RetrievedChunkSource {
  return {
    citationType: row.official_source_id ? "official-source" : "structured-data",
    chunkId: row.chunk_id,
    documentId: row.document_id,
    opportunityId: row.opportunity_id,
    opportunityTitle: row.opportunity_title,
    officialSourceId: row.official_source_id,
    officialSourceLabel: row.official_source_label,
    officialUrl: row.official_url,
    title: row.title,
    text: row.text,
    checkedAt: row.checked_at ? new Date(row.checked_at).toISOString() : null,
    verificationStatus: row.official_source_id ? "verified-source-linked" : "unverified",
    rank: Number(row.rank),
  };
}

/** Full-text search against approved, publicly-visible chunks. Falls back to a plain ILIKE scan if `tsvector`/`websearch_to_tsquery` is unavailable for any reason. */
async function searchApprovedChunks(question: string, opportunityIds: string[], maxChunks: number): Promise<RetrievedChunkSource[]> {
  const trimmed = question.trim();
  if (trimmed.length === 0) {
    return [];
  }
  const db = getDb();
  const scopeClause =
    opportunityIds.length > 0
      ? sql`and c.opportunity_id in (${sql.join(
          opportunityIds.map((id) => sql`${id}`),
          sql`, `,
        )})`
      : sql``;

  try {
    const rows = await db.execute<ChunkRow>(sql`
      select
        c.id as chunk_id,
        c.document_id as document_id,
        c.opportunity_id as opportunity_id,
        o.title as opportunity_title,
        d.official_source_id as official_source_id,
        os.label as official_source_label,
        coalesce(os.url, o.official_website_url) as official_url,
        d.title as title,
        c.chunk_text as text,
        coalesce(d.checked_at, os.last_checked_at) as checked_at,
        ts_rank(c.chunk_text_search, websearch_to_tsquery('english', ${trimmed})) as rank
      from ai_source_chunks c
      join ai_source_documents d on d.id = c.document_id
      left join opportunities o on o.id = c.opportunity_id and o.status = 'published'
      left join official_sources os on os.id = d.official_source_id
      where c.status = 'approved'
        and (c.opportunity_id is null or o.id is not null)
        and c.chunk_text_search @@ websearch_to_tsquery('english', ${trimmed})
        ${scopeClause}
      order by rank desc
      limit ${maxChunks}
    `);
    return rows.map(toChunkSource);
  } catch {
    const likePattern = `%${trimmed.replace(/[%_]/g, "")}%`;
    const rows = await db.execute<ChunkRow & { rank: number }>(sql`
      select
        c.id as chunk_id,
        c.document_id as document_id,
        c.opportunity_id as opportunity_id,
        o.title as opportunity_title,
        d.official_source_id as official_source_id,
        os.label as official_source_label,
        coalesce(os.url, o.official_website_url) as official_url,
        d.title as title,
        c.chunk_text as text,
        coalesce(d.checked_at, os.last_checked_at) as checked_at,
        0 as rank
      from ai_source_chunks c
      join ai_source_documents d on d.id = c.document_id
      left join opportunities o on o.id = c.opportunity_id and o.status = 'published'
      left join official_sources os on os.id = d.official_source_id
      where c.status = 'approved'
        and (c.opportunity_id is null or o.id is not null)
        and c.chunk_text ilike ${likePattern}
        ${scopeClause}
      limit ${maxChunks}
    `);
    return rows.map(toChunkSource);
  }
}

export interface RetrieveOptions {
  question: string;
  /** Restricts both chunk search and structured facts to these published opportunities. Empty = search across all approved public chunks. */
  opportunitySlugs?: string[];
  /** Deterministic matching-engine output, keyed by opportunity slug — supplied only by the matching-explanation surface, never computed here. */
  matchResults?: ReadonlyMap<string, MatchResult>;
  maxChunks?: number;
}

function resolveOpportunities(all: CatalogueOpportunity[], slugs: string[]): CatalogueOpportunity[] {
  if (slugs.length === 0) return [];
  const bySlug = new Map(all.map((o) => [o.slug, o]));
  return slugs.map((slug) => bySlug.get(slug)).filter((o): o is CatalogueOpportunity => o !== undefined);
}

/**
 * Assembles everything the assistant is allowed to answer from: matching
 * approved source chunks plus structured facts for any opportunities the
 * caller named. `matchResults` (when supplied) adds one additional
 * `match-explanation` fact per named opportunity — the assistant may explain
 * that result, never recompute or override it.
 *
 * `opportunitySlugs` has two distinct empty-ish states that must never be
 * confused: omitted/`[]` means "no scope requested — search across all
 * approved public chunks" (the general-assistant case), while one or more
 * slugs that resolve to zero real published opportunities means "an invalid
 * scope was requested" (e.g. a stale, mistyped, or tampered-with slug) — that
 * must return an empty result, never silently fall back to the unscoped
 * global search, which would otherwise leak unrelated opportunities' content
 * into an answer the caller framed as being about one specific (bogus) one.
 */
export async function retrieveForQuestion(options: RetrieveOptions): Promise<RetrievalResult> {
  const { question, opportunitySlugs = [], matchResults, maxChunks = DEFAULT_MAX_CHUNKS } = options;

  const allOpportunities = await getPublishedOpportunities();
  const targetOpportunities = resolveOpportunities(allOpportunities, opportunitySlugs);

  if (opportunitySlugs.length > 0 && targetOpportunities.length === 0) {
    return EMPTY_RETRIEVAL_RESULT;
  }

  const opportunityIds = targetOpportunities.map((o) => o.id);

  const [sources] = await Promise.all([searchApprovedChunks(question, opportunityIds, maxChunks)]);

  const structuredFacts = targetOpportunities.flatMap((opportunity) => {
    const facts = buildOpportunityStructuredFacts(opportunity);
    const match = matchResults?.get(opportunity.slug);
    return match ? [...facts, buildMatchStructuredFact(opportunity, match)] : facts;
  });

  return { sources, structuredFacts };
}
