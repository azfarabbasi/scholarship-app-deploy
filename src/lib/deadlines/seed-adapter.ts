import type { DeadlineVerificationStatus } from "@/lib/domain";
import type { OpportunityDeadline, OpportunitySource } from "@/lib/schemas/opportunity-seed";
import type { DeadlineEvaluationInput, DeadlineOccurrenceFact } from "./types";

/**
 * `not-reverified` MUST map one-way to `unverified`; it must never map to
 * `verified` (docs/checkpoint-0/deadline-intelligence-spec.md, "Reconciliation
 * with the v0.1 migration seed").
 */
export function mapLegacyVerificationStatus(
  status: OpportunitySource["verificationStatus"],
): DeadlineVerificationStatus {
  switch (status) {
    case "verified":
      return "verified";
    case "needs-review":
    case "not-reverified":
    default:
      return "unverified";
  }
}

export function seedDeadlineToEvaluationInput(
  deadline: OpportunityDeadline,
  source: OpportunitySource,
): DeadlineEvaluationInput {
  const verificationStatus = mapLegacyVerificationStatus(source.verificationStatus);

  const occurrences: DeadlineOccurrenceFact[] = deadline.dates.map((date) => ({
    kind: "closing",
    scope: "universal",
    scopeReference: null,
    rawText: deadline.rawText,
    officialUrl: null,
    lastCheckedAt: source.lastCheckedAt,
    sourceTimezone: deadline.timezone,
    sourceDate: date,
    sourceDateTime: null,
    projectedDate: null,
  }));

  return {
    cycleYear: deadline.cycleYear,
    precision: deadline.precision,
    verificationStatus,
    recurrence: {
      cadence: "unknown",
      automaticDateGenerationAllowed: false,
    },
    occurrences,
  };
}
