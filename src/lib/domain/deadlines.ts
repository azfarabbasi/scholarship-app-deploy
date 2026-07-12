/**
 * Domain contracts for deadline intelligence.
 *
 * This module intentionally contains data contracts only. Date parsing,
 * lifecycle derivation, countdown calculation, and display decisions belong in
 * separately tested application services.
 */

import type { EntityId, PublicationClassifiedRecord } from "./common";

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

export const DEADLINE_BOUNDARY_KINDS = ["opening", "closing"] as const;

export type DeadlineBoundaryKind = (typeof DEADLINE_BOUNDARY_KINDS)[number];

export const DEADLINE_BOUNDARY_PRECISIONS = [
  "exact",
  "estimated",
] as const satisfies readonly DeadlinePrecision[];

export type DeadlineBoundaryPrecision =
  (typeof DEADLINE_BOUNDARY_PRECISIONS)[number];

export const DEADLINE_ROLES = [
  "applicant-submission",
  "institutional-nomination",
  "embassy-nomination",
  "programme-round",
  "document-supplement",
  "other",
] as const;

export type DeadlineRole = (typeof DEADLINE_ROLES)[number];

export const DEADLINE_SCOPE_KINDS = ["universal", "scoped"] as const;

export type DeadlineScopeKind = (typeof DEADLINE_SCOPE_KINDS)[number];

export const DEADLINE_OCCURRENCE_AVAILABILITY_STATUSES = [
  "draft",
  "active",
  "withdrawn",
  "superseded",
  "archived",
] as const;

export type DeadlineOccurrenceAvailabilityStatus =
  (typeof DEADLINE_OCCURRENCE_AVAILABILITY_STATUSES)[number];

export const DEADLINE_CYCLE_STATUSES = [
  "draft",
  "in-review",
  "announced",
  "active",
  "completed",
  "withdrawn",
  "historical",
] as const;

export type DeadlineCycleStatus = (typeof DEADLINE_CYCLE_STATUSES)[number];

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

/** A source-declared cycle target, before student-relative evaluation. */
export interface DeadlineCycleTargetIntake {
  intakeId: string;
  intakeLabel: string;
  programStartDate: DeadlineCalendarDate | null;
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

interface DeadlineSourceFields {
  deadlineSourceId: EntityId;
  officialSourceId: EntityId;
  publisherName: string;
  sourceType: string;
  cycleId: EntityId;
  occurrenceId: EntityId;
  factPath: string;
  scope: DeadlineOccurrenceScope;
  sourceLabel: string | null;
  rawText: string;
  sourceTimezone: DeadlineTimezone | null;
  sourceDate: DeadlineCalendarDate | null;
  sourceDateTime: DeadlineDateTime | null;
  /** A projection is never interchangeable with a verified source date. */
  projectedDate: DeadlineCalendarDate | null;
  projectedFromCycleId: string | null;
  projectionBasis: string | null;
}

type VerifiedDeadlineSource = DeadlineSourceFields & {
  officialUrl: string;
  verificationStatus: "verified";
  lastCheckedAt: DeadlineDateTime;
};

type NonVerifiedDeadlineSource = DeadlineSourceFields & {
  officialUrl: string | null;
  verificationStatus: Exclude<DeadlineVerificationStatus, "verified">;
  lastCheckedAt: DeadlineDateTime | null;
};

export type DeadlineSource =
  | VerifiedDeadlineSource
  | NonVerifiedDeadlineSource;

/**
 * Explicit dimensions used to select an occurrence. Null means that dimension
 * is not constrained by the source; it must never be populated by inference.
 */
export interface DeadlineOccurrenceScope {
  kind: DeadlineScopeKind;
  programId: string | null;
  institutionId: string | null;
  countryCode: string | null;
  residencyCode: string | null;
  applicantCategoryCode: string | null;
  roundLabel: string | null;
}

interface DeadlineBoundaryFields {
  boundaryId: EntityId;
  sources: readonly [DeadlineSource, ...DeadlineSource[]];
}

export interface DeadlineExactOpeningBoundary extends DeadlineBoundaryFields {
  kind: "opening";
  precision: "exact";
}

export interface DeadlineEstimatedOpeningBoundary
  extends DeadlineBoundaryFields {
  kind: "opening";
  precision: "estimated";
}

export interface DeadlineExactClosingBoundary extends DeadlineBoundaryFields {
  kind: "closing";
  precision: "exact";
}

export interface DeadlineEstimatedClosingBoundary
  extends DeadlineBoundaryFields {
  kind: "closing";
  precision: "estimated";
}

export type DeadlineOpeningBoundary =
  | DeadlineExactOpeningBoundary
  | DeadlineEstimatedOpeningBoundary;

export type DeadlineClosingBoundary =
  | DeadlineExactClosingBoundary
  | DeadlineEstimatedClosingBoundary;

export type DeadlineBoundary =
  | DeadlineOpeningBoundary
  | DeadlineClosingBoundary;

interface DeadlineOccurrenceFields {
  occurrenceId: EntityId;
  role: DeadlineRole;
  roleLabel: string | null;
  scope: DeadlineOccurrenceScope;
  /** Supports rolling, unknown, or not-yet-announced facts without a boundary. */
  occurrenceSources: readonly DeadlineSource[];
  supersedesOccurrenceId: EntityId | null;
}

type ExactOccurrenceTiming =
  | {
      precision: "exact";
      openingBoundary: DeadlineExactOpeningBoundary;
      closingBoundary: DeadlineExactClosingBoundary | null;
    }
  | {
      precision: "exact";
      openingBoundary: null;
      closingBoundary: DeadlineExactClosingBoundary;
    };

type EstimatedOccurrenceTiming =
  | {
      precision: "estimated";
      openingBoundary: DeadlineEstimatedOpeningBoundary;
      closingBoundary: DeadlineEstimatedClosingBoundary | null;
    }
  | {
      precision: "estimated";
      openingBoundary: null;
      closingBoundary: DeadlineEstimatedClosingBoundary;
    };

type ScopedOccurrenceTiming = {
  precision: "program-specific" | "institution-specific";
  openingBoundary: DeadlineOpeningBoundary | null;
  closingBoundary: DeadlineClosingBoundary | null;
};

type UndatedOccurrenceTiming = {
  precision: "rolling" | "unknown";
  openingBoundary: null;
  closingBoundary: null;
};

export type DeadlineOccurrence = PublicationClassifiedRecord<
  DeadlineOccurrenceFields &
    (
      | ExactOccurrenceTiming
      | EstimatedOccurrenceTiming
      | ScopedOccurrenceTiming
      | UndatedOccurrenceTiming
    ),
  DeadlineOccurrenceAvailabilityStatus,
  "draft"
>;

interface DeadlineCycleFields {
  cycleId: EntityId;
  cycleLabel: string | null;
  cycleYear: number | null;
  applicationCycleStartsOn: DeadlineCalendarDate | null;
  applicationCycleEndsOn: DeadlineCalendarDate | null;
  targetIntakes: readonly DeadlineCycleTargetIntake[];
  occurrences: readonly DeadlineOccurrence[];
  recurrence: DeadlineRecurrence;
}

export type DeadlineCycle = PublicationClassifiedRecord<
  DeadlineCycleFields,
  DeadlineCycleStatus,
  "draft" | "in-review"
>;

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
