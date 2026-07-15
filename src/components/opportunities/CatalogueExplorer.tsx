"use client";

import { SearchX } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/common/EmptyState";
import { useCatalogue } from "@/hooks/useCatalogue";
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
      deadlineStates: readArray("states") as DeadlineLifecycleStatus[],
      precisions: readArray("precisions") as DeadlinePrecision[],
      origin: readArray("origin") as ("built-in" | "custom")[],
      stages: readArray("stages") as ApplicationStageOption[],
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
  if (filters.deadlineStates.length) params.set("states", filters.deadlineStates.join(","));
  if (filters.precisions.length) params.set("precisions", filters.precisions.join(","));
  if (filters.origin.length) params.set("origin", filters.origin.join(","));
  if (filters.stages.length) params.set("stages", filters.stages.join(","));
  if (sort !== "nearest-deadline") params.set("sort", sort);
  return params;
}

export function CatalogueExplorer({ showFilters = true }: { showFilters?: boolean }) {
  const { items, loading } = useCatalogue();
  const { preferences } = usePreferences();
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
  const filtered = useMemo(() => filterOpportunities(items, filters), [items, filters]);
  const sorted = useMemo(() => sortOpportunities(filtered, sortKey), [filtered, sortKey]);
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
                <OpportunityCard key={item.opportunity.id} item={item} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
