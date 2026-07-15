# ScholarTrack Platform

ScholarTrack is a guest-first Progressive Web App for discovering, understanding,
and tracking verified scholarship and internship opportunities. Checkpoint 1
delivers the first fully functional release: a browsable catalogue of 55
built-in opportunities, deadline intelligence that distinguishes reliable dates
from estimates and unverified claims, a personal workspace, custom
opportunities, a deadline calendar with `.ics` export, and local-only guest
data with backup/restore. Optional accounts, cloud sync, and AI features are
not part of this checkpoint (see [Known limitations](#known-limitations-and-deferred-work)).

Checkpoint 0 established repository boundaries, a Docker-first development
contract, the domain model, and a documented audit of the legacy prototype.
Checkpoint 1 builds the actual product on top of that foundation.

## What ScholarTrack does today

- **Browse and search** all 55 built-in opportunities, plus any you add
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

The baseline requires no credentials. Optional configuration:

```powershell
Copy-Item .env.example .env.local
```

- `NEXT_PUBLIC_APP_URL` — used for absolute metadata URLs; safe to leave unset
  for local development.
- `NEXT_PUBLIC_FEEDBACK_EMAIL` — if set, adds an "Email feedback" mailto button
  in Settings → Feedback. Leave unset to only offer "Copy feedback text" (there
  is no feedback backend either way).

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
which a Docker-internal hostname is not. Tear down the test containers with:

```powershell
docker compose --profile test down --remove-orphans
```

If Node.js and browsers are installed on the host instead:

```powershell
npx playwright install --with-deps chromium
npm run test:e2e
```

## PWA installation and offline behaviour

- **Desktop Chrome/Edge**: visit the site, then use the browser's install
  icon in the address bar, or open Settings → "Install as an app".
- **Android Chrome**: use the "Install app" prompt surfaced automatically, or
  the browser menu → "Install app".
- **iOS Safari**: `beforeinstallprompt` isn't supported; Settings shows manual
  guidance (Share → "Add to Home Screen").
- **Offline**: after one successful online visit, the app shell, the 55
  built-in opportunity pages you've viewed, your workspace, calendar, and
  settings continue to work offline. Official external links always require a
  connection and are never cached (see
  [architecture doc](docs/checkpoint-1/checkpoint-1-architecture.md#pwa-and-caching-strategy)
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

Deferred beyond Checkpoint 1 (see `docs/checkpoint-0/v1-product-backlog.md`
for the full roadmap): user accounts, cloud/server-side data synchronisation,
admin/staff review tooling, deterministic AI-assisted eligibility matching,
push/email/SMS notifications, and any AI features. No database, Supabase
connection, authentication, or sensitive-document upload has been added — see
`docs/checkpoint-1/checkpoint-1-completion-report.md` for the full audit.

## Checkpoint documentation

- [Checkpoint 1 architecture](docs/checkpoint-1/checkpoint-1-architecture.md)
- [Checkpoint 1 manual QA](docs/checkpoint-1/checkpoint-1-manual-qa.md)
- [Checkpoint 1 completion report](docs/checkpoint-1/checkpoint-1-completion-report.md)
- [Checkpoint 1 traceability](docs/checkpoint-1/checkpoint-1-traceability.md)
- [Baseline audit](docs/checkpoint-0/baseline-audit.md)
- [Feature inventory](docs/checkpoint-0/feature-inventory.md)
- [Dataset inventory](docs/checkpoint-0/dataset-inventory.md)
- [Deadline intelligence specification](docs/checkpoint-0/deadline-intelligence-spec.md)
