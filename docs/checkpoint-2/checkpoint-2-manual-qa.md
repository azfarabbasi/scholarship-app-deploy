# Checkpoint 2 manual QA checklist

Prerequisites: `docker compose up -d db web`, then `docker compose exec web npm run db:migrate
&& docker compose exec web npm run db:seed:taxonomies && docker compose exec web npm run
db:import:legacy`. For the staff tests, either configure a real Supabase project
(`supabase-setup.md`) and bootstrap an administrator, or note results as "not executed —
requires a real Supabase project" where that applies.

## Staff login

1. Visit `/staff` while signed out → redirected to `/staff/login?next=%2Fstaff`.
2. Submit the login form with a wrong password → a visible error message, page does not crash.
3. Sign in with a bootstrapped administrator account → redirected to `/staff`, dashboard shows
   counts (drafts/pending review/etc.) and, for an administrator, recent audit activity.
4. Reload `/staff/opportunities` → still signed in (session persists via cookie).
5. Click **Sign out** in the nav → redirected to `/staff/login`; `/staff` now redirects again.

## Role denial

1. Sign in as a `reviewer`-only account. Confirm the nav does **not** show Assignments,
   Organisations, Taxonomies, Duplicates, Imports, Audit log, or Team.
2. Directly navigate to `/staff/team` anyway → page itself refuses (redirects to `/staff`) even
   though the link wasn't shown.
3. As that reviewer, open an opportunity **you drafted yourself** and confirm there is no way to
   approve or publish it (the workflow buttons for `approve`/`publish` are simply not offered
   while it's your own draft in a review-gated state; attempting the underlying action directly
   would be rejected server-side regardless).

## Create / edit

1. `/staff/opportunities/new` → fill title/summary/type/provider → **Create draft** → redirected
   to the new opportunity's detail page, status `draft`.
2. **Edit** → change the title, provide a change reason → **Save changes** → detail page reflects
   the new title; `/staff/opportunities/<id>/history` shows a new version entry with that reason.
3. Add an official source, then source evidence referencing it, then a required document and an
   eligibility rule (each referencing that evidence) — confirm each appears in its list
   immediately after submission.

## Review → approve → publish

1. **Submit for review** on the draft → status becomes `in_review`.
2. As a different reviewer account, go to `/staff/assignments`, assign a reviewer to it (your own
   authoring account is correctly excluded from the dropdown).
3. As the assigned reviewer, open the opportunity → **Mark reviewed** (or **Request changes** to
   test that branch first, then **Resubmit** as the author, then **Mark reviewed** again).
4. As a senior reviewer (not the original author), **Approve**.
5. **Publish** → confirm this fails with a clear error if no official source is attached yet;
   attach one, then publish successfully. Status becomes `published`; a public link appears on
   the detail page.
6. Visit `/opportunities/<slug>` signed out → the record is visible with its real content.

## Archive / restore

1. On a published record, **Archive** with a reason → status `archived`; the public detail page
   for that slug now falls through to the "not found" / custom-opportunity path (it's gone from
   the public catalogue).
2. **Restore** → status returns to `approved` (not `published`) — confirm you must **Publish**
   again explicitly before it's public again.

## History

1. `/staff/opportunities/<id>/history` lists every version in descending order with its change
   reason, review outcome, and publication outcome where applicable.

## Correction report

1. As a signed-out guest, open any published opportunity → **Report incorrect information** →
   submit a report → generic "submitted for review" confirmation, no internal ID shown.
2. As staff (any editorial role) at `/staff/corrections`, find the report, **Start
   investigating**, then **Resolve** with a note → status updates; the resolution note is
   visible in the queue.
3. Confirm a signed-out user cannot view `/staff/corrections` at all (redirected to login).

## CSV

1. At `/staff/imports` (administrator), download the template via the link.
2. Edit a copy: make one row valid, one with an invalid URL, one with a country that doesn't
   exist in the taxonomy, one duplicating an existing opportunity's title.
3. Upload it and click **Dry run** → per-row outcomes shown (would-create / would-reject /
   would-skip-duplicate) with error details for the invalid rows, and confirm nothing was
   written (row counts in the catalogue unchanged).
4. Click **Commit import** → only the valid row is created (as a draft); rejected/duplicate rows
   are still reported, not silently dropped.
5. Confirm the job appears in the job history table with correct accepted/rejected/duplicate
   counts.
6. As a `reviewer` (non-administrator), confirm the Imports page's mutating actions are refused
   server-side even if attempted directly.

## Duplicate merge

1. Create two opportunities with the same official URL (or same provider + near-identical
   title).
2. At `/staff/duplicates`, click **Run duplicate detection** → the pair appears as a candidate
   with a detection reason and confidence score.
3. **Merge** one into the other with a reason → the duplicate's status becomes `merged`; visiting
   its old public slug (if it had been published) redirects to the canonical record; it can no
   longer be published independently.
4. Alternatively, **Dismiss** a candidate as a false positive → it disappears from the pending
   list without affecting either opportunity.

## Public catalogue

1. `/opportunities` shows only published records; the count matches `/api/health`'s
   `publishedOpportunityCount`.
2. A published detail page shows **Deadline** and **Verification** as visually distinct
   sections (never combined), plus official-source link, precision, and last-checked date where
   available.
3. `/api/opportunities` returns valid JSON with a `syncedAt` timestamp and only `published`
   records.

## Offline cache

1. Visit `/opportunities` online (populates the service worker cache and IndexedDB).
2. Go offline (DevTools → Network → Offline) → reload `/opportunities` → catalogue still
   renders from cache.
3. Visit `/staff/login` online, then go offline and try to reload it → the browser's own
   offline error appears — never a cached staff page.
4. In a fresh incognito profile with no prior visit, go offline immediately and load
   `/opportunities` → an honest "catalogue unavailable offline" message, not a silent empty list
   or a crash.

## Guest-workspace regression

1. Shortlist a built-in opportunity, add a note, check off a checklist item, set a personal
   deadline → reload the page → all persist (IndexedDB, unaffected by any Checkpoint 2 change).
2. Create a custom opportunity, edit it, delete it → works exactly as in Checkpoint 1.
3. Export a backup, clear guest data (Settings), import the backup → guest data restored.

## Mobile staff UI

1. Resize to a narrow (375px) viewport, sign in as staff → the nav and dashboard cards reflow
   without horizontal scrolling; forms remain usable (no overlapping controls, tap targets
   reasonably sized).

## Keyboard navigation

1. Tab through the staff login form → logical order (email → password → submit), visible focus
   ring throughout.
2. Tab through the opportunity detail page's workflow action buttons and the "Add ..." forms →
   all reachable and operable via keyboard alone, with visible focus indicators.
3. Confirm the skip link still works identically to Checkpoint 1 on both public and staff pages.
