"use server";

import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { getStudentSession } from "@/lib/auth/student-session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getDb, schema } from "@/lib/db/client";
import { getMyAiHistoryEnabled } from "./ai-assistant";
import {
  CLOUD_EXPORT_APP_ID,
  CLOUD_EXPORT_SCHEMA_VERSION,
  MAX_CLOUD_IMPORT_FILE_SIZE_BYTES,
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
  profileImported: boolean;
  planningPreferencesImported: boolean;
  displayPreferencesImported: boolean;
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
  profileImported: false,
  planningPreferencesImported: false,
  displayPreferencesImported: false,
};

/**
 * Imports a previously-exported ScholarTrack account backup into the
 * signed-in account. Only ever accepts the cloud export shape (never staff/
 * admin data — the strict schema in `src/lib/schemas/cloud-export.ts`
 * rejects anything else outright).
 *
 * SECURITY: every exported `id` is foreign data — this account may never
 * have created any of these rows, and the export file itself is an
 * ordinary, forgeable JSON file the caller could have edited or received
 * from someone else. The previous version of this function trusted the
 * exported `id` as the destination primary key
 * (`INSERT ... ON CONFLICT (id) DO UPDATE`); since a Postgres conflict
 * target match doesn't check who owns the conflicting row, a crafted import
 * containing another student's real row id would silently overwrite that
 * student's existing row's content. Every row here now gets a freshly
 * generated id, and every `ON CONFLICT` target is a natural key already
 * scoped to `studentProfileId` (the caller's own verified session id, never
 * attacker-controlled) — so the only row an import can ever touch is one
 * this account already owns. An old-id -> new-id map carries cross-
 * references within the *same* payload (a note whose `targetId` pointed at
 * one of this payload's own custom opportunities) forward correctly.
 */
export async function importMyAccountData(json: unknown, mode: "merge" | "replace"): Promise<ImportResult> {
  const session = await getStudentSession();
  if (!session) return { ok: false, error: "Not signed in.", ...EMPTY_IMPORT_RESULT };

  // Server-side byte-size enforcement — the client also checks this against
  // the raw File before ever parsing it, but that check is trivially
  // bypassable by calling this Server Action directly, so it must be
  // re-checked here against the byte length of the actual JSON, not trusted
  // from the client.
  const byteLength = Buffer.byteLength(JSON.stringify(json ?? null), "utf8");
  if (byteLength > MAX_CLOUD_IMPORT_FILE_SIZE_BYTES) {
    return { ok: false, error: "This import is too large (over 5 MB).", ...EMPTY_IMPORT_RESULT };
  }

  const validated = validateCloudExportPayload(json);
  if (!validated.valid) {
    return { ok: false, error: validated.errors[0] ?? "Invalid import file.", ...EMPTY_IMPORT_RESULT };
  }

  const db = getDb();
  const studentProfileId = session.studentProfileId;
  const { payload } = validated;
  const result = { ...EMPTY_IMPORT_RESULT };

  // Old-export-id -> new-row-id, so a note/checklist-task/notification that
  // references one of THIS payload's own custom opportunities or saved
  // searches still points at the right row after re-keying.
  const customOpportunityIdMap = new Map<string, string>();
  const savedSearchIdMap = new Map<string, string>();

  await db.transaction(async (tx) => {
    if (mode === "replace") {
      await tx.delete(schema.userOpportunityTracking).where(eq(schema.userOpportunityTracking.studentProfileId, studentProfileId));
      await tx.delete(schema.userNotes).where(eq(schema.userNotes.studentProfileId, studentProfileId));
      await tx.delete(schema.userChecklistTasks).where(eq(schema.userChecklistTasks.studentProfileId, studentProfileId));
      await tx.delete(schema.userCustomOpportunities).where(eq(schema.userCustomOpportunities.studentProfileId, studentProfileId));
      await tx.delete(schema.userSavedSearches).where(eq(schema.userSavedSearches.studentProfileId, studentProfileId));
      await tx.delete(schema.userReminders).where(eq(schema.userReminders.studentProfileId, studentProfileId));
      await tx.delete(schema.userNotifications).where(eq(schema.userNotifications.studentProfileId, studentProfileId));
      // "Replace" means the account ends up looking exactly like the file —
      // a payload with no eligibility answers/reminder preferences must
      // clear any existing ones, not silently leave them in place (the
      // upsert calls below only ever act when the payload actually has a
      // value for these singleton rows).
      if (!payload.eligibilityAnswers) {
        await tx.delete(schema.userEligibilityAnswers).where(eq(schema.userEligibilityAnswers.studentProfileId, studentProfileId));
      }
      if (!payload.reminderPreferences) {
        await tx.delete(schema.userReminderPreferences).where(eq(schema.userReminderPreferences.studentProfileId, studentProfileId));
      }
      if (!payload.planningPreferences) {
        await tx.delete(schema.userPlanningPreferences).where(eq(schema.userPlanningPreferences.studentProfileId, studentProfileId));
      }
      if (!payload.displayPreferences) {
        await tx.delete(schema.userDisplayPreferences).where(eq(schema.userDisplayPreferences.studentProfileId, studentProfileId));
      }
    }

    // Profile fields live on the student's own, already-existing
    // student_profiles row (created at sign-up) — this is always an UPDATE
    // scoped to the caller's own verified id, never an insert of a new row.
    if (payload.profile) {
      const profile = payload.profile;
      await tx
        .update(schema.studentProfiles)
        .set({
          displayName: profile.displayName,
          countryOrRegion: profile.countryOrRegion,
          currentStudyLevel: profile.currentStudyLevel,
          intendedStudyLevel: profile.intendedStudyLevel,
          graduationYear: profile.graduationYear,
          targetIntakeYear: profile.targetIntakeYear,
          targetIntakeTerm: profile.targetIntakeTerm,
          preferredCountries: profile.preferredCountries,
          preferredStudyLevels: profile.preferredStudyLevels,
          onboardingCompletedAt: profile.onboardingCompletedAt ? new Date(profile.onboardingCompletedAt) : null,
          updatedAt: new Date(),
        })
        .where(eq(schema.studentProfiles.id, studentProfileId));
      result.profileImported = true;
    }

    // Custom opportunities first — notes/checklist tasks/reminders/
    // notifications below may reference one by its (old, exported) id.
    // Natural key: (studentProfileId, slug) — already a unique index.
    for (const row of payload.customOpportunities) {
      const [inserted] = await tx
        .insert(schema.userCustomOpportunities)
        .values({
          id: randomUUID(),
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
          target: [schema.userCustomOpportunities.studentProfileId, schema.userCustomOpportunities.slug],
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
        })
        .returning({ id: schema.userCustomOpportunities.id });
      customOpportunityIdMap.set(row.id, inserted.id);
      result.customOpportunitiesImported += 1;
    }

    // Tracking: natural key (studentProfileId, opportunityId) — already a
    // unique index. A previously-exported opportunityId can reference an
    // opportunity that was since archived/removed from the public
    // catalogue — skip it rather than fail the whole import on an FK
    // violation.
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
          id: randomUUID(),
          studentProfileId,
          opportunityId: row.opportunityId,
          shortlisted: row.shortlisted,
          stage: row.stage,
          personalDeadline: row.personalDeadline ? new Date(row.personalDeadline) : null,
          priority: row.priority,
          archived: row.archived,
        })
        .onConflictDoUpdate({
          target: [schema.userOpportunityTracking.studentProfileId, schema.userOpportunityTracking.opportunityId],
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

    /** Remaps a polymorphic (targetType, targetId) pair; returns null if the target can't be resolved (skip the row). */
    async function resolveTarget(targetType: "built-in" | "custom", targetId: string): Promise<string | null> {
      if (targetType === "custom") {
        return customOpportunityIdMap.get(targetId) ?? null;
      }
      const [exists] = await tx.select({ id: schema.opportunities.id }).from(schema.opportunities).where(eq(schema.opportunities.id, targetId)).limit(1);
      return exists ? targetId : null;
    }

    // Notes: natural key (studentProfileId, targetType, targetId).
    for (const row of payload.notes) {
      const targetId = await resolveTarget(row.targetType, row.targetId);
      if (!targetId) continue;
      await tx
        .insert(schema.userNotes)
        .values({ id: randomUUID(), studentProfileId, targetType: row.targetType, targetId, noteText: row.noteText })
        .onConflictDoUpdate({
          target: [schema.userNotes.studentProfileId, schema.userNotes.targetType, schema.userNotes.targetId],
          set: { noteText: row.noteText, updatedAt: new Date() },
        });
      result.notesImported += 1;
    }

    // Checklist tasks: no natural key exists (free text with no stable
    // identity beyond order), so re-importing the same file twice in merge
    // mode can create duplicate tasks — documented, not silently hidden;
    // there is no meaningful "same item" test to dedupe on here.
    for (const row of payload.checklistTasks) {
      const targetId = await resolveTarget(row.targetType, row.targetId);
      if (!targetId) continue;
      await tx.insert(schema.userChecklistTasks).values({
        id: randomUUID(),
        studentProfileId,
        targetType: row.targetType,
        targetId,
        taskText: row.taskText,
        completed: row.completed,
        sortOrder: row.sortOrder,
        sourceType: "imported",
      });
      result.checklistTasksImported += 1;
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

    if (payload.planningPreferences) {
      const planning = payload.planningPreferences;
      await tx
        .insert(schema.userPlanningPreferences)
        .values({ studentProfileId, ...planning })
        .onConflictDoUpdate({ target: schema.userPlanningPreferences.studentProfileId, set: { ...planning, updatedAt: new Date() } });
      result.planningPreferencesImported = true;
    }

    if (payload.displayPreferences) {
      const display = payload.displayPreferences;
      await tx
        .insert(schema.userDisplayPreferences)
        .values({ studentProfileId, theme: display.theme, catalogueView: display.catalogueView })
        .onConflictDoUpdate({
          target: schema.userDisplayPreferences.studentProfileId,
          set: { theme: display.theme, catalogueView: display.catalogueView, updatedAt: new Date() },
        });
      result.displayPreferencesImported = true;
    }
    // syncMetadata is deliberately never re-imported: it's this device's own
    // sync bookkeeping (last-synced timestamp, schema version), not user
    // content — restoring a stale value from an old export would misreport
    // the account's current sync state rather than accurately reflect it.
    // Export-only, by design; narrowing the documented contract here rather
    // than pretending to "restore" something that isn't really account data.

    // Saved searches: no natural key exists in the schema — same "no stable
    // identity to dedupe on" situation as checklist tasks, documented above.
    for (const row of payload.savedSearches ?? []) {
      const [inserted] = await tx
        .insert(schema.userSavedSearches)
        .values({
          id: randomUUID(),
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
        .returning({ id: schema.userSavedSearches.id });
      savedSearchIdMap.set(row.id, inserted.id);
      result.savedSearchesImported += 1;
    }

    // Reminders: natural key (studentProfileId, stableKey) — already a
    // unique index, and deliberately deterministic per the schema's own
    // design, so re-importing the same export never duplicates a reminder.
    for (const row of payload.reminders ?? []) {
      const targetId = row.targetType && row.targetId ? await resolveTarget(row.targetType, row.targetId) : null;
      await tx
        .insert(schema.userReminders)
        .values({
          id: randomUUID(),
          studentProfileId,
          stableKey: row.stableKey,
          source: row.source,
          targetType: row.targetType,
          targetId,
          title: row.title,
          dueAt: new Date(row.dueAt),
          leadDays: row.leadDays,
          status: row.status,
        })
        .onConflictDoUpdate({
          target: [schema.userReminders.studentProfileId, schema.userReminders.stableKey],
          set: { title: row.title, dueAt: new Date(row.dueAt), leadDays: row.leadDays, status: row.status, updatedAt: new Date() },
        });
      result.remindersImported += 1;
    }

    // Notifications: no natural key exists — same documented limitation as
    // checklist tasks/saved searches.
    for (const row of payload.notifications ?? []) {
      const targetId = row.targetType && row.targetId ? await resolveTarget(row.targetType, row.targetId) : null;
      const savedSearchId = row.savedSearchId ? (savedSearchIdMap.get(row.savedSearchId) ?? null) : null;
      await tx.insert(schema.userNotifications).values({
        id: randomUUID(),
        studentProfileId,
        type: row.type,
        source: row.source,
        title: row.title,
        message: row.message,
        targetType: row.targetType,
        targetId,
        savedSearchId,
        dueAt: row.dueAt ? new Date(row.dueAt) : null,
        status: row.status,
        readAt: row.readAt ? new Date(row.readAt) : null,
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
  const db = getDb();
  const [staffProfile] = await db
    .select({ id: schema.staffProfiles.id })
    .from(schema.staffProfiles)
    .where(eq(schema.staffProfiles.id, studentProfileId))
    .limit(1);
  if (staffProfile) {
    return {
      ok: false,
      error: "This login is also a staff account. Remove staff access through the controlled staff-offboarding process before deleting the shared Auth account.",
    };
  }

  await wipeWorkspaceRows(studentProfileId);

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
