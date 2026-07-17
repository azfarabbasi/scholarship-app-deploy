import { getDb } from "./db";
import { emitStorageChange } from "./events";
import { DEFAULT_REMINDER_PREFERENCES, type ReminderPreferencesRecord, type ReminderRecord, type ReminderStatus } from "./types";

const SINGLETON_ID = "singleton" as const;

export async function getGuestReminderPreferences(): Promise<ReminderPreferencesRecord> {
  const db = await getDb();
  return (await db.get("reminderPreferences", SINGLETON_ID)) ?? DEFAULT_REMINDER_PREFERENCES;
}

export async function setGuestReminderPreferences(
  partial: Partial<Omit<ReminderPreferencesRecord, "id" | "updatedAt">>,
): Promise<ReminderPreferencesRecord> {
  const db = await getDb();
  const existing = (await db.get("reminderPreferences", SINGLETON_ID)) ?? DEFAULT_REMINDER_PREFERENCES;
  const updated: ReminderPreferencesRecord = { ...existing, ...partial, id: SINGLETON_ID, updatedAt: new Date().toISOString() };
  await db.put("reminderPreferences", updated);
  emitStorageChange("reminderPreferences");
  return updated;
}

export async function getAllGuestReminders(): Promise<ReminderRecord[]> {
  const db = await getDb();
  return db.getAll("reminders");
}

/**
 * Upserts a batch of deterministically-generated reminders, keyed by
 * `stableKey` — regenerating never duplicates or resurrects a reminder the
 * user already dismissed/completed (existing status is always preserved).
 */
export async function upsertGuestReminders(candidates: readonly Omit<ReminderRecord, "id" | "status" | "createdAt" | "updatedAt">[]): Promise<void> {
  const db = await getDb();
  const existing = await db.getAll("reminders");
  const byStableKey = new Map(existing.map((r) => [r.stableKey, r]));
  const timestamp = new Date().toISOString();

  const tx = db.transaction("reminders", "readwrite");
  for (const candidate of candidates) {
    const current = byStableKey.get(candidate.stableKey);
    if (current) continue; // never overwrite a reminder the user has already interacted with
    await tx.store.put({ ...candidate, id: crypto.randomUUID(), status: "pending", createdAt: timestamp, updatedAt: timestamp });
  }
  await tx.done;
  emitStorageChange("reminders");
}

export async function setGuestReminderStatus(id: string, status: ReminderStatus): Promise<void> {
  const db = await getDb();
  const existing = await db.get("reminders", id);
  if (!existing) return;
  await db.put("reminders", { ...existing, status, updatedAt: new Date().toISOString() });
  emitStorageChange("reminders");
}

export async function deleteGuestReminder(id: string): Promise<void> {
  const db = await getDb();
  await db.delete("reminders", id);
  emitStorageChange("reminders");
}
