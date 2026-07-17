import { getDb } from "./db";
import { emitStorageChange } from "./events";
import type { SavedSearchRecord } from "./types";

function nowIso(): string {
  return new Date().toISOString();
}

export async function getAllGuestSavedSearches(): Promise<SavedSearchRecord[]> {
  const db = await getDb();
  return db.getAll("savedSearches");
}

export interface SaveSearchInput {
  name: string;
  queryText: string;
  filters: Record<string, unknown>;
  sortMode: string;
  resultCountSnapshot: number;
  resultSnapshot: string[];
}

export async function createGuestSavedSearch(input: SaveSearchInput): Promise<SavedSearchRecord> {
  const db = await getDb();
  const timestamp = nowIso();
  const record: SavedSearchRecord = {
    id: crypto.randomUUID(),
    name: input.name,
    queryText: input.queryText,
    filters: input.filters,
    sortMode: input.sortMode,
    resultCountSnapshot: input.resultCountSnapshot,
    resultSnapshot: input.resultSnapshot,
    lastCheckedAt: timestamp,
    alertsEnabled: true,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  await db.put("savedSearches", record);
  emitStorageChange("savedSearches");
  return record;
}

async function update(id: string, mutate: (record: SavedSearchRecord) => SavedSearchRecord): Promise<SavedSearchRecord | null> {
  const db = await getDb();
  const existing = await db.get("savedSearches", id);
  if (!existing) return null;
  const updated = { ...mutate(existing), id, updatedAt: nowIso() };
  await db.put("savedSearches", updated);
  emitStorageChange("savedSearches");
  return updated;
}

export async function renameGuestSavedSearch(id: string, name: string): Promise<SavedSearchRecord | null> {
  return update(id, (record) => ({ ...record, name }));
}

export async function setGuestSavedSearchAlerts(id: string, alertsEnabled: boolean): Promise<SavedSearchRecord | null> {
  return update(id, (record) => ({ ...record, alertsEnabled }));
}

/** Called when the saved search is re-run — refreshes the alert-diff snapshot. */
export async function refreshGuestSavedSearchSnapshot(
  id: string,
  resultCountSnapshot: number,
  resultSnapshot: string[],
): Promise<SavedSearchRecord | null> {
  return update(id, (record) => ({ ...record, resultCountSnapshot, resultSnapshot, lastCheckedAt: nowIso() }));
}

export async function deleteGuestSavedSearch(id: string): Promise<void> {
  const db = await getDb();
  await db.delete("savedSearches", id);
  emitStorageChange("savedSearches");
}
