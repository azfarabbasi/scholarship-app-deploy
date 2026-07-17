import type { CatalogueOpportunity } from "@/lib/catalogue/types";
import type { DeadlineLifecycleStatus, DeadlinePrecision } from "@/lib/domain";

export const SEARCH_SORT_MODES = ["relevance", "nearest-deadline", "verified-first", "title-asc", "recently-updated"] as const;
export type SearchSortMode = (typeof SEARCH_SORT_MODES)[number];

export const FUNDING_CATEGORY_OPTIONS = [
  "tuition",
  "stipend",
  "travel",
  "accommodation",
  "insurance",
  "research-costs",
  "application-fee",
  "other",
] as const;
export type FundingCategory = (typeof FUNDING_CATEGORY_OPTIONS)[number];

/** A public, URL-safe search request — never includes anything private (no user id, no note text, no answers). */
export interface SearchQuery {
  q: string;
  countries: string[];
  regions: string[];
  studyLevels: string[];
  opportunityTypes: string[];
  fields: string[];
  providers: string[];
  fundingCategories: FundingCategory[];
  deadlineStates: DeadlineLifecycleStatus[];
  precisions: DeadlinePrecision[];
  verificationStatuses: string[];
  requiredDocumentsOnly: boolean;
  eligibilityRulesOnly: boolean;
  sort: SearchSortMode;
  page: number;
  pageSize: number;
}

export interface SearchResultItem {
  opportunity: CatalogueOpportunity;
  score: number;
  matchedFields: string[];
}

export interface SearchResponse {
  items: SearchResultItem[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
  sort: SearchSortMode;
  usedTrigramSimilarity: boolean;
  suggestions: string[];
}
