import { describe, expect, it } from "vitest";
import { buildCitations } from "@/lib/ai/rag/citations";
import type { RetrievalResult } from "@/lib/ai/rag/types";

describe("buildCitations", () => {
  it("returns no citations for an empty retrieval result", () => {
    expect(buildCitations({ sources: [], structuredFacts: [] })).toEqual([]);
  });

  it("builds an official-source citation from a chunk linked to an official source", () => {
    const retrieval: RetrievalResult = {
      sources: [
        {
          citationType: "official-source",
          chunkId: "chunk-1",
          documentId: "doc-1",
          opportunityId: "opp-1",
          opportunityTitle: "Test Scholarship",
          officialSourceId: "src-1",
          officialSourceLabel: "Official Provider Page",
          officialUrl: "https://example.org/scholarship",
          title: "Excerpt title",
          text: "Full tuition and stipend provided.",
          checkedAt: "2026-01-01T00:00:00.000Z",
          verificationStatus: "verified-source-linked",
          rank: 0.5,
        },
      ],
      structuredFacts: [],
    };

    const citations = buildCitations(retrieval);
    expect(citations).toHaveLength(1);
    expect(citations[0]).toMatchObject({
      citationType: "official-source",
      opportunityId: "opp-1",
      officialSourceId: "src-1",
      sourceChunkId: "chunk-1",
      label: "Official Provider Page",
      url: "https://example.org/scholarship",
    });
  });

  it("builds a structured-data citation from a deadline fact, with no chunk/official-source reference", () => {
    const retrieval: RetrievalResult = {
      sources: [],
      structuredFacts: [
        {
          kind: "deadline",
          citationType: "structured-data",
          opportunityId: "opp-2",
          opportunityTitle: "Another Scholarship",
          label: "Another Scholarship — deadline status",
          attributes: { precision: "exact" },
          officialUrl: "https://example.org/another",
          checkedAt: null,
          verificationStatus: "unverified",
        },
      ],
    };

    const citations = buildCitations(retrieval);
    expect(citations).toHaveLength(1);
    expect(citations[0].sourceChunkId).toBeNull();
    expect(citations[0].officialSourceId).toBeNull();
    expect(citations[0].citationType).toBe("structured-data");
  });

  it("builds a match-explanation citation distinct from structured-data facts", () => {
    const retrieval: RetrievalResult = {
      sources: [],
      structuredFacts: [
        {
          kind: "matching",
          citationType: "match-explanation",
          opportunityId: "opp-3",
          opportunityTitle: "Third Scholarship",
          label: "Third Scholarship — deterministic match result",
          attributes: { "match-label": "possible-fit" },
          officialUrl: null,
          checkedAt: null,
          verificationStatus: "unverified",
        },
      ],
    };

    const citations = buildCitations(retrieval);
    expect(citations[0].citationType).toBe("match-explanation");
  });

  it("falls back to the excerpt title as the label when no official source label is available", () => {
    const retrieval: RetrievalResult = {
      sources: [
        {
          citationType: "structured-data",
          chunkId: "chunk-2",
          documentId: "doc-2",
          opportunityId: null,
          opportunityTitle: null,
          officialSourceId: null,
          officialSourceLabel: null,
          officialUrl: null,
          title: "Staff excerpt without a linked official source",
          text: "Some text.",
          checkedAt: null,
          verificationStatus: "unverified",
          rank: 0,
        },
      ],
      structuredFacts: [],
    };

    expect(buildCitations(retrieval)[0].label).toBe("Staff excerpt without a linked official source");
  });
});
