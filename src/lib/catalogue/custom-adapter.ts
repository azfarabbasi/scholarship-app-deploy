import type { CustomOpportunityRecord } from "@/lib/storage/types";
import type { DeadlineEvaluationInput, DeadlineOccurrenceFact } from "@/lib/deadlines/types";
import type { CatalogueOpportunity } from "./types";

function toOccurrences(record: CustomOpportunityRecord): DeadlineOccurrenceFact[] {
  if (record.deadlineKind !== "exact" && record.deadlineKind !== "estimated") {
    return [];
  }
  if (!record.deadlineDate) {
    return [];
  }
  return [
    {
      kind: "closing",
      scope: "universal",
      scopeReference: null,
      rawText: record.deadlineRawText,
      officialUrl: record.officialUrl,
      lastCheckedAt: null,
      sourceTimezone: record.deadlineTimezone,
      sourceDate: record.deadlineDate,
      sourceDateTime: null,
      projectedDate: null,
    },
  ];
}

/**
 * Custom opportunities are always guest-authored, so their deadline is
 * evaluated as `unverified` — the engine will never present them as an
 * officially "Apply now" fact. Calendar placement uses a separate,
 * self-reported rule (src/lib/calendar/events.ts) since the date still comes
 * directly from the guest, not from a third-party claim.
 */
export function customOpportunityDeadlineInput(record: CustomOpportunityRecord): DeadlineEvaluationInput {
  return {
    cycleYear: null,
    precision: record.deadlineKind,
    verificationStatus: "unverified",
    recurrence: { cadence: "none", automaticDateGenerationAllowed: false },
    occurrences: toOccurrences(record),
  };
}

export function customOpportunityToCatalogueOpportunity(record: CustomOpportunityRecord): CatalogueOpportunity {
  return {
    kind: "custom",
    id: `custom-${record.id}`,
    legacyId: null,
    slug: record.slug,
    title: record.title,
    opportunityType: record.opportunityType,
    providerName: record.providerName,
    countries: [...record.countries],
    regions: [...record.regions],
    studyLevels: [...record.studyLevels],
    benefitSummary: record.benefitSummary,
    eligibilitySummary: record.eligibilitySummary,
    officialUrl: record.officialUrl,
    verificationNotes: record.verificationNotes,
    deadlineInput: customOpportunityDeadlineInput(record),
    deadlineRawText: record.deadlineRawText,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}
