import { sql } from "drizzle-orm";
import { check, integer, pgPolicy, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { authenticatedRole } from "./roles";
import { serviceRoleBypassPolicy } from "./common";
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
  (table) => [
    check(
      "review_assignments_no_self_review",
      sql`${table.subjectAuthorStaffProfileId} IS NULL OR ${table.reviewerStaffProfileId} <> ${table.subjectAuthorStaffProfileId} OR COALESCE(current_setting('app.bootstrap_admin_actor_id', true), '') = ${table.reviewerStaffProfileId}::text`,
    ),
    // Narrowed from "any active staff role" to only those actually party to
    // the assignment (reviewer, assigner, or the subject's author — e.g. to
    // see a "changes requested" note on their own draft) plus administrators.
    // A baseline reviewer with no involvement in a given assignment has no
    // legitimate reason to read it via direct Supabase REST; the app's own
    // queue/dashboard views are read through the privileged server
    // connection and are unaffected by this.
    // Keeps the original `_select_staff` policy name (same table, same
    // slot) so drizzle-kit diffs this as a plain `ALTER POLICY` rather than
    // a drop+create it would otherwise want to interactively disambiguate
    // as a rename.
    pgPolicy("review_assignments_select_staff", {
      as: "permissive",
      for: "select",
      to: authenticatedRole,
      using: sql`${table.reviewerStaffProfileId} = auth.uid()
        OR ${table.assignedByStaffProfileId} = auth.uid()
        OR ${table.subjectAuthorStaffProfileId} = auth.uid()
        OR app.is_staff(auth.uid(), ARRAY['administrator']::text[])`,
    }),
    serviceRoleBypassPolicy("review_assignments"),
  ],
).enableRLS();
