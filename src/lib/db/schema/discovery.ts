import { sql } from "drizzle-orm";
import { boolean, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { auditTimestamps, ownerAllPolicy, serviceRoleBypassPolicy } from "./common";
import { notificationStatusEnum, notificationTypeEnum, reminderSourceEnum, reminderStatusEnum, workspaceTargetTypeEnum } from "./enums";
import { studentProfiles } from "./student";

/**
 * Checkpoint 4: private discovery data — saved searches, eligibility
 * answers, reminder preferences, generated reminders, and notifications.
 * Same ownership model as the Checkpoint 3 student workspace tables: every
 * table is owner-only via `ownerAllPolicy` (no staff-select policy — staff
 * never get casual read access to a student's eligibility answers or
 * discovery activity), plus the standard service_role bypass.
 */

/** A saved catalogue search: name + query + serialized filters + an alert snapshot. */
export const userSavedSearches = pgTable(
  "user_saved_searches",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    studentProfileId: uuid("student_profile_id")
      .notNull()
      .references(() => studentProfiles.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    queryText: text("query_text").notNull().default(""),
    /** The `CatalogueFilters` object, minus anything private (it only ever holds public filter values). */
    filters: jsonb("filters").notNull().default(sql`'{}'::jsonb`),
    sortMode: text("sort_mode").notNull().default("nearest-deadline"),
    resultCountSnapshot: integer("result_count_snapshot"),
    /** Per-result snapshot used by the deterministic alert diff (ids + deadline/verification fingerprints). */
    resultSnapshot: jsonb("result_snapshot").notNull().default(sql`'[]'::jsonb`),
    lastCheckedAt: timestamp("last_checked_at", { withTimezone: true }),
    alertsEnabled: boolean("alerts_enabled").notNull().default(true),
    ...auditTimestamps,
  },
  (table) => [ownerAllPolicy("user_saved_searches", table.studentProfileId), serviceRoleBypassPolicy("user_saved_searches")],
).enableRLS();

/**
 * One row per student: optional eligibility questionnaire answers. Every
 * field is optional/nullable by design — see
 * `src/lib/schemas/eligibility-answers.ts` for the validated shape and the
 * deliberate exclusions (no passport/ID numbers, no address, no financial or
 * medical data, no religious/ethnic identity, no document contents).
 */
export const userEligibilityAnswers = pgTable(
  "user_eligibility_answers",
  {
    studentProfileId: uuid("student_profile_id")
      .primaryKey()
      .references(() => studentProfiles.id, { onDelete: "cascade" }),
    countryOfResidence: text("country_of_residence"),
    nationality: text("nationality"),
    currentStudyLevel: text("current_study_level"),
    intendedStudyLevel: text("intended_study_level"),
    fieldsOfInterest: text("fields_of_interest").array().notNull().default(sql`'{}'::text[]`),
    graduationYear: integer("graduation_year"),
    targetIntakeYear: integer("target_intake_year"),
    targetIntakeTerm: text("target_intake_term"),
    preferredCountries: text("preferred_countries").array().notNull().default(sql`'{}'::text[]`),
    preferredRegions: text("preferred_regions").array().notNull().default(sql`'{}'::text[]`),
    languageTestStatus: text("language_test_status"),
    researchExperience: text("research_experience"),
    workExperienceYears: integer("work_experience_years"),
    finalYearStatus: text("final_year_status"),
    fundingPreference: text("funding_preference"),
    studyMode: text("study_mode"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    ownerAllPolicy("user_eligibility_answers", table.studentProfileId),
    serviceRoleBypassPolicy("user_eligibility_answers"),
  ],
).enableRLS();

/** One row per student: reminder lead-time preferences + notification opt-ins. */
export const userReminderPreferences = pgTable(
  "user_reminder_preferences",
  {
    studentProfileId: uuid("student_profile_id")
      .primaryKey()
      .references(() => studentProfiles.id, { onDelete: "cascade" }),
    remindersEnabled: boolean("reminders_enabled").notNull().default(true),
    /** Days before the deadline to remind (subset of 0/1/3/7/14/30). */
    officialLeadDays: integer("official_lead_days").array().notNull().default(sql`'{7}'::integer[]`),
    personalLeadDays: integer("personal_lead_days").array().notNull().default(sql`'{1,7}'::integer[]`),
    savedSearchAlertsEnabled: boolean("saved_search_alerts_enabled").notNull().default(true),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    ownerAllPolicy("user_reminder_preferences", table.studentProfileId),
    serviceRoleBypassPolicy("user_reminder_preferences"),
  ],
).enableRLS();

/**
 * A generated reminder instance. `stableKey` is deterministic
 * (`source:targetId:dueDate:leadDays`) so regeneration never duplicates a
 * reminder and never resurrects one the student dismissed or completed.
 */
export const userReminders = pgTable(
  "user_reminders",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    studentProfileId: uuid("student_profile_id")
      .notNull()
      .references(() => studentProfiles.id, { onDelete: "cascade" }),
    stableKey: text("stable_key").notNull(),
    source: reminderSourceEnum("source").notNull(),
    targetType: workspaceTargetTypeEnum("target_type"),
    targetId: uuid("target_id"),
    title: text("title").notNull(),
    dueAt: timestamp("due_at", { withTimezone: true }).notNull(),
    leadDays: integer("lead_days").notNull().default(0),
    status: reminderStatusEnum("status").notNull().default("pending"),
    ...auditTimestamps,
  },
  (table) => [
    uniqueIndex("user_reminders_student_stable_key_unique").on(table.studentProfileId, table.stableKey),
    ownerAllPolicy("user_reminders", table.studentProfileId),
    serviceRoleBypassPolicy("user_reminders"),
  ],
).enableRLS();

/** A notification-center record (saved-search alerts, system notices). Never contains private note text. */
export const userNotifications = pgTable(
  "user_notifications",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    studentProfileId: uuid("student_profile_id")
      .notNull()
      .references(() => studentProfiles.id, { onDelete: "cascade" }),
    type: notificationTypeEnum("type").notNull(),
    source: reminderSourceEnum("source").notNull().default("system"),
    title: text("title").notNull(),
    message: text("message").notNull().default(""),
    targetType: workspaceTargetTypeEnum("target_type"),
    targetId: uuid("target_id"),
    savedSearchId: uuid("saved_search_id"),
    dueAt: timestamp("due_at", { withTimezone: true }),
    status: notificationStatusEnum("status").notNull().default("unread"),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [ownerAllPolicy("user_notifications", table.studentProfileId), serviceRoleBypassPolicy("user_notifications")],
).enableRLS();
