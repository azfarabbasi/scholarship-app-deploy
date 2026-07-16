CREATE TYPE "public"."audit_action" AS ENUM('create', 'read-sensitive', 'update', 'submit-review', 'request-changes', 'approve', 'reject', 'publish', 'unpublish', 'archive', 'restore', 'assign', 'merge', 'export', 'sign-in', 'permission-change');--> statement-breakpoint
CREATE TYPE "public"."audit_log_status" AS ENUM('active', 'access-restricted', 'retention-held', 'anonymised', 'expired');--> statement-breakpoint
CREATE TYPE "public"."correction_category" AS ENUM('incorrect-deadline', 'broken-official-link', 'incorrect-eligibility', 'incorrect-funding-information', 'missing-or-incorrect-document-requirement', 'duplicate-record', 'closed-programme', 'other');--> statement-breakpoint
CREATE TYPE "public"."correction_report_status" AS ENUM('submitted', 'triaged', 'duplicate', 'assigned', 'investigating', 'resolved', 'rejected', 'closed', 'redacted');--> statement-breakpoint
CREATE TYPE "public"."country_status" AS ENUM('active', 'deprecated', 'historical');--> statement-breakpoint
CREATE TYPE "public"."deadline_cycle_status" AS ENUM('draft', 'in-review', 'announced', 'active', 'completed', 'withdrawn', 'historical');--> statement-breakpoint
CREATE TYPE "public"."deadline_occurrence_status" AS ENUM('draft', 'active', 'withdrawn', 'superseded', 'archived');--> statement-breakpoint
CREATE TYPE "public"."deadline_precision" AS ENUM('exact', 'estimated', 'rolling', 'unknown', 'program-specific', 'institution-specific');--> statement-breakpoint
CREATE TYPE "public"."deadline_recurrence_cadence" AS ENUM('none', 'annual', 'irregular', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."deadline_role" AS ENUM('applicant-submission', 'institutional-nomination', 'embassy-nomination', 'programme-round', 'document-supplement', 'other');--> statement-breakpoint
CREATE TYPE "public"."deadline_scope_kind" AS ENUM('universal', 'scoped');--> statement-breakpoint
CREATE TYPE "public"."deadline_verification_status" AS ENUM('verified', 'unverified', 'stale', 'conflicting', 'withdrawn', 'archived', 'estimated-from-previous-cycle');--> statement-breakpoint
CREATE TYPE "public"."document_category" AS ENUM('identity-proof', 'academic-record', 'qualification', 'language-test', 'curriculum-vitae', 'personal-statement', 'research-proposal', 'reference', 'employment-record', 'portfolio', 'other');--> statement-breakpoint
CREATE TYPE "public"."document_requirement_level" AS ENUM('required', 'conditionally-required', 'optional');--> statement-breakpoint
CREATE TYPE "public"."document_requirement_status" AS ENUM('draft', 'in-review', 'verified', 'published', 'superseded', 'withdrawn');--> statement-breakpoint
CREATE TYPE "public"."document_template_status" AS ENUM('draft', 'active', 'deprecated', 'retired');--> statement-breakpoint
CREATE TYPE "public"."duplicate_candidate_status" AS ENUM('pending', 'confirmed-duplicate', 'dismissed-false-positive', 'merged');--> statement-breakpoint
CREATE TYPE "public"."eligibility_group_operator" AS ENUM('all', 'any', 'none');--> statement-breakpoint
CREATE TYPE "public"."eligibility_operator" AS ENUM('equals', 'not-equals', 'in', 'not-in', 'greater-than', 'greater-than-or-equal', 'less-than', 'less-than-or-equal', 'exists', 'not-exists');--> statement-breakpoint
CREATE TYPE "public"."eligibility_rule_kind" AS ENUM('nationality', 'residence', 'study-level', 'field-of-study', 'academic-score', 'graduation-date', 'age', 'language-test', 'work-experience', 'research-experience', 'institution', 'programme', 'other');--> statement-breakpoint
CREATE TYPE "public"."eligibility_rule_status" AS ENUM('draft', 'in-review', 'approved', 'active', 'superseded', 'withdrawn');--> statement-breakpoint
CREATE TYPE "public"."field_of_study_status" AS ENUM('draft', 'active', 'deprecated', 'merged');--> statement-breakpoint
CREATE TYPE "public"."funding_benefit_kind" AS ENUM('tuition', 'stipend', 'travel', 'accommodation', 'insurance', 'research-costs', 'application-fee', 'other');--> statement-breakpoint
CREATE TYPE "public"."funding_benefit_status" AS ENUM('draft', 'in-review', 'verified', 'published', 'superseded', 'withdrawn');--> statement-breakpoint
CREATE TYPE "public"."funding_type_status" AS ENUM('draft', 'active', 'deprecated', 'retired');--> statement-breakpoint
CREATE TYPE "public"."import_job_source_kind" AS ENUM('legacy-json-seed', 'csv');--> statement-breakpoint
CREATE TYPE "public"."import_job_status" AS ENUM('pending', 'dry-run-completed', 'running', 'completed', 'completed-with-errors', 'failed', 'rolled-back');--> statement-breakpoint
CREATE TYPE "public"."import_row_outcome" AS ENUM('would-create', 'would-skip-duplicate', 'would-reject', 'created', 'skipped-duplicate', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."intake_status" AS ENUM('draft', 'announced', 'open-for-cycle', 'started', 'completed', 'cancelled', 'historical');--> statement-breakpoint
CREATE TYPE "public"."official_source_kind" AS ENUM('opportunity-page', 'provider-page', 'official-guidance', 'official-document', 'official-announcement', 'official-application-portal');--> statement-breakpoint
CREATE TYPE "public"."official_source_status" AS ENUM('candidate', 'confirmed-official', 'active', 'changed', 'unavailable', 'superseded', 'archived');--> statement-breakpoint
CREATE TYPE "public"."opportunity_status" AS ENUM('draft', 'in_review', 'changes_requested', 'reviewed', 'approved', 'scheduled', 'published', 'archived', 'rejected', 'superseded', 'merged');--> statement-breakpoint
CREATE TYPE "public"."opportunity_type_code" AS ENUM('scholarship', 'partial-scholarship', 'internship', 'fellowship', 'exchange', 'research-placement', 'grant', 'competition', 'conference', 'summer-school');--> statement-breakpoint
CREATE TYPE "public"."opportunity_type_status" AS ENUM('draft', 'active', 'deprecated', 'retired');--> statement-breakpoint
CREATE TYPE "public"."organisation_kind" AS ENUM('government', 'university', 'foundation', 'non-profit', 'company', 'multilateral-organisation', 'research-institute', 'other');--> statement-breakpoint
CREATE TYPE "public"."organisation_status" AS ENUM('draft', 'verified', 'active', 'inactive', 'merged');--> statement-breakpoint
CREATE TYPE "public"."overall_verification_status" AS ENUM('unverified', 'partially_verified', 'verified', 'stale');--> statement-breakpoint
CREATE TYPE "public"."provider_status" AS ENUM('draft', 'verified', 'active', 'inactive', 'superseded');--> statement-breakpoint
CREATE TYPE "public"."region_status" AS ENUM('draft', 'active', 'deprecated', 'historical');--> statement-breakpoint
CREATE TYPE "public"."review_assignment_status" AS ENUM('queued', 'assigned', 'accepted', 'in-review', 'blocked', 'completed', 'reassigned', 'cancelled', 'expired');--> statement-breakpoint
CREATE TYPE "public"."review_decision" AS ENUM('approved', 'changes-requested', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."review_subject_kind" AS ENUM('opportunity', 'correction-report', 'official-source', 'verification-record');--> statement-breakpoint
CREATE TYPE "public"."source_evidence_kind" AS ENUM('fact', 'deadline', 'eligibility', 'funding', 'document-requirement', 'intake');--> statement-breakpoint
CREATE TYPE "public"."source_evidence_status" AS ENUM('captured', 'accepted', 'superseded', 'unavailable', 'retention-expired', 'redacted');--> statement-breakpoint
CREATE TYPE "public"."staff_profile_status" AS ENUM('active', 'suspended');--> statement-breakpoint
CREATE TYPE "public"."staff_role" AS ENUM('reviewer', 'senior_reviewer', 'administrator', 'system_service');--> statement-breakpoint
CREATE TYPE "public"."study_level_status" AS ENUM('draft', 'active', 'deprecated', 'retired');--> statement-breakpoint
CREATE TYPE "public"."verification_outcome" AS ENUM('verified', 'partially-verified', 'conflicting', 'changes-required', 'unable-to-verify', 'withdrawn');--> statement-breakpoint
CREATE TYPE "public"."verification_record_status" AS ENUM('pending', 'in-review', 'verified', 'rejected', 'stale', 'conflicting', 'withdrawn', 'superseded', 'archived');--> statement-breakpoint
CREATE TYPE "public"."verification_subject_kind" AS ENUM('opportunity', 'provider', 'deadline-occurrence', 'deadline-cycle', 'intake', 'funding-benefit', 'eligibility-rule', 'document-requirement');--> statement-breakpoint
CREATE TABLE "staff_profiles" (
	"id" uuid PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"display_name" text NOT NULL,
	"status" "staff_profile_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "staff_profiles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "staff_role_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"staff_profile_id" uuid NOT NULL,
	"role" "staff_role" NOT NULL,
	"assigned_by_staff_profile_id" uuid,
	"assigned_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone,
	"revoked_by_staff_profile_id" uuid
);
--> statement-breakpoint
ALTER TABLE "staff_role_assignments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "countries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"iso_alpha2_code" text NOT NULL,
	"iso_alpha3_code" text NOT NULL,
	"name" text NOT NULL,
	"status" "country_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "countries" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "fields_of_study" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"label" text NOT NULL,
	"parent_field_of_study_id" uuid,
	"status" "field_of_study_status" DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "fields_of_study" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "funding_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"label" text NOT NULL,
	"description" text,
	"status" "funding_type_status" DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "funding_types" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "opportunity_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" "opportunity_type_code" NOT NULL,
	"label" text NOT NULL,
	"description" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"status" "opportunity_type_status" DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "opportunity_types" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "region_countries" (
	"region_id" uuid NOT NULL,
	"country_id" uuid NOT NULL,
	CONSTRAINT "region_countries_region_id_country_id_pk" PRIMARY KEY("region_id","country_id")
);
--> statement-breakpoint
ALTER TABLE "region_countries" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "regions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"parent_region_id" uuid,
	"status" "region_status" DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "regions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "required_document_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"label" text NOT NULL,
	"description" text,
	"category" "document_category" NOT NULL,
	"may_expire" boolean DEFAULT false NOT NULL,
	"status" "document_template_status" DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "required_document_templates" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "study_levels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"label" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"status" "study_level_status" DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "study_levels" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "organisations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"legal_name" text NOT NULL,
	"display_name" text NOT NULL,
	"kind" "organisation_kind" NOT NULL,
	"website_url" text,
	"headquarters_country_id" uuid,
	"status" "organisation_status" DEFAULT 'draft' NOT NULL,
	"merged_into_organisation_id" uuid,
	"created_by_staff_profile_id" uuid,
	"updated_by_staff_profile_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "organisations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "providers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organisation_id" uuid NOT NULL,
	"display_name" text NOT NULL,
	"short_name" text,
	"description" text,
	"official_website_url" text,
	"country_id" uuid,
	"status" "provider_status" DEFAULT 'draft' NOT NULL,
	"superseded_by_provider_id" uuid,
	"created_by_staff_profile_id" uuid,
	"updated_by_staff_profile_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "providers" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "opportunities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"summary" text NOT NULL,
	"description" text,
	"opportunity_type_id" uuid NOT NULL,
	"provider_id" uuid NOT NULL,
	"language_code" text DEFAULT 'en' NOT NULL,
	"application_url" text,
	"official_website_url" text,
	"status" "opportunity_status" DEFAULT 'draft' NOT NULL,
	"overall_verification_status" "overall_verification_status" DEFAULT 'unverified' NOT NULL,
	"current_approved_version_id" uuid,
	"merged_into_opportunity_id" uuid,
	"legacy_migration_reference" text,
	"published_at" timestamp with time zone,
	"archived_at" timestamp with time zone,
	"created_by_staff_profile_id" uuid,
	"updated_by_staff_profile_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "opportunities_published_requires_version_and_timestamp" CHECK ("opportunities"."status" <> 'published' OR ("opportunities"."published_at" IS NOT NULL AND "opportunities"."current_approved_version_id" IS NOT NULL)),
	CONSTRAINT "opportunities_archived_requires_timestamp" CHECK ("opportunities"."status" <> 'archived' OR "opportunities"."archived_at" IS NOT NULL),
	CONSTRAINT "opportunities_merged_requires_target" CHECK ("opportunities"."status" <> 'merged' OR "opportunities"."merged_into_opportunity_id" IS NOT NULL)
);
--> statement-breakpoint
ALTER TABLE "opportunities" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "opportunity_countries" (
	"opportunity_id" uuid NOT NULL,
	"country_id" uuid NOT NULL,
	CONSTRAINT "opportunity_countries_opportunity_id_country_id_pk" PRIMARY KEY("opportunity_id","country_id")
);
--> statement-breakpoint
ALTER TABLE "opportunity_countries" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "opportunity_fields_of_study" (
	"opportunity_id" uuid NOT NULL,
	"field_of_study_id" uuid NOT NULL,
	CONSTRAINT "opportunity_fields_of_study_opportunity_id_field_of_study_id_pk" PRIMARY KEY("opportunity_id","field_of_study_id")
);
--> statement-breakpoint
ALTER TABLE "opportunity_fields_of_study" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "opportunity_funding_types" (
	"opportunity_id" uuid NOT NULL,
	"funding_type_id" uuid NOT NULL,
	CONSTRAINT "opportunity_funding_types_opportunity_id_funding_type_id_pk" PRIMARY KEY("opportunity_id","funding_type_id")
);
--> statement-breakpoint
ALTER TABLE "opportunity_funding_types" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "opportunity_regions" (
	"opportunity_id" uuid NOT NULL,
	"region_id" uuid NOT NULL,
	CONSTRAINT "opportunity_regions_opportunity_id_region_id_pk" PRIMARY KEY("opportunity_id","region_id")
);
--> statement-breakpoint
ALTER TABLE "opportunity_regions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "opportunity_slug_redirects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"old_slug" text NOT NULL,
	"canonical_opportunity_id" uuid NOT NULL,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "opportunity_slug_redirects" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "opportunity_study_levels" (
	"opportunity_id" uuid NOT NULL,
	"study_level_id" uuid NOT NULL,
	CONSTRAINT "opportunity_study_levels_opportunity_id_study_level_id_pk" PRIMARY KEY("opportunity_id","study_level_id")
);
--> statement-breakpoint
ALTER TABLE "opportunity_study_levels" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "opportunity_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"opportunity_id" uuid NOT NULL,
	"version_number" integer NOT NULL,
	"snapshot" jsonb NOT NULL,
	"change_reason" text,
	"author_staff_profile_id" uuid NOT NULL,
	"previous_version_id" uuid,
	"review_outcome" text,
	"publication_outcome" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "opportunity_versions_number_positive" CHECK ("opportunity_versions"."version_number" > 0)
);
--> statement-breakpoint
ALTER TABLE "opportunity_versions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "funding_benefits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"opportunity_id" uuid NOT NULL,
	"funding_type_id" uuid NOT NULL,
	"kind" "funding_benefit_kind" NOT NULL,
	"summary" text NOT NULL,
	"amount" numeric(12, 2),
	"currency_code" char(3),
	"frequency" text,
	"conditions" text,
	"source_evidence_id" uuid,
	"status" "funding_benefit_status" DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "funding_benefits" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "deadline_cycle_target_intakes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"deadline_cycle_id" uuid NOT NULL,
	"intake_id" uuid NOT NULL,
	"intake_label_snapshot" text NOT NULL,
	"program_start_date_snapshot" date
);
--> statement-breakpoint
ALTER TABLE "deadline_cycle_target_intakes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "deadline_cycles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"opportunity_id" uuid NOT NULL,
	"cycle_label" text,
	"cycle_year" integer,
	"application_cycle_starts_on" date,
	"application_cycle_ends_on" date,
	"recurrence_cadence" "deadline_recurrence_cadence" DEFAULT 'unknown' NOT NULL,
	"recurrence_interval_years" integer,
	"recurrence_documented_by_source" boolean DEFAULT false NOT NULL,
	"recurrence_source_text" text,
	"automatic_date_generation_allowed" boolean DEFAULT false NOT NULL,
	"status" "deadline_cycle_status" DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "deadline_cycles_no_automatic_generation" CHECK ("deadline_cycles"."automatic_date_generation_allowed" = false)
);
--> statement-breakpoint
ALTER TABLE "deadline_cycles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "deadline_occurrence_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"deadline_occurrence_id" uuid NOT NULL,
	"changed_by_staff_profile_id" uuid,
	"change_reason" text,
	"previous_state" jsonb NOT NULL,
	"new_state" jsonb NOT NULL,
	"official_source_id" uuid,
	"changed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "deadline_occurrence_history" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "deadline_occurrences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"deadline_cycle_id" uuid NOT NULL,
	"role" "deadline_role" DEFAULT 'applicant-submission' NOT NULL,
	"role_label" text,
	"precision" "deadline_precision" NOT NULL,
	"opening_date" date,
	"opening_is_estimated" boolean,
	"closing_date" date,
	"closing_is_estimated" boolean,
	"scope_kind" "deadline_scope_kind" DEFAULT 'universal' NOT NULL,
	"scope_program_id" text,
	"scope_institution_id" text,
	"scope_country_code" text,
	"scope_residency_code" text,
	"scope_applicant_category_code" text,
	"scope_round_label" text,
	"raw_text" text NOT NULL,
	"source_timezone" text,
	"verification_status" "deadline_verification_status" DEFAULT 'unverified' NOT NULL,
	"supersedes_occurrence_id" uuid,
	"status" "deadline_occurrence_status" DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "deadline_occurrences_no_fabricated_dates" CHECK (("deadline_occurrences"."precision" NOT IN ('rolling', 'unknown')) OR ("deadline_occurrences"."opening_date" IS NULL AND "deadline_occurrences"."closing_date" IS NULL)),
	CONSTRAINT "deadline_occurrences_exact_requires_date" CHECK (("deadline_occurrences"."precision" <> 'exact') OR ("deadline_occurrences"."opening_date" IS NOT NULL OR "deadline_occurrences"."closing_date" IS NOT NULL))
);
--> statement-breakpoint
ALTER TABLE "deadline_occurrences" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "intakes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"opportunity_id" uuid NOT NULL,
	"label" text NOT NULL,
	"academic_year" text,
	"start_date" date,
	"end_date" date,
	"status" "intake_status" DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "intakes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "official_sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"url" text NOT NULL,
	"kind" "official_source_kind" NOT NULL,
	"label" text NOT NULL,
	"publisher_organisation_id" uuid,
	"publisher_provider_id" uuid,
	"source_organisation_name" text NOT NULL,
	"source_language_code" text,
	"status" "official_source_status" DEFAULT 'candidate' NOT NULL,
	"last_checked_at" timestamp with time zone,
	"last_successful_access_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "official_sources_single_publisher" CHECK (NOT ("official_sources"."publisher_organisation_id" IS NOT NULL AND "official_sources"."publisher_provider_id" IS NOT NULL)),
	CONSTRAINT "official_sources_confirmed_requires_checked_at" CHECK ("official_sources"."status" = 'candidate' OR "official_sources"."last_checked_at" IS NOT NULL),
	CONSTRAINT "official_sources_confirmed_requires_publisher" CHECK ("official_sources"."status" = 'candidate' OR "official_sources"."publisher_organisation_id" IS NOT NULL OR "official_sources"."publisher_provider_id" IS NOT NULL)
);
--> statement-breakpoint
ALTER TABLE "official_sources" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "opportunity_official_sources" (
	"opportunity_id" uuid NOT NULL,
	"official_source_id" uuid NOT NULL,
	CONSTRAINT "opportunity_official_sources_opportunity_id_official_source_id_pk" PRIMARY KEY("opportunity_id","official_source_id")
);
--> statement-breakpoint
ALTER TABLE "opportunity_official_sources" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "source_evidence" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"opportunity_id" uuid NOT NULL,
	"official_source_id" uuid NOT NULL,
	"verification_record_id" uuid,
	"kind" "source_evidence_kind" NOT NULL,
	"status" "source_evidence_status" DEFAULT 'captured' NOT NULL,
	"source_locator" text,
	"evidence_text" text NOT NULL,
	"captured_at" timestamp with time zone DEFAULT now() NOT NULL,
	"captured_by_staff_profile_id" uuid NOT NULL,
	"superseded_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "source_evidence" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "verification_record_sources" (
	"verification_record_id" uuid NOT NULL,
	"official_source_id" uuid NOT NULL,
	CONSTRAINT "verification_record_sources_verification_record_id_official_source_id_pk" PRIMARY KEY("verification_record_id","official_source_id")
);
--> statement-breakpoint
ALTER TABLE "verification_record_sources" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "verification_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"subject_kind" "verification_subject_kind" NOT NULL,
	"subject_id" uuid NOT NULL,
	"opportunity_id" uuid,
	"deadline_occurrence_id" uuid,
	"reviewer_staff_profile_id" uuid NOT NULL,
	"approved_by_staff_profile_id" uuid,
	"review_assignment_id" uuid,
	"outcome" "verification_outcome" NOT NULL,
	"status" "verification_record_status" DEFAULT 'pending' NOT NULL,
	"deadline_verification_status" "deadline_verification_status",
	"checked_at" timestamp with time zone DEFAULT now() NOT NULL,
	"summary" text NOT NULL,
	"supersedes_verification_record_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "verification_records_no_self_approval" CHECK ("verification_records"."approved_by_staff_profile_id" IS NULL OR "verification_records"."approved_by_staff_profile_id" <> "verification_records"."reviewer_staff_profile_id")
);
--> statement-breakpoint
ALTER TABLE "verification_records" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "opportunity_document_requirements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"opportunity_id" uuid NOT NULL,
	"required_document_template_id" uuid NOT NULL,
	"requirement_level" "document_requirement_level" NOT NULL,
	"instructions" text,
	"condition_summary" text,
	"source_evidence_id" uuid NOT NULL,
	"status" "document_requirement_status" DEFAULT 'draft' NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"last_checked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "opportunity_document_requirements" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "eligibility_rule_groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"opportunity_id" uuid NOT NULL,
	"parent_group_id" uuid,
	"label" text NOT NULL,
	"operator" "eligibility_group_operator" NOT NULL,
	"source_evidence_id" uuid,
	"status" "eligibility_rule_status" DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "eligibility_rule_groups" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "eligibility_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"opportunity_id" uuid NOT NULL,
	"rule_group_id" uuid NOT NULL,
	"kind" "eligibility_rule_kind" NOT NULL,
	"field_key" text NOT NULL,
	"operator" "eligibility_operator" NOT NULL,
	"expected_value" jsonb,
	"unit" text,
	"explanation" text NOT NULL,
	"source_evidence_id" uuid NOT NULL,
	"status" "eligibility_rule_status" DEFAULT 'draft' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "eligibility_rules" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "review_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"subject_kind" "review_subject_kind" NOT NULL,
	"subject_id" uuid NOT NULL,
	"opportunity_id" uuid,
	"correction_report_id" uuid,
	"subject_version" integer,
	"subject_author_staff_profile_id" uuid,
	"reviewer_staff_profile_id" uuid NOT NULL,
	"assigned_by_staff_profile_id" uuid NOT NULL,
	"required_role" "staff_role" NOT NULL,
	"status" "review_assignment_status" DEFAULT 'queued' NOT NULL,
	"assigned_at" timestamp with time zone DEFAULT now() NOT NULL,
	"due_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"conflict_of_interest_declared_at" timestamp with time zone,
	"conflict_of_interest_details" text,
	"decision" text,
	"reviewer_notes" text
);
--> statement-breakpoint
ALTER TABLE "review_assignments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "correction_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"opportunity_id" uuid NOT NULL,
	"category" "correction_category" NOT NULL,
	"description" text NOT NULL,
	"suggested_official_source_url" text,
	"reporter_contact_email" text,
	"status" "correction_report_status" DEFAULT 'submitted' NOT NULL,
	"assigned_staff_profile_id" uuid,
	"resolution_summary" text,
	"resolved_by_staff_profile_id" uuid,
	"resolved_at" timestamp with time zone,
	"duplicate_of_correction_report_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "correction_reports" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "duplicate_candidates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"canonical_opportunity_id" uuid NOT NULL,
	"duplicate_opportunity_id" uuid NOT NULL,
	"detection_reason" text NOT NULL,
	"confidence_score" numeric(4, 3) NOT NULL,
	"status" "duplicate_candidate_status" DEFAULT 'pending' NOT NULL,
	"reviewed_by_staff_profile_id" uuid,
	"reviewed_at" timestamp with time zone,
	"resolution_notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "duplicate_candidates_not_self" CHECK ("duplicate_candidates"."canonical_opportunity_id" <> "duplicate_candidates"."duplicate_opportunity_id"),
	CONSTRAINT "duplicate_candidates_confidence_range" CHECK ("duplicate_candidates"."confidence_score" >= 0 AND "duplicate_candidates"."confidence_score" <= 1)
);
--> statement-breakpoint
ALTER TABLE "duplicate_candidates" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "import_job_rows" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"import_job_id" uuid NOT NULL,
	"row_number" integer NOT NULL,
	"legacy_reference" text,
	"outcome" "import_row_outcome" NOT NULL,
	"opportunity_id" uuid,
	"errors" jsonb
);
--> statement-breakpoint
ALTER TABLE "import_job_rows" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "import_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_kind" "import_job_source_kind" NOT NULL,
	"source_filename" text,
	"status" "import_job_status" DEFAULT 'pending' NOT NULL,
	"dry_run" boolean DEFAULT true NOT NULL,
	"total_rows" integer DEFAULT 0 NOT NULL,
	"accepted_rows" integer DEFAULT 0 NOT NULL,
	"rejected_rows" integer DEFAULT 0 NOT NULL,
	"duplicate_warnings" integer DEFAULT 0 NOT NULL,
	"validation_errors" jsonb,
	"actor_staff_profile_id" uuid,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"result_summary" jsonb
);
--> statement-breakpoint
ALTER TABLE "import_jobs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_staff_profile_id" uuid,
	"actor_role" "staff_role",
	"action" "audit_action" NOT NULL,
	"entity_name" text NOT NULL,
	"entity_id" uuid,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reason_code" text,
	"correlation_id" text,
	"changed_fields" jsonb,
	"redacted_change_summary" text,
	"retention_expires_at" timestamp with time zone,
	"status" "audit_log_status" DEFAULT 'active' NOT NULL
);
--> statement-breakpoint
ALTER TABLE "audit_log" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "staff_role_assignments" ADD CONSTRAINT "staff_role_assignments_staff_profile_id_staff_profiles_id_fk" FOREIGN KEY ("staff_profile_id") REFERENCES "public"."staff_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_role_assignments" ADD CONSTRAINT "staff_role_assignments_assigned_by_staff_profile_id_staff_profiles_id_fk" FOREIGN KEY ("assigned_by_staff_profile_id") REFERENCES "public"."staff_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_role_assignments" ADD CONSTRAINT "staff_role_assignments_revoked_by_staff_profile_id_staff_profiles_id_fk" FOREIGN KEY ("revoked_by_staff_profile_id") REFERENCES "public"."staff_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "region_countries" ADD CONSTRAINT "region_countries_region_id_regions_id_fk" FOREIGN KEY ("region_id") REFERENCES "public"."regions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "region_countries" ADD CONSTRAINT "region_countries_country_id_countries_id_fk" FOREIGN KEY ("country_id") REFERENCES "public"."countries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organisations" ADD CONSTRAINT "organisations_headquarters_country_id_countries_id_fk" FOREIGN KEY ("headquarters_country_id") REFERENCES "public"."countries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organisations" ADD CONSTRAINT "organisations_created_by_staff_profile_id_staff_profiles_id_fk" FOREIGN KEY ("created_by_staff_profile_id") REFERENCES "public"."staff_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organisations" ADD CONSTRAINT "organisations_updated_by_staff_profile_id_staff_profiles_id_fk" FOREIGN KEY ("updated_by_staff_profile_id") REFERENCES "public"."staff_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "providers" ADD CONSTRAINT "providers_organisation_id_organisations_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "providers" ADD CONSTRAINT "providers_country_id_countries_id_fk" FOREIGN KEY ("country_id") REFERENCES "public"."countries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "providers" ADD CONSTRAINT "providers_created_by_staff_profile_id_staff_profiles_id_fk" FOREIGN KEY ("created_by_staff_profile_id") REFERENCES "public"."staff_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "providers" ADD CONSTRAINT "providers_updated_by_staff_profile_id_staff_profiles_id_fk" FOREIGN KEY ("updated_by_staff_profile_id") REFERENCES "public"."staff_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_opportunity_type_id_opportunity_types_id_fk" FOREIGN KEY ("opportunity_type_id") REFERENCES "public"."opportunity_types"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_provider_id_providers_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."providers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_current_approved_version_id_opportunity_versions_id_fk" FOREIGN KEY ("current_approved_version_id") REFERENCES "public"."opportunity_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_created_by_staff_profile_id_staff_profiles_id_fk" FOREIGN KEY ("created_by_staff_profile_id") REFERENCES "public"."staff_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_updated_by_staff_profile_id_staff_profiles_id_fk" FOREIGN KEY ("updated_by_staff_profile_id") REFERENCES "public"."staff_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunity_countries" ADD CONSTRAINT "opportunity_countries_opportunity_id_opportunities_id_fk" FOREIGN KEY ("opportunity_id") REFERENCES "public"."opportunities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunity_countries" ADD CONSTRAINT "opportunity_countries_country_id_countries_id_fk" FOREIGN KEY ("country_id") REFERENCES "public"."countries"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunity_fields_of_study" ADD CONSTRAINT "opportunity_fields_of_study_opportunity_id_opportunities_id_fk" FOREIGN KEY ("opportunity_id") REFERENCES "public"."opportunities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunity_fields_of_study" ADD CONSTRAINT "opportunity_fields_of_study_field_of_study_id_fields_of_study_id_fk" FOREIGN KEY ("field_of_study_id") REFERENCES "public"."fields_of_study"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunity_funding_types" ADD CONSTRAINT "opportunity_funding_types_opportunity_id_opportunities_id_fk" FOREIGN KEY ("opportunity_id") REFERENCES "public"."opportunities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunity_funding_types" ADD CONSTRAINT "opportunity_funding_types_funding_type_id_funding_types_id_fk" FOREIGN KEY ("funding_type_id") REFERENCES "public"."funding_types"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunity_regions" ADD CONSTRAINT "opportunity_regions_opportunity_id_opportunities_id_fk" FOREIGN KEY ("opportunity_id") REFERENCES "public"."opportunities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunity_regions" ADD CONSTRAINT "opportunity_regions_region_id_regions_id_fk" FOREIGN KEY ("region_id") REFERENCES "public"."regions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunity_slug_redirects" ADD CONSTRAINT "opportunity_slug_redirects_canonical_opportunity_id_opportunities_id_fk" FOREIGN KEY ("canonical_opportunity_id") REFERENCES "public"."opportunities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunity_study_levels" ADD CONSTRAINT "opportunity_study_levels_opportunity_id_opportunities_id_fk" FOREIGN KEY ("opportunity_id") REFERENCES "public"."opportunities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunity_study_levels" ADD CONSTRAINT "opportunity_study_levels_study_level_id_study_levels_id_fk" FOREIGN KEY ("study_level_id") REFERENCES "public"."study_levels"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunity_versions" ADD CONSTRAINT "opportunity_versions_opportunity_id_opportunities_id_fk" FOREIGN KEY ("opportunity_id") REFERENCES "public"."opportunities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunity_versions" ADD CONSTRAINT "opportunity_versions_author_staff_profile_id_staff_profiles_id_fk" FOREIGN KEY ("author_staff_profile_id") REFERENCES "public"."staff_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "funding_benefits" ADD CONSTRAINT "funding_benefits_opportunity_id_opportunities_id_fk" FOREIGN KEY ("opportunity_id") REFERENCES "public"."opportunities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "funding_benefits" ADD CONSTRAINT "funding_benefits_funding_type_id_funding_types_id_fk" FOREIGN KEY ("funding_type_id") REFERENCES "public"."funding_types"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "funding_benefits" ADD CONSTRAINT "funding_benefits_source_evidence_id_source_evidence_id_fk" FOREIGN KEY ("source_evidence_id") REFERENCES "public"."source_evidence"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deadline_cycle_target_intakes" ADD CONSTRAINT "deadline_cycle_target_intakes_deadline_cycle_id_deadline_cycles_id_fk" FOREIGN KEY ("deadline_cycle_id") REFERENCES "public"."deadline_cycles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deadline_cycle_target_intakes" ADD CONSTRAINT "deadline_cycle_target_intakes_intake_id_intakes_id_fk" FOREIGN KEY ("intake_id") REFERENCES "public"."intakes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deadline_cycles" ADD CONSTRAINT "deadline_cycles_opportunity_id_opportunities_id_fk" FOREIGN KEY ("opportunity_id") REFERENCES "public"."opportunities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deadline_occurrence_history" ADD CONSTRAINT "deadline_occurrence_history_deadline_occurrence_id_deadline_occurrences_id_fk" FOREIGN KEY ("deadline_occurrence_id") REFERENCES "public"."deadline_occurrences"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deadline_occurrence_history" ADD CONSTRAINT "deadline_occurrence_history_changed_by_staff_profile_id_staff_profiles_id_fk" FOREIGN KEY ("changed_by_staff_profile_id") REFERENCES "public"."staff_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deadline_occurrences" ADD CONSTRAINT "deadline_occurrences_deadline_cycle_id_deadline_cycles_id_fk" FOREIGN KEY ("deadline_cycle_id") REFERENCES "public"."deadline_cycles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "intakes" ADD CONSTRAINT "intakes_opportunity_id_opportunities_id_fk" FOREIGN KEY ("opportunity_id") REFERENCES "public"."opportunities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "official_sources" ADD CONSTRAINT "official_sources_publisher_organisation_id_organisations_id_fk" FOREIGN KEY ("publisher_organisation_id") REFERENCES "public"."organisations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "official_sources" ADD CONSTRAINT "official_sources_publisher_provider_id_providers_id_fk" FOREIGN KEY ("publisher_provider_id") REFERENCES "public"."providers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunity_official_sources" ADD CONSTRAINT "opportunity_official_sources_opportunity_id_opportunities_id_fk" FOREIGN KEY ("opportunity_id") REFERENCES "public"."opportunities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunity_official_sources" ADD CONSTRAINT "opportunity_official_sources_official_source_id_official_sources_id_fk" FOREIGN KEY ("official_source_id") REFERENCES "public"."official_sources"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_evidence" ADD CONSTRAINT "source_evidence_opportunity_id_opportunities_id_fk" FOREIGN KEY ("opportunity_id") REFERENCES "public"."opportunities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_evidence" ADD CONSTRAINT "source_evidence_official_source_id_official_sources_id_fk" FOREIGN KEY ("official_source_id") REFERENCES "public"."official_sources"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_evidence" ADD CONSTRAINT "source_evidence_verification_record_id_verification_records_id_fk" FOREIGN KEY ("verification_record_id") REFERENCES "public"."verification_records"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_evidence" ADD CONSTRAINT "source_evidence_captured_by_staff_profile_id_staff_profiles_id_fk" FOREIGN KEY ("captured_by_staff_profile_id") REFERENCES "public"."staff_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verification_record_sources" ADD CONSTRAINT "verification_record_sources_verification_record_id_verification_records_id_fk" FOREIGN KEY ("verification_record_id") REFERENCES "public"."verification_records"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verification_record_sources" ADD CONSTRAINT "verification_record_sources_official_source_id_official_sources_id_fk" FOREIGN KEY ("official_source_id") REFERENCES "public"."official_sources"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verification_records" ADD CONSTRAINT "verification_records_opportunity_id_opportunities_id_fk" FOREIGN KEY ("opportunity_id") REFERENCES "public"."opportunities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verification_records" ADD CONSTRAINT "verification_records_reviewer_staff_profile_id_staff_profiles_id_fk" FOREIGN KEY ("reviewer_staff_profile_id") REFERENCES "public"."staff_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verification_records" ADD CONSTRAINT "verification_records_approved_by_staff_profile_id_staff_profiles_id_fk" FOREIGN KEY ("approved_by_staff_profile_id") REFERENCES "public"."staff_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunity_document_requirements" ADD CONSTRAINT "opportunity_document_requirements_opportunity_id_opportunities_id_fk" FOREIGN KEY ("opportunity_id") REFERENCES "public"."opportunities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunity_document_requirements" ADD CONSTRAINT "opportunity_document_requirements_required_document_template_id_required_document_templates_id_fk" FOREIGN KEY ("required_document_template_id") REFERENCES "public"."required_document_templates"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunity_document_requirements" ADD CONSTRAINT "opportunity_document_requirements_source_evidence_id_source_evidence_id_fk" FOREIGN KEY ("source_evidence_id") REFERENCES "public"."source_evidence"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "eligibility_rule_groups" ADD CONSTRAINT "eligibility_rule_groups_opportunity_id_opportunities_id_fk" FOREIGN KEY ("opportunity_id") REFERENCES "public"."opportunities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "eligibility_rule_groups" ADD CONSTRAINT "eligibility_rule_groups_source_evidence_id_source_evidence_id_fk" FOREIGN KEY ("source_evidence_id") REFERENCES "public"."source_evidence"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "eligibility_rules" ADD CONSTRAINT "eligibility_rules_opportunity_id_opportunities_id_fk" FOREIGN KEY ("opportunity_id") REFERENCES "public"."opportunities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "eligibility_rules" ADD CONSTRAINT "eligibility_rules_rule_group_id_eligibility_rule_groups_id_fk" FOREIGN KEY ("rule_group_id") REFERENCES "public"."eligibility_rule_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "eligibility_rules" ADD CONSTRAINT "eligibility_rules_source_evidence_id_source_evidence_id_fk" FOREIGN KEY ("source_evidence_id") REFERENCES "public"."source_evidence"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_assignments" ADD CONSTRAINT "review_assignments_opportunity_id_opportunities_id_fk" FOREIGN KEY ("opportunity_id") REFERENCES "public"."opportunities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_assignments" ADD CONSTRAINT "review_assignments_subject_author_staff_profile_id_staff_profiles_id_fk" FOREIGN KEY ("subject_author_staff_profile_id") REFERENCES "public"."staff_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_assignments" ADD CONSTRAINT "review_assignments_reviewer_staff_profile_id_staff_profiles_id_fk" FOREIGN KEY ("reviewer_staff_profile_id") REFERENCES "public"."staff_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_assignments" ADD CONSTRAINT "review_assignments_assigned_by_staff_profile_id_staff_profiles_id_fk" FOREIGN KEY ("assigned_by_staff_profile_id") REFERENCES "public"."staff_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "correction_reports" ADD CONSTRAINT "correction_reports_opportunity_id_opportunities_id_fk" FOREIGN KEY ("opportunity_id") REFERENCES "public"."opportunities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "correction_reports" ADD CONSTRAINT "correction_reports_assigned_staff_profile_id_staff_profiles_id_fk" FOREIGN KEY ("assigned_staff_profile_id") REFERENCES "public"."staff_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "correction_reports" ADD CONSTRAINT "correction_reports_resolved_by_staff_profile_id_staff_profiles_id_fk" FOREIGN KEY ("resolved_by_staff_profile_id") REFERENCES "public"."staff_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "duplicate_candidates" ADD CONSTRAINT "duplicate_candidates_canonical_opportunity_id_opportunities_id_fk" FOREIGN KEY ("canonical_opportunity_id") REFERENCES "public"."opportunities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "duplicate_candidates" ADD CONSTRAINT "duplicate_candidates_duplicate_opportunity_id_opportunities_id_fk" FOREIGN KEY ("duplicate_opportunity_id") REFERENCES "public"."opportunities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "duplicate_candidates" ADD CONSTRAINT "duplicate_candidates_reviewed_by_staff_profile_id_staff_profiles_id_fk" FOREIGN KEY ("reviewed_by_staff_profile_id") REFERENCES "public"."staff_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_job_rows" ADD CONSTRAINT "import_job_rows_import_job_id_import_jobs_id_fk" FOREIGN KEY ("import_job_id") REFERENCES "public"."import_jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_job_rows" ADD CONSTRAINT "import_job_rows_opportunity_id_opportunities_id_fk" FOREIGN KEY ("opportunity_id") REFERENCES "public"."opportunities"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_jobs" ADD CONSTRAINT "import_jobs_actor_staff_profile_id_staff_profiles_id_fk" FOREIGN KEY ("actor_staff_profile_id") REFERENCES "public"."staff_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "staff_profiles_email_key" ON "staff_profiles" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "staff_role_assignments_active_unique" ON "staff_role_assignments" USING btree ("staff_profile_id","role") WHERE "staff_role_assignments"."revoked_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "countries_iso_alpha2_key" ON "countries" USING btree ("iso_alpha2_code");--> statement-breakpoint
CREATE UNIQUE INDEX "countries_iso_alpha3_key" ON "countries" USING btree ("iso_alpha3_code");--> statement-breakpoint
CREATE UNIQUE INDEX "fields_of_study_code_key" ON "fields_of_study" USING btree ("code");--> statement-breakpoint
CREATE UNIQUE INDEX "funding_types_code_key" ON "funding_types" USING btree ("code");--> statement-breakpoint
CREATE UNIQUE INDEX "opportunity_types_code_key" ON "opportunity_types" USING btree ("code");--> statement-breakpoint
CREATE UNIQUE INDEX "regions_code_key" ON "regions" USING btree ("code");--> statement-breakpoint
CREATE UNIQUE INDEX "required_document_templates_code_key" ON "required_document_templates" USING btree ("code");--> statement-breakpoint
CREATE UNIQUE INDEX "study_levels_code_key" ON "study_levels" USING btree ("code");--> statement-breakpoint
CREATE UNIQUE INDEX "organisations_legal_name_key" ON "organisations" USING btree ("legal_name");--> statement-breakpoint
CREATE UNIQUE INDEX "providers_display_name_key" ON "providers" USING btree ("display_name");--> statement-breakpoint
CREATE UNIQUE INDEX "opportunities_slug_key" ON "opportunities" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "opportunities_legacy_migration_reference_key" ON "opportunities" USING btree ("legacy_migration_reference") WHERE "opportunities"."legacy_migration_reference" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "opportunity_slug_redirects_old_slug_key" ON "opportunity_slug_redirects" USING btree ("old_slug");--> statement-breakpoint
CREATE UNIQUE INDEX "opportunity_versions_opportunity_version_key" ON "opportunity_versions" USING btree ("opportunity_id","version_number");--> statement-breakpoint
CREATE UNIQUE INDEX "deadline_cycle_target_intakes_unique" ON "deadline_cycle_target_intakes" USING btree ("deadline_cycle_id","intake_id");--> statement-breakpoint
CREATE POLICY "staff_profiles_select_staff" ON "staff_profiles" AS PERMISSIVE FOR SELECT TO "authenticated" USING (app.is_staff(auth.uid(), NULL));--> statement-breakpoint
CREATE POLICY "staff_profiles_service_role_all" ON "staff_profiles" AS PERMISSIVE FOR ALL TO "service_role" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "staff_role_assignments_select_staff" ON "staff_role_assignments" AS PERMISSIVE FOR SELECT TO "authenticated" USING (app.is_staff(auth.uid(), NULL));--> statement-breakpoint
CREATE POLICY "staff_role_assignments_service_role_all" ON "staff_role_assignments" AS PERMISSIVE FOR ALL TO "service_role" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "countries_select_public" ON "countries" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING ("countries"."status" = 'active');--> statement-breakpoint
CREATE POLICY "countries_select_staff" ON "countries" AS PERMISSIVE FOR SELECT TO "authenticated" USING (app.is_staff(auth.uid(), NULL));--> statement-breakpoint
CREATE POLICY "countries_service_role_all" ON "countries" AS PERMISSIVE FOR ALL TO "service_role" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "fields_of_study_select_public" ON "fields_of_study" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING ("fields_of_study"."status" = 'active');--> statement-breakpoint
CREATE POLICY "fields_of_study_select_staff" ON "fields_of_study" AS PERMISSIVE FOR SELECT TO "authenticated" USING (app.is_staff(auth.uid(), NULL));--> statement-breakpoint
CREATE POLICY "fields_of_study_service_role_all" ON "fields_of_study" AS PERMISSIVE FOR ALL TO "service_role" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "funding_types_select_public" ON "funding_types" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING ("funding_types"."status" = 'active');--> statement-breakpoint
CREATE POLICY "funding_types_select_staff" ON "funding_types" AS PERMISSIVE FOR SELECT TO "authenticated" USING (app.is_staff(auth.uid(), NULL));--> statement-breakpoint
CREATE POLICY "funding_types_service_role_all" ON "funding_types" AS PERMISSIVE FOR ALL TO "service_role" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "opportunity_types_select_public" ON "opportunity_types" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING ("opportunity_types"."status" = 'active');--> statement-breakpoint
CREATE POLICY "opportunity_types_select_staff" ON "opportunity_types" AS PERMISSIVE FOR SELECT TO "authenticated" USING (app.is_staff(auth.uid(), NULL));--> statement-breakpoint
CREATE POLICY "opportunity_types_service_role_all" ON "opportunity_types" AS PERMISSIVE FOR ALL TO "service_role" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "region_countries_select_public" ON "region_countries" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "region_countries_select_staff" ON "region_countries" AS PERMISSIVE FOR SELECT TO "authenticated" USING (app.is_staff(auth.uid(), NULL));--> statement-breakpoint
CREATE POLICY "region_countries_service_role_all" ON "region_countries" AS PERMISSIVE FOR ALL TO "service_role" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "regions_select_public" ON "regions" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING ("regions"."status" = 'active');--> statement-breakpoint
CREATE POLICY "regions_select_staff" ON "regions" AS PERMISSIVE FOR SELECT TO "authenticated" USING (app.is_staff(auth.uid(), NULL));--> statement-breakpoint
CREATE POLICY "regions_service_role_all" ON "regions" AS PERMISSIVE FOR ALL TO "service_role" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "required_document_templates_select_public" ON "required_document_templates" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING ("required_document_templates"."status" = 'active');--> statement-breakpoint
CREATE POLICY "required_document_templates_select_staff" ON "required_document_templates" AS PERMISSIVE FOR SELECT TO "authenticated" USING (app.is_staff(auth.uid(), NULL));--> statement-breakpoint
CREATE POLICY "required_document_templates_service_role_all" ON "required_document_templates" AS PERMISSIVE FOR ALL TO "service_role" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "study_levels_select_public" ON "study_levels" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING ("study_levels"."status" = 'active');--> statement-breakpoint
CREATE POLICY "study_levels_select_staff" ON "study_levels" AS PERMISSIVE FOR SELECT TO "authenticated" USING (app.is_staff(auth.uid(), NULL));--> statement-breakpoint
CREATE POLICY "study_levels_service_role_all" ON "study_levels" AS PERMISSIVE FOR ALL TO "service_role" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "organisations_select_public" ON "organisations" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING (status IN ('verified', 'active'));--> statement-breakpoint
CREATE POLICY "organisations_select_staff" ON "organisations" AS PERMISSIVE FOR SELECT TO "authenticated" USING (app.is_staff(auth.uid(), NULL));--> statement-breakpoint
CREATE POLICY "organisations_service_role_all" ON "organisations" AS PERMISSIVE FOR ALL TO "service_role" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "providers_select_public" ON "providers" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING ("providers"."status" IN ('verified', 'active'));--> statement-breakpoint
CREATE POLICY "providers_select_staff" ON "providers" AS PERMISSIVE FOR SELECT TO "authenticated" USING (app.is_staff(auth.uid(), NULL));--> statement-breakpoint
CREATE POLICY "providers_service_role_all" ON "providers" AS PERMISSIVE FOR ALL TO "service_role" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "opportunities_select_public" ON "opportunities" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING (status = 'published');--> statement-breakpoint
CREATE POLICY "opportunities_select_staff" ON "opportunities" AS PERMISSIVE FOR SELECT TO "authenticated" USING (app.is_staff(auth.uid(), NULL));--> statement-breakpoint
CREATE POLICY "opportunities_service_role_all" ON "opportunities" AS PERMISSIVE FOR ALL TO "service_role" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "opportunity_countries_select_public" ON "opportunity_countries" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING (EXISTS (SELECT 1 FROM opportunities o WHERE o.id = "opportunity_countries"."opportunity_id" AND o.status = 'published'));--> statement-breakpoint
CREATE POLICY "opportunity_countries_select_staff" ON "opportunity_countries" AS PERMISSIVE FOR SELECT TO "authenticated" USING (app.is_staff(auth.uid(), NULL));--> statement-breakpoint
CREATE POLICY "opportunity_countries_service_role_all" ON "opportunity_countries" AS PERMISSIVE FOR ALL TO "service_role" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "opportunity_fields_of_study_select_public" ON "opportunity_fields_of_study" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING (EXISTS (SELECT 1 FROM opportunities o WHERE o.id = "opportunity_fields_of_study"."opportunity_id" AND o.status = 'published'));--> statement-breakpoint
CREATE POLICY "opportunity_fields_of_study_select_staff" ON "opportunity_fields_of_study" AS PERMISSIVE FOR SELECT TO "authenticated" USING (app.is_staff(auth.uid(), NULL));--> statement-breakpoint
CREATE POLICY "opportunity_fields_of_study_service_role_all" ON "opportunity_fields_of_study" AS PERMISSIVE FOR ALL TO "service_role" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "opportunity_funding_types_select_public" ON "opportunity_funding_types" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING (EXISTS (SELECT 1 FROM opportunities o WHERE o.id = "opportunity_funding_types"."opportunity_id" AND o.status = 'published'));--> statement-breakpoint
CREATE POLICY "opportunity_funding_types_select_staff" ON "opportunity_funding_types" AS PERMISSIVE FOR SELECT TO "authenticated" USING (app.is_staff(auth.uid(), NULL));--> statement-breakpoint
CREATE POLICY "opportunity_funding_types_service_role_all" ON "opportunity_funding_types" AS PERMISSIVE FOR ALL TO "service_role" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "opportunity_regions_select_public" ON "opportunity_regions" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING (EXISTS (SELECT 1 FROM opportunities o WHERE o.id = "opportunity_regions"."opportunity_id" AND o.status = 'published'));--> statement-breakpoint
CREATE POLICY "opportunity_regions_select_staff" ON "opportunity_regions" AS PERMISSIVE FOR SELECT TO "authenticated" USING (app.is_staff(auth.uid(), NULL));--> statement-breakpoint
CREATE POLICY "opportunity_regions_service_role_all" ON "opportunity_regions" AS PERMISSIVE FOR ALL TO "service_role" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "opportunity_slug_redirects_select_public" ON "opportunity_slug_redirects" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "opportunity_slug_redirects_select_staff" ON "opportunity_slug_redirects" AS PERMISSIVE FOR SELECT TO "authenticated" USING (app.is_staff(auth.uid(), NULL));--> statement-breakpoint
CREATE POLICY "opportunity_slug_redirects_service_role_all" ON "opportunity_slug_redirects" AS PERMISSIVE FOR ALL TO "service_role" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "opportunity_study_levels_select_public" ON "opportunity_study_levels" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING (EXISTS (SELECT 1 FROM opportunities o WHERE o.id = "opportunity_study_levels"."opportunity_id" AND o.status = 'published'));--> statement-breakpoint
CREATE POLICY "opportunity_study_levels_select_staff" ON "opportunity_study_levels" AS PERMISSIVE FOR SELECT TO "authenticated" USING (app.is_staff(auth.uid(), NULL));--> statement-breakpoint
CREATE POLICY "opportunity_study_levels_service_role_all" ON "opportunity_study_levels" AS PERMISSIVE FOR ALL TO "service_role" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "opportunity_versions_select_staff" ON "opportunity_versions" AS PERMISSIVE FOR SELECT TO "authenticated" USING (app.is_staff(auth.uid(), NULL));--> statement-breakpoint
CREATE POLICY "opportunity_versions_service_role_all" ON "opportunity_versions" AS PERMISSIVE FOR ALL TO "service_role" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "funding_benefits_select_public" ON "funding_benefits" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING ("funding_benefits"."status" = 'published' AND EXISTS (SELECT 1 FROM opportunities o WHERE o.id = "funding_benefits"."opportunity_id" AND o.status = 'published'));--> statement-breakpoint
CREATE POLICY "funding_benefits_select_staff" ON "funding_benefits" AS PERMISSIVE FOR SELECT TO "authenticated" USING (app.is_staff(auth.uid(), NULL));--> statement-breakpoint
CREATE POLICY "funding_benefits_service_role_all" ON "funding_benefits" AS PERMISSIVE FOR ALL TO "service_role" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "deadline_cycle_target_intakes_select_staff" ON "deadline_cycle_target_intakes" AS PERMISSIVE FOR SELECT TO "authenticated" USING (app.is_staff(auth.uid(), NULL));--> statement-breakpoint
CREATE POLICY "deadline_cycle_target_intakes_service_role_all" ON "deadline_cycle_target_intakes" AS PERMISSIVE FOR ALL TO "service_role" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "deadline_cycle_target_intakes_select_public" ON "deadline_cycle_target_intakes" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING (EXISTS (SELECT 1 FROM deadline_cycles dc JOIN opportunities o ON o.id = dc.opportunity_id WHERE dc.id = "deadline_cycle_target_intakes"."deadline_cycle_id" AND o.status = 'published'));--> statement-breakpoint
CREATE POLICY "deadline_cycles_select_public" ON "deadline_cycles" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING (EXISTS (SELECT 1 FROM opportunities o WHERE o.id = "deadline_cycles"."opportunity_id" AND o.status = 'published'));--> statement-breakpoint
CREATE POLICY "deadline_cycles_select_staff" ON "deadline_cycles" AS PERMISSIVE FOR SELECT TO "authenticated" USING (app.is_staff(auth.uid(), NULL));--> statement-breakpoint
CREATE POLICY "deadline_cycles_service_role_all" ON "deadline_cycles" AS PERMISSIVE FOR ALL TO "service_role" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "deadline_occurrence_history_select_staff" ON "deadline_occurrence_history" AS PERMISSIVE FOR SELECT TO "authenticated" USING (app.is_staff(auth.uid(), NULL));--> statement-breakpoint
CREATE POLICY "deadline_occurrence_history_service_role_all" ON "deadline_occurrence_history" AS PERMISSIVE FOR ALL TO "service_role" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "deadline_occurrences_select_public" ON "deadline_occurrences" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING (EXISTS (SELECT 1 FROM deadline_cycles dc JOIN opportunities o ON o.id = dc.opportunity_id WHERE dc.id = "deadline_occurrences"."deadline_cycle_id" AND o.status = 'published'));--> statement-breakpoint
CREATE POLICY "deadline_occurrences_select_staff" ON "deadline_occurrences" AS PERMISSIVE FOR SELECT TO "authenticated" USING (app.is_staff(auth.uid(), NULL));--> statement-breakpoint
CREATE POLICY "deadline_occurrences_service_role_all" ON "deadline_occurrences" AS PERMISSIVE FOR ALL TO "service_role" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "intakes_select_public" ON "intakes" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING (EXISTS (SELECT 1 FROM opportunities o WHERE o.id = "intakes"."opportunity_id" AND o.status = 'published'));--> statement-breakpoint
CREATE POLICY "intakes_select_staff" ON "intakes" AS PERMISSIVE FOR SELECT TO "authenticated" USING (app.is_staff(auth.uid(), NULL));--> statement-breakpoint
CREATE POLICY "intakes_service_role_all" ON "intakes" AS PERMISSIVE FOR ALL TO "service_role" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "official_sources_select_public" ON "official_sources" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING ("official_sources"."status" NOT IN ('candidate', 'archived'));--> statement-breakpoint
CREATE POLICY "official_sources_select_staff" ON "official_sources" AS PERMISSIVE FOR SELECT TO "authenticated" USING (app.is_staff(auth.uid(), NULL));--> statement-breakpoint
CREATE POLICY "official_sources_service_role_all" ON "official_sources" AS PERMISSIVE FOR ALL TO "service_role" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "opportunity_official_sources_select_public" ON "opportunity_official_sources" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING (EXISTS (SELECT 1 FROM opportunities o WHERE o.id = "opportunity_official_sources"."opportunity_id" AND o.status = 'published'));--> statement-breakpoint
CREATE POLICY "opportunity_official_sources_select_staff" ON "opportunity_official_sources" AS PERMISSIVE FOR SELECT TO "authenticated" USING (app.is_staff(auth.uid(), NULL));--> statement-breakpoint
CREATE POLICY "opportunity_official_sources_service_role_all" ON "opportunity_official_sources" AS PERMISSIVE FOR ALL TO "service_role" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "source_evidence_select_staff" ON "source_evidence" AS PERMISSIVE FOR SELECT TO "authenticated" USING (app.is_staff(auth.uid(), NULL));--> statement-breakpoint
CREATE POLICY "source_evidence_service_role_all" ON "source_evidence" AS PERMISSIVE FOR ALL TO "service_role" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "verification_record_sources_select_staff" ON "verification_record_sources" AS PERMISSIVE FOR SELECT TO "authenticated" USING (app.is_staff(auth.uid(), NULL));--> statement-breakpoint
CREATE POLICY "verification_record_sources_service_role_all" ON "verification_record_sources" AS PERMISSIVE FOR ALL TO "service_role" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "verification_records_select_staff" ON "verification_records" AS PERMISSIVE FOR SELECT TO "authenticated" USING (app.is_staff(auth.uid(), NULL));--> statement-breakpoint
CREATE POLICY "verification_records_service_role_all" ON "verification_records" AS PERMISSIVE FOR ALL TO "service_role" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "opportunity_document_requirements_select_public" ON "opportunity_document_requirements" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING ("opportunity_document_requirements"."status" = 'published' AND EXISTS (SELECT 1 FROM opportunities o WHERE o.id = "opportunity_document_requirements"."opportunity_id" AND o.status = 'published'));--> statement-breakpoint
CREATE POLICY "opportunity_document_requirements_select_staff" ON "opportunity_document_requirements" AS PERMISSIVE FOR SELECT TO "authenticated" USING (app.is_staff(auth.uid(), NULL));--> statement-breakpoint
CREATE POLICY "opportunity_document_requirements_service_role_all" ON "opportunity_document_requirements" AS PERMISSIVE FOR ALL TO "service_role" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "eligibility_rule_groups_select_public" ON "eligibility_rule_groups" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING ("eligibility_rule_groups"."status" = 'active' AND EXISTS (SELECT 1 FROM opportunities o WHERE o.id = "eligibility_rule_groups"."opportunity_id" AND o.status = 'published'));--> statement-breakpoint
CREATE POLICY "eligibility_rule_groups_select_staff" ON "eligibility_rule_groups" AS PERMISSIVE FOR SELECT TO "authenticated" USING (app.is_staff(auth.uid(), NULL));--> statement-breakpoint
CREATE POLICY "eligibility_rule_groups_service_role_all" ON "eligibility_rule_groups" AS PERMISSIVE FOR ALL TO "service_role" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "eligibility_rules_select_public" ON "eligibility_rules" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING ("eligibility_rules"."status" = 'active' AND EXISTS (SELECT 1 FROM opportunities o WHERE o.id = "eligibility_rules"."opportunity_id" AND o.status = 'published'));--> statement-breakpoint
CREATE POLICY "eligibility_rules_select_staff" ON "eligibility_rules" AS PERMISSIVE FOR SELECT TO "authenticated" USING (app.is_staff(auth.uid(), NULL));--> statement-breakpoint
CREATE POLICY "eligibility_rules_service_role_all" ON "eligibility_rules" AS PERMISSIVE FOR ALL TO "service_role" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "review_assignments_select_staff" ON "review_assignments" AS PERMISSIVE FOR SELECT TO "authenticated" USING (app.is_staff(auth.uid(), NULL));--> statement-breakpoint
CREATE POLICY "review_assignments_service_role_all" ON "review_assignments" AS PERMISSIVE FOR ALL TO "service_role" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "correction_reports_select_staff" ON "correction_reports" AS PERMISSIVE FOR SELECT TO "authenticated" USING (app.is_staff(auth.uid(), NULL));--> statement-breakpoint
CREATE POLICY "correction_reports_service_role_all" ON "correction_reports" AS PERMISSIVE FOR ALL TO "service_role" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "duplicate_candidates_select_staff" ON "duplicate_candidates" AS PERMISSIVE FOR SELECT TO "authenticated" USING (app.is_staff(auth.uid(), NULL));--> statement-breakpoint
CREATE POLICY "duplicate_candidates_service_role_all" ON "duplicate_candidates" AS PERMISSIVE FOR ALL TO "service_role" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "import_job_rows_select_staff" ON "import_job_rows" AS PERMISSIVE FOR SELECT TO "authenticated" USING (app.is_staff(auth.uid(), NULL));--> statement-breakpoint
CREATE POLICY "import_job_rows_service_role_all" ON "import_job_rows" AS PERMISSIVE FOR ALL TO "service_role" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "import_jobs_select_staff" ON "import_jobs" AS PERMISSIVE FOR SELECT TO "authenticated" USING (app.is_staff(auth.uid(), NULL));--> statement-breakpoint
CREATE POLICY "import_jobs_service_role_all" ON "import_jobs" AS PERMISSIVE FOR ALL TO "service_role" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "audit_log_select_staff" ON "audit_log" AS PERMISSIVE FOR SELECT TO "authenticated" USING (app.is_staff(auth.uid(), NULL));--> statement-breakpoint
CREATE POLICY "audit_log_service_role_all" ON "audit_log" AS PERMISSIVE FOR ALL TO "service_role" USING (true) WITH CHECK (true);