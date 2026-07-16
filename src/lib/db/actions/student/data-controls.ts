"use server";

import { eq } from "drizzle-orm";
import { getStudentSession } from "@/lib/auth/student-session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getDb, schema } from "@/lib/db/client";
import {
  CLOUD_EXPORT_APP_ID,
  CLOUD_EXPORT_SCHEMA_VERSION,
  validateCloudExportPayload,
  type CloudExportPayload,
} from "@/lib/schemas/cloud-export";

/**
 * Builds the signed-in student's full cloud export — their own data only.
 * Never includes auth tokens, cookies, secret keys, or any staff/admin
 * record (see `docs/checkpoint-3/privacy-and-data-controls.md`).
 */
export async function exportMyData(): Promise<CloudExportPayload | null> {
  const session = await getStudentSession();
  if (!session) return null;

  const db = getDb();
  const studentProfileId = session.studentProfileId;

  const [profileRow] = await db.select().from(schema.studentProfiles).where(eq(schema.studentProfiles.id, studentProfileId)).limit(1);
  const [tracking, notes, checklistTasks, customOpportunities, planningRows, displayRows, syncRows] = await Promise.all([
    db.select().from(schema.userOpportunityTracking).where(eq(schema.userOpportunityTracking.studentProfileId, studentProfileId)),
    db.select().from(schema.userNotes).where(eq(schema.userNotes.studentProfileId, studentProfileId)),
    db.select().from(schema.userChecklistTasks).where(eq(schema.userChecklistTasks.studentProfileId, studentProfileId)),
    db.select().from(schema.userCustomOpportunities).where(eq(schema.userCustomOpportunities.studentProfileId, studentProfileId)),
    db.select().from(schema.userPlanningPreferences).where(eq(schema.userPlanningPreferences.studentProfileId, studentProfileId)),
    db.select().from(schema.userDisplayPreferences).where(eq(schema.userDisplayPreferences.studentProfileId, studentProfileId)),
    db.select().from(schema.userSyncState).where(eq(schema.userSyncState.studentProfileId, studentProfileId)),
  ]);

  await db.insert(schema.userDataRequests).values({
    studentProfileId,
    requestType: "export",
    status: "completed",
    completedAt: new Date(),
    auditReference: "self-service export",
  });

  const planning = planningRows[0] ?? null;
  const display = displayRows[0] ?? null;
  const sync = syncRows[0] ?? null;

  return {
    app: CLOUD_EXPORT_APP_ID,
    schemaVersion: CLOUD_EXPORT_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    profile: {
      displayName: profileRow?.displayName ?? null,
      countryOrRegion: profileRow?.countryOrRegion ?? null,
      currentStudyLevel: profileRow?.currentStudyLevel ?? null,
      intendedStudyLevel: profileRow?.intendedStudyLevel ?? null,
      graduationYear: profileRow?.graduationYear ?? null,
      targetIntakeYear: profileRow?.targetIntakeYear ?? null,
      targetIntakeTerm: profileRow?.targetIntakeTerm ?? null,
      preferredCountries: profileRow?.preferredCountries ?? [],
      preferredStudyLevels: profileRow?.preferredStudyLevels ?? [],
      onboardingCompletedAt: profileRow?.onboardingCompletedAt?.toISOString() ?? null,
    },
    tracking: tracking.map((row) => ({
      id: row.id,
      opportunityId: row.opportunityId,
      shortlisted: row.shortlisted,
      stage: row.stage,
      personalDeadline: row.personalDeadline?.toISOString() ?? null,
      priority: row.priority,
      archived: row.archived,
      lastViewedAt: row.lastViewedAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    })),
    notes: notes.map((row) => ({
      id: row.id,
      targetType: row.targetType,
      targetId: row.targetId,
      noteText: row.noteText,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    })),
    checklistTasks: checklistTasks.map((row) => ({
      id: row.id,
      targetType: row.targetType,
      targetId: row.targetId,
      taskText: row.taskText,
      completed: row.completed,
      sortOrder: row.sortOrder,
      sourceType: row.sourceType,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    })),
    customOpportunities: customOpportunities.map((row) => ({
      id: row.id,
      slug: row.slug,
      title: row.title,
      opportunityType: row.opportunityType,
      providerName: row.providerName,
      countries: row.countries,
      regions: row.regions,
      studyLevels: row.studyLevels,
      benefitSummary: row.benefitSummary,
      eligibilitySummary: row.eligibilitySummary,
      officialUrl: row.officialUrl,
      deadlineKind: row.deadlineKind,
      deadlineRawText: row.deadlineRawText,
      deadlineDate: row.deadlineDate,
      deadlineTimezone: row.deadlineTimezone,
      verificationNotes: row.verificationNotes,
      archivedAt: row.archivedAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    })),
    planningPreferences: planning
      ? {
          expectedGraduationDate: planning.expectedGraduationDate,
          targetIntakeYear: planning.targetIntakeYear,
          targetIntakeTerm: planning.targetIntakeTerm,
          preferredStudyLevels: planning.preferredStudyLevels,
          preferredCountries: planning.preferredCountries,
        }
      : null,
    displayPreferences: display ? { theme: display.theme as "system" | "light" | "dark" | null, catalogueView: display.catalogueView as "grid" | "list" } : null,
    syncMetadata: sync ? { lastSuccessfulSyncAt: sync.lastSuccessfulSyncAt?.toISOString() ?? null, schemaVersion: sync.schemaVersion } : null,
  };
}

export interface ImportResult {
  ok: boolean;
  error?: string;
  trackingImported: number;
  notesImported: number;
  checklistTasksImported: number;
  customOpportunitiesImported: number;
}

const EMPTY_IMPORT_RESULT: Omit<ImportResult, "ok" | "error"> = {
  trackingImported: 0,
  notesImported: 0,
  checklistTasksImported: 0,
  customOpportunitiesImported: 0,
};

/**
 * Imports a previously-exported ScholarTrack account backup into the
 * signed-in account. Only ever accepts the cloud export shape (never staff/
 * admin data — the strict schema in `src/lib/schemas/cloud-export.ts`
 * rejects anything else outright).
 */
export async function importMyAccountData(json: unknown, mode: "merge" | "replace"): Promise<ImportResult> {
  const session = await getStudentSession();
  if (!session) return { ok: false, error: "Not signed in.", ...EMPTY_IMPORT_RESULT };

  const validated = validateCloudExportPayload(json);
  if (!validated.valid) {
    return { ok: false, error: validated.errors[0] ?? "Invalid import file.", ...EMPTY_IMPORT_RESULT };
  }

  const db = getDb();
  const studentProfileId = session.studentProfileId;
  const { payload } = validated;
  const result = { ...EMPTY_IMPORT_RESULT };

  await db.transaction(async (tx) => {
    if (mode === "replace") {
      await tx.delete(schema.userOpportunityTracking).where(eq(schema.userOpportunityTracking.studentProfileId, studentProfileId));
      await tx.delete(schema.userNotes).where(eq(schema.userNotes.studentProfileId, studentProfileId));
      await tx.delete(schema.userChecklistTasks).where(eq(schema.userChecklistTasks.studentProfileId, studentProfileId));
      await tx.delete(schema.userCustomOpportunities).where(eq(schema.userCustomOpportunities.studentProfileId, studentProfileId));
    }

    // A previously-exported opportunityId can reference an opportunity that
    // was since archived/removed from the public catalogue — skip it rather
    // than fail the whole import on a foreign-key violation.
    for (const row of payload.tracking) {
      const [exists] = await tx
        .select({ id: schema.opportunities.id })
        .from(schema.opportunities)
        .where(eq(schema.opportunities.id, row.opportunityId))
        .limit(1);
      if (!exists) continue;

      await tx
        .insert(schema.userOpportunityTracking)
        .values({
          id: row.id,
          studentProfileId,
          opportunityId: row.opportunityId,
          shortlisted: row.shortlisted,
          stage: row.stage,
          personalDeadline: row.personalDeadline ? new Date(row.personalDeadline) : null,
          priority: row.priority,
          archived: row.archived,
        })
        .onConflictDoUpdate({
          target: schema.userOpportunityTracking.id,
          set: {
            shortlisted: row.shortlisted,
            stage: row.stage,
            personalDeadline: row.personalDeadline ? new Date(row.personalDeadline) : null,
            priority: row.priority,
            archived: row.archived,
            updatedAt: new Date(),
          },
        });
      result.trackingImported += 1;
    }

    for (const row of payload.notes) {
      await tx
        .insert(schema.userNotes)
        .values({ id: row.id, studentProfileId, targetType: row.targetType, targetId: row.targetId, noteText: row.noteText })
        .onConflictDoUpdate({ target: schema.userNotes.id, set: { noteText: row.noteText, updatedAt: new Date() } });
      result.notesImported += 1;
    }

    for (const row of payload.checklistTasks) {
      await tx
        .insert(schema.userChecklistTasks)
        .values({
          id: row.id,
          studentProfileId,
          targetType: row.targetType,
          targetId: row.targetId,
          taskText: row.taskText,
          completed: row.completed,
          sortOrder: row.sortOrder,
          sourceType: "imported",
        })
        .onConflictDoUpdate({
          target: schema.userChecklistTasks.id,
          set: { taskText: row.taskText, completed: row.completed, sortOrder: row.sortOrder, updatedAt: new Date() },
        });
      result.checklistTasksImported += 1;
    }

    for (const row of payload.customOpportunities) {
      await tx
        .insert(schema.userCustomOpportunities)
        .values({
          id: row.id,
          studentProfileId,
          slug: row.slug,
          title: row.title,
          opportunityType: row.opportunityType,
          providerName: row.providerName,
          countries: row.countries,
          regions: row.regions,
          studyLevels: row.studyLevels,
          benefitSummary: row.benefitSummary,
          eligibilitySummary: row.eligibilitySummary,
          officialUrl: row.officialUrl,
          deadlineKind: row.deadlineKind,
          deadlineRawText: row.deadlineRawText,
          deadlineDate: row.deadlineDate,
          deadlineTimezone: row.deadlineTimezone,
          verificationNotes: row.verificationNotes,
        })
        .onConflictDoUpdate({
          target: schema.userCustomOpportunities.id,
          set: {
            title: row.title,
            benefitSummary: row.benefitSummary,
            eligibilitySummary: row.eligibilitySummary,
            officialUrl: row.officialUrl,
            deadlineRawText: row.deadlineRawText,
            deadlineDate: row.deadlineDate,
            deadlineTimezone: row.deadlineTimezone,
            verificationNotes: row.verificationNotes,
            updatedAt: new Date(),
          },
        });
      result.customOpportunitiesImported += 1;
    }
  });

  return { ok: true, ...result };
}

async function wipeWorkspaceRows(studentProfileId: string) {
  const db = getDb();
  await db.transaction(async (tx) => {
    await tx.delete(schema.userOpportunityTracking).where(eq(schema.userOpportunityTracking.studentProfileId, studentProfileId));
    await tx.delete(schema.userNotes).where(eq(schema.userNotes.studentProfileId, studentProfileId));
    await tx.delete(schema.userChecklistTasks).where(eq(schema.userChecklistTasks.studentProfileId, studentProfileId));
    await tx.delete(schema.userCustomOpportunities).where(eq(schema.userCustomOpportunities.studentProfileId, studentProfileId));
    await tx.delete(schema.userPlanningPreferences).where(eq(schema.userPlanningPreferences.studentProfileId, studentProfileId));
    await tx.delete(schema.userDisplayPreferences).where(eq(schema.userDisplayPreferences.studentProfileId, studentProfileId));
    await tx.insert(schema.userDataRequests).values({
      studentProfileId,
      requestType: "deletion",
      status: "completed",
      completedAt: new Date(),
      auditReference: "self-service workspace data deletion",
    });
  });
}

/**
 * Deletes the student's cloud workspace data but keeps their Auth account
 * and `student_profiles` row — they can keep signing in with an empty
 * workspace. Guest/local IndexedDB data on this or any other device is
 * never touched.
 */
export async function deleteMyWorkspaceData(): Promise<{ ok: boolean; error?: string }> {
  const session = await getStudentSession();
  if (!session) return { ok: false, error: "Not signed in." };

  await wipeWorkspaceRows(session.studentProfileId);
  return { ok: true };
}

/**
 * Full self-service account deletion: wipes workspace data, deletes the
 * `student_profiles` row, then deletes the Supabase Auth user via the
 * service-role Admin API — server-side only, the secret key never reaches
 * the client. Always acts on the caller's own verified session id, never a
 * client-supplied id, so a student can never delete another account.
 */
export async function deleteMyAccount(): Promise<{ ok: boolean; error?: string }> {
  const session = await getStudentSession();
  if (!session) return { ok: false, error: "Not signed in." };

  const studentProfileId = session.studentProfileId;
  await wipeWorkspaceRows(studentProfileId);

  const db = getDb();
  await db.delete(schema.userSyncState).where(eq(schema.userSyncState.studentProfileId, studentProfileId));
  await db.delete(schema.studentProfiles).where(eq(schema.studentProfiles.id, studentProfileId));

  try {
    const admin = createSupabaseAdminClient();
    const { error } = await admin.auth.admin.deleteUser(studentProfileId);
    if (error) {
      return { ok: false, error: `Workspace data was deleted, but the account itself could not be removed: ${error.message}` };
    }
  } catch (error) {
    return {
      ok: false,
      error: `Workspace data was deleted, but the account itself could not be removed: ${
        error instanceof Error ? error.message : "unknown error"
      }`,
    };
  }

  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();

  return { ok: true };
}
