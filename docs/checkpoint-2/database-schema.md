# Checkpoint 2 database schema reference

Source of truth: `src/lib/db/schema/*.ts` (Drizzle). Migrations: `drizzle/*.sql`. All 40 tables
have RLS enabled (`ALTER TABLE ... ENABLE ROW LEVEL SECURITY`, generated from `.enableRLS()` in
the schema) — see `checkpoint-2-architecture.md` §4 for what RLS is and isn't doing here before
reading the per-table "RLS" notes below.

Every table's `id` is a server-generated UUID v4 (`uuid().defaultRandom()`), the collision-
resistant identifier strategy used throughout.

## Staff identity

### `staff_profiles`
One row per staff member, keyed by their Supabase Auth user id (no second identity).
- Columns: `id` (= `auth.users.id`, no cross-schema FK), `email`, `display_name`, `status`
  (`active`/`suspended`), `created_at`, `updated_at`.
- Constraints: unique `email`.
- RLS: any authenticated staff member may `SELECT` (needed for assignee names); no
  `anon`/`authenticated` write policy — created only by the bootstrap script or the Team page's
  invite flow, both privileged-connection operations.

### `staff_role_assignments`
- Columns: `staff_profile_id`, `role` (`reviewer`/`senior_reviewer`/`administrator`/
  `system_service`), `assigned_by_staff_profile_id`, `assigned_at`, `revoked_at`,
  `revoked_by_staff_profile_id`.
- Constraints: partial unique index on `(staff_profile_id, role)` **where `revoked_at IS NULL`**
  — a staff member can hold at most one *active* grant of a given role, but history is
  preserved via soft revocation, never deletion.
- Indexes: the partial unique index above.
- RLS: staff-readable; no direct writes.

## Organisations and providers

### `organisations`
- Columns: `legal_name`, `display_name` (unique), `kind` (government/university/foundation/
  non-profit/company/multilateral-organisation/research-institute/other), `website_url`,
  `headquarters_country_id`, `status` (draft/verified/active/inactive/merged),
  `merged_into_organisation_id`, `created_by_staff_profile_id`, `updated_by_staff_profile_id`,
  audit timestamps.
- RLS: public `SELECT` where `status IN ('verified', 'active')`; staff see all statuses.

### `providers`
- Columns: `organisation_id` (FK, restrict-on-delete), `display_name` (unique), `short_name`,
  `description`, `official_website_url`, `country_id`, `status`
  (draft/verified/active/inactive/superseded), `superseded_by_provider_id`, audit metadata.
- RLS: public `SELECT` where `status IN ('verified', 'active')`.

## Taxonomies (reference data)

`countries`, `regions` (+ `region_countries` join), `study_levels`, `fields_of_study`,
`funding_types`, `opportunity_types`, `required_document_templates` — each has `code` (unique),
a display `label`, and a `status` lifecycle (`draft`/`active`/`deprecated`/…, values vary by
entity to match `src/lib/domain/*.ts`). Public `SELECT` is gated to `status = 'active'`; staff
see everything. Seeded by `npm run db:seed:taxonomies` (idempotent, `onConflictDoNothing`).
`opportunity_types` is fixed to the 10 codes in `OPPORTUNITY_TYPES`
(`src/lib/domain/opportunity.ts`); the rest can be extended from the staff Taxonomies page.

## Opportunities

### `opportunities`
The central record.
- Columns: `slug` (unique), `title`, `summary`, `description`, `opportunity_type_id`,
  `provider_id`, `language_code` (default `en`), `application_url`, `official_website_url`,
  `status` (see workflow states below), `overall_verification_status`
  (unverified/partially_verified/verified/stale — denormalised for fast public filtering,
  deliberately never combined with deadline status in the UI), `current_approved_version_id`
  (circular FK to `opportunity_versions`, resolved via a lazy `AnyPgColumn` reference),
  `merged_into_opportunity_id`, `legacy_migration_reference` (unique where not null, e.g.
  `"legacy-id-14"`), `published_at`, `archived_at`, `created_by_staff_profile_id`,
  `updated_by_staff_profile_id`, audit timestamps.
- CHECK constraints: publishing requires both `published_at` and `current_approved_version_id`;
  archiving requires `archived_at`; `merged` status requires `merged_into_opportunity_id`.
- Trigger: `opportunities_enforce_publication_requirements` (BEFORE INSERT/UPDATE) blocks
  `status = 'published'` unless at least one row exists in `opportunity_official_sources` —
  this cross-table check cannot be a CHECK constraint, hence the trigger.
- Workflow statuses: `draft`, `in_review`, `changes_requested`, `reviewed`, `approved`,
  `scheduled`, `published`, `archived`, `rejected`, `superseded`, `merged` — see
  `staff-roles-and-workflows.md` for the full transition diagram.
- RLS: public `SELECT` where `status = 'published'`; staff see everything.

### `opportunity_versions`
Append-only revision history. One row per draft save and per review/publish outcome.
- Columns: `opportunity_id`, `version_number`, `snapshot` (jsonb), `change_reason`,
  `author_staff_profile_id`, `previous_version_id`, `review_outcome`, `publication_outcome`,
  `created_at`.
- Constraints: unique `(opportunity_id, version_number)`; `version_number > 0`.
- RLS: staff-only.

### `opportunity_slug_redirects`
- Columns: `old_slug` (unique), `canonical_opportunity_id`, `reason`, `created_at`.
- Written by the duplicate-merge action so an old public URL still resolves.
- RLS: public `SELECT` (redirects aren't sensitive).

### Taxonomy join tables
`opportunity_countries`, `opportunity_regions`, `opportunity_study_levels`,
`opportunity_fields_of_study`, `opportunity_funding_types` — composite-PK `(opportunity_id,
taxonomy_id)` pairs. Public `SELECT` requires the parent opportunity to be `published`.

### `funding_benefits`
One sourced benefit line (not a marketing paragraph).
- Columns: `opportunity_id`, `funding_type_id`, `kind` (tuition/stipend/travel/accommodation/
  insurance/research-costs/application-fee/other), `summary`, `amount`, `currency_code`,
  `frequency`, `conditions`, `source_evidence_id`, `status`
  (draft/in-review/verified/published/superseded/withdrawn).
- RLS: public `SELECT` requires `status = 'published'` **and** the parent opportunity published.

## Deadlines

### `intakes`
- Columns: `opportunity_id`, `label`, `academic_year`, `start_date`, `end_date`, `status`.

### `deadline_cycles`
- Columns: `opportunity_id`, `cycle_label`, `cycle_year`, `application_cycle_starts_on/ends_on`,
  `recurrence_cadence`, `recurrence_interval_years`, `recurrence_documented_by_source`,
  `automatic_date_generation_allowed` (CHECK: always `false` — the no-silent-rollover rule made
  structurally visible), `status`.

### `deadline_cycle_target_intakes`
Join table with snapshot fields (`intake_label_snapshot`, `program_start_date_snapshot`) so a
later intake edit doesn't retroactively rewrite what a cycle originally targeted.

### `deadline_occurrences`
- Columns: `deadline_cycle_id`, `role` (applicant-submission/institutional-nomination/…),
  `precision` (exact/estimated/rolling/unknown/program-specific/institution-specific),
  `opening_date`, `opening_is_estimated`, `closing_date`, `closing_is_estimated`, `scope_kind` +
  scope columns (program/institution/country/residency/applicant-category/round),
  `raw_text`, `source_timezone`, `verification_status`, `supersedes_occurrence_id`, `status`.
- CHECK constraints: `rolling`/`unknown` precision must have **no** opening/closing date
  (never fabricate a date for an uncertain deadline); `exact` precision must have **at least
  one** date.

### `deadline_occurrence_history`
Append-only: `deadline_occurrence_id`, `changed_by_staff_profile_id`, `change_reason`,
`previous_state`/`new_state` (jsonb), `official_source_id`, `changed_at`.

## Official sources and verification

### `official_sources`
- Columns: `url`, `kind`, `label`, `publisher_organisation_id` XOR `publisher_provider_id`
  (CHECK: not both), `source_organisation_name`, `source_language_code`, `status`
  (candidate/confirmed-official/active/changed/unavailable/superseded/archived),
  `last_checked_at`, `last_successful_access_at`.
- CHECK constraints: non-`candidate` status requires `last_checked_at`; non-`candidate` status
  requires a publisher (organisation or provider) to be identified.
- RLS: public `SELECT` where `status NOT IN ('candidate', 'archived')`.

### `opportunity_official_sources`
Join table; publication requires at least one row here (enforced by the trigger noted above).

### `verification_records`
- Columns: `subject_kind` + `subject_id` (polymorphic, no DB-level FK — documented, not an
  oversight), `opportunity_id`, `deadline_occurrence_id`, `reviewer_staff_profile_id`,
  `approved_by_staff_profile_id`, `review_assignment_id`, `outcome`, `status`,
  `deadline_verification_status`, `checked_at`, `summary`, `supersedes_verification_record_id`.
- CHECK: `approved_by_staff_profile_id` (if set) must differ from `reviewer_staff_profile_id` —
  no self-approval at the database level.
- Trigger: deferred constraint trigger blocks leaving `status = 'pending'` without at least one
  linked row in `verification_record_sources`.

### `source_evidence`
The exact fact location backing a verification decision: `opportunity_id`,
`official_source_id`, `verification_record_id`, `kind`, `status`, `source_locator`,
`evidence_text`, `captured_at`, `captured_by_staff_profile_id`, `superseded_at`.

## Required documents

### `opportunity_document_requirements`
- Columns: `opportunity_id`, `required_document_template_id`, `requirement_level`
  (required/conditionally-required/optional), `instructions`, `condition_summary`,
  `source_evidence_id` (**not null** — a document claim always needs a source),
  `status` (draft/in-review/verified/published/superseded/withdrawn), `display_order`,
  `last_checked_at`.
- RLS: public `SELECT` requires `status = 'published'` and the parent opportunity published.
- The public opportunity page renders this under "Official required documents", kept visually
  and textually separate from the guest's own local "Your preparation checklist" — the app
  never implies a generic suggestion is an official requirement.

## Eligibility

### `eligibility_rule_groups`
`opportunity_id`, `parent_group_id`, `label`, `operator` (all/any/none), `source_evidence_id`
(nullable — a group's overall grouping doesn't always need its own citation beyond its rules'),
`status`.

### `eligibility_rules`
`opportunity_id`, `rule_group_id`, `kind` (nationality/residence/study-level/…), `field_key`,
`operator` (equals/not-equals/in/…), `expected_value` (jsonb), `unit`, `explanation`,
`source_evidence_id` (**not null**), `status`, `version`.
Checkpoint 2 stores and manages these; evaluating them against a student profile is explicitly
out of scope (see ADR-004) until a later checkpoint.

## Review workflow

### `review_assignments`
`subject_kind` (opportunity/correction-report/official-source/verification-record),
`subject_id`, `opportunity_id`, `correction_report_id`, `subject_version`,
`subject_author_staff_profile_id`, `reviewer_staff_profile_id`, `assigned_by_staff_profile_id`,
`required_role`, `status`, `assigned_at`, `due_at`, `completed_at`,
`conflict_of_interest_declared_at/details`, `decision`, `reviewer_notes`. Separation of duties
(a reviewer never equals the subject's author) is enforced in
`src/lib/db/actions/reviews.ts`, not by a DB constraint, because "author" here means the
*opportunity's* `created_by_staff_profile_id`, which the schema alone can't validate against an
arbitrary `reviewer_staff_profile_id` without a trigger; the application-layer check is
exercised by `tests/unit/permissions.test.ts`.

## Corrections, duplicates, imports, audit

### `correction_reports`
`opportunity_id`, `category`, `description`, `suggested_official_source_url`,
`reporter_contact_email`, `status` (submitted/triaged/duplicate/assigned/investigating/
resolved/rejected/closed/redacted), `assigned_staff_profile_id`, `resolution_summary`,
`resolved_by_staff_profile_id`, `resolved_at`, `duplicate_of_correction_report_id`. No
application documents, passwords, or extensive personal data are collected — see
`src/lib/schemas/correction-report.ts`. RLS: staff-only `SELECT`; no `anon` policy at all (see
architecture doc §4 for why writes go through `/api/correction-reports` instead of PostgREST).

### `duplicate_candidates`
`canonical_opportunity_id`, `duplicate_opportunity_id`, `detection_reason`, `confidence_score`
(0–1), `status` (pending/confirmed-duplicate/dismissed-false-positive/merged),
`reviewed_by_staff_profile_id`, `reviewed_at`, `resolution_notes`. CHECK constraints: canonical
≠ duplicate; confidence in `[0, 1]`. Detection only ever creates candidates
(`src/lib/duplicates/detect.ts`); merging is a separate, explicit staff action.

### `import_jobs` / `import_job_rows`
One row per import run (legacy-seed migration or staff CSV upload) plus per-row outcomes.
`import_jobs` never stores the uploaded file's bytes — `source_filename` is a display label
only. `import_job_rows.errors` (jsonb) holds row-level validation messages for the result
summary.

### `audit_log`
Append-only (see architecture doc §8): `actor_staff_profile_id`, `actor_role`, `action`,
`entity_name`, `entity_id`, `occurred_at`, `reason_code`, `correlation_id`, `changed_fields`
(jsonb), `redacted_change_summary`, `retention_expires_at`, `status`. No secrets, credentials,
note bodies, or document content are ever written here. No IP address is collected at all — a
deliberate minimisation choice, not an oversight, since this checkpoint's audit needs are met
without it.

## Indexes

Beyond the uniqueness constraints noted per table, indexes exist on: `opportunities.slug`
(unique), `opportunities.legacy_migration_reference` (partial unique), the partial unique index
on active `staff_role_assignments`, and the composite-PK join tables (which are themselves
indexes). Query patterns for staff list/filter pages (by status, provider, country, etc.) are
served by the small current dataset size; add targeted indexes if `EXPLAIN ANALYZE` shows a
sequential scan becoming a problem as the catalogue grows past a few thousand rows.

## Retention / archive behaviour

Nothing in this schema hard-deletes a record that has ever been published or reviewed.
Archiving, superseding, and merging are all soft-state transitions that preserve the row and its
full `opportunity_versions`/`deadline_occurrence_history` trail. The only hard deletes in the
codebase are: an administrator deleting a genuinely erroneous, never-published draft (not a
distinct code path yet — done via direct data correction, matching "delete only unused drafts"
across the domain model), and the legacy-migration rollback path, which only ever deletes rows
*it itself created* in the current, not-yet-published state.
