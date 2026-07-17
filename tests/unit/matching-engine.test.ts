import { describe, expect, it } from "vitest";
import { UNVERIFIED_CATALOGUE_VERIFICATION, type CatalogueOpportunity, type CatalogueVerificationInfo, type PublicEligibilityRule } from "@/lib/catalogue/types";
import type { DeadlineEvaluationInput, DeadlineEvaluationResult } from "@/lib/deadlines/types";
import { evaluateMatch } from "@/lib/matching/engine";
import { MATCH_DISCLAIMER } from "@/lib/matching/types";
import { EMPTY_ELIGIBILITY_ANSWERS, type EligibilityAnswers } from "@/lib/schemas/eligibility-answers";
import { DEFAULT_PLANNING_PREFERENCES, type PlanningPreferences } from "@/lib/storage/types";

// The matching engine never reads `opportunity.deadlineInput` directly (it takes an
// already-evaluated `DeadlineEvaluationResult` instead) — this is just a valid filler
// so `makeOpportunity()` satisfies the `CatalogueOpportunity` type.
const FILLER_DEADLINE_INPUT: DeadlineEvaluationInput = {
  cycleYear: null,
  precision: "unknown",
  verificationStatus: "unverified",
  recurrence: { cadence: "none", automaticDateGenerationAllowed: false },
  occurrences: [],
};

function makeRule(overrides: Partial<PublicEligibilityRule> = {}): PublicEligibilityRule {
  return {
    kind: "nationality",
    fieldKey: "nationality",
    operator: "in",
    expectedValue: ["germany"],
    unit: null,
    explanation: "Open to German nationals.",
    ...overrides,
  };
}

function makeOpportunity(overrides: Partial<CatalogueOpportunity> = {}): CatalogueOpportunity {
  return {
    kind: "built-in",
    id: "built-in-1",
    legacyId: 1,
    slug: "test-opportunity",
    title: "Test Opportunity",
    opportunityType: "scholarship",
    providerName: "Test Provider",
    countries: ["Germany"],
    regions: [],
    studyLevels: ["Master"],
    benefitSummary: "Full funding",
    eligibilitySummary: "Open to all applicants with a strong record",
    officialUrl: "https://example.invalid",
    verificationNotes: null,
    eligibilityRules: [],
    fundingCategories: [],
    verification: UNVERIFIED_CATALOGUE_VERIFICATION,
    deadlineRawText: "Some date",
    deadlineInput: FILLER_DEADLINE_INPUT,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function makeVerification(overrides: Partial<CatalogueVerificationInfo> = {}): CatalogueVerificationInfo {
  return { ...UNVERIFIED_CATALOGUE_VERIFICATION, ...overrides };
}

function makeDeadlineEvaluation(overrides: Partial<DeadlineEvaluationResult> = {}): DeadlineEvaluationResult {
  return {
    lifecycleStatus: "open",
    studentFacingLabel: "Apply now",
    colorState: "green",
    statusText: "Open",
    verificationRequired: false,
    countdown: { allowed: true, state: "days-remaining", days: 30, unavailableReason: null },
    selectedOccurrence: null,
    occurrences: [],
    multipleDeadlines: false,
    structurallyInvalid: false,
    ...overrides,
  };
}

const answers: EligibilityAnswers = { ...EMPTY_ELIGIBILITY_ANSWERS, nationality: "Germany" };
const planning: PlanningPreferences = DEFAULT_PLANNING_PREFERENCES;
const openDeadline = makeDeadlineEvaluation();

describe("matching engine: disclaimer and shape", () => {
  it("always returns the standard disclaimer, verbatim", () => {
    const result = evaluateMatch(makeOpportunity(), EMPTY_ELIGIBILITY_ANSWERS, planning, openDeadline);
    expect(result.disclaimer).toBe(MATCH_DISCLAIMER);
  });
});

describe("matching engine: label determination", () => {
  it("labels 'not-enough-rule-data' when there are no rules, no preference match, and no answers at all", () => {
    const result = evaluateMatch(makeOpportunity(), EMPTY_ELIGIBILITY_ANSWERS, DEFAULT_PLANNING_PREFERENCES, openDeadline);
    expect(result.label).toBe("not-enough-rule-data");
    expect(result.confidence).toBe("low");
  });

  it("labels 'missing-information' when there are no rules but the student has answered something with no preference overlap", () => {
    const opportunity = makeOpportunity({ countries: ["France"] });
    const someAnswers: EligibilityAnswers = { ...EMPTY_ELIGIBILITY_ANSWERS, nationality: "Spain" };
    const result = evaluateMatch(opportunity, someAnswers, DEFAULT_PLANNING_PREFERENCES, openDeadline);
    expect(result.label).toBe("missing-information");
  });

  it("labels 'possible-fit' (low confidence) when there are no rules but a planning preference overlaps", () => {
    const opportunity = makeOpportunity({ countries: ["Germany"] });
    const withPreference: PlanningPreferences = { ...DEFAULT_PLANNING_PREFERENCES, preferredCountries: ["Germany"] };
    const result = evaluateMatch(opportunity, EMPTY_ELIGIBILITY_ANSWERS, withPreference, openDeadline);
    expect(result.label).toBe("possible-fit");
    expect(result.confidence).toBe("low");
    expect(result.missingInfoReasons.some((r) => r.text.includes("No structured official eligibility rule"))).toBe(true);
  });

  it("labels 'strong-potential-fit' (high confidence) when every rule matches and eligibility is verified", () => {
    const opportunity = makeOpportunity({
      eligibilityRules: [makeRule()],
      verification: makeVerification({ eligibilityVerified: true, eligibilityRuleCount: 1 }),
    });
    const result = evaluateMatch(opportunity, answers, planning, openDeadline);
    expect(result.label).toBe("strong-potential-fit");
    expect(result.confidence).toBe("high");
    expect(result.positiveReasons).toHaveLength(1);
    expect(result.positiveReasons[0].source).toBe("eligibility-rule");
  });

  it("labels 'needs-verification' (medium confidence) when every rule matches but eligibility is not verified", () => {
    const opportunity = makeOpportunity({
      eligibilityRules: [makeRule()],
      verification: makeVerification({ eligibilityVerified: false, eligibilityRuleCount: 1 }),
    });
    const result = evaluateMatch(opportunity, answers, planning, openDeadline);
    expect(result.label).toBe("needs-verification");
    expect(result.confidence).toBe("medium");
    expect(result.verificationNotes.some((n) => n.includes("requires verification"))).toBe(true);
  });

  it("labels 'possible-fit' (medium confidence) when some rules match and some are missing answers", () => {
    const opportunity = makeOpportunity({
      eligibilityRules: [makeRule(), makeRule({ kind: "work-experience", fieldKey: "workExperienceYears", operator: "greater-than-or-equal", expectedValue: 2 })],
      verification: makeVerification({ eligibilityVerified: true, eligibilityRuleCount: 2 }),
    });
    const result = evaluateMatch(opportunity, answers, planning, openDeadline);
    expect(result.label).toBe("possible-fit");
    expect(result.confidence).toBe("medium");
    expect(result.missingInfoReasons).toHaveLength(1);
    expect(result.missingInfoReasons[0].source).toBe("eligibility-rule");
  });

  it("labels 'missing-information' when the only rule can't be checked at all (no matches, no mismatches)", () => {
    const opportunity = makeOpportunity({
      eligibilityRules: [makeRule({ kind: "age", fieldKey: "age", operator: "greater-than-or-equal", expectedValue: 18 })],
    });
    const result = evaluateMatch(opportunity, answers, planning, openDeadline);
    expect(result.label).toBe("missing-information");
    expect(result.missingInfoReasons).toHaveLength(1);
  });

  it("labels 'likely-not-a-fit' whenever any formal rule mismatches, regardless of other matches", () => {
    const opportunity = makeOpportunity({
      eligibilityRules: [makeRule({ expectedValue: ["france"] }), makeRule({ kind: "research-experience", fieldKey: "researchExperience", operator: "equals" })],
    });
    const researchAnswers: EligibilityAnswers = { ...answers, researchExperience: "yes" };
    const result = evaluateMatch(opportunity, researchAnswers, planning, openDeadline);
    expect(result.label).toBe("likely-not-a-fit");
    expect(result.mismatchReasons).toHaveLength(1);
    // one match + one mismatch: mismatchCount is not greater than matchedCount, so confidence is medium.
    expect(result.confidence).toBe("medium");
  });

  it("labels 'likely-not-a-fit' with high confidence when mismatches outnumber matches", () => {
    const opportunity = makeOpportunity({ eligibilityRules: [makeRule({ expectedValue: ["france"] })] });
    const result = evaluateMatch(opportunity, answers, planning, openDeadline);
    expect(result.label).toBe("likely-not-a-fit");
    expect(result.confidence).toBe("high");
  });

  it("labels 'deadline-risk' when the current cycle has passed and no rule mismatches", () => {
    const opportunity = makeOpportunity({ eligibilityRules: [makeRule()] });
    const passedDeadline = makeDeadlineEvaluation({ lifecycleStatus: "passed-current-cycle" });
    const result = evaluateMatch(opportunity, answers, planning, passedDeadline);
    expect(result.label).toBe("deadline-risk");
    expect(result.confidence).toBe("medium");
  });

  it("prioritises a rule mismatch over a passed deadline", () => {
    const opportunity = makeOpportunity({ eligibilityRules: [makeRule({ expectedValue: ["france"] })] });
    const passedDeadline = makeDeadlineEvaluation({ lifecycleStatus: "passed-current-cycle" });
    const result = evaluateMatch(opportunity, answers, planning, passedDeadline);
    expect(result.label).toBe("likely-not-a-fit");
  });
});

describe("matching engine: never guesses on unmappable rule kinds", () => {
  it.each(["age", "institution", "programme", "academic-score", "other"] as const)(
    "always resolves rule kind '%s' to missing information, never a match or mismatch",
    (kind) => {
      const opportunity = makeOpportunity({ eligibilityRules: [makeRule({ kind, fieldKey: kind, expectedValue: "anything" })] });
      // Even with every answer filled in, an unmappable rule kind must never be guessed.
      const fullAnswers: EligibilityAnswers = {
        ...answers,
        currentStudyLevel: "Master",
        intendedStudyLevel: "Master",
        fieldsOfInterest: ["Computer Science"],
        graduationYear: 2026,
        workExperienceYears: 5,
      };
      const result = evaluateMatch(opportunity, fullAnswers, planning, openDeadline);
      expect(result.mismatchReasons).toHaveLength(0);
      expect(result.missingInfoReasons).toHaveLength(1);
    },
  );
});

describe("matching engine: reason source separation", () => {
  it("never presents a planning-preference match as a formal eligibility-rule match", () => {
    const opportunity = makeOpportunity({ countries: ["Germany"], eligibilityRules: [] });
    const withPreference: PlanningPreferences = { ...DEFAULT_PLANNING_PREFERENCES, preferredCountries: ["Germany"] };
    const result = evaluateMatch(opportunity, EMPTY_ELIGIBILITY_ANSWERS, withPreference, openDeadline);
    expect(result.positiveReasons.every((r) => r.source === "preference")).toBe(true);
  });

  it("keeps a preference mismatch out of mismatchReasons — it only ever appears as a warning", () => {
    const opportunity = makeOpportunity({ countries: ["France"], studyLevels: ["Master"] });
    const withPreference: PlanningPreferences = { ...DEFAULT_PLANNING_PREFERENCES, preferredCountries: ["Germany"] };
    const result = evaluateMatch(opportunity, EMPTY_ELIGIBILITY_ANSWERS, withPreference, openDeadline);
    expect(result.mismatchReasons).toHaveLength(0);
    expect(result.warningReasons.some((r) => r.source === "preference")).toBe(true);
  });

  it("adds a deadline note when the deadline is estimated/unverified, and another for multiple candidate deadlines", () => {
    const opportunity = makeOpportunity();
    const uncertainDeadline = makeDeadlineEvaluation({ verificationRequired: true, multipleDeadlines: true });
    const result = evaluateMatch(opportunity, answers, planning, uncertainDeadline);
    expect(result.deadlineNotes).toHaveLength(2);
  });

  it("adds a verification note when the opportunity's overall verification status is unverified or stale", () => {
    const unverified = makeOpportunity({ verification: makeVerification({ status: "unverified" }) });
    const stale = makeOpportunity({ verification: makeVerification({ status: "stale" }) });
    expect(evaluateMatch(unverified, answers, planning, openDeadline).verificationNotes.length).toBeGreaterThan(0);
    expect(evaluateMatch(stale, answers, planning, openDeadline).verificationNotes.length).toBeGreaterThan(0);
  });
});

describe("matching engine: rule operators", () => {
  it("flips a string-set rule outcome for 'not-in'/'not-equals' operators", () => {
    const opportunity = makeOpportunity({ eligibilityRules: [makeRule({ operator: "not-in", expectedValue: ["france"] })] });
    const result = evaluateMatch(opportunity, answers, planning, openDeadline);
    // Student's nationality (Germany) is not in the excluded set (France) -> match.
    // (verification is unverified by default on this fixture, so a full match reads as "needs-verification".)
    expect(result.label).toBe("needs-verification");
    expect(result.mismatchReasons).toHaveLength(0);
  });

  it("evaluates numeric operators correctly for work-experience", () => {
    const opportunity = makeOpportunity({
      eligibilityRules: [makeRule({ kind: "work-experience", fieldKey: "workExperienceYears", operator: "greater-than-or-equal", expectedValue: 3 })],
    });
    const tooLittle: EligibilityAnswers = { ...answers, workExperienceYears: 1 };
    const enough: EligibilityAnswers = { ...answers, workExperienceYears: 3 };
    expect(evaluateMatch(opportunity, tooLittle, planning, openDeadline).mismatchReasons).toHaveLength(1);
    expect(evaluateMatch(opportunity, enough, planning, openDeadline).mismatchReasons).toHaveLength(0);
  });

  it("treats an unanswered language-test rule as missing, a valid result as a match, and anything else as a mismatch", () => {
    const opportunity = makeOpportunity({ eligibilityRules: [makeRule({ kind: "language-test", fieldKey: "languageTestStatus", operator: "equals", expectedValue: null })] });
    const noAnswer = evaluateMatch(opportunity, answers, planning, openDeadline);
    expect(noAnswer.missingInfoReasons).toHaveLength(1);

    const validResult = evaluateMatch(opportunity, { ...answers, languageTestStatus: "have-valid-result" }, planning, openDeadline);
    expect(validResult.mismatchReasons).toHaveLength(0);

    const planned = evaluateMatch(opportunity, { ...answers, languageTestStatus: "planned" }, planning, openDeadline);
    expect(planned.mismatchReasons).toHaveLength(1);
  });

  it("treats research-experience 'unknown' the same as unanswered", () => {
    const opportunity = makeOpportunity({ eligibilityRules: [makeRule({ kind: "research-experience", fieldKey: "researchExperience", operator: "equals" })] });
    const result = evaluateMatch(opportunity, { ...answers, researchExperience: "unknown" }, planning, openDeadline);
    expect(result.missingInfoReasons).toHaveLength(1);
  });

  it("matches on any overlap for array-intersection rules (field-of-study)", () => {
    const opportunity = makeOpportunity({
      eligibilityRules: [makeRule({ kind: "field-of-study", fieldKey: "fieldsOfInterest", operator: "in", expectedValue: ["Physics", "Chemistry"] })],
    });
    const overlapping: EligibilityAnswers = { ...answers, fieldsOfInterest: ["Biology", "Physics"] };
    const nonOverlapping: EligibilityAnswers = { ...answers, fieldsOfInterest: ["History"] };
    expect(evaluateMatch(opportunity, overlapping, planning, openDeadline).label).toBe("needs-verification");
    expect(evaluateMatch(opportunity, nonOverlapping, planning, openDeadline).label).toBe("likely-not-a-fit");
  });
});
