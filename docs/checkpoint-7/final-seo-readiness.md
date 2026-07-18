# Checkpoint 7: Final SEO readiness

Verified via `npm run launch:seo` (= `npm run seo:validate`) — real run this session: **61/61
checks passed**. Full architectural detail: `docs/checkpoint-6/seo-and-content-strategy.md`.

## Checklist

| Item | Status | Evidence |
|---|---|---|
| Sitemap exists | ✅ | `app/sitemap.ts` → `/sitemap.xml`, confirmed reachable in the production build. |
| robots.txt exists | ✅ | `app/robots.ts` → `/robots.txt`. |
| Canonical URLs exist | ✅ | `buildMetadata()` sets `alternates.canonical` on every public page. |
| Public pages indexable | ✅ | No noindex header/meta on `/`, `/opportunities`, `/opportunities/[slug]`, `/assistant`, and all twelve content pages. |
| Private pages noindex | ✅ | `middleware.ts`'s `X-Robots-Tag: noindex` for `/staff`, `/account`, `/auth`, `/api`, `/assistant/history`, `/assistant/settings`, `/workspace`. |
| Staff/account/auth pages excluded from sitemap | ✅ | `app/sitemap.ts`'s static route list is manually curated and kept in sync with `NOINDEX_PREFIXES` (checked by `seo:validate`). |
| Opportunity pages have metadata | ✅ | `generateMetadata()` in `app/opportunities/[slug]/page.tsx` — title, description, canonical, Open Graph, `EducationalOccupationalProgram` structured data. |
| Structured data is accurate | ✅ | `applicationDeadline` is only ever asserted when `evaluateDeadline().countdown.allowed` is true (verified + exact) — never an estimated/rolling/unknown date. Confirmed unchanged since Checkpoint 6. |
| Social metadata works | ✅ | Open Graph + Twitter card via `buildMetadata()`. |
| Status/health endpoints do not leak internals | ✅ | `/api/health`, `/api/ready`, `/api/version` all checked programmatically (`production-readiness.spec.ts` #6) to never contain a secret-shaped string. |
| Draft/unpublished opportunities not in sitemap | ✅ | `app/sitemap.ts` sources entries from `getPublishedOpportunities()` — the exact query the public catalogue itself uses; there is no "all opportunities" query available to use by mistake. |

## What's new this checkpoint

Nothing structural changed — this is a re-verification pass. `npm run launch:seo` gives the SEO
check a launch-specific entry point alongside the existing `seo:validate`, for use in the launch
day checklist (`docs/checkpoint-7/production-deployment-runbook.md` §4).
