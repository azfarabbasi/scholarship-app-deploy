import type {
  DeadlineColorState,
  DeadlineCountdownState,
  DeadlineIntakeRelation,
  DeadlineLifecycleStatus,
  DeadlinePrecision,
  DeadlineRecurrenceCadence,
  DeadlineVerificationStatus,
  FinalYearEligibilityStatus,
  StudentFacingDeadlineLabel,
} from "@/lib/domain";

export type DeadlineOccurrenceKind = "opening" | "closing";
export type DeadlineOccurrenceScopeKind =
  | "universal"
  | "program-specific"
  | "institution-specific";

/** One scope-aware boundary fact. Mirrors data/test-scenarios/deadline-scenarios.json. */
export interface DeadlineOccurrenceFact {
  kind: DeadlineOccurrenceKind;
  scope: DeadlineOccurrenceScopeKind;
  scopeReference: string | null;
  rawText: string;
  officialUrl: string | null;
  lastCheckedAt: string | null;
  sourceTimezone: string | null;
  sourceDate: string | null;
  sourceDateTime: string | null;
  projectedDate: string | null;
}

export interface DeadlineRecurrenceFact {
  cadence: DeadlineRecurrenceCadence;
  intervalYears?: number | null;
  documentedByOfficialSource?: boolean;
  observedCycleYears?: readonly number[];
  automaticDateGenerationAllowed: false;
}

export interface DeadlineIntakeContext {
  relation: DeadlineIntakeRelation;
  intakeId?: string | null;
  programStartDate?: string | null;
  expectedGraduationDate?: string | null;
  finalYearEligibility?: FinalYearEligibilityStatus;
}

export interface DeadlineEvaluationInput {
  cycleYear: number | null;
  precision: DeadlinePrecision;
  verificationStatus: DeadlineVerificationStatus;
  recurrence: DeadlineRecurrenceFact;
  occurrences: readonly DeadlineOccurrenceFact[];
  targetIntake?: DeadlineIntakeContext;
}

export interface DeadlineCountdownResult {
  allowed: boolean;
  state: DeadlineCountdownState;
  days: number | null;
  unavailableReason: string | null;
}

export interface DeadlineEvaluationResult {
  lifecycleStatus: DeadlineLifecycleStatus;
  studentFacingLabel: StudentFacingDeadlineLabel;
  colorState: DeadlineColorState;
  statusText: string;
  verificationRequired: boolean;
  countdown: DeadlineCountdownResult;
  selectedOccurrence: DeadlineOccurrenceFact | null;
  occurrences: readonly DeadlineOccurrenceFact[];
  multipleDeadlines: boolean;
  structurallyInvalid: boolean;
}
