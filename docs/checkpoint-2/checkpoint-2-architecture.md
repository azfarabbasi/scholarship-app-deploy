# Checkpoint 2 architecture

## Status

Accepted and implemented. Owner: platform engineering. Last reviewed: 2026-07-16.

## 1. What changed since Checkpoint 1

Checkpoint 1 shipped a guest-only PWA whose "catalogue" was a build-time import of
`data/migrations/v0.1/scholarships.seed.json`. Checkpoint 2 replaces that with a normalised
PostgreSQL database (schema owned by Drizzle ORM), a staff-only admin system with a
draft → review → approve → publish workflow, and Supabase Auth for staff sign-in. The
JSON seed file is retained only as **versioned migration input** — no runtime code under
`app/`, `src/components/`, or `src/hooks/` imports it any more
(`src/lib/catalogue/legacy-seed-repository.ts` is the one module that still reads it, and it
is used exclusively by `scripts/import-legacy-scholarships.ts` and tests).

Everything Checkpoint 1 shipped for guests remains unchanged and working: local IndexedDB
tracking, custom opportunities, calendar/ICS export, backup/restore, PWA installability, and
offline support. Guests still never create an account and nothing about their local data was
touched.

## 2. System architecture

```
┌─────────────────────────┐        ┌──────────────────────────┐
│   Browser (guest)        │        │   Browser (staff)         │
│                          │        │                            │
│  IndexedDB (guest data,   │        │  Supabase Auth session     │
│  + public catalogue       │        │  cookie (SSR)               │
│  offline cache)           │        │                            │
└──────────┬───────────────┘        └──────────┬─────────────────┘
           │ fetch /api/opportunities            │ Server Actions /
           │ fetch /api/correction-reports        │ Route Handlers under
           │                                      │ /staff, /api/staff
           ▼                                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Next.js server (App Router)                  │
│  middleware.ts → refreshes Supabase session, gates /staff/**      │
│  src/lib/auth/session.ts → getStaffSession() via getClaims()      │
│  src/lib/auth/permissions.ts → role/action matrix (deny-by-default)│
│  src/lib/db/client.ts → privileged Drizzle/postgres-js connection  │
└───────────────────────────────┬───────────────────────────────────┘
                                 │ DATABASE_URL (direct Postgres connection,
                                 │ bypasses RLS — see §4)
                                 ▼
                    ┌────────────────────────────┐
                    │  PostgreSQL (Supabase or     │
                    │  local Postgres in Docker)   │
                    │  40 tables, RLS + triggers    │
                    └────────────────────────────┘
```

## 3. Database diagram (entity groups)

See `database-schema.md` for the full table-by-table reference. At a high level:

```
organisations ──< providers ──< opportunities >── opportunity_types
                                     │  │  │
        ┌────────────────────────────┤  │  └──────────────────────────┐
        ▼                            ▼                                 ▼
opportunity_countries/          deadline_cycles ──< deadline_occurrences   funding_benefits
regions/study_levels/                                     │
fields_of_study/funding_types                              ▼
        │                                     deadline_occurrence_history
        ▼
opportunity_official_sources >── official_sources ──< source_evidence
        │                                                    │
        ▼                                                    ▼
eligibility_rule_groups ──< eligibility_rules      opportunity_document_requirements >── required_document_templates

opportunities ──< opportunity_versions (append-only)
opportunities ──< review_assignments >── staff_profiles ──< staff_role_assignments
opportunities ──< correction_reports
opportunities ──< duplicate_candidates (canonical/duplicate pair)
opportunities ──< opportunity_slug_redirects (old slug → canonical)
import_jobs ──< import_job_rows
audit_log (append-only, references nothing by FK — deliberately polymorphic)
```

## 4. Server/client boundaries and the RLS design decision

This is the single most important design decision in Checkpoint 2, so it is documented once,
here, and referenced everywhere else (schema comments, `common.ts`, the validator).

**All application reads and writes — public catalogue and staff admin alike — go through our
own Next.js server, using a single privileged `DATABASE_URL` connection** (`src/lib/db/client.ts`).
That connection is the table owner and therefore bypasses Postgres RLS entirely. Authorization
for every mutation is enforced in application code: `getStaffSession()` resolves who is
calling, and `src/lib/auth/permissions.ts` decides whether they may do it. This is why the
codebase has no `.rls-policy` files driving business logic — RLS is not the authorization
mechanism for our own server.

So what is RLS *for*? A Supabase project automatically exposes every table through PostgREST
(the "data API") once the project is up, reachable directly from any browser using the public
`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Our application code never calls that API — but nothing
stops a third party from doing so directly. RLS (enabled on every table, see
`src/lib/db/schema/common.ts`) is the safety net for exactly that path: `anon`/`authenticated`
get read-only access to public, published data (or nothing, for internal tables), and no
table grants `anon`/`authenticated` any write policy at all — the default-deny behaviour of
"RLS enabled, no matching policy" is what keeps a direct PostgREST write impossible.

One consequence: the public correction-report path is **not** exposed as a raw PostgREST
insert policy, even though a guest can submit one. It is validated exclusively through
`app/api/correction-reports/route.ts` (Zod validation, length limits, honeypot), which itself
uses the privileged connection to insert. This is a deliberate, stricter reading of "a
validated controlled path" than a bare RLS INSERT policy would give.

## 5. Supabase Auth flow (staff only)

- No public registration exists anywhere in the app. Staff accounts are created only via
  `scripts/bootstrap-admin.ts` (first administrator) or the Team page's invite flow
  (`src/lib/db/actions/team.ts`, administrator-only), both of which call the Supabase Admin API
  with `SUPABASE_SECRET_KEY` (server-only).
- Sign-in uses `supabase.auth.signInWithPassword()` from the browser
  (`src/components/staff/StaffLoginForm.tsx`) against the publishable key.
- `middleware.ts` → `src/lib/supabase/middleware.ts` refreshes the SSR session cookie on every
  request and redirects an unauthenticated visitor away from `/staff/**` (except the public
  `/staff/login`, `/staff/auth/callback`, `/staff/unauthorized`) to `/staff/login?next=...`,
  with the redirect target sanitised to a same-origin `/staff` path (no open redirect).
- `app/staff/(protected)/layout.tsx` performs the authoritative check: it calls
  `getStaffSession()` (`src/lib/auth/session.ts`), which verifies the session via
  `supabase.auth.getClaims()` (secure local/JWKS verification of the asymmetric-signed JWT, the
  current recommended approach — not a trust-the-cookie shortcut) and then requires an active,
  non-revoked `staff_role_assignments` row. An authenticated user with zero role assignments is
  treated identically to a signed-out visitor: no staff page renders for them.
- Every Server Action independently re-derives the session and re-checks permissions — the
  staff nav (`src/components/staff/StaffNav.tsx`) only filters what's *shown*, never what's
  *allowed*.

## 6. Public data flow

1. `app/api/opportunities/route.ts` (always `force-dynamic`) calls
   `getPublishedOpportunities()` (`src/lib/catalogue/db-repository.ts`), which queries only
   `status = 'published'` opportunities and joins in their taxonomy links, funding benefits,
   eligibility rules, official sources, and deadline cycle/occurrences.
2. The client hook `useBuiltInOpportunities()` fetches that route on mount, merges the result
   into `useCatalogue()` alongside guest-local custom opportunities, and writes a copy into
   IndexedDB (`publicCatalogueCache` store) together with the response's `syncedAt` timestamp.
3. `/opportunities/[slug]` is intentionally **not** statically generated (Checkpoint 1 built all
   55 pages at build time; Checkpoint 2 cannot, because publish/archive must take effect
   immediately). It looks up the slug via `getPublishedOpportunityBySlug()`, which also
   resolves `opportunity_slug_redirects` for old slugs left behind by a duplicate merge.
4. Benefit/eligibility "summary" text does not exist as a flat column on `opportunities` (the
   normalised schema stores `funding_benefits`/`eligibility_rules` rows instead) — the
   repository joins and concatenates the *published* rows into the single string the existing
   card/detail UI expects, falling back to "See the official source for ... details." only when
   no rows are yet published for that opportunity.

## 7. Offline-cache flow

- `public/sw.js` explicitly bypasses `/staff/**` and `/api/staff/**` — those requests are never
  intercepted, so nothing staff-related is ever written to Cache Storage, satisfying "staff
  pages are never available offline."
- `/api/opportunities` and `/api/health` fall through to the existing stale-while-revalidate
  handler for other same-origin GET requests.
- `useBuiltInOpportunities()` has three states: a fresh fetch (normal), a fetch failure with a
  cached IndexedDB snapshot available (`isStale: true`, UI shows "showing a cached catalogue as
  of `<last sync time>`"), and a fetch failure with **no** cache at all
  (`isServiceUnavailable: true`, UI shows an honest "catalogue unavailable offline" state — never
  a silent empty list).

## 8. Audit strategy

- `audit_log` is append-only by construction: `app.reject_mutation()` triggers on
  `BEFORE UPDATE`/`BEFORE DELETE` unconditionally reject the operation — including from our own
  privileged connection (verified in `tests/integration/publication-invariants.test.ts`).
- `src/lib/audit/log.ts` provides the one `recordAuditEvent()` helper every mutating Server
  Action calls, in the same transaction as its data change, storing actor, role, action, entity,
  a reason code where relevant, and a pre-redacted human-readable summary — never raw row
  contents, credentials, or note bodies.
- Database-level triggers additionally enforce two invariants regardless of what application
  code does: a `BEFORE INSERT OR UPDATE` trigger on `opportunities` blocks publishing without an
  official source, and a deferred constraint trigger on `verification_records` blocks leaving
  `pending` without a linked official source.

## 9. Migration strategy

- The Drizzle TypeScript schema (`src/lib/db/schema/**`) is the version-controlled source of
  truth. `npm run db:generate` (drizzle-kit) diffs it against the last migration snapshot and
  writes a new `drizzle/NNNN_*.sql` file — never a direct schema push in any environment.
- Two migrations are hand-authored rather than generated, because they encode logic Drizzle's
  schema-as-code can't express: `0000_auth_helpers.sql` (the `app.is_staff()` SECURITY DEFINER
  function every RLS policy calls, plus the `anon`/`authenticated`/`service_role` role
  definitions) and `0002_publication_invariants.sql` (the cross-table triggers from §8, plus the
  baseline `GRANT`s every RLS policy depends on — see the comment in `common.ts` for why those
  grants are necessary even with RLS enabled).
- `scripts/db-migrate.ts` applies migrations via `drizzle-orm/postgres-js/migrator`, both against
  a real Supabase project and the local/test Postgres containers.
- See `migration-runbook.md` for the full dry-run/apply/verify/rollback procedure for the
  original 55-record seed, which is entirely separate from schema migrations.
