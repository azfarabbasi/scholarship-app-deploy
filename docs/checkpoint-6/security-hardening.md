# Checkpoint 6: Security hardening

## Headers

| Header | Where set | Notes |
|---|---|---|
| `X-Content-Type-Options: nosniff` | `next.config.ts` | All routes. |
| `X-Frame-Options: DENY` | `next.config.ts` | Belt-and-suspenders alongside `frame-ancestors 'none'` in the CSP, for older browsers. |
| `Referrer-Policy: strict-origin-when-cross-origin` | `next.config.ts` | All routes. |
| `Permissions-Policy` | `next.config.ts` | Denies camera/microphone/geolocation/payment/USB/interest-cohort (FLoC) by default. |
| `Content-Security-Policy` | `src/lib/supabase/middleware.ts` (per request) | Nonce-based `script-src`; see below. |
| `Strict-Transport-Security` | `src/lib/supabase/middleware.ts` (production only) | `max-age=63072000; includeSubDomains` (2 years). |
| `X-Robots-Tag: noindex, nofollow` | `src/lib/supabase/middleware.ts` | `/staff`, `/account`, `/auth`, `/api`, `/assistant/history`, `/assistant/settings`, `/workspace`. |
| `Cache-Control` | `src/lib/supabase/middleware.ts` | Unchanged Checkpoint 4/5 logic, plus a new `public, max-age=300, stale-while-revalidate=86400` rule for the twelve static content pages. |

## Content-Security-Policy

Built by `src/lib/security/csp.ts`. Default (analytics/ads both disabled):

```
default-src 'self';
script-src 'self' 'nonce-<random>' 'strict-dynamic';
style-src 'self' 'unsafe-inline';
img-src 'self' blob: data:;
font-src 'self' data:;
connect-src 'self' [+ Supabase origin, if configured];
worker-src 'self';
manifest-src 'self';
object-src 'none';
base-uri 'self';
form-action 'self';
frame-ancestors 'none';
frame-src 'none';
[+ upgrade-insecure-requests in production]
```

### Documented exceptions

- **`style-src 'unsafe-inline'`**: Radix UI (`@radix-ui/react-dialog`, `@radix-ui/react-tooltip`) sets
  inline `style` properties via the CSSOM for floating-element positioning. The CSP nonce/hash exception
  mechanism does not apply to the `style` HTML attribute at all — only `'unsafe-inline'` unlocks it, with
  no alternative. Next.js's own reference CSP example makes the same trade-off. Inline-style injection is
  a materially lower-severity primitive than inline script execution (no code execution, at most CSS-based
  data exfiltration or minor UI redress).
- **Supabase origin in `connect-src`**: `@supabase/ssr`'s browser client calls the Supabase Auth REST API
  directly from the browser for sign-in/sign-up — this must remain reachable. No other browser-side
  Supabase query exists anywhere in the app (every catalogue/staff read and write goes through this
  Next.js server's own privileged database connection — see
  [Checkpoint 2 architecture §4](../checkpoint-2/checkpoint-2-architecture.md#4-serverclient-boundaries-and-the-rls-design-decision)).
- **Cloudflare Web Analytics hosts**: only added to `script-src`/`connect-src` when
  `isAnalyticsConfigured()` is true (both `NEXT_PUBLIC_ANALYTICS_ENABLED=true` and a token configured).
- **AdSense hosts**: only added to `script-src`/`connect-src`/`img-src`/`frame-src` when
  `isAdsConfigured()` is true.
- **PWA (`sw.js`)**: not covered by the nonce-based CSP at all — `middleware.ts`'s matcher excludes
  `sw.js`/`manifest.webmanifest`/icons/`_next/static`/`_next/image` from per-request processing (a static
  per-request nonce embedded in a cacheable script response would be a stale/meaningless nonce anyway).
  These paths still get the baseline headers from `next.config.ts`.

## Secret handling

- `src/lib/env.ts` keeps the existing public/server-only schema split; every Checkpoint 6 addition
  (`SENTRY_DSN`, `SECURITY_CONTACT_EMAIL`, `SUPPORT_EMAIL`, `APP_ENV`) follows it — none are ever
  `NEXT_PUBLIC_`-prefixed.
- `npm run security:secrets` (`scripts/security-secrets-scan.ts`) scans every git-tracked-or-untracked-
  but-not-ignored file (via `git ls-files --cached --others --exclude-standard`, so a developer's real
  local `.env`/`.env.local` — which is *supposed* to hold real credentials — is never scanned or flagged)
  for Supabase secret keys, legacy JWT-shaped tokens, Groq keys, PEM private key blocks, and PostgreSQL
  connection strings with embedded credentials, plus a structural check that no `NEXT_PUBLIC_*` variable
  name looks like it's meant to carry a secret.
- `.gitignore` already excludes `.env`, `.env.local`, and `.env*.local`; the scanner double-checks this
  with `git ls-files` directly rather than trusting the text pattern alone.

## Auth route protection

Unchanged from Checkpoints 2/3: `middleware.ts` redirects an unauthenticated visitor away from
`/staff/**`/`/account/**`, and every Server Action/Route Handler independently re-verifies the session
server-side — middleware is a UX convenience, never the sole authorization boundary. Checkpoint 6 adds one
new gate: `canViewOpsDiagnostics()` (Administrator-only) for `/staff/ops`.

## Private cache rules

No change to the Checkpoint 4/5 `Cache-Control` model for session-aware pages
(`SESSION_AWARE_PUBLIC_PREFIXES`) or the `/assistant` family (`ALWAYS_NO_STORE_PREFIXES`) — see those
checkpoints' architecture docs. New this checkpoint: `PUBLIC_STATIC_CONTENT_PREFIXES`, a `public,
max-age=300, stale-while-revalidate=86400` rule for pages with genuinely zero session-dependent content.

## Service-worker exclusions

Unchanged: `/staff/**`, `/api/staff/**`, `/account/**`, `/api/account/**`, `/auth/**` are never
intercepted or cached by `public/sw.js`. The twelve new static content pages ARE added to
`APP_SHELL_URLS` (precached) — safe because `isCacheable()` still checks for `no-store`/`private`, and
these pages never carry either header regardless of sign-in state.

## Rate limits

| Surface | Mechanism |
|---|---|
| AI assistant | Guest: signed cookie (Checkpoint 5). Signed-in: DB counter (Checkpoint 5). Unchanged. |
| Correction reports | New: signed cookie, 20/day per browser (`src/lib/security/cookie-rate-limit.ts`). |
| CSV import | Already staff-session + `canRunImports()`-gated — not anonymously exploitable. |
| Auth (login/signup) | Delegated to Supabase Auth's own built-in rate limiting — not reimplemented here. |

## Incident response basics

See `docs/checkpoint-6/backup-and-recovery.md` §9 for the full checklist. Summary: identify scope → for
an AI-specific incident, use the `/staff/ai` kill switch immediately (no redeploy) → for a broader issue,
roll back the deployment → communicate via `/security`/`/contact` → fix, re-run the full validator suite,
redeploy → record via the append-only audit log.
