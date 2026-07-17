/**
 * A tiny same-tab pub/sub so React hooks reading IndexedDB stay in sync
 * without a state-management dependency. Cross-tab sync is intentionally out
 * of scope for Checkpoint 1 (guest data is single-browser, single-tab first).
 */
export type StorageChannel =
  | "workspace"
  | "customOpportunities"
  | "preferences"
  | "backup"
  | "eligibilityAnswers"
  | "savedSearches"
  | "reminderPreferences"
  | "reminders"
  | "notifications";

const target = new EventTarget();

export function emitStorageChange(channel: StorageChannel): void {
  target.dispatchEvent(new CustomEvent(channel));
}

export function subscribeToStorageChange(channel: StorageChannel, listener: () => void): () => void {
  target.addEventListener(channel, listener);
  return () => target.removeEventListener(channel, listener);
}
