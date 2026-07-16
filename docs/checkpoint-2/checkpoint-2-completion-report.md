# Checkpoint 2 completion report

Date: 2026-07-16. All results below were executed in this session and are reproducible with the
commands shown — none are claimed without having actually been run.

## Features implemented

- Normalised PostgreSQL schema (40 tables) via Drizzle ORM, replacing the JSON seed as the
  public catalogue's runtime source.
- Row Level Security enabled on every table, with a documented, deliberate design: our own
  server uses a privileged connection (bypasses RLS) and enforces authorization in application
  code; RLS locks down Supabase's separate PostgREST data API against direct browser access.
- Staff authentication via Supabase Auth (`@supabase/ssr`, `getClaims()` verification), with no
  public registration path anywhere.
- A controlled, idempotent first-administrator bootstrap script, gated behind explicit
  confirmation.
- A full staff admin system: dashboard, opportunity CRUD with a 10-status review/publish
  workflow (separation of duties enforced), reviewer assignment, organisations/taxonomies/
  required-documents/eligibility-rule management, correction-report triage, duplicate detection
  and merge, CSV import/export, an append-only audit log, and team/role management.
- The original 55-record legacy migration: idempotent, dry-runnable, rollback-able, verifiable,
  never auto-publishing anything.
- Public verification display (deadline status, verification status, and personal-deadline
  status kept visually and semantically separate) and a public correction-report form.
- All Checkpoint 1 guest-mode functionality preserved and re-verified: local IndexedDB
  tracking, custom opportunities, calendar/ICS export, backup/restore, PWA install/offline.

## Schema summary

40 tables across staff identity, organisations/providers, opportunities + taxonomies, funding,
deadlines + history, official sources + verification + evidence, required documents,
eligibility rules, review workflow, corrections, duplicates, imports, and an append-only audit
log. Full reference: `docs/checkpoint-2/database-schema.md`.

## Migrations

Three files under `drizzle/`:
- `0000_auth_helpers.sql` (hand-authored): `anon`/`authenticated`/`service_role` roles,
  `app.is_staff()`, `app.reject_mutation()`.
- `0001_init_schema.sql` (generated): all 40 tables, enums, indexes, CHECK constraints, RLS
  policies.
- `0002_publication_invariants.sql` (hand-authored): baseline RLS-supporting grants, the
  audit-log immutability triggers, the official-source publication trigger, and the
  verification-record-requires-source deferred constraint trigger.

All three applied cleanly to a fresh local Postgres and to the Docker `test` profile's
ephemeral database in this session.

## Routes

Public: `/`, `/opportunities`, `/opportunities/[slug]`, `/workspace`, `/calendar`,
`/custom-opportunities/new`, `/custom-opportunities/[id]/edit`, `/settings`, `/privacy`,
`/offline`, `/api/health`, `/api/opportunities`, `/api/correction-reports`.

Staff: `/staff/login`, `/staff/auth/callback`, `/staff/logout`, `/staff/unauthorized`, and
(session-gated) `/staff`, `/staff/opportunities`, `/staff/opportunities/new`,
`/staff/opportunities/[id]`, `/staff/opportunities/[id]/edit`,
`/staff/opportunities/[id]/history`, `/staff/reviews`, `/staff/assignments`,
`/staff/organisations`, `/staff/taxonomies`, `/staff/documents`, `/staff/eligibility-rules`,
`/staff/corrections`, `/staff/duplicates`, `/staff/imports`, `/staff/audit`, `/staff/team`, plus
`/api/staff/csv-template` and `/api/staff/export/opportunities`.

## Dependencies added

Runtime: `drizzle-orm`, `postgres` (the driver), `@supabase/supabase-js`, `@supabase/ssr`,
`server-only`, `client-only`. Dev: `drizzle-kit`, `dotenv`. No AI, advertising, payment, or
unrelated cloud-vendor package was added.

## Test results

- **Unit/component (`npm run test`):** 198 passed, 1 skipped (199 total, 21 files) — includes
  53 new Checkpoint 2 tests (permission matrix, workflow state machine, duplicate detection, CSV
  parsing/validation/formula-injection, correction-report schema) alongside all 145 preserved
  Checkpoint 1 tests, unmodified in behaviour.
- **Database/RLS/migration integration (`npm run db:test`):** 19 passed, 0 failed, across 3
  files — RLS policy enforcement (7 cases, including anon/staff/unassigned-authenticated
  visibility and archived-record exclusion), database-enforced invariants (6 cases: publication
  triggers, CHECK constraints, audit-log append-only), and the legacy-migration CLI black-box
  (5 cases: dry-run, import, idempotent re-run, rollback, re-import after rollback).
- **End-to-end (Docker `test` profile, `docker compose --profile test run --rm e2e`):** 81
  passed, 5 skipped, 0 failed, across both `chromium-desktop` and `mobile` projects. The 5
  skipped are the two "authenticated staff flow" tests (×2 viewport projects, plus a
  `mobile-nav` test skip carried over from Checkpoint 1) that require a real Supabase project
  and bootstrapped staff credentials (`E2E_STAFF_EMAIL`/`E2E_STAFF_PASSWORD`) not available in
  this environment — they report a clear skip reason rather than a false pass.
- **Data validation (`npm run data:validate`):** PASSED — 55/55 schema-valid, 0 duplicates.
- **Deadline audit (`npm run deadlines:audit`):** PASSED WITH WARNINGS — 5 non-blocking warning
  groups across the 55 records, identical to the Checkpoint 0/1 baseline (no regression).
- **Checkpoint 0 validator:** PASSED — 1,499 structural checks (unchanged from the original
  report).
- **Checkpoint 1 validator:** PASSED — 76 structural checks. Two checks were updated (not
  removed) because Checkpoint 2 explicitly supersedes their Checkpoint-1-era assumptions: the
  "no database dependency" check no longer prohibits the four packages this checkpoint
  deliberately adds (`postgres`, `drizzle-orm`, `@supabase/supabase-js`, `@supabase/ssr`); the
  "opportunity detail page must use generateStaticParams" check was replaced with "must query
  the database repository", since static generation is incompatible with publish/archive taking
  effect immediately. Every other Checkpoint 1 guarantee (guest mode, PWA, no sensitive-file
  upload, etc.) is unchanged and still enforced by this same script.
- **Checkpoint 2 validator (`npm run checkpoint2:validate`):** PASSED — 348 structural checks
  (schema, migrations/RLS/triggers, staff auth, permission enforcement, public-repository
  isolation from the seed JSON, workflow, required documents, eligibility rules, corrections,
  duplicates, CSV, audit, the legacy importer, environment/secret hygiene, PWA cache exclusions,
  no sensitive-file upload, no accidental student-account feature, and documentation
  completeness).
- **Typecheck (`npx tsc --noEmit`):** clean, 0 errors.
- **Lint (`npm run lint`):** clean, 0 errors, 0 warnings.
- **Production build (`npm run build`):** succeeds. `/` and `/opportunities` are dynamic
  (published-opportunity counts are live data, never baked into a static build);
  `/opportunities/[slug]` is dynamic for the same reason; every `/staff/**` route is dynamic
  (session-dependent).

## Migration results

`npm run db:import:legacy` (verified this session against both the local dev database and the
Docker `test` profile's ephemeral database):

- **Number of original records imported:** 55 / 55.
- **Number published:** 0 (correct — nothing auto-publishes; see below for the one manually
  promoted record used for a live smoke test, which was excluded from the committed state).
- **Number pending review:** 55 (status `draft`, awaiting the staff review workflow).
- **Number with an official source:** 55 / 55 (each has exactly one `official_sources` row in
  `candidate` status, pending a reviewer's upgrade to `confirmed-official`).
- **Total real reviewed opportunity count:** 55 (all real, sourced from the original v0.1
  migration seed; zero fabricated records).
- **Whether the 100-record criterion passed:** **No.** 55 of the required 100 exist. See
  `docs/checkpoint-2/content-expansion-gap.md` for why, the rules that must govern closing the
  gap, and the CSV-import path built to do it. This checkpoint's software system is complete;
  its content is honestly incomplete.

During this session's manual verification, one record (`daad-scholarships-for-foreign-students`)
was carried through the full draft→published pipeline (including promoting its funding
benefit and eligibility rule) to confirm the public API, detail page, and health check all
correctly reflect live database state end-to-end — then rolled back to keep the delivered
database state honestly at "0 published" (matching what a fresh `db:import:legacy` run
produces).

## Known limitations / deferred work

- **100-record content target:** not met (55/100) — see the gap document. No fabricated content
  was added to close this gap.
- **Live Supabase staff-auth end-to-end tests:** the sign-in-and-create-draft e2e tests are
  written and configuration-gated (`E2E_STAFF_EMAIL`/`E2E_STAFF_PASSWORD`), but were not
  executed against a real Supabase project in this session (none was available) — they are
  reported as skipped, not passing.
- **`pg_trgm`:** not used for fuzzy duplicate matching; a dependency-free token-similarity
  algorithm was used instead, per the brief's own "only when appropriate and supported"
  guidance.
- **Full audit-log browsing** is Administrator-only in the UI; Reviewer/Senior Reviewer see
  their own review-scoped activity in context rather than a separate global log view — a
  documented simplification of Checkpoint 0's fuller per-role audit-visibility matrix.
- **Eligibility-rule evaluation** against a student profile remains explicitly out of scope
  (per ADR-004) — this checkpoint only stores and manages the rules.
- **A real Cloudflare deployment adapter** was not applicable — nothing in this repository
  targets Cloudflare Workers, and none was requested elsewhere.

## Files created or modified

Approximately 140 new files (Drizzle schema × 16, migrations × 3 + local test shim, server
actions × 7, staff pages × 20, staff components × 12, public-catalogue/CSV/duplicate/audit
libraries, scripts × 10, unit tests × 5 new files, integration tests × 4 files, e2e specs × 3
new files, docs × 9). Modified: `package.json`, `docker-compose.yml`, `.env.example`,
`tsconfig.json` (unchanged this checkpoint), `eslint.config.mjs` (unchanged), `public/sw.js`,
`middleware.ts` (new), `src/lib/catalogue/{types,search,custom-adapter}.ts`,
`src/lib/storage/{types,db,public-catalogue-cache}.ts`, `src/hooks/useCatalogue.ts`,
`app/{page,opportunities/page,opportunities/[slug]/page,api/health/route}.tsx`,
`src/components/opportunities/{OpportunityDetailBody,CatalogueExplorer,FilterPanel}.tsx`,
`src/components/settings/PlanningPreferencesForm.tsx`,
`src/components/custom-opportunities/{New,Edit}CustomOpportunityClient.tsx`,
`scripts/{validate-checkpoint0,validate-checkpoint1}.ts`, `README.md`.
`src/lib/domain/**` and every ADR/Checkpoint-0 document remain untouched, per the read-only
domain-contract boundary.
