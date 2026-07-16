# Privacy and data controls (Checkpoint 3)

What account data ScholarTrack stores, what it never stores, how guest and account storage
differ, and exactly how export, import, deletion, and the staff/support boundary work.

## What account data is stored

If — and only if — a student creates an account and either fills in `/account`'s profile form or
uses the cloud workspace, ScholarTrack's Supabase-hosted Postgres database stores:

- **Identity**: Supabase Auth email + hashed credential (managed entirely by Supabase Auth, never
  by this app's own tables).
- **Profile** (`student_profiles`, all fields optional): display name, country/region, current
  and intended study level, graduation year, target intake year/term, preferred
  countries/study levels, onboarding-completed marker.
- **Tracking** (`user_opportunity_tracking`): shortlist flag, application stage, personal
  deadline, priority, archived flag, last-viewed timestamp — per built-in opportunity.
- **Custom opportunities** (`user_custom_opportunities`): student-authored entries, never marked
  official or verified.
- **Notes** (`user_notes`): plain text, never rendered as HTML.
- **Checklist tasks** (`user_checklist_tasks`): personal to-do items, separate from staff-managed
  required-document records.
- **Planning/display preferences**: intake timing, preferred countries/levels, theme, catalogue
  view.
- **Sync metadata** (`user_sync_state`): last synced time, last conflict time, migration-completed
  marker — never workspace content.
- **A short export/deletion request log** (`user_data_requests`): what the student themselves
  requested and when, visible only to them.

## What is never stored

- Date of birth, passport numbers, phone numbers, full postal address.
- Any financial or medical information.
- Any document file, image, scan, or OCR output — ScholarTrack has no upload endpoint for these
  in Checkpoint 3, same as Checkpoints 1–2.
- Payment details of any kind.
- The plaintext password (Supabase Auth stores only a salted hash; this app's own tables never
  see it).
- Any AI-generated recommendation or eligibility score — Checkpoint 3 adds no AI.

## Guest vs. account storage

| | Guest | Account |
| --- | --- | --- |
| Where | This browser's IndexedDB only | ScholarTrack's Supabase Postgres database |
| Who can read it | Nobody but this browser | The student themselves (RLS-enforced), plus the app's own server code |
| Survives clearing browser data? | No (unless backed up) | Yes |
| Available on another device? | No | Yes, after signing in there |
| Created automatically? | Never — an account is entirely optional | Never — created only on first sign-in, and only for that one user |

Signing in never uploads guest data automatically. Migration (`/account/sync`) is a distinct,
explicit, previewed action — see `checkpoint-3-architecture.md`'s migration-flow section.

## Export

- **Guest**: `/settings` → "Backup, restore & local data" — a local-only JSON export of
  IndexedDB content. No account required.
- **Account**: `/account/data` → "Export account data" — a JSON export of exactly the categories
  listed above, nothing more. Never includes auth tokens, cookies, secret keys, or any
  staff/admin record. The two export formats are intentionally incompatible with each other's
  import path (see below) so they can't be silently cross-applied.

## Import

- **Guest backup → guest storage**: `/settings`, unchanged since Checkpoint 1/2.
- **Guest data → cloud account**: `/account/sync`'s migration flow (copy/merge/replace with
  preview and confirmation) — not a raw file import; it reads this browser's live IndexedDB.
- **Cloud export → cloud account**: `/account/data`'s import — validates the file against a
  strict schema (`src/lib/schemas/cloud-export.ts`), rejects prototype-pollution keys and
  anything over 5&nbsp;MB, and only ever writes to the *signed-in* account's own rows. There is no
  path by which a student import can write to another student's data or to any staff/admin
  table — the schema has no fields shaped like staff data, and every write is scoped server-side
  to the caller's own `studentProfileId`.

## Deletion

- **`/account/delete` → "Delete cloud workspace data"**: removes tracking, notes, checklist,
  custom opportunities, and preferences. The account itself stays signed-in-able, with an empty
  workspace.
- **`/account/delete` → "Delete account"**: does the above, then removes the `student_profiles`
  row, then deletes the actual Supabase Auth user via the service-role Admin API (server-side
  only — the secret key never reaches the browser). The session is then signed out.
- Neither action touches: guest/local data on this or any other device (a separate, explicit
  Settings action), published catalogue data, or staff audit-log records unrelated to the
  deleted account.
- Both actions require an explicit confirmation dialog; the account-deletion dialog also shows a
  non-dismissible warning that the action is irreversible before the destructive button is even
  enabled to click through normal dialog flow.

## Support/admin boundary

- Every student-owned table has exactly one RLS policy: owner-only (`ownerAllPolicy`/
  `ownerReadInsertPolicies`, `src/lib/db/schema/common.ts`). There is **no** staff-select policy
  on any of them — Checkpoint 3 deliberately takes the brief's "prefer no staff access" option
  rather than building an exceptional-access audit flow.
- The app's own server connects with a privileged, RLS-bypassing connection for all reads/writes
  (same design as Checkpoint 2) — but every Server Action under `src/lib/db/actions/student/`
  scopes its query to `getStudentSession().studentProfileId`, so even that privileged connection
  never returns another student's row to a caller by accident.
- If a future checkpoint needs staff/support visibility into student data (e.g. for abuse
  response), that requires: a new, explicitly documented policy, a reason/audit trail, and
  time-boxing — none of which exists yet, by design. Until then, staff simply cannot browse
  student notes, checklists, or custom opportunities, casually or otherwise.
