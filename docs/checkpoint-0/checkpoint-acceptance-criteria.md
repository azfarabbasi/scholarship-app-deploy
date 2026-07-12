# Checkpoint acceptance criteria and definition of done

## Purpose

These are release gates, not aspirations. A checkpoint is accepted only when every `Must` item assigned to it meets its acceptance evidence, all global gates apply, and any exception is an explicit time-bounded decision with an owner and rollback plan. Passing a later checkpoint never retroactively excuses an earlier failed gate.

## Checkpoint 1: Public PWA Alpha

- Public catalogue routes render only records allowed by the publication gate; the 55-record seed is never implied to be verified.
- Source, verification, precision, last-checked state, and uncertainty are understandable without relying on color.
- Deadline behavior passes the formal scenario set and never rolls dates automatically.
- Search/filter/detail and local guest tracking work at supported viewport sizes and with keyboard navigation.
- Guest data is validated, local, exportable, and resettable; no cloud account is created.
- PWA caching cannot make stale facts appear newly verified, and offline/update states are explicit.
- Docker validation, lint, build, relevant automated tests, accessibility checks, and documentation all pass.

## Checkpoint 2: Verified Database and Admin System

- Reviewed relational migrations implement public, internal, and audit boundaries without importing seed records as verified.
- Official sources, evidence, verification history, cycles, deadlines, and taxonomies have enforced relationships and lifecycle states.
- Draft/review/approval/publication/archival permissions satisfy separation of duties; a reviewer cannot self-publish unreviewed work.
- Correction and assignment queues have complete ownership, attribution, and state histories.
- Backup, restore, rollback, and migration rehearsal pass with representative data.
- No database credential is exposed to clients, source control, logs, or public build output.
- Publication is blocked when source, verification, last-checked, scope, or required review evidence is missing.

## Checkpoint 3: Personal Workspace and Cloud Sync

- Guest mode remains fully usable and account creation is optional.
- Guest-to-account migration requires preview and explicit confirmation and is idempotent under retry.
- Students can access, export, and delete only their own profile, shortlist, tracker, task, note, reminder, and document-readiness metadata.
- Staff have no routine access to private student data; any exceptional support path is narrowly authorised and audited.
- Account deletion follows the ownership/deletion policy across active data, derived data, backups, and minimal audit tombstones.
- Master-document records contain metadata only; file/blob/path/content fields and sensitive document uploads are rejected.
- Sync conflict, offline recovery, session revocation, account recovery, and cross-account isolation tests pass.

## Checkpoint 4: Discovery, Eligibility and Notifications

- Eligibility uses versioned structured rules and deterministic outcomes before any AI explanation.
- Each outcome provides rule-level reasons and distinguishes ineligible, conditional, and unknown states.
- Profile-based matching is opt-in, minimised, explainable, revocable, and independent of advertising.
- Reminders are user-owned, timezone-aware, cancellable, deduplicated, and suppressed for stale/conflicting source facts.
- Core notification behavior has no paid email, SMS, or WhatsApp dependency and remains usable when external delivery fails.
- Fairness, boundary, missing-input, DST/timezone, consent, ownership, and deletion tests pass.

## Checkpoint 5: Source-Grounded AI Assistant

- AI answers material opportunity questions only from approved evidence and include usable citations and uncertainty.
- Deterministic eligibility outcomes cannot be changed or overridden by AI explanation.
- AI extraction remains a suggestion until a qualified human approves each material fact.
- Prompt/response collection is minimised; unnecessary sensitive data is rejected or redacted; retention and deletion are enforced.
- Quotas, spend limits, model/version audit data, kill switch, and provider fallback are tested.
- Versioned safety evaluations meet thresholds for citation, refusal, privacy, hallucination, prompt injection, and outcome preservation.
- AI cannot publish facts, verify sources, submit applications, or access secrets.

## Checkpoint 6: Production Hardening, SEO and Advertising

- Threat model, authorisation review, dependency/security scanning, rate limits, security headers, secret rotation, and incident runbooks pass.
- Performance and accessibility budgets pass on representative low-end mobile and constrained-network profiles.
- Public SEO metadata, sitemaps, canonical URLs, and structured data exclude drafts, private routes, and unverified facts.
- Logs, metrics, errors, analytics, and traces follow allowlists, redaction, access, and limited-retention rules.
- Advertising and sponsorship, if enabled, are clearly disclosed, accessible, bounded, independent of editorial ranking, and never use sold student data.
- Rollback, cache purge, stale-data containment, backup restore, and provider-outage drills pass.
- Native mobile remains outside Year 1 unless a superseding ADR is accepted.

## Checkpoint 7: Commercial Public Launch

- The launch catalogue passes a full source/verification/freshness audit; failures are unpublished or visibly fail closed.
- Privacy controls, terms/policies, consent/versioning, export, deletion, analytics, AI, notifications, and advertising disclosures match actual behavior.
- Correction support, escalation, emergency unpublish, incident response, release ownership, and status communication are staffed and exercised.
- Year 1 forecast and hard limits remain within USD 100 and no paid communication dependency exists.
- Production deployment, database migration, backup, rollback, and restore have been rehearsed from signed release artifacts.
- No critical security/privacy issue, unrelated regression, or unresolved launch-blocking data issue remains.
- Autonomous scholarship or internship submission and sensitive student document storage remain absent.

## Global definition of done

A feature or checkpoint is done only when all applicable statements are true:

- The feature works through the documented Docker workflow.
- Lint passes with no suppressed new error.
- The production build passes.
- Relevant unit, integration, end-to-end, contract, migration, and accessibility tests pass.
- No critical security issue remains and accepted lower-severity risk has an owner and deadline.
- No unrelated regression is introduced.
- Documentation, contracts, diagrams, runbooks, and user-facing guidance are updated.
- Every published opportunity fact retains official source evidence, verification status, and last-checked time.
- Private-data and guest/account boundaries are respected and tested.
- Free-tier and total Year 1 cost impact is reviewed against the USD 100 ceiling.
- Rollback and recovery are proportionate, documented, and tested before release.

## Docker validation requirements

- `docker compose config --quiet` succeeds and the expected `web` service remains the only baseline service until a database is explicitly authorised.
- The image builds from the committed lockfile and runs as a non-root user.
- Required project validation commands run inside disposable or active containers without relying on host-only dependencies.
- Dependency-volume refresh instructions are tested after lockfile changes.
- Hot reload, source mounting, port 3000, and Windows polling remain functional for development.

## Lint requirements

- `npm run lint` exits zero in Docker.
- New warnings are resolved rather than hidden through broad ignores or disabled rule sets.
- Generated or migration artifacts are excluded only with a documented reason.

## Build requirements

- `npm run build` exits zero in Docker using production-mode Next.js behavior.
- TypeScript is strict and domain modules resolve from their public index.
- The build contains no secret, server credential, private fixture, or sensitive student file.

## Test requirements

- Tests trace to acceptance criteria and include positive, negative, boundary, authorisation, and failure-recovery paths.
- Data and API contracts have runtime validation where untrusted input crosses a boundary.
- Time-based behavior uses deterministic clocks and timezone fixtures.
- A failed test blocks release unless a documented, approved exception includes risk and expiry.

## Accessibility requirements

- Supported workflows meet WCAG 2.2 AA intent, including keyboard use, visible focus, names/roles/states, contrast, zoom/reflow, reduced motion, and error recovery.
- Color is never the only status indicator.
- Automated checks are supplemented by keyboard and representative screen-reader review.
- Accessibility regressions block the affected release.

## Security requirements

- Deny-by-default authorisation and least privilege are tested for every role and ownership boundary.
- Secrets remain server-side and are scanned from source, image layers, logs, and client bundles.
- Input validation, output encoding, CSRF/session protections where applicable, rate limits, dependency review, and audit events are verified.
- No role or service can read plaintext passwords or credentials.
- Threat model and incident/rollback steps are updated for material surface changes.

## Privacy requirements

- Collection is necessary, purpose-limited, classified, and documented before implementation.
- Guest data remains local until confirmed migration; account data is exportable and permanently deletable under policy.
- Year 1 stores no passport, transcript, certificate, bank-statement, or other sensitive student document file.
- AI, logs, analytics, notifications, and advertising use minimised identifiers and reviewed retention.
- Student data is never sold, and exceptional staff access is audited.

## Data-verification requirements

- Official source, scope, cycle, verification status, reviewer, and last-checked timestamp exist before a material fact is published.
- Estimated/history-derived values remain visibly distinct and never receive exact countdowns.
- Conflicting, stale, withdrawn, archived, or scope-ambiguous facts follow the deadline specification and fail closed.
- Verification changes retain evidence and history; they never overwrite the only source record.

## Documentation requirements

- Architecture decisions, contracts, data mappings, permissions, privacy, operations, and user-visible limitations reflect actual behavior.
- Documentation identifies owner, status, date, assumptions, unresolved risks, and next review where relevant.
- Commands are copyable and paths/references resolve in the repository.

## Git and release requirements

- The change set is scoped, reviewed, free of accidental generated files, and preserves the read-only prototype boundary.
- Commit/release identifiers trace to tested artifacts and migrations.
- Release notes identify behavior, data, privacy, security, cost, migration, and rollback impact.
- Protected-branch/review rules and separation of duties are enforced before commercial launch.

## Cost review requirements

- Each external service documents free allowance, forecast usage, hard/soft limits, alert owner, failure behavior, and exit path.
- Incremental and cumulative Year 1 cost stay within USD 100 unless a superseding decision is accepted.
- AI, notifications, analytics, storage, egress, and advertising dependencies are included in the forecast.

## Rollback requirements

- Every production change identifies the last known-good application and data versions.
- Database changes have tested forward/rollback or forward-fix plans and backups appropriate to risk.
- Cache, feature flag, vendor, and AI/model changes have kill-switch or fallback behavior.
- Rollback preserves audit evidence and does not silently resurrect deleted private data or stale opportunity facts.
