import { describe, expect, it } from "vitest";
import { planningMatchLabels } from "@/lib/planning/labels";
import { UNVERIFIED_CATALOGUE_VERIFICATION, type CatalogueOpportunity } from "@/lib/catalogue/types";
import { DEFAULT_PLANNING_PREFERENCES, type PlanningPreferences } from "@/lib/storage/types";
import type { DeadlineEvaluationInput } from "@/lib/deadlines/types";

const rollingInput: DeadlineEvaluationInput = {
  cycleYear: null,
  precision: "rolling",
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
    title: "Test Opportunity",
    opportunityType: "scholarship",
    providerName: null,
    countries: ["Germany"],
    regions: [],
    studyLevels: ["Master"],
    benefitSummary: "Full funding",
    eligibilitySummary: "Open to all",
    officialUrl: null,
    verificationNotes: null,
    eligibilityRules: [],
    fundingCategories: [],
    verification: UNVERIFIED_CATALOGUE_VERIFICATION,
    deadlineInput: rollingInput,
    deadlineRawText: "Rolling",
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("planning preference match labels", () => {
  it("flags a matching study level", () => {
    const opportunity = makeOpportunity({ studyLevels: ["Master", "PhD"] });
    const preferences: PlanningPreferences = { ...DEFAULT_PLANNING_PREFERENCES, preferredStudyLevels: ["Master"] };
    expect(planningMatchLabels(opportunity, preferences)).toContain("Matches your preferred study level");
  });

  it("flags a matching country", () => {
    const opportunity = makeOpportunity({ countries: ["Germany"] });
    const preferences: PlanningPreferences = { ...DEFAULT_PLANNING_PREFERENCES, preferredCountries: ["Germany"] };
    expect(planningMatchLabels(opportunity, preferences)).toContain("Matches a preferred country");
  });

  it("does not flag a non-matching study level or country", () => {
    const opportunity = makeOpportunity({ studyLevels: ["PhD"], countries: ["France"] });
    const preferences: PlanningPreferences = {
      ...DEFAULT_PLANNING_PREFERENCES,
      preferredStudyLevels: ["Master"],
      preferredCountries: ["Germany"],
    };
    const labels = planningMatchLabels(opportunity, preferences);
    expect(labels).not.toContain("Matches your preferred study level");
    expect(labels).not.toContain("Matches a preferred country");
  });

  it("reports insufficient information when no planning preferences are set", () => {
    const opportunity = makeOpportunity();
    expect(planningMatchLabels(opportunity, DEFAULT_PLANNING_PREFERENCES)).toContain(
      "Not enough information to assess timing",
    );
  });

  it("never asserts formal eligibility — only informational labels are returned", () => {
    const opportunity = makeOpportunity();
    const preferences: PlanningPreferences = {
      ...DEFAULT_PLANNING_PREFERENCES,
      preferredStudyLevels: ["Master"],
      targetIntakeYear: 2027,
    };
    const labels = planningMatchLabels(opportunity, preferences);
    for (const label of labels) {
      expect(label).not.toMatch(/eligible|guaranteed|qualifies/i);
    }
  });

  it("suggests preparing for a future cycle when the opportunity's cycle is later than the target intake", () => {
    const opportunity = makeOpportunity({
      deadlineInput: {
        cycleYear: 2029,
        precision: "exact",
        verificationStatus: "unverified",
        recurrence: { cadence: "none", automaticDateGenerationAllowed: false },
        occurrences: [],
      },
    });
    const preferences: PlanningPreferences = { ...DEFAULT_PLANNING_PREFERENCES, targetIntakeYear: 2027 };
    expect(planningMatchLabels(opportunity, preferences)).toContain("Prepare for a future cycle");
  });
});
