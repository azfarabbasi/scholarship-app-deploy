import type {
  EntityId,
  JsonValue,
  PublicationClassifiedRecord,
} from "./common";

export const ELIGIBILITY_RULE_KINDS = [
  "nationality",
  "residence",
  "study-level",
  "field-of-study",
  "academic-score",
  "graduation-date",
  "age",
  "language-test",
  "work-experience",
  "research-experience",
  "institution",
  "programme",
  "other",
] as const;

export type EligibilityRuleKind = (typeof ELIGIBILITY_RULE_KINDS)[number];

export const ELIGIBILITY_OPERATORS = [
  "equals",
  "not-equals",
  "in",
  "not-in",
  "greater-than",
  "greater-than-or-equal",
  "less-than",
  "less-than-or-equal",
  "exists",
  "not-exists",
] as const;

export type EligibilityOperator = (typeof ELIGIBILITY_OPERATORS)[number];

export const ELIGIBILITY_RULE_STATUSES = [
  "draft",
  "in-review",
  "approved",
  "active",
  "superseded",
  "withdrawn",
] as const;

export type EligibilityRuleStatus =
  (typeof ELIGIBILITY_RULE_STATUSES)[number];

/** A deterministic condition sourced from published opportunity criteria. */
interface EligibilityRuleFields {
  eligibilityRuleId: EntityId;
  opportunityId: EntityId;
  ruleGroupId: EntityId;
  kind: EligibilityRuleKind;
  fieldKey: string;
  operator: EligibilityOperator;
  expectedValue: JsonValue;
  unit: string | null;
  explanation: string;
  sourceEvidenceId: EntityId;
}

export type EligibilityRule = PublicationClassifiedRecord<
  EligibilityRuleFields,
  EligibilityRuleStatus,
  "draft" | "in-review" | "approved"
>;

export const ELIGIBILITY_GROUP_OPERATORS = ["all", "any", "none"] as const;

export type EligibilityGroupOperator =
  (typeof ELIGIBILITY_GROUP_OPERATORS)[number];

interface EligibilityRuleGroupFields {
  eligibilityRuleGroupId: EntityId;
  opportunityId: EntityId;
  parentGroupId: EntityId | null;
  label: string;
  operator: EligibilityGroupOperator;
  ruleIds: readonly EntityId[];
  childGroupIds: readonly EntityId[];
  sourceEvidenceId: EntityId | null;
}

export type EligibilityRuleGroup = PublicationClassifiedRecord<
  EligibilityRuleGroupFields,
  EligibilityRuleStatus,
  "draft" | "in-review" | "approved"
>;
