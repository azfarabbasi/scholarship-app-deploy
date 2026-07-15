# Checkpoint 1: Architecture

## Status and scope

This document describes the architecture actually implemented in Checkpoint 1:
a guest-first Progressive Web App built on Next.js App Router, React 19, and
TypeScript, backed by the versioned 55-record migration seed and a
browser-local IndexedDB workspace. It complements, and does not replace, the
Checkpoint 0 domain model (`docs/checkpoint-0/domain-model-spec.md`) and
deadline specification (`docs/checkpoint-0/deadline-intelligence-spec.md`).

## Route structure

All routes use the Next.js App Router (`app/`):

| Route | File | Rendering |
| --- | --- | --- |
| `/` | `app/page.tsx` | Static shell; client-hydrated catalogue/stats |
| `/opportunities` | `app/opportunities/page.tsx` | Static shell; client-hydrated catalogue |
| `/opportunities/[slug]` | `app/opportunities/[slug]/page.tsx` | SSG via `generateStaticParams` for the 55 built-in slugs; falls back to a client-side custom-opportunity lookup for any other slug (`dynamicParams` stays enabled) |
| `/workspace` | `app/workspace/page.tsx` | Static shell; fully client-rendered (IndexedDB) |
| `/calendar` | `app/calendar/page.tsx` | Static shell; fully client-rendered |
| `/custom-opportunities/new` | `app/custom-opportunities/new/page.tsx` | Static shell; client form |
| `/custom-opportunities/[id]/edit` | `app/custom-opportunities/[id]/edit/page.tsx` | Server component reads the dynamic `id` param only to pass it to a client component; the record itself is looked up client-side from IndexedDB |
| `/settings` | `app/settings/page.tsx` | Static shell; client sections |
| `/privacy` | `app/privacy/page.tsx` | Fully static |
| `/offline` | `app/offline/page.tsx` | Fully static; precached app-shell fallback |
| `/api/health` | `app/api/health/route.ts` | Static JSON; reports built-in record count, no database |
| `/manifest.webmanifest` | `app/manifest.ts` | Next.js manifest route convention |
| `/icon`, `/apple-icon`, `/icon-192.png`, `/icon-512.png`, `/icon-512-maskable.png` | `app/icon.tsx` etc. | Generated via `next/og` `ImageResponse` at build time — no binary asset files committed |

`app/not-found.tsx` and `app/error.tsx` provide app-wide not-found and error
boundaries; `app/opportunities/loading.tsx` provides a route-level loading
skeleton.

## Component structure

- `src/components/ui/` — small, dependency-light primitives (Button, Card,
  Badge, Field set, Dialog/Tooltip wrapping Radix primitives, Alert,
  Skeleton). Badges always pair colour with text/icon.
- `src/components/layout/` — Header/MobileNav, Footer, SkipLink, ThemeToggle,
  ThemeProvider (`next-themes`), OfflineBanner, ServiceWorkerRegistration,
  HydrationMarker.
- `src/components/opportunities/` — OpportunityCard, deadline/verification/
  origin/stage badges, FilterPanel, CatalogueToolbar, CatalogueExplorer,
  DeadlineStatus, OpportunityDetailBody, CustomOpportunityDetailClient.
- `src/components/workspace/` — GuestTrackingPanel (shortlist/stage/notes/
  checklist/personal deadline), WorkspaceView, WorkspaceSummary.
- `src/components/custom-opportunities/` — CustomOpportunityForm and its
  New/Edit client wrappers.
- `src/components/calendar/` — MonthGrid, AgendaSection, UndatedList,
  EventBadge, CalendarView.
- `src/components/settings/` — PlanningPreferencesForm, BackupSection,
  StorageDiagnosticsSection, PwaSection, FeedbackSection.
- `src/components/common/` — EmptyState, ErrorState, LiveAnnouncer (global
  `aria-live` region).

## Server/client boundaries

- **Server components** render static facts only: route shells, metadata,
  `generateStaticParams`, and the built-in opportunity's non-time-dependent
  fields (title, summary, benefit/eligibility text, original deadline
  wording).
- **Client components** own everything that depends on the local clock, guest
  storage, or interactivity: deadline lifecycle/label/colour (`useNow` +
  `evaluateDeadline`, computed post-mount so a statically generated page never
  bakes in a stale build-time date), the catalogue explorer, workspace
  tracking, calendar, settings, and all forms.
- The 55-record dataset is imported directly from
  `data/migrations/v0.1/scholarships.seed.json` by
  `src/lib/catalogue/repository.ts` — safe to import from either a server or
  client module (it's a pure data/validation module, no `"use client"`
  needed), so build-time bundling covers both without duplicating the data in
  source.

## Data flow

```
scholarships.seed.json --(zod validate)--> repository.ts --> CatalogueOpportunity[]
                                                                    |
IndexedDB (workspace/customOpportunities/preferences) --(hooks)----+--> useCatalogue()
                                                                    |
                                              evaluateDeadline(now) v
                                                        EnrichedOpportunity[]
                                                                    |
                                   filterOpportunities / sortOpportunities
                                                                    |
                                        CatalogueExplorer / WorkspaceView / CalendarView
```

`useCatalogue()` (`src/hooks/useCatalogue.ts`) is the single hook every data
view builds on: it merges built-in + custom opportunities, attaches each
opportunity's current workspace record, and evaluates its deadline against
`useNow()` (recomputed on mount, tab-visibility change, window focus, and a
60-second interval — never a stale build-time value).

## Local-storage architecture

- **IndexedDB** (via the `idb` package — chosen because promisifying raw
  IndexedDB by hand is error-prone, and `idb` is a ~1.2 KB, actively
  maintained wrapper with no other dependencies) is the primary guest-data
  store: `src/lib/storage/db.ts`.
- **localStorage** is used only for the pre-hydration theme preference
  (managed entirely by `next-themes`), matching the "small synchronous
  preferences only" rule — it is never the main application database.
- A small `EventTarget`-based pub/sub (`src/lib/storage/events.ts`) notifies
  React hooks when a store changes, so multiple components reading the same
  data stay in sync within a tab without a state-management library.

### IndexedDB schema (version `SCHEMA_VERSION = 1`, `src/lib/storage/types.ts`)

Database name: `scholartrack`.

| Object store | Key | Contents |
| --- | --- | --- |
| `workspace` | `opportunityId` | `WorkspaceRecord`: shortlisted, stage, notes, checklist items, personal deadline, timestamps |
| `customOpportunities` | `id` (UUID) | `CustomOpportunityRecord`: full opportunity fields + deadline kind/date/timezone |
| `preferences` | fixed `"singleton"` | `PreferencesRecord`: planning preferences + display preferences |
| `meta` | fixed `"backupMeta"` | Last backup timestamp |

**Safe upgrade path**: `db.ts`'s `upgrade()` callback only ever calls
`createObjectStore` for a store that doesn't already exist
(`if (!db.objectStoreNames.contains(...))`). A future schema version adds
stores or, if a field needs restructuring, adds a new store/version and
migrates records inside `upgrade()` — it never drops an existing store, so
ordinary version bumps cannot lose guest data. `getStorageDiagnostics()`
(Settings → Storage diagnostics) surfaces the current schema version,
IndexedDB/localStorage availability, and record counts so a broken
environment is diagnosable rather than silently failing.

## Backup/restore and import/export security

`src/lib/storage/backup.ts`:

- Export bundles exactly `{ app, schemaVersion, createdAt, counts, data:
  { workspace, customOpportunities, preferences } }` — no cookies, browser
  identifiers, analytics, or document files, because none of those are ever
  collected in the first place.
- Import validates with a `zod` `.strict()` schema (rejects unknown keys
  outright) and an explicit `containsDangerousKeys()` walk that rejects any
  `__proto__`/`constructor`/`prototype` key at any depth — defence in depth
  against prototype pollution even though `JSON.parse` itself does not have
  the classic vulnerability (parsed objects get a literal own property, not a
  live prototype link).
- A 5 MB file-size cap is enforced before parsing.
- **Merge** upserts by key (existing records not present in the backup are
  kept); **replace** clears all three guest-data stores first. Both run
  inside a single `idb` transaction across the three stores.
- CSV export (`buildTrackedApplicationsCsv`) emits only human-facing summary
  columns (title, type, stage, shortlisted, personal deadline, checklist
  progress, last updated) — no internal IDs, and values are CSV-escaped.

## Date handling

- Calendar-day arithmetic (`src/lib/deadlines/calendar-math.ts`) never divides
  elapsed milliseconds by `86,400,000`; it converts dates to a proleptic
  Gregorian ordinal day number for subtraction, so DST transitions and leap
  years cannot corrupt a day count.
- A record's source timezone (when known) is applied via
  `Intl.DateTimeFormat` to compute "today" and the boundary date in that zone
  — the server/browser timezone is never substituted for a missing source
  timezone; a missing timezone instead blocks the countdown gate.
- `src/lib/deadlines/engine.ts` implements the full label/lifecycle/colour/
  countdown precedence from `docs/checkpoint-0/deadline-intelligence-spec.md`
  and is tested against all 23 fixtures in
  `data/test-scenarios/deadline-scenarios.json` (one is a documented,
  intentional divergence — see the module comment in `engine.ts` and
  `tests/unit/deadline-scenarios.test.ts`).
- Personal deadlines (`src/lib/deadlines/personal.ts`) are evaluated by a
  completely separate, simpler function with no verification gate, so they
  can never be confused with — or silently promote — an official fact.

## PWA and caching strategy

**Why a hand-authored service worker instead of Serwist:** the project's
roadmap names Serwist as the preferred approach, and it was evaluated first.
Next.js 16 defaults `next build` (and `next dev`) to Turbopack, and
`@serwist/next`'s `withSerwistInit` wraps the Webpack config via
`InjectManifest` — a Webpack-only plugin. Running `next build` with it
produces: `ERROR: This build is using Turbopack, with a webpack config and no
turbopack config.` There is no supported Turbopack equivalent for
`@serwist/next` at this Next.js version. Rather than force the whole project
onto the legacy Webpack builder (a larger, riskier deviation from the
existing Docker-first workflow), Checkpoint 1 ships a small, fully-understood
hand-written service worker (`public/sw.js`, ~130 lines) with an explicit,
documented caching strategy:

| Request | Strategy |
| --- | --- |
| App-shell routes (`/`, `/offline`, `/opportunities`, `/workspace`, `/calendar`, `/settings`, `/privacy`, `/manifest.webmanifest`) | Precached on install |
| Navigations (`request.mode === "navigate"`) | Network-first; falls back to cache, then to `/offline` |
| `/_next/static/*` (content-hashed, immutable) | Cache-first |
| Other same-origin GET requests (icons, catalogue data, etc.) | Stale-while-revalidate |
| Cross-origin requests (official scholarship websites) | Never intercepted — always network, never cached |

Cache names are versioned (`scholartrack-app-shell-v1`, etc.); `activate`
deletes any cache not matching the current version set. Guest data lives in
IndexedDB/localStorage, never in Cache Storage, so an update that clears old
caches never touches guest records.

**Update flow**: `src/components/layout/ServiceWorkerRegistration.tsx`
registers the worker (production only), shows a "Refresh" banner when a new
version has installed alongside an existing controller, and only reloads the
page after the user clicks that button. This detail matters: `clients.claim()`
in `sw.js` also fires a `controllerchange` event the very first time a
service worker takes control of a previously uncontrolled page — i.e. on a
visitor's first-ever load, not just on updates. An earlier draft reloaded
unconditionally on `controllerchange` and was caught during Playwright e2e
testing (it silently reloaded the page ~1–2 seconds after every fresh visit,
discarding in-progress form input). The fix gates the reload behind a
`userRequestedRefresh` flag set only by the "Refresh" click.

**Install UX**: `usePwaInstall()` listens for `beforeinstallprompt` (Chromium)
and `appinstalled`, and detects iOS Safari (no `beforeinstallprompt` support)
to show manual "Add to Home Screen" guidance instead.

## Accessibility and analytics boundaries

- Skip link targets a `tabIndex={-1}` `<main>` so keyboard focus actually
  moves there (not just scroll).
- A single global `aria-live="polite"` region (`LiveAnnouncerProvider`)
  carries save/import/export/offline-transition announcements.
- `src/lib/analytics/index.ts` is a no-op abstraction (`trackEvent()` returns
  immediately) — it exists so a future privacy-reviewed analytics provider can
  be wired in behind one module instead of scattering calls through
  components. It must never be passed notes, checklist text, application
  details, personal deadlines, custom-opportunity contents, or planning
  preferences.

## Future migration path to authenticated cloud sync

The domain model already anticipates this (`docs/checkpoint-0/domain-model-spec.md`,
`WorkspaceOwnership`, `GuestLocalOwnership` / `AccountCloudOwnership`). The
intended migration, not implemented in Checkpoint 1:

1. Add an optional `UserAccount` (Checkpoint 0 entity, `required later in
   Year 1`) without removing guest mode.
2. On explicit, confirmed sign-in, offer to import the existing guest
   `WorkspaceRecord`/`CustomOpportunityRecord`/`PreferencesRecord` set via the
   **same JSON shape already produced by `buildBackupPayload()`** — the
   backup format doubles as the guest→account migration payload, so no new
   export format is needed.
3. Replace the IndexedDB read/write functions in `src/lib/storage/*` with
   equivalents that call an authenticated API, behind the same function
   signatures consumed by `src/hooks/*` — component code should not need to
   change, only the storage layer's implementation.
4. Guest mode remains fully available indefinitely (locked constraint,
   `PROJECT_RULES.md`); migration is a one-time, explicit, user-confirmed
   action, never an implicit background sync.
