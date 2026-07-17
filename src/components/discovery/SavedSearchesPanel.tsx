"use client";

import { Bell, BellOff, Play, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import { Alert } from "@/components/ui/Alert";
import { useCatalogue } from "@/hooks/useCatalogue";
import { DEFAULT_CATALOGUE_FILTERS, filterOpportunities, type CatalogueFilters, type CatalogueSortKey } from "@/lib/catalogue/search";
import { diffSavedSearchResults } from "@/lib/discovery/saved-search-alerts";
import { subscribeToStorageChange } from "@/lib/storage/events";
import {
  deleteGuestSavedSearch,
  getAllGuestSavedSearches,
  refreshGuestSavedSearchSnapshot,
  renameGuestSavedSearch,
  setGuestSavedSearchAlerts,
} from "@/lib/storage/saved-searches";
import {
  deleteMySavedSearch,
  getMySavedSearches,
  refreshMySavedSearchSnapshot,
  renameMySavedSearch,
  setMySavedSearchAlerts,
  type SavedSearchRow,
} from "@/lib/db/actions/student/saved-searches";

interface SavedSearchesPanelProps {
  studentProfileId: string | null;
  onRun: (filters: CatalogueFilters, sort: CatalogueSortKey) => void;
}

interface NormalizedSavedSearch {
  id: string;
  name: string;
  filters: CatalogueFilters;
  sortMode: CatalogueSortKey;
  resultCountSnapshot: number | null;
  resultSnapshot: string[];
  lastCheckedAt: string | null;
  alertsEnabled: boolean;
}

function normalize(row: SavedSearchRow | Awaited<ReturnType<typeof getAllGuestSavedSearches>>[number]): NormalizedSavedSearch {
  return {
    id: row.id,
    name: row.name,
    filters: { ...DEFAULT_CATALOGUE_FILTERS, ...(row.filters as Partial<CatalogueFilters>) },
    sortMode: (row.sortMode as CatalogueSortKey) ?? "relevance",
    resultCountSnapshot: row.resultCountSnapshot,
    resultSnapshot: (row.resultSnapshot as string[]) ?? [],
    lastCheckedAt:
      "lastCheckedAt" in row && row.lastCheckedAt
        ? typeof row.lastCheckedAt === "string"
          ? row.lastCheckedAt
          : row.lastCheckedAt.toISOString()
        : null,
    alertsEnabled: row.alertsEnabled,
  };
}

export function SavedSearchesPanel({ studentProfileId, onRun }: SavedSearchesPanelProps) {
  const { items } = useCatalogue();
  const [searches, setSearches] = useState<NormalizedSavedSearch[]>([]);
  const [loading, setLoading] = useState(true);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  async function refresh() {
    const rows = studentProfileId ? await getMySavedSearches() : await getAllGuestSavedSearches();
    setSearches(rows.map(normalize));
    setLoading(false);
  }

  useEffect(() => {
    // `refresh` sets state only after its own network/IndexedDB await resolves,
    // never synchronously within this effect body.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentProfileId]);

  // Guest saved searches can also be created from `SaveSearchButton`, a sibling component with no
  // direct reference to this one — subscribing here (rather than relying only on the mount-time
  // fetch above) is what actually picks up a freshly-saved search without a manual reload.
  useEffect(() => {
    if (studentProfileId) return undefined;
    return subscribeToStorageChange("savedSearches", () => {
      void refresh();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentProfileId]);

  const alerts = useMemo(() => {
    const map = new Map<string, ReturnType<typeof diffSavedSearchResults>>();
    for (const search of searches) {
      if (!search.alertsEnabled || items.length === 0) continue;
      const currentIds = filterOpportunities(items, search.filters).map((i) => i.opportunity.id);
      map.set(search.id, diffSavedSearchResults(search.resultSnapshot, currentIds));
    }
    return map;
  }, [searches, items]);

  async function handleRun(search: NormalizedSavedSearch) {
    onRun(search.filters, search.sortMode);
    const currentIds = filterOpportunities(items, search.filters).map((i) => i.opportunity.id);
    if (studentProfileId) {
      await refreshMySavedSearchSnapshot(search.id, currentIds.length, currentIds);
    } else {
      await refreshGuestSavedSearchSnapshot(search.id, currentIds.length, currentIds);
    }
    await refresh();
  }

  async function handleDelete(id: string) {
    if (studentProfileId) await deleteMySavedSearch(id);
    else await deleteGuestSavedSearch(id);
    await refresh();
  }

  async function handleToggleAlerts(search: NormalizedSavedSearch) {
    if (studentProfileId) await setMySavedSearchAlerts(search.id, !search.alertsEnabled);
    else await setGuestSavedSearchAlerts(search.id, !search.alertsEnabled);
    await refresh();
  }

  async function handleRename(id: string) {
    const trimmed = renameValue.trim();
    if (!trimmed) return;
    if (studentProfileId) await renameMySavedSearch(id, trimmed);
    else await renameGuestSavedSearch(id, trimmed);
    setRenamingId(null);
    await refresh();
  }

  if (loading) return null;
  if (searches.length === 0) {
    return <p className="text-sm text-foreground-muted">No saved searches yet — save your current filters above to check back later.</p>;
  }

  return (
    <ul className="flex flex-col gap-3">
      {searches.map((search) => {
        const alert = alerts.get(search.id);
        return (
          <li key={search.id} className="rounded-lg border border-border p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              {renamingId === search.id ? (
                <div className="flex items-center gap-2">
                  <Input value={renameValue} onChange={(e) => setRenameValue(e.target.value)} autoFocus className="max-w-xs" />
                  <Button size="sm" onClick={() => void handleRename(search.id)}>
                    Save
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setRenamingId(null)}>
                    Cancel
                  </Button>
                </div>
              ) : (
                <button
                  type="button"
                  className="text-sm font-medium text-foreground underline decoration-dotted"
                  onClick={() => {
                    setRenamingId(search.id);
                    setRenameValue(search.name);
                  }}
                >
                  {search.name}
                </button>
              )}
              <span className="text-xs text-foreground-muted">
                {search.resultCountSnapshot ?? 0} result{search.resultCountSnapshot === 1 ? "" : "s"} ·{" "}
                {studentProfileId ? "Synced to your account" : "Local only"}
              </span>
            </div>

            <p className="mt-1 text-xs text-foreground-subtle">
              Last checked: {search.lastCheckedAt ? new Date(search.lastCheckedAt).toLocaleString() : "never"}
            </p>

            {alert?.hasAlert ? (
              <Alert tone="info" className="mt-2">
                {alert.messages.join(" ")}
              </Alert>
            ) : null}

            <div className="mt-2 flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => void handleRun(search)}>
                <Play className="h-3.5 w-3.5" aria-hidden="true" /> Run
              </Button>
              <Button size="sm" variant="outline" onClick={() => void handleToggleAlerts(search)}>
                {search.alertsEnabled ? <BellOff className="h-3.5 w-3.5" aria-hidden="true" /> : <Bell className="h-3.5 w-3.5" aria-hidden="true" />}
                {search.alertsEnabled ? "Turn off alerts" : "Turn on alerts"}
              </Button>
              <Button size="sm" variant="danger" onClick={() => void handleDelete(search.id)}>
                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" /> Delete
              </Button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
