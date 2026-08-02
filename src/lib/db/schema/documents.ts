import { sql } from "drizzle-orm";
import { check, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { auditTimestamps, publicSelectPolicy, serviceRoleBypassPolicy, staffSelectPolicy } from "./common";
import { documentRequirementLevelEnum, documentRequirementStatusEnum } from "./enums";
import { opportunities } from "./opportunities";
import { sourceEvidence } from "./sources";
import { staffProfiles } from "./staff";
import { requiredDocumentTemplates } from "./taxonomies";

/**
 * A sourced claim that an opportunity requires (or optionally accepts) a
 * generic document category. Never a file, upload, or file reference — see
 * `RequiredDocumentTemplate` in the Checkpoint 0 domain model.
 */
export const opportunityDocumentRequirements = pgTable(
  "opportunity_document_requirements",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    opportunityId: uuid("opportunity_id")
      .notNull()
      .references(() => opportunities.id, { onDelete: "cascade" }),
    requiredDocumentTemplateId: uuid("required_document_template_id")
      .notNull()
      .references(() => requiredDocumentTemplates.id, { onDelete: "restrict" }),
    requirementLevel: documentRequirementLevelEnum("requirement_level").notNull(),
    instructions: text("instructions"),
    conditionSummary: text("condition_summary"),
    sourceEvidenceId: uuid("source_evidence_id")
      .notNull()
      .references(() => sourceEvidence.id, { onDelete: "restrict" }),
    status: documentRequirementStatusEnum("status").notNull().default("draft"),
    displayOrder: integer("display_order").notNull().default(0),
    lastCheckedAt: timestamp("last_checked_at", { withTimezone: true }),
    /** Who drafted this requirement. Null for legacy-imported rows with no tracked actor. */
    createdByStaffProfileId: uuid("created_by_staff_profile_id").references(() => staffProfiles.id),
    /** Who promoted it to 'published' — must differ from the creator (see the CHECK below). */
    approvedByStaffProfileId: uuid("approved_by_staff_profile_id").references(() => staffProfiles.id),
    ...auditTimestamps,
  },
  (table) => [
    check(
      "opportunity_document_requirements_no_self_approval",
      sql`${table.approvedByStaffProfileId} IS NULL OR ${table.createdByStaffProfileId} IS NULL OR ${table.approvedByStaffProfileId} <> ${table.createdByStaffProfileId} OR COALESCE(current_setting('app.bootstrap_admin_actor_id', true), '') = ${table.approvedByStaffProfileId}::text`,
    ),
    check(
      "opportunity_document_requirements_published_requires_approver",
      sql`${table.status} <> 'published' OR ${table.createdByStaffProfileId} IS NULL OR ${table.approvedByStaffProfileId} IS NOT NULL`,
    ),
    publicSelectPolicy(
      "opportunity_document_requirements",
      sql`${table.status} = 'published' AND EXISTS (SELECT 1 FROM opportunities o WHERE o.id = ${table.opportunityId} AND o.status = 'published')`,
    ),
    staffSelectPolicy("opportunity_document_requirements"),
    serviceRoleBypassPolicy("opportunity_document_requirements"),
  ],
).enableRLS();
