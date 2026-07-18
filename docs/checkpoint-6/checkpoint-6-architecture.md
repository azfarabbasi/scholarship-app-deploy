# Checkpoint 6 architecture: production readiness

Checkpoint 6 prepares ScholarTrack for a real deployment without changing any existing feature's
behaviour. Nothing here weakens guest mode, RLS, the deterministic matching engine, or the source-grounded
AI assistant — it hardens the edges around all of them: headers, SEO, observability, analytics/ads
readiness, and operational documentation.

## 1. Security hardening

### 1.1 Two layers of headers

- **`next.config.ts`'s `headers()`** sets baseline, static headers on every response, including the
  handful of paths `middleware.ts` deliberately skips (`_next/static`, `_next/image`, `favicon.ico`,
  `sw.js`, `manifest.webmanifest`, icons — see the matcher in `middleware.ts`): `X-Content-Type-Options`,
  `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`.
- **`src/lib/supabase/middleware.ts`** sets everything that needs a fresh value or a runtime check per
  request: the nonce-based `Content-Security-Policy` (§1.2), `Strict-Transport-Security` (production
  only), `X-Robots-Tag: noindex` for private routes, and the existing `Cache-Control` logic from
  Checkpoints 4/5.

### 1.2 Nonce-based CSP

`src/lib/security/csp.ts` builds a `script-src 'self' 'nonce-<random>' 'strict-dynamic'` policy — the
pattern Next.js's own documentation recommends for the App Router, rather than a blanket
`'unsafe-inline'`. A fresh nonce is generated per request in `updateSupabaseSession()`, threaded through
as an `x-nonce` request header, read in `app/layout.tsx` via `next/headers`, and passed to `next-themes`'
blocking pre-hydration script (the one legitimate inline script this app needs) and to every
`<JsonLd />` structured-data block (`src/components/common/JsonLd.tsx`).

`style-src` keeps `'unsafe-inline'` as a **deliberate, documented exception** — Radix UI's dialog/tooltip
positioning sets inline `style` properties via the CSSOM for floating-element placement, and the CSP
nonce/hash exception mechanism does not apply to the `style` attribute at all (only to `<style>`/`<link>`
elements). This is the same trade-off Next.js's own reference CSP example makes, and inline-style
injection is a materially lower-severity primitive than inline script execution.

**Trade-off, documented honestly**: reading the nonce via `headers()` in the root layout forces every
route in the app onto dynamic (per-request) rendering under Next.js's current (non-PPR) rendering model —
there is no way to keep some routes statically pre-rendered while using a per-request nonce elsewhere in
the same render tree. In practice this cost was already near-zero: every existing page either reads
cookies via `getStudentSession()`/`getStaffSession()` or fetches live database state, and was therefore
already dynamically rendered before this checkpoint. The twelve new static content pages added this
checkpoint (§3) are the only routes that lose build-time HTML generation as a direct result — mitigated
with a real, revalidating `Cache-Control: public, max-age=300, stale-while-revalidate=86400` header
(`PUBLIC_STATIC_CONTENT_PREFIXES` in `middleware.ts`), which recovers most of the practical CDN/browser
caching benefit even though the origin still renders them per request.

### 1.3 CSP exceptions for optional integrations

`buildContentSecurityPolicy()` only widens `script-src`/`connect-src`/`img-src`/`frame-src` when a feature
is **actually enabled and configured** — never unconditionally:

- Cloudflare Web Analytics (`static.cloudflareinsights.com`, `cloudflareinsights.com`) only when
  `isAnalyticsConfigured()` is true.
- Google AdSense (`*.googlesyndication.com`, `*.doubleclick.net`, `*.gstatic.com`) only when
  `isAdsConfigured()` is true.
- The Supabase project origin is always included in `connect-src` when a Supabase URL is configured —
  `@supabase/ssr`'s browser client calls the Auth REST endpoint directly from the browser for sign-in/
  sign-up, and this must not be blocked.

### 1.4 Rate limiting

`src/lib/security/cookie-rate-limit.ts` generalizes the Checkpoint 5 AI guest-quota pattern (a signed,
httpOnly, per-scope daily counter cookie — never an IP/anonymous-device table) into a reusable module. It
now also guards `POST /api/correction-reports` — previously the one genuinely unauthenticated, unthrottled
public write endpoint. CSV import and staff actions were already staff-session-gated (not anonymously
exploitable); Supabase Auth's own built-in rate limits cover login/signup attempts.

## 2. Observability

- `/api/health` (Checkpoint 2, unchanged) — liveness only.
- `/api/ready` (new) — a real readiness check: live database query, AI provider configuration summary
  (enabled/provider/available — never a key).
- `/api/version` (new) — app name/version/checkpoint/environment name only.
- `/staff/ops` (new, Administrator-only via `canViewOpsDiagnostics`) — the same signals as above plus
  staff-admin configuration status, in a human-readable table.
- `app/error.tsx` / `app/global-error.tsx` — route-level and root-layout-level error boundaries. Both show
  a safe, generic message; `app/error.tsx` additionally surfaces Next's own `error.digest` as a
  reference id (a stable hash Next computes server-side for server errors) rather than generating one
  client-side, which would have required an impure `Date.now()`/`Math.random()` call during render (this
  project's stricter React Compiler ESLint rules reject that pattern outright).
- `src/lib/observability/logger.ts` — a single `reportError()`/`generateErrorReferenceId()` chokepoint for
  server-side error logging. `SENTRY_DSN` is read directly (never through the throwing `getServerEnv()`)
  and, if set, only logs that a real reporter SDK isn't wired in yet — no Sentry dependency was added
  this checkpoint (see §6 for why).

## 3. SEO architecture

- `src/lib/seo/metadata.ts`'s `buildMetadata()` is the single source of Open Graph/Twitter/canonical
  metadata for every public page — used instead of relying on Next's metadata inheritance, because nested
  fields like `openGraph` are replaced wholesale by a child segment that defines them, not deep-merged.
- `app/sitemap.ts` / `app/robots.ts` use Next's metadata-route file conventions. The sitemap's dynamic
  entries come from `getPublishedOpportunities()` — the exact query the public catalogue itself uses, so a
  draft/in-review/archived record structurally cannot appear.
- `src/lib/supabase/middleware.ts`'s `NOINDEX_PREFIXES` is the single enforcement point for private-route
  noindexing (`X-Robots-Tag` header) — `app/robots.ts`'s `disallow` list and `app/sitemap.ts`'s exclusions
  are both kept in sync with it (checked by `npm run seo:validate`).
- Twelve new public content pages (§ below) plus structured data: `WebSite`+`Organization`+`SearchAction`
  on the homepage, `BreadcrumbList`+`EducationalOccupationalProgram` on the opportunity detail page (the
  latter only ever asserts `applicationDeadline` when `evaluateDeadline().countdown.allowed` is true — the
  same verified+exact gate the on-page countdown itself uses), and `FAQPage` on `/faq`.

New public pages: `/about`, `/methodology`, `/terms`, `/disclaimer`, `/contact`, `/faq`, `/status`,
`/security`, `/accessibility`, `/advertising-policy`, `/data-sources`, `/verification-policy`.

## 4. Analytics architecture

`src/lib/analytics/index.ts` is disabled by default and honest about what its one supported provider
(Cloudflare Web Analytics — chosen for ADR-008's free-first budget) actually does: it's a passive
page-view/Core-Web-Vitals beacon with **no custom-event API**. `trackEvent()` therefore remains a safe,
fully-testable no-op for every provider today, called from real sites across the app (PWA install
prompt/installed, correction-report opened/submitted, AI answer feedback category, page views) so the
call-site shape is already correct for a future custom-event-capable provider (e.g. a self-hosted
Plausible/Umami instance) without touching those call sites again. See
`docs/checkpoint-6/analytics-and-ads-policy.md` for the full event inventory and privacy rules.

## 5. Ads architecture

`src/components/ads/AdSlot.tsx` renders nothing at all unless `isAdsConfigured()` is true, and even then
self-excludes on `/auth`, `/account`, `/staff`, `/privacy`, `/security`, `/assistant` regardless of where a
developer places it — a defense-in-depth check on top of simply not placing the component there. It is a
structural placeholder (no live AdSense `<ins>` unit, no publisher slot ID) — this checkpoint delivers ad
*readiness*, not a functioning AdSense integration, since that requires a real, approved publisher account
this project does not have. See `docs/checkpoint-6/analytics-and-ads-policy.md`.

## 6. Why no Sentry/bundle-analyzer dependency was added

Per PROJECT_RULES.md's implicit "don't add heavy tooling unless justified" spirit (made explicit in the
checkpoint brief for performance tooling specifically): a real Sentry SDK integration and a full
`@next/bundle-analyzer` setup are both real, non-trivial dependencies with their own configuration
surface. Instead:

- Error reporting: `src/lib/observability/logger.ts` is a complete *abstraction* (single chokepoint,
  reference IDs, DSN-gated) with a documented drop-in point for a real SDK later — never a call site
  needs to change when one is added.
- Performance budget: `scripts/perf-audit.ts` measures real `.next/static/chunks` output directly (Next
  16's Turbopack build no longer prints a per-route size table to stdout the way the older webpack builder
  did) rather than adding a bundle-analyzer dependency.

## 7. Deployment target assumptions

See `docs/checkpoint-6/production-deployment-runbook.md` §1 for the full reasoning: Cloudflare Pages is
**not** a clean fit without a real migration (edge-only runtime, a different Postgres driver, re-auditing
every `node:crypto` call) — a Node.js-runtime-friendly free-tier host (Render, Fly.io) or the existing
`docker-compose.yml` topology self-hosted is the recommended, honest alternative. Nothing in the
application code assumes any specific provider.
