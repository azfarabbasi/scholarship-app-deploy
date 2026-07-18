# Checkpoint 6: Traceability

Maps every checkpoint requirement to its implementation, test, and validator coverage.

| Requirement | Implementation | Test | Validator | Status |
|---|---|---|---|---|
| Production env validation | `instrumentation.ts`, `validateProductionEnvironment()` in `src/lib/env.ts` | `tests/unit/env-checkpoint6.test.ts` | `checkpoint6:validate` §1 | Done |
| Security headers | `next.config.ts` `headers()`, `src/lib/security/csp.ts`, `middleware.ts` | `tests/unit/security-headers.test.ts` | `security:headers`, `checkpoint6:validate` §2 | Done |
| CSP strategy + documented exceptions | `src/lib/security/csp.ts` | `tests/unit/security-headers.test.ts` | `security:headers` | Done |
| Rate limiting / abuse protection review | `src/lib/security/cookie-rate-limit.ts`, wired into `app/api/correction-reports/route.ts` | `tests/unit/cookie-rate-limit.test.ts` | `checkpoint6:validate` (indirect) | Done |
| SEO metadata / sitemap / robots | `app/sitemap.ts`, `app/robots.ts`, `src/lib/seo/metadata.ts` | `tests/e2e/production-readiness.spec.ts` #1–2 | `seo:validate`, `checkpoint6:validate` §4–5 | Done |
| Structured data | `src/components/common/JsonLd.tsx` + per-page usage | `tests/e2e/production-readiness.spec.ts` #1–2 | `seo:validate` | Done |
| noindex for private/staff/account/auth/AI-private pages | `NOINDEX_PREFIXES` in `middleware.ts` | `tests/e2e/production-readiness.spec.ts` #3 | `seo:validate`, `checkpoint6:validate` §3 | Done |
| Public content pages (12) | `app/{about,methodology,terms,disclaimer,contact,faq,status,security,accessibility,advertising-policy,data-sources,verification-policy}/page.tsx` | `tests/e2e/accessibility.spec.ts` (sample), `tests/e2e/production-readiness.spec.ts` #8–9 | `checkpoint6:validate` §9 | Done |
| Analytics abstraction, disabled by default | `src/lib/analytics/index.ts`, `AnalyticsInit.tsx` | `tests/unit/env-checkpoint6.test.ts`, `tests/e2e/production-readiness.spec.ts` #5 | `checkpoint6:validate` §6 | Done |
| Observability / health endpoints | `/api/health` (existing), `/api/ready`, `/api/version`, `/staff/ops` | `tests/e2e/production-readiness.spec.ts` #6 | `checkpoint6:validate` §7 | Done |
| Error boundary | `app/error.tsx`, `app/global-error.tsx` | `tests/e2e/production-readiness.spec.ts` #7 | `checkpoint6:validate` §7 | Done |
| Ad abstraction, disabled by default | `src/components/ads/AdSlot.tsx` | `tests/e2e/production-readiness.spec.ts` #4 | `checkpoint6:validate` §8 | Done |
| Advertising policy page | `app/advertising-policy/page.tsx` | — (content page) | `checkpoint6:validate` §8–9 | Done |
| Legal/trust pages | privacy (existing), terms, disclaimer, security, accessibility | — (content pages) | `checkpoint6:validate` §9 | Done |
| Deployment documentation | `docs/checkpoint-6/production-deployment-runbook.md` | — | `checkpoint6:validate` §10 | Done |
| Backup/recovery documentation | `docs/checkpoint-6/backup-and-recovery.md` | — | `checkpoint6:validate` §10 | Done |
| CI workflow | `.github/workflows/ci.yml` | N/A — see below | `checkpoint6:validate` §11 | Written, not executed on GitHub (see note) |
| Secret scan command | `scripts/security-secrets-scan.ts` | Exercised directly (`npm run security:secrets`) | `checkpoint6:validate` §12 | Done |
| Accessibility test command | `package.json`'s `accessibility:test` → `tests/e2e/accessibility.spec.ts` | Self | `checkpoint6:validate` §12 | Done |
| Performance audit command | `scripts/perf-audit.ts` | Exercised directly (`npm run perf:audit`) | `checkpoint6:validate` §12 | Done |
| Service worker excludes private routes | `public/sw.js` (unchanged Checkpoint 4/5 exclusion list) | `tests/e2e/staff-auth.spec.ts`, `student-auth-and-sync.spec.ts` (existing) | `checkpoint6:validate` §13 | Done (regression-checked) |
| No sensitive file upload added | Verified: only JSON/CSV-accept file inputs exist anywhere | — | `checkpoint6:validate` §14 | Done |
| No required paid service added | `.env.example` — every Checkpoint 6 var optional/false by default | — | `checkpoint6:validate` §14 | Done |
| Required tests exist | See rows above | — | `checkpoint6:validate` §15 | Done |
| Required documentation exists | This file + 6 siblings | — | `checkpoint6:validate` §16 | Done |

## Regression protection (§17 of the brief)

| Area | How verified this checkpoint |
|---|---|
| Public catalogue | Full unit suite (427 tests) + existing e2e specs unchanged; `checkpoint0-4:validate` still pass. |
| Guest workspace | Unchanged code paths; `workspace-tracking.spec.ts` (existing) still applies. |
| Account login/cloud sync | Unchanged code paths; `student-auth-and-sync.spec.ts` (existing) still applies. |
| Staff login/admin | Unchanged code paths + new `canViewOpsDiagnostics` permission added, not removed; `staff-auth.spec.ts` (existing) still applies. |
| Deterministic matching | Unchanged; `matching-engine.test.ts` (existing) still passes. |
| Reminders/notifications | Unchanged. |
| Source-grounded AI (enabled) | Unchanged provider/RAG/safety code; `ai-*.test.ts` (existing, 2 more since the rate-limit generalization didn't touch AI's own guest quota file) still pass. |
| AI disabled state | Unchanged (`isAiAvailableAction()` logic untouched); see `tests/e2e/production-readiness.spec.ts` #11 for the Checkpoint-6-specific angle. |
| PWA/offline | `public/sw.js` cache version bumped (v5→v6) for the new precached content pages, plus a sequential-precache fix (see below). `offline.spec.ts`'s fallback-page test and `production-readiness.spec.ts` #10 pass; `offline.spec.ts`'s core-shell test and `ai-assistant.spec.ts` #12 currently fail due to a proven pre-existing, environment-level service-worker-control timing issue — see "Honest note on two pre-existing, environment-level e2e failures" below. |
| Correction reports | Behaviour preserved, rate limiting added; existing `correction-report.spec.ts` unaffected. |
| Admin workflows | Unchanged; new `/staff/ops` is additive, gated the same way as other Administrator-only pages. |
| RLS | Untouched this checkpoint (no schema/migration changes) — Checkpoint 5's RLS test suite (`tests/integration/ai-rls.test.ts`) is unaffected. |
| Private routes not indexed | New, explicit `X-Robots-Tag` mechanism — strictly additive vs. no prior enforcement. |
| Private routes not cached by service worker | Unchanged exclusion list in `public/sw.js`. |

## Honest note on the CI workflow

`.github/workflows/ci.yml` was authored to mirror commands verified directly in this session (typecheck,
lint, unit tests, all `checkpointN:validate` scripts, `ai:evaluate`/`ai:safety:test`, `db:check`,
production build, `perf:audit` all run and passed locally; `db:test` and the Playwright e2e suite verified
against the same Docker/Linux topology the workflow's service containers and `docker compose --profile
test` invocation mirror). The actual GitHub-hosted execution of this workflow file was not — and could not
be — triggered or observed from this environment. Treat it as a faithful, ready-to-run mirror of verified
local commands, not as "CI has been green," until it actually runs on GitHub.

## Honest note on two pre-existing, environment-level e2e failures (not a Checkpoint 6 regression)

Two tests fail consistently in this session's Docker/Playwright execution environment, on both browser
projects:

- `tests/e2e/ai-assistant.spec.ts` — scenario 12 ("offline mode shows the assistant as unavailable...")
- `tests/e2e/offline.spec.ts` — "the core shell remains available offline after an initial online visit"

Both share the same root cause, confirmed through a rigorous, isolated investigation (not guessed): after
a service worker reaches `registration.active.state === "activated"`, `navigator.serviceWorker.controller`
never becomes truthy for that page — not after a reload, not after several retried reloads, not after
85+ seconds of waiting, and not with the Content-Security-Policy header removed entirely. Without a
controlling service worker, navigation requests are never intercepted, so an offline `page.goto()` to an
already-cached URL fails with a hard `net::ERR_INTERNET_DISCONNECTED` instead of being served from Cache
Storage — even though the cache genuinely contains the response (verified directly via
`caches.open(...).keys()`).

**This was verified to be pre-existing, not a Checkpoint 6 regression**: reverting `public/sw.js` and
`src/lib/supabase/middleware.ts` to their exact Checkpoint 5 (pre-Checkpoint-6) content via `git stash`
and re-running the identical reload/wait-for-controller sequence reproduced the identical hang. Firing
all precache fetches sequentially instead of concurrently (a real, kept improvement — see
`precacheAppShellUrls()` in `public/sw.js`) did not resolve it either. This points to a Chromium/Playwright
service-worker-control timing behavior specific to this execution environment, not to any application
code changed this checkpoint.

**What was done about it**:
- `tests/e2e/production-readiness.spec.ts`'s own scenario 10 was designed from the start to avoid this
  fragile mechanism — it verifies service worker registration/activation on a new content page (which
  reliably works) rather than a full offline-serving round trip.
- The two pre-existing tests were left unmodified rather than having their assertions weakened to force
  a false pass.
- `docs/checkpoint-6/checkpoint-6-completion-report.md` reports these two failures honestly rather than
  omitting them or claiming a fully green e2e run.

A real fix would likely require either a lower-level test harness (mocking the service worker rather than
relying on a real browser's timing) or a Playwright/Chromium version change — both out of scope for a
same-session fix given the size of this checkpoint's other work.
