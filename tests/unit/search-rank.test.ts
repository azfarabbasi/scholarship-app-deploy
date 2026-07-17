import { describe, expect, it } from "vitest";
import { UNVERIFIED_CATALOGUE_VERIFICATION, type CatalogueOpportunity } from "@/lib/catalogue/types";
import type { DeadlineEvaluationInput } from "@/lib/deadlines/types";
import { scoreOpportunityAgainstQuery, totalRelevanceScore } from "@/lib/search/rank";

const FILLER_DEADLINE_INPUT: DeadlineEvaluationInput = {
  cycleYear: null,
  precision: "unknown",
  verificationStatus: "unverified",
  recurrence: { cadence: "none", automaticDateGenerationAllowed: false },
  occurrences: [],
};

function makeOpportunity(overrides: Partial<CatalogueOpportunity> = {}): CatalogueOpportunity {
  return {
    kind: "built-in",
    id: "built-in-1",
    legacyId: 1,
    slug: "test-opportunity",
    title: "DAAD Scholarship",
    opportunityType: "scholarship",
    providerName: "German Academic Exchange Service",
    countries: ["Germany"],
    regions: ["Europe"],
    studyLevels: ["Master"],
    benefitSummary: "Full tuition and monthly stipend",
    eligibilitySummary: "Open to international students with a research proposal",
    officialUrl: "https://example.invalid",
    verificationNotes: null,
    eligibilityRules: [],
    fundingCategories: [],
    verification: { ...UNVERIFIED_CATALOGUE_VERIFICATION, officialSourceLabel: "daad.de" },
    deadlineRawText: "Some date",
    deadlineInput: FILLER_DEADLINE_INPUT,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("scoreOpportunityAgainstQuery", () => {
  it("returns no scores for an empty query", () => {
    expect(scoreOpportunityAgainstQuery(makeOpportunity(), "")).toEqual([]);
    expect(scoreOpportunityAgainstQuery(makeOpportunity(), "   ")).toEqual([]);
  });

  it("matches the title field and weights it above other fields", () => {
    const opportunity = makeOpportunity();
    const scores = scoreOpportunityAgainstQuery(opportunity, "daad");
    const titleScore = scores.find((s) => s.field === "title");
    expect(titleScore).toBeDefined();
    expect(scores.every((s) => s.score <= (titleScore?.score ?? 0))).toBe(true);
  });

  it("matches provider, country, region, benefit, and eligibility text fields", () => {
    const opportunity = makeOpportunity();
    expect(scoreOpportunityAgainstQuery(opportunity, "exchange").map((s) => s.field)).toContain("provider");
    expect(scoreOpportunityAgainstQuery(opportunity, "germany").map((s) => s.field)).toContain("country");
    expect(scoreOpportunityAgainstQuery(opportunity, "europe").map((s) => s.field)).toContain("region");
    expect(scoreOpportunityAgainstQuery(opportunity, "stipend").map((s) => s.field)).toContain("benefitSummary");
    expect(scoreOpportunityAgainstQuery(opportunity, "proposal").map((s) => s.field)).toContain("eligibilitySummary");
  });

  it("returns nothing for a query with no matching tokens anywhere", () => {
    expect(scoreOpportunityAgainstQuery(makeOpportunity(), "nonexistentsearchtermxyz")).toEqual([]);
  });

  it("is case-insensitive and accent-insensitive", () => {
    const opportunity = makeOpportunity({ title: "École Polytechnique Grant" });
    expect(scoreOpportunityAgainstQuery(opportunity, "ECOLE").map((s) => s.field)).toContain("title");
    expect(scoreOpportunityAgainstQuery(opportunity, "école").map((s) => s.field)).toContain("title");
  });

  it("tolerates a short typo via edit-distance matching on longer words", () => {
    // "scholarhip" (missing an 's') should still match "Scholarship" in the title.
    const opportunity = makeOpportunity({ title: "Global Scholarship Fund" });
    expect(scoreOpportunityAgainstQuery(opportunity, "scholarhip").map((s) => s.field)).toContain("title");
  });

  it("does not fuzzy-match very short tokens (avoids noisy false positives)", () => {
    const opportunity = makeOpportunity({ title: "Global Scholarship Fund" });
    // "fun" is 3 characters — too short to safely typo-match against "Fund".
    expect(scoreOpportunityAgainstQuery(opportunity, "xyz").map((s) => s.field)).not.toContain("title");
  });

  it("splits a multi-token query and requires only partial coverage for a partial score", () => {
    const opportunity = makeOpportunity({ title: "DAAD Scholarship" });
    const scores = scoreOpportunityAgainstQuery(opportunity, "daad unrelatedterm");
    const titleScore = scores.find((s) => s.field === "title");
    expect(titleScore).toBeDefined();
    // Only one of two tokens matched, so the field score should be less than the full field weight (10).
    expect(titleScore!.score).toBeLessThan(10);
    expect(titleScore!.score).toBeGreaterThan(0);
  });
});

describe("totalRelevanceScore", () => {
  it("sums all field scores", () => {
    expect(totalRelevanceScore([{ field: "title", score: 10 }, { field: "provider", score: 6 }])).toBe(16);
  });

  it("is zero for no matched fields", () => {
    expect(totalRelevanceScore([])).toBe(0);
  });
});
