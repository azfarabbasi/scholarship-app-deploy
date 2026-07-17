import { z } from "zod";
import { FUNDING_CATEGORY_OPTIONS, SEARCH_SORT_MODES, type SearchQuery } from "./types";

/**
 * Validates and length-limits a search request. Applied identically whether
 * the request came from `/api/search`'s query string or a client-side call
 * — never trust either without going through this schema first. Every array
 * is capped so a malicious caller can't force an unbounded query plan.
 */
export const searchQuerySchema = z
  .object({
    q: z.string().trim().max(200).default(""),
    countries: z.array(z.string().trim().min(1).max(100)).max(30).default([]),
    regions: z.array(z.string().trim().min(1).max(100)).max(30).default([]),
    studyLevels: z.array(z.string().trim().min(1).max(50)).max(20).default([]),
    opportunityTypes: z.array(z.string().trim().min(1).max(50)).max(20).default([]),
    fields: z.array(z.string().trim().min(1).max(100)).max(30).default([]),
    providers: z.array(z.string().trim().min(1).max(150)).max(30).default([]),
    fundingCategories: z.array(z.enum(FUNDING_CATEGORY_OPTIONS)).max(FUNDING_CATEGORY_OPTIONS.length).default([]),
    deadlineStates: z.array(z.string().trim().min(1).max(50)).max(20).default([]),
    precisions: z.array(z.string().trim().min(1).max(50)).max(20).default([]),
    verificationStatuses: z.array(z.string().trim().min(1).max(50)).max(10).default([]),
    requiredDocumentsOnly: z.coerce.boolean().default(false),
    eligibilityRulesOnly: z.coerce.boolean().default(false),
    sort: z.enum(SEARCH_SORT_MODES).default("relevance"),
    page: z.coerce.number().int().min(1).max(1000).default(1),
    pageSize: z.coerce.number().int().min(1).max(50).default(12),
  })
  .strict();

function splitParam(value: string | null): string[] {
  return value ? value.split(",").map((v) => v.trim()).filter(Boolean) : [];
}

/** Parses a public URLSearchParams object into a validated SearchQuery. Never throws — invalid input just falls back to defaults for that field. */
export function parseSearchQuery(params: URLSearchParams): SearchQuery {
  const candidate = {
    q: params.get("q") ?? undefined,
    countries: splitParam(params.get("countries")),
    regions: splitParam(params.get("regions")),
    studyLevels: splitParam(params.get("levels")),
    opportunityTypes: splitParam(params.get("types")),
    fields: splitParam(params.get("fields")),
    providers: splitParam(params.get("providers")),
    fundingCategories: splitParam(params.get("funding")),
    deadlineStates: splitParam(params.get("states")),
    precisions: splitParam(params.get("precisions")),
    verificationStatuses: splitParam(params.get("verification")),
    requiredDocumentsOnly: params.get("hasDocuments") ?? undefined,
    eligibilityRulesOnly: params.get("hasEligibility") ?? undefined,
    sort: params.get("sort") ?? undefined,
    page: params.get("page") ?? undefined,
    pageSize: params.get("pageSize") ?? undefined,
  };

  const result = searchQuerySchema.safeParse(candidate);
  return (result.success ? result.data : searchQuerySchema.parse({})) as SearchQuery;
}

export function searchQueryToParams(query: Partial<SearchQuery>): URLSearchParams {
  const params = new URLSearchParams();
  if (query.q?.trim()) params.set("q", query.q.trim());
  if (query.countries?.length) params.set("countries", query.countries.join(","));
  if (query.regions?.length) params.set("regions", query.regions.join(","));
  if (query.studyLevels?.length) params.set("levels", query.studyLevels.join(","));
  if (query.opportunityTypes?.length) params.set("types", query.opportunityTypes.join(","));
  if (query.fields?.length) params.set("fields", query.fields.join(","));
  if (query.providers?.length) params.set("providers", query.providers.join(","));
  if (query.fundingCategories?.length) params.set("funding", query.fundingCategories.join(","));
  if (query.deadlineStates?.length) params.set("states", query.deadlineStates.join(","));
  if (query.precisions?.length) params.set("precisions", query.precisions.join(","));
  if (query.verificationStatuses?.length) params.set("verification", query.verificationStatuses.join(","));
  if (query.requiredDocumentsOnly) params.set("hasDocuments", "true");
  if (query.eligibilityRulesOnly) params.set("hasEligibility", "true");
  if (query.sort && query.sort !== "relevance") params.set("sort", query.sort);
  if (query.page && query.page !== 1) params.set("page", String(query.page));
  if (query.pageSize && query.pageSize !== 12) params.set("pageSize", String(query.pageSize));
  return params;
}
