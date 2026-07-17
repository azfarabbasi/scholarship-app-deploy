import type { CatalogueOpportunity, PublicEligibilityRule } from "@/lib/catalogue/types";
import type { DeadlineEvaluationResult } from "@/lib/deadlines/types";
import type { EligibilityAnswers } from "@/lib/schemas/eligibility-answers";
import { answersAreEmpty } from "@/lib/schemas/eligibility-answers";
import type { PlanningPreferences } from "@/lib/storage/types";
import { MATCH_DISCLAIMER, type MatchConfidence, type MatchLabel, type MatchReason, type MatchResult } from "./types";

/**
 * A pure, deterministic, rule-based matching engine — no AI, no network
 * calls, no randomness. Every branch below is auditable: given the same
 * opportunity + answers + preferences + deadline evaluation, it always
 * returns the same result. See
 * `docs/checkpoint-4/eligibility-matching-spec.md` for the full label/reason
 * design and cautious-language rules this function encodes.
 */

type RuleOutcome = "match" | "mismatch" | "missing";

function toStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((v) => String(v).toLowerCase());
  if (typeof value === "string") return [value.toLowerCase()];
  return [];
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))) return Number(value);
  return null;
}

function compareStringSetRule(rule: PublicEligibilityRule, answer: string | null): RuleOutcome {
  if (!answer) return "missing";
  const expected = toStringArray(rule.expectedValue);
  if (expected.length === 0) return "missing";
  const answerLower = answer.toLowerCase();
  const isIn = expected.includes(answerLower);
  if (rule.operator === "not-equals" || rule.operator === "not-in") {
    return isIn ? "mismatch" : "match";
  }
  return isIn ? "match" : "mismatch";
}

function compareArrayIntersectionRule(rule: PublicEligibilityRule, answers: readonly string[]): RuleOutcome {
  if (answers.length === 0) return "missing";
  const expected = toStringArray(rule.expectedValue);
  if (expected.length === 0) return "missing";
  const answerSet = new Set(answers.map((a) => a.toLowerCase()));
  const overlaps = expected.some((e) => answerSet.has(e));
  if (rule.operator === "not-in" || rule.operator === "not-equals") {
    return overlaps ? "mismatch" : "match";
  }
  return overlaps ? "match" : "mismatch";
}

function compareNumericRule(rule: PublicEligibilityRule, answer: number | null): RuleOutcome {
  if (answer === null) return "missing";
  const expected = toNumber(rule.expectedValue);
  if (expected === null) return "missing";
  switch (rule.operator) {
    case "greater-than":
      return answer > expected ? "match" : "mismatch";
    case "greater-than-or-equal":
      return answer >= expected ? "match" : "mismatch";
    case "less-than":
      return answer < expected ? "match" : "mismatch";
    case "less-than-or-equal":
      return answer <= expected ? "match" : "mismatch";
    case "equals":
      return answer === expected ? "match" : "mismatch";
    case "not-equals":
      return answer !== expected ? "match" : "mismatch";
    default:
      return "missing";
  }
}

function compareYesNoRule(rule: PublicEligibilityRule, answer: "yes" | "no" | "unknown" | null): RuleOutcome {
  if (!answer || answer === "unknown") return "missing";
  const requiresYes = rule.operator !== "not-equals" && rule.operator !== "exists" ? true : rule.operator === "exists";
  const hasIt = answer === "yes";
  if (rule.operator === "not-exists") return hasIt ? "mismatch" : "match";
  return hasIt === requiresYes ? "match" : "mismatch";
}

/**
 * Maps one active, published eligibility rule to match/mismatch/missing
 * against the student's answers. Kinds this engine cannot map with
 * confidence (academic-score without a comparable field, age, institution,
 * programme, other) deliberately resolve to "missing" — guessing would risk
 * a false positive, which is explicitly disallowed.
 */
function evaluateRule(rule: PublicEligibilityRule, answers: EligibilityAnswers): RuleOutcome {
  switch (rule.kind) {
    case "nationality":
      return compareStringSetRule(rule, answers.nationality);
    case "residence":
      return compareStringSetRule(rule, answers.countryOfResidence);
    case "study-level":
      return compareArrayIntersectionRule(
        rule,
        [answers.currentStudyLevel, answers.intendedStudyLevel].filter((v): v is string => Boolean(v)),
      );
    case "field-of-study":
      return compareArrayIntersectionRule(rule, answers.fieldsOfInterest);
    case "graduation-date":
      return compareNumericRule(rule, answers.graduationYear);
    case "language-test":
      if (rule.operator === "not-exists") return answers.languageTestStatus ? "mismatch" : "missing";
      if (!answers.languageTestStatus) return "missing";
      return answers.languageTestStatus === "have-valid-result" ? "match" : "mismatch";
    case "research-experience":
      return compareYesNoRule(rule, answers.researchExperience);
    case "work-experience":
      return compareNumericRule(rule, answers.workExperienceYears);
    case "academic-score":
    case "age":
    case "institution":
    case "programme":
    case "other":
      return "missing";
    default:
      return "missing";
  }
}

function preferenceReasons(opportunity: CatalogueOpportunity, planning: PlanningPreferences): { positive: MatchReason[]; mismatch: MatchReason[] } {
  const positive: MatchReason[] = [];
  const mismatch: MatchReason[] = [];

  if (planning.preferredStudyLevels.length > 0) {
    const overlap = opportunity.studyLevels.some((level) => planning.preferredStudyLevels.includes(level));
    if (overlap) {
      positive.push({ text: "Matches your preferred study level (from your planning preferences).", source: "preference" });
    } else {
      mismatch.push({ text: "This opportunity's study level may not match your stated preference — data is limited to a simple comparison.", source: "preference" });
    }
  }

  if (planning.preferredCountries.length > 0) {
    const overlap = opportunity.countries.some((country) => planning.preferredCountries.includes(country));
    if (overlap) {
      positive.push({ text: "Matches one of your preferred countries.", source: "preference" });
    } else {
      mismatch.push({ text: "This opportunity's country may not match your stated preference.", source: "preference" });
    }
  }

  return { positive, mismatch };
}

/**
 * The single entry point. Never throws; always returns a fully-populated,
 * cautiously-worded result including the standard disclaimer.
 */
export function evaluateMatch(
  opportunity: CatalogueOpportunity,
  answers: EligibilityAnswers,
  planning: PlanningPreferences,
  deadlineEvaluation: DeadlineEvaluationResult,
): MatchResult {
  const positiveReasons: MatchReason[] = [];
  const warningReasons: MatchReason[] = [];
  const mismatchReasons: MatchReason[] = [];
  const missingInfoReasons: MatchReason[] = [];
  const deadlineNotes: string[] = [];
  const verificationNotes: string[] = [];

  const rules = opportunity.eligibilityRules;
  let matchedCount = 0;
  let mismatchCount = 0;
  let missingCount = 0;

  for (const rule of rules) {
    const outcome = evaluateRule(rule, answers);
    if (outcome === "match") {
      matchedCount += 1;
      positiveReasons.push({ text: `Matches an official eligibility rule: ${rule.explanation}`, source: "eligibility-rule" });
    } else if (outcome === "mismatch") {
      mismatchCount += 1;
      mismatchReasons.push({ text: `Likely not a fit — official eligibility rule: ${rule.explanation}`, source: "eligibility-rule" });
    } else {
      missingCount += 1;
      missingInfoReasons.push({ text: `No answer provided to check this official rule: ${rule.explanation}`, source: "eligibility-rule" });
    }
  }

  if (rules.length > 0 && !opportunity.verification.eligibilityVerified) {
    verificationNotes.push("Official eligibility rule requires verification — its source has not been confirmed yet.");
  }

  const { positive: prefPositive, mismatch: prefMismatch } = preferenceReasons(opportunity, planning);
  positiveReasons.push(...prefPositive);
  // Preference mismatches are never treated as strongly as a formal rule mismatch — kept in warnings, not mismatchReasons.
  warningReasons.push(...prefMismatch);

  if (deadlineEvaluation.verificationRequired) {
    deadlineNotes.push("Deadline is estimated or unverified — verify before planning.");
  }
  if (deadlineEvaluation.multipleDeadlines) {
    deadlineNotes.push("Multiple deadline dates were found for this opportunity — check the official source for the one that applies to you.");
  }
  const deadlinePassed = deadlineEvaluation.lifecycleStatus === "passed-current-cycle" || deadlineEvaluation.lifecycleStatus === "due-today";

  if (opportunity.verification.status === "unverified" || opportunity.verification.status === "stale") {
    verificationNotes.push("This opportunity's overall verification status is not current — confirm details with the official source.");
  }

  // --- label determination -------------------------------------------------
  let label: MatchLabel;
  let confidence: MatchConfidence;

  if (mismatchCount > 0) {
    label = "likely-not-a-fit";
    confidence = mismatchCount > matchedCount ? "high" : "medium";
  } else if (deadlinePassed) {
    label = "deadline-risk";
    confidence = "medium";
  } else if (rules.length === 0) {
    if (prefPositive.length > 0) {
      label = "possible-fit";
      confidence = "low";
      missingInfoReasons.push({
        text: "No structured official eligibility rule is available for this opportunity — this reflects your preferences only.",
        source: "eligibility-rule",
      });
    } else if (answersAreEmpty(answers)) {
      label = "not-enough-rule-data";
      confidence = "low";
    } else {
      label = "missing-information";
      confidence = "low";
    }
  } else if (matchedCount > 0 && missingCount === 0) {
    label = opportunity.verification.eligibilityVerified ? "strong-potential-fit" : "needs-verification";
    confidence = opportunity.verification.eligibilityVerified ? "high" : "medium";
  } else if (matchedCount > 0 && missingCount > 0) {
    label = "possible-fit";
    confidence = "medium";
  } else {
    label = "missing-information";
    confidence = "low";
  }

  const nextAction =
    label === "likely-not-a-fit"
      ? "Review the official source directly before ruling this out entirely — rules can change."
      : label === "missing-information" || label === "not-enough-rule-data"
        ? "Fill in your eligibility profile for a more useful match, or check the official source directly."
        : label === "deadline-risk"
          ? "Check the official source for the current cycle's deadline before making plans."
          : "Verify every detail on the official source before applying.";

  return {
    label,
    confidence,
    positiveReasons,
    warningReasons,
    mismatchReasons,
    missingInfoReasons,
    deadlineNotes,
    verificationNotes,
    nextAction,
    disclaimer: MATCH_DISCLAIMER,
  };
}
