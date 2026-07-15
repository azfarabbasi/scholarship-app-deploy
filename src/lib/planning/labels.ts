/**
 * Cautious, informational-only planning labels. These never assert formal
 * eligibility — they only describe whether an opportunity's stored facts line
 * up with the guest's own stated preferences.
 */
import type { CatalogueOpportunity } from "@/lib/catalogue/types";
import type { PlanningPreferences } from "@/lib/storage/types";

export type PlanningMatchLabel =
  | "Matches your preferred study level"
  | "Matches a preferred country"
  | "Deadline may suit your selected intake"
  | "Prepare for a future cycle"
  | "Timeline requires verification"
  | "Not enough information to assess timing";

export function studyLevelMatchLabels(
  opportunity: CatalogueOpportunity,
  preferences: PlanningPreferences,
): PlanningMatchLabel[] {
  const labels: PlanningMatchLabel[] = [];
  if (
    preferences.preferredStudyLevels.length > 0 &&
    opportunity.studyLevels.some((level) => preferences.preferredStudyLevels.includes(level))
  ) {
    labels.push("Matches your preferred study level");
  }
  return labels;
}

export function countryMatchLabels(
  opportunity: CatalogueOpportunity,
  preferences: PlanningPreferences,
): PlanningMatchLabel[] {
  const labels: PlanningMatchLabel[] = [];
  if (
    preferences.preferredCountries.length > 0 &&
    opportunity.countries.some((country) => preferences.preferredCountries.includes(country))
  ) {
    labels.push("Matches a preferred country");
  }
  return labels;
}

export function timingLabel(
  opportunity: CatalogueOpportunity,
  preferences: PlanningPreferences,
): PlanningMatchLabel {
  const hasAnyIntakePreference =
    preferences.targetIntakeYear !== null || preferences.expectedGraduationDate !== null;

  if (!hasAnyIntakePreference) {
    return "Not enough information to assess timing";
  }

  const precision = opportunity.deadlineInput.precision;
  if (precision === "unknown" || precision === "program-specific" || precision === "institution-specific") {
    return "Timeline requires verification";
  }

  if (preferences.targetIntakeYear !== null && opportunity.deadlineInput.cycleYear !== null) {
    if (opportunity.deadlineInput.cycleYear > preferences.targetIntakeYear) {
      return "Prepare for a future cycle";
    }
    if (opportunity.deadlineInput.cycleYear === preferences.targetIntakeYear) {
      return "Deadline may suit your selected intake";
    }
  }

  return "Timeline requires verification";
}

export function planningMatchLabels(
  opportunity: CatalogueOpportunity,
  preferences: PlanningPreferences,
): PlanningMatchLabel[] {
  return [
    ...studyLevelMatchLabels(opportunity, preferences),
    ...countryMatchLabels(opportunity, preferences),
    timingLabel(opportunity, preferences),
  ];
}
