import { boolean, integer, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { serviceRoleBypassPolicy, staffSelectPolicy } from "./common";
import { importJobSourceKindEnum, importJobStatusEnum, importRowOutcomeEnum } from "./enums";
import { opportunities } from "./opportunities";
import { staffProfiles } from "./staff";

/**
 * One row per import run (legacy-seed migration or staff CSV upload). Only
 * job metadata and row counts are retained — the uploaded file's bytes are
 * never persisted (`source_filename` is a display label only).
 */
export const importJobs = pgTable(
  "import_jobs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sourceKind: importJobSourceKindEnum("source_kind").notNull(),
    sourceFilename: text("source_filename"),
    status: importJobStatusEnum("status").notNull().default("pending"),
    dryRun: boolean("dry_run").notNull().default(true),
    totalRows: integer("total_rows").notNull().default(0),
    acceptedRows: integer("accepted_rows").notNull().default(0),
    rejectedRows: integer("rejected_rows").notNull().default(0),
    duplicateWarnings: integer("duplicate_warnings").notNull().default(0),
    validationErrors: jsonb("validation_errors"),
    actorStaffProfileId: uuid("actor_staff_profile_id").references(() => staffProfiles.id),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    resultSummary: jsonb("result_summary"),
  },
  () => [staffSelectPolicy("import_jobs"), serviceRoleBypassPolicy("import_jobs")],
).enableRLS();

export const importJobRows = pgTable(
  "import_job_rows",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    importJobId: uuid("import_job_id")
      .notNull()
      .references(() => importJobs.id, { onDelete: "cascade" }),
    rowNumber: integer("row_number").notNull(),
    legacyReference: text("legacy_reference"),
    outcome: importRowOutcomeEnum("outcome").notNull(),
    opportunityId: uuid("opportunity_id").references(() => opportunities.id, { onDelete: "set null" }),
    errors: jsonb("errors"),
  },
  () => [staffSelectPolicy("import_job_rows"), serviceRoleBypassPolicy("import_job_rows")],
).enableRLS();
