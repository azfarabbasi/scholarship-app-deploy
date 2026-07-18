# UI/UX polish pass: green theme + Scholarly rebrand

Frontend-only enhancement pass over the completed ScholarTrack app: a green-first visual theme, the AI
assistant rebranded as "Scholarly" (including a new floating quick-assistant widget), and progressive-disclosure
polish on the highest-traffic pages. No backend, database, auth, RLS, deadline-logic, or scholarship-data
changes were made or were needed.

## Visual theme

All theming lives in CSS custom properties in [`app/globals.css`](../../app/globals.css) and is consumed
through Tailwind v4's `@theme inline` mapping — every component already used utility classes like `bg-brand`,
`text-brand`, `bg-brand-tint`, so the entire app re-themes from this one file with zero per-component class
changes.

### Light theme

| Token | Value | Notes |
|---|---|---|
| `--color-brand` | `#047857` (emerald-700) | ~5.49:1 contrast both as text-on-white and white-text-on-background — passes WCAG AA (4.5:1). A lighter emerald-600 (`#059669`, ~3.77:1) was measured and rejected for failing AA. |
| `--color-brand-strong` | `#065f46` | Darker emphasis/hover shade. |
| `--color-brand-foreground` | `#ffffff` | Text/icon color on solid brand backgrounds. |
| `--color-brand-tint` | `#e6f6ec` | Soft background for active nav items, badges, hero accents. |
| `--color-mint` | `#0d9488` | New secondary accent (Scholarly/AI touches, decorative). ~3.75:1 on white — **never used as text color**, only icons/borders/backgrounds paired with regular foreground text. |
| `--color-mint-tint` | `#e6fbf7` | Soft mint background. |
| `--color-focus-ring` | `#047857` | Matches brand; all existing `focus-visible:outline-[var(--color-focus-ring)]` usages update automatically. |

### Dark theme (`.dark` / `data-theme="dark"` / system `prefers-color-scheme: dark`)

| Token | Value | Notes |
|---|---|---|
| `--color-brand` | `#34d399` (emerald-400) | ~9.85:1 against the existing dark background (`#0b1120`) — well past AA. |
| `--color-brand-strong` | `#6ee7b7` | Lighter emphasis/hover shade. |
| `--color-brand-foreground` | `#0b1120` | Dark text/icon color on solid brand backgrounds (matches the app's existing dark-mode pattern). |
| `--color-brand-tint` | `#123322` | Dark green-tinted background. |
| `--color-mint` | `#5eead4` | Dark-mode mint accent. |
| `--color-mint-tint` | `#0f2e2b` | Dark mint background. |
| `--color-focus-ring` | `#34d399` | Matches brand. |

All three theme blocks (`:root`, `:root[data-theme="dark"], .dark`, and the `@media (prefers-color-scheme:
dark)` fallback) were updated in lockstep; [`tests/unit/theme-tokens.test.ts`](../../tests/unit/theme-tokens.test.ts)
asserts they stay in sync and that the old blue brand values (`#185ada`, `#123f99`, `#6ba1f5`) never reappear.

### Semantic colors — unchanged

`--color-success` (green), `--color-warning` (amber), `--color-danger` (red), `--color-info` (blue), and
`--color-neutral` (grey) already matched the brief's semantic rules before this pass and were **not** touched.
Existing components already satisfy "never rely on color alone":

- `Badge` ([`src/components/ui/Badge.tsx`](../../src/components/ui/Badge.tsx)) always renders a text label alongside its tone.
- `DeadlineBadge` / `VerificationBadge` / `StageBadge` / `OriginBadge` ([`src/components/opportunities/badges.tsx`](../../src/components/opportunities/badges.tsx)) already pair every color with an icon and label.
- `Button` variants (`primary`/`secondary`/`outline`/`ghost`/`danger`) already map to the brief's button-color rules (primary/confirm → brand green, destructive → red, cancel → neutral grey) with no code changes needed beyond the token retheme.

## Scholarly (renamed AI assistant)

The AI assistant is now presented to users as **Scholarly** — "the friendly, source-grounded scholarship
assistant." This is a **presentation-layer rename only**: the underlying safety rules, citation requirements,
rate limits, provider abstraction, and the `AI_ENABLED`/kill-switch gating are unchanged.

Renamed surfaces:
- Nav label: "Assistant" → "Scholarly" ([`nav-items.ts`](../../src/components/layout/nav-items.ts)).
- `/assistant` — warm hero (icon + "Scholarly" heading), a plain-language source-grounded explanation, a safety
  reminder Alert ("verify deadlines... on the official source"), and three example prompt chips.
- `/assistant/settings`, `/assistant/history`, `/workspace/assistant` — headings/copy updated to "Scholarly ...".
- Assistant chat bubbles ([`AssistantChat.tsx`](../../src/components/assistant/AssistantChat.tsx)) now carry a small "Scholarly" + sparkle-icon label above every assistant reply.
- Contextual assistant panels on the opportunity detail page and the comparison page keep their existing,
  test-covered headings ("Ask about this opportunity" / "Ask about these opportunities") but now carry a
  "Scholarly" badge and page-relevant example prompt chips (e.g. "Explain this scholarship", "What should I
  verify?", "Compare this with my shortlist").
- Disabled-state copy changed from "The assistant is currently unavailable" to a friendlier "Scholarly is not
  enabled yet" title (retaining the phrase "currently unavailable" in the body so existing e2e assertions on
  that substring still hold).
- Assistant loading/answered state is now announced via the app's existing `useLiveAnnouncer` (aria-live)
  provider — "Scholarly is thinking…" / "Scholarly answered your question."

New reusable pieces:
- `AssistantChat` gained two additive, backward-compatible props: `suggestedPrompts` (clickable chips that
  **fill**, not auto-send, the input) and `compact` (hides the "temporary chat" checkbox for tight spaces).
- `useAssistantChat` gained `defaultTemporary` (starts the temporary-chat toggle already on) — used by the
  floating widget below so a quick question never silently persists somewhere the user can't review later.

## Scholarly floating widget

A new component, [`ScholarlyWidget.tsx`](../../src/components/assistant/ScholarlyWidget.tsx), mounted once
in [`app/layout.tsx`](../../app/layout.tsx) (so it's available app-wide but self-gates per page).

### Where it appears

Gating is an **explicit allowlist**, not a denylist — defined once in
[`src/lib/assistant/scholarly-widget-pages.ts`](../../src/lib/assistant/scholarly-widget-pages.ts) and shared
by both the server-side check (root layout) and the client-side check (the widget itself), so the two can
never drift apart:

**Shown on:** `/`, `/opportunities`, `/opportunities/[slug]`, `/workspace`, `/calendar`, `/notifications`,
`/account` (dashboard only), `/eligibility`, `/compare`.

**Never shown on:** `/staff/**` (all staff/admin routes), `/auth/**`, `/staff/login`, every legal/static page
(`/privacy`, `/terms`, `/disclaimer`, `/security`, `/accessibility`, `/advertising-policy`, `/about`,
`/methodology`, `/contact`, `/faq`, `/status`, `/data-sources`, `/verification-policy`), every sensitive
`/account/*` sub-page (`/account/delete`, `/account/data`, `/account/sync`, `/account/security`), the full
assistant pages themselves (`/assistant`, `/assistant/history`, `/assistant/settings`,
`/workspace/assistant` — showing a floating shortcut to the assistant on the assistant's own page would be
redundant), `/settings`, and the custom-opportunity create/edit flows.

### Performance

`app/layout.tsx` reads a new `x-pathname` request header (set by
[`src/lib/supabase/middleware.ts`](../../src/lib/supabase/middleware.ts), the same pattern already used for
the CSP nonce) and only calls the "is AI available" server action (`isAiAvailableAction`, which does a real DB
read) when the current path is even eligible for the widget. Most routes — staff, auth, legal/static content,
account sub-pages — skip that DB round-trip entirely.

### Behavior

- Desktop: compact floating circular button, bottom-right. Mobile: same button, positioned clear of the
  bottom-right corner so it never overlaps navigation.
- Opens a small panel with: a Scholarly identity header, quick example-prompt chips, a compact chat (reusing
  the same `AssistantChat` component the full `/assistant` page uses — same server actions, same safety rules,
  same citation rendering), and a link to "Open the full Scholarly assistant."
- Every widget exchange runs with `defaultTemporary` forced on and `studentProfileId` always `null` — nothing
  typed into the widget is ever persisted (guest IndexedDB or signed-in cloud history), by design, so a user
  never loses a "real" saved conversation to an ephemeral quick question. Saving conversation history remains
  available on the full `/assistant` page as before.
- Respects `AI_ENABLED`/the staff kill-switch: shows a friendly "Scholarly is not enabled yet" message instead
  of the chat when unavailable — never a broken or empty panel.
- Accessibility: launcher button has `aria-expanded`/`aria-controls`; the open panel is `role="dialog"` with an
  accessible name; focus moves into the panel on open and back to the launcher on close; **Escape** closes the
  panel; the dedicated close button and the launcher's own toggle have distinct accessible names ("Close
  Scholarly" vs. "Ask Scholarly"/"Minimize Scholarly") so screen reader users never see two identically-labelled
  controls at once.
- No hydration issues: the widget is a plain `"use client"` component with local `useState`/`useEffect` only —
  no server-rendered nonce, no `Date.now()`/`Math.random()` in its render output, nothing that could mismatch
  between server and client.

## Pages improved

- **Home** (`app/page.tsx`) — added a "Verified sources, honest deadlines" trust badge above the headline, and
  a third hero CTA ("Ask Scholarly") alongside the renamed "Start exploring" / "Track applications" buttons.
  Quick-stats grid, trust Alerts, and the catalogue preview were already present and unchanged.
- **Catalogue** (`CatalogueExplorer.tsx` / `FilterPanel.tsx`) — added a quick-filter chip row (Shortlisted,
  Open now, Needs verification, plus a "Clear all filters" action) above the toolbar for one-click access
  without opening the full filter panel. The less-common filter groups (study level, country, region,
  provider, funding category, deadline state/precision, application stage) are now grouped behind a single
  collapsed "More filters" disclosure — the common ones (match label, status, origin) stay visible by default.
- **Opportunity detail** (`OpportunityDetailBody.tsx`) — added a sticky action card at the top of the desktop
  sidebar (deadline badge + countdown, verification badge, a prominent "Visit official website" button) that
  stays in view while scrolling the long description below; the original inline CTA at the end of the details
  section is unchanged, so a mobile visitor (where the sidebar isn't sticky) still reaches it in the normal
  reading order. The contextual Scholarly panel now offers "Explain this scholarship" / "What should I verify?"
  / "Compare this with my shortlist" prompt chips.
- **Workspace** (guest `WorkspaceView.tsx` and signed-in `CloudWorkspaceView.tsx`) — added a small "next
  actions" row ("Review upcoming deadlines" → `/calendar`, "Ask Scholarly what to do next" →
  `/workspace/assistant`) under the existing stat cards.
- **Calendar** (`AgendaSection.tsx` / `CalendarView.tsx`) — each agenda section now shows a count badge next to
  its heading; the "Overdue personal deadlines" section's badge is red-tinted (text label + color, never color
  alone) to make it stand out at a glance.
- **Account** — already had a clear sync-status card, workspace-statistics card, profile card, and a
  well-separated destructive-actions section (confirmation dialogs, warning alerts, a visual divider between
  "delete workspace data" and "delete account entirely"); no changes were needed here.
- **Staff/admin** — light-touch only, exactly as scoped: the green retheme applies automatically (buttons,
  badges, focus rings), no Scholarly widget is ever mounted there, and no staff workflow, route, or component
  logic was touched.

## Accessibility considerations

- All new interactive elements (quick-filter chips, "More filters" disclosure, sticky action card, workspace
  next-action links, widget launcher/panel) use visible focus rings, proper `aria-pressed`/`aria-expanded`
  attributes, and accessible names distinct enough to avoid ambiguity.
- The floating widget implements standard dialog focus management (focus enters on open, returns to the
  launcher on close, Escape closes) rather than relying on click-outside alone.
- Assistant loading/answered transitions are announced via the existing `aria-live` `LiveAnnouncerProvider`.
- `prefers-reduced-motion` is already handled globally (`app/globals.css`) and covers every new hover/transition
  added in this pass (e.g. the widget launcher's hover scale) with no extra code needed.
- A full Docker-based Playwright run of `tests/e2e/accessibility.spec.ts` (axe-core, every listed page, both
  desktop and mobile projects) passed with zero critical/serious violations after the retheme and all page
  changes described above.

## Known limitations

- The floating widget's compact chat is intentionally always a **temporary** (unsaved) conversation — a
  deliberate scope decision, not an oversight, so the widget never needs to know or handle a signed-in user's
  history preference.
- Two "Visit official website" links, and two "Always verify current deadlines…" disclaimers, now legitimately
  exist on an opportunity detail page (sticky sidebar + inline). This is an intentional pattern for the
  sticky-action-area requirement; axe-core does not flag it, but a test targeting either by role/name without
  `.first()` needs to account for two matches — `tests/e2e/production-readiness.spec.ts` was updated
  accordingly and now passes 24/24 (both browser projects) against the real Docker stack.
- Deep, dense staff/admin screens (imports, taxonomies, discovery ops, AI source management, etc.) received
  only the automatic retheme — no layout or workflow restructuring, per the brief's explicit "light polish
  only" scope for staff.
- A pre-existing, unrelated e2e failure (`ai-assistant.spec.ts` #12, "offline mode shows the assistant as
  unavailable") persists — it predates this pass (see `docs/checkpoint-7/checkpoint-7-completion-report.md`)
  and is unaffected by any file this pass touched.

## Commands run

| Command | Result |
|---|---|
| `npm run typecheck` | PASSED, no errors |
| `npm run lint` | PASSED, no errors/warnings |
| `npm run test` | PASSED — 453 passed, 1 skipped (up from 427/1 before this pass) |
| `npm run build` | PASSED — production build, all 68 routes compile |
| `npm run checkpoint7:validate` | PASSED — 72/72 |
| `npm run security:headers` | PASSED — 22/22 (see note below) |
| Docker Playwright subset (`accessibility`, `ai-assistant`, `catalogue`, `discovery`, `mobile-nav`, `production-readiness`, `scholarly-widget` specs, both desktop and mobile projects) | 119 passed, 4 failed, 11 skipped on the first pass — all 4 failures were the same 2 issues × 2 browser projects: 1 pre-existing (`ai-assistant.spec.ts` #12, unrelated) and 1 caused by this pass's own new duplicate-text collision (fixed, see above) |
| Docker Playwright, `production-readiness.spec.ts` only, re-run after the fix | PASSED — 24/24 (both browser projects) |

**Note on `security:headers`:** on first run this session it reported a false-positive failure ("CSP
script-src must never allow a bare wildcard host") caused by the validator's regex-based static text scan
matching a `*` inside a `*/` comment-closing delimiter that happened to follow the literal word "script-src" in
a doc comment in `src/lib/security/csp.ts` (introduced by the prior CSP dev-mode fix, unrelated to this pass's
own edits). Fixed with a one-word comment rewording (no functional CSP change); re-run afterward passed 22/22.
This was found and fixed during this pass's own validation, not left undocumented.

## Files changed

**New:**
- `src/components/assistant/ScholarlyWidget.tsx`
- `src/lib/assistant/scholarly-widget-pages.ts`
- `tests/unit/theme-tokens.test.ts`
- `tests/unit/scholarly-widget-pages.test.ts`
- `tests/unit/components/ScholarlyWidget.test.tsx`
- `tests/unit/components/AssistantChat.test.tsx`
- `tests/e2e/scholarly-widget.spec.ts`
- `docs/ui-polish/scholarly-frontend-polish.md` (this file)

**Modified:**
- `app/globals.css` (green theme retheme + new mint tokens)
- `app/layout.tsx` (mount the widget, gate the AI-availability check by path)
- `app/page.tsx` (home hero polish)
- `app/assistant/page.tsx`, `app/assistant/settings/page.tsx`, `app/assistant/history/page.tsx`,
  `app/workspace/assistant/page.tsx` (Scholarly rename)
- `src/lib/supabase/middleware.ts` (`x-pathname` request header)
- `src/lib/security/csp.ts` (one-word comment fix for the `security:headers` false positive)
- `src/hooks/useAssistantChat.ts` (`defaultTemporary` option)
- `src/components/assistant/AssistantChat.tsx` (`suggestedPrompts`, `compact`, Scholarly identity, aria-live)
- `src/components/assistant/OpportunityAssistantPanel.tsx` (Scholarly badge, contextual prompts)
- `src/components/opportunities/ComparisonView.tsx` (Scholarly badge, contextual prompts)
- `src/components/opportunities/CatalogueExplorer.tsx` (quick-filter chips)
- `src/components/opportunities/FilterPanel.tsx` ("More filters" disclosure)
- `src/components/opportunities/OpportunityDetailBody.tsx` (sticky action card)
- `src/components/layout/nav-items.ts` (nav label rename)
- `src/components/workspace/WorkspaceView.tsx`, `src/components/workspace/CloudWorkspaceView.tsx` (next-actions row)
- `src/components/calendar/AgendaSection.tsx`, `src/components/calendar/CalendarView.tsx` (count badges)
- `tests/unit/components/Header.test.tsx` (assert the Scholarly nav link)
- `tests/unit/components/FilterPanel.test.tsx` (expand "More filters" before asserting on moved checkboxes)
- `tests/e2e/catalogue.spec.ts` (same — expand "More filters" first)
- `tests/e2e/production-readiness.spec.ts` (hero CTA text rename; `.first()` for the now-two official-website links)

No backend, database, auth, RLS, AI provider/safety, PWA/offline, or scholarship-data/deadline-logic files were
touched.
