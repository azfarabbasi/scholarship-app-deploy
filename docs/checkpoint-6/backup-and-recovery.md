# Checkpoint 6: Backup and recovery

No automated destructive backup job is implemented in this checkpoint — per the brief, "do not implement
destructive automated backups unless safe and explicitly configured." This document is the manual
procedure until a deployment explicitly configures something more automated.

## 1. Database backup

Supabase (Postgres) projects on the free tier retain daily backups for 7 days automatically — confirm
this in your project's Database → Backups settings. For an extra manual backup before a risky operation
(a migration, a bulk import, a schema change):

```bash
pg_dump "$DATABASE_URL" --format=custom --file=scholartrack-backup-$(date +%Y%m%d-%H%M).dump
```

Store the dump somewhere outside the database host itself (local machine, encrypted cloud storage). Never
commit a database dump to the repository.

## 2. Pre-deployment backup checklist

- [ ] Confirm the most recent automatic Supabase backup succeeded.
- [ ] If deploying a schema-changing migration, take a manual `pg_dump` first (§1).
- [ ] Note the current migration state: `npm run db:verify:migration`.
- [ ] Confirm you can restore the backup in a scratch project before you need to (see §5).

## 3. Migration rollback strategy

Drizzle migrations in this project are additive and forward-only by convention — every migration so far
(`drizzle/0001_*.sql` through `drizzle/0009_*.sql`) adds tables/columns/policies rather than dropping
them destructively. To roll back a bad migration:

1. Stop new application instances from starting against the new schema (redeploy the previous app
   version first — see the deployment runbook's rollback section).
2. Write and apply a new, forward migration that reverses the specific change (e.g. `DROP COLUMN`,
   `ALTER POLICY` back to the previous clause) — never hand-edit or delete a previously-applied migration
   file. `drizzle-kit generate` will emit the correct `ALTER`/`DROP` statements from a reverted schema
   definition, exactly as it did for `0009_ai_owner_policy_fix.sql`'s policy fix.
3. Re-run `npm run db:verify:migration`.

If the migration caused data loss, restore from the pre-migration backup (§1/§5) into a scratch database,
extract the affected rows, and merge them back manually — do not restore the entire production database
over live data without a second, current backup of the interim state first.

## 4. Legacy import rollback

The legacy CSV/JSON import path already ships its own rollback:

```bash
npm run db:import:legacy:rollback
```

See [Checkpoint 2 migration runbook](../checkpoint-2/migration-runbook.md) for the full procedure.

## 5. Supabase project recovery basics

- **Lost access to the Supabase dashboard**: use Supabase's account recovery flow (outside this app's
  control) — this project stores no separate copy of Supabase account credentials anywhere.
- **Corrupted/deleted data**: restore the relevant table(s) from the most recent backup into a new,
  temporary Supabase project (or a local Postgres instance), then selectively copy the needed rows back
  via `pg_dump --table=X` / `psql` rather than restoring the whole database over current data.
- **Full project loss**: re-provision a new Supabase project per
  [Checkpoint 2 Supabase setup](../checkpoint-2/supabase-setup.md), restore the latest backup, re-run
  `npm run db:bootstrap:admin -- --confirm`, and update `DATABASE_URL`/`NEXT_PUBLIC_SUPABASE_URL`/
  `SUPABASE_SECRET_KEY` in the new deployment's environment.

## 6. Environment variable rotation

- **Supabase secret key**: rotate from the Supabase dashboard, update `SUPABASE_SECRET_KEY` in the
  hosting provider's environment settings, redeploy. The old key is invalidated by Supabase, not by this
  app — there's no in-app step.
- **AI (Groq) key rotation**: same pattern — rotate in the Groq console, update `GROQ_API_KEY`, redeploy.
  The assistant is unavailable for the (typically under a minute) window between rotation and redeploy;
  the rest of the app is unaffected (`AI_ENABLED` degrades gracefully, see
  [Checkpoint 5 architecture](../checkpoint-5/checkpoint-5-architecture.md)).
- **Cookie-signing fallback secret** (`SUPABASE_SECRET_KEY`, reused by the AI guest quota and correction-
  report rate limiter — see `src/lib/security/cookie-rate-limit.ts`): rotating it invalidates any
  in-flight guest rate-limit cookies harmlessly (they just reset to zero, not a security issue).

## 7. Admin access recovery

- **A working Administrator account exists but its password is lost**: use Supabase Auth's standard
  password-reset flow at `/staff/login`.
- **No Administrator account can sign in at all (lost bootstrap access)**: re-run
  `npm run db:bootstrap:admin -- --confirm` with `BOOTSTRAP_ADMIN_EMAIL` set to a Supabase Auth user that
  already exists (create one via `/auth/signup` or the Supabase dashboard first if needed) — the script
  is idempotent and safe to run again; it grants the Administrator role, it does not create duplicate
  staff profiles for an email that already has one.
- **Every Administrator has been accidentally revoked**: this requires direct database access (e.g. the
  Supabase SQL editor) to insert a row into `staff_role_assignments` for a known `staff_profiles.id` —
  there is no in-app self-service path for this scenario by design (staff role management itself requires
  an existing Administrator, per `canManageStaff()`).

## 8. Data export procedures

- **Student data**: `/account/data` (self-service, JSON export) — see
  [Checkpoint 3 privacy and data controls](../checkpoint-3/privacy-and-data-controls.md).
- **Staff/operational data**: `/staff/opportunities` → export, and `/api/staff/export/opportunities` for a
  full catalogue CSV export (Administrator/Senior Reviewer only, per existing role checks).
- **Full database**: `pg_dump` (§1) — the only complete export; the in-app exports above are scoped,
  per-user or per-catalogue, by design (never a full-database dump through the app itself).

## 9. Incident response basics

1. **Identify scope**: is this a data issue (wrong/leaked info), an availability issue (site down), or a
   security issue (suspected breach)?
2. **Contain**: for an AI-specific incident, use the `/staff/ai` kill switch immediately — no redeploy
   needed. For a broader issue, consider rolling back to the previous deployment (see the deployment
   runbook).
3. **Communicate**: use the contact channels documented on `/security` and `/contact`.
4. **Fix and verify**: apply the fix, re-run the full validator suite (`npm run checkpoint6:validate` and
   friends) before redeploying.
5. **Record**: staff-facing incidents affecting published data should be logged via the existing
   append-only `audit_log` (already enforced at the database level — see
   [Checkpoint 2 architecture](../checkpoint-2/checkpoint-2-architecture.md)).

## 10. Correction workflow (data-quality "incidents")

A wrong catalogue fact is not a security incident, but it does need a defined path: any visitor uses
"Report incorrect information" on the affected opportunity → staff triage at `/staff/corrections`
(`canTriageCorrections`) → investigate/resolve/reject, all audit-logged. See
[Checkpoint 2 data verification procedure](../checkpoint-2/data-verification-procedure.md).

## 11. Source verification workflow

Staff periodically re-check published records against their official source and update the verification
status/"last checked" date — see [Verification policy](/verification-policy) (public-facing) and
[Checkpoint 2 data verification procedure](../checkpoint-2/data-verification-procedure.md) (internal
process) for the full detail.

## 12. Stale data review schedule

No automated staleness job exists (consistent with "no cron-based batch jobs" elsewhere in this project —
see [Checkpoint 4's current limitations](../checkpoint-4/checkpoint-4-completion-report.md)). The
practical schedule today: staff review the `stale`-flagged verification status (see
[Verification policy](/verification-policy)) during regular catalogue maintenance, and any visitor-reported
correction is triaged as it arrives. A scheduled/automated staleness sweep is a reasonable future
enhancement, not built this checkpoint.
