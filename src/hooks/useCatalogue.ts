"use client";

import { useMemo } from "react";
import { customOpportunityToCatalogueOpportunity } from "@/lib/catalogue/custom-adapter";
import { getAllBuiltInOpportunities } from "@/lib/catalogue/repository";
import type { EnrichedOpportunity } from "@/lib/catalogue/types";
import { evaluateDeadline } from "@/lib/deadlines/engine";
import { useCustomOpportunities } from "./useCustomOpportunities";
import { useNow } from "./useNow";
import { useWorkspaceRecords } from "./useWorkspace";

/** The combined, evaluated built-in + custom catalogue. The one hook every data view builds on. */
export function useCatalogue(): {
  items: EnrichedOpportunity[];
  now: Date | null;
  loading: boolean;
} {
  const now = useNow();
  const { records: customRecords, loading: customLoading } = useCustomOpportunities();
  const { records: workspaceRecords, loading: workspaceLoading } = useWorkspaceRecords();

  const builtIn = useMemo(() => getAllBuiltInOpportunities(), []);
  const custom = useMemo(
    () => customRecords.map(customOpportunityToCatalogueOpportunity),
    [customRecords],
  );
  const opportunities = useMemo(() => [...builtIn, ...custom], [builtIn, custom]);

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

  return { items, now, loading: !now || customLoading || workspaceLoading };
}
