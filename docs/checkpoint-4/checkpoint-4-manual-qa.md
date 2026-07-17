# Checkpoint 4 manual QA

Exact manual test steps for search/filter, saved searches, the eligibility profile, match labels,
comparison, reminders, notifications, browser notifications, the staff discovery-quality page,
guest/cloud parity, and regression. Run through this after any change to discovery, matching,
reminders, or notifications, and before treating the checkpoint as complete.

## Search and filter

1. Go to `/opportunities`. Confirm all 55 built-in opportunities show.
2. Type a deliberate typo of a known title (e.g. "Helmholz" for "Helmholtz") — confirm the correct
   result still appears.
3. Combine a country filter with a study-level filter — confirm the count narrows and both filters
   stay applied together.
4. Check a "Match label" filter for a label no current opportunity has (e.g. "Strong potential
   fit" against the seed dataset) — confirm zero results and the empty-state message, then clear
   it.
5. Change the sort to "Relevance" with an active query — confirm results reorder sensibly (closer
   title matches first).
6. Hit `/api/search?q=daad` directly (or via a REST client) — confirm a JSON response with `items`,
   `total`, `page`, `pageCount`, `usedTrigramSimilarity`.

## Saved searches

1. Set a query + a filter, click "Save this search," name it, save. Confirm it appears in the
   "Saved searches" panel with a result count.
2. Reload the page — confirm the saved search is still listed (guest: IndexedDB; signed in: cloud).
3. Click "Run" on a saved search — confirm the catalogue filters/sort update to match.
4. Toggle its alert bell off/on — confirm the state persists after reload.
5. Delete it — confirm it disappears and (if signed in) is gone after reload too.

## Eligibility profile

1. Go to `/eligibility` with nothing filled in. Save. Confirm it saves successfully (every field is
   optional).
2. Fill in nationality + current study level, save. Confirm the success message: "Saved on this
   device" (guest) or "Saved to your account" (signed in).
3. Reload `/eligibility` — confirm the values are still there.
4. Confirm none of the fields ask for a passport/ID number, address, financial or medical detail,
   religion/ethnicity, or a file upload of any kind.

## Match labels with reasons

1. With some eligibility answers saved, open a built-in opportunity's detail page. Confirm a match
   badge appears with an icon (not colour alone) and a reasons panel below it.
2. Confirm the reasons panel cites a specific rule/answer (e.g. "No answer provided to check this
   official rule: <the actual eligibility summary text>"), not a generic message.
3. Confirm the standard disclaimer ("never a guarantee of eligibility, admission, or funding...")
   is visible on every match result, with no way to dismiss it permanently.
4. Confirm a rule mismatch (if you can construct one via a custom rule fixture) shows under "Why
   this is likely not a fit," clearly separated from any preference-based note under "Worth
   noting."

## Comparison

1. From `/opportunities`, check "Compare" on 2 different cards. Confirm the sticky bar shows
   "2 of 4 selected for comparison."
2. Click "Compare now." Confirm `/compare` shows both side by side (desktop: table; resize to a
   narrow viewport: stacked cards) with matching data in every row.
3. Try selecting a 5th item — confirm the checkbox is disabled once 4 are selected.
4. Remove one from the comparison page directly (the × next to its title) — confirm it drops out
   and the catalogue's selection count updates to match.
5. Visit `/compare` with fewer than 2 selected — confirm the "Select at least 2 opportunities"
   empty state, not a broken table.

## Reminders

1. On a built-in opportunity's detail page, set "Your personal deadline" to tomorrow's date.
   Confirm the inline "Reminder:" text appears immediately.
2. Go to `/notifications` — confirm it shows under "Upcoming," titled "Your personal deadline for
   '<title>'."
3. Find (or construct) an opportunity whose official deadline is rolling/estimated/unverified.
   Track it (shortlist or change its stage) without setting a personal deadline. Confirm
   `/notifications` never generates an official-deadline reminder for it.
4. Change reminder lead-day preferences (e.g. disable the 7-day official lead) and confirm
   reminders regenerate to match on next `/notifications` visit.
5. Dismiss a reminder — confirm it moves to "Dismissed / completed" and reopening `/notifications`
   (which regenerates reminders) never brings it back as "Upcoming" again.

## Notification center

1. Confirm the three sections (Overdue / Upcoming / Dismissed or completed) show accurate counts
   in their headings.
2. Confirm a saved-search alert message appears (if a saved search's results changed since it was
   last checked) as its own info banner, separate from the reminder lists.
3. Confirm nothing on this page ever shows a staff-only diagnostic or another student's data.
4. Confirm dismissing/completing/removing a reminder updates the list immediately, no reload
   needed.

## Browser notifications

1. With `NEXT_PUBLIC_ENABLE_BROWSER_NOTIFICATIONS` unset, confirm no notification-permission UI
   renders on `/notifications` at all.
2. With the flag set to `true` and no prior permission decision, confirm a card explains what will
   happen and offers a button — confirm the browser's own permission prompt only appears **after**
   clicking that button, never on page load.
3. Grant permission, trigger an overdue reminder (or wait for one), confirm a browser notification
   appears with only a title and a due-date string — never note/checklist text.
4. Deny permission (or simulate via browser settings) — confirm the app explains how to re-enable
   from browser settings, and the notification center itself still works normally.

## Staff discovery-quality page

1. As an unauthenticated visitor, go to `/staff/discovery` — confirm redirect to `/staff/login`.
2. Signed in as staff with an eligible role, confirm the five queues render (stale verification,
   missing eligibility rules, missing required documents, missing taxonomy, unclear official
   deadline), each linking to the relevant opportunity's staff edit page.
3. Confirm the saved-search/reminder diagnostics show only aggregate counts — no student names,
   emails, saved-search text, or reminder titles anywhere on the page.
4. Click "Refresh search statistics" — confirm it reports whether `pg_trgm` is currently available
   without erroring.

## Guest ↔ cloud parity

1. As a guest, create a saved search, set eligibility answers, set reminder preferences, and let a
   reminder generate. Export a guest backup from Settings — open the JSON and confirm all five new
   sections (`eligibilityAnswers`, `savedSearches`, `reminderPreferences`, `reminders`,
   `notifications`) are present.
2. Sign up/sign in, go to `/account/sync`, migrate — confirm the saved search, eligibility answers,
   and reminder preferences all appear on the cloud side afterward.
3. `/account/data` → export — confirm the downloaded JSON also includes all five new sections.
4. `/account/delete` → "Delete cloud workspace data" — confirm all five new data types are gone
   afterward (re-visit `/eligibility`, `/notifications`, and the saved-searches panel to check),
   while the account itself remains signed in.

## Regression

1. Confirm every Checkpoint 3 flow (guest workspace, signed-in sync, migration, export/import,
   deletion) still works exactly as before.
2. Confirm the staff review/publish/duplicate/correction-report workflows from Checkpoint 2 are
   unaffected.
3. Run the full automated suite (`npm run test`, `npm run db:test`, `npm run test:e2e`,
   `npm run checkpoint4:validate`) and confirm nothing regressed.

## Accessibility

1. Tab through `/eligibility`, `/notifications`, and `/compare` with keyboard only — confirm every
   control (including the match-label filter checkboxes and the compare checkboxes) is reachable
   with a visible focus ring.
2. Confirm match labels are never colour-only — every badge has an icon and text.
3. Confirm the notification center's section headings and alert banners are announced sensibly by
   a screen reader (no `role="alert"` spam on every render, only on genuine state changes).
4. Confirm reduced-motion settings are respected — no forced animation on the match badge, sticky
   comparison bar, or notification list.
