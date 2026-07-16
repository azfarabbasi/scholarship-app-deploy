# Migration runbook

Covers two distinct things people call "migration" here — keep them separate:

- **Schema migrations** (`drizzle/*.sql`): the database structure (tables, RLS, triggers).
- **The legacy data migration**: importing the 55-record v0.1 seed into that schema.

## Local database workflow (day to day)

The default `docker compose up` now also starts a `db` service (plain Postgres 16, not
Supabase) alongside `web`. This is what you use for ordinary development.

**Start it:**
```
docker compose up -d db
```

**Stop it** (data persists in the `postgres_data` volume):
```
docker compose stop db
```

**Reset it completely** (drops all data — the volume, not just the container):
```
docker compose down -v db   # or: docker compose down -v   (drops every project volume)
docker compose up -d db
```

**Apply migrations** (run once after starting a fresh `db`, and again any time
`src/lib/db/schema/**` changes and a new migration is generated):
```
npx tsx scripts/db-apply-sql.ts scripts/db/local-auth-shim.sql   # local Postgres only — never against Supabase
npm run db:migrate
npm run db:seed:taxonomies
```

**Connect the app to a cloud Supabase project instead:** see `supabase-setup.md` §4–6 — set
`DATABASE_URL`/`DATABASE_MIGRATION_URL` to Supabase's connection strings and skip the local
auth shim (Supabase already provides a real `auth` schema).

## Schema migrations

**Generate a migration** after changing `src/lib/db/schema/**`:
```
npm run db:generate
```
This diffs the TypeScript schema against the last snapshot and writes
`drizzle/000N_<name>.sql`. Review the generated SQL before applying it — for anything Drizzle
can't express (cross-table triggers, RLS-supporting grants), add a **custom** migration instead:
```
npx drizzle-kit generate --custom --name my_migration
```
then hand-write the SQL (see `drizzle/0000_auth_helpers.sql` and
`drizzle/0002_publication_invariants.sql` for the pattern).

**Apply migrations:**
```
npm run db:migrate
```

**Check for drift** (schema vs. migration history consistency):
```
npm run db:check
```

**Rollback / recovery for a failed schema migration:** `drizzle-orm`'s migrator applies all
pending migrations inside one transaction, so a failure rolls back automatically — nothing is
left half-applied. To manually undo an already-applied migration, write and apply a new
*forward* migration that reverses it (standard practice for production databases; this project
does not use down-migrations). Always take a database backup/snapshot before applying a
migration to a database holding real reviewed data (Supabase project dashboards offer
point-in-time recovery on paid tiers, or use `pg_dump` for a plain Postgres instance).

## Legacy 55-record migration

This is a **separate, idempotent, re-runnable** process from schema migrations — running it
does not require (or perform) a schema migration.

**Dry run** (validates every record, reports what *would* happen, writes nothing):
```
npm run db:import:legacy:dry-run
```

**Import for real:**
```
npm run db:import:legacy
```

**Verify the result against the source file:**
```
npm run db:verify:migration
```
Reports: total expected vs. imported, published count (should be 0 immediately after import —
nothing auto-publishes), pending-review count, how many have an official source, and flags any
imported record incorrectly marked `verified` (there should never be any).

**Rollback** (deletes every opportunity any not-yet-rolled-back legacy import job created):
```
npm run db:import:legacy:rollback
```

**Retry after a failure:** the importer processes each of the 55 records independently and is
fully idempotent — re-running `db:import:legacy` after a partial failure (e.g. a dropped
connection) safely skips every record already imported (matched by
`legacy_migration_reference`) and only processes what's missing. There is no partial-import
state to clean up manually.

**Backup before migrating:** since the importer only ever *creates* new rows (never touches
existing published data) and is fully reversible via `--rollback`, a backup isn't strictly
required for this step — but if you're importing into a database with other reviewed content,
take one anyway (see the "Rollback / recovery" note above).

### What the importer actually does, precisely

- Reads and Zod-validates `data/migrations/v0.1/scholarships.seed.json` (55 records).
- Creates one shared placeholder organisation/provider ("Legacy migration — provider pending
  identification") for all 55 records, since the source data never had a structured provider
  name — this is disclosed, not inferred.
- For each record: creates the `opportunities` row as **`draft`**, `overall_verification_status
  = 'unverified'` (regardless of what the legacy prototype's data claimed), preserves the
  original benefit/eligibility wording as a `funding_benefits`/`eligibility_rules` row (status
  `draft`, not shown publicly until a reviewer promotes it — see "Promote" buttons on the
  opportunity detail page), preserves `migrationNotes` in the `description` field, creates one
  `official_sources` row in `candidate` status (not `confirmed-official` — a human must upgrade
  that) linked via `opportunity_official_sources`, and creates one `deadline_cycles` +
  `deadline_occurrences` row with the original precision/date/raw text.
- Never invents a deadline, never rolls one into a new year, never marks anything verified.

### Publication is a separate, human decision

Importing does **not** publish anything. To make an imported record visible on the public site,
a reviewer must go through the normal workflow (`staff-roles-and-workflows.md`): review it,
have a Senior Reviewer/Administrator approve it, upgrade its official source to
`confirmed-official` with a real `last_checked_at`, promote its funding benefit/eligibility rule
to `published`/`active`, and publish. See `checkpoint-2-completion-report.md` for the exact
current published/pending counts.

## Test-only fixture publishing (e2e only — never use this for real content)

`npm run db:publish:test-fixtures` bulk-publishes every currently-imported legacy record by
directly writing the version/status rows a reviewer would normally produce, skipping the actual
review workflow entirely. This exists **solely** so the Playwright e2e suite (which has no real
Supabase staff credentials) can exercise the public database-backed catalogue against realistic
data. It refuses to run against anything that doesn't look like a local/test database (same
guard as `db:reset:test`). Never run it against a database serving real users.

## Integration tests

```
docker compose up -d db-test          # or let `docker compose --profile test` manage it
npm run db:reset:test                 # drops+recreates schemas, re-migrates, re-seeds taxonomies
npm run db:test                       # runs tests/integration/**/*.test.ts
```
`db:reset:test` refuses to run unless `DATABASE_URL` looks like a local/test database
(contains `scholartrack_test`, `localhost`, `127.0.0.1`, or `db-test`) — it is destructive
(drops schemas) and must never be pointed at a shared database.
