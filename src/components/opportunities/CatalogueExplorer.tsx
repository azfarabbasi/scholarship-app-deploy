"use client";

import { SearchX } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/common/EmptyState";
import { SaveSearchButton } from "@/components/discovery/SaveSearchButton";
import { SavedSearchesPanel } from "@/components/discovery/SavedSearchesPanel";
import { useCatalogue } from "@/hooks/useCatalogue";
import { useComparisonSelection } from "@/hooks/useComparisonSelection";
import { useMatchData } from "@/hooks/useMatchData";
import { updateDisplayPreferences } from "@/lib/storage/preferences";
import { usePreferences } from "@/hooks/usePreferences";
import {
  DEFAULT_CATALOGUE_FILTERS,
  countActiveFilters,
  deriveFilterOptions,
  filterOpportunities,
  sortOpportunities,
  type CatalogueFilters,
  type CatalogueSortKey,
} from "@/lib/catalogue/search";
import type { DeadlineLifecycleStatus, DeadlinePrecision } from "@/lib/domain";
import type { ApplicationStageOption } from "@/lib/storage/types";
import { CatalogueToolbar } from "./CatalogueToolbar";
import { FilterPanel } from "./FilterPanel";
import { OpportunityCard } from "./OpportunityCard";

function filtersFromSearchParams(params: URLSearchParams): { filters: CatalogueFilters; sort: CatalogueSortKey } {
  const readArray = (key: string) => params.get(key)?.split(",").filter(Boolean) ?? [];
  return {
    filters: {
      ...DEFAULT_CATALOGUE_FILTERS,
      query: params.get("q") ?? "",
      countries: readArray("countries"),
      regions: readArray("regions"),
      studyLevels: readArray("levels"),
      opportunityTypes: readArray("types"),
      providers: readArray("providers"),
      fundingCategories: readArray("funding"),
      deadlineStates: readArray("states") as DeadlineLifecycleStatus[],
      precisions: readArray("precisions") as DeadlinePrecision[],
      origin: readArray("origin") as ("built-in" | "custom")[],
      stages: readArray("stages") as ApplicationStageOption[],
      requiredDocumentsOnly: params.get("hasDocuments") === "true",
      eligibilityRulesOnly: params.get("hasEligibility") === "true",
      matchLabels: readArray("match") as CatalogueFilters["matchLabels"],
    },
    sort: (params.get("sort") as CatalogueSortKey) || "nearest-deadline",
  };
}

function searchParamsFromFilters(filters: CatalogueFilters, sort: CatalogueSortKey): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.query.trim()) params.set("q", filters.query.trim());
  if (filters.countries.length) params.set("countries", filters.countries.join(","));
  if (filters.regions.length) params.set("regions", filters.regions.join(","));
  if (filters.studyLevels.length) params.set("levels", filters.studyLevels.join(","));
  if (filters.opportunityTypes.length) params.set("types", filters.opportunityTypes.join(","));
  if (filters.providers.length) params.set("providers", filters.providers.join(","));
  if (filters.fundingCategories.length) params.set("funding", filters.fundingCategories.join(","));
  if (filters.deadlineStates.length) params.set("states", filters.deadlineStates.join(","));
  if (filters.precisions.length) params.set("precisions", filters.precisions.join(","));
  if (filters.origin.length) params.set("origin", filters.origin.join(","));
  if (filters.stages.length) params.set("stages", filters.stages.join(","));
  if (filters.requiredDocumentsOnly) params.set("hasDocuments", "true");
  if (filters.eligibilityRulesOnly) params.set("hasEligibility", "true");
  if (filters.matchLabels.length) params.set("match", filters.matchLabels.join(","));
  if (sort !== "nearest-deadline") params.set("sort", sort);
  return params;
}

export function CatalogueExplorer({
  showFilters = true,
  studentProfileId = null,
}: {
  showFilters?: boolean;
  studentProfileId?: string | null;
}) {
  const { items, loading, lastSyncedAt, isStale, isServiceUnavailable } = useCatalogue();
  const { preferences } = usePreferences();
  const comparison = useComparisonSelection();
  const { answers, planning } = useMatchData(studentProfileId);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const initial = useMemo(() => filtersFromSearchParams(searchParams), []); // eslint-disable-line react-hooks/exhaustive-deps
  const [filters, setFilters] = useState<CatalogueFilters>(initial.filters);
  const [sortKey, setSortKey] = useState<CatalogueSortKey>(initial.sort);
  const [view, setView] = useState<"grid" | "list">("grid");

  // Load the persisted view preference once it arrives from IndexedDB.
  // Deliberately a one-time sync (not a continuous effect keyed on
  // `preferences`) so a later, unrelated preferences refresh can't clobber a
  // view the guest has since toggled manually.
  const [hasLoadedViewPreference, setHasLoadedViewPreference] = useState(false);
  if (!hasLoadedViewPreference && preferences) {
    setHasLoadedViewPreference(true);
    setView(preferences.display.catalogueView);
  }

  useEffect(() => {
    const params = searchParamsFromFilters(filters, sortKey);
    const next = params.toString();
    const current = searchParams.toString();
    if (next !== current) {
      router.replace(next ? `${pathname}?${next}` : pathname, { scroll: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, sortKey, pathname]);

  const options = useMemo(() => deriveFilterOptions(items.map((item) => item.opportunity)), [items]);
  const filtered = useMemo(() => filterOpportunities(items, filters, { answers, planning }), [items, filters, answers, planning]);
  const sorted = useMemo(() => sortOpportunities(filtered, sortKey, filters.query), [filtered, sortKey, filters.query]);
  const activeFilterCount = countActiveFilters(filters);

  const changeView = useCallback((next: "grid" | "list") => {
    setView(next);
    void updateDisplayPreferences({ catalogueView: next });
  }, []);

  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton key={index} className="h-72 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {comparison.ids.length > 0 ? (
        <div className="sticky top-16 z-10 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-surface p-3 shadow-sm">
          <p className="text-sm text-foreground">
            {comparison.ids.length} of {comparison.maxItems} selected for comparison
          </p>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={comparison.clear}>
              Clear
            </Button>
            <Button size="sm" asChild disabled={comparison.ids.length < 2}>
              <a href={`/compare?ids=${comparison.ids.join(",")}`}>Compare now</a>
            </Button>
          </div>
        </div>
      ) : null}
      {isServiceUnavailable ? (
        <Alert tone="danger" title="Catalogue unavailable offline">
          This device has never successfully synced the opportunity catalogue, and there is no connection right now.
          Custom opportunities you added yourself are unaffected.
        </Alert>
      ) : isStale && lastSyncedAt ? (
        <Alert tone="warning" title="Showing a cached catalogue">
          You&rsquo;re offline or the server is unreachable. Showing the catalogue as last synced on{" "}
          {new Date(lastSyncedAt).toLocaleString()}.
        </Alert>
      ) : null}

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        {showFilters ? (
          <aside className="lg:w-72 lg:shrink-0" aria-label="Filter opportunities">
            <FilterPanel options={options} filters={filters} onChange={setFilters} />
          </aside>
        ) : null}

        <div className="min-w-0 flex-1">
          <CatalogueToolbar
            query={filters.query}
            onQueryChange={(query) => setFilters((prev) => ({ ...prev, query }))}
            sortKey={sortKey}
            onSortChange={setSortKey}
            view={view}
            onViewChange={changeView}
            resultCount={sorted.length}
            activeFilterCount={activeFilterCount}
          />

          {showFilters ? (
            <div className="mt-3 flex flex-col gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <SaveSearchButton
                  studentProfileId={studentProfileId}
                  filters={filters}
                  sortKey={sortKey}
                  resultIds={sorted.map((item) => item.opportunity.id)}
                />
              </div>
              <details className="rounded-lg border border-border p-3">
                <summary className="cursor-pointer text-sm font-semibold text-foreground">Saved searches</summary>
                <div className="mt-3">
                  <SavedSearchesPanel
                    studentProfileId={studentProfileId}
                    onRun={(nextFilters, nextSort) => {
                      setFilters(nextFilters);
                      setSortKey(nextSort);
                    }}
                  />
                </div>
              </details>
            </div>
          ) : null}

          <div className="mt-4">
            {sorted.length === 0 ? (
              <EmptyState
                icon={<SearchX className="h-6 w-6" />}
                title="No opportunities match your filters"
                description="Try removing a filter or searching with a different term."
                action={
                  <Button variant="outline" size="sm" onClick={() => setFilters(DEFAULT_CATALOGUE_FILTERS)}>
                    Reset all filters
                  </Button>
                }
              />
            ) : (
              <div
                className={
                  view === "grid"
                    ? "grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3"
                    : "flex flex-col gap-3"
                }
              >
                {sorted.map((item) => (
                  <OpportunityCard key={item.opportunity.id} item={item} matchContext={{ answers, planning }} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
