import { getDb } from "./db";
import { emitStorageChange } from "./events";
import {
  DEFAULT_DISPLAY_PREFERENCES,
  DEFAULT_PLANNING_PREFERENCES,
  type DisplayPreferences,
  type PlanningPreferences,
  type PreferencesRecord,
} from "./types";

const SINGLETON_ID = "singleton" as const;

function defaults(): PreferencesRecord {
  return {
    id: SINGLETON_ID,
    planning: { ...DEFAULT_PLANNING_PREFERENCES },
    display: { ...DEFAULT_DISPLAY_PREFERENCES },
    updatedAt: new Date().toISOString(),
  };
}

export async function getPreferences(): Promise<PreferencesRecord> {
  const db = await getDb();
  const existing = await db.get("preferences", SINGLETON_ID);
  return existing ?? defaults();
}

async function upsert(mutate: (record: PreferencesRecord) => PreferencesRecord): Promise<PreferencesRecord> {
  const db = await getDb();
  const existing = (await db.get("preferences", SINGLETON_ID)) ?? defaults();
  const updated = { ...mutate(existing), id: SINGLETON_ID, updatedAt: new Date().toISOString() };
  await db.put("preferences", updated);
  emitStorageChange("preferences");
  return updated;
}

export async function updatePlanningPreferences(
  partial: Partial<PlanningPreferences>,
): Promise<PreferencesRecord> {
  return upsert((record) => ({ ...record, planning: { ...record.planning, ...partial } }));
}

export async function updateDisplayPreferences(
  partial: Partial<DisplayPreferences>,
): Promise<PreferencesRecord> {
  return upsert((record) => ({ ...record, display: { ...record.display, ...partial } }));
}

export async function resetPreferences(): Promise<PreferencesRecord> {
  const db = await getDb();
  const reset = defaults();
  await db.put("preferences", reset);
  emitStorageChange("preferences");
  return reset;
}
