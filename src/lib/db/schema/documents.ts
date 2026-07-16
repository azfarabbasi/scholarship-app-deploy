import { sql } from "drizzle-orm";
import { integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { auditTimestamps, publicSelectPolicy, serviceRoleBypassPolicy, staffSelectPolicy } from "./common";
import { documentRequirementLevelEnum, documentRequirementStatusEnum } from "./enums";
import { opportunities } from "./opportunities";
import { sourceEvidence } from "./sources";
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
    ...auditTimestamps,
  },
  (table) => [
    publicSelectPolicy(
      "opportunity_document_requirements",
      sql`${table.status} = 'published' AND EXISTS (SELECT 1 FROM opportunities o WHERE o.id = ${table.opportunityId} AND o.status = 'published')`,
    ),
    staffSelectPolicy("opportunity_document_requirements"),
    serviceRoleBypassPolicy("opportunity_document_requirements"),
  ],
).enableRLS();
