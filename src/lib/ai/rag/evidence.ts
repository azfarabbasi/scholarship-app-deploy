import type { RetrievalResult } from "./types";

/**
 * Assigns a short, stable, per-request evidence id ("E1", "E2", ...) to every
 * retrieved source and structured fact, in order (sources first, then
 * facts — the order doesn't matter for correctness, only that it's
 * deterministic within one request). These ids are what the prompt renders
 * as `<source id="E1">`/`<structured-fact id="E2">` and what the model is
 * required to cite inline for every factual claim — see
 * `src/lib/ai/rag/prompt.ts` and `src/lib/ai/safety/verify-citations.ts`.
 *
 * Deliberately a pure, separate step (not done inline in `retrieval.ts`) so
 * every caller — the real pipeline, the mock provider, the evaluation
 * harness, tests — assigns ids the exact same way.
 */
export function assignEvidenceIds(retrieval: RetrievalResult): RetrievalResult {
  let counter = 0;
  const nextId = () => {
    counter += 1;
    return `E${counter}`;
  };

  return {
    sources: retrieval.sources.map((source) => ({ ...source, evidenceId: nextId() })),
    structuredFacts: retrieval.structuredFacts.map((fact) => ({ ...fact, evidenceId: nextId() })),
  };
}

/** The set of every valid evidence id in a (post-`assignEvidenceIds`) retrieval result. */
export function collectEvidenceIds(retrieval: RetrievalResult): Set<string> {
  const ids = new Set<string>();
  for (const source of retrieval.sources) {
    if (source.evidenceId) ids.add(source.evidenceId);
  }
  for (const fact of retrieval.structuredFacts) {
    if (fact.evidenceId) ids.add(fact.evidenceId);
  }
  return ids;
}
