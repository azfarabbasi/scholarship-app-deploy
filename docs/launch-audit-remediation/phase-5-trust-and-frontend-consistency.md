# Launch audit remediation — Phase 5: trust and frontend consistency

Fixes every Phase 5 item from the launch-blocker audit: derives the opportunity
verification badge from the real, opportunity-level verification status instead of an
unrelated deadline-only flag; finishes the blue→green PWA/icon rebrand that Phase 5's own
discovery found still incomplete; fixes a genuine (and previously invisible) responsive
overflow bug in the site header; and corrects workspace-assistant copy that understated
what data reaches Scholarly. Two of these four were **not** cosmetic — both the
verification-badge mismatch and the header overflow were real, user-facing defects that
existing tests never caught, for reasons documented below.

## Every changed file

**New:**
- `tests/e2e/header-responsive.spec.ts` — three tests proving the header fix: below `lg`
  everything but the hamburger is hidden with no overflow (and the hamburger dropdown
  still reaches Account/Staff portal/Theme); at `lg` the full nav plus an icon-only
  Account/Staff-portal/Theme cluster fit with no overflow; at `xl` the full text labels
  appear without wrapping. Uses real element bounding boxes throughout, never
  `document.documentElement.scrollWidth` — see "the header bug" below for why that check
  cannot catch this class of regression in this codebase.

**Modified:**
- `src/components/layout/Header.tsx` — the nav/hamburger breakpoint moved from `md`
  (768px) to `lg` (1024px), matching where the account/staff-portal/theme cluster
  actually fits; Account and Staff-portal links now show icon-only from `lg` and their
  full text label only at `xl` (1280px); their visibility now lives on a **wrapping**
  `<div className="hidden lg:block">` around each link (matching the pre-existing,
  correct `ThemeToggle` pattern) instead of combining `hidden`/`lg:inline-flex` directly
  on the same element as `buttonClasses()` — see "the header bug" below for why that
  combination silently never worked at all.
- `src/components/ui/Button.tsx` — `buttonClasses()`'s base classes now include
  `whitespace-nowrap`, so a button's label can never wrap into a second line inside its
  fixed-height container regardless of where it's used.
- `app/manifest.ts`, `app/icon.tsx`, `app/apple-icon.tsx`, `app/icon-192.png/route.tsx`,
  `app/icon-512.png/route.tsx`, `app/icon-512-maskable.png/route.tsx` — the last six
  places still hard-coding the pre-rebrand blue (`#185ada`) now use the current brand
  green (`#047857`).
- `tests/unit/theme-tokens.test.ts` — extended with a `PWA manifest and icons` block that
  reads all six files above directly and asserts the old blue hex codes never reappear
  and the current green one is present — closing the exact gap that let the icons drift
  out of sync with `globals.css` undetected (see below).
- `src/components/opportunities/badges.tsx` — `VerificationBadge` now takes the
  opportunity's real `status: OverallVerificationStatus` instead of the deadline's own
  `verificationRequired` flag, and renders all four real states (`verified` →
  "Officially reviewed", `partially_verified` → "Partially reviewed by staff", `stale` →
  "Verified previously — due for recheck", `unverified` → "Not officially verified yet")
  instead of a lossy true/false collapse of an unrelated signal — see "the verification
  badge bug" below.
- `src/components/opportunities/OpportunityCard.tsx`,
  `src/components/opportunities/OpportunityDetailBody.tsx` (two call sites) — updated to
  pass `opportunity.verification.status` to `VerificationBadge` instead of
  `evaluation.verificationRequired`.
- `app/workspace/assistant/page.tsx` — corrected copy that claimed Scholarly receives
  "only public deadline, funding, and eligibility data" for tracked opportunities; it also
  receives a deterministic match result (fit label, confidence, and matched-signal counts)
  derived from the student's own eligibility answers and preferences — never those raw
  answers themselves, but not "only public data" either. See "the Scholarly copy bug"
  below.

## The verification badge bug

`VerificationBadge` (the "Officially reviewed" / "Not officially verified yet" pill shown
on every opportunity card and detail page) was wired to
`evaluation.verificationRequired` — a flag computed entirely inside
`src/lib/deadlines/engine.ts` from the **deadline's own** verification state (is this
specific date fact stale, estimated, unverified, conflicting). It has nothing to do with
whether the opportunity as a whole ever passed staff review with a confirmed-official
source — a genuinely separate concept the codebase already models correctly as
`CatalogueOpportunity.verification.status` (`OverallVerificationStatus`, sourced from
`opportunities.overall_verification_status` in the database), and already renders
correctly elsewhere on the very same detail page (the "Verification" section's
`VERIFICATION_STATUS_LABELS`, a few lines below the badge).

The practical effect: an opportunity with a fully staff-reviewed, confirmed-official
source could show "Not officially verified yet" if its deadline happened to be entered as
stale, and an opportunity that was never reviewed at all could show "Officially reviewed"
if its deadline happened to be independently marked verified — sometimes directly
contradicting the accurate "Verification" section rendered on the same page. This is
exactly the "wording doesn't match real state" failure Phase 5 targets, and it predates
this phase entirely (nothing in Phases 1–4 touched this component). Fixed by feeding the
badge the opportunity's own `verification.status` and rendering all four real states
distinctly instead of collapsing them into an unrelated boolean.

## The header bug

Two independent, compounding bugs, both found by rendering the header in a real browser
across a full width sweep (320px–1920px) and measuring actual element bounding boxes —
neither is visible from source reading alone, and neither was ever caught by the
existing `mobile-nav.spec.ts` overflow check, which asserts
`document.documentElement.scrollWidth <= viewportWidth + 1`. That check is silently
defeated by this app's own global `overflow-x: hidden` (`app/globals.css`): content that
overflows the header doesn't grow `scrollWidth`, it just renders past the edge and gets
clipped, invisibly, with no scrollbar and no test signal.

1. **Two different "desktop mode" breakpoints.** The primary nav switched to inline mode
   at `md` (768px); the Account/Staff-portal/theme-toggle cluster switched at `sm`
   (640px). Between roughly 768px and 950px — ordinary tablet and small-laptop widths —
   the combined content (a 6-item nav plus three more controls) simply didn't fit in
   either configuration, overflowing silently off the right edge. Fixed by moving every
   part of "desktop mode" to the same breakpoint (`lg`, 1024px) and adding an icon-only
   tier at `lg`–`xl` for Account/Staff portal so the full nav plus controls fit
   comfortably before their text labels reappear at `xl` (1280px).
2. **A CSS specificity bug that made "hidden" never actually hide anything.** The
   Account/Staff-portal links combined `buttonClasses()` (which always bakes in a bare
   `inline-flex`) with a bare `hidden ...:inline-flex` via `cn()` — and `cn()` in this
   codebase (`src/lib/cn.ts`) is plain `clsx`, with no Tailwind conflict resolution.
   Tailwind's generated CSS places the unprefixed `.inline-flex` rule *after* the
   unprefixed `.hidden` rule, so on equal specificity `inline-flex` always won,
   **regardless of viewport**. Verified directly: before this fix, the Account link's
   computed `display` was `flex` (visible) at every tested width down to 320px, despite
   carrying a `hidden` class the whole time. Fixed by moving visibility onto a wrapping
   `<div>` around each link — the same pattern the (already-correct) `ThemeToggle` used
   — so the link's own unconditional `inline-flex` never competes with the wrapper's
   `hidden`/`block`.

`tests/e2e/header-responsive.spec.ts` encodes both fixes against real bounding boxes, at
the exact widths (900px, 1024px, 1280px) where each bug reproduced.

## The Scholarly copy bug

`app/workspace/assistant/page.tsx` told students their tracked opportunities' data sent
to Scholarly was limited to "only public deadline, funding, and eligibility data." Traced
the actual data flow: `WorkspaceAssistantView` also passes each tracked opportunity's
deterministic `MatchResult` (from the student's own eligibility answers and planning
preferences) through `opportunitySlugs`/`matchResults` into `askAssistantAction` →
`retrieveForQuestion` → `buildMatchStructuredFact()` (`src/lib/ai/rag/structured-facts.ts`),
which turns it into a structured fact — match label, confidence, and matched/mismatched/
missing signal **counts** — that genuinely is included in the prompt sent to the AI
provider. That's real, personalized data derived from the student's private profile, not
"only public" opportunity data — the copy understated what leaves the device. Confirmed
`buildMatchStructuredFact()` never includes the raw answer values or the individual
reason texts, only the aggregate label/confidence/counts, so the corrected copy says
exactly that: the match result is shared, the raw answers are not.

## Item 2 (metadata/manifest/structured-data consistency) — reviewed, no separate bug found

Beyond the icon/manifest colors (folded into the branding fix above, since `app/manifest.ts`'s
`theme_color` was one of the six files still carrying the old blue), a deliberate sweep of
`src/lib/seo/metadata.ts`, the homepage/opportunity-detail JSON-LD, `robots.ts`, and
`sitemap.ts` found everything else internally consistent: one `SITE_NAME` constant used
everywhere, the sitemap/robots noindex lists kept in documented sync with the middleware
that enforces them, and `buildOpportunityStructuredData()` already gates
`applicationDeadline` on the exact same `countdown.allowed` check the on-page display
uses (so an unverified/estimated deadline is never asserted as fact to a crawler).
`app/layout.tsx`'s adaptive light/dark meta `theme-color` (background-matched) differing
from the manifest's single fixed brand-green `theme_color` is a deliberate, common,
non-buggy split — manifest values can't vary by `prefers-color-scheme`, page meta tags
can — not a regression.

## Commands run and exact results

| Command | Result |
|---|---|
| `npx tsc --noEmit` | PASSED, no errors |
| `npx eslint .` | PASSED, no errors |
| `npm run test:coverage` | **525 passed, 1 skipped** (51/51 files) — thresholds (25/20/20/25%) met by the actual 28.84/25.36/24.04/29.35% |
| `npm run checkpoint0:validate` … `checkpoint7:validate` | All 8 PASSED (checkpoint3: 120/120, checkpoint4: 133/133, checkpoint5: 136/136, checkpoint6: 96/96, checkpoint7: 74/74) |
| `npm run launch:validate` | 28/28 passed |
| `npm run launch:validate:env-behavior` | 8/8 passed |
| `npm run build` | PASSED — all routes compile |
| `npx playwright test tests/e2e/header-responsive.spec.ts` (both projects) | 3/3 passed (chromium-desktop + mobile) |
| `npx playwright test tests/e2e/mobile-nav.spec.ts tests/e2e/custom-opportunities.spec.ts` (regression check) | All passing |
| Full Docker Compose e2e profile (`docker compose --profile test run --rm e2e`, matching CI exactly) | **217 passed, 0 failed, 37 skipped** (up from Phase 4's 211 — the 6 new `header-responsive.spec.ts` tests across both projects; every skip is the same, already-documented real-Supabase-account gate or SW-controller `fixme` from Phase 4, nothing new) |
| `npm run db:test` (against `db-test`, matching CI's `db-tests` job) | **113/113 passed** |

## Honest gaps / deferred within Phase 5

- Both the verification-badge and header bugs predate Phase 5 (and predate every prior
  phase in this remediation) — they are launch blockers this phase found and fixed, not
  regressions this phase introduced.
- The homepage's "Verified sources, honest deadlines" hero tagline and "Track verified
  scholarships and internships with confidence" heading were deliberately left as-is:
  they're immediately qualified by an explicit "Verify before you rely on any deadline —
  every opportunity here needs independent verification against its official source"
  warning directly below, so they read as a stated methodology, not an unqualified
  per-listing claim.
- Phases 1–4's already-documented gaps (the unresolved service-worker/Playwright/Docker
  interaction bug, the real-Supabase-account dependency for authenticated e2e flows)
  remain open and are unrelated to this phase.
