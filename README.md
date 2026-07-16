# ScholarTrack Platform

ScholarTrack is a guest-first Progressive Web App for discovering, understanding,
and tracking verified scholarship and internship opportunities. Checkpoint 1
delivered the first fully functional release on a build-time JSON catalogue.
Checkpoint 2 replaced that catalogue with a normalised, reviewed PostgreSQL
database and added a staff-only administration system — structured
opportunity records, official sources, verification history, a draft →
review → approve → publish workflow with separation of duties, required
documents and eligibility rules, correction reports, duplicate detection and
merging, CSV import/export, and an append-only audit log.
**Checkpoint 3 adds optional student accounts and cloud sync for the
personal workspace** — sign up/sign in via the same Supabase Auth used by
staff (but on a completely independent, non-overlapping session), migrate
guest IndexedDB data into an account with a previewed copy/merge/replace
choice, sync shortlist/stages/notes/checklists/deadlines/custom
opportunities/preferences across devices, work offline with a queued-sync
model, and export/delete cloud data at will. Guest mode remains fully
functional and is not required — see
[Checkpoint 3](#checkpoint-3-optional-student-accounts-and-cloud-sync) below.
AI, push notifications, advertising, and sensitive-document uploads remain
out of scope (see [Known limitations](#known-limitations-and-deferred-work)).

Checkpoint 0 established repository boundaries, a Docker-first development
contract, the domain model, and a documented audit of the legacy prototype.
Checkpoint 1 built the guest-facing product. Checkpoint 2 built the verified
data layer and staff tooling underneath it. Checkpoint 3 adds optional
accounts and cloud sync on top of both, without changing either.

## What ScholarTrack does today

- **Browse a database-backed, staff-reviewed catalogue** (Checkpoint 2): the
  public catalogue now reads only `published` records from PostgreSQL — never
  a build-time JSON file — with an offline cache that shows a truthful "last
  synced" time or a service-unavailable state rather than stale data
  presented as current. See [Checkpoint 2](#checkpoint-2-database-staff-admin-and-supabase-auth)
  below.
- **Browse and search** all built-in opportunities, plus any you add
  yourself, with combinable filters (country, region, study level,
  opportunity type, deadline state, precision, verification, origin, stage)
  and sorting (nearest reliable deadline, personal deadline, title, country,
  recently updated, stage, deadline state). Catalogue search/filter state is
  reflected in the URL so results are shareable.
- **Understand deadlines honestly.** A deterministic evaluator implements the
  Checkpoint 0 deadline-intelligence specification: exact, estimated, rolling,
  unknown, program-specific, and institution-specific deadlines are never
  conflated. A countdown is shown only when the source is verified, exact, and
  its timezone is known — which, per the Checkpoint 0 audit, is none of the 55
  seed records today, so the app is deliberately conservative rather than
  showing a false "Apply now."
- **Track your own progress as a guest**: shortlist, an application stage,
  plain-text notes, a checklist (with generic starter tasks), and a personal
  deadline, per opportunity — stored locally, never on a server.
- **Add custom opportunities** the catalogue doesn't have yet, editable and
  deletable, always labelled as self-reported rather than officially verified.
- **Plan with a calendar**: month and agenda views, personal-deadline and
  verified-official dated events kept visually and semantically distinct,
  undated/uncertain opportunities listed separately, and standards-shaped
  `.ics` export (single event or all upcoming).
- **Back up and restore** guest data as JSON (merge or replace, with a preview
  and confirmation before a destructive replace), export a CSV summary of
  tracked applications, and inspect local-storage diagnostics — all from
  **Settings**.
- **Install as an app** (PWA) and keep using the catalogue, workspace,
  calendar, and settings offline after the first successful online visit.
- **Light/dark/system theme**, accessible throughout (skip link, landmarks,
  labelled forms, focus-visible outlines, `aria-live` status announcements,
  reduced-motion support, non-colour-only status indicators).
- **Optionally create an account** (Checkpoint 3) to sync your shortlist,
  application stages, notes, checklists, personal deadlines, custom
  opportunities, and preferences to your own ScholarTrack account and use
  the same workspace on another device. Entirely optional — guest mode never
  requires it. See [Checkpoint 3](#checkpoint-3-optional-student-accounts-and-cloud-sync).

## Workspace rules

The parent workspace contains two sibling directories with different roles:

- `../ScholarTrack_Europe` is the legacy static prototype. It is strictly
  read-only. It may be inspected, but nothing in it may be edited, formatted,
  renamed, moved, deleted, generated, installed, or built.
- `scholartrack-platform` is the only directory in which production work,
  dependency installation, generated output, and build activity may occur.

The complete locked constraints are recorded in [PROJECT_RULES.md](PROJECT_RULES.md).

## Docker prerequisites

- Docker Desktop with the WSL 2 backend enabled on Windows.
- Docker Compose v2 (the `docker compose` command, not legacy
  `docker-compose`).
- Port `3000` available on the host.

Confirm Docker is ready from PowerShell:

```powershell
docker version
docker compose version
```

## Start the development environment

From the parent workspace:

```powershell
Set-Location .\scholartrack-platform
docker compose config
docker compose up --build
```

The development site is expected at <http://localhost:3000> after Next.js reports
that it is ready. Keep the terminal open to see server and hot-reload logs.

To start in the background instead:

```powershell
docker compose up --build --detach
docker compose logs --follow web
```

The Compose service is named `web`. It mounts this source directory at `/app`,
while named volumes keep `/app/node_modules` and `/app/.next` managed by Docker.
Polling is enabled for reliable change detection across Windows bind mounts.

Note: `web` runs `next dev`, which intentionally disables the service worker.
To exercise PWA/offline behaviour, use a production build (`npm run build &&
npm run start`, or the `web-e2e` Compose service described below).

## Environment values

The default Docker workflow (`docker compose up`) needs **no credentials at all** — it starts
its own local Postgres (`db` service) and the app falls back to a safe "not configured" state
for staff sign-in until you add Supabase credentials.

```powershell
Copy-Item .env.example .env.local
```

- `NEXT_PUBLIC_APP_URL` — used for absolute metadata URLs; safe to leave unset
  for local development.
- `NEXT_PUBLIC_FEEDBACK_EMAIL` — if set, adds an "Email feedback" mailto button
  in Settings → Feedback. Leave unset to only offer "Copy feedback text" (there
  is no feedback backend either way).
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`,
  `SUPABASE_SECRET_KEY`, `DATABASE_URL`, `DATABASE_MIGRATION_URL`,
  `BOOTSTRAP_ADMIN_EMAIL`, `APP_BASE_URL`, `ENABLE_DATABASE_CATALOGUE`,
  `ENABLE_STAFF_ADMIN` — Checkpoint 2's database/staff-admin configuration. See
  [docs/checkpoint-2/supabase-setup.md](docs/checkpoint-2/supabase-setup.md) for exact,
  beginner-friendly setup steps for every one of these.

Never put real credentials in `.env.example`, source files, Dockerfiles, or
Compose configuration. Local `.env*` files are ignored by both Git and the Docker
build context, except for the placeholder-only example.

## Lint, typecheck, and build

Docker-first validation commands, run from `scholartrack-platform`:

```powershell
docker compose build
docker compose run --rm --no-deps web npm run data:validate
docker compose run --rm --no-deps web npm run deadlines:audit
docker compose run --rm --no-deps web npm run checkpoint0:validate
docker compose run --rm --no-deps web npm run checkpoint1:validate
docker compose run --rm --no-deps web npm run checkpoint2:validate
docker compose run --rm --no-deps web npm run checkpoint3:validate
docker compose run --rm --no-deps web npm run typecheck
docker compose run --rm --no-deps web npm run lint
docker compose run --rm --no-deps -e NODE_ENV=production web npm run build
```

Equivalent host commands (if Node.js is intentionally installed locally):

```powershell
npm ci
npm run data:validate
npm run deadlines:audit
npm run checkpoint0:validate
npm run checkpoint1:validate
npm run checkpoint2:validate
npm run checkpoint3:validate
npm run typecheck
npm run lint
npm run build
```

## Automated tests

Unit and component tests (Vitest + React Testing Library; IndexedDB is
polyfilled with `fake-indexeddb` in the test environment):

```powershell
docker compose run --rm --no-deps web npm run test
docker compose run --rm --no-deps web npm run test:coverage
```

Database/RLS/migration integration tests (require a running local Postgres —
see [Checkpoint 2 § Local database workflow](#local-database-workflow)):

```powershell
docker compose up -d db-test
docker compose run --rm --no-deps -e DATABASE_URL=postgres://scholartrack_test:scholartrack_test_password@db-test:5432/scholartrack_test web npm run db:reset:test
docker compose run --rm --no-deps -e DATABASE_URL=postgres://scholartrack_test:scholartrack_test_password@db-test:5432/scholartrack_test web npm run db:test
```

End-to-end tests (Playwright) run through a dedicated Compose test profile
that builds a **production** instance of the app (`web-e2e`) and drives it
with the official Playwright browser image (`e2e`), so no browser install is
needed on the host:

```powershell
docker compose --profile test run --rm e2e
```

The first run downloads the Playwright image and builds `web-e2e`; subsequent
runs are faster. `web-e2e` shares its network namespace with `e2e`
(`network_mode: service:web-e2e`) so the app is reachable at
`http://127.0.0.1:3000` — a secure context for service-worker registration,
which a Docker-internal hostname is not.

A handful of staff and student e2e tests require real, confirmed Supabase
accounts and are configuration-gated: `E2E_STAFF_EMAIL`/`E2E_STAFF_PASSWORD`
(staff), `E2E_STUDENT_EMAIL`/`E2E_STUDENT_PASSWORD` (student), and
`E2E_STUDENT2_EMAIL`/`E2E_STUDENT2_PASSWORD` (a second student account, for
the cross-user isolation test). Without them set, those specific tests report
a clear skip reason rather than a false pass — everything else in the suite
runs unconditionally. Tear down the test containers with:

```powershell
docker compose --profile test down --remove-orphans
```

If Node.js and browsers are installed on the host instead:

```powershell
npx playwright install --with-deps chromium
npm run test:e2e
```

## Checkpoint 2: database, staff admin, and Supabase Auth

### Local database workflow

`docker compose up` now also starts a `db` service (plain Postgres 16 — not Supabase) for
day-to-day development:

```powershell
docker compose up -d db
docker compose exec db psql -U scholartrack -d scholartrack   # open a shell, if you need one
```

Apply migrations and seed reference taxonomies (countries, study levels, opportunity types,
etc. — idempotent, safe to re-run):

```powershell
docker compose run --rm --no-deps web npx tsx scripts/db-apply-sql.ts scripts/db/local-auth-shim.sql
docker compose run --rm --no-deps web npm run db:migrate
docker compose run --rm --no-deps web npm run db:seed:taxonomies
```

Import the original 55-record migration seed (dry run first, then for real — see
[docs/checkpoint-2/migration-runbook.md](docs/checkpoint-2/migration-runbook.md) for the full
procedure, including rollback and verification):

```powershell
docker compose run --rm --no-deps web npm run db:import:legacy:dry-run
docker compose run --rm --no-deps web npm run db:import:legacy
docker compose run --rm --no-deps web npm run db:verify:migration
```

Reset the local database completely (drops all data):

```powershell
docker compose down -v db
docker compose up -d db
```

To connect to a cloud Supabase project instead of local Postgres, see
[docs/checkpoint-2/supabase-setup.md](docs/checkpoint-2/supabase-setup.md).

### Bootstrapping the first staff administrator

There is **no public registration**. The very first administrator is created once, deliberately:

```powershell
docker compose run --rm --no-deps web npm run db:bootstrap:admin              # dry run — prints what it would do
docker compose run --rm --no-deps web npm run db:bootstrap:admin -- --confirm # actually creates the grant
```

Requires `BOOTSTRAP_ADMIN_EMAIL`, `NEXT_PUBLIC_SUPABASE_URL`, and `SUPABASE_SECRET_KEY` to be
set (see [Environment values](#environment-values) and
[docs/checkpoint-2/supabase-setup.md](docs/checkpoint-2/supabase-setup.md)). After that,
additional staff are invited from `/staff/team` in the app itself — no more scripts needed.

### Staff sign-in

Visit `/staff/login` and sign in with the bootstrapped administrator's email/password. There is
no separate staff subdomain — `/staff/**` is gated by `middleware.ts` plus a server-side session
+ role check on every page and Server Action (hiding a nav link is never the security boundary).

### Security boundaries

- All reads and writes (public catalogue and staff admin alike) go through this Next.js server
  using one privileged database connection — never a browser-side Supabase query. Row Level
  Security is enabled on every table as a second, independent safety net against direct access
  to Supabase's PostgREST data API, not as this app's own authorization mechanism. See
  [docs/checkpoint-2/checkpoint-2-architecture.md §4](docs/checkpoint-2/checkpoint-2-architecture.md#4-serverclient-boundaries-and-the-rls-design-decision)
  for the full reasoning.
- `SUPABASE_SECRET_KEY`, `DATABASE_URL`, and `DATABASE_MIGRATION_URL` are server-only and never
  reach a client bundle (enforced by `src/lib/env.ts`'s public/server split and checked by
  `npm run checkpoint2:validate`).
- Publishing an opportunity without an official source, or leaving a verification record
  "pending" without a linked source, is rejected at the database level (triggers), not only in
  application code.
- `audit_log` is append-only at the database level — `UPDATE`/`DELETE` are rejected even for
  this app's own privileged connection.

### Deployment considerations

- The staff area (`Auth`) requires a real Supabase project; the public catalogue and guest
  workspace work with just the local/self-hosted Postgres database and no Supabase project at
  all, using `ENABLE_STAFF_ADMIN=false` to hide the (still route-protected) staff area from
  navigation.
- If `DATABASE_URL`/Supabase env vars are missing or the database is unreachable, the public
  site shows a safe "service unavailable" state rather than crashing (`isDatabaseConfigured()`
  gates the relevant pages).
- Run `npm run db:migrate` as an explicit deploy step before starting new application instances
  against a schema change — this project does not push schema changes automatically at runtime.

### Current limitations

- **The 100-record content target has not been met**: 55 real, sourced records exist (from the
  original migration); 45 more are needed. No fabricated content was added to close this gap —
  see [docs/checkpoint-2/content-expansion-gap.md](docs/checkpoint-2/content-expansion-gap.md)
  for why, the rules that govern closing it, and the CSV-import path built to do it.
- Live Supabase staff-login end-to-end tests exist and are configuration-gated
  (`E2E_STAFF_EMAIL`/`E2E_STAFF_PASSWORD`) but were not run against a real project in this
  repository's automated CI-equivalent session — they report a clear skip, not a false pass.
- Eligibility rules are stored and managed, not yet evaluated against a student profile
  (deferred per ADR-004 to a later checkpoint).

## Checkpoint 3: optional student accounts and cloud sync

### Signing up and signing in

Visit `/auth/signup` to create an account, or `/auth/login` if you already have one. This is
completely independent of staff sign-in (`/staff/login`) — the two use the same Supabase Auth
user table but grant access to nothing in common. A student session never gains `/staff` access,
and a staff member never gets a student workspace unless they separately use student features.
See [docs/checkpoint-3/student-auth-and-sync.md](docs/checkpoint-3/student-auth-and-sync.md) for
Supabase email-confirmation settings and local-testing options.

### Bringing guest data into an account

`/account/sync` reads your local guest workspace and previews it against your account's current
cloud data, then lets you **copy** (add only what's missing), **merge** (keep whichever side is
newer per item), or **replace** (delete cloud data first, with an extra confirmation). Your local
guest data is never touched or deleted by this step.

### Cloud sync and offline behaviour

While signed in, `/workspace` shows your cloud-synced shortlist, stages, notes, checklists, and
custom opportunities instead of the guest view. Changes are saved immediately when online; if
you go offline, they're applied locally and queued, then replayed automatically once you're back
online — a status indicator always shows Saved / Saving / Offline / Failed / Conflict needs
review, with a last-synced time.

### Account data export, import, and deletion

- `/account/data` — export your cloud account data as JSON, or import a previous export
  (merge/replace, with a preview and confirmation).
- `/account/delete` — delete just your cloud workspace data (keeping the account), or delete the
  account entirely (which also removes your Supabase Auth sign-in, via a server-side Admin API
  call — the secret key never reaches the browser).

Neither export/import nor deletion ever touches guest/local data on any device — that remains a
separate, explicit action in Settings.

### Privacy boundary

Row Level Security scopes every student-owned table to its owner only — there is no
staff-select policy on any of them, so staff cannot casually browse another student's notes,
checklist, or custom opportunities. See
[docs/checkpoint-3/privacy-and-data-controls.md](docs/checkpoint-3/privacy-and-data-controls.md)
for the full data inventory and boundary rules, and
[docs/checkpoint-3/checkpoint-3-architecture.md](docs/checkpoint-3/checkpoint-3-architecture.md)
for how the RLS/grant model, sync layer, and migration flow fit together.

### Current limitations

- The public catalogue/detail-page quick-shortlist button stays guest-local regardless of
  sign-in state in this checkpoint — cloud sync is wired up for `/workspace` and `/account`
  specifically. See the traceability doc's "Deferred / documented limitations" table.
- Cloud custom-opportunity edits aren't queued for offline replay (tracking/notes/checklist are).
- Sync is fetch-on-mount, not a live cross-tab/cross-device push subscription.

## PWA installation and offline behaviour

- **Desktop Chrome/Edge**: visit the site, then use the browser's install
  icon in the address bar, or open Settings → "Install as an app".
- **Android Chrome**: use the "Install app" prompt surfaced automatically, or
  the browser menu → "Install app".
- **iOS Safari**: `beforeinstallprompt` isn't supported; Settings shows manual
  guidance (Share → "Add to Home Screen").
- **Offline**: after one successful online visit, the app shell, the
  database-backed catalogue you've loaded, opportunity detail pages you've
  viewed, your workspace, calendar, and settings continue to work offline —
  showing a "last synced" time if the cached catalogue is stale, or an honest
  unavailable state on a device that has never successfully synced. Staff
  pages (`/staff/**`) are deliberately never cached and are unavailable
  offline. Official external links always require a connection and are never
  cached (see
  [Checkpoint 1 architecture](docs/checkpoint-1/checkpoint-1-architecture.md#pwa-and-caching-strategy)
  and [Checkpoint 2 architecture](docs/checkpoint-2/checkpoint-2-architecture.md#7-offline-cache-flow)
  for the full caching strategy).
- The service worker is hand-authored rather than generated by Serwist; see
  the architecture doc for why (Next.js 16 defaults `next build` to
  Turbopack, and Serwist's `InjectManifest` plugin is webpack-only).

## Guest data, backup, and restore

ScholarTrack has no accounts in Checkpoint 1. Your shortlist, notes,
checklists, custom opportunities, and preferences are stored only in this
browser's IndexedDB (plus a small localStorage entry for your theme
preference) — never sent to a server. See [Settings](#) → "Backup, restore &
local data" to:

- Export a full JSON backup, or a CSV summary of tracked applications.
- Import a previous JSON backup (validated, size-capped, with a preview and a
  merge/replace choice; malformed or prototype-polluting files are rejected).
- Clear all local data (behind a confirmation dialog).
- Inspect storage diagnostics (IndexedDB/localStorage availability, schema
  version, record counts, last backup time).

Full privacy boundary: [/privacy](app/privacy/page.tsx) in the running app, or
[docs/checkpoint-1/checkpoint-1-architecture.md](docs/checkpoint-1/checkpoint-1-architecture.md).

## Custom opportunities

Guests can add, edit, and delete their own local opportunities from
`/custom-opportunities/new` (Zod-validated: at least one country/region and
study level, a valid optional URL, deadline-type-appropriate date rules).
Custom opportunities are merged into the catalogue and workspace views,
always labelled "Custom" / "Self-reported — not officially verified", and are
never presented as officially verified facts.

## Calendar export

`/calendar` offers month and agenda views and exports standards-shaped
`.ics` files (single event, or all upcoming). Only verified exact deadlines
and your own personal deadlines are placed on dated views; estimated,
rolling, unknown, or unresolved deadlines are listed separately. Exported
calendar files never include private notes.

## Stop and clean up

Stop containers while retaining dependency and build-cache volumes:

```powershell
docker compose down --remove-orphans
```

Reset containers and project-managed volumes (use after dependency or cache
problems; dependencies will be repopulated on the next build):

```powershell
docker compose down --volumes --remove-orphans
docker compose up --build
```

Remove the project containers, volumes, and locally built image:

```powershell
docker compose down --volumes --remove-orphans --rmi local
```

## Windows troubleshooting

### Source mount is denied or files are missing

Make sure Docker Desktop is running with WSL 2 integration and can access the
drive containing the workspace. Restart Docker Desktop after changing its file
sharing or WSL integration settings. Confirm the resolved mount is the production
folder—not `ScholarTrack_Europe`:

```powershell
docker compose config
docker compose run --rm --no-deps web sh -lc "pwd && ls -la"
```

### Changes do not hot reload

`WATCHPACK_POLLING` and `CHOKIDAR_USEPOLLING` are already enabled in Compose.
After confirming that the source mount resolves to `/app`, recreate the service:

```powershell
docker compose down
docker compose up --build --force-recreate
```

If file events remain slow, use Docker Desktop's WSL 2 backend and keep Docker
Desktop and VS Code up to date. Large antivirus scans of `.next` can also delay
rebuilds; `.next` is kept in a Docker-managed volume for this reason.

### Dependencies are stale after `package.json` changes

Recreate the container-managed dependency volume and rebuild:

```powershell
docker compose down --volumes --remove-orphans
docker compose up --build
```

Do not install host `node_modules` to fix the container. The `/app/node_modules`
named volume deliberately prevents host and Linux container dependencies from
being mixed. This also applies to the `test` profile's `web-e2e`/`e2e`
services, which share the same volume.

### Port 3000 is already in use

Identify the existing listener or another Compose project, stop it, and retry:

```powershell
Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue
docker compose ps
```

### Environment changes are not visible

Next.js reads environment files at process start. Recreate the service after
editing a local environment file:

```powershell
docker compose up --detach --force-recreate web
docker compose logs --follow web
```

## Known limitations and deferred work

Still deferred beyond Checkpoint 3 (see `docs/checkpoint-0/v1-product-backlog.md` for the full
roadmap): deterministic AI-assisted eligibility *matching* against a student profile
(eligibility rules are stored and manageable, per Checkpoint 2, but not yet evaluated),
push/email/SMS notifications, live cross-tab/cross-device push sync (Checkpoint 3's sync is
fetch-on-mount), and any AI features anywhere in the product. No sensitive-document upload has
been added. See [Checkpoint 2 § Current limitations](#current-limitations) for the two items
Checkpoint 2 itself did not complete (the 100-record content target and live Supabase e2e
execution) and [Checkpoint 3 § Current limitations](#current-limitations-1) for this
checkpoint's own documented scope cuts. See `docs/checkpoint-3/checkpoint-3-completion-report.md`
for the full audit.

## Checkpoint documentation

- [Checkpoint 3 architecture](docs/checkpoint-3/checkpoint-3-architecture.md)
- [Checkpoint 3 student auth and sync](docs/checkpoint-3/student-auth-and-sync.md)
- [Checkpoint 3 privacy and data controls](docs/checkpoint-3/privacy-and-data-controls.md)
- [Checkpoint 3 manual QA](docs/checkpoint-3/checkpoint-3-manual-qa.md)
- [Checkpoint 3 traceability](docs/checkpoint-3/checkpoint-3-traceability.md)
- [Checkpoint 3 completion report](docs/checkpoint-3/checkpoint-3-completion-report.md)
- [Checkpoint 2 architecture](docs/checkpoint-2/checkpoint-2-architecture.md)
- [Checkpoint 2 database schema](docs/checkpoint-2/database-schema.md)
- [Checkpoint 2 staff roles and workflows](docs/checkpoint-2/staff-roles-and-workflows.md)
- [Checkpoint 2 Supabase setup](docs/checkpoint-2/supabase-setup.md)
- [Checkpoint 2 migration runbook](docs/checkpoint-2/migration-runbook.md)
- [Checkpoint 2 data verification procedure](docs/checkpoint-2/data-verification-procedure.md)
- [Checkpoint 2 manual QA](docs/checkpoint-2/checkpoint-2-manual-qa.md)
- [Checkpoint 2 traceability](docs/checkpoint-2/checkpoint-2-traceability.md)
- [Checkpoint 2 content-expansion gap](docs/checkpoint-2/content-expansion-gap.md)
- [Checkpoint 2 completion report](docs/checkpoint-2/checkpoint-2-completion-report.md)
- [Checkpoint 1 architecture](docs/checkpoint-1/checkpoint-1-architecture.md)
- [Checkpoint 1 manual QA](docs/checkpoint-1/checkpoint-1-manual-qa.md)
- [Checkpoint 1 completion report](docs/checkpoint-1/checkpoint-1-completion-report.md)
- [Checkpoint 1 traceability](docs/checkpoint-1/checkpoint-1-traceability.md)
- [Baseline audit](docs/checkpoint-0/baseline-audit.md)
- [Feature inventory](docs/checkpoint-0/feature-inventory.md)
- [Dataset inventory](docs/checkpoint-0/dataset-inventory.md)
- [Deadline intelligence specification](docs/checkpoint-0/deadline-intelligence-spec.md)
