# Checkpoint 6: Completion report

## Features completed

- Production environment validation (`APP_ENV`, boot-time `validateProductionEnvironment()`).
- Security hardening: nonce-based CSP, HSTS (production-only), baseline headers, `X-Robots-Tag` noindex
  for private routes, a new cookie-based rate limiter for the public correction-report endpoint.
- SEO: `/sitemap.xml`, `/robots.txt`, a shared `buildMetadata()` helper (Open Graph/Twitter/canonical) used
  on every public page, structured data (`WebSite`/`Organization`/`SearchAction`, `BreadcrumbList`,
  `EducationalOccupationalProgram`, `FAQPage`).
- Twelve new public content/legal pages.
- A privacy-friendly analytics abstraction, disabled by default, honest about its one supported provider's
  real capabilities, wired to four real call sites.
- An ad-readiness abstraction, disabled by default, self-excluding from private/sensitive pages regardless
  of placement.
- Observability: `/api/ready`, `/api/version`, a staff-only `/staff/ops` diagnostics page, route-level and
  root-layout error boundaries, a server-side logging abstraction.
- A pragmatic, dependency-free performance budget (`perf:audit`) measuring real build output.
- Extended accessibility test coverage (7 new pages, reduced-motion check, dialog focus-return check) —
  and one real, pre-existing accessibility bug found and fixed (see "Bugs found and fixed").
- Deployment and backup/recovery runbooks, including an honest assessment that this app's architecture is
  not a clean fit for Cloudflare Pages without a real migration.
- A GitHub Actions CI workflow requiring no real Supabase/Groq secrets.
- 7 new documentation files plus README updates.

## Routes/pages created

`/about`, `/methodology`, `/terms`, `/disclaimer`, `/contact`, `/faq`, `/status`, `/security`,
`/accessibility`, `/advertising-policy`, `/data-sources`, `/verification-policy`, `/staff/ops`,
`/sitemap.xml`, `/robots.txt`, `/api/ready`, `/api/version`.

## Security changes

Nonce-based CSP (`src/lib/security/csp.ts`), HSTS in production, `X-Content-Type-Options`/
`X-Frame-Options`/`Referrer-Policy`/`Permissions-Policy` on every response, `X-Robots-Tag: noindex` +
`Cache-Control` for private routes, a new cookie-based rate limiter (`src/lib/security/cookie-rate-limit.ts`)
protecting `POST /api/correction-reports`, a secret-scanning script (`security:secrets`), and a static
security-header validator (`security:headers`). Full detail:
`docs/checkpoint-6/security-hardening.md`.

## SEO changes

`app/sitemap.ts` (published opportunities only), `app/robots.ts` (kept in sync with the noindex prefix
list), `src/lib/seo/metadata.ts`, `src/components/common/JsonLd.tsx`, and structured data across the
homepage, opportunity pages, and FAQ. Full detail: `docs/checkpoint-6/seo-and-content-strategy.md`.

## Analytics changes

`src/lib/analytics/index.ts` rewritten as a real (if honestly limited) abstraction — disabled by default,
gated on `isAnalyticsConfigured()`, wired to page-view, PWA-install, correction-report, and AI-feedback
call sites. Full detail: `docs/checkpoint-6/analytics-and-ads-policy.md`.

## Ads/monetization readiness

`src/components/ads/AdSlot.tsx` — disabled by default, gated on `isAdsConfigured()`, self-excludes from
auth/account/staff/privacy/security/assistant pages regardless of placement, placed at the catalogue
(after results), the footer, and the FAQ page. Structural only — no live AdSense unit, no publisher slot
ID, no approved AdSense account exists for this project.

## Observability changes

`/api/ready`, `/api/version`, `/staff/ops` (Administrator-only), `app/error.tsx` enhanced with Next's
`error.digest` as a safe reference id, `app/global-error.tsx` (new, root-layout-level boundary),
`src/lib/observability/logger.ts`.

## CI/deployment changes

`.github/workflows/ci.yml` (three jobs: checks, db-tests, e2e-smoke — no required secrets). Deployment
runbook honestly documents that Cloudflare Pages is not a clean fit for this app's Node.js/Postgres-driver
architecture without a real migration, and recommends Render/Fly.io/self-hosted Docker instead.

## Tests added

- `tests/unit/security-headers.test.ts` (9 tests), `tests/unit/cookie-rate-limit.test.ts` (6 tests),
  `tests/unit/env-checkpoint6.test.ts` (12 tests) — 27 new unit tests, all passing.
- `tests/e2e/production-readiness.spec.ts` — 12 new scenarios (see traceability doc for exact mapping).
- `tests/e2e/accessibility.spec.ts` extended with 7 more pages plus a reduced-motion check and a
  dialog-focus-return check.

## Validation results (all commands actually run this session)

| Command | Result |
|---|---|
| `npm run data:validate` | PASSED (55/55 records) |
| `npm run deadlines:audit` | PASSED WITH WARNINGS (pre-existing, unrelated to this checkpoint) |
| `npm run checkpoint0:validate` | PASSED |
| `npm run checkpoint1:validate` | PASSED |
| `npm run checkpoint2:validate` | PASSED — 497/497 |
| `npm run checkpoint3:validate` | 118 passed, 2 failed — expected, cosmetic staleness (see below) |
| `npm run checkpoint4:validate` | 130 passed, 3 failed — expected, cosmetic staleness (see below) |
| `npm run checkpoint5:validate` | PASSED — 136/136 |
| `npm run checkpoint6:validate` | PASSED — 96/96 |
| `npm run security:secrets` | PASSED |
| `npm run security:headers` | PASSED — 22/22 |
| `npm run seo:validate` | PASSED — 61/61 |
| `npm run accessibility:test` | PASSED (part of the full e2e run below) |
| `npm run perf:audit` | PASSED — 2076.6 kB total client JS (budget 4096 kB), largest chunk 276.8 kB (budget 400 kB) |
| `npm run ai:safety:test` | PASSED — 5/5 |
| `npm run ai:evaluate` | PASSED — 15/15 |
| `npm run db:check` | PASSED (drizzle-kit check, real Postgres) |
| `npm run db:test` | PASSED — 75/75 (real Docker Postgres, includes all 20 Checkpoint 5 AI RLS tests, unaffected) |
| `npm run typecheck` | PASSED, no errors |
| `npm run test` | PASSED — 427 passed, 1 skipped |
| `npm run test:coverage` | Ran; 25% overall statement coverage (unit tests are a slice of coverage — most behaviour is e2e-tested, consistent with this project's established pattern) |
| `npm run build` | PASSED (production build, all routes compile) |
| Playwright e2e (`docker compose --profile test run --rm e2e`) | **175 passed, 4 failed, 33 skipped** — see below |

### Expected, cosmetic-only checkpoint3/4 validator staleness

Identical, pre-existing pattern documented in the Checkpoint 4 and Checkpoint 5 completion reports: a
single "Last reviewed for Checkpoint N" freshness marker on `/privacy` and a single `SCHEMA_VERSION`
constant can only ever reflect the MOST RECENT checkpoint, so an older checkpoint's validator naturally
reports staleness once a later checkpoint reviews the same page/bumps the same constant again. Not a
regression — confirmed unchanged from the Checkpoint 5 session's own report.

### The 4 e2e failures — investigated, proven pre-existing, not a Checkpoint 6 regression

`tests/e2e/ai-assistant.spec.ts` scenario 12 and `tests/e2e/offline.spec.ts`'s core-shell test fail on both
browser projects (4 test instances total). Root-caused to a service-worker-control timing issue in this
session's Docker/Playwright execution environment: `navigator.serviceWorker.controller` never becomes
truthy for a reloaded page, regardless of reload count, wait duration (tested to 85+ seconds), or whether
the CSP header is present at all. **Verified via `git stash` to reproduce identically against the exact,
unmodified Checkpoint 5 `sw.js`/`middleware.ts`** — this is not something Checkpoint 6 introduced. Full
investigation notes: `docs/checkpoint-6/checkpoint-6-traceability.md`, "Honest note on two pre-existing,
environment-level e2e failures."

## Known limitations

- The 4 e2e failures above — pre-existing, environment-specific, not fixed (root-caused but not resolved;
  a real fix needs a different test harness or a Playwright/Chromium version change).
- The GitHub Actions workflow was authored and mirrors every locally-verified command but was never
  actually executed on GitHub's own infrastructure from this environment.
- Ad readiness is structural only (no approved AdSense account).
- The analytics abstraction's one supported provider has no custom-event API; `trackEvent()` remains a
  tested no-op today.
- No dedicated Open Graph image; social cards reuse the PWA app icon.
- No full "unnecessary client component" performance refactor audit was performed.

## Deferred work

- Wiring the remaining defined-but-unused analytics event names to real call sites (`search_performed`,
  `filter_category_used`, `saved_search_created`, `reminder_created`, account signup/login results).
- A real AdSense `<ins>` unit, once a publisher account is approved.
- A dedicated social-share image.

## Bugs found and fixed this session

1. **`app/assistant/page.tsx`'s inline "History & privacy settings" link** — insufficient colour contrast
   (1.28:1, needs 3:1) with no default underline, relying on colour alone to distinguish it from
   surrounding text (a WCAG 2.1 A failure). Found by extending `accessibility.spec.ts` to cover
   `/assistant`. Fixed: `hover:underline` → `underline` (always visible).
2. **`public/sw.js`'s install-time precache firing all URLs concurrently** — grew from 8 to 20 URLs this
   checkpoint; concurrent `Promise.allSettled` fetches compete with the registering page's own requests
   for the browser's per-origin HTTP connection limit. Fixed by precaching sequentially
   (`precacheAppShellUrls()`). Kept as a real improvement even though it did not turn out to be the root
   cause of the 4 e2e failures above (that was independently proven to be pre-existing).
3. **The documented `db:reset:test`/`db:test` Docker commands in README.md were missing
   `DATABASE_MIGRATION_URL`** — `scripts/db-migrate.ts` prefers `DATABASE_MIGRATION_URL` over
   `DATABASE_URL` when both are set, and the `web` service's `docker-compose.yml` definition hardcodes
   *both* to point at the `db` (development) service. Overriding only `DATABASE_URL` via `-e` silently ran
   migrations against the wrong database while the rest of the reset script correctly targeted `db-test`,
   producing a confusing "relation ... does not exist" failure. Found while validating this checkpoint's
   own `db:test` run; fixed by adding the missing override to both documented commands.
4. Two logic bugs in `scripts/validate-checkpoint6.ts` itself, found and fixed during its own first run:
   an overly broad "no file input anywhere" check that flagged three legitimate, pre-existing JSON/CSV
   import features, and an analytics-safety check that flagged its own documentation comment for
   containing the words it was checking aren't misused.

## Files created/modified

See `docs/checkpoint-6/checkpoint-6-traceability.md` for the full requirement-to-file mapping. Summary
counts: ~45 new files (12 content pages, 6 lib modules, 7 docs, 5 scripts, 3 test files, CI workflow,
2 new API routes, 1 staff page), ~25 modified files (env.ts, middleware.ts, next.config.ts, layout.tsx,
sw.js, package.json, README.md, and several component files for analytics/ads wiring).
