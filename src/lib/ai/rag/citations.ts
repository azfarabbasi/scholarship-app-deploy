import type { AiCitationSourceType, RetrievalResult } from "./types";

/** Everything needed to render a citation in the UI or persist an `ai_answer_citations` row — the caller adds `messageId`/`studentProfileId`. */
export interface CitationDraft {
  citationType: AiCitationSourceType;
  opportunityId: string | null;
  officialSourceId: string | null;
  sourceChunkId: string | null;
  label: string;
  url: string | null;
  verificationStatus: string | null;
  checkedAt: string | null;
}

/**
 * Builds citations for only the evidence the answer actually cited by id
 * (see `src/lib/ai/safety/verify-citations.ts`) — never "everything
 * retrieved" regardless of use. Every source/fact passed to
 * `buildPromptMessages` was assigned an `evidenceId`
 * (`src/lib/ai/rag/evidence.ts`); `citedEvidenceIds` is the set the
 * post-generation citation check confirmed the model actually referenced
 * with a real, non-hallucinated id. Passing `undefined` (used only by
 * deterministic fast-path answers that bypass the provider entirely, and
 * therefore have no model-emitted citation tags to check) falls back to
 * citing everything retrieved for that fast path, since in that case the
 * "evidence" IS the entire, deterministically-derived context.
 */
export function buildCitations(retrieval: RetrievalResult, citedEvidenceIds?: ReadonlySet<string>): CitationDraft[] {
  const sources = citedEvidenceIds ? retrieval.sources.filter((source) => source.evidenceId && citedEvidenceIds.has(source.evidenceId)) : retrieval.sources;
  const facts = citedEvidenceIds ? retrieval.structuredFacts.filter((fact) => fact.evidenceId && citedEvidenceIds.has(fact.evidenceId)) : retrieval.structuredFacts;

  const fromSources: CitationDraft[] = sources.map((source) => ({
    citationType: source.citationType,
    opportunityId: source.opportunityId,
    officialSourceId: source.officialSourceId,
    sourceChunkId: source.chunkId,
    label: source.officialSourceLabel ?? source.title,
    url: source.officialUrl,
    verificationStatus: source.verificationStatus,
    checkedAt: source.checkedAt,
  }));

  const fromFacts: CitationDraft[] = facts.map((fact) => ({
    citationType: fact.citationType,
    opportunityId: fact.opportunityId,
    officialSourceId: null,
    sourceChunkId: null,
    label: fact.label,
    url: fact.officialUrl,
    verificationStatus: fact.verificationStatus,
    checkedAt: fact.checkedAt,
  }));

  return [...fromSources, ...fromFacts];
}
