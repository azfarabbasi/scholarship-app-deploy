# V1 product backlog

## Purpose and rules

This backlog translates the Checkpoint 1-7 roadmap into testable product outcomes. It does not authorise implementation during Checkpoint 0. `Must`, `Should`, and `Could` items are candidates for Year 1; `Won't in Year 1` records an explicit boundary rather than an omitted idea. Every item retains the free-first, guest-mode, source-verification, privacy, accessibility, and no-autonomous-submission constraints.

## Checkpoint 1: Public PWA Alpha

### C1-01 — Publication-gated opportunity catalogue

- **Checkpoint:** Checkpoint 1
- **Priority:** Must
- **User value:** Visitors can browse a coherent catalogue without creating an account.
- **Dependencies:** ADR-005 and the versioned seed; only explicitly publishable records may appear as current facts.
- **Acceptance summary:** The publication gate excludes drafts and unsupported or unverified facts; the public catalogue distinguishes the precision and confidence of qualified verified, estimated, rolling, unknown, and passed-cycle deadline facts.
- **Security/privacy consideration:** Public output contains no private user or reviewer-only data.
- **Test requirement:** Automated fixture, empty, invalid-data, and publication-filter tests plus keyboard/screen-reader smoke tests.
- **Deferred status:** Not deferred.

### C1-02 — Source-aware opportunity detail

- **Checkpoint:** Checkpoint 1
- **Priority:** Must
- **User value:** A visitor can understand the opportunity, uncertainty, official source, and last-checked state.
- **Dependencies:** C1-01 and deadline-intelligence specification.
- **Acceptance summary:** Details expose source, verification, cycle, precision, and safe official-link behavior without implying application submission.
- **Security/privacy consideration:** Only approved public evidence is rendered; outbound links use safe browser attributes.
- **Test requirement:** Route, metadata, missing-source fail-closed, link-security, zoom, and assistive-technology tests.
- **Deferred status:** Not deferred.

### C1-03 — Deadline-intelligence presentation

- **Checkpoint:** Checkpoint 1
- **Priority:** Must
- **User value:** Students can distinguish actionable, estimated, rolling, unknown, and passed-cycle deadlines.
- **Dependencies:** C1-01 and existing deadline contracts/scenarios.
- **Acceptance summary:** Labels, colors, and countdown gates conform to the specification; no date is rolled into a future cycle.
- **Security/privacy consideration:** Unverified or timezone-less facts never receive authoritative countdowns or action colors.
- **Test requirement:** Automated scenario coverage for all precision, lifecycle, timezone, DST, leap-year, and invalid-date cases.
- **Deferred status:** Not deferred.

### C1-04 — Accessible discovery and filtering

- **Checkpoint:** Checkpoint 1
- **Priority:** Must
- **User value:** Visitors can find opportunities by type, location, level, field, funding, and deadline confidence.
- **Dependencies:** C1-01 and approved taxonomy contracts.
- **Acceptance summary:** Filters are URL-preserving, resettable, keyboard accessible, responsive, and honest about result counts.
- **Security/privacy consideration:** Searches are not tied to personal profiles or unnecessary identifiers.
- **Test requirement:** Unit tests for filter combinations, end-to-end keyboard tests, and WCAG-oriented automated checks.
- **Deferred status:** Not deferred.

### C1-05 — Local guest shortlist and tracker

- **Checkpoint:** Checkpoint 1
- **Priority:** Must
- **User value:** A guest can save opportunities and basic preparation progress without registration.
- **Dependencies:** ADR-002 and a versioned local-storage contract.
- **Acceptance summary:** Guest state is local, validated, exportable, resettable, and resilient to schema upgrades; it never creates cloud records silently.
- **Security/privacy consideration:** No sensitive files, credentials, or hidden remote analytics identifiers are stored with guest state.
- **Test requirement:** Storage failure, corruption, quota, export/import, reset, and browser-origin migration tests.
- **Deferred status:** Not deferred.

### C1-06 — Installable responsive PWA alpha

- **Checkpoint:** Checkpoint 1
- **Priority:** Should
- **User value:** The public experience works well on phones and can be installed where supported.
- **Dependencies:** C1-01 through C1-05 and ADR-009.
- **Acceptance summary:** Manifest, icons, update behavior, offline shell, and stale-data messaging are defined without caching facts as newly verified.
- **Security/privacy consideration:** Caches exclude private data and expose a clear purge/update path.
- **Test requirement:** Responsive matrix, installability, offline/reconnect, cache-version, reduced-motion, and Lighthouse-style audits.
- **Deferred status:** Not deferred.

## Checkpoint 2: Verified Database and Admin System

### C2-01 — Relational opportunity catalogue

- **Checkpoint:** Checkpoint 2
- **Priority:** Must
- **User value:** Public facts can be updated safely without shipping hard-coded files.
- **Dependencies:** ADR-006, domain model, and approved migration plan.
- **Acceptance summary:** PostgreSQL-oriented migrations enforce identifiers, relationships, lifecycle states, soft archival, and public/private boundaries.
- **Security/privacy consideration:** Database access is deny-by-default and no production credentials enter source control.
- **Test requirement:** Migration up/down, referential-integrity, constraint, backup/restore, and least-privilege tests.
- **Deferred status:** Not deferred.

### C2-02 — Official-source verification workflow

- **Checkpoint:** Checkpoint 2
- **Priority:** Must
- **User value:** Published opportunity facts have visible, auditable evidence.
- **Dependencies:** C2-01, ADR-005, OfficialSource, VerificationRecord, and SourceEvidence.
- **Acceptance summary:** Reviewers can capture evidence, verification status, last-checked time, staleness, conflicts, and supersession without overwriting history.
- **Security/privacy consideration:** Reviewer drafts/notes remain internal and sensitive actions are audited.
- **Test requirement:** State-machine, evidence-integrity, stale/conflict, concurrency, and audit-history tests.
- **Deferred status:** Not deferred.

### C2-03 — Staff draft and review workspace

- **Checkpoint:** Checkpoint 2
- **Priority:** Must
- **User value:** Staff can prepare and review catalogue changes before publication.
- **Dependencies:** C2-01, C2-02, roles-and-permissions policy.
- **Acceptance summary:** Draft, review, changes-requested, approved, published, archived, and restored states enforce separation of duties.
- **Security/privacy consideration:** Reviewers cannot publish their own unreviewed work; privileged actions require attribution.
- **Test requirement:** Role matrix, ownership, self-approval denial, concurrent-edit, and audit-log tests.
- **Deferred status:** Not deferred.

### C2-04 — Taxonomy and provider administration

- **Checkpoint:** Checkpoint 2
- **Priority:** Should
- **User value:** Opportunity types, providers, locations, study levels, fields, and funding classifications stay consistent.
- **Dependencies:** C2-01 and domain taxonomy entities.
- **Acceptance summary:** Controlled vocabularies support aliases, archival, safe merges, and impact previews without deleting historical references.
- **Security/privacy consideration:** Taxonomy changes are staff-only and audited.
- **Test requirement:** Uniqueness, merge, archive, referential-impact, and permission tests.
- **Deferred status:** Not deferred.

### C2-05 — Correction and reviewer assignment queues

- **Checkpoint:** Checkpoint 2
- **Priority:** Must
- **User value:** Users can report suspected errors and staff can triage them transparently.
- **Dependencies:** C2-02, C2-03, CorrectionReport, and ReviewAssignment.
- **Acceptance summary:** Reports can be deduplicated, prioritised, assigned, resolved, rejected with reason, and linked to resulting revisions.
- **Security/privacy consideration:** Reporter identity is minimised; abuse controls and internal notes are separated from public outcomes.
- **Test requirement:** Submission, spam/rate-limit, assignment, state-transition, privacy, and notification tests.
- **Deferred status:** Not deferred.

### C2-06 — Append-oriented catalogue audit history

- **Checkpoint:** Checkpoint 2
- **Priority:** Must
- **User value:** Material changes and publication decisions can be reconstructed.
- **Dependencies:** C2-01 through C2-05 and AuditLog.
- **Acceptance summary:** Who, what, when, target, reason, before/after references, and correlation IDs are retained with protected access.
- **Security/privacy consideration:** Logs exclude secrets and unnecessary student data and follow a reviewed retention policy.
- **Test requirement:** Immutability, redaction, access-control, retention, correlation, and export tests.
- **Deferred status:** Not deferred.

## Checkpoint 3: Personal Workspace and Cloud Sync

### C3-01 — Optional student accounts

- **Checkpoint:** Checkpoint 3
- **Priority:** Must
- **User value:** Students who opt in can synchronise their workspace across devices.
- **Dependencies:** ADR-002, selected authentication architecture, and privacy review.
- **Acceptance summary:** Account creation, sign-in, recovery, session revocation, and account deletion work without removing guest access.
- **Security/privacy consideration:** Passwords/credentials are never visible to roles or logs; secrets remain server-side.
- **Test requirement:** Authentication-provider integration, session, recovery, abuse, deletion, and access-control tests.
- **Deferred status:** Not deferred.

### C3-02 — Confirmed guest-to-account migration

- **Checkpoint:** Checkpoint 3
- **Priority:** Must
- **User value:** A guest can deliberately carry selected local work into an account.
- **Dependencies:** C1-05 and C3-01.
- **Acceptance summary:** A preview, explicit confirmation, merge/conflict rules, idempotency, and failure recovery prevent silent or duplicated migration.
- **Security/privacy consideration:** No local data leaves the device before confirmation.
- **Test requirement:** Cancel, partial failure, retry, duplicate, conflict, and cross-account isolation tests.
- **Deferred status:** Not deferred.

### C3-03 — Student profile and experience records

- **Checkpoint:** Checkpoint 3
- **Priority:** Should
- **User value:** Students can maintain reusable education, work, research, publication, certification, and language-test metadata.
- **Dependencies:** C3-01 and privacy-boundary approval.
- **Acceptance summary:** Every profile section is optional, editable, exportable, deletable, and records provenance/updated time without claiming verification.
- **Security/privacy consideration:** Data minimisation, field-level sensitivity, owner-only access, and exceptional audited support access apply.
- **Test requirement:** CRUD, validation, export, deletion, authorisation, and sensitive-log-redaction tests.
- **Deferred status:** Not deferred.

### C3-04 — Cloud shortlist and application tracker

- **Checkpoint:** Checkpoint 3
- **Priority:** Must
- **User value:** Account holders can track applications, stages, activities, notes, and tasks consistently across devices.
- **Dependencies:** C3-01, C3-02, SavedOpportunity, and ApplicationTracker contracts.
- **Acceptance summary:** User-owned tracking remains separate from public catalogue truth and supports history, offline conflict handling, and deletion.
- **Security/privacy consideration:** Students can access only their own records; staff have no routine visibility.
- **Test requirement:** Ownership, sync conflict, stage history, offline retry, export, and cascade-deletion tests.
- **Deferred status:** Not deferred.

### C3-05 — Metadata-only master document register

- **Checkpoint:** Checkpoint 3
- **Priority:** Must
- **User value:** Students can record whether reusable documents are ready, current, expiring, or need revision.
- **Dependencies:** ADR-003 and document metadata contracts.
- **Acceptance summary:** Records contain only template/type, readiness status, optional expiry date, version label, requirement relationships, timestamps, and a minimal reviewed display label; application requirements can reference that metadata.
- **Security/privacy consideration:** File bytes, paths, URLs, previews, extracted content, passports, transcripts, certificates, and financial documents are rejected.
- **Test requirement:** Schema prohibition, payload fuzzing, export/deletion, expiry, ownership, and log-redaction tests.
- **Deferred status:** Not deferred.

### C3-06 — Private-data export and permanent deletion

- **Checkpoint:** Checkpoint 3
- **Priority:** Must
- **User value:** Students can retrieve and permanently delete their cloud-held personal data.
- **Dependencies:** C3-01 through C3-05 and ownership/deletion policy.
- **Acceptance summary:** Export is machine-readable and scoped; deletion confirms consequences, removes active/backup data under policy, and retains only minimal lawful/audit tombstones.
- **Security/privacy consideration:** Reauthentication, secure delivery, anti-enumeration, and deletion verification are mandatory.
- **Test requirement:** Full-scope export, omission detection, deletion/cascade, backup expiry, audit tombstone, and cross-user tests.
- **Deferred status:** Not deferred.

### C3-07 — Sensitive student document file uploads

- **Checkpoint:** Checkpoint 3
- **Priority:** Won't in Year 1
- **User value:** No Year 1 value justifies the added breach and retention risk; metadata covers core planning.
- **Dependencies:** A future ADR, legal review, threat model, secure storage, and incident capability.
- **Acceptance summary:** No Year 1 endpoint, UI, schema, or storage accepts sensitive student document files.
- **Security/privacy consideration:** This prohibition includes passports, transcripts, certificates, and financial documents.
- **Test requirement:** Validator and security tests prove file/blob/path/upload capabilities remain absent.
- **Deferred status:** Deferred beyond Year 1.

## Checkpoint 4: Discovery, Eligibility and Notifications

### C4-01 — Structured deterministic eligibility rules

- **Checkpoint:** Checkpoint 4
- **Priority:** Must
- **User value:** Students receive reproducible eligibility results with rule-level reasons.
- **Dependencies:** ADR-004, verified eligibility sources, EligibilityRule, and EligibilityRuleGroup.
- **Acceptance summary:** The engine returns eligible, ineligible, conditional, or unknown without using AI as the decision maker.
- **Security/privacy consideration:** Only necessary profile fields are evaluated; unknown inputs never become optimistic matches.
- **Test requirement:** Rule truth tables, boundary values, missing/conflicting facts, versioning, and explanation-trace tests.
- **Deferred status:** Not deferred.

### C4-02 — Consent-based profile matching

- **Checkpoint:** Checkpoint 4
- **Priority:** Must
- **User value:** A student can opt in to compare selected profile fields with verified opportunities.
- **Dependencies:** C3-03 and C4-01.
- **Acceptance summary:** Matching shows inputs used, reasons, uncertainty, and a way to exclude fields or disable personalisation.
- **Security/privacy consideration:** No hidden profiling; matching data is not sold or repurposed for advertising.
- **Test requirement:** Consent, field selection, deterministic repeatability, access control, and deletion tests.
- **Deferred status:** Not deferred.

### C4-03 — Explainable discovery ranking

- **Checkpoint:** Checkpoint 4
- **Priority:** Should
- **User value:** Students can prioritise relevant opportunities without opaque scoring.
- **Dependencies:** C1-04, C4-01, and C4-02.
- **Acceptance summary:** Ranking factors are documented, user-adjustable where appropriate, and distinguish eligibility from preference.
- **Security/privacy consideration:** Sensitive attributes are excluded unless essential, consented, and reviewed for fairness.
- **Test requirement:** Determinism, factor attribution, fairness review fixtures, empty profile, and opt-out tests.
- **Deferred status:** Not deferred.

### C4-04 — Saved searches and update awareness

- **Checkpoint:** Checkpoint 4
- **Priority:** Could
- **User value:** Students can return to useful discovery criteria and see verified changes.
- **Dependencies:** C3-01, C1-04, and catalogue revision history.
- **Acceptance summary:** Saved criteria are editable/deletable and update indicators distinguish fact revisions from new opportunities.
- **Security/privacy consideration:** Search history is private user data and excluded from advertising profiles.
- **Test requirement:** Ownership, query versioning, update diff, deletion, and notification preference tests.
- **Deferred status:** Not deferred.

### C4-05 — In-app reminders and notification preferences

- **Checkpoint:** Checkpoint 4
- **Priority:** Must
- **User value:** Students can receive timely reminders for their own verified deadlines and tasks.
- **Dependencies:** C3-04, deadline intelligence, Reminder, and NotificationPreference.
- **Acceptance summary:** Reminders are opt-in, timezone-aware, cancellable, deduplicated, and suppressed when source facts become stale/conflicting.
- **Security/privacy consideration:** Message content minimises personal data and delivery logs have limited retention.
- **Test requirement:** Scheduling, DST/timezone, retry, duplicate suppression, revocation, stale-source, and ownership tests.
- **Deferred status:** Not deferred.

### C4-06 — Free-tier external notification adapter

- **Checkpoint:** Checkpoint 4
- **Priority:** Could
- **User value:** Opted-in students may receive a bounded external reminder when a sustainable free channel is approved.
- **Dependencies:** C4-05, cost/privacy review, and provider exit plan.
- **Acceptance summary:** The adapter is optional, quota-limited, replaceable, and degrades to in-app reminders without data loss.
- **Security/privacy consideration:** No paid email, SMS, or WhatsApp dependency; addresses/tokens are restricted and deletable.
- **Test requirement:** Quota, provider outage, fallback, unsubscribe, secret isolation, and cost-limit tests.
- **Deferred status:** Not deferred.

### C4-07 — Paid SMS or WhatsApp dependency

- **Checkpoint:** Checkpoint 4
- **Priority:** Won't in Year 1
- **User value:** The product avoids cost and lock-in that do not fit the Year 1 ceiling.
- **Dependencies:** A future commercial and privacy decision.
- **Acceptance summary:** Core reminders remain usable without paid SMS or WhatsApp.
- **Security/privacy consideration:** Phone numbers are not collected for an inactive channel.
- **Test requirement:** Configuration and fallback tests prove core workflows have no paid-channel requirement.
- **Deferred status:** Deferred beyond Year 1.

## Checkpoint 5: Source-Grounded AI Assistant

### C5-01 — Source-grounded opportunity assistant

- **Checkpoint:** Checkpoint 5
- **Priority:** Should
- **User value:** Students can ask questions and receive answers tied to approved opportunity evidence.
- **Dependencies:** C2-02, C4-01, ADR-004, and AI privacy evaluation.
- **Acceptance summary:** Every material answer cites current approved sources, exposes uncertainty, and refuses unsupported claims.
- **Security/privacy consideration:** Private profile data is excluded by default and sensitive prompt content is minimised.
- **Test requirement:** Citation coverage, hallucination/refusal, stale-source, adversarial prompt, and accessibility tests.
- **Deferred status:** Not deferred.

### C5-02 — Deterministic-result explanation

- **Checkpoint:** Checkpoint 5
- **Priority:** Should
- **User value:** Students can understand structured eligibility outcomes in plain language.
- **Dependencies:** C4-01 and C5-01.
- **Acceptance summary:** AI explains supplied rule results without changing the result, inventing exceptions, or claiming final admission eligibility.
- **Security/privacy consideration:** Only the minimum rule/profile context needed for explanation is sent.
- **Test requirement:** Outcome-preservation, reason completeness, prompt-injection, privacy-redaction, and regression tests.
- **Deferred status:** Not deferred.

### C5-03 — Human-reviewed extraction suggestions

- **Checkpoint:** Checkpoint 5
- **Priority:** Could
- **User value:** Reviewers can draft structured facts faster while retaining authority.
- **Dependencies:** ADR-010, C2-02, and C2-03.
- **Acceptance summary:** Suggestions link exact source evidence and cannot publish or change verification without human approval.
- **Security/privacy consideration:** Source content and model outputs follow retention and vendor-review policy.
- **Test requirement:** Extraction accuracy set, evidence alignment, approval separation, rejection, and audit-log tests.
- **Deferred status:** Not deferred.

### C5-04 — AI interaction records and quota controls

- **Checkpoint:** Checkpoint 5
- **Priority:** Must
- **User value:** AI remains available within the cost ceiling and users can understand usage limits.
- **Dependencies:** AIInteractionRecord, AIUsageQuota, and ADR-008.
- **Acceptance summary:** Usage is metered by purpose/period, hard-limited, observable, and recoverable without storing unnecessary prompt content.
- **Security/privacy consideration:** Records separate metrics from optional content; restricted access and deletion/retention policies apply.
- **Test requirement:** Quota concurrency, reset, abuse, redaction, deletion, and cost-ceiling tests.
- **Deferred status:** Not deferred.

### C5-05 — AI safety and quality evaluation gate

- **Checkpoint:** Checkpoint 5
- **Priority:** Must
- **User value:** Unsafe or low-quality AI behavior is blocked before release.
- **Dependencies:** C5-01 through C5-04.
- **Acceptance summary:** Versioned evaluations define minimum citation, refusal, privacy, determinism-boundary, and extraction-quality thresholds.
- **Security/privacy consideration:** Evaluation data contains no unnecessary real student records.
- **Test requirement:** Automated evaluation suite, red-team cases, model-change regression, and kill-switch test.
- **Deferred status:** Not deferred.

### C5-06 — Autonomous eligibility or application decisions

- **Checkpoint:** Checkpoint 5
- **Priority:** Won't in Year 1
- **User value:** Students are protected from opaque, unaudited high-impact automation.
- **Dependencies:** A new governance decision would be required.
- **Acceptance summary:** AI cannot override deterministic eligibility, verify facts, publish records, or submit applications.
- **Security/privacy consideration:** High-impact decisions remain human/rule governed.
- **Test requirement:** Permission and adversarial tests prove autonomous decision paths are absent.
- **Deferred status:** Deferred beyond Year 1.

## Checkpoint 6: Production Hardening, SEO and Advertising

### C6-01 — Security and privacy hardening gate

- **Checkpoint:** Checkpoint 6
- **Priority:** Must
- **User value:** The production service protects public and private workflows under realistic abuse.
- **Dependencies:** All implemented Checkpoints 1-5 capabilities.
- **Acceptance summary:** Threat model, dependency review, security headers, rate limits, secret rotation, access review, and incident playbooks pass release criteria.
- **Security/privacy consideration:** Critical issues block release; staff/private access is least-privilege and auditable.
- **Test requirement:** SAST/dependency checks, penetration scenarios, authorisation matrix, secret scan, and incident exercise.
- **Deferred status:** Not deferred.

### C6-02 — Performance and PWA resilience

- **Checkpoint:** Checkpoint 6
- **Priority:** Must
- **User value:** The product remains fast and understandable on constrained devices and networks.
- **Dependencies:** C1-06 and production-like data volumes.
- **Acceptance summary:** Performance budgets, cache safety, graceful offline/reconnect, and update rollback targets are met.
- **Security/privacy consideration:** Caches do not retain private responses or misrepresent stale public facts.
- **Test requirement:** Load, Web Vitals, low-end device, offline, cache poisoning, and rollback tests.
- **Deferred status:** Not deferred.

### C6-03 — Search-engine discoverability

- **Checkpoint:** Checkpoint 6
- **Priority:** Should
- **User value:** Verified public opportunities can be discovered through search engines.
- **Dependencies:** Publication-gated catalogue and stable public routes.
- **Acceptance summary:** Metadata, canonical URLs, sitemaps, robots rules, and structured data include only approved public facts.
- **Security/privacy consideration:** Private routes and draft/unverified records are never indexed.
- **Test requirement:** Metadata snapshot, canonical, sitemap, robots, structured-data, and accidental-index tests.
- **Deferred status:** Not deferred.

### C6-04 — Privacy-conscious observability

- **Checkpoint:** Checkpoint 6
- **Priority:** Must
- **User value:** Failures can be diagnosed without turning logs into a shadow profile store.
- **Dependencies:** Privacy boundary, ownership policy, and AuditLog design.
- **Acceptance summary:** Metrics, errors, logs, retention, redaction, access, alerts, and deletion/anonymisation behavior are documented and exercised.
- **Security/privacy consideration:** No secrets or sensitive file content; personal identifiers are minimised and retention limited.
- **Test requirement:** Redaction fixtures, retention jobs, alert routing, access control, and incident correlation tests.
- **Deferred status:** Not deferred.

### C6-05 — Controlled advertisement placements

- **Checkpoint:** Checkpoint 6
- **Priority:** Could
- **User value:** Clearly separated advertising may support operations without corrupting opportunity ranking.
- **Dependencies:** AdvertisementPlacement, privacy review, accessibility review, and commercial approval.
- **Acceptance summary:** Placements are bounded, labelled, dismissible where appropriate, non-deceptive, and independent of eligibility/ranking.
- **Security/privacy consideration:** No sale of student data or sensitive targeting; third-party scripts require explicit review.
- **Test requirement:** Disclosure visibility, ranking independence, keyboard/reader access, content safety, and analytics-minimisation tests.
- **Deferred status:** Not deferred.

### C6-06 — Sponsored opportunity disclosure

- **Checkpoint:** Checkpoint 6
- **Priority:** Could
- **User value:** Users can distinguish paid prominence from editorial verification.
- **Dependencies:** C6-05 and SponsoredOpportunityDisclosure.
- **Acceptance summary:** Sponsor identity, paid relationship, placement period, and disclosure history are public; sponsorship cannot bypass verification.
- **Security/privacy consideration:** Commercial access cannot alter reviewer decisions or private data.
- **Test requirement:** Disclosure completeness, expiration, verification-gate, audit, and ranking-separation tests.
- **Deferred status:** Not deferred.

### C6-07 — Native mobile applications

- **Checkpoint:** Checkpoint 6
- **Priority:** Won't in Year 1
- **User value:** Effort stays focused on a reliable responsive PWA.
- **Dependencies:** A future ADR based on demonstrated PWA limitations.
- **Acceptance summary:** Year 1 launch has no native-app dependency.
- **Security/privacy consideration:** No additional mobile credential or telemetry surface is introduced.
- **Test requirement:** PWA capability and documented limitation review.
- **Deferred status:** Deferred beyond Year 1.

## Checkpoint 7: Commercial Public Launch

### C7-01 — Launch publication and data-quality gate

- **Checkpoint:** Checkpoint 7
- **Priority:** Must
- **User value:** Public launch contains source-backed, current, clearly qualified opportunities.
- **Dependencies:** All publication, verification, deadline, and correction workflows.
- **Acceptance summary:** No unverified fact is presented as verified; stale/conflicting records fail closed; launch inventory is signed off.
- **Security/privacy consideration:** Draft/internal/private fields are absent from public payloads.
- **Test requirement:** Full catalogue audit, source sampling, permission, stale-data, and public-payload tests.
- **Deferred status:** Not deferred.

### C7-02 — User-facing privacy and control centre

- **Checkpoint:** Checkpoint 7
- **Priority:** Must
- **User value:** Users understand collection, consent, exports, deletion, notifications, AI, analytics, and advertising choices.
- **Dependencies:** Implemented personal/AI/analytics/advertising scope and legal review.
- **Acceptance summary:** Controls are accessible, truthful, effective, and linked to current policy/version records.
- **Security/privacy consideration:** Consent is specific and revocable; dark patterns are prohibited.
- **Test requirement:** Consent/revocation, export/delete, preference propagation, versioning, and accessibility tests.
- **Deferred status:** Not deferred.

### C7-03 — Operational support and correction commitments

- **Checkpoint:** Checkpoint 7
- **Priority:** Must
- **User value:** Users have a dependable path to report errors and receive status updates.
- **Dependencies:** C2-05, staffing plan, and operational runbooks.
- **Acceptance summary:** Published service targets, escalation, abuse handling, and emergency unpublish procedures are exercised.
- **Security/privacy consideration:** Support identity checks minimise exposure and private data is not requested casually.
- **Test requirement:** Correction lifecycle, escalation drill, emergency archive, communication, and audit tests.
- **Deferred status:** Not deferred.

### C7-04 — Privacy-minimised product analytics

- **Checkpoint:** Checkpoint 7
- **Priority:** Should
- **User value:** Product improvements use aggregate evidence without selling or over-collecting student behavior.
- **Dependencies:** Privacy review, analytics event contract, and retention limits.
- **Acceptance summary:** Event purposes, fields, retention, opt-out where required, and aggregate reporting are documented.
- **Security/privacy consideration:** No sensitive profile, notes, document metadata, or raw AI content enters general analytics.
- **Test requirement:** Event-schema allowlist, identifier minimisation, retention, opt-out, and deletion/anonymisation tests.
- **Deferred status:** Not deferred.

### C7-05 — Commercial and cost-control launch gate

- **Checkpoint:** Checkpoint 7
- **Priority:** Must
- **User value:** The service can operate sustainably without surprise costs or paid-channel dependency.
- **Dependencies:** ADR-008, usage quotas, advertising decisions, and cost model.
- **Acceptance summary:** Year 1 forecast stays within USD 100, alerts/hard limits exist, and each vendor has an exit path.
- **Security/privacy consideration:** Revenue choices cannot sell student data or weaken verification independence.
- **Test requirement:** Quota exhaustion, spend alert, vendor outage, fallback, and financial rollback exercises.
- **Deferred status:** Not deferred.

### C7-06 — Release, rollback, and incident readiness

- **Checkpoint:** Checkpoint 7
- **Priority:** Must
- **User value:** Launch failures can be contained without losing user or verification data.
- **Dependencies:** Production deployment, backups, observability, and release governance.
- **Acceptance summary:** Versioned release, migration backup, rollback, restore, status communication, and ownership are rehearsed.
- **Security/privacy consideration:** Incident evidence is protected and breach escalation follows the approved plan.
- **Test requirement:** Staging promotion, failed migration, application rollback, data restore, and incident simulation.
- **Deferred status:** Not deferred.

### C7-07 — Autonomous scholarship or internship submission

- **Checkpoint:** Checkpoint 7
- **Priority:** Won't in Year 1
- **User value:** Users retain control over consequential applications and official portals.
- **Dependencies:** No Year 1 implementation is authorised.
- **Acceptance summary:** ScholarTrack may link to official sources but cannot submit, sign, or attest an application for a user.
- **Security/privacy consideration:** The platform does not collect credentials or sensitive files for autonomous submission.
- **Test requirement:** Route, permission, integration, and AI-action tests prove no submission path exists.
- **Deferred status:** Deferred beyond Year 1.
