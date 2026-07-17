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
 * Every source/structured-fact actually placed in the prompt becomes a
 * citation candidate — see `docs/checkpoint-5/checkpoint-5-architecture.md`
 * for why Checkpoint 5 cites "everything retrieved" rather than attempting
 * fine-grained sentence-to-source attribution: it is simpler, deterministic,
 * and never UNDER-cites a claim the provider made from this context.
 */
export function buildCitations(retrieval: RetrievalResult): CitationDraft[] {
  const fromSources: CitationDraft[] = retrieval.sources.map((source) => ({
    citationType: source.citationType,
    opportunityId: source.opportunityId,
    officialSourceId: source.officialSourceId,
    sourceChunkId: source.chunkId,
    label: source.officialSourceLabel ?? source.title,
    url: source.officialUrl,
    verificationStatus: source.verificationStatus,
    checkedAt: source.checkedAt,
  }));

  const fromFacts: CitationDraft[] = retrieval.structuredFacts.map((fact) => ({
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
