"use server";

import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getStudentSession } from "@/lib/auth/student-session";
import { getDb, schema } from "@/lib/db/client";
import { validateBackupPayload, type BackupPayload } from "@/lib/storage/backup";

export type MigrationMode = "copy" | "merge" | "replace";

export interface MigrationContext {
  cloudCounts: { tracking: number; notes: number; checklistTasks: number; customOpportunities: number };
  existingOpportunityIds: string[];
  existingCustomOpportunityIds: string[];
  lastMigrationCompletedAt: string | null;
}

/** Read-only preview data the client combines with its own local guest counts to build the migration preview screen. */
export async function getMigrationContext(): Promise<MigrationContext | null> {
  const session = await getStudentSession();
  if (!session) return null;

  const db = getDb();
  const [tracking, notes, checklistTasks, customOpportunities, syncState] = await Promise.all([
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
    },
    existingOpportunityIds: tracking.map((row) => row.opportunityId),
    existingCustomOpportunityIds: customOpportunities.map((row) => row.id),
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
  conflicts: string[];
}

const EMPTY_RESULT: Omit<MigrationResult, "ok" | "error"> = {
  trackingCreated: 0,
  trackingSkipped: 0,
  customOpportunitiesCreated: 0,
  customOpportunitiesSkipped: 0,
  notesWritten: 0,
  checklistTasksWritten: 0,
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
