"use client";

import { LayoutGrid, List, Search } from "lucide-react";
import { Input, Select } from "@/components/ui/Field";
import { cn } from "@/lib/cn";
import type { CatalogueSortKey } from "@/lib/catalogue/search";

const SORT_OPTIONS: { value: CatalogueSortKey; label: string }[] = [
  { value: "nearest-deadline", label: "Nearest reliable deadline" },
  { value: "personal-deadline", label: "Personal deadline" },
  { value: "title-asc", label: "Title (A–Z)" },
  { value: "country-asc", label: "Country (A–Z)" },
  { value: "recently-updated", label: "Recently updated" },
  { value: "application-stage", label: "Application stage" },
  { value: "deadline-state", label: "Deadline state" },
];

export interface CatalogueToolbarProps {
  query: string;
  onQueryChange: (value: string) => void;
  sortKey: CatalogueSortKey;
  onSortChange: (value: CatalogueSortKey) => void;
  view: "grid" | "list";
  onViewChange: (value: "grid" | "list") => void;
  resultCount: number;
  activeFilterCount: number;
}

export function CatalogueToolbar({
  query,
  onQueryChange,
  sortKey,
  onSortChange,
  view,
  onViewChange,
  resultCount,
  activeFilterCount,
}: CatalogueToolbarProps) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground-subtle"
          />
          <label htmlFor="catalogue-search" className="sr-only">
            Search opportunities
          </label>
          <Input
            id="catalogue-search"
            type="search"
            placeholder="Search by title, country, or eligibility…"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="flex items-center gap-2">
          <label htmlFor="catalogue-sort" className="whitespace-nowrap text-sm text-foreground-muted">
            Sort by
          </label>
          <Select
            id="catalogue-sort"
            value={sortKey}
            onChange={(e) => onSortChange(e.target.value as CatalogueSortKey)}
            className="w-auto"
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>

          <div role="group" aria-label="Catalogue view" className="inline-flex rounded-md border border-border">
            <button
              type="button"
              aria-pressed={view === "grid"}
              onClick={() => onViewChange("grid")}
              className={cn(
                "inline-flex h-10 w-10 items-center justify-center rounded-l-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)]",
                view === "grid" ? "bg-brand-tint text-brand" : "text-foreground-muted hover:bg-surface-muted",
              )}
            >
              <LayoutGrid className="h-4 w-4" aria-hidden="true" />
              <span className="sr-only">Grid view</span>
            </button>
            <button
              type="button"
              aria-pressed={view === "list"}
              onClick={() => onViewChange("list")}
              className={cn(
                "inline-flex h-10 w-10 items-center justify-center rounded-r-md border-l border-border focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)]",
                view === "list" ? "bg-brand-tint text-brand" : "text-foreground-muted hover:bg-surface-muted",
              )}
            >
              <List className="h-4 w-4" aria-hidden="true" />
              <span className="sr-only">List view</span>
            </button>
          </div>
        </div>
      </div>

      <p className="text-sm text-foreground-muted" role="status">
        {resultCount} opportunit{resultCount === 1 ? "y" : "ies"} found
        {activeFilterCount > 0 ? ` · ${activeFilterCount} filter${activeFilterCount === 1 ? "" : "s"} applied` : ""}
      </p>
    </div>
  );
}
