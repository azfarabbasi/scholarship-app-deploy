"use client";

import { useSyncExternalStore } from "react";
import { getSyncStatusState, subscribeSyncStatus } from "@/lib/sync/status";

function getServerSnapshot() {
  return { status: "saved" as const, lastSyncedAt: null, pendingCount: 0 };
}

/** Reactive read of the module-level sync status store (see `src/lib/sync/status.ts`). */
export function useSyncStatus() {
  return useSyncExternalStore(subscribeSyncStatus, getSyncStatusState, getServerSnapshot);
}
