import { sql } from "drizzle-orm";
import { integer, jsonb, pgTable, text, uuid } from "drizzle-orm/pg-core";
import { auditTimestamps, publicSelectPolicy, serviceRoleBypassPolicy, staffSelectPolicy } from "./common";
import {
  eligibilityGroupOperatorEnum,
  eligibilityOperatorEnum,
  eligibilityRuleKindEnum,
  eligibilityRuleStatusEnum,
} from "./enums";
import { opportunities } from "./opportunities";
import { sourceEvidence } from "./sources";

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
    ...auditTimestamps,
  },
  (table) => [
    publicSelectPolicy(
      "eligibility_rules",
      sql`${table.status} = 'active' AND EXISTS (SELECT 1 FROM opportunities o WHERE o.id = ${table.opportunityId} AND o.status = 'published')`,
    ),
    staffSelectPolicy("eligibility_rules"),
    serviceRoleBypassPolicy("eligibility_rules"),
  ],
).enableRLS();
