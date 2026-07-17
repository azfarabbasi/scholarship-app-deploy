# Checkpoint 4 completion report

Date: 2026-07-17. All results below were executed in this session and are reproducible with the
commands shown — none are claimed without having actually been run, including the full Docker-based
Playwright e2e suite run from a freshly reset test database.

## Features completed

- Full-text, typo-tolerant search with weighted-field relevance scoring, shared between the
  existing client-side catalogue filter and a new server-side `/api/search` route.
- Real database search support: `pg_trgm`-backed similarity (exception-guarded, falls back to the
  same pure-JS scorer when the extension isn't installed), published-only visibility, safe
  schema-capped pagination, deterministic sort modes.
- Saved searches, guest-local (IndexedDB) and cloud-synced (RLS-protected), with a deterministic,
  non-real-time alert-check diff against each search's last-known result snapshot.
- An optional eligibility questionnaire — every field optional, `.strict()`-schema-enforced
  exclusion of passport/ID/address/financial/medical/religious/ethnic/transcript/CV/
  recommendation-letter data.
- A pure, deterministic, never-AI matching engine producing seven cautious labels with
  categorized (`eligibility-rule`/`preference`/`deadline`/`verification`) reasons, deadline and
  verification notes, next-action guidance, and a fixed disclaimer shown on every result.
- Matching UI wired into opportunity cards, the detail page, the comparison view, and a
  match-label discovery filter.
- Opportunity comparison (2-4 items), desktop table / mobile-stacked, entirely client-local
  (localStorage), never a database table.
- A reminders engine that only ever schedules an official-deadline reminder for an exact, verified,
  single-occurrence deadline — every other case is skipped, never guessed — with configurable
  lead days (0/1/3/7/14/30, separately for official vs. personal deadlines), stable-key idempotent
  regeneration (never duplicates, never resurrects a dismissed/completed reminder), guest-local and
  cloud-synced.
- A notification center (`/notifications`) showing overdue/upcoming/dismissed reminders and
  saved-search alerts — never staff diagnostics, never private note/checklist text.
- Careful browser-notification support: permission requested only from an explicit click, never on
  page load (verified structurally and behaviourally); gated behind an env flag; graceful when
  unsupported/denied; Web Push explicitly and honestly deferred (see below).
- A staff-only discovery-quality support page (`/staff/discovery`): stale-verification,
  missing-eligibility-rule, missing-required-documents, missing-taxonomy, and
  unclear-official-deadline queues, plus aggregate-only saved-search/reminder diagnostics and a
  search-statistics-refresh action.
- Five new RLS-protected database tables, every one owner-only with **no** staff-select policy,
  plus the same GRANT/REVOKE baseline hygiene established in Checkpoint 3.
- Guest backup, cloud export/import, guest-to-cloud migration, and both levels of self-service
  deletion all extended to cover every new Checkpoint 4 data type — with backward-compatible
  (`.optional()`) schema fields so a pre-Checkpoint-4 export/backup file still validates cleanly.
- Privacy page, service worker, and `.env.example` updated for all of the above.

## Routes created

`/eligibility`, `/notifications`, `/compare`, `/api/search`, `/staff/discovery`.

## Database tables added

`user_saved_searches`, `user_eligibility_answers`, `user_reminder_preferences`, `user_reminders`,
`user_notifications` — full schema in
[checkpoint-4-architecture.md](checkpoint-4-architecture.md#database-schema-checkpoint-4-additions).

Two migrations: `drizzle/0005_discovery_reminders.sql` (generated — all 5 tables, 4 new enums,
indexes, RLS policies) and `drizzle/0006_discovery_grants_and_search.sql` (hand-authored — baseline
GRANTs/REVOKEs matching the Checkpoint 3 pattern, plus exception-guarded `pg_trgm` extension
creation and two trigram GIN indexes).

## RLS summary

Every table: `.enableRLS()` + exactly one `ownerAllPolicy` (full CRUD restricted to
`owner_column = auth.uid()`) + `serviceRoleBypassPolicy`. No table has a staff-select policy —
staff get zero default read access to eligibility answers or discovery activity, verified directly
by `tests/integration/discovery-rls.test.ts` (19 cases), which explicitly checks that a
staff-role connection gets zero rows, not just that another student does. `anon` is explicitly
revoked from its default SELECT grant on all five tables.

## Testing summary — everything below was actually run in this session

- **`npx tsc --noEmit`**: clean, re-verified after every fix in this session.
- **`npx eslint .`**: clean (0 errors, 0 warnings), re-verified after every fix in this session.
- **`npx next build`**: succeeds, producing `/staff/discovery`, `/api/search`, `/eligibility`,
  `/notifications`, and `/compare` as dynamic routes alongside every pre-existing route.
- **Unit tests** (`npm run test`): **344 passed, 1 skipped** (up from 229 before this checkpoint's
  test-writing work — 115 new tests across 6 new files: `matching-engine.test.ts` (26),
  `reminders-engine.test.ts` (27), `eligibility-answers-schema.test.ts` (23), `search-rank.test.ts`
  (10), `search-query.test.ts` (10), `saved-search-alerts.test.ts` (8), plus extensions to
  `backup.test.ts` and `cloud-export-schema.test.ts` for the Checkpoint 4 data types).
- **`npm run test:coverage`**: runs clean, same 344/1 pass/skip counts with a coverage report
  generated (no configured failure threshold; existing project convention).
- **`npm run data:validate`**: PASSED — 55/55 schema-valid seed records, 0 critical errors.
- **`npm run deadlines:audit`**: PASSED WITH WARNINGS — 0 structural findings; the 5 warning groups
  across all 55 records are the expected "verify before relying on this" cautions this project has
  carried since Checkpoint 0, not new issues.
- **`npm run db:check`**: "Everything's fine" — schema matches migrations.
- **`npm run db:verify:migration`** (against the freshly imported+published test database): all 55
  legacy records imported, published, and sourced correctly; 0 issues.
- **Integration tests** (`npm run db:test`, against the ephemeral `db-test` Postgres container):
  **55 passed** (32 pre-existing + 23 new: `discovery-rls.test.ts`, 19 cases covering RLS on all 5
  new tables including the unique stable-key constraint and staff-denied cases, and
  `search-visibility.test.ts`, 4 cases covering published-only visibility, draft exclusion, archived
  exclusion, and safe pagination). Required one infrastructure fix: `import "server-only"` throws
  outside Next.js's `react-server` build condition, which plain Vitest never sets — fixed by
  aliasing `server-only` to its own no-op `empty.js` in `vitest.integration.config.ts`, scoped to
  the integration config only.
- **`npm run checkpoint0:validate`** through **`checkpoint4:validate`**: all pass. `checkpoint4:validate`
  itself: **133 checks passed, 0 failed**. `checkpoint3:validate` reports 1 expected, cosmetic-only
  failure — see below.
- **Playwright e2e, the full Docker-based suite** (`docker compose --profile test up -d --build
  web-e2e` — which runs `db:reset:test && db:import:legacy && db:publish:test-fixtures && npm run
  build && npm run start` from a clean test database — then `docker compose --profile test run --rm
  e2e`): **123 passed, 0 failed, 23 skipped** (skipped tests require real `E2E_STUDENT_EMAIL` /
  `E2E_STUDENT2_EMAIL` / `E2E_STAFF_EMAIL` credentials against a live Supabase project, which aren't
  configured in this environment — the same, pre-existing, documented gating pattern used since
  Checkpoint 2/3). This run included all 14 new/extended Checkpoint 4 scenarios
  (`tests/e2e/discovery.spec.ts` plus additions to `staff-auth.spec.ts` and
  `student-auth-and-sync.spec.ts`) and every pre-existing spec, confirming no regression.
  **This suite was run four times in total during this session** — the first run surfaced 17 real
  failures (see below), each subsequent run verified a round of fixes, and the fourth run was fully
  green.

## Expected, cosmetic-only earlier-checkpoint validator staleness

`npm run checkpoint3:validate` reports 119 passed / **1 failed**: "Privacy page must be marked as
reviewed for Checkpoint 3." The privacy page's "Last reviewed for Checkpoint N" line is a single,
most-recent freshness marker by design — it now correctly says "Checkpoint 4," so it no longer
contains the literal substring "Checkpoint 3." This is the expected, intended behaviour of that
marker advancing forward, not a regression in the actual guarantee: the substantive check right
next to it ("staff cannot casually browse...") still passes, because that wording was restored
verbatim in the same edit. `checkpoint0:validate`, `checkpoint1:validate`, and `checkpoint2:validate`
all still pass with zero failures.

## Problems found and fixed during this session

The first full Docker e2e run (from a freshly reset, imported, and published test database) is what
actually surfaced most of these — several are genuine bugs that unit/integration tests alone could
not have caught, since they only manifest against the full real dataset and a real browser.

- **`useSyncExternalStore` infinite-render bug** in `useComparisonSelection.ts`: `readIds()`
  re-parsed `localStorage` on every call, returning a new array reference each time, which violates
  `useSyncExternalStore`'s requirement that `getSnapshot()` be referentially stable when nothing
  changed — caused "Maximum update depth exceeded" and 5 failing component tests. Fixed with a
  module-level `cachedRaw`/`cachedIds` pair that only re-parses when the raw string actually changes.
- **Dynamic Tailwind class name** in `MatchReasonsPanel.tsx` (`` `text-${tone}` ``) — invisible to
  Tailwind's static JIT scanner, would silently produce no styling in production. Fixed with a
  static `TONE_TEXT_CLASS` lookup record.
- **Service worker precache didn't honour `Cache-Control: no-store`**: the install-time
  `cache.add()` step wrote a response to the shared app-shell cache unconditionally, unlike the
  navigation path, which already checked the header. Fixed with a `precacheAppShellUrl()` helper
  that checks the same header first.
- **Un-awaited `cache.put()` calls in `public/sw.js`**: every cache-write in `networkFirstNavigation`,
  `cacheFirst`, and `staleWhileRevalidate` was a dangling, un-awaited microtask with no
  `event.waitUntil()` coverage — the browser is free to abandon it once the handler returns, with no
  guarantee it lands before, say, the device going offline moments later. Found via the e2e offline
  test intermittently/then-consistently failing to serve `/opportunities` offline after an online
  visit. Fixed by awaiting every `cache.put()` before the handler resolves. `CACHE_VERSION` bumped
  to `v5`.
- **`--color-warning` fails WCAG AA contrast** (`#96690a` on `#fdf2e0` measured 4.38:1 against a
  4.5:1 requirement at the badge's font size) — a pre-existing design-token gap that Checkpoint 4's
  `MatchBadge` ("needs-verification"/"deadline-risk" labels, which reuse the same "amber" pair as
  the existing `Badge.tsx`) made newly reachable on the homepage and catalogue pages, failing the
  e2e axe-core accessibility suite. Fixed by darkening `--color-warning` to `#875f09` (≈5.16:1),
  documented inline in `globals.css`.
- **`Cache-Control: private, no-store` silently defeated offline caching for `/`, `/opportunities`,
  and `/opportunities/[slug]`**: these are `force-dynamic` routes, and Next.js's own default header
  for a dynamic route that reads cookies (`getStudentSession()`, added to `/opportunities` and
  `/opportunities/[slug]` this checkpoint to support saved-search/match-label features) is an
  aggressive `private, no-cache, no-store, must-revalidate` — applied even to a guest with no
  session at all. The service worker's own (pre-existing, unchanged) `no-store`/`private` check
  then correctly refused to cache these responses, silently breaking the documented
  offline-catalogue-browsing capability for every guest. Found via the e2e offline test failing with
  `net::ERR_INTERNET_DISCONNECTED`. Fixed in `middleware.ts`: a guest visit to one of these paths
  now gets an explicit `Cache-Control: no-cache` override (cacheable for offline use, always
  revalidated online), while a signed-in visit still gets the stricter `no-store`; the homepage gets
  the cacheable override unconditionally since it never renders session-dependent content.
- **Typo-tolerant search matched unrelated 4-letter words**: `tokenMatches()`'s fuzzy-match distance
  formula allowed a 4-character query token (e.g. "DAAD") to match any 4-letter word at edit-distance
  2 — which includes "grad" (as in "graduate"), a word appearing in many unrelated scholarships'
  eligibility text. Found via the pre-existing `catalogue.spec.ts` detail-page test landing on the
  wrong opportunity after searching "DAAD". Fixed by raising the fuzzy-match floor to 5 characters
  and tightening the distance formula, re-verified against the existing typo-tolerance unit tests
  (still passing) and the e2e suite (now landing on the correct opportunity).
  A second, legitimate fact surfaced by the same investigation: the seed dataset genuinely contains
  two different "DAAD"-titled opportunities, so tests asserting an exact "DAAD" result count were
  updated from 1 to 2 rather than the search behaviour being changed further.
- **Guest reminders/saved searches never appeared without a manual reload**: `NotificationCenter`
  and `SavedSearchesPanel` each fetch their guest data once on mount, but the actual write happens
  asynchronously in a *different* hook/component (`useGuestReminderSync()`, `SaveSearchButton`) with
  no signal connecting the two — a race where the write reliably lands after the one-shot read.
  Found via e2e reminder/saved-search tests reporting `Upcoming (0)` / "No saved searches yet"
  immediately after the data should have existed. Fixed by subscribing both components to the
  relevant `subscribeToStorageChange()` channel (`"reminders"` / `"savedSearches"`), mirroring the
  pattern already established in `useStorageCollection.ts` elsewhere in the codebase.
- **`revalidatePath("/discover")` in `saved-searches.ts`**: targeted a route that doesn't exist in
  this app (the real page is `/opportunities`) — a copy-paste artifact from scaffolding. Fixed across
  all four call sites; low real-world impact (client components here re-fetch via direct RPC, not
  page-cache invalidation) but clearly wrong regardless.
- **Two strict-mode-violation / wrong-count bugs in the new e2e tests themselves** (not app bugs):
  a locator matching both an opportunity's own "Eligibility" section and the match-reasons panel's
  citation of the same text; a locator matching "Saved searches" substring-inside "No saved searches
  yet"; and an assumption that every seeded opportunity resolves to the same match label, which
  doesn't hold once an opportunity's deadline has already passed (some seeded deadlines are dated
  earlier in 2026, before today). All three fixed in the test files.
- **Validator false positives** in `scripts/validate-checkpoint4.ts` itself, caught while first
  running it: one regex matched prose in a code comment describing what a field *excludes* (not an
  actual field declaration), the other used a too-narrow grant-statement pattern that didn't match
  the migration's real `grant select, insert, update, delete on ...` syntax. Both fixed in the
  validator, not by weakening the underlying check.

## Deferred / documented limitations

See [checkpoint-4-traceability.md](checkpoint-4-traceability.md#deferred--documented-limitations)
for the full list with reasons: Web Push (background browser notifications), standalone
`search:reindex`/`reminders:dispatch`/`saved-searches:check` CLI scripts (no server-side batch job
exists for either in this design), staff discovery-quality queues scoped to published opportunities
only, comparison selection staying client-side-only, and notifications being excluded from the
guest→cloud **migration** path specifically (while still included in backup/export/import).

## Final status

Every command in the required validation list was actually run in this session and passed, with the
one documented cosmetic exception (`checkpoint3:validate`'s freshness-marker string). The full
Docker e2e suite passed cleanly (123/123 runnable tests, 0 failures) after four iterative
fix-and-rerun cycles. Nothing in this report is claimed without having been executed and observed
directly.
