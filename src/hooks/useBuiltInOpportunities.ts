"use client";

import { useEffect, useState } from "react";
import type { CatalogueOpportunity } from "@/lib/catalogue/types";
import { getCachedPublicCatalogue, setCachedPublicCatalogue } from "@/lib/storage/public-catalogue-cache";

interface BuiltInOpportunitiesState {
  items: CatalogueOpportunity[];
  loading: boolean;
  /** When the shown data was last successfully fetched from the server (not necessarily "now"). */
  lastSyncedAt: string | null;
  /** True once a fetch failed and no cached snapshot exists to fall back on — a truthful first-time-offline state. */
  isServiceUnavailable: boolean;
  /** True when the shown data is a cached snapshot rather than a fresh response (offline, or the API errored). */
  isStale: boolean;
}

/**
 * Fetches the public database catalogue from `/api/opportunities` and caches
 * a copy in IndexedDB so it remains available offline. A successful fetch
 * always overwrites the cache; a failed fetch falls back to the last cached
 * snapshot (marking it stale) and only reports `isServiceUnavailable` when
 * there is no cache at all to fall back on.
 */
export function useBuiltInOpportunities(): BuiltInOpportunitiesState {
  const [state, setState] = useState<BuiltInOpportunitiesState>({
    items: [],
    loading: true,
    lastSyncedAt: null,
    isServiceUnavailable: false,
    isStale: false,
  });

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const response = await fetch("/api/opportunities", { cache: "no-store" });
        if (!response.ok) {
          throw new Error(`Unexpected status ${response.status}`);
        }
        const data = (await response.json()) as { syncedAt: string; opportunities: CatalogueOpportunity[] };
        if (cancelled) return;
        setState({
          items: data.opportunities,
          loading: false,
          lastSyncedAt: data.syncedAt,
          isServiceUnavailable: false,
          isStale: false,
        });
        void setCachedPublicCatalogue(data.opportunities, data.syncedAt);
      } catch {
        if (cancelled) return;
        const cached = await getCachedPublicCatalogue().catch(() => undefined);
        if (cancelled) return;
        if (cached) {
          setState({
            items: cached.items,
            loading: false,
            lastSyncedAt: cached.syncedAt,
            isServiceUnavailable: false,
            isStale: true,
          });
        } else {
          setState({ items: [], loading: false, lastSyncedAt: null, isServiceUnavailable: true, isStale: false });
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
