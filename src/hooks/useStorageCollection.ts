"use client";

import { useCallback, useEffect, useState } from "react";
import { subscribeToStorageChange, type StorageChannel } from "@/lib/storage/events";

interface StorageCollectionState<T> {
  data: T;
  loading: boolean;
  error: string | null;
}

export function useStorageCollection<T>(
  channel: StorageChannel,
  loader: () => Promise<T>,
  fallback: T,
): [T, { loading: boolean; error: string | null; refresh: () => void }] {
  const [state, setState] = useState<StorageCollectionState<T>>({
    data: fallback,
    loading: true,
    error: null,
  });

  const refresh = useCallback(() => {
    loader()
      .then((data) => setState({ data, loading: false, error: null }))
      .catch((error: unknown) =>
        setState((prev) => ({
          ...prev,
          loading: false,
          error: error instanceof Error ? error.message : "Local storage is unavailable.",
        })),
      );
    // eslint-disable-next-line react-hooks/exhaustive-deps -- loader identity is stable per call site
  }, []);

  useEffect(() => {
    refresh();
    return subscribeToStorageChange(channel, refresh);
  }, [channel, refresh]);

  return [state.data, { loading: state.loading, error: state.error, refresh }];
}
