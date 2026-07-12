/**
 * Domain contracts for deadline intelligence.
 *
 * This module intentionally contains data contracts only. Date parsing,
 * lifecycle derivation, countdown calculation, and display decisions belong in
 * separately tested application services.
 */

export const DEADLINE_PRECISIONS = [
  "exact",
  "estimated",
  "rolling",
  "unknown",
  "program-specific",
  "institution-specific",
] as const;

export type DeadlinePrecision = (typeof DEADLINE_PRECISIONS)[number];

/** The four precision values supported by the v0.1 migration seed. */
export const MIGRATION_DEADLINE_PRECISIONS = [
  "exact",
  "estimated",
  "rolling",
  "unknown",
] as const satisfies readonly DeadlinePrecision[];

export type MigrationDeadlinePrecision =
  (typeof MIGRATION_DEADLINE_PRECISIONS)[number];

export const DEADLINE_LIFECYCLE_STATUSES = [
  "not-announced",
  "expected-to-reopen",
  "opening-soon",
  "open",
  "approaching",
  "due-today",
  "passed-current-cycle",
  "rolling",
  "temporarily-unavailable",
  "permanently-archived",
] as const;

export type DeadlineLifecycleStatus =
  (typeof DEADLINE_LIFECYCLE_STATUSES)[number];

export const DEADLINE_VERIFICATION_STATUSES = [
  "verified",
  "unverified",
  "stale",
  "conflicting",
  "withdrawn",
  "archived",
  "estimated-from-previous-cycle",
] as const;

export type DeadlineVerificationStatus =
  (typeof DEADLINE_VERIFICATION_STATUSES)[number];

/** Values accepted by the v0.1 migration seed before domain adaptation. */
export const MIGRATION_DEADLINE_VERIFICATION_STATUSES = [
  "not-reverified",
  "needs-review",
  "verified",
] as const;

export type MigrationDeadlineVerificationStatus =
  (typeof MIGRATION_DEADLINE_VERIFICATION_STATUSES)[number];

export const DEADLINE_INTAKE_RELATIONS = [
  "current-intake",
  "future-intake",
  "previous-intake",
  "not-applicable",
  "unknown",
] as const;

export type DeadlineIntakeRelation =
  (typeof DEADLINE_INTAKE_RELATIONS)[number];

export const FINAL_YEAR_ELIGIBILITY_STATUSES = [
  "eligible",
  "ineligible",
  "conditional",
  "requires-verification",
  "not-applicable",
  "unknown",
] as const;

export type FinalYearEligibilityStatus =
  (typeof FINAL_YEAR_ELIGIBILITY_STATUSES)[number];

export const DEADLINE_OCCURRENCE_KINDS = ["opening", "closing"] as const;

export type DeadlineOccurrenceKind =
  (typeof DEADLINE_OCCURRENCE_KINDS)[number];

export const DEADLINE_SCOPES = [
  "universal",
  "program-specific",
  "institution-specific",
] as const;

export type DeadlineScope = (typeof DEADLINE_SCOPES)[number];

export const DEADLINE_RECURRENCE_CADENCES = [
  "none",
  "annual",
  "irregular",
  "unknown",
] as const;

export type DeadlineRecurrenceCadence =
  (typeof DEADLINE_RECURRENCE_CADENCES)[number];

export const STUDENT_FACING_DEADLINE_LABELS = [
  "Apply now",
  "Prepare now",
  "Wait for next cycle",
  "Verify deadline",
  "Rolling opportunity",
  "Deadline passed for this cycle",
  "Not yet announced",
  "Deadline estimate only",
] as const;

export type StudentFacingDeadlineLabel =
  (typeof STUDENT_FACING_DEADLINE_LABELS)[number];

export const DEADLINE_COUNTDOWN_STATES = [
  "days-remaining",
  "deadline-today",
  "days-since-deadline",
  "unavailable",
] as const;

export type DeadlineCountdownState =
  (typeof DEADLINE_COUNTDOWN_STATES)[number];

export const DEADLINE_COLOR_STATES = [
  "green",
  "amber",
  "red",
  "blue",
  "grey",
] as const;

export type DeadlineColorState = (typeof DEADLINE_COLOR_STATES)[number];

/** Calendar date in source form, normally strict YYYY-MM-DD. */
export type DeadlineCalendarDate = string;

/** Offset-bearing source timestamp, normally ISO 8601. */
export type DeadlineDateTime = string;

/** IANA timezone identifier retained independently from any local conversion. */
export type DeadlineTimezone = string;

export interface DeadlineTargetIntake {
  relation: DeadlineIntakeRelation;
  intakeId: string | null;
  intakeLabel: string | null;
  programStartDate: DeadlineCalendarDate | null;
  expectedGraduationDate: DeadlineCalendarDate | null;
  finalYearEligibility: FinalYearEligibilityStatus;
}

/**
 * Describes recurrence evidence without authorising or storing an automatically
 * generated future deadline.
 */
export interface DeadlineRecurrence {
  cadence: DeadlineRecurrenceCadence;
  intervalYears: number | null;
  documentedByOfficialSource: boolean;
  sourceText: string | null;
  observedCycleYears: readonly number[];
  automaticDateGenerationAllowed: false;
}

export interface DeadlineSource {
  officialUrl: string | null;
  sourceLabel: string | null;
  rawText: string;
  verificationStatus: DeadlineVerificationStatus;
  lastCheckedAt: DeadlineDateTime | null;
  sourceTimezone: DeadlineTimezone | null;
  sourceDate: DeadlineCalendarDate | null;
  sourceDateTime: DeadlineDateTime | null;
  /** A projection is never interchangeable with a verified source date. */
  projectedDate: DeadlineCalendarDate | null;
  projectedFromCycleId: string | null;
  projectionBasis: string | null;
}

export interface DeadlineOccurrence {
  occurrenceId: string;
  kind: DeadlineOccurrenceKind;
  precision: DeadlinePrecision;
  lifecycleStatus: DeadlineLifecycleStatus;
  scope: DeadlineScope;
  scopeReference: string | null;
  source: DeadlineSource;
}

export interface DeadlineCycle {
  cycleId: string;
  cycleYear: number | null;
  targetIntake: DeadlineTargetIntake;
  occurrences: readonly DeadlineOccurrence[];
  recurrence: DeadlineRecurrence;
}

export interface DeadlineCountdownDisplayState {
  allowed: boolean;
  state: DeadlineCountdownState;
  days: number | null;
  evaluatedAt: DeadlineDateTime;
  evaluationTimezone: DeadlineTimezone;
  sourceTimezone: DeadlineTimezone | null;
  unavailableReason: string | null;
}

export interface DeadlineDisplayState {
  lifecycleStatus: DeadlineLifecycleStatus;
  studentFacingLabel: StudentFacingDeadlineLabel;
  countdown: DeadlineCountdownDisplayState;
  colorState: DeadlineColorState;
  /** Required because colour must never be the only status indicator. */
  statusText: string;
  verificationRequired: boolean;
}
