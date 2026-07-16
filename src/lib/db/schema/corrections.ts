import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { serviceRoleBypassPolicy, staffSelectPolicy } from "./common";
import { correctionCategoryEnum, correctionReportStatusEnum } from "./enums";
import { opportunities } from "./opportunities";
import { staffProfiles } from "./staff";

/**
 * Submitted exclusively through the validated `/api/correction-reports`
 * route (never directly over PostgREST — see the RLS design note in
 * `common.ts`), which is what actually enforces the Zod validation, length
 * limits, and honeypot check described in the Checkpoint 2 brief.
 */
export const correctionReports = pgTable(
  "correction_reports",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    opportunityId: uuid("opportunity_id")
      .notNull()
      .references(() => opportunities.id, { onDelete: "cascade" }),
    category: correctionCategoryEnum("category").notNull(),
    description: text("description").notNull(),
    suggestedOfficialSourceUrl: text("suggested_official_source_url"),
    reporterContactEmail: text("reporter_contact_email"),
    status: correctionReportStatusEnum("status").notNull().default("submitted"),
    assignedStaffProfileId: uuid("assigned_staff_profile_id").references(() => staffProfiles.id),
    resolutionSummary: text("resolution_summary"),
    resolvedByStaffProfileId: uuid("resolved_by_staff_profile_id").references(() => staffProfiles.id),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    duplicateOfCorrectionReportId: uuid("duplicate_of_correction_report_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  () => [
    // No anon/authenticated policy at all: reads and writes both happen only
    // through our privileged server code (see the RLS design note above).
    staffSelectPolicy("correction_reports"),
    serviceRoleBypassPolicy("correction_reports"),
  ],
).enableRLS();
