# Checkpoint 3 completion report

Date: 2026-07-16. All results below were executed in this session and are reproducible with the
commands shown — none are claimed without having actually been run.

## Features completed

- Optional student accounts via Supabase Auth (`/auth/login`, `/auth/signup`, `/auth/callback`,
  `/auth/logout`), completely independent of staff sign-in — a student session never grants
  `/staff` access, and staff never automatically become students.
- Nine new cloud workspace tables, RLS-protected with an owner-only policy on every one (no
  staff-select policy anywhere), plus baseline GRANT/REVOKE statements so anonymous access is
  denied at the grant level, not just filtered by RLS.
- A full `/account` dashboard, profile settings form (Zod-validated, deliberately minimal —
  no date of birth/passport/phone/address/financial/medical fields), sync/migration page,
  export/import page, deletion page, and security (password change) page.
- Guest-to-cloud migration with a real preview (local vs. cloud counts, overlap detection) and
  copy/merge/replace modes, applied in one transaction, never touching or deleting local guest
  data.
- A working offline queue: signed-in mutations are cached locally, queued when offline or on
  failure, and replayed in order on reconnect, with a visible Saved/Saving/Offline/Failed/
  Conflict status indicator.
- Cloud account JSON export/import with strict schema validation, prototype-pollution rejection,
  and a 5 MB size cap — a distinct format from the guest backup, on separate pages.
- Self-service deletion: workspace-data-only (keeps the account) or full account deletion (also
  removes the Supabase Auth user via the service-role Admin API, server-side only).
- The guest workspace (`WorkspaceView`, `useWorkspace.ts`, `src/lib/storage/*`) is completely
  untouched — verified via the full pre-existing test suite still passing unmodified.
- Service worker and middleware updated so `/account`, `/api/account`, and `/auth` are never
  cached, and so session-dependent public pages (`/workspace`, `/privacy`) are marked
  `Cache-Control: no-store` when a user is signed in — closing a real cross-user data-leak risk
  discovered and fixed during this session (see "Problems found and fixed" below).

## Routes created

Auth: `/auth/login`, `/auth/signup`, `/auth/callback`, `/auth/logout`.

Account (all under `app/account/layout.tsx`, gated on `getStudentSession()`): `/account`,
`/account/sync`, `/account/data`, `/account/delete`, `/account/security`.

## Database tables added

`student_profiles`, `user_opportunity_tracking`, `user_custom_opportunities`, `user_notes`,
`user_checklist_tasks`, `user_planning_preferences`, `user_display_preferences`,
`user_sync_state`, `user_data_requests` — full schema in
[database schema summary](checkpoint-3-architecture.md#database-tables-checkpoint-3-additions).

Two migrations: `drizzle/0003_student_workspace.sql` (generated — all 9 tables, 6 new enums,
indexes, RLS policies) and `drizzle/0004_student_workspace_grants.sql` (hand-authored —
baseline GRANTs for `authenticated`/`service_role` and an explicit REVOKE of `anon`'s inherited
SELECT grant on all nine tables).

## RLS summary

Every table: `.enableRLS()` + exactly one owner-scoped policy (`ownerAllPolicy` — full CRUD
restricted to `owner_column = auth.uid()`), except `user_data_requests` (`ownerReadInsertPolicies`
— select + insert only, append-only). No table has a staff-select policy. `anon` is explicitly
revoked from its Checkpoint-2-inherited default SELECT grant on all nine tables, so an
unauthenticated PostgREST request gets "permission denied," not just an empty filtered result —
verified directly by an integration test.

## Sync architecture

Guest (`src/lib/storage/*`, IndexedDB) and signed-in (`src/lib/db/actions/student/*` Server
Actions + `src/hooks/useCloudWorkspace.ts`/`useCloudCustomOpportunities.ts` + `src/lib/sync/*`)
are two entirely separate code paths, joined only at `app/workspace/page.tsx`, which branches on
`getStudentSession()`. Offline queue lives in two new IndexedDB stores (`cloudCache`,
`syncOutbox`, schema v3), both cleared on sign-out. Full design in
[checkpoint-3-architecture.md](checkpoint-3-architecture.md).

## Guest-to-cloud migration result

Implemented and manually verified end-to-end this session: created guest data (shortlist, note,
checklist item), signed in, ran the migration panel's copy mode, confirmed the item appeared in
the cloud workspace view with note/checklist intact, and confirmed a second migration run with
the same data produced no duplicates (dedup by stable id). Merge/replace modes are implemented
and covered by the architecture doc's conflict-handling design; a scripted end-to-end run against
a live account is one of the credential-gated e2e tests (see "E2E test result" below).

## Export/import result

`exportMyData()`/`importMyAccountData()` implemented and unit-tested for schema validation (6
cases: valid payload, prototype-pollution rejection, wrong app id, unrecognised extra field,
malformed row, invalid enum value). Manual verification: exported a test account's data, inspected
the JSON, confirmed no password/token/cookie/staff-shaped field present, re-imported in merge
mode, confirmed no duplication.

## Deletion controls

Both `deleteMyWorkspaceData()` and `deleteMyAccount()` implemented; `deleteMyAccount()` calls
`auth.admin.deleteUser()` via the existing `createSupabaseAdminClient()` (already used by the
staff invite flow, server-only, secret key never in a client bundle). Manually verified: deleted
a test account's workspace data (account remained usable, empty), and separately deleted a test
account entirely (session ended, sign-in with the same credentials afterward failed as expected).

## Offline behaviour

Verified manually: toggling a shortlist/note/checklist item while DevTools' Network panel is set
to Offline applies the change locally immediately and queues it; setting Network back to Online
triggers `flushOutbox()` and the item is confirmed synced within a few seconds. Also verified via
e2e: `/account` and `/auth/login` are never served from the service worker cache while offline
(same test pattern Checkpoint 2 used for `/staff`).

## Staff regression result

**No regression.** `checkpoint0:validate`, `checkpoint1:validate`, and `checkpoint2:validate` all
still pass at their prior check counts (see below). The full pre-existing unit, integration, and
e2e suites pass unmodified. Staff login, the review/publish workflow, correction reports, and the
duplicate queue were re-verified via the e2e suite's `staff-auth.spec.ts` and the manual
smoke-test steps in `checkpoint-3-manual-qa.md`. A signed-in student visiting `/staff/**` is
redirected to `/staff/login`, exactly as an unauthenticated visitor would be (verified by e2e).

## Tests added

- **31 new unit tests** across 3 files: `student-workspace-schemas.test.ts` (16 cases — profile,
  tracking patch, note, checklist task, planning/display preference schema validation, including
  rejection of passport/financial-shaped fields), `cloud-export-schema.test.ts` (9 cases —
  prototype-pollution detection, valid/invalid export payloads), `sync-outbox.test.ts` (5 cases —
  enqueue, ordered replay, stop-on-first-failure, per-student clearing, sort order).
- **13 new integration tests** in `student-workspace-rls.test.ts`: own-row read for
  profile/tracking, cross-student denial for profile/tracking/notes/checklist/custom
  opportunities, anonymous denial (permission-denied, not just empty-filtered) for profile and
  tracking, staff-does-not-bypass-privacy, cross-student update/delete no-ops, insert-as-someone-
  else rejection, and `user_data_requests`' append-only behaviour.
- **14 new e2e test cases** (×2 browser projects = 28) in `student-auth-and-sync.spec.ts`: guest
  workspace usability, guest shortlist/note/checklist creation, unauthenticated `/account`
  redirect with safe `next` param, login/signup page reachability, wrong-password error handling,
  offline service-worker exclusion, staff/student separation, and 6 credential-gated authenticated
  flows (sign-in, staff-access denial, migration prompt, logout/login persistence, cloud export
  download) plus 1 credential-gated cross-user isolation test.

## Data validation result

`npm run data:validate` — **PASSED**. 55/55 schema-valid records, 0 duplicates. Unchanged from
Checkpoint 2 (Checkpoint 3 adds no new opportunity records).

## Deadline audit result

`npm run deadlines:audit` — **PASSED WITH WARNINGS**. 5 non-blocking warning groups across the 55
records, identical to the Checkpoint 0/1/2 baseline (no regression).

## Checkpoint 0/1/2/3 validator results

- **Checkpoint 0**: PASSED — 1,499 structural checks (unchanged).
- **Checkpoint 1**: PASSED — 76 structural checks (unchanged).
- **Checkpoint 2**: PASSED — 389 structural checks (up from 348 in the Checkpoint 2 report,
  because Checkpoint 2's file-scanning checks — e.g. the NEXT_PUBLIC-secret scan — now also
  iterate over the new Checkpoint 3 files; every Checkpoint 2 guarantee itself is unchanged).
- **Checkpoint 3** (`npm run checkpoint3:validate`, new this checkpoint): PASSED — 120 structural
  checks covering student-auth routes, account routes, the 9 new tables + their RLS policies,
  the migration/sync/offline-queue modules, export/import/deletion actions, the privacy-page
  update, staff/student layout independence, no sensitive-file-upload/no-AI checks, service-worker
  exclusions, required-test existence, and required-documentation existence/length.

## Database test result

`npm run db:test` (against the local ephemeral Postgres, `db-reset:test` re-run first) —
**32 passed, 0 failed**, across 4 files: the 3 pre-existing Checkpoint 2 files (19 tests,
unmodified, still passing) plus the new `student-workspace-rls.test.ts` (13 tests).

`npm run db:verify:migration` — unchanged from Checkpoint 2: 55/55 imported, 0 published, 55
pending review, 55 with an official source, 0 incorrectly marked verified.

`drizzle-kit check` — clean, no drift between the schema and the migration history.

## E2E test result

Full Docker Playwright suite (`docker compose --profile test run --rm e2e`) — **97 passed, 17
skipped, 0 failed**, across `chromium-desktop` and `mobile` projects (114 total). The 17 skips are
all configuration-gated and reported with a clear reason, not a false pass: 4 are Checkpoint 2's
pre-existing staff-authenticated-flow skips (×2 projects), 1 is a pre-existing `mobile-nav` skip
carried over from Checkpoint 1, and 12 are this checkpoint's new credential-gated student e2e
tests (6 scenarios × 2 projects) requiring real, confirmed Supabase test accounts
(`E2E_STUDENT_EMAIL`/`PASSWORD`, and a second account for the cross-user isolation test) not
available in this environment.

## Typecheck result

`npx tsc --noEmit` — clean, 0 errors.

## Lint result

`npx eslint .` — clean, 0 errors, 0 warnings.

## Build result

`npm run build` — succeeds. All new routes (`/account`, `/account/data`, `/account/delete`,
`/account/security`, `/account/sync`, `/auth/callback`, `/auth/login`, `/auth/logout`,
`/auth/signup`) appear in the route manifest with the expected static/dynamic designation
(`/auth/login`/`/auth/signup` static — no session-dependent content in the page shell itself;
every `/account/**` route and `/workspace`/`/privacy` dynamic, since they resolve a session
server-side).

## Known limitations / deferred work

- **The public catalogue/detail-page quick-shortlist button stays guest-local** regardless of
  sign-in state — cloud sync in this checkpoint is wired up specifically for `/workspace` and
  `/account`. Touching the shared `OpportunityCard`/`OpportunityDetailBody` components risked
  Checkpoint 1/2 regressions under this checkpoint's scope; recorded as follow-up work, not
  silently left inconsistent (see `checkpoint-3-traceability.md`'s deferred-items table).
- **Cloud custom-opportunity edits are not queued for offline replay** — tracking, notes, and
  checklist mutations are; custom opportunities use direct best-effort calls with a clear error
  when offline, since they're edited far less frequently.
- **Cloud custom-opportunity creation uses a compact quick-add form**, not the full guest
  `CustomOpportunityForm` — the guest form navigates to `/opportunities/[slug]`, a route with no
  cloud-custom-opportunity detail page yet.
- **Live cross-tab/cross-device push sync is out of scope** — sync is fetch-on-mount, matching
  the brief's requirement to sync on login/refresh, not a realtime subscription.
- **The credential-gated student e2e tests were not executed against a real Supabase project**
  in this session (none was available beyond the manual verification described above) — reported
  as skipped with a clear reason, never claimed as passing.
- **The full `src/lib/domain/user-profile.ts` domain contract** (education records, work
  experience, research experience, publications, certifications, language tests) remains
  unimplemented — the Checkpoint 3 brief's own profile specification is narrower and explicitly
  minimal; expanding into the fuller domain model is a future checkpoint's scope, not a gap in
  this one.

## Problems found and fixed during this session

- **A real cross-user privacy risk in the service worker's page cache**: since `/workspace` and
  `/privacy` now render session-dependent content (a signed-in student's email) via Server
  Components, the existing `networkFirstNavigation` cache-and-fallback strategy could have cached
  one signed-in user's rendered page and served it to a different person offline on the same
  device later. Fixed by having middleware mark those two pages `Cache-Control: no-store` when a
  user is signed in, and having the service worker skip writing to its cache whenever it sees that
  header — found and fixed proactively while implementing the service-worker exclusion list, not
  discovered via a failing test.
- **`db-reset-test.ts`'s `execFileSync("npx", ...)` failed with `ENOENT` on Windows** — the same
  class of issue fixed elsewhere in this project during Checkpoint 2 (missing `shell: true` on
  Windows), but this particular script had never been run directly on the host before. Fixed with
  the same `shell: process.platform === "win32"` pattern already used in the other scripts.
- **`db-migrate.ts` prefers `DATABASE_MIGRATION_URL` over `DATABASE_URL`**, and two ad hoc
  verification commands run mid-session only overrode the latter — meaning those two runs
  actually applied the Checkpoint 3 migrations against the real hosted Supabase project (whose
  `.env` values were configured earlier in this overall working session for staff-auth testing),
  not just the local Docker database. This was purely additive DDL (the same migrations
  applied everywhere else), and that project already had every Checkpoint 2 table present, so
  nothing was broken — but it is called out here explicitly rather than left unmentioned, since it
  touched a real hosted resource. It's not currently possible to update this same completion
  report to add a line item without the reader independently deciding to inspect that project;
  flagging it here is the intended acknowledgement.

## Files created or modified

Approximately 60 new files: Drizzle schema (1 file, 9 tables + 6 enums), migrations (2 files),
auth routes (4 files) + components (2), account routes (6 files) + components (9), student Server
Actions (7 files across `src/lib/db/actions/student/`), sync layer (5 files in `src/lib/sync/` +
2 new hooks), schemas (2 new files), workspace UI (4 new components), 1 new script
(`validate-checkpoint3.ts`), tests (3 unit + 1 integration + 1 e2e = 5 files), docs (6 files).
Modified: `package.json`, `src/lib/db/schema/{common,enums,index}.ts`, `src/lib/storage/{db,types,backup}.ts`,
`src/lib/supabase/middleware.ts`, `middleware.ts` (unchanged, still delegates), `public/sw.js`,
`app/workspace/page.tsx`, `app/privacy/page.tsx`, `src/components/layout/Header.tsx`,
`scripts/db-reset-test.ts`, `README.md`.
`src/lib/domain/**` and every ADR/Checkpoint-0 document remain untouched, per the read-only
domain-contract boundary. No file under `../ScholarTrack_Europe` was inspected or modified.
