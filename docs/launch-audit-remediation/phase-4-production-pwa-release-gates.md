# Launch audit remediation — Phase 4: production, PWA, release gates

Fixes every Phase 4 item from the launch-blocker audit: a real multi-stage production
Docker image, a hardened production Compose topology, service-worker resilience and
bounded cache growth, stricter production environment enforcement, a genuine content
readiness gate, repaired stale checkpoint validators, an aligned CI pipeline that
actually runs the full e2e suite, deterministic test-account provisioning, and
enforced coverage thresholds. Along the way this phase found and fixed one **critical,
pre-existing regression** that was silently breaking CI's own database/e2e test setup,
and diagnosed (but could not fully resolve) one deep, pre-existing service-worker/
Playwright/Docker interaction bug — both documented in full below.

## Every changed file

**New:**
- `scripts/validate-production-env-behavior.ts` — the behavioral half of the old
  `validate-launch.ts` (see item 6 below): mutates `process.env` to simulate production
  scenarios and asserts on `validateProductionEnvironment()`'s real throw/no-throw
  behavior, including new scenarios for `ENABLE_DATABASE_CATALOGUE`/`ENABLE_STAFF_ADMIN`/
  `ALLOW_ADMIN_SELF_REVIEW`.
- `scripts/launch-content-gate.ts` (`npm run launch:content:gate`) — an actual pass/fail
  content-readiness gate (see item 7 below), distinct from the existing
  `launch-content-report.ts`, which only ever reports and always exits 0.
- `scripts/e2e-provision-test-accounts.ts` (`npm run e2e:provision-test-accounts`) —
  deterministic, idempotent creation of the three fixed-credential Supabase test accounts
  (`E2E_STAFF_EMAIL`, `E2E_STUDENT_EMAIL`, `E2E_STUDENT2_EMAIL`) the "authenticated flows"
  e2e blocks already look for.

**Modified:**
- `Dockerfile` — added a genuine three-stage `production` target (`deps` → `builder` →
  `production`), keeping the existing `development` stage untouched. The docs' own
  previously-sketched single-stage snippet (`docs/checkpoint-6/production-deployment-runbook.md`
  §2) would not actually have worked: `npm ci --omit=dev` before `next build` strips
  `typescript`/`tailwindcss`/`postcss`, which the build itself needs. Verified by building
  the `production` target directly and running the resulting container (see "Commands run"
  below) — clean boot, `/api/health` returns 200.
- `docker-compose.yml` — new `web-prod` service (profile `prod`, opt-in via
  `docker compose --profile prod up --build web-prod`): the real hardened topology —
  `target: production`, no source bind-mount, `read_only: true` root filesystem with a
  `tmpfs` mount at `.next/cache` (the one path `next start` needs to write to), same
  `cap_drop: ALL`/`no-new-privileges` posture as the existing services. Verified directly
  (bypassing the host's already-bound port 3000) — boots cleanly under `--read-only`, no
  filesystem errors, `/api/health` returns 200.
- `public/sw.js` — `CACHE_VERSION` bumped `v6` → `v7`. Every `cache.put()` call site now
  goes through a new `safeCachePut()` helper: (a) wrapped in try/catch, since a full
  storage quota or a private-browsing mode that restricts Cache Storage would otherwise
  throw and turn an already-successful network response into a false "offline" fallback;
  (b) followed by `evictOldestEntries()`, capping each cache (`RUNTIME_CACHE` 150 entries,
  `STATIC_ASSET_CACHE` 200, `APP_SHELL_CACHE` 60) — previously unbounded, since
  opportunity pages/search queries/hashed assets a visitor browses have no natural
  ceiling. Eviction explicitly protects the fixed, install-time-precached `APP_SHELL_URLS`
  set from ever being evicted (they're the oldest entries by construction, so a naive
  oldest-first eviction would otherwise silently break the "app shell always available
  offline" guarantee the first time a visitor browsed enough other pages).
- `src/lib/env.ts` — `validateProductionEnvironment()` now also requires
  `ENABLE_DATABASE_CATALOGUE`/`ENABLE_STAFF_ADMIN` to be **explicitly** `"true"` or
  `"false"` (never silently defaulted from being unset — but explicit `"false"` still
  passes, since that's the documented emergency-rollback state, not a misconfiguration),
  and rejects `ALLOW_ADMIN_SELF_REVIEW=true` outright in production. Previously neither
  was checked at all, despite both being documented as required/forbidden in the
  Checkpoint 6/7 runbooks.
- `scripts/validate-launch.ts` — trimmed to only the static, side-effect-free
  `.env.example` documentation checks (see item 6).
- `scripts/validate-checkpoint3.ts`, `scripts/validate-checkpoint4.ts` — repaired stale
  checks (see "checkpoint validator repairs" below); both now pass again (0 failures,
  previously 4 and 3 respectively).
- `scripts/validate-checkpoint7.ts` — registered `launch:validate:env-behavior` and
  `launch:content:gate` as required package.json commands.
- `scripts/db-publish-test-fixtures.ts` — **critical fix**, see below.
- `package.json` — three new scripts: `launch:validate:env-behavior`,
  `launch:content:gate`, `e2e:provision-test-accounts`.
- `vitest.config.ts` — added coverage `thresholds` (statements 25%, branches 20%,
  functions 20%, lines 25% — a regression floor set a few points below the actual current
  baseline, not an aspirational target; see item 13 below for why).
- `.github/workflows/ci.yml` — `checks` job now also runs `checkpoint7:validate`,
  `launch:validate`, and `launch:validate:env-behavior`, and runs `test:coverage` (with
  the new thresholds enforced) instead of the plain, threshold-free `test`. The e2e job
  (renamed from `e2e-smoke` to `e2e`) now runs the **full** suite instead of a 4-file
  subset.
- `tests/e2e/fixtures.ts` — every test now fails on an unexpected browser console error
  or uncaught page exception, not just its own explicit assertions; two default-allowlisted
  patterns (`net::ERR_INTERNET_DISCONNECTED` from deliberate `setOffline(true)` calls, and
  "the server responded with a status of 4xx" from deliberate wrong-credentials tests) —
  both browser/test-infrastructure noise, not application bugs; a `page.allowConsoleError(pattern)`
  escape hatch for anything else a specific test needs.
- `tests/e2e/offline.spec.ts`, `tests/e2e/ai-assistant.spec.ts` — the one test in each file
  that depends on the service worker actually controlling the page is now `test.fixme()`
  with the full diagnostic trail inline (see "honest gaps" below) — tracked, not silently
  skipped; every other test in both files is unaffected and still runs.
- `tests/e2e/custom-opportunities.spec.ts` — fixed an ambiguous `getByText()` locator
  (matched twice — `OpportunityDetailBody` legitimately renders `VerificationBadge` for
  both a mobile and a desktop responsive layout, both present in the DOM); scoped to
  `.first()`.

## The critical fix: `db-publish-test-fixtures.ts`

**This was breaking CI's `db-tests` job and the entire e2e suite before this phase even
started** — not something Phase 4 introduced, but something Phase 4's own work (actually
running the full Docker e2e pipeline, for the first time in this whole remediation effort)
surfaced.

Phase 1 (`drizzle/0010_publication_integrity_actors.sql`) added a stricter
`app.enforce_opportunity_publication_requirements()` trigger: publishing now requires a
`confirmed-official` source with a checked-at timestamp, a `verified` verification record
tied to `accepted` evidence, an independently approved revision, and a completed review
assignment. `scripts/db-publish-test-fixtures.ts` (the script CI's `db-tests` job and
`docker-compose.yml`'s `web-e2e` service both use to publish the 55 imported legacy
records for e2e/catalogue testing) still directly flipped `status = 'published'` with none
of that — it was never updated for Phase 1's own gate. Every CI run since Phase 1 landed
would have failed at this exact step.

**Fixed**: the script now promotes each opportunity's existing (already-created by
`import-legacy-scholarships.ts`) `candidate` official source to `confirmed-official` and
its `captured` evidence to `accepted`, creates a `verified` verification record and a
`completed` review assignment using a second, distinct system approver actor (self-approval
is rejected by Phase 1's own constraints), and links the evidence to that specific
verification record — all in one transaction, mirroring
`tests/integration/helpers.ts`'s `publishOpportunityForTest()`. Verified: all 55 legacy
records now publish successfully, `db:verify:migration` reports no issues, and the full
`db:test` integration suite (113 tests) and full e2e suite (211 tests) both pass against
the result.

## Checkpoint validator repairs (item 8)

Both `validate-checkpoint3.ts` and `validate-checkpoint4.ts` had the same two classes of
staleness, both stemming from earlier phases' own legitimate later changes:
- **Literal string checks against renamed code**: checkpoint3 checked for the literal
  string `"sanitizeNextPath"` in `middleware.ts`/`StudentLoginForm.tsx` — renamed to
  `sanitizeRedirectPath` in Phase 2. Fixed to check the new name.
- **Point-in-time facts asserted as eternal**: checkpoint3 required the privacy page to
  say `"AI is not used"` (true when Checkpoint 3 shipped, before Checkpoint 5 added a real,
  properly-disclosed AI assistant); checkpoint4 required `"SCHEMA_VERSION = 4"` exactly
  (the guest-storage schema version has since legitimately advanced to 5) and a literal
  `"Checkpoint 4"` review-date string (the page has since been reviewed again, now says
  "Checkpoint 5"). Fixed with an "at least N" / "still true, or superseded by a
  later checkpoint's own equivalent disclosure" pattern instead of exact matches — a
  `reviewedForCheckpointAtLeast()` helper and an AI-disclosure OR-condition, so a later,
  legitimate checkpoint's own review doesn't make an earlier checkpoint's validator fail
  forever.

Both validators pass cleanly now (120/120 and 133/133 checks).

## "Splitting synthetic vs. real environment validators" (item 6) — my interpretation

This item was less concretely specified than the others, so here is the judgment call
made and the reasoning: `validate-launch.ts` mixed two different kinds of check in one
script — static, read-only `.env.example` documentation checks (safe anywhere, no side
effects) and a behavioral simulation that mutates `process.env` and exercises the live
`validateProductionEnvironment()` function. Split into `validate-launch.ts` (synthetic —
documentation only) and the new `validate-production-env-behavior.ts` (real — behavioral,
restores `process.env` in a `finally` block). If this doesn't match what "synthetic vs.
real environment validators" was meant to refer to, this is the most concrete, defensible
reading found in the codebase.

## Content-gating failure conditions (item 7)

`launch-content-report.ts` (`npm run launch:content`) reports the real, database-queried
published count but always exits 0 — including when the 100-record target isn't met — by
design, since it must be safe to run in any environment (including plain CI with no
database at all). That left nothing that actually **gates** a launch decision.
`launch-content-gate.ts` (`npm run launch:content:gate`) is the new, actual gate: fails
(non-zero exit) unless the real published count meets the target (default 100, overridable
via `LAUNCH_CONTENT_TARGET` only for a deliberate, documented limited-beta launch — never
to paper over a target that hasn't been reached), and fails closed (also non-zero) when no
`DATABASE_URL` is configured at all, rather than reporting "not checked." Deliberately
**not** wired into the routine push/PR CI pipeline — it would permanently fail there, since
CI's database only ever holds imported legacy/test fixtures, never real reviewed content.
Verified against the local test database: correctly reports RED (0/100, exit 1) today.

## Commands run and exact results

| Command | Result |
|---|---|
| `docker build --target production` + run | Builds cleanly; container boots, `/api/health` returns 200 |
| `docker compose --profile prod build/run web-prod` (read-only root FS + tmpfs) | Boots cleanly, no filesystem errors, `/api/health` returns 200 |
| `npm run typecheck` | PASSED, no errors |
| `npm run lint` | PASSED, no errors |
| `npm run test:coverage` | **513 passed, 1 skipped**; thresholds (25/20/20/25%) met by the actual 28.83/25.32/24.04/29.34% |
| `npm run checkpoint0:validate` … `checkpoint7:validate` | All 8 PASSED (checkpoint3: 120/120, checkpoint4: 133/133, checkpoint7: 74/74 — checkpoint7's count includes the two newly-registered launch commands) |
| `npm run launch:validate` | 28/28 passed |
| `npm run launch:validate:env-behavior` | 8/8 passed (including the new ENABLE_DATABASE_CATALOGUE/ENABLE_STAFF_ADMIN/ALLOW_ADMIN_SELF_REVIEW scenarios) |
| `npm run launch:content:gate` (against local test DB) | Correctly RED — 0/100 published, exit 1 |
| `npm run db:reset:test && db:import:legacy && db:publish:test-fixtures && db:verify:migration` | All succeed; 55/55 published, no issues found (previously failing before the critical fix above) |
| `npm run db:test` | **113/113 passed** |
| `npm run build` | PASSED — all 68 routes compile |
| Full Playwright suite (`docker compose --profile test run --rm e2e npx playwright test`, matching the new CI job exactly) | **211 passed, 0 failed, 37 skipped** — every skip is either a documented real-Supabase-account gate (unaffected by this phase; addressed by the new provisioning script for anyone who opts in) or one of the two `fixme`s below |

## Honest gaps / deferred within Phase 4

- **A pre-existing, deep service-worker/Playwright/Docker interaction bug, diagnosed but
  not resolved.** `navigator.serviceWorker.controller` never becomes truthy for the test
  page in this Docker/Playwright environment, even after `registration.active.state ===
  "activated"` is confirmed, even after an explicit `page.reload()` (a workaround a
  previous engineer had already tried in `ai-assistant.spec.ts`, independently confirming
  this isn't new), and even though the target URL is verifiably present in Cache Storage
  by then (dumped and inspected directly via a diagnostic script run against the actual
  running container). This means the service worker never actually intercepts the page's
  fetches once offline, regardless of what's cached — so the one test in
  `offline.spec.ts` and the one test in `ai-assistant.spec.ts` that need the SW to *serve*
  cached content while offline cannot pass here. Ruled out as causes: `Cache-Control`
  headers (verified `no-cache`, correct, via a direct request to the running container),
  `sw.js`'s MIME type (`application/javascript`, correct), a Playwright `serviceWorkers`
  context-option override (none set — default `'allow'` applies), and this phase's own
  `sw.js` changes (reproduces identically against the unmodified pre-Phase-4 service
  worker). Both tests are marked `test.fixme()` with the full trail inline — tracked,
  visible in every test run, and will flip to a visible "unexpectedly passing" signal the
  moment someone resolves it — rather than either silently skipped or left as an
  unexplained red X. This is the one item where "offline tests pass" from the task's own
  required-tests list is not fully met; every other offline/service-worker test (staff/
  account pages correctly NOT served while offline, the `/offline` fallback page itself,
  bounded cache eviction, safe cache writes) does pass.
- **`e2e:provision-test-accounts` closes the "not deterministic" gap, not the "requires a
  real Supabase project" one.** This app's auth is real Supabase Auth end to end with no
  local emulation anywhere in this codebase; provisioning a genuinely secret-free,
  fully-local authenticated e2e path would mean standing up Supabase's own local CLI stack
  (a new Docker service, local JWT signing, etc.) — a real infrastructure decision, not a
  bug fix, and out of scope for this pass. The baseline no-secrets CI run correctly
  continues to skip the "authenticated flows" blocks; the new script makes standing up
  those accounts against a real (test) Supabase project a single idempotent command
  instead of manual, undocumented setup.
- **Coverage thresholds are a regression floor, not a quality target.** Set a few points
  below today's actual numbers (25/20/20/25% vs. actual ~28.8/25.3/24.0/29.3%) rather than
  an ambitious bar, because this repo's server-heavy code is exercised mostly by the
  separate integration and e2e suites, which `test:coverage` never sees — an aspirational
  blanket number here would be structurally misleading, not a real signal.
- Phase 1/2/3's already-documented gaps remain open and unrelated to this phase.
