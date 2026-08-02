import { sql } from "drizzle-orm";
import { char, check, numeric, pgTable, text, uuid } from "drizzle-orm/pg-core";
import { auditTimestamps, publicSelectPolicy, serviceRoleBypassPolicy, staffSelectPolicy } from "./common";
import { fundingBenefitKindEnum, fundingBenefitStatusEnum } from "./enums";
import { opportunities } from "./opportunities";
import { sourceEvidence } from "./sources";
import { staffProfiles } from "./staff";
import { fundingTypes } from "./taxonomies";

export const fundingBenefits = pgTable(
  "funding_benefits",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    opportunityId: uuid("opportunity_id")
      .notNull()
      .references(() => opportunities.id, { onDelete: "cascade" }),
    fundingTypeId: uuid("funding_type_id")
      .notNull()
      .references(() => fundingTypes.id, { onDelete: "restrict" }),
    kind: fundingBenefitKindEnum("kind").notNull(),
    summary: text("summary").notNull(),
    amount: numeric("amount", { precision: 12, scale: 2 }),
    currencyCode: char("currency_code", { length: 3 }),
    frequency: text("frequency"),
    conditions: text("conditions"),
    sourceEvidenceId: uuid("source_evidence_id").references(() => sourceEvidence.id, { onDelete: "restrict" }),
    status: fundingBenefitStatusEnum("status").notNull().default("draft"),
    /** Who drafted this benefit. Null for legacy-imported rows with no tracked actor. */
    createdByStaffProfileId: uuid("created_by_staff_profile_id").references(() => staffProfiles.id),
    /** Who promoted it to 'published' — must differ from the creator (see the CHECK below). */
    approvedByStaffProfileId: uuid("approved_by_staff_profile_id").references(() => staffProfiles.id),
    ...auditTimestamps,
  },
  (table) => [
    check(
      "funding_benefits_no_self_approval",
      sql`${table.approvedByStaffProfileId} IS NULL OR ${table.createdByStaffProfileId} IS NULL OR ${table.approvedByStaffProfileId} <> ${table.createdByStaffProfileId} OR COALESCE(current_setting('app.bootstrap_admin_actor_id', true), '') = ${table.approvedByStaffProfileId}::text`,
    ),
    check(
      "funding_benefits_published_requires_approver",
      sql`${table.status} <> 'published' OR ${table.createdByStaffProfileId} IS NULL OR ${table.approvedByStaffProfileId} IS NOT NULL`,
    ),
    publicSelectPolicy(
      "funding_benefits",
      sql`${table.status} = 'published' AND EXISTS (SELECT 1 FROM opportunities o WHERE o.id = ${table.opportunityId} AND o.status = 'published')`,
    ),
    staffSelectPolicy("funding_benefits"),
    serviceRoleBypassPolicy("funding_benefits"),
  ],
).enableRLS();
