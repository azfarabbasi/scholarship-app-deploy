"use client";

import { useCallback, useEffect, useState } from "react";
import type { CustomOpportunityInput } from "@/lib/schemas/custom-opportunity";
import {
  archiveMyCustomOpportunity,
  createMyCustomOpportunity,
  deleteMyCustomOpportunity,
  getMyCustomOpportunities,
  updateMyCustomOpportunity,
  type CustomOpportunityRow,
} from "@/lib/db/actions/student/custom-opportunities";

/**
 * Signed-in equivalent of the guest `useCustomOpportunities` hook. Simpler
 * than `useCloudWorkspace`: custom opportunities are edited far less often
 * than a shortlist/notes/checklist, so mutations here are direct
 * (best-effort, reporting a clear error when offline) rather than queued —
 * a documented scope decision, not an oversight (see
 * `docs/checkpoint-3/checkpoint-3-completion-report.md`).
 */
export function useCloudCustomOpportunities(studentProfileId: string | null) {
  const [records, setRecords] = useState<CustomOpportunityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!studentProfileId) {
      setRecords([]);
      setLoading(false);
      return;
    }
    try {
      setRecords(await getMyCustomOpportunities());
      setError(null);
    } catch {
      setError("Could not load your custom opportunities. You may be offline.");
    } finally {
      setLoading(false);
    }
  }, [studentProfileId]);

  useEffect(() => {
    // Data fetching on mount — see the same note in `useCloudWorkspace.ts`.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, [refresh]);

  const create = useCallback(
    async (input: CustomOpportunityInput) => {
      const result = await createMyCustomOpportunity(input);
      if (result.ok) await refresh();
      return result;
    },
    [refresh],
  );

  const update = useCallback(
    async (id: string, input: CustomOpportunityInput) => {
      const result = await updateMyCustomOpportunity(id, input);
      if (result.ok) await refresh();
      return result;
    },
    [refresh],
  );

  const archive = useCallback(
    async (id: string) => {
      const result = await archiveMyCustomOpportunity(id);
      if (result.ok) await refresh();
      return result;
    },
    [refresh],
  );

  const remove = useCallback(
    async (id: string) => {
      const result = await deleteMyCustomOpportunity(id);
      if (result.ok) await refresh();
      return result;
    },
    [refresh],
  );

  return { records, loading, error, refresh, create, update, archive, remove };
}
