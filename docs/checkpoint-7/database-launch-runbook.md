# Checkpoint 7: Database launch runbook

The exact procedure for taking a fresh Supabase project from empty to launch-ready. Read
`docs/checkpoint-2/migration-runbook.md` first for the full conceptual background — this is the
condensed, ordered, launch-day checklist.

## Rules that apply to every step below

- **Never run `db:reset:test`, or any command containing "reset", against a production or
  staging database.** That command refuses to run unless `DATABASE_URL` looks like a local/test
  database (contains `scholartrack_test`, `localhost`, `127.0.0.1`, or `db-test`) — do not work
  around that guard.
- **Never expose `SUPABASE_SECRET_KEY` or `DATABASE_URL`/`DATABASE_MIGRATION_URL` to the
  browser, a log line, a committed file, or a public error message.** They are server-only by
  design (`src/lib/env.ts`).
- **Never commit a real database connection string anywhere**, including in a script you write
  for convenience, a `.env` file (only `.env.example` with placeholders is committed), or a
  support/incident ticket.
- **Always dry-run an import before running it for real.**
- **Always verify published counts after any import** — never assume it worked.

## 1. Pre-migration backup checklist

- [ ] If this is a *new* Supabase project with no real data yet, a backup isn't needed —
      skip to step 2.
- [ ] If this project already has real user data (a re-launch or a schema change on an existing
      production database), take a manual backup first:
      ```bash
      pg_dump "$DATABASE_URL" --format=custom --file=pre-launch-backup-$(date +%Y%m%d).dump
      ```
      Store it outside the database host. See `docs/checkpoint-6/backup-and-recovery.md` §1.
- [ ] Confirm Supabase's own automatic daily backups are enabled (Dashboard → Database →
      Backups) — free tier retains 7 days.

## 2. Apply schema migrations

```bash
npm run db:migrate
```
This applies every migration under `drizzle/*.sql` in order, inside one transaction — a failure
rolls back automatically (see "Migration failure handling" below).

## 3. Verify migration state

```bash
npm run db:check
```
Confirms schema/migration-history consistency (`drizzle-kit check`). This does not require a
live database connection to succeed in every case, but run it against the real target database
for a launch — it should report no drift.

## 4. Seed reference taxonomies

```bash
npm run db:seed:taxonomies
```
Idempotent — safe to re-run. Populates countries, study levels, opportunity types, funding
types, fields of study, and document templates. Required before importing any opportunity data.

## 5. First-admin bootstrap

Set `BOOTSTRAP_ADMIN_EMAIL` to a real email address of an existing Supabase Auth user (create
one via `/auth/signup` or the Supabase dashboard first if it doesn't exist yet):

```bash
npm run db:bootstrap:admin              # dry run — prints what it would do
npm run db:bootstrap:admin -- --confirm # actually grants the Administrator role
```

**Staff login test**: sign in at `/staff/login` with that account. Confirm you land on `/staff`
and can see the dashboard. Every additional staff member is invited from `/staff/team` after
this — no more scripts needed.

## 6. Legacy content import (dry run first, always)

```bash
npm run db:import:legacy:dry-run
```
Review the output — every one of the 55 records should report as importable, with zero
rejections. If anything is rejected, stop and investigate before proceeding (do not import a
partial/broken dataset).

```bash
npm run db:import:legacy
```
Imports all 55 as **unverified drafts** — nothing is published automatically, by design (see
`docs/checkpoint-2/migration-runbook.md`, "Publication is a separate, human decision").

**Verify published counts after import:**
```bash
npm run db:verify:migration
```
Should report: 55 imported, **0 published** (correct — nothing auto-publishes), 55 with an
official source, 0 incorrectly marked verified. If any number here doesn't match, do not proceed
to launch — investigate first.

Also run, for the full, current picture across every record (not just the legacy import):
```bash
npm run launch:content
```
See `docs/checkpoint-7/content-readiness-report.md` for what a real run of this reports and what
it means for launch readiness.

## 7. Human review before publishing anything

This is the step that actually makes records public — and it is a human, editorial step, not a
script. For each record you intend to launch with: open it at
`/staff/opportunities/[id]`, follow `docs/checkpoint-2/data-verification-procedure.md`'s reviewer
checklist, submit for review, have a *different* qualified person review and approve it, upgrade
its official source to `confirmed-official` with a real checked date, and publish.

**Never run `npm run db:publish:test-fixtures` against this database.** That command is
explicitly test-only (see `docs/checkpoint-2/migration-runbook.md`) — it bypasses this entire
review step and would mean claiming records are reviewed when no human ever reviewed them.

## 8. Public catalogue test

After publishing at least one record:
- [ ] Visit `/opportunities` (signed out) — the published record(s) appear.
- [ ] Visit `/api/health` — reports `status: "ok"` and the correct `publishedOpportunityCount`.
- [ ] Open a published record's detail page — official source link, verification badge, and
      deadline section all render correctly.

## 9. RLS smoke test

Run the real integration suite against the target database's *staging/test copy* (never against
the live production database with real user data — RLS tests use adversarial cross-user
scenarios that are safe only against disposable data):
```bash
npm run db:test
```
Should report all tests passing, including the 20 AI RLS tests and the cross-user isolation
tests in `student-workspace-rls.test.ts`/`discovery-rls.test.ts`. If you cannot run this against
a disposable copy of your exact schema, at minimum confirm RLS is enabled on every table via the
Supabase dashboard's table editor (a shield icon appears next to RLS-enabled tables).

## 10. Migration failure handling

- **Schema migration fails partway**: `drizzle-orm`'s migrator wraps all pending migrations in
  one transaction — a failure rolls back automatically, nothing is left half-applied. Fix the
  underlying issue (usually a migration file that doesn't apply cleanly to the current schema
  state) and re-run `db:migrate`.
- **Legacy import fails partway**: the importer is idempotent and processes each record
  independently — re-running `db:import:legacy` skips every record already imported (matched by
  `legacy_migration_reference`) and only processes what's missing. No manual cleanup needed.
- **Need to fully undo the legacy import**: `npm run db:import:legacy:rollback` (deletes every
  opportunity the import job created, and only those).
- **A published record's schema-level change needs reverting**: see
  `docs/checkpoint-6/backup-and-recovery.md` §3 — write a new forward migration, never hand-edit
  an already-applied one.

## 11. Backup-after-launch procedure

- [ ] Immediately after the first real publish, take a manual `pg_dump` backup (step 1's
      command) — this is now real, human-reviewed content worth protecting.
- [ ] Confirm Supabase's automatic daily backup ran successfully the next day.
- [ ] Add a recurring calendar reminder (weekly is reasonable at launch scale) to spot-check that
      backups are still running — see `docs/checkpoint-7/launch-operations-runbook.md`.
