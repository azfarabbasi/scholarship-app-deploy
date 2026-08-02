# Supabase setup (staff authentication)

This project uses a **local/plain Postgres container for the database** (schema, catalogue,
staff data — see `migration-runbook.md`) and a **real Supabase project only for staff
authentication**. You do not need Supabase at all to work on the public catalogue, and the app
shows a safe "staff sign-in is not configured" state rather than crashing if these variables are
unset.

## 1. Create a Supabase project

1. Go to https://supabase.com and sign in (free tier is enough for Year 1's staff-only usage).
2. Click **New project**. Pick any name (e.g. `scholartrack-staging`), a strong database
   password (you will not need it directly — see step 4), and a region.
3. Wait for provisioning to finish (a minute or two).

## 2. Locate your project URL and publishable key

1. In the project dashboard, go to **Project Settings → Data API** (or **API** on older
   dashboard versions).
2. Copy the **Project URL** — this is `NEXT_PUBLIC_SUPABASE_URL`.
3. Go to **Project Settings → API Keys**. Copy the **`anon` / publishable** key — this is
   `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Both of these are safe to expose to a browser (that's
   what "publishable" means); Row Level Security is what keeps them safe (see
   `checkpoint-2-architecture.md` §4).

## 3. Locate your secret key

1. Same **API Keys** page: copy the **`service_role` / secret** key — this is
   `SUPABASE_SECRET_KEY`.
2. **Never** put this in a `NEXT_PUBLIC_` variable, commit it, or paste it anywhere public. It
   bypasses every RLS policy and can read/write anything in the project.

## 4. Locate your database connection strings

You only need these if you choose to run the Drizzle schema against Supabase's own Postgres
instead of (or in addition to) the local Docker Postgres described in `migration-runbook.md`.

1. **Project Settings → Database → Connection string**.
2. Use the **pooled (Transaction mode / port 6543)** string for `DATABASE_URL` (the app's normal
   runtime traffic).
3. Use the **direct (Session mode / port 5432)** string for `DATABASE_MIGRATION_URL` (migrations
   need a non-pooled connection).
4. Both contain the database password you set in step 1 — treat them as secrets.

## 5. Create `.env.local`

Copy `.env.example` to `.env.local` (gitignored) and fill in the five Supabase-related values
from steps 2–4, plus `BOOTSTRAP_ADMIN_EMAIL` (your own email — see step 7):

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=eyJ...
SUPABASE_SECRET_KEY=eyJ...
DATABASE_URL=postgres://postgres.xxxx:PASSWORD@aws-0-region.pooler.supabase.com:6543/postgres
DATABASE_MIGRATION_URL=postgres://postgres.xxxx:PASSWORD@aws-0-region.pooler.supabase.com:5432/postgres
BOOTSTRAP_ADMIN_EMAIL=you@example.com
```

If you're only using local Postgres for the database (recommended for day-to-day development —
see `migration-runbook.md`), leave `DATABASE_URL`/`DATABASE_MIGRATION_URL` as the Docker Compose
defaults and only fill in the three `SUPABASE_*` values above.

## 6. Apply migrations to your Supabase database

```
npm run db:migrate
npm run db:seed:taxonomies
```

(Only needed if you pointed `DATABASE_URL` at Supabase in step 5 — the local Docker workflow
does this automatically via `db:reset:test`.)

## 7. Bootstrap the first administrator

This project has **no public registration** — the very first staff account must be created
deliberately, once, via a server-only script:

```
npm run db:bootstrap:admin
```

Run it once **without** `-- --confirm` first — it prints what it would do (a dry run) without
writing anything. Once you're satisfied, run it for real:

```
npm run db:bootstrap:admin -- --confirm
```

This looks up (or invites, via Supabase's invite email) the Supabase Auth user matching
`BOOTSTRAP_ADMIN_EMAIL`, creates their `staff_profiles` row, and grants them the
`administrator` role — but only if no *other* active administrator already exists; if one does,
you must add `--force` explicitly (see `scripts/bootstrap-admin.ts`), which is a deliberate
guard against silently minting a second administrator.

If Supabase's invite email doesn't arrive (shared free-tier email sending is rate-limited), go
to **Authentication → Users** in the Supabase dashboard, find the invited user, and use
**Send password recovery** to set a password directly, or use the dashboard's "Add user" flow
with a password you set yourself, then re-run the bootstrap command — it's idempotent and will
find the now-existing user.

## 8. Test login

For local one-account workflow testing, set `ALLOW_ADMIN_SELF_REVIEW=true` alongside
`BOOTSTRAP_ADMIN_EMAIL`. The verified bootstrap account then receives the audited testing
exception documented in `staff-roles-and-workflows.md`; every other administrator retains normal
separation of duties. Never enable this in production (startup validation rejects it there).

1. `npm run dev` (or `docker compose up`).
2. Go to `http://localhost:3000/staff/login`.
3. Sign in with `BOOTSTRAP_ADMIN_EMAIL` and the password you set.
4. You should land on `/staff` and see the full staff navigation (Administrator sees every
   section).

## 9. Inviting additional staff

Once you have an administrator, use **Team** (`/staff/team`) in the staff UI to invite more
reviewers/senior reviewers/administrators by email — no more manual scripts needed after the
first bootstrap.

## 10. Rotating a compromised secret

If `SUPABASE_SECRET_KEY` (or the database password) is ever exposed:

1. In the Supabase dashboard, **Project Settings → API Keys → Reset `service_role` key** (or
   **Database → Reset password** for the DB password).
2. Update `SUPABASE_SECRET_KEY` (and/or `DATABASE_URL`/`DATABASE_MIGRATION_URL`) in every
   environment where it's deployed — local `.env.local`, CI secrets, hosting provider config.
3. Restart the application so it picks up the new value (this app reads env vars at process
   start, not per-request).
4. The old key stops working immediately once reset — there is no grace period, so coordinate
   the rotation with a deploy of the new value to avoid downtime.

## Never commit secrets

`.env`, `.env.local`, and any other real environment file are already gitignored
(`.gitignore`). Only `.env.example` (placeholders, no real values) is committed. Before every
commit, double-check `git status`/`git diff` doesn't include a real key — if one ever is
committed, treat it as compromised and rotate it immediately (step 10), even if you remove it
from a later commit (it remains in git history).
