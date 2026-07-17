# Checkpoint 4 architecture

Advanced discovery (search/filter/sort), an optional eligibility questionnaire, a deterministic
rule-based matching engine, opportunity comparison, reminders, and a notification center — all
built alongside guest mode and the Checkpoint 3 cloud workspace, never replacing either. This
document explains the search architecture, the matching engine's design, the five new database
tables and their RLS model, reminders/notifications, browser-notification handling, and the
privacy decisions behind them. See
[eligibility-matching-spec.md](eligibility-matching-spec.md) and
[reminders-and-notifications.md](reminders-and-notifications.md) for the two deepest-dive topics.

## Search architecture — a deliberate hybrid, not one search stack

Two genuinely separate implementations exist, on purpose:

| | Client-side (default `/opportunities` UI) | Server-side (`/api/search`) |
| --- | --- | --- |
| Where | `src/lib/catalogue/search.ts` (`filterOpportunities`/`sortOpportunities`) | `src/lib/search/service.ts` (`searchOpportunities`) |
| Data source | Whatever `useCatalogue()` already loaded client-side | `getPublishedOpportunities()`, a fresh DB read every request |
| Ranking | `scoreOpportunityAgainstQuery` (shared with the server) | Same function, plus optional `pg_trgm` `similarity()` boost |
| Pagination | None — filters the full in-memory list | Real, safe, capped (`page`/`pageSize`, schema-validated) |
| Works offline | Yes | No (needs the DB) |

**Why not just one:** the existing catalogue page's client-side filtering is fast, works offline,
and needed zero regression risk for guests browsing the 55-opportunity built-in catalogue plus
custom opportunities — replacing it with a network round-trip per keystroke would have been a
strict regression. But the checkpoint brief explicitly asks for real **database search support**
(indexes, safe pagination, deterministic sorting) as its own capability, independently testable
and usable by anything that isn't the main catalogue page. Rather than picking one and
compromising the other requirement, both exist, sharing the same pure relevance-scoring function
(`src/lib/search/rank.ts`) so "typo-tolerant, weighted-field relevance" means the same thing in
both places — verified by `tests/unit/search-rank.test.ts` and reused directly inside
`src/lib/catalogue/search.ts`'s `relevanceScore()`.

### Typo tolerance

`scoreOpportunityAgainstQuery()` normalizes (lowercase, strip diacritics) each of title, provider,
country, region, study level, official-source label, benefit summary, and eligibility summary,
then for each query token: an exact substring match always counts; a token of 4+ characters also
fuzzy-matches any 3+-character word in the field via a dependency-free Levenshtein distance,
capped at `min(2, floor(token.length / 4) + 1)` — short tokens never fuzzy-match (too noisy), and
the tolerance scales mildly with token length. Field weights (title highest, free-text summaries
lowest) mirror the same weighting used everywhere match/relevance is computed.

### Server-side ranking and `pg_trgm`

`drizzle/0006_discovery_grants_and_search.sql` creates the `pg_trgm` extension and two trigram GIN
indexes (`opportunities.title`, `providers.display_name`) inside a `DO $$ ... EXCEPTION WHEN
insufficient_privilege OR undefined_file ...` block — some hosting tiers don't allow `CREATE
EXTENSION`, and the migration must not fail the whole deploy over it. `searchOpportunities()`
checks `isTrgmAvailable()` once per server process (cached; `resetTrgmAvailabilityCache()` lets the
staff discovery-quality page force a re-check without a redeploy) and, only when available, runs a
raw `similarity()` query and takes `max(jsScore, trgmScore * 10)` per result — trigram similarity
never replaces the JS scorer, it only ever adds another way to find a near-miss. When `pg_trgm`
isn't installed, search silently and correctly falls back to the pure-JS scorer; nothing breaks,
nothing is presented as more "official" than it is.

### Facets, sorting, pagination

`SearchQuery` (`src/lib/search/types.ts`) covers country/region/study-level/opportunity-type/
field/provider/funding-category/deadline-state/precision/verification-status/required-document/
eligibility-rule/match-label filters, five sort modes (`relevance`, `nearest-deadline`,
`verified-first`, `title-asc`, `recently-updated`), and `page`/`pageSize` — every field validated
and length/count-capped by `searchQuerySchema` (`src/lib/search/query.ts`) so neither a malicious
query string nor a saved-search replay can force an unbounded query plan. `parseSearchQuery`/
`searchQueryToParams` round-trip losslessly (`tests/unit/search-query.test.ts`), which is exactly
the contract a saved search's stored `filters` blob needs.

## Saved searches

`user_saved_searches` (cloud) / the `savedSearches` IndexedDB store (guest) hold a name, the raw
query text, a serialized `CatalogueFilters` blob (public filter values only — never a user id or
anything private), a sort mode, and a **result snapshot**: the list of opportunity ids that
matched the last time the search was checked. `src/lib/discovery/saved-search-alerts.ts`'s
`diffSavedSearchResults(previousIds, currentIds)` is a pure, order-independent set diff producing
honest "N newly published" / "N no longer matching" messages — it never claims an alert exists
when nothing changed, and never runs on a schedule: the check happens deterministically whenever
`NotificationCenter` mounts (app-open or `/notifications`-open), documented explicitly as **not**
real-time push. `storage/types.ts`'s `SavedSearchRecord.filters` is deliberately typed as
`Record<string, unknown>` rather than importing `CatalogueFilters` directly, to avoid a
storage↔catalogue import cycle.

## Matching engine

See [eligibility-matching-spec.md](eligibility-matching-spec.md) for the full label/reason design.
In one sentence: `src/lib/matching/engine.ts`'s `evaluateMatch()` is a pure function — same
opportunity + answers + preferences + deadline evaluation in, same result out, every time, no
network call, no AI, no randomness — that compares a student's optional eligibility answers
against an opportunity's structured eligibility rules and deadline data, and returns one of seven
cautious labels plus categorized reasons (`eligibility-rule` / `preference` / `deadline` /
`verification` — never conflated) and the same fixed disclaimer on every result.

## Comparison

`useComparisonSelection()` is a `localStorage`-backed hook (max 4 ids), read via
`useSyncExternalStore` — the snapshot function caches the last-parsed array against the last-seen
raw string so an unrelated re-render never returns a new array reference (React's
`useSyncExternalStore` requires snapshot stability or it re-renders forever; this was found and
fixed during this checkpoint, see the completion report). `/compare` (`ComparisonView.tsx`) reads
the same hook and renders a 13-row desktop table / mobile-stacked-card comparison for whatever ids
are currently selected. **Deliberately not a database table**: comparison selection is
non-durable, per-browser, transient UI state, not a record worth an RLS policy — it's the one
piece of Checkpoint 4 state that never syncs to an account, documented as a scope simplification
rather than an oversight.

## Database schema (Checkpoint 4 additions)

All five new tables live in `src/lib/db/schema/discovery.ts`, migrated in
`drizzle/0005_discovery_reminders.sql` (generated) and
`drizzle/0006_discovery_grants_and_search.sql` (hand-authored GRANT/REVOKE baseline + `pg_trgm`).

| Table | Purpose |
| --- | --- |
| `user_saved_searches` | Name, query text, serialized public filters, sort mode, a result-id snapshot for alert diffing, `alertsEnabled`. |
| `user_eligibility_answers` | One row per student, every field optional/nullable — see the exclusion list below. |
| `user_reminder_preferences` | One row per student: `remindersEnabled`, official/personal lead-day arrays (subset of 0/1/3/7/14/30), `savedSearchAlertsEnabled`. |
| `user_reminders` | A generated reminder instance. `stableKey` (`source:targetId:dueDate:leadDays`) is unique per student — regeneration never duplicates or resurrects a dismissed/completed reminder. |
| `user_notifications` | A notification-center record (reminder-upcoming/overdue, saved-search alert, system). Never contains private note text — only titles, generic messages, and structured target references. |

### RLS model

Every table: `.enableRLS()` + exactly one `ownerAllPolicy(tableName, ownerColumn)` policy (full
CRUD restricted to `owner_column = auth.uid()`) + `serviceRoleBypassPolicy`. **Deliberately no
`staffSelectPolicy` on any of the five** — staff get zero default read access to a student's
eligibility answers or discovery activity, stricter than "documented exception," matching the
Checkpoint 3 precedent for the workspace tables. `0006_discovery_grants_and_search.sql` repeats
the same baseline-grant lesson from Checkpoint 3's `0004_student_workspace_grants.sql`:
`authenticated` needs an explicit `GRANT SELECT, INSERT, UPDATE, DELETE`, and `anon`'s inherited
default SELECT grant is explicitly revoked, so a missing/misconfigured RLS policy is never the
only thing standing between an unauthenticated request and this data — verified directly by
`tests/integration/discovery-rls.test.ts`, which also proves a staff-role connection gets zero
rows (not just another student).

As with earlier checkpoints, the app's own Next.js server (`getDb()` in `src/lib/db/client.ts`)
connects as the table owner and bypasses RLS entirely — RLS exists to lock down Supabase's
PostgREST data API against direct browser access, not this connection. Real authorization is the
`getStudentSession()` check + `studentProfileId` scoping in every Server Action under
`src/lib/db/actions/student/`, and — for the one place staff code reads across the whole student
population — `src/lib/db/actions/discovery-quality.ts` deliberately computes only `count(*)`-style
aggregates, never a per-row select of another student's saved-search text or reminder title (see
below).

## Reminders and notifications

See [reminders-and-notifications.md](reminders-and-notifications.md) for the full design. In
summary: official-deadline reminders are only ever generated for an exact, verified,
single-occurrence deadline (`src/lib/reminders/extract.ts::extractExactVerifiedDeadline`) — every
other precision, verification status, or multiple-candidate-occurrence case is skipped entirely,
never guessed. Personal deadlines are always honoured regardless. `src/lib/reminders/engine.ts`'s
`generateReminderCandidates()` is pure and idempotent (stable-key upsert, never resurrects a
dismissed/completed reminder, never backfills more than 24h into the past). The notification
center (`/notifications`) surfaces overdue/upcoming/dismissed reminders and saved-search alerts —
never staff diagnostics, never private note or checklist text.

## Browser notifications

`src/lib/notifications/browser.ts` wraps the standard `Notification` API. Permission is **only
ever requested from a synchronous click handler** (`NotificationPermissionSection.tsx`'s button
`onClick`) — never in a `useEffect`, never on page load, verified both by code inspection
(`scripts/validate-checkpoint4.ts`) and by an e2e test that patches
`Notification.requestPermission` and asserts it is never called automatically. The whole UI
section is gated behind `NEXT_PUBLIC_ENABLE_BROWSER_NOTIFICATIONS` (default unset/off) and degrades
gracefully when the API is unsupported or denied. **Web Push (background delivery while the tab is
closed) is explicitly not implemented** — only foreground (tab-open) notifications work — see
`reminders-and-notifications.md` for exactly why and what a real deployment would need
(`NEXT_PUBLIC_VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY`/`VAPID_SUBJECT` are documented in
`.env.example` as reserved-but-unused, not wired to anything today).

## Staff discovery-quality support page

`/staff/discovery` (`app/staff/(protected)/discovery/page.tsx`, gated by the same
`getStaffSession()` layout as every other staff route, visibility further scoped to
`canCreateDraft` roles) surfaces: stale-verification, missing-eligibility-rule,
missing-required-documents, missing-taxonomy, and no-official-deadline-clarity queues (all scoped
to published opportunities only — exactly what students can discover today); saved-search-alert
and reminder-dispatch diagnostics (aggregate counts only, per the RLS section above); and a
"refresh search statistics" action (`rebuildSearchIndex()`, administrator-only via
`canRunImports`) that runs `ANALYZE` on the catalogue tables and re-checks `pg_trgm` availability —
there is no separate app-managed search index to rebuild, so this is the honest equivalent rather
than a fabricated capability.

## Guest ↔ cloud parity for every new data type

Guest storage gained five new IndexedDB stores (`src/lib/storage/{eligibility,saved-searches,
reminders,notifications}.ts`, schema `SCHEMA_VERSION` bumped 3→4). The guest backup format
(`src/lib/storage/backup.ts`) and the cloud account export format
(`src/lib/schemas/cloud-export.ts`, `CLOUD_EXPORT_SCHEMA_VERSION` bumped 1→2) both grew five new
optional fields — optional specifically so a pre-Checkpoint-4 export/backup file still validates
and imports cleanly, its absent fields simply defaulting to empty. `exportMyData()`/
`importMyAccountData()`/`deleteMyWorkspaceData()`/`deleteMyAccount()`
(`src/lib/db/actions/student/data-controls.ts`) and the guest-to-cloud migration
(`applyGuestMigration()`/`getMigrationContext()` in `src/lib/db/actions/student/sync.ts`) were all
extended to read/write/delete/migrate all five new data types — notifications are deliberately
excluded from the **migration** path only (they're ephemeral and regenerate automatically on next
`/notifications` load) while still being included in backup/export/import, which mirror data
1:1 rather than making a judgment call about what's worth resurrecting.

## Privacy decisions

- Eligibility answers are entirely optional and deliberately exclude passport/ID numbers, address,
  financial or medical data, religious/ethnic identity, and transcript/CV/recommendation-letter
  contents — enforced by a `.strict()` Zod schema, not just documentation.
- Matching is never AI — a fixed, human-authored rule engine, verified structurally (no AI
  SDK/network-call pattern in `src/lib/matching/engine.ts`) and by the standard disclaimer shown
  on every result.
- Staff get no default read access to any of the five new tables (no `staffSelectPolicy`), and the
  one staff-facing page that touches this data at all (`/staff/discovery`) computes aggregate
  counts only.
- No paid SMS/WhatsApp/email notification service anywhere — browser notifications are delivered
  by the visitor's own browser, on the device that granted permission, never a ScholarTrack-run
  push service.
- Session-aware pages added this checkpoint (`/eligibility`, `/notifications`, `/compare`,
  `/opportunities/*`) are marked `Cache-Control: no-store` for a signed-in visitor, and
  `public/sw.js` was hardened so even its install-time precache step (not just runtime navigation)
  respects that header before writing anything to the shared app-shell cache.
