import type { aiCitationSourceTypeEnum } from "@/lib/db/schema/enums";

export type AiCitationSourceType = (typeof aiCitationSourceTypeEnum.enumValues)[number];

/**
 * One approved, publicly-retrievable excerpt of official-source text (an
 * `ai_source_chunk` row joined back to its parent document/opportunity/
 * official source). Never includes draft, rejected, or stale material — see
 * `src/lib/ai/rag/retrieval.ts`.
 */
export interface RetrievedChunkSource {
  citationType: "official-source" | "structured-data";
  chunkId: string;
  documentId: string;
  opportunityId: string | null;
  opportunityTitle: string | null;
  officialSourceId: string | null;
  officialSourceLabel: string | null;
  officialUrl: string | null;
  title: string;
  text: string;
  checkedAt: string | null;
  verificationStatus: string | null;
  rank: number;
  /**
   * Short, stable per-request identifier (e.g. "E1") assigned by
   * `assignEvidenceIds` (see `./evidence.ts`) — never set by retrieval
   * itself. This is what the prompt renders as the `<source id="...">`
   * attribute and what the model is required to cite inline for every
   * factual claim it draws from this source.
   */
  evidenceId?: string;
}

/**
 * A deterministically-computed fact (deadline status, document count,
 * eligibility rule text, funding category, or a matching-engine result) —
 * never free text an LLM produced. Rendered into the prompt as a
 * `<structured-fact>` tag and, separately, into a citation the UI can show
 * without ever needing to trust the provider's own account of where a claim
 * came from.
 */
export interface StructuredFact {
  kind: "deadline" | "documents" | "eligibility" | "funding" | "matching" | "workspace";
  citationType: AiCitationSourceType;
  opportunityId: string | null;
  opportunityTitle: string | null;
  label: string;
  attributes: Record<string, string>;
  officialUrl: string | null;
  checkedAt: string | null;
  verificationStatus: string | null;
  /** Same purpose as `RetrievedChunkSource.evidenceId` — see there. */
  evidenceId?: string;
}

export interface RetrievalResult {
  sources: RetrievedChunkSource[];
  structuredFacts: StructuredFact[];
}

export const EMPTY_RETRIEVAL_RESULT: RetrievalResult = { sources: [], structuredFacts: [] };

export function hasAnyContext(result: RetrievalResult): boolean {
  return result.sources.length > 0 || result.structuredFacts.length > 0;
}
