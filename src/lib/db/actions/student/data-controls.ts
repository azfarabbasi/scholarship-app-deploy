"use server";

import { eq } from "drizzle-orm";
import { getStudentSession } from "@/lib/auth/student-session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getDb, schema } from "@/lib/db/client";
import { getMyAiHistoryEnabled } from "./ai-assistant";
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
  const [
    tracking,
    notes,
    checklistTasks,
    customOpportunities,
    planningRows,
    displayRows,
    syncRows,
    eligibilityRows,
    savedSearchRows,
    reminderPreferencesRows,
    reminderRows,
    notificationRows,
  ] = await Promise.all([
    db.select().from(schema.userOpportunityTracking).where(eq(schema.userOpportunityTracking.studentProfileId, studentProfileId)),
    db.select().from(schema.userNotes).where(eq(schema.userNotes.studentProfileId, studentProfileId)),
    db.select().from(schema.userChecklistTasks).where(eq(schema.userChecklistTasks.studentProfileId, studentProfileId)),
    db.select().from(schema.userCustomOpportunities).where(eq(schema.userCustomOpportunities.studentProfileId, studentProfileId)),
    db.select().from(schema.userPlanningPreferences).where(eq(schema.userPlanningPreferences.studentProfileId, studentProfileId)),
    db.select().from(schema.userDisplayPreferences).where(eq(schema.userDisplayPreferences.studentProfileId, studentProfileId)),
    db.select().from(schema.userSyncState).where(eq(schema.userSyncState.studentProfileId, studentProfileId)),
    db.select().from(schema.userEligibilityAnswers).where(eq(schema.userEligibilityAnswers.studentProfileId, studentProfileId)),
    db.select().from(schema.userSavedSearches).where(eq(schema.userSavedSearches.studentProfileId, studentProfileId)),
    db.select().from(schema.userReminderPreferences).where(eq(schema.userReminderPreferences.studentProfileId, studentProfileId)),
    db.select().from(schema.userReminders).where(eq(schema.userReminders.studentProfileId, studentProfileId)),
    db.select().from(schema.userNotifications).where(eq(schema.userNotifications.studentProfileId, studentProfileId)),
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
  const eligibility = eligibilityRows[0] ?? null;
  const reminderPreferences = reminderPreferencesRows[0] ?? null;

  // AI history is only ever included when the student has explicitly enabled it (Checkpoint 5 privacy control) — never by default.
  const aiHistoryEnabled = await getMyAiHistoryEnabled();
  let aiConversationsExport: CloudExportPayload["aiConversations"];
  let aiMessagesExport: CloudExportPayload["aiMessages"];
  if (aiHistoryEnabled) {
    const conversations = await db
      .select()
      .from(schema.aiConversations)
      .where(eq(schema.aiConversations.studentProfileId, studentProfileId));
    const conversationIds = conversations.map((c) => c.id);
    const messages =
      conversationIds.length > 0
        ? await db.select().from(schema.aiMessages).where(eq(schema.aiMessages.studentProfileId, studentProfileId))
        : [];
    const citations =
      messages.length > 0
        ? await db.select().from(schema.aiAnswerCitations).where(eq(schema.aiAnswerCitations.studentProfileId, studentProfileId))
        : [];
    const citationsByMessage = new Map<string, typeof citations>();
    for (const citation of citations) {
      const list = citationsByMessage.get(citation.messageId) ?? [];
      list.push(citation);
      citationsByMessage.set(citation.messageId, list);
    }

    aiConversationsExport = conversations.map((c) => ({
      id: c.id,
      scope: c.scope,
      targetOpportunityId: c.targetOpportunityId,
      title: c.title,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
    }));
    aiMessagesExport = messages
      .filter((m) => conversationIds.includes(m.conversationId))
      .map((m) => ({
        id: m.id,
        conversationId: m.conversationId,
        role: m.role,
        content: m.content,
        blockedReason: m.blockedReason,
        citations: (citationsByMessage.get(m.id) ?? []).map((citation) => ({
          citationType: citation.citationType,
          opportunityId: citation.opportunityId,
          officialSourceId: citation.officialSourceId,
          sourceChunkId: citation.sourceChunkId,
          label: citation.label,
          url: citation.url,
          verificationStatus: citation.verificationStatus,
          checkedAt: citation.checkedAt?.toISOString() ?? null,
        })),
        createdAt: m.createdAt.toISOString(),
      }));
  }

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
    eligibilityAnswers: eligibility
      ? {
          countryOfResidence: eligibility.countryOfResidence,
          nationality: eligibility.nationality,
          currentStudyLevel: eligibility.currentStudyLevel,
          intendedStudyLevel: eligibility.intendedStudyLevel,
          fieldsOfInterest: eligibility.fieldsOfInterest,
          graduationYear: eligibility.graduationYear,
          targetIntakeYear: eligibility.targetIntakeYear,
          targetIntakeTerm: eligibility.targetIntakeTerm,
          preferredCountries: eligibility.preferredCountries,
          preferredRegions: eligibility.preferredRegions,
          languageTestStatus: eligibility.languageTestStatus,
          researchExperience: eligibility.researchExperience,
          workExperienceYears: eligibility.workExperienceYears,
          finalYearStatus: eligibility.finalYearStatus,
          fundingPreference: eligibility.fundingPreference,
          studyMode: eligibility.studyMode,
        }
      : null,
    savedSearches: savedSearchRows.map((row) => ({
      id: row.id,
      name: row.name,
      queryText: row.queryText,
      filters: row.filters as Record<string, unknown>,
      sortMode: row.sortMode,
      resultCountSnapshot: row.resultCountSnapshot,
      resultSnapshot: row.resultSnapshot as string[],
      lastCheckedAt: row.lastCheckedAt?.toISOString() ?? null,
      alertsEnabled: row.alertsEnabled,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    })),
    reminderPreferences: reminderPreferences
      ? {
          remindersEnabled: reminderPreferences.remindersEnabled,
          officialLeadDays: reminderPreferences.officialLeadDays,
          personalLeadDays: reminderPreferences.personalLeadDays,
          savedSearchAlertsEnabled: reminderPreferences.savedSearchAlertsEnabled,
        }
      : null,
    reminders: reminderRows.map((row) => ({
      id: row.id,
      stableKey: row.stableKey,
      source: row.source,
      targetType: row.targetType,
      targetId: row.targetId,
      title: row.title,
      dueAt: row.dueAt.toISOString(),
      leadDays: row.leadDays,
      status: row.status,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    })),
    notifications: notificationRows.map((row) => ({
      id: row.id,
      type: row.type,
      source: row.source,
      title: row.title,
      message: row.message,
      targetType: row.targetType,
      targetId: row.targetId,
      savedSearchId: row.savedSearchId,
      dueAt: row.dueAt?.toISOString() ?? null,
      status: row.status,
      readAt: row.readAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
    })),
    aiConversations: aiConversationsExport,
    aiMessages: aiMessagesExport,
  };
}

export interface ImportResult {
  ok: boolean;
  error?: string;
  trackingImported: number;
  notesImported: number;
  checklistTasksImported: number;
  customOpportunitiesImported: number;
  savedSearchesImported: number;
  remindersImported: number;
  notificationsImported: number;
  eligibilityAnswersImported: boolean;
  reminderPreferencesImported: boolean;
}

const EMPTY_IMPORT_RESULT: Omit<ImportResult, "ok" | "error"> = {
  trackingImported: 0,
  notesImported: 0,
  checklistTasksImported: 0,
  customOpportunitiesImported: 0,
  savedSearchesImported: 0,
  remindersImported: 0,
  notificationsImported: 0,
  eligibilityAnswersImported: false,
  reminderPreferencesImported: false,
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
      await tx.delete(schema.userSavedSearches).where(eq(schema.userSavedSearches.studentProfileId, studentProfileId));
      await tx.delete(schema.userReminders).where(eq(schema.userReminders.studentProfileId, studentProfileId));
      await tx.delete(schema.userNotifications).where(eq(schema.userNotifications.studentProfileId, studentProfileId));
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

    if (payload.eligibilityAnswers) {
      const answers = payload.eligibilityAnswers;
      await tx
        .insert(schema.userEligibilityAnswers)
        .values({ studentProfileId, ...answers })
        .onConflictDoUpdate({ target: schema.userEligibilityAnswers.studentProfileId, set: { ...answers, updatedAt: new Date() } });
      result.eligibilityAnswersImported = true;
    }

    if (payload.reminderPreferences) {
      const preferences = payload.reminderPreferences;
      await tx
        .insert(schema.userReminderPreferences)
        .values({ studentProfileId, ...preferences })
        .onConflictDoUpdate({ target: schema.userReminderPreferences.studentProfileId, set: { ...preferences, updatedAt: new Date() } });
      result.reminderPreferencesImported = true;
    }

    for (const row of payload.savedSearches ?? []) {
      await tx
        .insert(schema.userSavedSearches)
        .values({
          id: row.id,
          studentProfileId,
          name: row.name,
          queryText: row.queryText,
          filters: row.filters,
          sortMode: row.sortMode,
          resultCountSnapshot: row.resultCountSnapshot,
          resultSnapshot: row.resultSnapshot,
          lastCheckedAt: row.lastCheckedAt ? new Date(row.lastCheckedAt) : null,
          alertsEnabled: row.alertsEnabled,
        })
        .onConflictDoUpdate({
          target: schema.userSavedSearches.id,
          set: {
            name: row.name,
            queryText: row.queryText,
            filters: row.filters,
            sortMode: row.sortMode,
            resultCountSnapshot: row.resultCountSnapshot,
            resultSnapshot: row.resultSnapshot,
            lastCheckedAt: row.lastCheckedAt ? new Date(row.lastCheckedAt) : null,
            alertsEnabled: row.alertsEnabled,
            updatedAt: new Date(),
          },
        });
      result.savedSearchesImported += 1;
    }

    for (const row of payload.reminders ?? []) {
      await tx
        .insert(schema.userReminders)
        .values({
          id: row.id,
          studentProfileId,
          stableKey: row.stableKey,
          source: row.source,
          targetType: row.targetType,
          targetId: row.targetId,
          title: row.title,
          dueAt: new Date(row.dueAt),
          leadDays: row.leadDays,
          status: row.status,
        })
        .onConflictDoUpdate({
          target: schema.userReminders.id,
          set: { title: row.title, dueAt: new Date(row.dueAt), leadDays: row.leadDays, status: row.status, updatedAt: new Date() },
        });
      result.remindersImported += 1;
    }

    for (const row of payload.notifications ?? []) {
      await tx
        .insert(schema.userNotifications)
        .values({
          id: row.id,
          studentProfileId,
          type: row.type,
          source: row.source,
          title: row.title,
          message: row.message,
          targetType: row.targetType,
          targetId: row.targetId,
          savedSearchId: row.savedSearchId,
          dueAt: row.dueAt ? new Date(row.dueAt) : null,
          status: row.status,
          readAt: row.readAt ? new Date(row.readAt) : null,
        })
        .onConflictDoUpdate({
          target: schema.userNotifications.id,
          set: { status: row.status, readAt: row.readAt ? new Date(row.readAt) : null },
        });
      result.notificationsImported += 1;
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
    await tx.delete(schema.userSavedSearches).where(eq(schema.userSavedSearches.studentProfileId, studentProfileId));
    await tx.delete(schema.userEligibilityAnswers).where(eq(schema.userEligibilityAnswers.studentProfileId, studentProfileId));
    await tx.delete(schema.userReminderPreferences).where(eq(schema.userReminderPreferences.studentProfileId, studentProfileId));
    await tx.delete(schema.userReminders).where(eq(schema.userReminders.studentProfileId, studentProfileId));
    await tx.delete(schema.userNotifications).where(eq(schema.userNotifications.studentProfileId, studentProfileId));
    // Cascades to ai_messages -> (ai_answer_citations, ai_retrieval_events, ai_feedback) automatically.
    await tx.delete(schema.aiConversations).where(eq(schema.aiConversations.studentProfileId, studentProfileId));
    await tx.delete(schema.aiUsageLimits).where(eq(schema.aiUsageLimits.studentProfileId, studentProfileId));
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
