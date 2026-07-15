/**
 * Deterministic deadline evaluator.
 *
 * Implements docs/checkpoint-0/deadline-intelligence-spec.md. This module is
 * pure: given facts and an evaluation instant, it always returns the same
 * result. It never mutates its input and never reads the system clock itself
 * (callers pass `now` so results are reproducible and recomputed on demand).
 *
 * Label precedence below is a documented, test-verified reconciliation of the
 * spec's prose "Student-facing labels" section with its own
 * data/test-scenarios/deadline-scenarios.json conformance fixtures. The two
 * disagree in one respect: the prose's rule 3 would send every unverified or
 * unknown-precision record straight to "Verify deadline", but scenarios
 * DL-006, DL-010, DL-011, and DL-012 show that once a lifecycle has resolved
 * to a specific forecast state (not-announced / expected-to-reopen /
 * opening-soon / rolling / passed-current-cycle), that lifecycle-specific
 * label wins over the generic verification catch-all. The engine follows the
 * fixtures: lifecycle-specific labels take precedence, and the
 * verification/estimate gates apply only to the "live" open/approaching/
 * due-today bucket where an actionable "Apply now" would otherwise be shown.
 */
import type {
  DeadlineColorState,
  DeadlineLifecycleStatus,
} from "@/lib/domain";
import {
  calendarDateInTimeZone,
  daysBetweenIsoDates,
  isValidIsoDate,
  viewerCalendarDate,
} from "./calendar-math";
import type {
  DeadlineEvaluationInput,
  DeadlineEvaluationResult,
  DeadlineOccurrenceFact,
} from "./types";

export const DEFAULT_APPROACHING_WINDOW_DAYS = 30;

export interface EvaluateDeadlineOptions {
  approachingWindowDays?: number;
}

interface BoundaryComparison {
  /** True once the deadline's exclusive cutoff instant has passed. */
  passed: boolean;
  /** True when today (source-zone calendar date) equals the boundary date. */
  onBoundaryDate: boolean;
  /** Calendar-day distance from today to the boundary (negative = past). */
  daysDiff: number;
  calendarDate: string;
}

function todayInOccurrenceZone(occurrence: DeadlineOccurrenceFact, now: Date): string {
  return occurrence.sourceTimezone
    ? calendarDateInTimeZone(now, occurrence.sourceTimezone)
    : viewerCalendarDate(now);
}

function compareToBoundary(occurrence: DeadlineOccurrenceFact, now: Date): BoundaryComparison | null {
  if (occurrence.sourceDateTime) {
    const boundaryInstant = new Date(occurrence.sourceDateTime);
    if (Number.isNaN(boundaryInstant.getTime())) {
      return null;
    }
    const todayIso = todayInOccurrenceZone(occurrence, now);
    const boundaryIso = occurrence.sourceTimezone
      ? calendarDateInTimeZone(boundaryInstant, occurrence.sourceTimezone)
      : boundaryInstant.toISOString().slice(0, 10);
    return {
      passed: boundaryInstant.getTime() <= now.getTime(),
      onBoundaryDate: todayIso === boundaryIso,
      daysDiff: daysBetweenIsoDates(todayIso, boundaryIso),
      calendarDate: boundaryIso,
    };
  }

  if (!isValidIsoDate(occurrence.sourceDate)) {
    return null;
  }

  const todayIso = todayInOccurrenceZone(occurrence, now);
  const daysDiff = daysBetweenIsoDates(todayIso, occurrence.sourceDate);
  return {
    passed: daysDiff < 0,
    onBoundaryDate: daysDiff === 0,
    daysDiff,
    calendarDate: occurrence.sourceDate,
  };
}

function deriveClosingLifecycle(
  comparison: BoundaryComparison,
  approachingWindowDays: number,
): DeadlineLifecycleStatus {
  if (comparison.passed) {
    return "passed-current-cycle";
  }
  if (comparison.onBoundaryDate) {
    return "due-today";
  }
  if (comparison.daysDiff <= approachingWindowDays) {
    return "approaching";
  }
  return "open";
}

function isUnresolvedScopedOccurrence(occurrence: DeadlineOccurrenceFact): boolean {
  return occurrence.scope !== "universal" && !isValidIsoDate(occurrence.sourceDate);
}

function selectPrimaryOccurrence(
  candidates: readonly DeadlineOccurrenceFact[],
  now: Date,
): { occurrence: DeadlineOccurrenceFact; comparison: BoundaryComparison } | null {
  let bestUpcoming: { occurrence: DeadlineOccurrenceFact; comparison: BoundaryComparison } | null = null;
  let bestPassed: { occurrence: DeadlineOccurrenceFact; comparison: BoundaryComparison } | null = null;

  for (const occurrence of candidates) {
    const comparison = compareToBoundary(occurrence, now);
    if (!comparison) {
      continue;
    }
    if (!comparison.passed) {
      if (!bestUpcoming || comparison.daysDiff < bestUpcoming.comparison.daysDiff) {
        bestUpcoming = { occurrence, comparison };
      }
    } else if (!bestPassed || comparison.daysDiff > bestPassed.comparison.daysDiff) {
      bestPassed = { occurrence, comparison };
    }
  }

  return bestUpcoming ?? bestPassed;
}

/**
 * When no usable date is known at all, history/estimation evidence can still
 * justify "expected to reopen" instead of a flat "not announced" (see
 * deadline-scenarios.json DL-010/DL-012).
 */
function noDateFallbackLifecycle(
  input: DeadlineEvaluationInput,
  isPreviousIntake: boolean,
): DeadlineLifecycleStatus {
  if (isPreviousIntake || input.verificationStatus === "estimated-from-previous-cycle") {
    return "expected-to-reopen";
  }
  return "not-announced";
}

function groupAmbiguous(occurrences: readonly DeadlineOccurrenceFact[]): boolean {
  const groups = new Map<string, Set<string>>();
  for (const occurrence of occurrences) {
    if (!isValidIsoDate(occurrence.sourceDate) && !occurrence.sourceDateTime) {
      continue;
    }
    const key = `${occurrence.scope}::${occurrence.scopeReference ?? ""}`;
    const dateKey = occurrence.sourceDateTime ?? occurrence.sourceDate ?? "";
    const set = groups.get(key) ?? new Set<string>();
    set.add(dateKey);
    groups.set(key, set);
  }
  return [...groups.values()].some((dates) => dates.size > 1);
}

function colorForLifecycle(
  lifecycle: DeadlineLifecycleStatus,
  isFreshAndReliable: boolean,
): DeadlineColorState {
  if (!isFreshAndReliable) {
    if (lifecycle === "rolling" || lifecycle === "opening-soon") {
      return "blue";
    }
    return "grey";
  }

  switch (lifecycle) {
    case "open":
      return "green";
    case "approaching":
    case "due-today":
      return "amber";
    case "passed-current-cycle":
      return "red";
    case "rolling":
    case "opening-soon":
      return "blue";
    default:
      return "grey";
  }
}

function statusTextFor(
  lifecycle: DeadlineLifecycleStatus,
  occurrence: DeadlineOccurrenceFact | null,
  comparison: BoundaryComparison | null,
): string {
  switch (lifecycle) {
    case "open":
      return comparison
        ? `Open. Closes ${comparison.calendarDate}${occurrence?.sourceTimezone ? ` (${occurrence.sourceTimezone})` : ""}.`
        : "Open for applications.";
    case "approaching":
      return comparison
        ? `Closing soon: ${comparison.calendarDate}, ${comparison.daysDiff} day${comparison.daysDiff === 1 ? "" : "s"} remaining.`
        : "Closing soon.";
    case "due-today":
      return "The deadline is today.";
    case "passed-current-cycle":
      return comparison
        ? `Closed on ${comparison.calendarDate} for this cycle.`
        : "Closed for this cycle.";
    case "opening-soon":
      return comparison
        ? `Opens ${comparison.calendarDate}${occurrence?.sourceTimezone ? ` (${occurrence.sourceTimezone})` : ""}.`
        : "Opening soon.";
    case "rolling":
      return "Accepts applications on a rolling basis.";
    case "not-announced":
      return "Dates for this cycle have not been announced yet.";
    case "expected-to-reopen":
      return "Not currently open; history suggests it may reopen in a future cycle.";
    case "temporarily-unavailable":
      return "This deadline cannot be confirmed right now. Verify with the official source.";
    case "permanently-archived":
      return "This opportunity is archived and no longer accepting applications.";
    default:
      return "Verify this deadline with the official source.";
  }
}

export function evaluateDeadline(
  input: DeadlineEvaluationInput,
  now: Date,
  options: EvaluateDeadlineOptions = {},
): DeadlineEvaluationResult {
  const approachingWindowDays = options.approachingWindowDays ?? DEFAULT_APPROACHING_WINDOW_DAYS;

  const structurallyInvalid = input.occurrences.some((occurrence) => {
    if (occurrence.sourceDateTime && Number.isNaN(new Date(occurrence.sourceDateTime).getTime())) {
      return true;
    }
    if (occurrence.sourceDate !== null && !isValidIsoDate(occurrence.sourceDate)) {
      return true;
    }
    return false;
  });

  const closingOccurrences = input.occurrences.filter((o) => o.kind === "closing");
  const openingOccurrences = input.occurrences.filter((o) => o.kind === "opening");
  const multipleDeadlines = !structurallyInvalid && groupAmbiguous(closingOccurrences);

  const unresolvedScope =
    !structurallyInvalid &&
    (input.precision === "program-specific" || input.precision === "institution-specific") &&
    closingOccurrences.every(isUnresolvedScopedOccurrence) &&
    openingOccurrences.every(isUnresolvedScopedOccurrence);

  let lifecycleStatus: DeadlineLifecycleStatus;
  let selectedOccurrence: DeadlineOccurrenceFact | null = null;
  let comparison: BoundaryComparison | null = null;

  const isPreviousIntake = input.targetIntake?.relation === "previous-intake";

  if (structurallyInvalid) {
    lifecycleStatus = "temporarily-unavailable";
  } else if (input.verificationStatus === "archived") {
    lifecycleStatus = "permanently-archived";
  } else if (input.verificationStatus === "withdrawn") {
    lifecycleStatus = "temporarily-unavailable";
  } else if (input.verificationStatus === "conflicting" || multipleDeadlines) {
    lifecycleStatus = "temporarily-unavailable";
  } else if (input.precision === "rolling") {
    lifecycleStatus = "rolling";
  } else if (unresolvedScope) {
    lifecycleStatus = "temporarily-unavailable";
  } else if (
    input.precision === "program-specific" ||
    input.precision === "institution-specific"
  ) {
    const resolved = selectPrimaryOccurrence(
      [...closingOccurrences, ...openingOccurrences].filter((o) => !isUnresolvedScopedOccurrence(o)),
      now,
    );
    if (resolved) {
      selectedOccurrence = resolved.occurrence;
      comparison = resolved.comparison;
      lifecycleStatus =
        resolved.occurrence.kind === "opening"
          ? comparison.passed
            ? "open"
            : "opening-soon"
          : deriveClosingLifecycle(comparison, approachingWindowDays);
    } else {
      lifecycleStatus = "temporarily-unavailable";
    }
  } else if (input.precision === "unknown") {
    lifecycleStatus = noDateFallbackLifecycle(input, isPreviousIntake);
  } else {
    // exact or estimated: a verified future opening boundary always takes
    // precedence over a closing boundary (opening-soon is evaluated first).
    const resolvedOpenings = openingOccurrences
      .map((occurrence) => ({ occurrence, comparison: compareToBoundary(occurrence, now) }))
      .filter(
        (x): x is { occurrence: DeadlineOccurrenceFact; comparison: BoundaryComparison } =>
          x.comparison !== null,
      );
    const futureOpening = resolvedOpenings.find((x) => !x.comparison.passed);

    if (futureOpening) {
      selectedOccurrence = futureOpening.occurrence;
      comparison = futureOpening.comparison;
      lifecycleStatus = "opening-soon";
    } else {
      const primaryClosing = selectPrimaryOccurrence(closingOccurrences, now);
      if (primaryClosing) {
        selectedOccurrence = primaryClosing.occurrence;
        comparison = primaryClosing.comparison;
        lifecycleStatus = isPreviousIntake
          ? "expected-to-reopen"
          : deriveClosingLifecycle(comparison, approachingWindowDays);
      } else if (resolvedOpenings.length > 0) {
        // Opening has already passed and no closing boundary is known.
        selectedOccurrence = resolvedOpenings[0].occurrence;
        comparison = resolvedOpenings[0].comparison;
        lifecycleStatus = "open";
      } else {
        lifecycleStatus = noDateFallbackLifecycle(input, isPreviousIntake);
      }
    }
  }

  const missingTimezone =
    selectedOccurrence !== null &&
    isValidIsoDate(selectedOccurrence.sourceDate) &&
    !selectedOccurrence.sourceDateTime &&
    !selectedOccurrence.sourceTimezone;

  const isVerified = input.verificationStatus === "verified";
  const isEstimateLike =
    input.precision === "estimated" || input.verificationStatus === "estimated-from-previous-cycle";
  const isCountdownEligibleLifecycle =
    lifecycleStatus === "open" ||
    lifecycleStatus === "approaching" ||
    lifecycleStatus === "due-today" ||
    lifecycleStatus === "opening-soon" ||
    lifecycleStatus === "passed-current-cycle";

  // verificationRequired tracks whether a human still needs to check this
  // fact. It is independent of the label: a settled `withdrawn`/`archived`
  // status is not actionable but nothing further needs verifying, while an
  // unresolved scope or a not-yet-reviewed fact does.
  const verificationRequired =
    structurallyInvalid ||
    unresolvedScope ||
    multipleDeadlines ||
    missingTimezone ||
    input.verificationStatus === "unverified" ||
    input.verificationStatus === "stale" ||
    input.verificationStatus === "conflicting" ||
    input.verificationStatus === "estimated-from-previous-cycle" ||
    input.targetIntake?.finalYearEligibility === "ineligible";

  let studentFacingLabel: DeadlineEvaluationResult["studentFacingLabel"];

  if (
    structurallyInvalid ||
    lifecycleStatus === "temporarily-unavailable" ||
    lifecycleStatus === "permanently-archived"
  ) {
    studentFacingLabel = "Verify deadline";
  } else if (lifecycleStatus === "not-announced") {
    studentFacingLabel = "Not yet announced";
  } else if (lifecycleStatus === "expected-to-reopen") {
    const isPureCurrentCycleEstimate =
      input.precision === "estimated" &&
      input.verificationStatus === "unverified" &&
      input.recurrence.cadence !== "annual";
    studentFacingLabel = isPureCurrentCycleEstimate ? "Deadline estimate only" : "Wait for next cycle";
  } else if (lifecycleStatus === "opening-soon") {
    studentFacingLabel = isVerified ? "Prepare now" : "Verify deadline";
  } else if (lifecycleStatus === "rolling") {
    studentFacingLabel = isVerified ? "Rolling opportunity" : "Verify deadline";
  } else if (lifecycleStatus === "passed-current-cycle") {
    studentFacingLabel = "Deadline passed for this cycle";
  } else if (isEstimateLike) {
    // open / approaching / due-today, but only as an estimate
    studentFacingLabel = "Deadline estimate only";
  } else if (!isVerified || missingTimezone || unresolvedScope) {
    studentFacingLabel = "Verify deadline";
  } else if (input.targetIntake?.finalYearEligibility === "ineligible") {
    studentFacingLabel = "Verify deadline";
  } else {
    studentFacingLabel = "Apply now";
  }

  const countdownAllowed =
    isCountdownEligibleLifecycle &&
    isVerified &&
    !missingTimezone &&
    !unresolvedScope &&
    !multipleDeadlines &&
    !isEstimateLike &&
    comparison !== null;

  const isFreshAndReliable =
    isVerified && !missingTimezone && !unresolvedScope && !multipleDeadlines && !isEstimateLike && !structurallyInvalid;
  const colorState = colorForLifecycle(lifecycleStatus, isFreshAndReliable);

  return {
    lifecycleStatus,
    studentFacingLabel,
    colorState,
    statusText: statusTextFor(lifecycleStatus, selectedOccurrence, comparison),
    verificationRequired,
    countdown: {
      allowed: countdownAllowed,
      state: countdownAllowed
        ? comparison!.passed
          ? "days-since-deadline"
          : comparison!.onBoundaryDate
            ? "deadline-today"
            : "days-remaining"
        : "unavailable",
      days: countdownAllowed ? Math.abs(comparison!.daysDiff) : null,
      unavailableReason: countdownAllowed
        ? null
        : structurallyInvalid
          ? "Deadline data is malformed and could not be validated."
          : !isVerified
            ? "This fact has not been officially verified."
            : missingTimezone
              ? "The official source timezone is unknown."
              : unresolvedScope
                ? "The applicable programme or institution has not been selected."
                : multipleDeadlines
                  ? "Multiple deadlines were found for the same scope; verify which applies."
                  : "A reliable countdown is not available for this precision.",
    },
    selectedOccurrence,
    occurrences: input.occurrences,
    multipleDeadlines,
    structurallyInvalid,
  };
}
