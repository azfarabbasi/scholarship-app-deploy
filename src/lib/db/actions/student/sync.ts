"use server";

import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getStudentSession } from "@/lib/auth/student-session";
import { getDb, schema } from "@/lib/db/client";
import { eligibilityAnswersSchema } from "@/lib/schemas/eligibility-answers";
import { validateBackupPayload, type BackupPayload } from "@/lib/storage/backup";

export type MigrationMode = "copy" | "merge" | "replace";

export interface MigrationContext {
  cloudCounts: {
    tracking: number;
    notes: number;
    checklistTasks: number;
    customOpportunities: number;
    savedSearches: number;
    reminders: number;
  };
  existingOpportunityIds: string[];
  existingCustomOpportunityIds: string[];
  hasEligibilityAnswers: boolean;
  hasReminderPreferences: boolean;
  lastMigrationCompletedAt: string | null;
}

/** Read-only preview data the client combines with its own local guest counts to build the migration preview screen. */
export async function getMigrationContext(): Promise<MigrationContext | null> {
  const session = await getStudentSession();
  if (!session) return null;

  const db = getDb();
  const [tracking, notes, checklistTasks, customOpportunities, savedSearches, reminders, eligibility, reminderPreferences, syncState] =
    await Promise.all([
      db
        .select({ opportunityId: schema.userOpportunityTracking.opportunityId })
        .from(schema.userOpportunityTracking)
        .where(eq(schema.userOpportunityTracking.studentProfileId, session.studentProfileId)),
      db
        .select({ id: schema.userNotes.id })
        .from(schema.userNotes)
        .where(eq(schema.userNotes.studentProfileId, session.studentProfileId)),
      db
        .select({ id: schema.userChecklistTasks.id })
        .from(schema.userChecklistTasks)
        .where(eq(schema.userChecklistTasks.studentProfileId, session.studentProfileId)),
      db
        .select({ id: schema.userCustomOpportunities.id })
        .from(schema.userCustomOpportunities)
        .where(eq(schema.userCustomOpportunities.studentProfileId, session.studentProfileId)),
      db
        .select({ id: schema.userSavedSearches.id })
        .from(schema.userSavedSearches)
        .where(eq(schema.userSavedSearches.studentProfileId, session.studentProfileId)),
      db
        .select({ id: schema.userReminders.id })
        .from(schema.userReminders)
        .where(eq(schema.userReminders.studentProfileId, session.studentProfileId)),
      db
        .select({ studentProfileId: schema.userEligibilityAnswers.studentProfileId })
        .from(schema.userEligibilityAnswers)
        .where(eq(schema.userEligibilityAnswers.studentProfileId, session.studentProfileId))
        .limit(1),
      db
        .select({ studentProfileId: schema.userReminderPreferences.studentProfileId })
        .from(schema.userReminderPreferences)
        .where(eq(schema.userReminderPreferences.studentProfileId, session.studentProfileId))
        .limit(1),
      db
        .select()
        .from(schema.userSyncState)
        .where(eq(schema.userSyncState.studentProfileId, session.studentProfileId))
        .limit(1),
    ]);

  return {
    cloudCounts: {
      tracking: tracking.length,
      notes: notes.length,
      checklistTasks: checklistTasks.length,
      customOpportunities: customOpportunities.length,
      savedSearches: savedSearches.length,
      reminders: reminders.length,
    },
    existingOpportunityIds: tracking.map((row) => row.opportunityId),
    existingCustomOpportunityIds: customOpportunities.map((row) => row.id),
    hasEligibilityAnswers: eligibility.length > 0,
    hasReminderPreferences: reminderPreferences.length > 0,
    lastMigrationCompletedAt: syncState[0]?.localMigrationCompletedAt?.toISOString() ?? null,
  };
}

export interface MigrationResult {
  ok: boolean;
  error?: string;
  trackingCreated: number;
  trackingSkipped: number;
  customOpportunitiesCreated: number;
  customOpportunitiesSkipped: number;
  notesWritten: number;
  checklistTasksWritten: number;
  savedSearchesCreated: number;
  savedSearchesSkipped: number;
  remindersCreated: number;
  remindersSkipped: number;
  eligibilityAnswersMigrated: boolean;
  reminderPreferencesMigrated: boolean;
  conflicts: string[];
}

const EMPTY_RESULT: Omit<MigrationResult, "ok" | "error"> = {
  trackingCreated: 0,
  trackingSkipped: 0,
  customOpportunitiesCreated: 0,
  customOpportunitiesSkipped: 0,
  notesWritten: 0,
  checklistTasksWritten: 0,
  savedSearchesCreated: 0,
  savedSearchesSkipped: 0,
  remindersCreated: 0,
  remindersSkipped: 0,
  eligibilityAnswersMigrated: false,
  reminderPreferencesMigrated: false,
  conflicts: [],
};

/**
 * Applies a guest-to-cloud migration. Never invoked automatically — the
 * caller must have already shown the user a preview and obtained an
 * explicit mode choice (see `docs/checkpoint-3/checkpoint-3-architecture.md`
 * for the full decision flow). Local guest data in IndexedDB is never
 * touched by this function; the caller decides separately whether to clear
 * it afterwards.
 */
export async function applyGuestMigration(payload: BackupPayload, mode: MigrationMode): Promise<MigrationResult> {
  const session = await getStudentSession();
  if (!session) return { ok: false, error: "Not signed in.", ...EMPTY_RESULT };

  const validated = validateBackupPayload(payload);
  if (!validated.valid) {
    return { ok: false, error: validated.errors[0] ?? "Invalid guest data.", ...EMPTY_RESULT };
  }

  const db = getDb();
  const studentProfileId = session.studentProfileId;
  const result = { ...EMPTY_RESULT };

  await db.transaction(async (tx) => {
    if (mode === "replace") {
      await tx.delete(schema.userOpportunityTracking).where(eq(schema.userOpportunityTracking.studentProfileId, studentProfileId));
      await tx.delete(schema.userNotes).where(eq(schema.userNotes.studentProfileId, studentProfileId));
      await tx.delete(schema.userChecklistTasks).where(eq(schema.userChecklistTasks.studentProfileId, studentProfileId));
      await tx.delete(schema.userCustomOpportunities).where(eq(schema.userCustomOpportunities.studentProfileId, studentProfileId));
      await tx.delete(schema.userSavedSearches).where(eq(schema.userSavedSearches.studentProfileId, studentProfileId));
      await tx.delete(schema.userReminders).where(eq(schema.userReminders.studentProfileId, studentProfileId));
    }

    // Only migrate tracking for opportunities that actually exist in the
    // public catalogue — a guest's local opportunityId can reference an
    // opportunity that was later archived/removed.
    const opportunityIds = validated.payload.data.workspace.map((record) => record.opportunityId);
    const realOpportunityIds =
      opportunityIds.length > 0
        ? new Set(
            (
              await tx
                .select({ id: schema.opportunities.id })
                .from(schema.opportunities)
                .where(inArray(schema.opportunities.id, opportunityIds))
            ).map((row) => row.id),
          )
        : new Set<string>();

    for (const record of validated.payload.data.workspace) {
      if (!realOpportunityIds.has(record.opportunityId)) {
        continue;
      }

      const [existing] = await tx
        .select()
        .from(schema.userOpportunityTracking)
        .where(
          and(
            eq(schema.userOpportunityTracking.studentProfileId, studentProfileId),
            eq(schema.userOpportunityTracking.opportunityId, record.opportunityId),
          ),
        )
        .limit(1);

      const guestUpdatedAt = new Date(record.updatedAt);
      const trackingValues = {
        shortlisted: record.shortlisted,
        stage: record.stage as (typeof schema.userOpportunityTracking.$inferInsert)["stage"],
        personalDeadline: record.personalDeadline ? new Date(record.personalDeadline) : null,
      };

      if (!existing) {
        await tx.insert(schema.userOpportunityTracking).values({
          studentProfileId,
          opportunityId: record.opportunityId,
          ...trackingValues,
        });
        result.trackingCreated += 1;
      } else if (mode === "merge" && guestUpdatedAt > existing.updatedAt) {
        await tx
          .update(schema.userOpportunityTracking)
          .set({ ...trackingValues, updatedAt: new Date() })
          .where(eq(schema.userOpportunityTracking.id, existing.id));
        result.trackingCreated += 1;
      } else {
        result.trackingSkipped += 1;
        if (mode === "merge" && guestUpdatedAt.getTime() !== existing.updatedAt.getTime()) {
          result.conflicts.push(`tracking:${record.opportunityId}`);
        }
      }

      if (record.notes.trim().length > 0) {
        const [existingNote] = await tx
          .select()
          .from(schema.userNotes)
          .where(
            and(
              eq(schema.userNotes.studentProfileId, studentProfileId),
              eq(schema.userNotes.targetType, "built-in"),
              eq(schema.userNotes.targetId, record.opportunityId),
            ),
          )
          .limit(1);

        if (!existingNote) {
          await tx.insert(schema.userNotes).values({
            studentProfileId,
            targetType: "built-in",
            targetId: record.opportunityId,
            noteText: record.notes,
          });
          result.notesWritten += 1;
        } else if (mode === "merge" && guestUpdatedAt > existingNote.updatedAt) {
          await tx
            .update(schema.userNotes)
            .set({ noteText: record.notes, updatedAt: new Date() })
            .where(eq(schema.userNotes.id, existingNote.id));
          result.notesWritten += 1;
        }
      }

      for (const [index, item] of record.checklist.entries()) {
        const [existingTask] = await tx
          .select({ id: schema.userChecklistTasks.id })
          .from(schema.userChecklistTasks)
          .where(eq(schema.userChecklistTasks.id, item.id))
          .limit(1);

        if (!existingTask) {
          await tx.insert(schema.userChecklistTasks).values({
            id: item.id,
            studentProfileId,
            targetType: "built-in",
            targetId: record.opportunityId,
            taskText: item.label,
            completed: item.completed,
            sortOrder: index,
            sourceType: item.origin === "template" ? "generic" : "imported",
          });
          result.checklistTasksWritten += 1;
        }
      }
    }

    for (const custom of validated.payload.data.customOpportunities) {
      const [existing] = await tx
        .select()
        .from(schema.userCustomOpportunities)
        .where(eq(schema.userCustomOpportunities.id, custom.id))
        .limit(1);

      const guestUpdatedAt = new Date(custom.updatedAt);

      if (!existing) {
        await tx.insert(schema.userCustomOpportunities).values({
          id: custom.id,
          studentProfileId,
          slug: custom.slug,
          title: custom.title,
          opportunityType: custom.opportunityType,
          providerName: custom.providerName,
          countries: custom.countries,
          regions: custom.regions,
          studyLevels: custom.studyLevels,
          benefitSummary: custom.benefitSummary,
          eligibilitySummary: custom.eligibilitySummary,
          officialUrl: custom.officialUrl,
          deadlineKind: custom.deadlineKind as (typeof schema.userCustomOpportunities.$inferInsert)["deadlineKind"],
          deadlineRawText: custom.deadlineRawText,
          deadlineDate: custom.deadlineDate,
          deadlineTimezone: custom.deadlineTimezone,
          verificationNotes: custom.verificationNotes,
        });
        result.customOpportunitiesCreated += 1;
      } else if (mode === "merge" && guestUpdatedAt > existing.updatedAt) {
        await tx
          .update(schema.userCustomOpportunities)
          .set({
            title: custom.title,
            opportunityType: custom.opportunityType,
            providerName: custom.providerName,
            countries: custom.countries,
            regions: custom.regions,
            studyLevels: custom.studyLevels,
            benefitSummary: custom.benefitSummary,
            eligibilitySummary: custom.eligibilitySummary,
            officialUrl: custom.officialUrl,
            deadlineRawText: custom.deadlineRawText,
            deadlineDate: custom.deadlineDate,
            deadlineTimezone: custom.deadlineTimezone,
            verificationNotes: custom.verificationNotes,
            updatedAt: new Date(),
          })
          .where(eq(schema.userCustomOpportunities.id, custom.id));
        result.customOpportunitiesCreated += 1;
      } else {
        result.customOpportunitiesSkipped += 1;
        if (mode === "merge" && guestUpdatedAt.getTime() !== existing.updatedAt.getTime()) {
          result.conflicts.push(`custom-opportunity:${custom.id}`);
        }
      }
    }

    if (validated.payload.data.preferences) {
      const guestPlanning = validated.payload.data.preferences.planning;
      const guestDisplay = validated.payload.data.preferences.display;

      const [existingPlanning] = await tx
        .select()
        .from(schema.userPlanningPreferences)
        .where(eq(schema.userPlanningPreferences.studentProfileId, studentProfileId))
        .limit(1);

      if (!existingPlanning || mode === "replace" || mode === "copy") {
        if (!existingPlanning) {
          await tx.insert(schema.userPlanningPreferences).values({
            studentProfileId,
            expectedGraduationDate: guestPlanning.expectedGraduationDate,
            targetIntakeYear: guestPlanning.targetIntakeYear,
            targetIntakeTerm: guestPlanning.targetIntakeTerm,
            preferredStudyLevels: guestPlanning.preferredStudyLevels,
            preferredCountries: guestPlanning.preferredCountries,
          });
        }
      }

      const [existingDisplay] = await tx
        .select()
        .from(schema.userDisplayPreferences)
        .where(eq(schema.userDisplayPreferences.studentProfileId, studentProfileId))
        .limit(1);

      if (!existingDisplay) {
        await tx.insert(schema.userDisplayPreferences).values({
          studentProfileId,
          catalogueView: guestDisplay.catalogueView,
        });
      }
    }

    // Eligibility answers and reminder preferences are per-student singletons
    // (like planning/display preferences above): "copy"/"replace" always take
    // the guest version, "merge" only fills in the cloud row if it's empty —
    // there's no sensible field-by-field merge for a preferences form.
    if (validated.payload.data.eligibilityAnswers) {
      const parsedAnswers = eligibilityAnswersSchema.safeParse(validated.payload.data.eligibilityAnswers.answers);
      if (parsedAnswers.success) {
        const [existingEligibility] = await tx
          .select({ studentProfileId: schema.userEligibilityAnswers.studentProfileId })
          .from(schema.userEligibilityAnswers)
          .where(eq(schema.userEligibilityAnswers.studentProfileId, studentProfileId))
          .limit(1);

        if (!existingEligibility || mode === "replace" || mode === "copy") {
          await tx
            .insert(schema.userEligibilityAnswers)
            .values({ studentProfileId, ...parsedAnswers.data })
            .onConflictDoUpdate({
              target: schema.userEligibilityAnswers.studentProfileId,
              set: { ...parsedAnswers.data, updatedAt: new Date() },
            });
          result.eligibilityAnswersMigrated = true;
        }
      }
    }

    if (validated.payload.data.reminderPreferences) {
      const guestPrefs = validated.payload.data.reminderPreferences;
      const [existingPrefs] = await tx
        .select({ studentProfileId: schema.userReminderPreferences.studentProfileId })
        .from(schema.userReminderPreferences)
        .where(eq(schema.userReminderPreferences.studentProfileId, studentProfileId))
        .limit(1);

      if (!existingPrefs || mode === "replace" || mode === "copy") {
        await tx
          .insert(schema.userReminderPreferences)
          .values({
            studentProfileId,
            remindersEnabled: guestPrefs.remindersEnabled,
            officialLeadDays: guestPrefs.officialLeadDays,
            personalLeadDays: guestPrefs.personalLeadDays,
            savedSearchAlertsEnabled: guestPrefs.savedSearchAlertsEnabled,
          })
          .onConflictDoUpdate({
            target: schema.userReminderPreferences.studentProfileId,
            set: {
              remindersEnabled: guestPrefs.remindersEnabled,
              officialLeadDays: guestPrefs.officialLeadDays,
              personalLeadDays: guestPrefs.personalLeadDays,
              savedSearchAlertsEnabled: guestPrefs.savedSearchAlertsEnabled,
              updatedAt: new Date(),
            },
          });
        result.reminderPreferencesMigrated = true;
      }
    }

    for (const record of validated.payload.data.savedSearches ?? []) {
      const [existingSearch] = await tx
        .select()
        .from(schema.userSavedSearches)
        .where(eq(schema.userSavedSearches.id, record.id))
        .limit(1);

      const guestUpdatedAt = new Date(record.updatedAt);
      const searchValues = {
        name: record.name,
        queryText: record.queryText,
        filters: record.filters,
        sortMode: record.sortMode,
        resultCountSnapshot: record.resultCountSnapshot,
        resultSnapshot: record.resultSnapshot,
        lastCheckedAt: record.lastCheckedAt ? new Date(record.lastCheckedAt) : null,
        alertsEnabled: record.alertsEnabled,
      };

      if (!existingSearch) {
        await tx.insert(schema.userSavedSearches).values({ id: record.id, studentProfileId, ...searchValues });
        result.savedSearchesCreated += 1;
      } else if (mode === "merge" && guestUpdatedAt > existingSearch.updatedAt) {
        await tx
          .update(schema.userSavedSearches)
          .set({ ...searchValues, updatedAt: new Date() })
          .where(eq(schema.userSavedSearches.id, record.id));
        result.savedSearchesCreated += 1;
      } else {
        result.savedSearchesSkipped += 1;
        if (mode === "merge" && guestUpdatedAt.getTime() !== existingSearch.updatedAt.getTime()) {
          result.conflicts.push(`saved-search:${record.id}`);
        }
      }
    }

    // Reminders are deduplicated by `stableKey` (the same uniqueness the DB
    // enforces via `user_reminders_student_stable_key_unique`), not by id —
    // a guest reminder and a reminder already regenerated server-side for
    // the same deadline+lead-days must never end up as two rows.
    const existingReminders = await tx
      .select({ id: schema.userReminders.id, stableKey: schema.userReminders.stableKey, updatedAt: schema.userReminders.updatedAt })
      .from(schema.userReminders)
      .where(eq(schema.userReminders.studentProfileId, studentProfileId));
    const existingReminderByStableKey = new Map(existingReminders.map((row) => [row.stableKey, row]));

    for (const record of validated.payload.data.reminders ?? []) {
      const existingReminder = existingReminderByStableKey.get(record.stableKey);
      const guestUpdatedAt = new Date(record.updatedAt);
      const reminderValues = {
        title: record.title,
        dueAt: new Date(record.dueAt),
        leadDays: record.leadDays,
        status: record.status,
      };

      if (!existingReminder) {
        await tx.insert(schema.userReminders).values({
          id: record.id,
          studentProfileId,
          stableKey: record.stableKey,
          source: record.source,
          targetType: record.targetType,
          targetId: record.targetId,
          ...reminderValues,
        });
        result.remindersCreated += 1;
      } else if (mode === "merge" && guestUpdatedAt > existingReminder.updatedAt) {
        await tx
          .update(schema.userReminders)
          .set({ ...reminderValues, updatedAt: new Date() })
          .where(eq(schema.userReminders.id, existingReminder.id));
        result.remindersCreated += 1;
      } else {
        result.remindersSkipped += 1;
      }
    }

    await tx
      .insert(schema.userSyncState)
      .values({ studentProfileId, localMigrationCompletedAt: new Date(), lastSuccessfulSyncAt: new Date() })
      .onConflictDoUpdate({
        target: schema.userSyncState.studentProfileId,
        set: { localMigrationCompletedAt: new Date(), lastSuccessfulSyncAt: new Date(), updatedAt: new Date() },
      });
  });

  revalidatePath("/workspace");
  revalidatePath("/account");
  revalidatePath("/account/sync");
  return { ok: true, ...result };
}

export async function getSyncState() {
  const session = await getStudentSession();
  if (!session) return null;
  const db = getDb();
  const [row] = await db
    .select()
    .from(schema.userSyncState)
    .where(eq(schema.userSyncState.studentProfileId, session.studentProfileId))
    .limit(1);
  return row ?? null;
}

export async function recordSuccessfulSync(deviceId?: string | null): Promise<void> {
  const session = await getStudentSession();
  if (!session) return;
  const db = getDb();
  await db
    .insert(schema.userSyncState)
    .values({ studentProfileId: session.studentProfileId, lastSuccessfulSyncAt: new Date(), deviceId: deviceId ?? null })
    .onConflictDoUpdate({
      target: schema.userSyncState.studentProfileId,
      set: { lastSuccessfulSyncAt: new Date(), deviceId: deviceId ?? undefined, updatedAt: new Date() },
    });
}
