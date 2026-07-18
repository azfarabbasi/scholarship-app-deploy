# Checkpoint 6: Manual QA

Exact manual tests to run after any change touching production-readiness surfaces. Automated coverage
exists for most of these (see `checkpoint-6-traceability.md`); this document is for a human sanity pass
before a real deployment.

## SEO

1. Visit `/sitemap.xml` — confirm it lists the static public routes plus one entry per published
   opportunity, and **no** `/staff`, `/account`, `/auth`, `/workspace`, or unpublished-opportunity URL.
2. Visit `/robots.txt` — confirm `Disallow: /staff`, `/account`, `/auth`, `/api`, `/assistant/history`,
   `/assistant/settings`, `/workspace`, and a `Sitemap:` line pointing at the real domain.
3. View source on `/` — confirm `<title>`, `<meta name="description">`, `<link rel="canonical">`,
   `og:title`/`og:description`/`og:image`, and `twitter:card` are all present and correct.
4. View source on an opportunity detail page — confirm a `<script type="application/ld+json">` block
   parses as valid JSON containing `BreadcrumbList` and `EducationalOccupationalProgram`.
5. Visit `/faq` — confirm the JSON-LD `FAQPage` block's questions match what's actually rendered on the
   page.

## Security headers

1. Open browser DevTools → Network → reload `/` → check Response Headers for `Content-Security-Policy`,
   `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`.
2. In a production deployment (`APP_ENV=production`), confirm `Strict-Transport-Security` is present; in
   local dev, confirm it is **absent** (HSTS on `http://localhost` would be actively harmful).
3. Try loading `/` inside an `<iframe>` from a different origin — confirm the browser refuses (clickjacking
   protection).
4. Confirm `next-themes`' theme toggle still works with no browser console CSP violation.

## Auth / private noindex

1. Fetch `/staff` and `/account` with `curl -I` (or DevTools Network) — confirm both responses carry
   `X-Robots-Tag: noindex, nofollow`.
2. Visit `/staff` while signed out — redirected to `/staff/login`. Visit `/account` while signed out —
   redirected to `/auth/login`.

## Analytics disabled

1. With `.env.local` unset (or `NEXT_PUBLIC_ANALYTICS_ENABLED=false`), open DevTools → Network, browse the
   app for a minute — confirm no request to `cloudflareinsights.com` or any analytics host.
2. Set `NEXT_PUBLIC_ANALYTICS_ENABLED=true` with no token — confirm still no script loads and nothing
   breaks (degrades gracefully).

## Ads disabled

1. With `NEXT_PUBLIC_ADS_ENABLED=false` (the default), browse `/opportunities`, `/faq`, and the footer on
   any page — confirm no element with `aria-label="Advertisement"` exists anywhere (`grep`-friendly:
   search rendered HTML for `Advertisement`).
2. Set `NEXT_PUBLIC_ADS_ENABLED=true` with no provider — confirm still no ad slot renders (requires full
   configuration, not just the flag).

## Health endpoints

1. `curl http://localhost:3000/api/health` — `200`, `status: "ok"`, no secret-shaped value in the body.
2. `curl http://localhost:3000/api/ready` — `200` when the database is reachable, `503` when it isn't
   (test by stopping the `db` container and retrying).
3. `curl http://localhost:3000/api/version` — confirm `version`/`checkpoint`/`appEnv`, nothing else.

## Error boundaries

1. Temporarily throw inside a page component (e.g. `throw new Error("test")` in a scratch branch) —
   confirm `app/error.tsx`'s safe message renders, with a `try again` button, never a raw stack trace.
2. Confirm the browser console still logs the real error (developer-visible, never user-visible).

## Performance

1. Run `npm run perf:audit` — confirm it reports total client JS size and the largest chunks, and exits
   `0` when within budget.
2. Spot-check `/opportunities` and `/` load quickly on a throttled (Slow 3G, DevTools) connection —
   nothing should visibly block on an unconfigured optional integration (AI, analytics, ads).

## Accessibility

1. Run `npm run accessibility:test` — confirm it passes.
2. Tab through `/about` with the keyboard only — confirm every footer link, including the twelve new
   pages, is reachable and visibly focused.
3. Open the correction-report dialog on an opportunity page, press Escape, confirm focus returns to the
   trigger button.
4. Enable OS-level reduced motion, reload `/` — confirm no jarring animation and the page still renders
   correctly.

## PWA / offline

1. Build and run production (`npm run build && npm run start`), visit `/`, `/opportunities`, and one of
   the new content pages (e.g. `/about`) once online.
2. Go offline (DevTools → Network → Offline), reload each — all three should still render from cache.
3. Confirm `/staff` and `/account` are **not** available offline (honest failure, not a stale privileged
   page).

## Public catalogue / account / staff / AI regression

1. `/opportunities` still lists the full published catalogue with working filters/search/sort.
2. Sign up/sign in as a student, confirm cloud sync still works (`/account/sync`).
3. Sign in as staff, confirm the dashboard, review queue, and `/staff/ops` (Administrator only) all load.
4. With `AI_ENABLED=true AI_PROVIDER=mock`, ask the assistant a question — confirm a cited answer.
5. With `AI_ENABLED=false`, confirm `/assistant` shows the graceful unavailable state and every other page
   still works normally.

## Mobile

1. At 375px width, visit each of the twelve new content pages and the footer — confirm no horizontal
   scroll and all links/buttons meet a reasonable touch-target size.
