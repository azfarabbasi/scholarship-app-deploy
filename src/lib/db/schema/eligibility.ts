import { sql } from "drizzle-orm";
import { check, integer, jsonb, pgTable, text, uuid } from "drizzle-orm/pg-core";
import { auditTimestamps, publicSelectPolicy, serviceRoleBypassPolicy, staffSelectPolicy } from "./common";
import {
  eligibilityGroupOperatorEnum,
  eligibilityOperatorEnum,
  eligibilityRuleKindEnum,
  eligibilityRuleStatusEnum,
} from "./enums";
import { opportunities } from "./opportunities";
import { sourceEvidence } from "./sources";
import { staffProfiles } from "./staff";

/**
 * Groups deterministic rules with explicit all/any/none logic. Checkpoint 2
 * stores and manages these; evaluating them against a student profile is out
 * of scope until a later checkpoint (see ADR-004).
 */
export const eligibilityRuleGroups = pgTable(
  "eligibility_rule_groups",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    opportunityId: uuid("opportunity_id")
      .notNull()
      .references(() => opportunities.id, { onDelete: "cascade" }),
    parentGroupId: uuid("parent_group_id"),
    label: text("label").notNull(),
    operator: eligibilityGroupOperatorEnum("operator").notNull(),
    sourceEvidenceId: uuid("source_evidence_id").references(() => sourceEvidence.id, { onDelete: "restrict" }),
    status: eligibilityRuleStatusEnum("status").notNull().default("draft"),
    ...auditTimestamps,
  },
  (table) => [
    publicSelectPolicy(
      "eligibility_rule_groups",
      sql`${table.status} = 'active' AND EXISTS (SELECT 1 FROM opportunities o WHERE o.id = ${table.opportunityId} AND o.status = 'published')`,
    ),
    staffSelectPolicy("eligibility_rule_groups"),
    serviceRoleBypassPolicy("eligibility_rule_groups"),
  ],
).enableRLS();

export const eligibilityRules = pgTable(
  "eligibility_rules",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    opportunityId: uuid("opportunity_id")
      .notNull()
      .references(() => opportunities.id, { onDelete: "cascade" }),
    ruleGroupId: uuid("rule_group_id")
      .notNull()
      .references(() => eligibilityRuleGroups.id, { onDelete: "cascade" }),
    kind: eligibilityRuleKindEnum("kind").notNull(),
    fieldKey: text("field_key").notNull(),
    operator: eligibilityOperatorEnum("operator").notNull(),
    expectedValue: jsonb("expected_value"),
    unit: text("unit"),
    explanation: text("explanation").notNull(),
    sourceEvidenceId: uuid("source_evidence_id")
      .notNull()
      .references(() => sourceEvidence.id, { onDelete: "restrict" }),
    status: eligibilityRuleStatusEnum("status").notNull().default("draft"),
    version: integer("version").notNull().default(1),
    /** Who drafted this rule. Null for legacy-imported rows with no tracked actor. */
    createdByStaffProfileId: uuid("created_by_staff_profile_id").references(() => staffProfiles.id),
    /** Who promoted it to 'active' — must differ from the creator (see the CHECK below). */
    approvedByStaffProfileId: uuid("approved_by_staff_profile_id").references(() => staffProfiles.id),
    ...auditTimestamps,
  },
  (table) => [
    check(
      "eligibility_rules_no_self_approval",
      sql`${table.approvedByStaffProfileId} IS NULL OR ${table.createdByStaffProfileId} IS NULL OR ${table.approvedByStaffProfileId} <> ${table.createdByStaffProfileId} OR COALESCE(current_setting('app.bootstrap_admin_actor_id', true), '') = ${table.approvedByStaffProfileId}::text`,
    ),
    check(
      "eligibility_rules_active_requires_approver",
      sql`${table.status} <> 'active' OR ${table.createdByStaffProfileId} IS NULL OR ${table.approvedByStaffProfileId} IS NOT NULL`,
    ),
    publicSelectPolicy(
      "eligibility_rules",
      sql`${table.status} = 'active' AND EXISTS (SELECT 1 FROM opportunities o WHERE o.id = ${table.opportunityId} AND o.status = 'published')`,
    ),
    staffSelectPolicy("eligibility_rules"),
    serviceRoleBypassPolicy("eligibility_rules"),
  ],
).enableRLS();
