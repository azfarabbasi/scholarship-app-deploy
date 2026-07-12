# Checkpoint 0 completion report

## Executive outcome

Checkpoint 0 has completed its protected-baseline, migration-audit, deadline-
intelligence, commercial-domain, governance, architecture-decision, roadmap, and
validation design work. The production application remains the existing Next.js
scaffold: this checkpoint added no public UI, database, Supabase connection,
authentication, API route, autonomous submission, paid service, or sensitive
student-file capability.

**Final recommendation: ready with warnings.** The architecture and controls are
ready to begin Checkpoint 1. The 55 migration records are structurally usable as
review inputs, but they are not a publication-ready source of current facts until
the source-verification and timezone warnings below are resolved.

## Completed deliverables

- The old static prototype and new production repository have an explicit,
  documented read-only boundary.
- Docker-first development, the 55-record migration package, runtime schema,
  deadline scenarios, and deadline audit remain the validated baseline.
- The commercial domain catalogue defines all 47 required entities, their
  ownership, classification, relationships, lifecycle, audit, deletion, and Year
  1 timing.
- A Mermaid ERD shows the major catalogue, workspace, review, audit, source,
  document-metadata, reminder, and AI relationships.
- TypeScript contracts model all 47 entities and export through one barrel. The
  canonical deadline module is reused rather than shadowed.
- Six roles and 25 capabilities establish deny-by-default, least-privileged
  authorization and separation of duties.
- Six classifications, 28 classified items, and ten ownership/deletion categories
  establish guest, account, staff, AI, analytics, advertising, and deletion
  boundaries.
- Ten accepted ADRs record the locked product and architecture decisions.
- Forty-six outcome-based backlog items map across Checkpoints 1-7, including
  explicit beyond-Year-1 exclusions.
- Checkpoint acceptance criteria, the global definition of done, and complete
  roadmap traceability are documented.
- A substantive structural validator is exposed as
  `npm run checkpoint0:validate` and fails non-zero on contract drift.

## Files created

### Checkpoint documents

- `docs/checkpoint-0/domain-model-spec.md`
- `docs/checkpoint-0/domain-model.mmd`
- `docs/checkpoint-0/roles-and-permissions.md`
- `docs/checkpoint-0/privacy-boundary.md`
- `docs/checkpoint-0/data-ownership-and-deletion.md`
- `docs/checkpoint-0/v1-product-backlog.md`
- `docs/checkpoint-0/checkpoint-acceptance-criteria.md`
- `docs/checkpoint-0/roadmap-traceability.md`
- `docs/checkpoint-0/checkpoint-0-completion-report.md`

### Architecture decision records

- `docs/adr/ADR-001-read-only-prototype-and-production-codebase.md`
- `docs/adr/ADR-002-guest-first-optional-accounts.md`
- `docs/adr/ADR-003-no-sensitive-file-storage-year-one.md`
- `docs/adr/ADR-004-deterministic-eligibility-before-ai.md`
- `docs/adr/ADR-005-official-source-verification-first.md`
- `docs/adr/ADR-006-postgresql-relational-domain-model.md`
- `docs/adr/ADR-007-docker-first-development.md`
- `docs/adr/ADR-008-free-first-infrastructure-budget.md`
- `docs/adr/ADR-009-pwa-before-native-mobile.md`
- `docs/adr/ADR-010-human-approval-for-ai-extracted-data.md`

### Domain and validation contracts

- `src/lib/domain/common.ts`
- `src/lib/domain/opportunity.ts`
- `src/lib/domain/provider.ts`
- `src/lib/domain/eligibility.ts`
- `src/lib/domain/verification.ts`
- `src/lib/domain/documents.ts`
- `src/lib/domain/user-profile.ts`
- `src/lib/domain/application-tracking.ts`
- `src/lib/domain/notifications.ts`
- `src/lib/domain/administration.ts`
- `src/lib/domain/ai.ts`
- `src/lib/domain/index.ts`
- `scripts/validate-checkpoint0.ts`

## Files modified

- `src/lib/domain/deadlines.ts` was reconciled with the existing normative
  deadline specification: occurrences are role/scope-aware events, opening and
  closing are separate facts, boundary precision is narrowed, target intakes are
  explicit, source context is retained, and display lifecycle remains derived.
- `package.json` adds the `checkpoint0:validate` command without adding a
  dependency.
- `README.md` lists the complete Docker-first Checkpoint 0 validation sequence.

No migration data, migration schema, deadline scenarios, Docker file, public UI,
or lockfile was modified in this task.

## 55-record dataset status

The versioned JSON seed still contains exactly 55 unique, schema-valid records;
there are zero schema issues, invalid records, duplicate legacy IDs, duplicate
slugs, or duplicate official-URL groups. Precision is unchanged:

| Precision | Records |
| --- | ---: |
| Exact | 24 |
| Estimated | 20 |
| Rolling | 5 |
| Unknown | 6 |

The seed is approved as migration and review input only. It is not approved as a
current public-fact source because every record is still marked not officially
reverified and lacks an authoritative deadline timezone.

## Deadline-audit status

The audit passes all structural checks with zero structural finding groups. It
correctly reports five non-blocking warning groups affecting the review queue:

- 55 records have no deadline timezone.
- 30 records have stored 2026 dates that had expired by the 2026-07-12 audit.
- 41 records require next-cycle verification.
- All 55 records are not officially reverified.
- 16 records contain programme, institution, country, or call-scope candidates
  that need formal modelling during review.

Automatic date rollover remains forbidden for all 55 records. These warnings are
publication blockers for the affected facts, not structural migration failures.

## Architecture status

### Domain model

Status: complete for Checkpoint 0. The specification and TypeScript contracts
define exactly 47 entities. Guest-local versus account-cloud ownership is
discriminated, draft opportunities remain Internal, public facts pass a
publication boundary, sensitive-document records are metadata-only, audit logs
are append-only/redacted, and deterministic eligibility is separate from AI.

### Role model

Status: complete for Checkpoint 0. Exactly six canonical roles and 25 permission
rows are defined. Staff role assignments are explicit, Student permissions do not
imply staff authority, reviewers cannot self-publish unreviewed work, and System
Service authority is narrow and auditable.

### Privacy boundary

Status: complete for Checkpoint 0. Exactly six classifications and all 28 required
data items are covered. Passport, transcript, certificate, bank-statement, and
other financial-document files remain prohibited in Year 1. The only reusable
document representation is the approved readiness/expiry/version/template and
timestamp metadata; no file, path, URL, extracted content, or free-form document
note is accepted.

### ADRs

Status: complete. All ten required ADRs are present and Accepted, each with
status, context, decision, consequences, and alternatives.

### Backlog and traceability

Status: complete. The backlog has 46 unique items distributed 6, 6, 7, 7, 6, 7,
and 7 across Checkpoints 1-7. Every item contains the required priority,
dependency, value, acceptance, privacy/security, testing, and deferral fields.
Every ID appears exactly once in roadmap traceability. Sensitive file uploads,
paid SMS/WhatsApp dependency, autonomous AI decisions, native mobile apps, and
autonomous application submission are explicitly outside Year 1.

### Acceptance criteria

Status: complete. Every future checkpoint has an exit gate, and the global
definition of done covers Docker, lint, build, tests, accessibility, security,
privacy, data verification, documentation, release, cost, and rollback.

## Validation evidence

| Validation | Result |
| --- | --- |
| Docker Compose configuration | Passed: `docker compose config --quiet` |
| `npm run data:validate` | Passed: 55/55 valid, zero critical errors |
| `npm run deadlines:audit` | Passed with the five documented warning groups |
| TypeScript no-emit compile | Passed in Docker |
| `npm run checkpoint0:validate` | Passed: 1,499 structural checks |
| `npm run lint` | Passed in Docker |
| `npm run build` | Passed in Docker; static `/` and `/_not-found` routes built |
| `npm run domain:validate` | Not run: the command does not exist in `package.json` |

## Unresolved questions

- Which official-source review order should be used to promote the first safe
  Checkpoint 1 catalogue slice?
- Which hosting, PostgreSQL, optional authentication, analytics, and notification
  providers will satisfy the free-first ceiling and applicable data-region needs?
- What exact retention periods and recovery windows will legal/privacy review
  approve for audit, AI, analytics, correction, and deleted-account records?
- Which supported locales and source timezones form the first launch matrix?
- Which AI provider/model, if any, can satisfy source grounding, retention,
  consent, quota, and cost gates at Checkpoint 5? No provider is selected now.

None of these questions authorises database, authentication, provider, or AI
implementation during Checkpoint 0.

## Known risks

- The seed cannot safely drive authoritative countdowns because all 55 timezone
  values are missing and all 55 records remain unverified.
- Thirty dates are already historical as of the audit date; copying them into a
  new year would create false facts.
- Sixteen records need explicit multi-scope modelling before selection logic can
  act on them.
- Browser-local guest data can be lost through device/browser clearing until the
  user exports it or explicitly migrates it to an optional account.
- Free-tier limits, vendor policy changes, accessibility regressions, and
  advertising incentives need recurring release-gate review.
- The contracts are architecture, not runtime authorization or validation; every
  later storage/API boundary must implement and test them explicitly.

## Checkpoint 1 prerequisites

1. Choose a small source-review cohort and verify every publishable fact against
   an official source, recording verification status, scope, cycle, last-checked
   time, and source timezone.
2. Implement the deterministic deadline evaluator and formal scenario tests from
   the existing specification without automatic rollover.
3. Implement a fail-closed public projection so no draft, private, stale,
   conflicting, or unsupported field reaches the catalogue.
4. Define and test the versioned guest-local storage, export/import, corruption,
   quota, reset, and future confirmed-migration contracts.
5. Implement the responsive PWA shell, catalogue, details, filters, and accessible
   non-colour-only deadline states in Docker.
6. Preserve the USD 100 Year 1 ceiling, avoid paid communication dependencies,
   and add no sensitive-file storage or autonomous application submission.
7. Trace every implementation slice to its backlog acceptance and global
   definition-of-done evidence.

## Checkpoint 0 exit-criteria checklist

- [x] Protected prototype boundary documented and retained.
- [x] Docker-first baseline retained with no database or paid service added.
- [x] Fifty-five-record migration package remains structurally valid.
- [x] Deadline semantics, audit, scenarios, and no-rollover policy are defined.
- [x] Forty-seven-entity domain specification and ERD are complete.
- [x] Domain TypeScript contracts compile and use the canonical deadline module.
- [x] Six-role permission model and separation of duties are complete.
- [x] Privacy, ownership, export, retention, and deletion boundaries are complete.
- [x] Sensitive student document files remain prohibited in Year 1.
- [x] Ten required ADRs are accepted.
- [x] Checkpoints 1-7 backlog, acceptance criteria, and traceability are complete.
- [x] Structural Checkpoint 0 validator is implemented and non-trivial.
- [x] Final Compose, Checkpoint 0, lint, and production-build commands pass.
- [x] The old `ScholarTrack_Europe` prototype remains unchanged.

## Final recommendation

**Ready with warnings.** Checkpoint 0 is ready to close and Checkpoint 1 may
begin, but no
opportunity fact with unresolved official-source, verification, cycle, scope,
last-checked, or timezone evidence may be presented as authoritative.
