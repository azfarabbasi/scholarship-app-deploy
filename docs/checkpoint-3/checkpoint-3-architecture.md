# Checkpoint 3 architecture

Optional student accounts and cloud sync for the personal workspace, built entirely alongside
(not instead of) guest mode. This document explains the auth model, database, RLS, sync
architecture, offline queue, migration flow, conflict handling, export/import model, deletion
model, and the privacy decisions behind them.

## Auth flow

ScholarTrack now has **two independent auth surfaces** sharing one Supabase Auth user table:

| | Staff | Student |
| --- | --- | --- |
| Sign-in route | `/staff/login` | `/auth/login` |
| Sign-up | None (invite-only) | `/auth/signup`, self-service |
| Callback | `/staff/auth/callback` | `/auth/callback` |
| Logout | `/staff/logout` (POST) | `/auth/logout` (POST) |
| Session helper | `getStaffSession()` | `getStudentSession()` |
| Identity row | `staff_profiles` (pre-provisioned by bootstrap/invite) | `student_profiles` (lazily created on first use) |
| Grants access to | `/staff/**` | `/account/**`, cloud workspace data |

Both helpers call `supabase.auth.getClaims()` — asymmetric-JWT-aware verification against
Supabase's JWKS, never a raw trusted cookie payload — exactly like Checkpoint 2's staff session.
**Being signed in for one never implies the other.** A staff member who signs in only ever uses
`/staff` and never gets a `student_profiles` row; a student can never reach `/staff` because
`getStaffSession()` requires an active `staff_role_assignments` row that self-service signup
never creates. `middleware.ts` (via `src/lib/supabase/middleware.ts`) gates both prefixes at the
edge as a UX convenience only — every Server Action independently re-verifies server-side.

### Lazy student-profile provisioning

Unlike staff (who must be bootstrapped/invited), any Supabase Auth user can use student
features. `getStudentSession()` calls `ensureStudentProfile(authUserId, email)`, an idempotent
upsert, the first time it's invoked for that user — visiting `/account`, `/workspace` while
signed in, or any student Server Action. This is what keeps "signed in" and "has opted into
student workspace features" distinct, satisfying the requirement that staff never automatically
become students.

### Email confirmation

Supabase's default is to require email confirmation before `signInWithPassword` succeeds. The
signup form handles both outcomes: if `data.session` comes back from `signUp()`, confirmation is
disabled and the user is signed in immediately; otherwise a "check your email" screen is shown.
See `student-auth-and-sync.md` for the local-testing options.

## Database tables (Checkpoint 3 additions)

All new tables live in `src/lib/db/schema/student.ts`, migrated in
`drizzle/0003_student_workspace.sql` (generated) and `drizzle/0004_student_workspace_grants.sql`
(hand-authored GRANT/REVOKE statements — see below for why).

| Table | Purpose |
| --- | --- |
| `student_profiles` | One row per student, keyed by `auth.users.id`. All fields beyond `id`/`email` are optional — no date of birth, passport, phone, address, financial, or medical data. |
| `user_opportunity_tracking` | Shortlist/stage/personal-deadline/priority/archived state for a built-in (published) opportunity. FK to `opportunities.id`. |
| `user_custom_opportunities` | Cloud-synced custom opportunities. Never linked to `official_sources`/`verification_records` — never labelled official or verified. |
| `user_notes` | Plain text only, one row per (student, target). Never rendered as HTML. |
| `user_checklist_tasks` | Personal checklist items, deliberately separate from Checkpoint 2's staff-managed `opportunity_document_requirements`. |
| `user_planning_preferences` | Cloud mirror of the guest `PreferencesRecord.planning` block — kept 1:1 with the local shape for lossless sync. |
| `user_display_preferences` | Theme + catalogue view + a `jsonb` field for future dashboard preferences. |
| `user_sync_state` | Sync bookkeeping only (last synced at, last conflict, migration-completed marker) — never workspace content. |
| `user_data_requests` | A lightweight, student-visible, append-only log of the student's own export/deletion actions. |

`student_profiles` is deliberately a **separate concept** from `user_planning_preferences`:
the former is the slower-changing "who are you" onboarding profile surfaced on `/account`; the
latter is a direct mirror of the guest planning-preferences shape, kept structurally identical
so migration/merge logic never has to reshape data.

**Out of scope, by design:** the full `src/lib/domain/user-profile.ts` contract (education
records, work experience, publications, certifications, language tests) is a future-looking
domain model from Checkpoint 0 broader than what this checkpoint's brief asked for. Checkpoint 3
implements exactly the fields the brief specifies and keeps the profile minimal — expanding into
the fuller domain model is deferred, not silently dropped.

## RLS model

Every table above calls `.enableRLS()` and gets exactly one owner-scoped policy via the new
`ownerAllPolicy(tableName, ownerColumn)` helper in `common.ts` — `FOR ALL TO authenticated USING
(ownerColumn = auth.uid()) WITH CHECK (ownerColumn = auth.uid())` — plus the standard
`serviceRoleBypassPolicy`. `user_data_requests` uses `ownerReadInsertPolicies` instead: select +
insert only, no update/delete, mirroring the staff audit log's append-only design.

**Deliberately no `staffSelectPolicy`** on any student table — staff get no broad read access to
private student data in Checkpoint 3 (see `privacy-and-data-controls.md`).

Same design principle as Checkpoint 2: the app's own Next.js server uses one privileged
`DATABASE_URL` connection that bypasses RLS entirely; RLS exists to lock down Supabase's
auto-exposed PostgREST data API against direct browser access with the anon/publishable key.
Real authorization happens in `getStudentSession()` + every Server Action under
`src/lib/db/actions/student/`, which always scope queries to `session.studentProfileId` — never
a client-supplied id.

### Why a second hand-authored grants migration

`0002_publication_invariants.sql` (Checkpoint 2) gave `anon`/`authenticated` a blanket SELECT on
every table via `ALTER DEFAULT PRIVILEGES` — correct for a read-only public catalogue, but wrong
for tables `authenticated` is meant to genuinely *write*. `0004_student_workspace_grants.sql`
explicitly grants `authenticated` full SELECT/INSERT/UPDATE/DELETE on the nine new tables (RLS
then narrows every row to the caller's own), and — belt-and-suspenders — explicitly **revokes**
`anon`'s inherited SELECT grant on the same nine tables, so a missing/misconfigured RLS policy
could never be the only thing standing between an unauthenticated visitor and private student
data. This was caught and verified directly: see the integration tests asserting anon gets a
"permission denied" error (not just zero filtered rows) for these tables.

## Sync architecture

Guest and signed-in data paths are **completely separate code paths**, not a single
data-source-agnostic layer:

- Guest: `src/lib/storage/*` (IndexedDB via `idb`) — unmodified since Checkpoint 1.
- Signed-in: `src/lib/db/actions/student/*` (Server Actions, privileged Postgres connection) +
  `src/hooks/useCloudWorkspace.ts` / `useCloudCustomOpportunities.ts` (client hooks) +
  `src/lib/sync/*` (offline queue, sync status, local cloud cache).

`app/workspace/page.tsx` is the one integration point: it resolves `getStudentSession()`
server-side and renders either the existing `WorkspaceView` (guest) or the new
`CloudWorkspaceView` (signed in) — never both, never merged.

**Documented scope boundary:** cloud sync is wired up for the dedicated `/workspace` page and
`/account` panels. The public catalogue/detail-page quick-shortlist button (`OpportunityCard`,
`OpportunityDetailBody`) remains guest-local in this checkpoint regardless of sign-in state —
making every touchpoint across the app cloud-aware was out of scope for this pass and is
recorded as follow-up work in the completion report, rather than silently left inconsistent.

### Offline queue

`src/lib/storage/db.ts` adds two IndexedDB stores (schema v3): `cloudCache` (one row per signed-in
student — the last-fetched cloud snapshot, for offline reads) and `syncOutbox` (queued
mutations). Both are keyed to a `studentProfileId` and explicitly cleared on sign-out
(`clearCloudWorkspaceLocalState()`) so they can never leak to a different person who later uses
the same browser/device.

`useCloudWorkspace` attempts every mutation (tracking patch, note, checklist add/toggle/
rename/delete) against its Server Action immediately. If the action fails or the browser is
offline (`useOnlineStatus()`), the mutation is applied optimistically to local state **and**
queued in `syncOutbox` via `src/lib/sync/outbox.ts`. A `window` "online" transition triggers
`flushOutbox()`, which replays queued entries **in creation order**, stopping at the first
failure rather than reordering or dropping work.

### Sync status

`src/lib/sync/status.ts` is a tiny module-level store (mirroring the existing
`emitStorageChange` pattern) exposing `saved | saving | offline | paused | failed | conflict` plus
`lastSyncedAt`, read via `useSyncStatus()` and shown by `SyncStatusIndicator`.

## Local-to-cloud migration flow

1. `MigrationPanel` reads the guest's local IndexedDB via `buildBackupPayload()` (the same
   function Settings' guest export uses) and calls the read-only `getMigrationContext()` Server
   Action for the account's current cloud counts.
2. The user is shown counts for both sides and any overlap, then picks **copy** (add only what's
   missing, never touch existing cloud rows), **merge** (for an overlapping opportunity/custom
   opportunity, keep whichever side's `updatedAt` is newer), or **replace** (delete existing
   cloud workspace rows first, then insert everything from the guest side) — replace requires an
   extra explicit confirmation click.
3. `applyGuestMigration()` runs the whole operation in one database transaction. It never
   deletes or even reads local IndexedDB data directly — the client sends the guest payload, and
   local deletion is never triggered automatically by a successful migration; the guest data on
   this device remains until the user separately clears it from Settings.
4. Stable-ID dedup: guest checklist item ids and custom-opportunity ids are client-generated
   UUIDs already, so the migration inserts them **using those same ids** as the cloud rows'
   primary keys — running the same migration twice is naturally idempotent (the second run's
   inserts collide on id/opportunity and are skipped or merged, never duplicated).

## Conflict handling

Two independent mechanisms, both intentionally simple (last-writer-wins by timestamp, with a
review path) rather than a full CRDT:

- **Migration-time**: `merge` mode compares `updatedAt`. If the two sides' timestamps are
  identical but the content differs, the item is reported in the result's `conflicts` array
  instead of silently picking a side, and the cloud version is kept (never blindly overwritten).
- **Live sync**: `upsertTracking`/`upsertNote` accept an optional `expectedUpdatedAt`. If the
  caller's last-seen timestamp doesn't match the current server row, the action returns
  `{ conflict: <server row> }` instead of applying the patch, and the client sets sync status to
  `conflict` for the UI to surface.

## Export/import model

`exportMyData()` (in `src/lib/db/actions/student/data-controls.ts`) returns the
`CloudExportPayload` shape defined in `src/lib/schemas/cloud-export.ts` — profile, tracking,
notes, checklist tasks, custom opportunities, planning/display preferences, and sync metadata
only. No auth tokens, cookies, secret keys, or staff/admin data — the schema is `.strict()` at
every level, so an attempt to smuggle in an unrelated field is rejected by construction, not by
convention. `importMyAccountData()` validates via `validateCloudExportPayload()` (schema +
prototype-pollution + size checks, mirroring the guest backup validator's design), then applies
merge/replace inside one transaction, skipping any `opportunityId` that no longer exists in the
public catalogue rather than failing the whole import.

This is a **distinct format** from the guest backup (`src/lib/storage/backup.ts`) — the two are
never interchangeable, and the UI keeps them on separate pages (`/settings` vs `/account/data`)
with separate copy explaining the difference.

## Deletion model

Two levels, both self-service, both requiring an explicit confirmation dialog:

- **`deleteMyWorkspaceData()`**: deletes the caller's tracking, notes, checklist tasks, custom
  opportunities, and planning/display preferences rows. The `student_profiles` and
  `user_sync_state` rows themselves are left in place — the account stays active with an empty
  workspace.
- **`deleteMyAccount()`**: wipes workspace data, deletes the `student_profiles` row, then calls
  `auth.admin.deleteUser()` via the service-role Admin API (`src/lib/supabase/admin.ts`, already
  used by the staff invite flow) — server-side only, the secret key never reaches a client
  bundle. Always acts on `getStudentSession()`'s verified id, never a client-supplied one.

Neither path touches published opportunity data, other students' data, or staff audit records —
by construction, since every delete statement is scoped to `studentProfileId = <the caller>`.
Guest/local IndexedDB data is completely untouched by either path; it is a separate, explicit
action in Settings.

## Privacy decisions

- Staff get no default read access to any student table (no `staffSelectPolicy`) — a deliberate,
  stricter choice than "documented + audited exceptional access," per the brief's own preference
  for "no staff access... in Checkpoint 3."
- `anon` is explicitly revoked from the default-privilege SELECT grant on every student table
  (see above) — cross-user/anonymous access is denied at the grant level, not just filtered by
  RLS, for defense in depth.
- Session-aware public pages (`/workspace`, `/privacy`) are marked `Cache-Control: no-store` by
  middleware whenever a user is signed in, and the service worker respects that header before
  writing to its shared app-shell cache — preventing one signed-in user's rendered page from
  being served to a different person offline on the same device later.
- No AI, no push notifications, no advertising, no sensitive-file upload anywhere in this
  checkpoint — verified structurally by `scripts/validate-checkpoint3.ts`.
