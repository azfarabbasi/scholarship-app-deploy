export type SyncStatus = "saved" | "saving" | "offline" | "paused" | "failed" | "conflict";

interface SyncStatusState {
  status: SyncStatus;
  lastSyncedAt: string | null;
  pendingCount: number;
}

let state: SyncStatusState = { status: "saved", lastSyncedAt: null, pendingCount: 0 };
const target = new EventTarget();

export function getSyncStatusState(): SyncStatusState {
  return state;
}

export function subscribeSyncStatus(listener: () => void): () => void {
  target.addEventListener("change", listener);
  return () => target.removeEventListener("change", listener);
}

function emit() {
  target.dispatchEvent(new Event("change"));
}

export function setSyncStatus(status: SyncStatus): void {
  state = { ...state, status };
  emit();
}

export function setPendingCount(pendingCount: number): void {
  state = { ...state, pendingCount, status: pendingCount > 0 && state.status === "saved" ? "offline" : state.status };
  emit();
}

export function recordSynced(iso: string): void {
  state = { status: "saved", lastSyncedAt: iso, pendingCount: 0 };
  emit();
}

/** Resets sync status to its default — call this on sign-out. */
export function resetSyncStatus(): void {
  state = { status: "saved", lastSyncedAt: null, pendingCount: 0 };
  emit();
}
