import { sql } from "drizzle-orm";
import { boolean, check, date, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { auditTimestamps, publicSelectPolicy, serviceRoleBypassPolicy, staffSelectPolicy } from "./common";
import {
  deadlineCycleStatusEnum,
  deadlineOccurrenceStatusEnum,
  deadlinePrecisionEnum,
  deadlineRecurrenceCadenceEnum,
  deadlineRoleEnum,
  deadlineScopeKindEnum,
  deadlineVerificationStatusEnum,
  intakeStatusEnum,
} from "./enums";
import { opportunities } from "./opportunities";
import { staffProfiles } from "./staff";

export const intakes = pgTable(
  "intakes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    opportunityId: uuid("opportunity_id")
      .notNull()
      .references(() => opportunities.id, { onDelete: "cascade" }),
    label: text("label").notNull(),
    academicYear: text("academic_year"),
    startDate: date("start_date"),
    endDate: date("end_date"),
    status: intakeStatusEnum("status").notNull().default("draft"),
    ...auditTimestamps,
  },
  (table) => [
    publicSelectPolicy(
      "intakes",
      sql`EXISTS (SELECT 1 FROM opportunities o WHERE o.id = ${table.opportunityId} AND o.status = 'published')`,
    ),
    staffSelectPolicy("intakes"),
    serviceRoleBypassPolicy("intakes"),
  ],
).enableRLS();

/**
 * Groups scoped deadline occurrences for one published application cycle.
 * `automatic_date_generation_allowed` is always false and exists only so the
 * no-silent-rollover invariant is visible in the schema itself.
 */
export const deadlineCycles = pgTable(
  "deadline_cycles",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    opportunityId: uuid("opportunity_id")
      .notNull()
      .references(() => opportunities.id, { onDelete: "cascade" }),
    cycleLabel: text("cycle_label"),
    cycleYear: integer("cycle_year"),
    applicationCycleStartsOn: date("application_cycle_starts_on"),
    applicationCycleEndsOn: date("application_cycle_ends_on"),
    recurrenceCadence: deadlineRecurrenceCadenceEnum("recurrence_cadence").notNull().default("unknown"),
    recurrenceIntervalYears: integer("recurrence_interval_years"),
    recurrenceDocumentedBySource: boolean("recurrence_documented_by_source").notNull().default(false),
    recurrenceSourceText: text("recurrence_source_text"),
    automaticDateGenerationAllowed: boolean("automatic_date_generation_allowed").notNull().default(false),
    status: deadlineCycleStatusEnum("status").notNull().default("draft"),
    ...auditTimestamps,
  },
  (table) => [
    check(
      "deadline_cycles_no_automatic_generation",
      sql`${table.automaticDateGenerationAllowed} = false`,
    ),
    publicSelectPolicy(
      "deadline_cycles",
      sql`EXISTS (SELECT 1 FROM opportunities o WHERE o.id = ${table.opportunityId} AND o.status = 'published')`,
    ),
    staffSelectPolicy("deadline_cycles"),
    serviceRoleBypassPolicy("deadline_cycles"),
  ],
).enableRLS();

export const deadlineCycleTargetIntakes = pgTable(
  "deadline_cycle_target_intakes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    deadlineCycleId: uuid("deadline_cycle_id")
      .notNull()
      .references(() => deadlineCycles.id, { onDelete: "cascade" }),
    intakeId: uuid("intake_id")
      .notNull()
      .references(() => intakes.id, { onDelete: "restrict" }),
    intakeLabelSnapshot: text("intake_label_snapshot").notNull(),
    programStartDateSnapshot: date("program_start_date_snapshot"),
  },
  (table) => [
    uniqueIndex("deadline_cycle_target_intakes_unique").on(table.deadlineCycleId, table.intakeId),
    staffSelectPolicy("deadline_cycle_target_intakes"),
    serviceRoleBypassPolicy("deadline_cycle_target_intakes"),
    publicSelectPolicy(
      "deadline_cycle_target_intakes",
      sql`EXISTS (SELECT 1 FROM deadline_cycles dc JOIN opportunities o ON o.id = dc.opportunity_id WHERE dc.id = ${table.deadlineCycleId} AND o.status = 'published')`,
    ),
  ],
).enableRLS();

/**
 * One scoped occurrence within a cycle. The precision/date CHECK constraints
 * below are the database-level half of "never fabricate an exact date for an
 * uncertain deadline" — `rolling`/`unknown` occurrences may never carry a
 * date, and an `exact` occurrence must carry at least one.
 */
export const deadlineOccurrences = pgTable(
  "deadline_occurrences",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    deadlineCycleId: uuid("deadline_cycle_id")
      .notNull()
      .references(() => deadlineCycles.id, { onDelete: "cascade" }),
    role: deadlineRoleEnum("role").notNull().default("applicant-submission"),
    roleLabel: text("role_label"),
    precision: deadlinePrecisionEnum("precision").notNull(),
    openingDate: date("opening_date"),
    openingIsEstimated: boolean("opening_is_estimated"),
    closingDate: date("closing_date"),
    closingIsEstimated: boolean("closing_is_estimated"),
    scopeKind: deadlineScopeKindEnum("scope_kind").notNull().default("universal"),
    scopeProgramId: text("scope_program_id"),
    scopeInstitutionId: text("scope_institution_id"),
    scopeCountryCode: text("scope_country_code"),
    scopeResidencyCode: text("scope_residency_code"),
    scopeApplicantCategoryCode: text("scope_applicant_category_code"),
    scopeRoundLabel: text("scope_round_label"),
    rawText: text("raw_text").notNull(),
    sourceTimezone: text("source_timezone"),
    verificationStatus: deadlineVerificationStatusEnum("verification_status").notNull().default("unverified"),
    supersedesOccurrenceId: uuid("supersedes_occurrence_id"),
    status: deadlineOccurrenceStatusEnum("status").notNull().default("draft"),
    ...auditTimestamps,
  },
  (table) => [
    check(
      "deadline_occurrences_no_fabricated_dates",
      sql`(${table.precision} NOT IN ('rolling', 'unknown')) OR (${table.openingDate} IS NULL AND ${table.closingDate} IS NULL)`,
    ),
    check(
      "deadline_occurrences_exact_requires_date",
      sql`(${table.precision} <> 'exact') OR (${table.openingDate} IS NOT NULL OR ${table.closingDate} IS NOT NULL)`,
    ),
    publicSelectPolicy(
      "deadline_occurrences",
      sql`EXISTS (SELECT 1 FROM deadline_cycles dc JOIN opportunities o ON o.id = dc.opportunity_id WHERE dc.id = ${table.deadlineCycleId} AND o.status = 'published')`,
    ),
    staffSelectPolicy("deadline_occurrences"),
    serviceRoleBypassPolicy("deadline_occurrences"),
  ],
).enableRLS();

/** Immutable append-only history of every change to a deadline occurrence's dates/state. */
export const deadlineOccurrenceHistory = pgTable(
  "deadline_occurrence_history",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    deadlineOccurrenceId: uuid("deadline_occurrence_id")
      .notNull()
      .references(() => deadlineOccurrences.id, { onDelete: "cascade" }),
    changedByStaffProfileId: uuid("changed_by_staff_profile_id").references(() => staffProfiles.id),
    changeReason: text("change_reason"),
    previousState: jsonb("previous_state").notNull(),
    newState: jsonb("new_state").notNull(),
    officialSourceId: uuid("official_source_id"),
    changedAt: timestamp("changed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  () => [staffSelectPolicy("deadline_occurrence_history"), serviceRoleBypassPolicy("deadline_occurrence_history")],
).enableRLS();
