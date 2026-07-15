import type { DeadlineLifecycleStatus, DeadlinePrecision } from "@/lib/domain";
import type { ApplicationStageOption } from "@/lib/storage/types";
import type { CatalogueOpportunity, CatalogueOpportunityKind, EnrichedOpportunity } from "./types";

export interface CatalogueFilterOptions {
  countries: string[];
  regions: string[];
  studyLevels: string[];
  opportunityTypes: string[];
}

function uniqueSorted(values: Iterable<string>): string[] {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

export function deriveFilterOptions(opportunities: readonly CatalogueOpportunity[]): CatalogueFilterOptions {
  return {
    countries: uniqueSorted(opportunities.flatMap((o) => o.countries)),
    regions: uniqueSorted(opportunities.flatMap((o) => o.regions)),
    studyLevels: uniqueSorted(opportunities.flatMap((o) => o.studyLevels)),
    opportunityTypes: uniqueSorted(opportunities.map((o) => o.opportunityType)),
  };
}

export type CatalogueSortKey =
  | "nearest-deadline"
  | "personal-deadline"
  | "title-asc"
  | "country-asc"
  | "recently-updated"
  | "application-stage"
  | "deadline-state";

export interface CatalogueFilters {
  query: string;
  countries: string[];
  regions: string[];
  studyLevels: string[];
  opportunityTypes: string[];
  deadlineStates: DeadlineLifecycleStatus[];
  precisions: DeadlinePrecision[];
  origin: CatalogueOpportunityKind[];
  stages: ApplicationStageOption[];
  shortlistedOnly: boolean;
  actionableOnly: boolean;
  passedOnly: boolean;
  rollingOnly: boolean;
  verificationRequiredOnly: boolean;
}

export const DEFAULT_CATALOGUE_FILTERS: CatalogueFilters = {
  query: "",
  countries: [],
  regions: [],
  studyLevels: [],
  opportunityTypes: [],
  deadlineStates: [],
  precisions: [],
  origin: [],
  stages: [],
  shortlistedOnly: false,
  actionableOnly: false,
  passedOnly: false,
  rollingOnly: false,
  verificationRequiredOnly: false,
};

export function countActiveFilters(filters: CatalogueFilters): number {
  let count = 0;
  if (filters.query.trim().length > 0) count += 1;
  count += filters.countries.length > 0 ? 1 : 0;
  count += filters.regions.length > 0 ? 1 : 0;
  count += filters.studyLevels.length > 0 ? 1 : 0;
  count += filters.opportunityTypes.length > 0 ? 1 : 0;
  count += filters.deadlineStates.length > 0 ? 1 : 0;
  count += filters.precisions.length > 0 ? 1 : 0;
  count += filters.origin.length > 0 ? 1 : 0;
  count += filters.stages.length > 0 ? 1 : 0;
  if (filters.shortlistedOnly) count += 1;
  if (filters.actionableOnly) count += 1;
  if (filters.passedOnly) count += 1;
  if (filters.rollingOnly) count += 1;
  if (filters.verificationRequiredOnly) count += 1;
  return count;
}

function matchesQuery(item: EnrichedOpportunity, query: string): boolean {
  if (query.trim().length === 0) {
    return true;
  }
  const haystack = [
    item.opportunity.title,
    ...item.opportunity.countries,
    ...item.opportunity.regions,
    item.opportunity.benefitSummary,
    item.opportunity.eligibilitySummary,
    ...item.opportunity.studyLevels,
    item.opportunity.opportunityType,
  ]
    .join(" \n ")
    .toLowerCase();
  return haystack.includes(query.trim().toLowerCase());
}

function intersects(values: readonly string[], selected: readonly string[]): boolean {
  if (selected.length === 0) {
    return true;
  }
  return values.some((value) => selected.includes(value));
}

export function filterOpportunities(
  items: readonly EnrichedOpportunity[],
  filters: CatalogueFilters,
): EnrichedOpportunity[] {
  return items.filter((item) => {
    if (!matchesQuery(item, filters.query)) return false;
    if (!intersects(item.opportunity.countries, filters.countries)) return false;
    if (!intersects(item.opportunity.regions, filters.regions)) return false;
    if (!intersects(item.opportunity.studyLevels, filters.studyLevels)) return false;
    if (filters.opportunityTypes.length > 0 && !filters.opportunityTypes.includes(item.opportunity.opportunityType)) {
      return false;
    }
    if (filters.deadlineStates.length > 0 && !filters.deadlineStates.includes(item.evaluation.lifecycleStatus)) {
      return false;
    }
    if (filters.precisions.length > 0 && !filters.precisions.includes(item.opportunity.deadlineInput.precision)) {
      return false;
    }
    if (filters.origin.length > 0 && !filters.origin.includes(item.opportunity.kind)) {
      return false;
    }
    if (filters.stages.length > 0) {
      const stage = item.workspace?.stage ?? "not-started";
      if (!filters.stages.includes(stage)) return false;
    }
    if (filters.shortlistedOnly && !item.workspace?.shortlisted) return false;
    if (filters.actionableOnly && item.evaluation.studentFacingLabel !== "Apply now") return false;
    if (filters.passedOnly && item.evaluation.lifecycleStatus !== "passed-current-cycle") return false;
    if (filters.rollingOnly && item.evaluation.lifecycleStatus !== "rolling") return false;
    if (filters.verificationRequiredOnly && !item.evaluation.verificationRequired) return false;
    return true;
  });
}

const DEADLINE_STATE_SORT_WEIGHT: Record<DeadlineLifecycleStatus, number> = {
  "due-today": 0,
  approaching: 1,
  "opening-soon": 2,
  open: 3,
  rolling: 4,
  "not-announced": 5,
  "expected-to-reopen": 6,
  "temporarily-unavailable": 7,
  "passed-current-cycle": 8,
  "permanently-archived": 9,
};

const STAGE_SORT_WEIGHT: Record<ApplicationStageOption, number> = {
  "not-started": 0,
  researching: 1,
  preparing: 2,
  "ready-to-apply": 3,
  submitted: 4,
  "interview-or-assessment": 5,
  awarded: 6,
  unsuccessful: 7,
  withdrawn: 8,
};

function nearestDeadlineRank(item: EnrichedOpportunity): number {
  if (item.evaluation.countdown.allowed && item.evaluation.countdown.days !== null) {
    const sign = item.evaluation.countdown.state === "days-since-deadline" ? 1 : -1;
    return sign * 100000 + item.evaluation.countdown.days;
  }
  return Number.POSITIVE_INFINITY;
}

export function sortOpportunities(
  items: readonly EnrichedOpportunity[],
  sortKey: CatalogueSortKey,
): EnrichedOpportunity[] {
  const copy = [...items];

  switch (sortKey) {
    case "nearest-deadline":
      return copy.sort((a, b) => nearestDeadlineRank(a) - nearestDeadlineRank(b));
    case "personal-deadline":
      return copy.sort((a, b) => {
        const aDate = a.workspace?.personalDeadline;
        const bDate = b.workspace?.personalDeadline;
        if (aDate && bDate) return aDate.localeCompare(bDate);
        if (aDate) return -1;
        if (bDate) return 1;
        return 0;
      });
    case "title-asc":
      return copy.sort((a, b) => a.opportunity.title.localeCompare(b.opportunity.title));
    case "country-asc":
      return copy.sort((a, b) =>
        (a.opportunity.countries[0] ?? "").localeCompare(b.opportunity.countries[0] ?? ""),
      );
    case "recently-updated":
      return copy.sort((a, b) => {
        const aUpdated = a.workspace?.updatedAt ?? a.opportunity.updatedAt;
        const bUpdated = b.workspace?.updatedAt ?? b.opportunity.updatedAt;
        return bUpdated.localeCompare(aUpdated);
      });
    case "application-stage":
      return copy.sort(
        (a, b) =>
          STAGE_SORT_WEIGHT[a.workspace?.stage ?? "not-started"] -
          STAGE_SORT_WEIGHT[b.workspace?.stage ?? "not-started"],
      );
    case "deadline-state":
      return copy.sort(
        (a, b) =>
          DEADLINE_STATE_SORT_WEIGHT[a.evaluation.lifecycleStatus] -
          DEADLINE_STATE_SORT_WEIGHT[b.evaluation.lifecycleStatus],
      );
    default:
      return copy;
  }
}
