import { describe, expect, it } from "vitest";
import { evaluateDeadline } from "@/lib/deadlines/engine";
import type { DeadlineEvaluationInput } from "@/lib/deadlines/types";
import type { CatalogueOpportunity, EnrichedOpportunity } from "@/lib/catalogue/types";
import {
  DEFAULT_CATALOGUE_FILTERS,
  countActiveFilters,
  deriveFilterOptions,
  filterOpportunities,
  sortOpportunities,
} from "@/lib/catalogue/search";
import type { WorkspaceRecord } from "@/lib/storage/types";

const NOW = new Date("2027-01-15T12:00:00Z");

function makeOpportunity(overrides: Partial<CatalogueOpportunity> & { deadlineInput: DeadlineEvaluationInput }): CatalogueOpportunity {
  return {
    kind: "built-in",
    id: overrides.id ?? "built-in-1",
    legacyId: 1,
    slug: overrides.slug ?? "test-opportunity",
    title: overrides.title ?? "Test Opportunity",
    opportunityType: "scholarship",
    providerName: null,
    countries: overrides.countries ?? ["Germany"],
    regions: overrides.regions ?? [],
    studyLevels: overrides.studyLevels ?? ["Master"],
    benefitSummary: overrides.benefitSummary ?? "Full funding",
    eligibilitySummary: overrides.eligibilitySummary ?? "Open to all applicants with a strong record",
    officialUrl: "https://example.invalid",
    verificationNotes: null,
    deadlineRawText: "Some date",
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: overrides.updatedAt ?? "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function enrich(opportunity: CatalogueOpportunity, workspace: WorkspaceRecord | null = null): EnrichedOpportunity {
  return { opportunity, evaluation: evaluateDeadline(opportunity.deadlineInput, NOW), workspace };
}

const exactFutureInput: DeadlineEvaluationInput = {
  cycleYear: 2027,
  precision: "exact",
  verificationStatus: "verified",
  recurrence: { cadence: "none", automaticDateGenerationAllowed: false },
  occurrences: [
    {
      kind: "closing",
      scope: "universal",
      scopeReference: null,
      rawText: "Closes 1 March 2027",
      officialUrl: null,
      lastCheckedAt: null,
      sourceTimezone: "UTC",
      sourceDate: "2027-03-01",
      sourceDateTime: null,
      projectedDate: null,
    },
  ],
};

const rollingInput: DeadlineEvaluationInput = {
  cycleYear: null,
  precision: "rolling",
  verificationStatus: "unverified",
  recurrence: { cadence: "none", automaticDateGenerationAllowed: false },
  occurrences: [],
};

describe("catalogue search: text query", () => {
  it("matches on title, country, and eligibility text", () => {
    const items = [
      enrich(makeOpportunity({ id: "a", title: "DAAD Scholarship", countries: ["Germany"], deadlineInput: exactFutureInput })),
      enrich(makeOpportunity({ id: "b", title: "Erasmus Grant", countries: ["France"], eligibilitySummary: "requires a research proposal", deadlineInput: rollingInput })),
    ];

    expect(filterOpportunities(items, { ...DEFAULT_CATALOGUE_FILTERS, query: "daad" })).toHaveLength(1);
    expect(filterOpportunities(items, { ...DEFAULT_CATALOGUE_FILTERS, query: "france" })).toHaveLength(1);
    expect(filterOpportunities(items, { ...DEFAULT_CATALOGUE_FILTERS, query: "research proposal" })).toHaveLength(1);
    expect(filterOpportunities(items, { ...DEFAULT_CATALOGUE_FILTERS, query: "nonexistent" })).toHaveLength(0);
  });
});

describe("catalogue search: filters", () => {
  const germany = enrich(makeOpportunity({ id: "a", countries: ["Germany"], studyLevels: ["Master"], deadlineInput: exactFutureInput }));
  const franceRolling = enrich(makeOpportunity({ id: "b", countries: ["France"], studyLevels: ["PhD"], deadlineInput: rollingInput }));
  const items = [germany, franceRolling];

  it("filters by country", () => {
    const result = filterOpportunities(items, { ...DEFAULT_CATALOGUE_FILTERS, countries: ["France"] });
    expect(result.map((i) => i.opportunity.id)).toEqual(["b"]);
  });

  it("filters by study level", () => {
    const result = filterOpportunities(items, { ...DEFAULT_CATALOGUE_FILTERS, studyLevels: ["PhD"] });
    expect(result.map((i) => i.opportunity.id)).toEqual(["b"]);
  });

  it("filters by deadline lifecycle state", () => {
    const result = filterOpportunities(items, { ...DEFAULT_CATALOGUE_FILTERS, deadlineStates: ["rolling"] });
    expect(result.map((i) => i.opportunity.id)).toEqual(["b"]);
  });

  it("filters by verification-required state", () => {
    // exact+verified+tz -> not verification-required; rolling+unverified -> verification-required
    const result = filterOpportunities(items, { ...DEFAULT_CATALOGUE_FILTERS, verificationRequiredOnly: true });
    expect(result.map((i) => i.opportunity.id)).toEqual(["b"]);
  });

  it("combines multiple filters (AND semantics)", () => {
    const result = filterOpportunities(items, {
      ...DEFAULT_CATALOGUE_FILTERS,
      countries: ["Germany"],
      studyLevels: ["Master"],
    });
    expect(result.map((i) => i.opportunity.id)).toEqual(["a"]);

    const noMatch = filterOpportunities(items, {
      ...DEFAULT_CATALOGUE_FILTERS,
      countries: ["Germany"],
      studyLevels: ["PhD"],
    });
    expect(noMatch).toHaveLength(0);
  });

  it("computes an active filter count", () => {
    expect(countActiveFilters(DEFAULT_CATALOGUE_FILTERS)).toBe(0);
    expect(
      countActiveFilters({ ...DEFAULT_CATALOGUE_FILTERS, countries: ["Germany"], shortlistedOnly: true }),
    ).toBe(2);
  });

  it("resetting filters returns to the default (no filters active)", () => {
    const active = { ...DEFAULT_CATALOGUE_FILTERS, countries: ["Germany"], rollingOnly: true };
    expect(countActiveFilters(active)).toBeGreaterThan(0);
    expect(countActiveFilters(DEFAULT_CATALOGUE_FILTERS)).toBe(0);
  });

  it("derives unique filter options from an arbitrary opportunity list (built-in + custom)", () => {
    const options = deriveFilterOptions(items.map((i) => i.opportunity));
    expect(options.countries.sort()).toEqual(["France", "Germany"]);
    expect(options.studyLevels.sort()).toEqual(["Master", "PhD"]);
  });
});

describe("catalogue sort", () => {
  it("sorts by nearest reliable deadline first, uncertain deadlines last", () => {
    const soon = enrich(
      makeOpportunity({
        id: "soon",
        deadlineInput: {
          ...exactFutureInput,
          occurrences: [{ ...exactFutureInput.occurrences[0], sourceDate: "2027-01-20" }],
        },
      }),
    );
    const far = enrich(makeOpportunity({ id: "far", deadlineInput: exactFutureInput }));
    const uncertain = enrich(makeOpportunity({ id: "uncertain", deadlineInput: rollingInput }));

    const sorted = sortOpportunities([far, uncertain, soon], "nearest-deadline");
    expect(sorted.map((i) => i.opportunity.id)).toEqual(["soon", "far", "uncertain"]);
  });

  it("an uncertain (unverified/rolling) deadline never sorts ahead of a reliable exact one", () => {
    const unverifiedExact = enrich(
      makeOpportunity({
        id: "unverified",
        deadlineInput: { ...exactFutureInput, verificationStatus: "unverified" },
      }),
    );
    const verifiedExact = enrich(makeOpportunity({ id: "verified", deadlineInput: exactFutureInput }));

    const sorted = sortOpportunities([unverifiedExact, verifiedExact], "nearest-deadline");
    expect(sorted[0].opportunity.id).toBe("verified");
  });

  it("sorts titles A-Z", () => {
    const b = enrich(makeOpportunity({ id: "b", title: "Beta", deadlineInput: rollingInput }));
    const a = enrich(makeOpportunity({ id: "a", title: "Alpha", deadlineInput: rollingInput }));
    expect(sortOpportunities([b, a], "title-asc").map((i) => i.opportunity.title)).toEqual(["Alpha", "Beta"]);
  });

  it("sorts by country A-Z", () => {
    const b = enrich(makeOpportunity({ id: "b", countries: ["Zambia"], deadlineInput: rollingInput }));
    const a = enrich(makeOpportunity({ id: "a", countries: ["Austria"], deadlineInput: rollingInput }));
    expect(sortOpportunities([b, a], "country-asc").map((i) => i.opportunity.id)).toEqual(["a", "b"]);
  });

  it("custom opportunities appear correctly alongside built-in ones", () => {
    const custom = enrich(
      makeOpportunity({ id: "custom-1", kind: "custom", title: "My custom award", deadlineInput: rollingInput }),
    );
    const builtIn = enrich(makeOpportunity({ id: "built-in-1", deadlineInput: exactFutureInput }));
    const items = [custom, builtIn];
    expect(filterOpportunities(items, { ...DEFAULT_CATALOGUE_FILTERS, origin: ["custom"] }).map((i) => i.opportunity.id)).toEqual([
      "custom-1",
    ]);
    expect(items.find((i) => i.opportunity.kind === "custom")?.opportunity.id).toBe("custom-1");
  });
});
