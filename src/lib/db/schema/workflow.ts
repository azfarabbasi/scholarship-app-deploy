import { integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { serviceRoleBypassPolicy, staffSelectPolicy } from "./common";
import { reviewAssignmentStatusEnum, reviewSubjectKindEnum, staffRoleEnum } from "./enums";
import { opportunities } from "./opportunities";
import { staffProfiles } from "./staff";

/**
 * Allocates a bounded review/verification task while enforcing separation of
 * duties: `reviewer_staff_profile_id` must never equal
 * `subject_author_staff_profile_id` for a substantive review (checked in the
 * app layer's workflow engine, not just here).
 */
export const reviewAssignments = pgTable(
  "review_assignments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    subjectKind: reviewSubjectKindEnum("subject_kind").notNull(),
    subjectId: uuid("subject_id").notNull(),
    opportunityId: uuid("opportunity_id").references(() => opportunities.id, { onDelete: "cascade" }),
    correctionReportId: uuid("correction_report_id"),
    subjectVersion: integer("subject_version"),
    subjectAuthorStaffProfileId: uuid("subject_author_staff_profile_id").references(() => staffProfiles.id),
    reviewerStaffProfileId: uuid("reviewer_staff_profile_id")
      .notNull()
      .references(() => staffProfiles.id),
    assignedByStaffProfileId: uuid("assigned_by_staff_profile_id")
      .notNull()
      .references(() => staffProfiles.id),
    requiredRole: staffRoleEnum("required_role").notNull(),
    status: reviewAssignmentStatusEnum("status").notNull().default("queued"),
    assignedAt: timestamp("assigned_at", { withTimezone: true }).notNull().defaultNow(),
    dueAt: timestamp("due_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    conflictOfInterestDeclaredAt: timestamp("conflict_of_interest_declared_at", { withTimezone: true }),
    conflictOfInterestDetails: text("conflict_of_interest_details"),
    decision: text("decision"),
    reviewerNotes: text("reviewer_notes"),
  },
  () => [
    // A staff member sees assignments where they are the reviewer, assigner, or
    // hold any staff role (dashboards need to show queue-wide summaries).
    staffSelectPolicy("review_assignments"),
    serviceRoleBypassPolicy("review_assignments"),
  ],
).enableRLS();
