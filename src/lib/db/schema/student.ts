import { sql } from "drizzle-orm";
import { boolean, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { auditTimestamps, ownerAllPolicy, ownerReadInsertPolicies, serviceRoleBypassPolicy } from "./common";
import {
  applicationStageEnum,
  checklistTaskSourceEnum,
  customDeadlineKindEnum,
  dataRequestStatusEnum,
  dataRequestTypeEnum,
  workspaceTargetTypeEnum,
} from "./enums";
import { opportunities } from "./opportunities";

/**
 * One row per Supabase Auth user who has opted into student workspace
 * features — never created by public registration alone. The row is
 * lazily provisioned (see `ensureStudentProfile` in
 * `src/lib/auth/student-session.ts`) the first time a signed-in user
 * touches any student workspace feature, which is what keeps "signed in"
 * and "has a student profile" from being the same thing: a staff member who
 * signs in only to use `/staff` never gets one of these rows created.
 * Every field beyond `id`/`email` is optional — Checkpoint 3 deliberately
 * collects the minimum needed for planning/matching, never sensitive
 * documents, financial data, or identifiers (see ADR-003 and
 * `docs/checkpoint-0/privacy-boundary.md`).
 */
export const studentProfiles = pgTable(
  "student_profiles",
  {
    /** Same value as `auth.users.id`; intentionally not a DB-level FK across schemas. */
    id: uuid("id").primaryKey(),
    email: text("email").notNull(),
    displayName: text("display_name"),
    countryOrRegion: text("country_or_region"),
    currentStudyLevel: text("current_study_level"),
    intendedStudyLevel: text("intended_study_level"),
    graduationYear: integer("graduation_year"),
    targetIntakeYear: integer("target_intake_year"),
    targetIntakeTerm: text("target_intake_term"),
    preferredCountries: text("preferred_countries").array().notNull().default(sql`'{}'::text[]`),
    preferredStudyLevels: text("preferred_study_levels").array().notNull().default(sql`'{}'::text[]`),
    onboardingCompletedAt: timestamp("onboarding_completed_at", { withTimezone: true }),
    ...auditTimestamps,
  },
  (table) => [ownerAllPolicy("student_profiles", table.id), serviceRoleBypassPolicy("student_profiles")],
).enableRLS();

/**
 * A student's private tracking state for one built-in (published) catalogue
 * opportunity — the cloud mirror of a guest `WorkspaceRecord`'s shortlist/
 * stage/deadline fields (notes and checklist live in their own tables below,
 * since a note/checklist can also target a custom opportunity).
 */
export const userOpportunityTracking = pgTable(
  "user_opportunity_tracking",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    studentProfileId: uuid("student_profile_id")
      .notNull()
      .references(() => studentProfiles.id, { onDelete: "cascade" }),
    opportunityId: uuid("opportunity_id")
      .notNull()
      .references(() => opportunities.id, { onDelete: "cascade" }),
    shortlisted: boolean("shortlisted").notNull().default(false),
    stage: applicationStageEnum("stage").notNull().default("not-started"),
    personalDeadline: timestamp("personal_deadline", { withTimezone: true }),
    priority: integer("priority"),
    archived: boolean("archived").notNull().default(false),
    lastViewedAt: timestamp("last_viewed_at", { withTimezone: true }),
    ...auditTimestamps,
  },
  (table) => [
    uniqueIndex("user_opportunity_tracking_student_opportunity_unique").on(
      table.studentProfileId,
      table.opportunityId,
    ),
    ownerAllPolicy("user_opportunity_tracking", table.studentProfileId),
    serviceRoleBypassPolicy("user_opportunity_tracking"),
  ],
).enableRLS();

/**
 * Cloud-synced custom (student-invented) opportunities — the mirror of a
 * guest `CustomOpportunityRecord`. Never labelled official or verified: it
 * has no `officialSources`/`verificationRecords` relationship at all, unlike
 * catalogue opportunities.
 */
export const userCustomOpportunities = pgTable(
  "user_custom_opportunities",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    studentProfileId: uuid("student_profile_id")
      .notNull()
      .references(() => studentProfiles.id, { onDelete: "cascade" }),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    opportunityType: text("opportunity_type").notNull(),
    providerName: text("provider_name"),
    countries: text("countries").array().notNull().default(sql`'{}'::text[]`),
    regions: text("regions").array().notNull().default(sql`'{}'::text[]`),
    studyLevels: text("study_levels").array().notNull().default(sql`'{}'::text[]`),
    benefitSummary: text("benefit_summary").notNull(),
    eligibilitySummary: text("eligibility_summary").notNull(),
    officialUrl: text("official_url"),
    deadlineKind: customDeadlineKindEnum("deadline_kind").notNull(),
    deadlineRawText: text("deadline_raw_text").notNull(),
    deadlineDate: text("deadline_date"),
    deadlineTimezone: text("deadline_timezone"),
    verificationNotes: text("verification_notes"),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    ...auditTimestamps,
  },
  (table) => [
    uniqueIndex("user_custom_opportunities_student_slug_unique").on(table.studentProfileId, table.slug),
    ownerAllPolicy("user_custom_opportunities", table.studentProfileId),
    serviceRoleBypassPolicy("user_custom_opportunities"),
  ],
).enableRLS();

/**
 * Plain text only — never rendered as HTML (enforced in the UI layer, not
 * here). At most one note per (student, target): mirrors the guest model,
 * where a `WorkspaceRecord` has a single `notes` string, not a list.
 * `targetId` is polymorphic (a built-in `opportunities.id` or a
 * `user_custom_opportunities.id`, selected by `targetType`) so it
 * intentionally carries no single-table foreign key.
 */
export const userNotes = pgTable(
  "user_notes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    studentProfileId: uuid("student_profile_id")
      .notNull()
      .references(() => studentProfiles.id, { onDelete: "cascade" }),
    targetType: workspaceTargetTypeEnum("target_type").notNull(),
    targetId: uuid("target_id").notNull(),
    noteText: text("note_text").notNull().default(""),
    ...auditTimestamps,
  },
  (table) => [
    uniqueIndex("user_notes_student_target_unique").on(table.studentProfileId, table.targetType, table.targetId),
    ownerAllPolicy("user_notes", table.studentProfileId),
    serviceRoleBypassPolicy("user_notes"),
  ],
).enableRLS();

/**
 * A student's personal checklist tasks, kept deliberately separate from
 * staff-managed `opportunity_document_requirements` (Checkpoint 2) — this is
 * the student's own to-do list, not an official requirement record.
 */
export const userChecklistTasks = pgTable(
  "user_checklist_tasks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    studentProfileId: uuid("student_profile_id")
      .notNull()
      .references(() => studentProfiles.id, { onDelete: "cascade" }),
    targetType: workspaceTargetTypeEnum("target_type").notNull(),
    targetId: uuid("target_id").notNull(),
    taskText: text("task_text").notNull(),
    completed: boolean("completed").notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),
    sourceType: checklistTaskSourceEnum("source_type").notNull().default("user-created"),
    ...auditTimestamps,
  },
  (table) => [
    ownerAllPolicy("user_checklist_tasks", table.studentProfileId),
    serviceRoleBypassPolicy("user_checklist_tasks"),
  ],
).enableRLS();

/**
 * The cloud mirror of a guest `PreferencesRecord.planning` block — one row
 * per student, kept as a direct 1:1 sync target so migration/merge logic
 * doesn't have to reshape data. Distinct from `student_profiles`, which
 * holds slower-changing identity/onboarding fields.
 */
export const userPlanningPreferences = pgTable(
  "user_planning_preferences",
  {
    studentProfileId: uuid("student_profile_id")
      .primaryKey()
      .references(() => studentProfiles.id, { onDelete: "cascade" }),
    expectedGraduationDate: text("expected_graduation_date"),
    targetIntakeYear: integer("target_intake_year"),
    targetIntakeTerm: text("target_intake_term"),
    preferredStudyLevels: text("preferred_study_levels").array().notNull().default(sql`'{}'::text[]`),
    preferredCountries: text("preferred_countries").array().notNull().default(sql`'{}'::text[]`),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    ownerAllPolicy("user_planning_preferences", table.studentProfileId),
    serviceRoleBypassPolicy("user_planning_preferences"),
  ],
).enableRLS();

/** The cloud mirror of a guest `PreferencesRecord.display` block, plus theme. */
export const userDisplayPreferences = pgTable(
  "user_display_preferences",
  {
    studentProfileId: uuid("student_profile_id")
      .primaryKey()
      .references(() => studentProfiles.id, { onDelete: "cascade" }),
    theme: text("theme"),
    catalogueView: text("catalogue_view").notNull().default("grid"),
    dashboardPreferences: jsonb("dashboard_preferences").notNull().default(sql`'{}'::jsonb`),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    ownerAllPolicy("user_display_preferences", table.studentProfileId),
    serviceRoleBypassPolicy("user_display_preferences"),
  ],
).enableRLS();

/**
 * Sync bookkeeping only — never workspace content. Lets the client show
 * "last synced at", detect whether the guest-to-cloud migration has already
 * been offered/completed, and record the last time a conflict was surfaced.
 */
export const userSyncState = pgTable(
  "user_sync_state",
  {
    studentProfileId: uuid("student_profile_id")
      .primaryKey()
      .references(() => studentProfiles.id, { onDelete: "cascade" }),
    deviceId: text("device_id"),
    lastSuccessfulSyncAt: timestamp("last_successful_sync_at", { withTimezone: true }),
    lastConflictAt: timestamp("last_conflict_at", { withTimezone: true }),
    schemaVersion: integer("schema_version").notNull().default(1),
    localMigrationCompletedAt: timestamp("local_migration_completed_at", { withTimezone: true }),
    ...auditTimestamps,
  },
  (table) => [ownerAllPolicy("user_sync_state", table.studentProfileId), serviceRoleBypassPolicy("user_sync_state")],
).enableRLS();

/**
 * A lightweight, append-only, student-visible log of their own export/
 * deletion requests — not a full audit log, and not readable by staff (see
 * `docs/checkpoint-3/privacy-and-data-controls.md`). The student may read
 * and create rows but never edit or delete one after the fact.
 */
export const userDataRequests = pgTable(
  "user_data_requests",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    studentProfileId: uuid("student_profile_id")
      .notNull()
      .references(() => studentProfiles.id, { onDelete: "cascade" }),
    requestType: dataRequestTypeEnum("request_type").notNull(),
    status: dataRequestStatusEnum("status").notNull().default("pending"),
    requestedAt: timestamp("requested_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    auditReference: text("audit_reference"),
  },
  (table) => [
    ...ownerReadInsertPolicies("user_data_requests", table.studentProfileId),
    serviceRoleBypassPolicy("user_data_requests"),
  ],
).enableRLS();
