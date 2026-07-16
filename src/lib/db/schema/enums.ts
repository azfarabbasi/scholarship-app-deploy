import { pgEnum } from "drizzle-orm/pg-core";

/**
 * Every enum mirrors a `src/lib/domain/*.ts` Checkpoint 0 contract 1:1 so the
 * database vocabulary never drifts from the reviewed domain model. Values use
 * snake_case for SQL; the TypeScript union types re-exported alongside them
 * use the same casing to keep the DB row and the app-layer type identical.
 */

// Staff identity -------------------------------------------------------------

export const staffRoleEnum = pgEnum("staff_role", [
  "reviewer",
  "senior_reviewer",
  "administrator",
  "system_service",
]);

export const staffProfileStatusEnum = pgEnum("staff_profile_status", ["active", "suspended"]);

// Organisations / providers ---------------------------------------------------

export const organisationKindEnum = pgEnum("organisation_kind", [
  "government",
  "university",
  "foundation",
  "non-profit",
  "company",
  "multilateral-organisation",
  "research-institute",
  "other",
]);

export const organisationStatusEnum = pgEnum("organisation_status", [
  "draft",
  "verified",
  "active",
  "inactive",
  "merged",
]);

export const providerStatusEnum = pgEnum("provider_status", [
  "draft",
  "verified",
  "active",
  "inactive",
  "superseded",
]);

// Taxonomies -------------------------------------------------------------------

export const countryStatusEnum = pgEnum("country_status", ["active", "deprecated", "historical"]);

export const regionStatusEnum = pgEnum("region_status", ["draft", "active", "deprecated", "historical"]);

export const studyLevelStatusEnum = pgEnum("study_level_status", ["draft", "active", "deprecated", "retired"]);

export const fieldOfStudyStatusEnum = pgEnum("field_of_study_status", [
  "draft",
  "active",
  "deprecated",
  "merged",
]);

export const fundingTypeStatusEnum = pgEnum("funding_type_status", ["draft", "active", "deprecated", "retired"]);

export const opportunityTypeCodeEnum = pgEnum("opportunity_type_code", [
  "scholarship",
  "partial-scholarship",
  "internship",
  "fellowship",
  "exchange",
  "research-placement",
  "grant",
  "competition",
  "conference",
  "summer-school",
]);

export const opportunityTypeStatusEnum = pgEnum("opportunity_type_status", [
  "draft",
  "active",
  "deprecated",
  "retired",
]);

// Opportunities ------------------------------------------------------------------

export const opportunityStatusEnum = pgEnum("opportunity_status", [
  "draft",
  "in_review",
  "changes_requested",
  "reviewed",
  "approved",
  "scheduled",
  "published",
  "archived",
  "rejected",
  "superseded",
  "merged",
]);

export const overallVerificationStatusEnum = pgEnum("overall_verification_status", [
  "unverified",
  "partially_verified",
  "verified",
  "stale",
]);

export const intakeStatusEnum = pgEnum("intake_status", [
  "draft",
  "announced",
  "open-for-cycle",
  "started",
  "completed",
  "cancelled",
  "historical",
]);

export const fundingBenefitKindEnum = pgEnum("funding_benefit_kind", [
  "tuition",
  "stipend",
  "travel",
  "accommodation",
  "insurance",
  "research-costs",
  "application-fee",
  "other",
]);

export const fundingBenefitStatusEnum = pgEnum("funding_benefit_status", [
  "draft",
  "in-review",
  "verified",
  "published",
  "superseded",
  "withdrawn",
]);

// Deadlines --------------------------------------------------------------------

export const deadlinePrecisionEnum = pgEnum("deadline_precision", [
  "exact",
  "estimated",
  "rolling",
  "unknown",
  "program-specific",
  "institution-specific",
]);

export const deadlineVerificationStatusEnum = pgEnum("deadline_verification_status", [
  "verified",
  "unverified",
  "stale",
  "conflicting",
  "withdrawn",
  "archived",
  "estimated-from-previous-cycle",
]);

export const deadlineOccurrenceStatusEnum = pgEnum("deadline_occurrence_status", [
  "draft",
  "active",
  "withdrawn",
  "superseded",
  "archived",
]);

export const deadlineCycleStatusEnum = pgEnum("deadline_cycle_status", [
  "draft",
  "in-review",
  "announced",
  "active",
  "completed",
  "withdrawn",
  "historical",
]);

export const deadlineRecurrenceCadenceEnum = pgEnum("deadline_recurrence_cadence", [
  "none",
  "annual",
  "irregular",
  "unknown",
]);

export const deadlineRoleEnum = pgEnum("deadline_role", [
  "applicant-submission",
  "institutional-nomination",
  "embassy-nomination",
  "programme-round",
  "document-supplement",
  "other",
]);

export const deadlineScopeKindEnum = pgEnum("deadline_scope_kind", ["universal", "scoped"]);

// Official sources / verification -------------------------------------------------

export const officialSourceKindEnum = pgEnum("official_source_kind", [
  "opportunity-page",
  "provider-page",
  "official-guidance",
  "official-document",
  "official-announcement",
  "official-application-portal",
]);

export const officialSourceStatusEnum = pgEnum("official_source_status", [
  "candidate",
  "confirmed-official",
  "active",
  "changed",
  "unavailable",
  "superseded",
  "archived",
]);

export const verificationOutcomeEnum = pgEnum("verification_outcome", [
  "verified",
  "partially-verified",
  "conflicting",
  "changes-required",
  "unable-to-verify",
  "withdrawn",
]);

export const verificationRecordStatusEnum = pgEnum("verification_record_status", [
  "pending",
  "in-review",
  "verified",
  "rejected",
  "stale",
  "conflicting",
  "withdrawn",
  "superseded",
  "archived",
]);

export const verificationSubjectKindEnum = pgEnum("verification_subject_kind", [
  "opportunity",
  "provider",
  "deadline-occurrence",
  "deadline-cycle",
  "intake",
  "funding-benefit",
  "eligibility-rule",
  "document-requirement",
]);

export const sourceEvidenceKindEnum = pgEnum("source_evidence_kind", [
  "fact",
  "deadline",
  "eligibility",
  "funding",
  "document-requirement",
  "intake",
]);

export const sourceEvidenceStatusEnum = pgEnum("source_evidence_status", [
  "captured",
  "accepted",
  "superseded",
  "unavailable",
  "retention-expired",
  "redacted",
]);

// Required documents ---------------------------------------------------------------

export const documentCategoryEnum = pgEnum("document_category", [
  "identity-proof",
  "academic-record",
  "qualification",
  "language-test",
  "curriculum-vitae",
  "personal-statement",
  "research-proposal",
  "reference",
  "employment-record",
  "portfolio",
  "other",
]);

export const documentTemplateStatusEnum = pgEnum("document_template_status", [
  "draft",
  "active",
  "deprecated",
  "retired",
]);

export const documentRequirementLevelEnum = pgEnum("document_requirement_level", [
  "required",
  "conditionally-required",
  "optional",
]);

export const documentRequirementStatusEnum = pgEnum("document_requirement_status", [
  "draft",
  "in-review",
  "verified",
  "published",
  "superseded",
  "withdrawn",
]);

// Eligibility -----------------------------------------------------------------------

export const eligibilityRuleKindEnum = pgEnum("eligibility_rule_kind", [
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
]);

export const eligibilityOperatorEnum = pgEnum("eligibility_operator", [
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
]);

export const eligibilityRuleStatusEnum = pgEnum("eligibility_rule_status", [
  "draft",
  "in-review",
  "approved",
  "active",
  "superseded",
  "withdrawn",
]);

export const eligibilityGroupOperatorEnum = pgEnum("eligibility_group_operator", ["all", "any", "none"]);

// Review workflow ---------------------------------------------------------------------

export const reviewSubjectKindEnum = pgEnum("review_subject_kind", [
  "opportunity",
  "correction-report",
  "official-source",
  "verification-record",
]);

export const reviewAssignmentStatusEnum = pgEnum("review_assignment_status", [
  "queued",
  "assigned",
  "accepted",
  "in-review",
  "blocked",
  "completed",
  "reassigned",
  "cancelled",
  "expired",
]);

export const reviewDecisionEnum = pgEnum("review_decision", [
  "approved",
  "changes-requested",
  "rejected",
]);

// Corrections -----------------------------------------------------------------------------

export const correctionCategoryEnum = pgEnum("correction_category", [
  "incorrect-deadline",
  "broken-official-link",
  "incorrect-eligibility",
  "incorrect-funding-information",
  "missing-or-incorrect-document-requirement",
  "duplicate-record",
  "closed-programme",
  "other",
]);

export const correctionReportStatusEnum = pgEnum("correction_report_status", [
  "submitted",
  "triaged",
  "duplicate",
  "assigned",
  "investigating",
  "resolved",
  "rejected",
  "closed",
  "redacted",
]);

// Duplicates -------------------------------------------------------------------------------

export const duplicateCandidateStatusEnum = pgEnum("duplicate_candidate_status", [
  "pending",
  "confirmed-duplicate",
  "dismissed-false-positive",
  "merged",
]);

// Imports --------------------------------------------------------------------------------

export const importJobSourceKindEnum = pgEnum("import_job_source_kind", ["legacy-json-seed", "csv"]);

export const importJobStatusEnum = pgEnum("import_job_status", [
  "pending",
  "dry-run-completed",
  "running",
  "completed",
  "completed-with-errors",
  "failed",
  "rolled-back",
]);

export const importRowOutcomeEnum = pgEnum("import_row_outcome", [
  "would-create",
  "would-skip-duplicate",
  "would-reject",
  "created",
  "skipped-duplicate",
  "rejected",
]);

// Audit -----------------------------------------------------------------------------------

export const auditActionEnum = pgEnum("audit_action", [
  "create",
  "read-sensitive",
  "update",
  "submit-review",
  "request-changes",
  "approve",
  "reject",
  "publish",
  "unpublish",
  "archive",
  "restore",
  "assign",
  "merge",
  "export",
  "sign-in",
  "permission-change",
]);

export const auditLogStatusEnum = pgEnum("audit_log_status", [
  "active",
  "access-restricted",
  "retention-held",
  "anonymised",
  "expired",
]);
