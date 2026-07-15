"use client";

import { getAllCustomOpportunities } from "@/lib/storage/custom-opportunities";
import type { CustomOpportunityRecord } from "@/lib/storage/types";
import { useStorageCollection } from "./useStorageCollection";

export function useCustomOpportunities(): {
  records: CustomOpportunityRecord[];
  loading: boolean;
  error: string | null;
} {
  const [records, { loading, error }] = useStorageCollection(
    "customOpportunities",
    getAllCustomOpportunities,
    [],
  );
  return { records, loading, error };
}
