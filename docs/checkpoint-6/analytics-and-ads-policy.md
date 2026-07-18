# Checkpoint 6: Analytics and ads policy

## Analytics: privacy rules

Disabled by default (`NEXT_PUBLIC_ANALYTICS_ENABLED=false`). Even when enabled, `trackEvent()` and
`initAnalytics()` (`src/lib/analytics/index.ts`) never send, and are never permitted to send:

- Notes, checklist text, custom opportunity content, or personal deadlines.
- Eligibility questionnaire answers.
- AI assistant chat text (questions or answers) — only a feedback *rating category* (`helpful`/
  `not-helpful`/etc.) is ever recorded, never the message content.
- Account export/import contents.
- A raw free-text search query.
- Any credential or partial credential.

### The one supported provider, honestly described

`NEXT_PUBLIC_ANALYTICS_PROVIDER=cloudflare` targets Cloudflare Web Analytics — chosen because it's free
(ADR-008), requires no backend, and is a single client-side script tag. It is **only** a passive
page-view/Core-Web-Vitals beacon; it has no custom-event API. This means:

- `initAnalytics()` (called once, client-side, from `AnalyticsInit` in the root layout) injects the
  beacon script only when `isAnalyticsConfigured()` is true (enabled AND a token is set).
- `trackEvent()` remains a **safe, fully-testable no-op** regardless of provider today. It exists so every
  call site across the app already uses the correct event name/shape, ready for a future provider that
  does support custom events (e.g. a self-hosted Plausible/Umami instance) without touching a single call
  site when that happens.

### Allowed event names (defined in `AnalyticsEventName`)

`page_viewed`, `opportunity_viewed`, `opportunity_detail_opened`, `filter_applied`,
`filter_category_used`, `search_performed` (category/count only, never the query text),
`saved_search_created`, `reminder_created`, `shortlist_toggled`, `custom_opportunity_created`,
`backup_exported`, `backup_imported`, `pwa_install_prompt_shown`, `pwa_installed`,
`correction_report_opened`, `correction_report_submitted`, `ai_answer_feedback_category`,
`account_signup_result`, `account_login_result` (success/failure category only, never an email or
password).

### Currently wired call sites (real, not hypothetical)

- `page_viewed` — `AnalyticsInit` (root layout), on every route change (pathname only).
- `pwa_install_prompt_shown` / `pwa_installed` — `usePwaInstall.ts`, on the real `beforeinstallprompt`/
  `appinstalled` browser events.
- `correction_report_opened` / `correction_report_submitted` — `ReportCorrectionDialog.tsx`.
- `ai_answer_feedback_category` — `useAssistantChat.ts`'s `giveFeedback()`, recording only the rating.

The remaining event names are defined (so the vocabulary and shape are settled) but not yet wired to a
call site — an honest, explicitly scoped subset rather than a claim that every event fires today.

### Disabled by default, testable no-op provider

`tests/unit/env-checkpoint6.test.ts` covers `isAnalyticsConfigured()`'s disabled-by-default and
requires-full-configuration behaviour directly.

## Ads: disabled by default

`NEXT_PUBLIC_ADS_ENABLED=false` by default. `src/components/ads/AdSlot.tsx` renders nothing at all unless
`isAdsConfigured()` is true (enabled AND, for `adsense`, a publisher client ID is set).

### Placement rules

| Location | Component | Notes |
|---|---|---|
| Catalogue, after results | `CatalogueExplorer.tsx` | Only on the full `/opportunities` page (not the homepage's filter-less teaser), and only when there are results to show. |
| Site footer | `Footer.tsx` | On every page except the excluded list below. |
| FAQ (article-style page) | `app/faq/page.tsx` | One placement, below the Q&A list. |

### Excluded, unconditionally, even if a developer places `<AdSlot />` there by mistake

`/auth`, `/account`, `/staff`, `/privacy`, `/security`, `/assistant` — `AdSlot` checks the current
pathname against this list itself (`AD_EXCLUDED_PATH_PREFIXES`), independent of where it's mounted, as
defense in depth on top of simply not placing the component there.

### No ad influence on ranking, matching, or AI — structurally, not just by policy

- Catalogue search/sort (`src/lib/catalogue/search.ts`) has no ad-related input of any kind.
- The deterministic matching engine (`src/lib/matching/engine.ts`) has no ad-related input.
- The AI assistant's retrieval/prompt/answer pipeline (`src/lib/ai/rag/**`, `src/lib/ai/assistant.ts`) has
  no ad-related input, and `AdSlot` is excluded from `/assistant` entirely (see above) — no ad can ever
  render inside or beside an AI answer.

### Accessible labeling

Every rendered ad slot carries `role="complementary"` and `aria-label="Advertisement"`, plus a visible
"Advertisement" label — never blended into catalogue content, never disguised as an official source link.

### If AdSense is configured later

`AdSlot` is a structural placeholder today — no live ad-network call, no publisher slot ID wired in (only
`NEXT_PUBLIC_ADSENSE_CLIENT_ID`, a client-level ID, is part of this checkpoint's configuration). This
checkpoint delivers ad *readiness* (config, placement, exclusion, labeling), not a functioning AdSense
integration, since that requires a real, approved publisher account this project does not have. Wiring an
actual `<ins class="adsbygoogle">` unit with a real ad slot ID is a follow-up scoped entirely to
`AdSlot.tsx` — no other file needs to change.
