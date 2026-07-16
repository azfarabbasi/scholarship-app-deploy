"use client";

import { useMemo } from "react";
import { customOpportunityToCatalogueOpportunity } from "@/lib/catalogue/custom-adapter";
import type { EnrichedOpportunity } from "@/lib/catalogue/types";
import { evaluateDeadline } from "@/lib/deadlines/engine";
import { useBuiltInOpportunities } from "./useBuiltInOpportunities";
import { useCustomOpportunities } from "./useCustomOpportunities";
import { useNow } from "./useNow";
import { useWorkspaceRecords } from "./useWorkspace";

/** The combined, evaluated built-in (database) + custom (guest-local) catalogue. The one hook every data view builds on. */
export function useCatalogue(): {
  items: EnrichedOpportunity[];
  now: Date | null;
  loading: boolean;
  /** Last time the built-in catalogue was successfully synced from the server; null if never. */
  lastSyncedAt: string | null;
  /** True when showing a cached (not freshly fetched) built-in catalogue snapshot. */
  isStale: boolean;
  /** True only when the built-in catalogue could not be fetched AND no offline cache exists at all. */
  isServiceUnavailable: boolean;
} {
  const now = useNow();
  const builtInState = useBuiltInOpportunities();
  const { records: customRecords, loading: customLoading } = useCustomOpportunities();
  const { records: workspaceRecords, loading: workspaceLoading } = useWorkspaceRecords();

  const custom = useMemo(
    () => customRecords.map(customOpportunityToCatalogueOpportunity),
    [customRecords],
  );
  const opportunities = useMemo(
    () => [...builtInState.items, ...custom],
    [builtInState.items, custom],
  );

  const items = useMemo<EnrichedOpportunity[]>(() => {
    if (!now) {
      return [];
    }
    const workspaceByOpportunity = new Map(workspaceRecords.map((record) => [record.opportunityId, record]));
    return opportunities.map((opportunity) => ({
      opportunity,
      evaluation: evaluateDeadline(opportunity.deadlineInput, now),
      workspace: workspaceByOpportunity.get(opportunity.id) ?? null,
    }));
  }, [opportunities, workspaceRecords, now]);

  return {
    items,
    now,
    loading: !now || builtInState.loading || customLoading || workspaceLoading,
    lastSyncedAt: builtInState.lastSyncedAt,
    isStale: builtInState.isStale,
    isServiceUnavailable: builtInState.isServiceUnavailable,
  };
}
