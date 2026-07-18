# Checkpoint 6: SEO and content strategy

## Sitemap

`app/sitemap.ts` (Next's metadata-route convention → served at `/sitemap.xml`). Two sources:

1. A fixed list of static public routes (home, catalogue, discovery tools, the twelve new content pages,
   `/auth/login`/`/auth/signup` are **excluded** — see noindex rules below).
2. Every `published` opportunity, from `getPublishedOpportunities()` — the exact same query the public
   catalogue itself uses. A draft, in-review, or archived record cannot appear here; there is no separate
   "all opportunities" query available to accidentally use instead.

If the database is unreachable or unconfigured, the sitemap still returns the static route list rather
than failing outright (`isDatabaseConfigured()` gate, matching the rest of the app's degrade-gracefully
pattern).

## Robots

`app/robots.ts` (→ `/robots.txt`). `disallow` list is kept in exact sync with `NOINDEX_PREFIXES` in
`src/lib/supabase/middleware.ts` (checked by `npm run seo:validate`) — the header (`X-Robots-Tag`) is the
actual enforcement mechanism (works even against a crawler that ignores `robots.txt`); the file is the
courtesy signal well-behaved crawlers check first.

## Metadata

`src/lib/seo/metadata.ts`'s `buildMetadata({ title, description, path, ogType })` is used by every public
page instead of relying on Next's per-segment metadata inheritance, because Next replaces a nested field
like `openGraph` wholesale when a child segment defines it at all (not a deep merge) — a page that set
only `title`/`description` in its own `openGraph` would silently lose the parent's image/site name. Every
call site gets a full, correct Open Graph + Twitter card + canonical URL.

## Structured data

| Page | Type(s) | Notes |
|---|---|---|
| `/` | `WebSite`, `Organization`, `SearchAction` | `SearchAction.target` points at `/opportunities?q={search_term_string}` — confirmed `q` is the real query param `CatalogueExplorer` reads. |
| `/opportunities` | `BreadcrumbList` | Home → Opportunities. |
| `/opportunities/[slug]` | `BreadcrumbList`, `EducationalOccupationalProgram` | See below. |
| `/faq` | `FAQPage` | Built from the same array of real Q&A rendered on the page — never markup describing content that isn't actually shown. |

`EducationalOccupationalProgram` on the opportunity detail page only ever includes fields the public
catalogue already displays and treats as fact (`name`, `description`, `provider`, `url`). Critically,
`applicationDeadline` is included **only when `evaluateDeadline().countdown.allowed` is true** — the exact
same verified-and-exact gate the on-page countdown itself uses (see
[Checkpoint 0 deadline intelligence spec](../checkpoint-0/deadline-intelligence-spec.md)). An estimated,
rolling, or unverified deadline is never asserted as a firm date to a search engine, mirroring the
product's existing discipline about never presenting a guess as a fact.

Every JSON-LD block renders through `src/components/common/JsonLd.tsx`, which carries the same
per-request CSP nonce as every other script on the page (see
`docs/checkpoint-6/security-hardening.md`) — without it, the strict `script-src` would silently block the
structured data from ever executing/parsing as JSON-LD.

## Canonical URLs

Every `buildMetadata()` call sets `alternates.canonical` to the page's own site-relative path — resolved
against `metadataBase` (`getAppBaseUrl()`, from `NEXT_PUBLIC_APP_URL`) by Next automatically.

## Noindex rules

Enforced once, centrally, via `X-Robots-Tag` in `src/lib/supabase/middleware.ts`'s `NOINDEX_PREFIXES`
— not per-page `metadata.robots`, so a new page added under `/staff`, `/account`, `/auth`, `/api`,
`/assistant/history`, `/assistant/settings`, or `/workspace` is noindexed automatically rather than
requiring every individual page author to remember to opt in. The one exception:
`app/opportunities/[slug]/page.tsx`'s `generateMetadata()` returns `robots: { index: false, follow: false
}` directly for a slug that resolves to nothing (a 404-shaped page has no canonical content to index).

Deliberately **not** noindexed: `/assistant` (a real, indexable feature page), `/opportunities`,
`/eligibility`, `/notifications`, `/compare`, `/calendar`, `/settings` (public tool pages that render
session-aware content for a signed-in visitor, but show the identical generic version to any crawler,
which never carries a session cookie).

## Public content pages

Twelve new pages, each built through `buildMetadata()`: `/about`, `/methodology`, `/terms`,
`/disclaimer`, `/contact`, `/faq`, `/status`, `/security`, `/accessibility`, `/advertising-policy`,
`/data-sources`, `/verification-policy`. Linked from the footer (`src/components/layout/Footer.tsx`) on
every page for real discoverability, not just sitemap presence.

## Opportunity page SEO

Title = opportunity title, description = the first 155 characters of `benefitSummary`, `ogType:
"article"` (vs. `"website"` for the rest of the app), canonical = `/opportunities/{slug}`. A slug that
resolves to nothing gets `robots: { index: false }` rather than a genuinely public 404 competing for
search visibility.
