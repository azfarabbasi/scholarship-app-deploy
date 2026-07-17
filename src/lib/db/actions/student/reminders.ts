"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getStudentSession } from "@/lib/auth/student-session";
import { getDb, schema } from "@/lib/db/client";
import { getPublishedOpportunities } from "@/lib/catalogue/db-repository";
import { extractExactVerifiedDeadline } from "@/lib/reminders/extract";
import { generateReminderCandidates, type ReminderSourceItem } from "@/lib/reminders/engine";

export type ReminderRow = typeof schema.userReminders.$inferSelect;
export type ReminderPreferencesRow = typeof schema.userReminderPreferences.$inferSelect;

export async function getMyReminderPreferences(): Promise<ReminderPreferencesRow | null> {
  const session = await getStudentSession();
  if (!session) return null;
  const db = getDb();
  const [row] = await db
    .select()
    .from(schema.userReminderPreferences)
    .where(eq(schema.userReminderPreferences.studentProfileId, session.studentProfileId))
    .limit(1);
  return row ?? null;
}

export interface ReminderPreferencesInput {
  remindersEnabled: boolean;
  officialLeadDays: number[];
  personalLeadDays: number[];
  savedSearchAlertsEnabled: boolean;
}

const ALLOWED_LEAD_DAYS = new Set([0, 1, 3, 7, 14, 30]);

export async function updateMyReminderPreferences(input: ReminderPreferencesInput): Promise<{ ok: boolean; error?: string }> {
  const session = await getStudentSession();
  if (!session) return { ok: false, error: "Not signed in." };

  const officialLeadDays = input.officialLeadDays.filter((d) => ALLOWED_LEAD_DAYS.has(d));
  const personalLeadDays = input.personalLeadDays.filter((d) => ALLOWED_LEAD_DAYS.has(d));

  const db = getDb();
  await db
    .insert(schema.userReminderPreferences)
    .values({
      studentProfileId: session.studentProfileId,
      remindersEnabled: input.remindersEnabled,
      officialLeadDays,
      personalLeadDays,
      savedSearchAlertsEnabled: input.savedSearchAlertsEnabled,
    })
    .onConflictDoUpdate({
      target: schema.userReminderPreferences.studentProfileId,
      set: { remindersEnabled: input.remindersEnabled, officialLeadDays, personalLeadDays, savedSearchAlertsEnabled: input.savedSearchAlertsEnabled, updatedAt: new Date() },
    });

  revalidatePath("/notifications");
  return { ok: true };
}

export async function getMyReminders(): Promise<ReminderRow[]> {
  const session = await getStudentSession();
  if (!session) return [];
  const db = getDb();
  return db.select().from(schema.userReminders).where(eq(schema.userReminders.studentProfileId, session.studentProfileId));
}

export interface ReminderCandidate {
  stableKey: string;
  source: (typeof schema.userReminders.$inferInsert)["source"];
  targetType?: "built-in" | "custom" | null;
  targetId?: string | null;
  title: string;
  dueAt: string;
  leadDays: number;
}

/**
 * Upserts deterministically-generated reminders, one row per unique
 * `stableKey` (`source:targetId:dueDate:leadDays`, built by the caller).
 * Never overwrites a reminder the student already dismissed/completed —
 * regenerating must never resurrect one, matching the guest-side behaviour
 * in `src/lib/storage/reminders.ts`.
 */
export async function upsertMyReminders(candidates: readonly ReminderCandidate[]): Promise<{ ok: boolean; created: number }> {
  const session = await getStudentSession();
  if (!session) return { ok: false, created: 0 };

  const db = getDb();
  const existing = await db
    .select({ stableKey: schema.userReminders.stableKey })
    .from(schema.userReminders)
    .where(eq(schema.userReminders.studentProfileId, session.studentProfileId));
  const existingKeys = new Set(existing.map((r) => r.stableKey));

  const fresh = candidates.filter((c) => !existingKeys.has(c.stableKey));
  if (fresh.length === 0) return { ok: true, created: 0 };

  await db.insert(schema.userReminders).values(
    fresh.map((c) => ({
      studentProfileId: session.studentProfileId,
      stableKey: c.stableKey,
      source: c.source,
      targetType: c.targetType ?? null,
      targetId: c.targetId ?? null,
      title: c.title,
      dueAt: new Date(c.dueAt),
      leadDays: c.leadDays,
    })),
  );

  revalidatePath("/notifications");
  return { ok: true, created: fresh.length };
}

async function requireOwnedReminder(studentProfileId: string, id: string) {
  const db = getDb();
  const [row] = await db
    .select()
    .from(schema.userReminders)
    .where(and(eq(schema.userReminders.id, id), eq(schema.userReminders.studentProfileId, studentProfileId)))
    .limit(1);
  return row ?? null;
}

export async function setMyReminderStatus(id: string, status: "pending" | "dismissed" | "completed"): Promise<{ ok: boolean; error?: string }> {
  const session = await getStudentSession();
  if (!session) return { ok: false, error: "Not signed in." };
  const existing = await requireOwnedReminder(session.studentProfileId, id);
  if (!existing) return { ok: false, error: "Reminder not found." };

  const db = getDb();
  await db.update(schema.userReminders).set({ status, updatedAt: new Date() }).where(eq(schema.userReminders.id, id));
  revalidatePath("/notifications");
  return { ok: true };
}

export async function deleteMyReminder(id: string): Promise<{ ok: boolean; error?: string }> {
  const session = await getStudentSession();
  if (!session) return { ok: false, error: "Not signed in." };
  const existing = await requireOwnedReminder(session.studentProfileId, id);
  if (!existing) return { ok: false, error: "Reminder not found." };

  const db = getDb();
  await db.delete(schema.userReminders).where(eq(schema.userReminders.id, id));
  revalidatePath("/notifications");
  return { ok: true };
}

/**
 * Regenerates reminders from the student's current cloud tracking + custom
 * opportunities. Safe to call repeatedly (e.g. every time `/notifications`
 * is opened) — `upsertMyReminders` never overwrites a reminder the student
 * already dismissed/completed.
 */
export async function syncMyReminders(): Promise<{ ok: boolean; created: number }> {
  const session = await getStudentSession();
  if (!session) return { ok: false, created: 0 };

  const db = getDb();
  const [preferences, tracking, customOpportunities] = await Promise.all([
    db
      .select()
      .from(schema.userReminderPreferences)
      .where(eq(schema.userReminderPreferences.studentProfileId, session.studentProfileId))
      .limit(1),
    db.select().from(schema.userOpportunityTracking).where(eq(schema.userOpportunityTracking.studentProfileId, session.studentProfileId)),
    db.select().from(schema.userCustomOpportunities).where(eq(schema.userCustomOpportunities.studentProfileId, session.studentProfileId)),
  ]);

  const prefs = preferences[0];
  if (!prefs || !prefs.remindersEnabled) return { ok: true, created: 0 };

  const trackedIds = tracking.map((t) => t.opportunityId);
  const builtIn = trackedIds.length > 0 ? await getPublishedOpportunities() : [];
  const builtInById = new Map(builtIn.map((o) => [o.id, o]));

  const sourceItems: ReminderSourceItem[] = [];

  for (const row of tracking) {
    const opportunity = builtInById.get(row.opportunityId);
    if (!opportunity) continue;
    sourceItems.push({
      targetType: "built-in",
      targetId: row.opportunityId,
      title: opportunity.title,
      officialExactDeadline: extractExactVerifiedDeadline(opportunity),
      personalDeadline: row.personalDeadline ? row.personalDeadline.toISOString() : null,
    });
  }

  for (const custom of customOpportunities) {
    if (custom.archivedAt) continue;
    sourceItems.push({
      targetType: "custom",
      targetId: custom.id,
      title: custom.title,
      officialExactDeadline: null, // custom opportunities are self-reported — never an "official" deadline
      personalDeadline: null,
    });
  }

  const candidates = generateReminderCandidates(
    sourceItems.filter((item) => item.officialExactDeadline || item.personalDeadline),
    { officialLeadDays: prefs.officialLeadDays, personalLeadDays: prefs.personalLeadDays },
    new Date(),
  );

  return upsertMyReminders(candidates);
}
