import { describe, expect, it } from "vitest";
import { trimRetrievalToTokenBudget } from "@/lib/ai/rag/retrieval";
import type { RetrievalResult } from "@/lib/ai/rag/types";

function sourceFixture(chunkId: string, textLength: number): RetrievalResult["sources"][number] {
  return {
    citationType: "official-source",
    chunkId,
    documentId: `doc-${chunkId}`,
    opportunityId: "opp-1",
    opportunityTitle: "Test Scholarship",
    officialSourceId: "src-1",
    officialSourceLabel: "Official Page",
    officialUrl: "https://example.org",
    title: "Excerpt",
    text: "x".repeat(textLength),
    checkedAt: null,
    verificationStatus: "verified-source-linked",
    rank: 1,
  };
}

describe("trimRetrievalToTokenBudget", () => {
  it("keeps everything when well under budget", () => {
    const retrieval: RetrievalResult = { sources: [sourceFixture("c1", 100)], structuredFacts: [] };
    const trimmed = trimRetrievalToTokenBudget(retrieval, 10_000);
    expect(trimmed.sources).toHaveLength(1);
  });

  it("drops lower-priority (later) sources once the budget is exceeded, keeping earlier/higher-rank ones", () => {
    // Each source here is ~1000 chars (~250 tokens); a budget of 300 tokens
    // should keep only the first.
    const retrieval: RetrievalResult = {
      sources: [sourceFixture("c1", 1000), sourceFixture("c2", 1000), sourceFixture("c3", 1000)],
      structuredFacts: [],
    };
    const trimmed = trimRetrievalToTokenBudget(retrieval, 300);
    expect(trimmed.sources.map((s) => s.chunkId)).toEqual(["c1"]);
  });

  it("returns an empty result when the budget is smaller than even the first item", () => {
    const retrieval: RetrievalResult = { sources: [sourceFixture("c1", 10_000)], structuredFacts: [] };
    const trimmed = trimRetrievalToTokenBudget(retrieval, 10);
    expect(trimmed.sources).toHaveLength(0);
  });

  it("bounds structured facts the same way sources are bounded — an unbounded opportunitySlugs list can't blow the prompt budget", () => {
    const manyFacts: RetrievalResult["structuredFacts"] = Array.from({ length: 500 }, (_, i) => ({
      kind: "deadline" as const,
      citationType: "structured-data" as const,
      opportunityId: `opp-${i}`,
      opportunityTitle: `Opportunity ${i}`,
      label: `Opportunity ${i} — deadline status`,
      attributes: { "deadline-status-text": "x".repeat(200) },
      officialUrl: null,
      checkedAt: null,
      verificationStatus: "unverified",
    }));
    const trimmed = trimRetrievalToTokenBudget({ sources: [], structuredFacts: manyFacts }, 2000);
    expect(trimmed.structuredFacts.length).toBeLessThan(manyFacts.length);
  });
});
