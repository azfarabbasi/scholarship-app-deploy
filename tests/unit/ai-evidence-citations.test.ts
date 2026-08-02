import { describe, expect, it } from "vitest";
import { assignEvidenceIds, collectEvidenceIds } from "@/lib/ai/rag/evidence";
import { verifyCitations } from "@/lib/ai/safety/verify-citations";
import type { RetrievalResult } from "@/lib/ai/rag/types";

function sourceFixture(overrides: Partial<RetrievalResult["sources"][number]> = {}): RetrievalResult["sources"][number] {
  return {
    citationType: "official-source",
    chunkId: "chunk-1",
    documentId: "doc-1",
    opportunityId: "opp-1",
    opportunityTitle: "Test Scholarship",
    officialSourceId: "src-1",
    officialSourceLabel: "Official Page",
    officialUrl: "https://example.org",
    title: "Excerpt",
    text: "Full tuition provided.",
    checkedAt: null,
    verificationStatus: "verified-source-linked",
    rank: 0.5,
    ...overrides,
  };
}

describe("assignEvidenceIds", () => {
  it("assigns sequential ids to sources then structured facts, in order", () => {
    const retrieval: RetrievalResult = {
      sources: [sourceFixture(), sourceFixture({ chunkId: "chunk-2" })],
      structuredFacts: [
        {
          kind: "deadline",
          citationType: "structured-data",
          opportunityId: "opp-1",
          opportunityTitle: "Test Scholarship",
          label: "deadline",
          attributes: {},
          officialUrl: null,
          checkedAt: null,
          verificationStatus: "unverified",
        },
      ],
    };

    const result = assignEvidenceIds(retrieval);
    expect(result.sources.map((s) => s.evidenceId)).toEqual(["E1", "E2"]);
    expect(result.structuredFacts.map((f) => f.evidenceId)).toEqual(["E3"]);
  });

  it("is a pure function — does not mutate the input", () => {
    const retrieval: RetrievalResult = { sources: [sourceFixture()], structuredFacts: [] };
    assignEvidenceIds(retrieval);
    expect(retrieval.sources[0].evidenceId).toBeUndefined();
  });
});

describe("collectEvidenceIds", () => {
  it("collects every assigned id into a set", () => {
    const retrieval: RetrievalResult = { sources: [sourceFixture()], structuredFacts: [] };
    const withIds = assignEvidenceIds(retrieval);
    expect(collectEvidenceIds(withIds)).toEqual(new Set(["E1"]));
  });

  it("returns an empty set for an empty retrieval", () => {
    expect(collectEvidenceIds({ sources: [], structuredFacts: [] })).toEqual(new Set());
  });
});

describe("verifyCitations", () => {
  const validIds = new Set(["E1", "E2"]);

  it("keeps a sentence with a valid citation and strips the bracket tag from the visible text", () => {
    const result = verifyCitations("The deadline is 1 March 2027. [E1]", validIds);
    expect(result.text).toBe("The deadline is 1 March 2027.");
    expect(result.citedEvidenceIds).toEqual(new Set(["E1"]));
    expect(result.modified).toBe(false);
  });

  it("keeps a sentence citing multiple valid ids", () => {
    const result = verifyCitations("Funding differs between the two. [E1, E2]", validIds);
    expect(result.citedEvidenceIds).toEqual(new Set(["E1", "E2"]));
    expect(result.text).toBe("Funding differs between the two.");
  });

  it("strips a sentence with no citation tag at all", () => {
    const result = verifyCitations("The deadline is definitely 1 March 2027.", validIds);
    expect(result.modified).toBe(true);
    expect(result.text).toBe("I do not have enough verified information to answer that.");
  });

  it("strips a sentence citing an id that was never actually provided (hallucinated evidence id)", () => {
    const result = verifyCitations("The deadline is 1 March 2027. [E99]", validIds);
    expect(result.modified).toBe(true);
    expect(result.citedEvidenceIds.size).toBe(0);
    expect(result.text).toBe("I do not have enough verified information to answer that.");
  });

  it("strips a sentence mixing one valid and one hallucinated id, rather than trusting the valid half", () => {
    const result = verifyCitations("The deadline is 1 March 2027. [E1, E99]", validIds);
    expect(result.modified).toBe(true);
    expect(result.citedEvidenceIds.size).toBe(0);
  });

  it("keeps an uncited disclaimer/meta sentence without requiring a citation", () => {
    const result = verifyCitations("The deadline is 1 March 2027 [E1]. Always verify with the official source before making plans.", validIds);
    expect(result.text).toContain("Always verify with the official source before making plans.");
    expect(result.modified).toBe(false);
  });

  it("keeps the standard not-enough-information sentence without a citation", () => {
    const result = verifyCitations("I do not have enough verified information to answer that.", validIds);
    expect(result.modified).toBe(false);
    expect(result.text).toBe("I do not have enough verified information to answer that.");
  });

  it("strips some sentences and keeps others independently within one answer", () => {
    const result = verifyCitations("The deadline is 1 March 2027 [E1]. You will definitely be accepted.", validIds);
    expect(result.text).toBe("The deadline is 1 March 2027.");
    expect(result.citedEvidenceIds).toEqual(new Set(["E1"]));
    expect(result.modified).toBe(true);
  });

  it("falls back to the standard not-enough-information text when every sentence is stripped", () => {
    const result = verifyCitations("This is invented. This is also invented.", new Set());
    expect(result.text).toBe("I do not have enough verified information to answer that.");
    expect(result.citedEvidenceIds.size).toBe(0);
  });
});
