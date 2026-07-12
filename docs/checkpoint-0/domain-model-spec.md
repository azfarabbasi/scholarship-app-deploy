# Checkpoint 0: Commercial domain model specification

## Status and scope

This document defines ScholarTrack's logical commercial domain. It is an
architecture contract, not a database schema, API contract, authentication
implementation, or instruction to migrate the versioned 55-record seed into
production. The old `ScholarTrack_Europe` prototype remains read-only and is not
an authoritative source.

The model is deliberately compatible with a future relational PostgreSQL design,
but it does not prescribe tables, columns, indexes, vendors, or persistence.
Guest records remain browser-local unless a person explicitly confirms migration
to an optional account. Public opportunity facts require official sources,
verification state, and a real last-checked time before publication.

## Cross-cutting modelling rules

- Identifiers are opaque, stable, and UUID-compatible unless a governed taxonomy
  code is explicitly named. Slugs and legacy IDs are aliases, not primary identity.
- Timestamps are offset-bearing ISO 8601 instants; calendar dates use strict
  `YYYY-MM-DD`. Records that can change carry created and updated audit metadata.
- The one primary classification stated for each entity is the minimum handling
  class for the entity. A field can require stricter treatment, which is called
  out explicitly. The allowed classes are `Public`, `Internal`, `Private user
  data`, `Sensitive personal metadata`, `Restricted operational data`, and
  `Prohibited Year 1 data`.
- `Prohibited Year 1 data` includes passport, transcript, certificate, bank
  statement, and other sensitive document file contents. No entity below stores
  those files, bytes, object keys, extracted contents, or download URLs.
- User-owned cloud records require a `UserAccount`. Equivalent guest records may
  exist only in local browser storage under a local owner context. Moving guest
  data to an account is an explicit, confirmed migration, never an implicit sync.
- Deterministic eligibility rules produce structured outcomes. AI may explain a
  sourced result, but it may not create, override, or silently reinterpret the
  rules or autonomously submit an application.
- Public facts are field-sourceable. Publication requires suitable
  `OfficialSource`, `SourceEvidence`, and `VerificationRecord` coverage, not merely
  a structurally valid URL.
- Deletion of public or operational history means archive, tombstone,
  anonymisation, or restricted retention where accountability requires it. It
  never means silently rewriting verification history.
- Year 1 status describes planned product need, not implementation state. The only
  valid values are `required immediately`, `required later in Year 1`, and
  `deferred beyond Year 1`.

## Deadline contract reuse

The commercial entity named `Deadline` is represented by the existing
`DeadlineOccurrence` contract in `src/lib/domain/deadlines.ts`. `DeadlineCycle`
reuses the existing `DeadlineCycle`, `DeadlineTargetIntake`,
`DeadlineRecurrence`, `DeadlineSource`, precision, lifecycle, verification,
scope, timezone, and boundary types from that module. This specification creates
no second deadline enum, date container, countdown rule, recurrence generator, or
verification meaning.

An opportunity may have many cycles; a cycle may contain many scoped occurrences
and target one or more intakes. When evaluating one student/intake context, the
existing `DeadlineTargetIntake` is the selected intake projection. Multiple
intakes are retained as relationships rather than flattening deadlines into an
unlabelled date array. Historical and estimated facts cannot be auto-rolled into
a future cycle.

## Entity catalogue

### 1. Opportunity

- **Purpose:** Represent an enduring public opportunity, including a scholarship,
  partial scholarship, internship, fellowship, exchange, research placement,
  grant, competition, conference, or summer school, independently of any one
  application cycle.
- **Ownership:** The platform controls the curated catalogue record; the named
  provider remains the attributed authority for sourced facts.
- **Classification:** `Public`.
- **Important identifiers:** `opportunityId`, stable `slug`, and optional
  `legacyReferences` for migration traceability.
- **Important fields:** Title, summary, publication state, opportunity-type code,
  delivery mode, official application route, host coverage, study/audience
  coverage, source-backed fact status, created time, and updated time.
- **Required relationships:** One `OpportunityType`, one primary `Provider`, and,
  before publication, at least one applicable `OfficialSource` and approved
  `VerificationRecord`.
- **Optional relationships:** Additional providers and organisations, countries,
  regions, study levels, fields of study, funding benefits, eligibility rule
  groups, deadline cycles, intakes, and document requirements.
- **Lifecycle states:** `draft`, `in-review`, `approved`, `published`, `archived`,
  `superseded`.
- **Audit requirements:** Record every material fact, type, source, verification,
  publication, archive, restore, and supersession change with actor and reason.
- **Deletion behavior:** Archive published records and retain stable tombstones
  and provenance; hard-delete only duplicate or erroneous never-published drafts
  under an audited administrative action.
- **Year 1 status:** `required immediately`.

### 2. OpportunityType

- **Purpose:** Govern the commercial kind of opportunity without confusing it
  with funding coverage or study level.
- **Ownership:** Platform-governed public taxonomy.
- **Classification:** `Public`.
- **Important identifiers:** `opportunityTypeId` and immutable `code`.
- **Important fields:** Code, display name, description, sort order, active flag,
  and source/review note. Initial codes must cover `scholarship`,
  `partial-scholarship`, `internship`, `fellowship`, `exchange`,
  `research-placement`, `grant`, `competition`, `conference`, and
  `summer-school`.
- **Required relationships:** One or more `Opportunity` records may use an active
  type; each published opportunity has exactly one primary type.
- **Optional relationships:** A type may have a successor type when deprecated.
- **Lifecycle states:** `draft`, `active`, `deprecated`, `retired`.
- **Audit requirements:** Audit code creation, label changes, deprecation,
  replacement mapping, and any reclassification impact.
- **Deletion behavior:** Retire referenced values; delete only unused drafts.
- **Year 1 status:** `required immediately`.

### 3. Provider

- **Purpose:** Represent an organisation in its role as owner, funder,
  administrator, host, nominator, or application handler for opportunities.
- **Ownership:** Platform-curated from official organisational evidence.
- **Classification:** `Public`.
- **Important identifiers:** `providerId`, related `organisationId`, and optional
  official external identifier.
- **Important fields:** Public display name, provider roles, official website,
  application authority scope, active dates, and verification summary.
- **Required relationships:** One `Organisation`; a published provider identity
  requires an `OfficialSource`.
- **Optional relationships:** Opportunities, countries, parent provider, and
  successor provider.
- **Lifecycle states:** `draft`, `verified`, `active`, `inactive`, `superseded`.
- **Audit requirements:** Audit identity merges, role/scope changes, website
  changes, verification, and provider reassignment.
- **Deletion behavior:** Supersede or archive referenced providers; hard-delete
  only an unused draft after duplicate review.
- **Year 1 status:** `required immediately`.

### 4. Organisation

- **Purpose:** Represent a legal, academic, governmental, nonprofit, consortium,
  or commercial actor independently of the roles it performs.
- **Ownership:** Platform-curated reference data grounded in official sources.
- **Classification:** `Public`.
- **Important identifiers:** `organisationId` and optional official registry or
  domain identifier.
- **Important fields:** Legal name, public name, organisation kind, official
  domain, headquarters country, parent relationship, and active dates.
- **Required relationships:** None while a draft; a verified organisation requires
  source evidence.
- **Optional relationships:** Providers, parent organisation, country, child
  organisations, and successor organisation.
- **Lifecycle states:** `draft`, `verified`, `active`, `inactive`, `merged`.
- **Audit requirements:** Audit legal-name changes, parentage, merges, official
  domain changes, and verification decisions.
- **Deletion behavior:** Preserve referenced identity history through merge or
  archive records; delete only unused drafts.
- **Year 1 status:** `required immediately`.

### 5. Country

- **Purpose:** Provide a governed jurisdiction and geography reference for host,
  provider, residence, nationality, and eligibility scopes without conflating
  those meanings.
- **Ownership:** Platform-governed reference taxonomy.
- **Classification:** `Public`.
- **Important identifiers:** `countryId` and ISO-compatible `code`.
- **Important fields:** Canonical name, short code, active flag, sort name, and
  optional validity dates.
- **Required relationships:** None.
- **Optional relationships:** Regions, organisations, providers, opportunities,
  and private profile/rule references with an explicit relationship role.
- **Lifecycle states:** `active`, `deprecated`, `historical`.
- **Audit requirements:** Audit code/name changes and jurisdiction replacement
  mappings; never rewrite historical references silently.
- **Deletion behavior:** Retire referenced countries; delete only unused erroneous
  drafts.
- **Year 1 status:** `required immediately`.

### 6. Region

- **Purpose:** Represent a governed geographic or programme grouping such as the
  European Union without treating it as an inferred country list.
- **Ownership:** Platform-governed reference taxonomy.
- **Classification:** `Public`.
- **Important identifiers:** `regionId` and stable `code`.
- **Important fields:** Name, region kind, description, active flag, and effective
  dates.
- **Required relationships:** None; membership must be explicit when used.
- **Optional relationships:** Countries, parent/child regions, opportunities,
  providers, and eligibility rules.
- **Lifecycle states:** `draft`, `active`, `deprecated`, `historical`.
- **Audit requirements:** Audit membership, scope, label, and effective-date
  changes because they may alter discovery or eligibility.
- **Deletion behavior:** Retire referenced regions and retain effective history;
  delete only unused drafts.
- **Year 1 status:** `required immediately`.

### 7. StudyLevel

- **Purpose:** Govern academic-level targeting separately from career stage,
  exchange mode, and opportunity type.
- **Ownership:** Platform-governed public taxonomy.
- **Classification:** `Public`.
- **Important identifiers:** `studyLevelId` and stable `code`.
- **Important fields:** Display name, rank/order, description, equivalence note,
  active flag, and legacy mapping note.
- **Required relationships:** None.
- **Optional relationships:** Opportunities, eligibility rules, education records,
  and predecessor/successor taxonomy values.
- **Lifecycle states:** `draft`, `active`, `deprecated`, `retired`.
- **Audit requirements:** Audit semantic, mapping, and deprecation changes; review
  effects on filters and deterministic rules.
- **Deletion behavior:** Retire referenced values; delete only unused drafts.
- **Year 1 status:** `required immediately`.

### 8. FieldOfStudy

- **Purpose:** Provide a hierarchical discipline taxonomy for opportunity
  discovery and deterministic eligibility matching.
- **Ownership:** Platform-governed public taxonomy.
- **Classification:** `Public`.
- **Important identifiers:** `fieldOfStudyId` and stable `code`.
- **Important fields:** Name, description, parent field, synonyms, active flag,
  and external mapping references.
- **Required relationships:** None.
- **Optional relationships:** Parent/child fields, opportunities, eligibility
  rules, and education/research records.
- **Lifecycle states:** `draft`, `active`, `deprecated`, `merged`.
- **Audit requirements:** Audit hierarchy, synonym, merge, and mapping changes.
- **Deletion behavior:** Merge or retire referenced values; delete only unused
  drafts.
- **Year 1 status:** `required immediately`.

### 9. FundingType

- **Purpose:** Classify the form and extent of support independently of the
  opportunity type.
- **Ownership:** Platform-governed public taxonomy.
- **Classification:** `Public`.
- **Important identifiers:** `fundingTypeId` and stable `code`.
- **Important fields:** Name, description, coverage class such as full, partial,
  tuition-only, stipend, reimbursement, in-kind, or unspecified, and active flag.
- **Required relationships:** None.
- **Optional relationships:** Funding benefits, opportunities, and replacement
  taxonomy values.
- **Lifecycle states:** `draft`, `active`, `deprecated`, `retired`.
- **Audit requirements:** Audit semantic changes and reclassification impact.
- **Deletion behavior:** Retire referenced values; delete only unused drafts.
- **Year 1 status:** `required immediately`.

### 10. FundingBenefit

- **Purpose:** Store a single sourced benefit component instead of relying only
  on an unqueryable marketing summary.
- **Ownership:** Platform catalogue; the provider remains authoritative for the
  benefit fact.
- **Classification:** `Public`.
- **Important identifiers:** `fundingBenefitId` and parent `opportunityId`.
- **Important fields:** Benefit kind, funding type, amount or range, currency,
  cadence, coverage percentage, conditions, original wording, verification state,
  and last-checked time.
- **Required relationships:** One `Opportunity`, one `FundingType`, and source
  evidence before publication.
- **Optional relationships:** Deadline cycle, intake, country, and provider when a
  benefit is scope-specific.
- **Lifecycle states:** `draft`, `in-review`, `verified`, `published`, `superseded`,
  `withdrawn`.
- **Audit requirements:** Audit amount, currency, cadence, coverage, scope,
  verification, and supersession changes at field level.
- **Deletion behavior:** Supersede published benefit facts; delete only erroneous
  unpublished drafts while preserving the audit event.
- **Year 1 status:** `required immediately`.

### 11. EligibilityRule

- **Purpose:** Represent one source-backed, deterministic eligibility condition
  that can return satisfied, not satisfied, or unknown without AI judgement.
- **Ownership:** Platform-curated from provider rules.
- **Classification:** `Public`.
- **Important identifiers:** `eligibilityRuleId`, parent
  `eligibilityRuleGroupId`, and stable rule version.
- **Important fields:** Input key, operator, expected value/range, unit, scope,
  source wording, missing-data result, student-facing explanation, verification
  state, and effective dates.
- **Required relationships:** One `EligibilityRuleGroup`, one relevant
  `OfficialSource`, and approved evidence before use.
- **Optional relationships:** Country, region, study level, field of study, intake,
  or deadline-cycle scope.
- **Lifecycle states:** `draft`, `in-review`, `approved`, `active`, `superseded`,
  `withdrawn`.
- **Audit requirements:** Version every operand, operator, scope, evidence, and
  approval change; retain the exact rule version used for a result.
- **Deletion behavior:** Supersede rules already evaluated or published; delete
  only unused drafts. AI output cannot mutate this record.
- **Year 1 status:** `required immediately`.

### 12. EligibilityRuleGroup

- **Purpose:** Combine deterministic rules with explicit `all`, `any`, and
  documented nested logic while preserving an unknown outcome.
- **Ownership:** Platform-curated from official eligibility policy.
- **Classification:** `Public`.
- **Important identifiers:** `eligibilityRuleGroupId`, parent `opportunityId`, and
  group version.
- **Important fields:** Logic operator, label, scope, evaluation order,
  applicability conditions, source summary, verification state, and effective
  dates.
- **Required relationships:** One `Opportunity` and one or more
  `EligibilityRule` records before activation.
- **Optional relationships:** Parent/child rule groups, deadline cycle, and intake.
- **Lifecycle states:** `draft`, `in-review`, `approved`, `active`, `superseded`,
  `withdrawn`.
- **Audit requirements:** Version group structure and ordering; retain the tree and
  rule versions used for each deterministic evaluation.
- **Deletion behavior:** Supersede used groups; delete only never-used drafts.
- **Year 1 status:** `required immediately`.

### 13. Deadline

- **Purpose:** Represent one scope-aware application or nomination occurrence for
  a defined cycle. Its opening and closing boundaries are separate optional
  facts, including exact, estimated, rolling, unknown, programme-specific, and
  institution-specific cases.
- **Ownership:** Platform-curated source fact attributed to the provider.
- **Classification:** `Public`.
- **Important identifiers:** Existing `DeadlineOccurrence.occurrenceId`; no second
  deadline identifier is introduced.
- **Important fields:** The canonical `DeadlineOccurrence` role; structured
  programme, institution, country/residency, applicant-category, and round
  scope; occurrence precision; separate optional `openingBoundary` and
  `closingBoundary` facts; sources; withdrawal/supersession state; and audit
  metadata. Each boundary retains precision, official URL, original text,
  verification status, last-checked time, source timezone, source value, and any
  separately marked projection. Boundary precision is only `exact` or
  `estimated`; `rolling`, `unknown`, programme-specific, and institution-specific
  describe the occurrence. An exact/estimated occurrence must agree with its
  operative boundary, while a resolved scoped occurrence may validly contain an
  exact selected boundary. Boundaries are embedded value objects, not independent
  lifecycle records.
- **Required relationships:** One `DeadlineCycle`; a published actionable
  occurrence must be backed by an applicable `OfficialSource`, evidence, and
  verification record. The source association maps to the existing
  `DeadlineSource` contract rather than replacing it.
- **Optional relationships:** Intake, programme, institution/provider, country,
  applicant category, and round scope through explicit scope fields and reviewed
  relationships.
- **Lifecycle states:** Stored source-fact availability is `draft`, `active`,
  `withdrawn`, `superseded`, or `archived`. `DeadlineLifecycleStatus` is a
  recomputable `DeadlineDisplayState` result only; it is never persisted as or
  allowed to overwrite the source occurrence.
- **Audit requirements:** Preserve every source boundary, timezone, precision,
  scope, verification, conflict, withdrawal, and supersession change; retain the
  prior occurrence rather than rewriting its cycle.
- **Deletion behavior:** Withdraw or archive sourced occurrences and retain
  history. Delete only an erroneous unpublished occurrence with an audit reason.
  Never auto-roll a deleted or passed date into another cycle.
- **Year 1 status:** `required immediately`.

### 14. DeadlineCycle

- **Purpose:** Group scoped deadline occurrences for one published application
  cycle and its target intake context without inferring identity from a year.
- **Ownership:** Platform-curated source fact attributed to the provider.
- **Classification:** `Public`.
- **Important identifiers:** Existing `DeadlineCycle.cycleId`; source cycle label
  is an alias, not identity.
- **Important fields:** Existing `cycleYear`, explicit `targetIntakes`,
  `occurrences`, and `recurrence` fields, plus source-facing cycle label and
  effective range as reviewed metadata. `automaticDateGenerationAllowed` remains
  `false`.
- **Required relationships:** One `Opportunity`, at least one existing
  `DeadlineOccurrence` represented as `Deadline` when the cycle is published, and
  at least one explicit `Intake` association when the provider defines one.
- **Optional relationships:** Provider programme/institution scope,
  prior/successor cycle, and verification records. Evaluation selects one of the
  explicit target intakes; calendar proximity never creates that relationship.
- **Lifecycle states:** `draft`, `in-review`, `announced`, `active`, `completed`,
  `withdrawn`, `historical`.
- **Audit requirements:** Audit cycle identity, intake mapping, occurrence
  membership, recurrence evidence, verification, withdrawal, and predecessor
  links.
- **Deletion behavior:** Retain announced and historical cycles; delete only
  erroneous unused drafts. Never mutate a past cycle into a new one.
- **Year 1 status:** `required immediately`.

### 15. Intake

- **Purpose:** Represent a provider-defined admission, programme, placement, or
  event start cohort separately from application deadlines.
- **Ownership:** Platform-curated from official provider facts.
- **Classification:** `Public`.
- **Important identifiers:** `intakeId` and provider/source label.
- **Important fields:** Label, intake kind, start date or estimated window,
  academic year, timezone where applicable, precision, verification state, and
  last-checked time.
- **Required relationships:** One `Opportunity` or provider programme context and
  source evidence before publication.
- **Optional relationships:** Multiple deadline cycles, funding benefits,
  eligibility rule groups, countries, and fields of study.
- **Lifecycle states:** `draft`, `announced`, `open-for-cycle`, `started`,
  `completed`, `cancelled`, `historical`.
- **Audit requirements:** Audit dates/windows, precision, cycle mapping,
  cancellation, verification, and source changes.
- **Deletion behavior:** Retain historical intakes and mark cancellation or
  supersession; delete only unused drafts.
- **Year 1 status:** `required immediately`.

### 16. OfficialSource

- **Purpose:** Identify an authoritative provider-controlled page, call,
  regulation, or publication that may support one or more public facts.
- **Ownership:** The source publisher owns the source content; the platform owns
  its catalogue reference and review metadata.
- **Classification:** `Public`.
- **Important identifiers:** `officialSourceId`, canonical URL, and optional
  publisher document/call identifier.
- **Important fields:** URL, publisher, source kind, title, language, published or
  effective date, access scope, source timezone wording, active flag, first seen,
  last observed, and content fingerprint when lawful.
- **Required relationships:** One responsible `Provider` or `Organisation` must be
  identified before the source is treated as official.
- **Optional relationships:** Opportunities, deadlines, cycles, intakes, benefits,
  eligibility rules, document requirements, evidence captures, and successor
  sources.
- **Lifecycle states:** `candidate`, `confirmed-official`, `active`, `changed`,
  `unavailable`, `superseded`, `archived`.
- **Audit requirements:** Audit official-status decisions, URL changes, redirects,
  availability, fingerprints, and successor mappings with check time and actor.
- **Deletion behavior:** Retain references used by published facts and mark them
  unavailable or superseded; delete only rejected unreferenced candidates.
- **Year 1 status:** `required immediately`.

### 17. VerificationRecord

- **Purpose:** Record a human-review outcome for a defined set of facts, scope,
  cycle, and evidence rather than treating URL presence as verification.
- **Ownership:** Platform editorial operation; authored by an accountable human
  Reviewer and independently approved where publication policy requires it.
- **Classification:** `Internal`.
- **Important identifiers:** `verificationRecordId`, subject reference, review
  version, and optional superseded-record ID.
- **Important fields:** Subject kind/ID, fact paths, result, deadline verification
  status where applicable, reviewer, checked time, next-review time, rationale,
  conflict resolution, and approval state.
- **Required relationships:** At least one `OfficialSource`, at least one
  `SourceEvidence`, and an accountable human Reviewer identity. A System Service
  may ingest candidate evidence or create a draft, but cannot author, approve, or
  publish the verification outcome.
- **Optional relationships:** Opportunity, provider, deadline, cycle, intake,
  funding benefit, eligibility rule, document requirement, correction report, and
  review assignment.
- **Lifecycle states:** `pending`, `in-review`, `verified`, `rejected`, `stale`,
  `conflicting`, `withdrawn`, `superseded`, `archived`.
- **Audit requirements:** Append-only outcome history with actor, timestamps,
  evidence set, rationale, approval, and supersession; corrections create a new
  record.
- **Deletion behavior:** Do not hard-delete records supporting published facts.
  Restrict, supersede, or redact incidental personal content while preserving
  accountability.
- **Year 1 status:** `required immediately`.

### 18. SourceEvidence

- **Purpose:** Preserve the exact fact location and limited evidence needed to
  reproduce a verification decision.
- **Ownership:** Platform review operation; underlying source content remains owned
  by its publisher.
- **Classification:** `Internal`.
- **Important identifiers:** `sourceEvidenceId`, `officialSourceId`, capture time,
  and evidence fingerprint.
- **Important fields:** Fact path, section/anchor/page locator, short necessary
  excerpt or structured observation, original wording, captured time, language,
  content fingerprint, and reviewer note. It must not contain student documents.
- **Required relationships:** One `OfficialSource`; verified use requires one or
  more `VerificationRecord` references.
- **Optional relationships:** Opportunity, deadline, cycle, intake, funding
  benefit, eligibility rule, and document requirement.
- **Lifecycle states:** `captured`, `accepted`, `superseded`, `unavailable`,
  `retention-expired`, `redacted`.
- **Audit requirements:** Make captures immutable; audit access-controlled edits,
  redactions, fingerprint changes, and verification usage.
- **Deletion behavior:** Retain the minimum evidence needed for active/public
  facts, subject to copyright and retention policy; redact or expire excess
  copies without removing the verification trail.
- **Year 1 status:** `required immediately`.

### 19. RequiredDocumentTemplate

- **Purpose:** Define a reusable, generic document category such as CV, statement,
  or reference letter without receiving or storing the student's file.
- **Ownership:** Platform-governed public taxonomy.
- **Classification:** `Public`.
- **Important identifiers:** `requiredDocumentTemplateId` and stable `code`.
- **Important fields:** Display name, description, allowed readiness states,
  metadata prompts, expiry relevance, sensitivity warning, active flag, and
  prohibition flags for file storage.
- **Required relationships:** None.
- **Optional relationships:** Opportunity document requirements, master document
  metadata, successor template, and taxonomy category.
- **Lifecycle states:** `draft`, `active`, `deprecated`, `retired`.
- **Audit requirements:** Audit meaning, sensitivity, metadata prompts, and
  deprecation changes; changes must not enable file upload.
- **Deletion behavior:** Retire referenced templates; delete only unused drafts.
- **Year 1 status:** `required immediately`.

### 20. OpportunityDocumentRequirement

- **Purpose:** State that an opportunity/cycle requires a generic document type,
  including sourced format, timing, and applicability conditions.
- **Ownership:** Platform-curated from provider instructions.
- **Classification:** `Public`.
- **Important identifiers:** `opportunityDocumentRequirementId`, parent
  `opportunityId`, and template ID.
- **Important fields:** Required/optional status, source wording, format/issuer
  constraints, applicable cycle/intake/scope, due occurrence reference,
  verification state, and last-checked time.
- **Required relationships:** One `Opportunity`, one `RequiredDocumentTemplate`,
  and source evidence before publication.
- **Optional relationships:** Deadline occurrence, cycle, intake, eligibility rule,
  and provider.
- **Lifecycle states:** `draft`, `in-review`, `verified`, `published`, `superseded`,
  `withdrawn`.
- **Audit requirements:** Version requirement, scope, due relationship, source, and
  verification changes.
- **Deletion behavior:** Supersede published requirements; delete only erroneous
  unpublished drafts.
- **Year 1 status:** `required immediately`.

### 21. UserAccount

- **Purpose:** Provide an optional cloud-sync identity for a registered human
  while preserving a fully available account-free guest mode for students.
- **Ownership:** The registered person owns account-linked personal data; a
  student owns their workspace/profile data, while the platform controls role
  assignment, service identity, and operational status.
- **Classification:** `Private user data`.
- **Important identifiers:** `userAccountId` and external authentication subject
  ID. Email is a private contact attribute, not a public identifier.
- **Important fields:** Auth subject reference, contact email, email-verification
  state, explicit platform-role assignments, locale, timezone, consent versions, account
  state, created time, last sign-in time, and deletion-request time. No plaintext
  password or credential is stored in this domain record. Only accounts carrying
  an assigned Reviewer, Senior Reviewer, or Administrator role may be staff
  assignees; a Student role never gains staff permissions implicitly.
- **Required relationships:** An external authenticated subject when activated.
- **Optional relationships:** User profile and all account-owned workspace,
  preference, notification, AI, and correction records. Guest data is unrelated
  until confirmed migration.
- **Lifecycle states:** `pending-verification`, `active`, `suspended`,
  `deletion-requested`, `deactivated`, `deleted`.
- **Audit requirements:** Audit consent, verification, security-sensitive profile
  changes, suspension, migration confirmation, export, and deletion; never log
  credentials.
- **Deletion behavior:** On verified request, permanently delete live private
  account content after the documented recovery window and revoke authentication
  sessions. Only minimal legally or security-necessary account tombstones and
  audit events may remain pseudonymised for their bounded retention period.
- **Year 1 status:** `required later in Year 1`.

### 22. UserProfile

- **Purpose:** Hold the minimum structured personal and academic matching context
  that a student elects to synchronise.
- **Ownership:** The student.
- **Classification:** `Sensitive personal metadata`.
- **Important identifiers:** `userProfileId` and `userAccountId`; a browser-local
  profile ID may be used in guest mode.
- **Important fields:** Preferred name, nationality, residence, province/domicile,
  date-of-birth band only where strictly needed, current study level, expected
  graduation date, CGPA with scale, target countries/levels/fields/intakes,
  completeness, consent, and audit timestamps.
- **Required relationships:** Exactly one ownership context: browser-local guest
  owner or `UserAccount` for cloud storage.
- **Optional relationships:** Country, region, study level, field of study,
  education, work, research, publication, certification, language-test, and
  preference records.
- **Lifecycle states:** `local-draft`, `active`, `incomplete`, `migration-pending`,
  `archived`, `deletion-requested`, `deleted`.
- **Audit requirements:** Account mode audits material changes, consent,
  guest-import confirmation, export, and deletion; do not emit sensitive values
  into general logs.
- **Deletion behavior:** Guest deletion clears local data. Account deletion
  permanently removes profile values and cascades to owned records, retaining
  only de-identified operational evidence where required.
- **Year 1 status:** `required later in Year 1`.

### 23. EducationRecord

- **Purpose:** Represent a student-entered qualification or current course for
  deterministic matching and readiness planning.
- **Ownership:** The student.
- **Classification:** `Sensitive personal metadata`.
- **Important identifiers:** `educationRecordId` and owner-context ID.
- **Important fields:** Institution display name, country, qualification, study
  level, field, start/end or expected graduation date, completion state, CGPA and
  scale, and user-confirmed accuracy. No transcript file or extracted transcript
  content is allowed.
- **Required relationships:** One browser-local guest owner or one account-owned
  `UserProfile`.
- **Optional relationships:** Country, study level, and field of study taxonomy
  values.
- **Lifecycle states:** `draft`, `current`, `completed`, `withdrawn`, `archived`,
  `deleted`.
- **Audit requirements:** In account mode audit creation, material edits, source
  declaration, export, and deletion without copying values to broad logs.
- **Deletion behavior:** User may permanently delete it; remove dependent cached
  eligibility inputs/results or recompute them, and preserve only de-identified
  security audit data.
- **Year 1 status:** `required later in Year 1`.

### 24. WorkExperienceRecord

- **Purpose:** Represent student-entered employment or professional experience
  required for deterministic eligibility and planning.
- **Ownership:** The student.
- **Classification:** `Sensitive personal metadata`.
- **Important identifiers:** `workExperienceRecordId` and owner-context ID.
- **Important fields:** Employer display name, role, country, start/end dates,
  current-role flag, workload basis, verified-by-user duration, and concise
  eligibility-relevant description.
- **Required relationships:** One browser-local guest owner or one account-owned
  `UserProfile`.
- **Optional relationships:** Country and relevant field-of-study taxonomy.
- **Lifecycle states:** `draft`, `current`, `completed`, `archived`, `deleted`.
- **Audit requirements:** In account mode audit material edits, export, and
  deletion; redact employer/role details from general logs.
- **Deletion behavior:** User may permanently delete it; invalidate dependent
  cached eligibility results and retain no content in analytics.
- **Year 1 status:** `required later in Year 1`.

### 25. ResearchExperienceRecord

- **Purpose:** Represent student-entered research participation relevant to a
  research placement, fellowship, doctoral opportunity, grant, or conference.
- **Ownership:** The student.
- **Classification:** `Sensitive personal metadata`.
- **Important identifiers:** `researchExperienceRecordId` and owner-context ID.
- **Important fields:** Project/title, institution or group, role, field, country,
  start/end dates, current flag, methods/outputs summary, and user confirmation.
- **Required relationships:** One browser-local guest owner or one account-owned
  `UserProfile`.
- **Optional relationships:** Organisation display reference, country, field of
  study, and related publication records.
- **Lifecycle states:** `draft`, `current`, `completed`, `archived`, `deleted`.
- **Audit requirements:** In account mode audit material edits, export, and
  deletion; keep free text out of general logs and analytics.
- **Deletion behavior:** User may permanently delete it; unlink related records
  rather than deleting independently owned publications automatically.
- **Year 1 status:** `required later in Year 1`.

### 26. PublicationRecord

- **Purpose:** Represent student-entered bibliographic metadata relevant to
  opportunity matching without storing a manuscript or publisher PDF.
- **Ownership:** The student.
- **Classification:** `Sensitive personal metadata`.
- **Important identifiers:** `publicationRecordId`, owner-context ID, and optional
  DOI or other public bibliographic identifier.
- **Important fields:** Title, author-position summary, venue, publication state,
  date/year, DOI/public URL, field, and user confirmation. No publication file is
  stored.
- **Required relationships:** One browser-local guest owner or one account-owned
  `UserProfile`.
- **Optional relationships:** Research experience and field of study.
- **Lifecycle states:** `draft`, `submitted`, `accepted`, `published`, `withdrawn`,
  `archived`, `deleted`.
- **Audit requirements:** In account mode audit creation, material edits, public
  identifier changes, export, and deletion.
- **Deletion behavior:** User may permanently delete private metadata; a linked
  public DOI is not independently republished by the platform.
- **Year 1 status:** `required later in Year 1`.

### 27. CertificationRecord

- **Purpose:** Represent user-entered certification metadata used for readiness or
  deterministic rules without storing the certificate file.
- **Ownership:** The student.
- **Classification:** `Sensitive personal metadata`.
- **Important identifiers:** `certificationRecordId` and owner-context ID.
- **Important fields:** Certification name, issuer display name, issue date,
  expiry date, status, optional public verification reference, and version label.
  Certificate files, scans, and extracted contents are prohibited.
- **Required relationships:** One browser-local guest owner or one account-owned
  `UserProfile`.
- **Optional relationships:** Master document metadata and relevant document
  templates.
- **Lifecycle states:** `draft`, `valid`, `expiring`, `expired`, `revoked`,
  `archived`, `deleted`.
- **Audit requirements:** In account mode audit issue/expiry/status edits, export,
  and deletion without logging credential-like references broadly.
- **Deletion behavior:** User may permanently delete it; remove reminders and
  invalidate dependent readiness results.
- **Year 1 status:** `required later in Year 1`.

### 28. LanguageTestRecord

- **Purpose:** Record language-test readiness and score metadata when a sourced
  rule requires it, without storing a score report or certificate file.
- **Ownership:** The student.
- **Classification:** `Sensitive personal metadata`.
- **Important identifiers:** `languageTestRecordId` and owner-context ID.
- **Important fields:** Test kind, taken/planned status, test date, overall score,
  component scores only when needed, scoring scale/version, expiry date, and
  user-confirmed state.
- **Required relationships:** One browser-local guest owner or one account-owned
  `UserProfile`.
- **Optional relationships:** Certification or master-document metadata and
  document requirements.
- **Lifecycle states:** `planned`, `booked`, `taken`, `valid`, `expired`,
  `cancelled`, `archived`, `deleted`.
- **Audit requirements:** In account mode audit score/status/expiry edits, export,
  and deletion; exclude scores from analytics and general logs.
- **Deletion behavior:** User may permanently delete it; cancel dependent
  reminders and recompute eligibility/readiness results.
- **Year 1 status:** `required later in Year 1`.

### 29. UserPreference

- **Purpose:** Store student-controlled discovery, display, privacy, and workspace
  choices without treating preferences as verified eligibility facts.
- **Ownership:** The student.
- **Classification:** `Private user data`.
- **Important identifiers:** `userPreferenceId` and owner-context ID.
- **Important fields:** Target locations, opportunity types, study levels, fields,
  funding preferences, target intakes, language/locale, timezone, theme,
  accessibility preferences, and data/AI consent settings.
- **Required relationships:** Exactly one browser-local guest owner or one
  `UserAccount`.
- **Optional relationships:** Country, region, opportunity type, study level,
  field of study, funding type, and intake values.
- **Lifecycle states:** `local-draft`, `active`, `migration-pending`, `reset`,
  `deleted`.
- **Audit requirements:** In account mode audit consent and privacy-affecting
  changes; routine presentation preferences need only updated metadata.
- **Deletion behavior:** User may reset or permanently delete preferences; guest
  reset clears local storage, and account deletion cascades.
- **Year 1 status:** `required immediately`.

### 30. SavedOpportunity

- **Purpose:** Represent a student's shortlist entry independently of opportunity
  publication state and without implying an application.
- **Ownership:** The student.
- **Classification:** `Private user data`.
- **Important identifiers:** `savedOpportunityId`, owner-context ID, and
  `opportunityId`; the owner/opportunity pair is unique within one workspace.
- **Important fields:** Saved time, personal priority, optional local-only label,
  source snapshot/version reference, and sync state.
- **Required relationships:** One `Opportunity` and exactly one browser-local guest
  owner or `UserAccount`.
- **Optional relationships:** Application tracker created from the saved item.
- **Lifecycle states:** `saved`, `migration-pending`, `synced`, `removed`,
  `orphaned-by-archive`.
- **Audit requirements:** In account mode audit guest-import confirmation and
  security-relevant sync conflicts; ordinary save/remove can use private activity
  history, not public analytics.
- **Deletion behavior:** Immediate user removal; guest removal clears local data,
  and account deletion permanently deletes the record.
- **Year 1 status:** `required immediately`.

### 31. ApplicationTracker

- **Purpose:** Track a student's planning and progress for one opportunity/cycle;
  it never submits an application or represents provider-side submission truth.
- **Ownership:** The student.
- **Classification:** `Private user data`.
- **Important identifiers:** `applicationTrackerId`, owner-context ID,
  `opportunityId`, and optional deadline-cycle/intake IDs.
- **Important fields:** Personal status, current stage, selected cycle/intake,
  personal target date, progress value derived from tasks/doc metadata, source
  version, migration/sync state, and timestamps.
- **Required relationships:** One `Opportunity`, one `ApplicationStage`, and
  exactly one browser-local guest owner or `UserAccount`.
- **Optional relationships:** Saved opportunity, deadline cycle, intake,
  activities, tasks, notes, document progress, and reminders.
- **Lifecycle states:** `considering`, `preparing`, `ready`, `submitted-manually`,
  `interview`, `offered`, `accepted`, `rejected`, `withdrawn`, `closed`, `deleted`.
- **Audit requirements:** In account mode retain private activity history for
  material stage changes and guest migration; never claim provider confirmation
  without a user-entered qualifier or official integration.
- **Deletion behavior:** User deletion cascades to private activities, notes,
  tasks, document progress, and reminders; it does not delete the public
  opportunity or shared master-document metadata.
- **Year 1 status:** `required immediately`.

### 32. ApplicationStage

- **Purpose:** Govern user-facing application-planning stages and valid transitions
  while keeping provider-specific statuses distinguishable.
- **Ownership:** Platform-governed public taxonomy.
- **Classification:** `Public`.
- **Important identifiers:** `applicationStageId` and stable `code`.
- **Important fields:** Label, description, order, terminal flag, allowed next
  stages, provider-confirmation requirement, and active flag.
- **Required relationships:** None; every active `ApplicationTracker` references
  one stage.
- **Optional relationships:** Predecessor/successor stage and opportunity-type
  applicability.
- **Lifecycle states:** `draft`, `active`, `deprecated`, `retired`.
- **Audit requirements:** Audit transition, semantic, order, and deprecation
  changes because they affect existing tracker histories.
- **Deletion behavior:** Retire referenced stages and map a successor; delete only
  unused drafts.
- **Year 1 status:** `required immediately`.

### 33. ApplicationActivity

- **Purpose:** Provide a private chronological history of meaningful tracker
  changes and student-recorded external events.
- **Ownership:** The student; system-generated entries remain part of the
  student's private workspace.
- **Classification:** `Private user data`.
- **Important identifiers:** `applicationActivityId` and
  `applicationTrackerId`.
- **Important fields:** Activity kind, occurred time, actor kind, prior/new stage,
  concise description, origin (`user`, `system`, or `migration`), and immutable
  created time.
- **Required relationships:** One `ApplicationTracker`.
- **Optional relationships:** Application stage, task, reminder, document-progress
  item, and a pseudonymous audit correlation ID.
- **Lifecycle states:** `recorded`, `corrected`, `redacted`, `deleted-with-tracker`.
- **Audit requirements:** Keep entries append-oriented; corrections add a linked
  replacement. Do not copy note bodies or sensitive profile values into activity.
- **Deletion behavior:** Delete with its tracker or user account; retain only
  de-identified service-security events outside this entity where justified.
- **Year 1 status:** `required immediately`.

### 34. UserNote

- **Purpose:** Store free-form private planning notes associated with an
  opportunity or application tracker.
- **Ownership:** The student.
- **Classification:** `Private user data`.
- **Important identifiers:** `userNoteId` and owner-context ID.
- **Important fields:** Plain-text body, created/updated time, optional title,
  local/sync state, and explicit sensitivity warning. Notes must not be mined into
  public facts automatically.
- **Required relationships:** Exactly one browser-local guest owner or
  `UserAccount`.
- **Optional relationships:** Opportunity or application tracker; at least one
  context should normally be present.
- **Lifecycle states:** `draft`, `active`, `migration-pending`, `archived`,
  `deleted`.
- **Audit requirements:** In account mode audit access anomalies, migration,
  export, and deletion; never emit note bodies to analytics or ordinary logs.
- **Deletion behavior:** User may permanently delete notes immediately; remove
  local copies and synced copies, backups subject to bounded expiry.
- **Year 1 status:** `required immediately`.

### 35. UserTask

- **Purpose:** Track a student-defined or template-derived preparation action
  without performing it on the student's behalf.
- **Ownership:** The student.
- **Classification:** `Private user data`.
- **Important identifiers:** `userTaskId` and owner-context ID.
- **Important fields:** Title, description, due date/time and timezone, priority,
  completion state/time, origin, recurrence metadata limited to reminders, and
  created/updated time.
- **Required relationships:** Exactly one browser-local guest owner or
  `UserAccount`.
- **Optional relationships:** Application tracker, opportunity, document-progress
  item, deadline occurrence, and reminder.
- **Lifecycle states:** `pending`, `in-progress`, `completed`, `cancelled`,
  `overdue`, `deleted`.
- **Audit requirements:** In account mode audit migration/sync conflicts and
  security-sensitive access; normal task history may remain private activity.
- **Deletion behavior:** User deletion removes task and linked unsent reminders;
  it never changes an official deadline or application status.
- **Year 1 status:** `required immediately`.

### 36. MasterDocumentRecord

- **Purpose:** Reuse student-controlled document readiness metadata across
  applications while explicitly storing no document file or extracted content.
- **Ownership:** The student.
- **Classification:** `Sensitive personal metadata`.
- **Important identifiers:** `masterDocumentRecordId` and owner-context ID.
- **Important fields:** Required-document template or type, minimal reviewed
  student label, readiness status, version label, optional expiry date,
  timestamps, requirement relationships, and local/sync state. It has no free-
  form document note, issue/issuer detail, binary content, object key, file path,
  download URL, OCR text, transcript values, passport number, bank data, or
  certificate image.
- **Required relationships:** One `RequiredDocumentTemplate` and exactly one
  browser-local guest owner or `UserAccount`.
- **Optional relationships:** Certification or language-test metadata and many
  application document-progress items.
- **Lifecycle states:** `missing`, `planned`, `draft`, `ready`, `needs-update`,
  `expired`, `archived`, `deleted`.
- **Audit requirements:** In account mode audit readiness/version/expiry changes,
  guest migration, export, and deletion; validate continuously that no prohibited
  file-storage fields or payloads are accepted.
- **Deletion behavior:** User may permanently delete metadata; unlink dependent
  progress items and recompute them as missing without affecting public
  requirements. Sensitive files are never present to delete.
- **Year 1 status:** `required later in Year 1`.

### 37. ApplicationDocumentProgress

- **Purpose:** Track readiness against one opportunity document requirement using
  status and optional reusable metadata, never an uploaded file.
- **Ownership:** The student.
- **Classification:** `Sensitive personal metadata`.
- **Important identifiers:** `applicationDocumentProgressId` and parent
  `applicationTrackerId`.
- **Important fields:** Readiness state, requirement version, selected master
  metadata reference, optional version label and expiry date, completion/update
  timestamps, and no free-form document note.
- **Required relationships:** One `ApplicationTracker` and one
  `OpportunityDocumentRequirement`.
- **Optional relationships:** One `MasterDocumentRecord`, user task, or reminder.
- **Lifecycle states:** `not-started`, `not-applicable`, `planned`, `in-progress`,
  `ready`, `needs-update`, `expired`, `removed`.
- **Audit requirements:** In account mode audit requirement-version changes,
  readiness transitions, master-record linkage, guest migration, and deletion;
  never log document contents because none may be stored.
- **Deletion behavior:** Delete with its application tracker or on user request;
  do not delete a shared master metadata record unless separately requested.
- **Year 1 status:** `required later in Year 1`.

### 38. Reminder

- **Purpose:** Schedule a user-controlled in-app or browser notification for a
  task, personal target, or verified deadline without modifying the official
  deadline.
- **Ownership:** The student.
- **Classification:** `Private user data`.
- **Important identifiers:** `reminderId` and owner-context ID.
- **Important fields:** Trigger instant, timezone, channel (`in-app` or browser
  push when consented), status, message key, source context, retry count, and sent
  time. No paid email, SMS, or WhatsApp dependency is assumed.
- **Required relationships:** Exactly one browser-local guest owner or
  `UserAccount`, plus one reminder subject such as tracker, task, or deadline.
- **Optional relationships:** Application tracker, task, deadline occurrence,
  master-document metadata, and notification preference.
- **Lifecycle states:** `scheduled`, `due`, `sent`, `failed`, `snoozed`,
  `cancelled`, `expired`, `deleted`.
- **Audit requirements:** Audit consent/channel changes, system send attempts,
  failures, and cancellations without logging sensitive message substitutions.
- **Deletion behavior:** User cancellation/deletion prevents future sends;
  delivery diagnostics expire under a short operational retention policy.
- **Year 1 status:** `required later in Year 1`.

### 39. NotificationPreference

- **Purpose:** Record channel-level consent, quiet hours, frequency, and
  notification categories for account or local guest mode.
- **Ownership:** The student.
- **Classification:** `Private user data`.
- **Important identifiers:** `notificationPreferenceId` and owner-context ID.
- **Important fields:** Channel, enabled flag, consent time/version, quiet hours
  and timezone, digest frequency, category selections, browser permission state,
  and updated time.
- **Required relationships:** Exactly one browser-local guest owner or
  `UserAccount`.
- **Optional relationships:** Reminders and user preferences.
- **Lifecycle states:** `unset`, `enabled`, `paused`, `revoked`, `reset`, `deleted`.
- **Audit requirements:** Audit every consent grant/revocation and channel change;
  never infer consent from account creation.
- **Deletion behavior:** User reset or account deletion removes preferences;
  revocation must immediately stop future sends while minimal consent evidence may
  be retained where required.
- **Year 1 status:** `required later in Year 1`.

### 40. CorrectionReport

- **Purpose:** Allow a guest or account holder to report a potentially inaccurate,
  stale, conflicting, or broken public catalogue fact for staff review.
- **Ownership:** The platform owns the review case; the reporter owns any optional
  contact data they provide.
- **Classification:** `Internal`.
- **Important identifiers:** `correctionReportId`, target subject ID, and public
  acknowledgement reference where appropriate.
- **Important fields:** Target fact path, category, report text, suggested official
  URL, submitted time, reporter type, optional private contact reference, triage
  state, resolution summary, and duplicate-parent ID.
- **Required relationships:** One target `Opportunity` or related public fact.
- **Optional relationships:** Reporter `UserAccount`, official source,
  verification record, and review assignment. Guest submission does not create an
  account.
- **Lifecycle states:** `submitted`, `triaged`, `duplicate`, `assigned`,
  `investigating`, `resolved`, `rejected`, `closed`, `redacted`.
- **Audit requirements:** Audit triage, assignment, evidence, status, resolution,
  redaction, and any public-data change; restrict and minimise reporter details.
- **Deletion behavior:** Delete optional reporter contact on request or retention
  expiry; retain a de-identified report and resolution when needed to support
  catalogue integrity and audit history.
- **Year 1 status:** `required later in Year 1`.

### 41. ReviewAssignment

- **Purpose:** Allocate a bounded verification or correction-review task to staff
  while enforcing separation of drafting, approval, and publishing duties.
- **Ownership:** Platform editorial operation.
- **Classification:** `Restricted operational data`.
- **Important identifiers:** `reviewAssignmentId`, subject reference, and assignee
  account/staff-subject ID.
- **Important fields:** Assignment kind, subject kind/ID, assignee, assigner,
  required role, priority, due time, status, conflict-of-interest declaration,
  reviewer outcome reference, and timestamps.
- **Required relationships:** One review subject and one assigned reviewer; staff
  identity and role eligibility must be established externally to this model.
- **Optional relationships:** Opportunity, correction report, official source,
  verification record, second approver, and predecessor assignment.
- **Lifecycle states:** `queued`, `assigned`, `accepted`, `in-review`, `blocked`,
  `completed`, `reassigned`, `cancelled`, `expired`.
- **Audit requirements:** Audit assignment, acceptance, reassignment, conflicts,
  completion, override, and segregation-of-duty checks.
- **Deletion behavior:** Retain completed assignments with staff IDs minimised or
  pseudonymised under retention policy; delete cancelled unused assignments only
  when no audit obligation remains.
- **Year 1 status:** `required later in Year 1`.

### 42. AuditLog

- **Purpose:** Provide tamper-evident accountability for security, privacy,
  editorial, administrative, AI-governance, and deletion actions.
- **Ownership:** Platform security and compliance operation.
- **Classification:** `Restricted operational data`.
- **Important identifiers:** `auditLogId`, event correlation ID, actor reference,
  subject reference, and event time.
- **Important fields:** Event type, actor kind/ID, subject kind/ID, action,
  outcome, reason code, minimal redacted change summary, request/service context,
  retention class, integrity metadata, and timestamp. No secrets, credentials,
  note bodies, document content, or unnecessary personal values are allowed.
- **Required relationships:** One accountable actor (user, staff, or system
  service) and one action/subject context.
- **Optional relationships:** Review assignment, verification record, correction
  report, feature flag, advertisement placement, AI interaction, and pseudonymous
  user account reference.
- **Lifecycle states:** `active`, `access-restricted`, `retention-held`,
  `anonymised`, `expired`.
- **Audit requirements:** The log is itself append-only and access to it is
  audited; integrity verification, redaction, retention hold, and expiry require
  privileged recorded actions.
- **Deletion behavior:** Never silently erase an in-retention event. On user
  deletion, remove direct identifiers where accountability permits, retain a
  pseudonymous event, then expire it according to the bounded retention class.
- **Year 1 status:** `required immediately`.

### 43. AIInteractionRecord

- **Purpose:** Record the minimum metadata necessary to operate, explain, limit,
  and investigate a source-grounded AI interaction without making AI an
  eligibility authority or application-submission agent.
- **Ownership:** The student owns their prompt/response data; the platform controls
  operational and safety metadata.
- **Classification:** `Sensitive personal metadata`.
- **Important identifiers:** `aiInteractionRecordId`, owner-context ID, and
  request correlation ID.
- **Important fields:** Feature purpose, model/provider identifier, prompt and
  response retention mode, redacted/minimised prompt/response only when explicitly
  necessary, source IDs/citations, deterministic result reference, token/usage
  counts, safety outcome, consent version, created time, and expiry time.
- **Required relationships:** Exactly one browser-local guest owner or
  `UserAccount` when a retained record exists; all opportunity-fact answers require
  applicable official-source references.
- **Optional relationships:** Opportunity, verification records, eligibility-rule
  version/result reference, AI usage quota, and audit log. An ephemeral request
  may retain no prompt/response body.
- **Lifecycle states:** `requested`, `completed`, `refused`, `failed`, `redacted`,
  `retention-expired`, `deleted`.
- **Audit requirements:** Audit consent, model/policy version, citations,
  deterministic-result boundary, safety actions, staff access, redaction, and
  deletion. AI cannot approve public facts or override eligibility.
- **Deletion behavior:** User may delete retained content; prompts/responses
  expire quickly by default, while de-identified cost/safety counters may remain
  for a bounded period. Remove unnecessary sensitive content immediately.
- **Year 1 status:** `required later in Year 1`.

### 44. AIUsageQuota

- **Purpose:** Enforce free-first per-feature usage limits and cost protections
  without using content for quota decisions.
- **Ownership:** Platform operations; a student's attributable usage remains
  private to that student and authorised operators.
- **Classification:** `Restricted operational data`.
- **Important identifiers:** `aiUsageQuotaId`, subject/anonymous-session reference,
  feature code, and quota period key.
- **Important fields:** Limit, consumed units, reserved units, period start/end,
  reset policy, cost estimate, last-updated time, and enforcement status. No prompt
  or response content is stored here.
- **Required relationships:** One bounded subject context, feature, and quota
  period.
- **Optional relationships:** User account, guest anonymous session, AI interaction
  records, feature flag, and audit events.
- **Lifecycle states:** `active`, `near-limit`, `exhausted`, `reset`, `suspended`,
  `expired`.
- **Audit requirements:** Audit limit changes, manual grants, overrides, billing
  anomalies, resets, and enforcement failures.
- **Deletion behavior:** On user deletion, remove account linkage and retain only
  de-identified aggregate cost counters through a short finance/security period.
- **Year 1 status:** `required later in Year 1`.

### 45. FeatureFlag

- **Purpose:** Control staged rollout, emergency disablement, and free-tier limits
  for features without embedding secret configuration in clients.
- **Ownership:** Platform product and operations staff.
- **Classification:** `Restricted operational data`.
- **Important identifiers:** `featureFlagId` and unique stable `key`.
- **Important fields:** Description, enabled state, environment, audience rule,
  percentage rollout, start/end time, owner, expiry/review date, safety kill-switch
  status, and non-secret configuration. Secrets are never flag values.
- **Required relationships:** One accountable operational owner.
- **Optional relationships:** AI quotas, advertisement placements, and audit logs.
- **Lifecycle states:** `draft`, `scheduled`, `active`, `paused`, `expired`,
  `retired`.
- **Audit requirements:** Audit every value, audience, rollout, override, and
  emergency change with actor, reason, and before/after state.
- **Deletion behavior:** Retire and retain the change history for used flags;
  delete only unused drafts.
- **Year 1 status:** `required later in Year 1`.

### 46. AdvertisementPlacement

- **Purpose:** Define a controlled, reviewable location and campaign configuration
  for advertising without altering organic opportunity facts or rankings.
- **Ownership:** Platform commercial operations.
- **Classification:** `Restricted operational data`.
- **Important identifiers:** `advertisementPlacementId`, stable placement code,
  and optional campaign reference.
- **Important fields:** Surface/slot, format, advertiser display identity, creative
  reference, destination URL, start/end time, jurisdiction/audience constraints,
  frequency cap, approval state, budget/cost guard, disclosure requirement, and
  safety-review outcome. No sensitive-profile targeting is allowed.
- **Required relationships:** One accountable commercial owner and, before
  activation, one approved `SponsoredOpportunityDisclosure` or equivalent visible
  ad disclosure.
- **Optional relationships:** Organisation/advertiser, sponsored opportunity,
  feature flag, review assignment, and audit log.
- **Lifecycle states:** `draft`, `compliance-review`, `approved`, `scheduled`,
  `active`, `paused`, `completed`, `rejected`, `archived`.
- **Audit requirements:** Audit advertiser, targeting constraints, creative/link,
  approval, schedule, cost, pause, and impression/click measurement policy.
- **Deletion behavior:** Archive completed/served placements and retain minimal
  commercial/audit records; delete rejected unused drafts when retention permits.
- **Year 1 status:** `required later in Year 1`.

### 47. SponsoredOpportunityDisclosure

- **Purpose:** Provide an explicit public disclosure whenever payment,
  sponsorship, or commercial influence is associated with an opportunity or
  placement.
- **Ownership:** Platform commercial/editorial governance; sponsor identity is
  attributed to its organisation.
- **Classification:** `Public`.
- **Important identifiers:** `sponsoredOpportunityDisclosureId`, sponsored subject
  ID, and disclosure version.
- **Important fields:** Visible label, sponsor display name, relationship type,
  plain-language explanation, effective dates, placement scope, editorial
  independence statement, approval state, and last-reviewed time.
- **Required relationships:** One `AdvertisementPlacement` or explicitly sponsored
  `Opportunity`, and an accountable approving staff identity. Sponsored
  opportunities still require the same official-source verification as organic
  records.
- **Optional relationships:** Sponsor organisation, provider, verification record,
  and successor disclosure version.
- **Lifecycle states:** `draft`, `in-review`, `approved`, `active`, `expired`,
  `superseded`, `withdrawn`.
- **Audit requirements:** Version and audit sponsor identity, wording,
  relationship, approval, dates, placement, and withdrawal. Sponsorship must never
  silently change verification status or deterministic ranking.
- **Deletion behavior:** Retain disclosures for served ads and historical
  sponsored periods; withdraw visibly when invalid and delete only unused drafts.
- **Year 1 status:** `required later in Year 1`.

## Boundary summary

- The public catalogue ends at source-backed opportunity, taxonomy, deadline,
  intake, funding, eligibility, and document-requirement facts.
- The personal workspace begins at guest-local or account-owned profile,
  shortlist, tracker, notes, tasks, document metadata, reminders, and AI records.
- Staff-only review, audit, feature-control, AI-quota, and advertising operations
  never grant routine access to a student's private workspace.
- `MasterDocumentRecord` and `ApplicationDocumentProgress` are metadata-only.
  Sensitive file upload/storage is outside this model and prohibited in Year 1.
- Advertisement status is explicit and cannot purchase verification, eligibility,
  publication approval, or an undisclosed ranking advantage.
