"use client";

import { CalendarDays, ClipboardList, Plus, Sparkles } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/common/EmptyState";
import { CatalogueToolbar } from "@/components/opportunities/CatalogueToolbar";
import { OpportunityCard } from "@/components/opportunities/OpportunityCard";
import { useCatalogue } from "@/hooks/useCatalogue";
import {
  DEFAULT_CATALOGUE_FILTERS,
  filterOpportunities,
  sortOpportunities,
  type CatalogueSortKey,
} from "@/lib/catalogue/search";
import { WorkspaceSummary } from "./WorkspaceSummary";

function isTracked(item: ReturnType<typeof useCatalogue>["items"][number]): boolean {
  // Custom opportunities are always "yours" and belong in the workspace
  // regardless of tracking state; built-in opportunities show up only once
  // the guest has actually started tracking them.
  if (item.opportunity.kind === "custom") return true;

  const record = item.workspace;
  if (!record) return false;
  return (
    record.shortlisted ||
    record.stage !== "not-started" ||
    record.notes.trim().length > 0 ||
    record.checklist.length > 0 ||
    record.personalDeadline !== null
  );
}

export function WorkspaceView() {
  const { items, now, loading } = useCatalogue();
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<CatalogueSortKey>("recently-updated");
  const [view, setView] = useState<"grid" | "list">("grid");

  const trackedItems = useMemo(() => items.filter(isTracked), [items]);
  const filtered = useMemo(
    () => filterOpportunities(trackedItems, { ...DEFAULT_CATALOGUE_FILTERS, query }),
    [trackedItems, query],
  );
  const sorted = useMemo(() => sortOpportunities(filtered, sortKey), [filtered, sortKey]);

  if (loading || !now) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (trackedItems.length === 0) {
    return (
      <EmptyState
        icon={<ClipboardList className="h-6 w-6" />}
        title="Your workspace is empty"
        description="Shortlist an opportunity, set an application stage, or add a custom opportunity to start tracking it here."
        action={
          <div className="flex flex-wrap justify-center gap-2">
            <Button size="sm" asChild>
              <Link href="/opportunities">Browse opportunities</Link>
            </Button>
            <Button size="sm" variant="outline" asChild>
              <Link href="/custom-opportunities/new">
                <Plus className="h-4 w-4" aria-hidden="true" /> Add a custom opportunity
              </Link>
            </Button>
          </div>
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <WorkspaceSummary items={items} now={now} />

      <div className="flex flex-wrap gap-2">
        <Link
          href="/calendar"
          className="inline-flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-2 text-sm font-medium text-foreground hover:bg-surface-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)]"
        >
          <CalendarDays className="h-4 w-4 text-brand" aria-hidden="true" />
          Review upcoming deadlines
        </Link>
        <Link
          href="/workspace/assistant"
          className="inline-flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-2 text-sm font-medium text-foreground hover:bg-surface-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)]"
        >
          <Sparkles className="h-4 w-4 text-brand" aria-hidden="true" />
          Ask Scholarly what to do next
        </Link>
      </div>

      <CatalogueToolbar
        query={query}
        onQueryChange={setQuery}
        sortKey={sortKey}
        onSortChange={setSortKey}
        view={view}
        onViewChange={setView}
        resultCount={sorted.length}
        activeFilterCount={0}
      />

      {sorted.length === 0 ? (
        <EmptyState title="No tracked opportunities match your search" description="Try a different search term." />
      ) : (
        <div
          className={
            view === "grid" ? "grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3" : "flex flex-col gap-3"
          }
        >
          {sorted.map((item) => (
            <OpportunityCard key={item.opportunity.id} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}
