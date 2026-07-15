"use client";

import { getPreferences } from "@/lib/storage/preferences";
import type { PreferencesRecord } from "@/lib/storage/types";
import { useStorageCollection } from "./useStorageCollection";

export function usePreferences(): {
  preferences: PreferencesRecord | undefined;
  loading: boolean;
  error: string | null;
} {
  const [preferences, { loading, error }] = useStorageCollection<PreferencesRecord | undefined>(
    "preferences",
    getPreferences,
    undefined,
  );
  return { preferences, loading, error };
}
