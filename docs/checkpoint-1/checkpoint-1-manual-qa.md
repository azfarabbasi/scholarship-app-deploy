# Checkpoint 1: Manual QA checklist

Run these checks against a production build (`docker compose --profile test
run --rm e2e` automates the majority of them; this document is for a human
pass, including things automation can't fully judge, like visual polish and
real device behaviour). Use a fresh browser profile/incognito window for
guest-data checks unless a step says otherwise.

## Desktop (≥1280px)

- [ ] Home page loads with header, hero, current local date, statistics tiles,
      privacy/verification notices, and a catalogue section.
- [ ] Header nav shows Home/Opportunities/Workspace/Calendar/Settings; the
      current page is visually and semantically marked (`aria-current`).
- [ ] No horizontal scrollbar appears on any page.
- [ ] Footer shows Privacy/Settings/Browse links and the guest-data notice.

## Mobile (~320–414px)

- [ ] Header collapses to a hamburger menu; the menu toggle has a visible
      label and opens a full-width nav panel.
- [ ] No horizontal overflow at 320px on `/`, `/opportunities`, an opportunity
      detail page, `/workspace`, `/calendar`, `/settings`.
- [ ] Catalogue cards stack in a single column; filters are usable without
      zooming.
- [ ] Tap targets (buttons, checkboxes) are comfortably tappable.

## Tablet (~768px)

- [ ] Catalogue grid shows 2 columns; filter panel remains usable (not
      truncated or overlapping content).

## Theme

- [ ] Settings → Theme shows Light/Dark/System as a radio group.
- [ ] Switching to Dark updates the whole page (backgrounds, text, badges)
      with sufficient contrast; switching back to Light restores it.
- [ ] Reloading the page after choosing a theme keeps that theme (no flash of
      the wrong theme before it applies).
- [ ] With OS set to dark and theme set to "System", the app matches dark.

## Catalogue

- [ ] `/opportunities` shows exactly 55 built-in opportunity cards initially.
- [ ] Searching "Helmholtz" (or another single-match term) narrows to 1 result
      and the result count text updates.
- [ ] Combining a country filter with a study-level filter narrows results
      further than either alone; "Reset filters" restores all 55.
- [ ] A deliberately unmatched search shows the empty state with a working
      "Reset all filters" action.
- [ ] Grid/List view toggle changes layout and persists after reloading the
      page (stored in preferences).
- [ ] Every card shows: title, country/region, study levels, benefit summary,
      a deadline badge with visible text (not colour alone), original deadline
      wording, and a verification badge.
- [ ] None of the 55 built-in cards shows a numeric "days remaining" countdown
      (per the Checkpoint 0 audit, none are verified+exact+timezone-known) —
      confirms no false countdown is fabricated.

## Opportunity detail

- [ ] Opening a card's "View details" navigates to `/opportunities/<slug>` and
      shows the same facts plus benefits/eligibility sections and an official
      website link that opens in a new tab (`rel="noopener noreferrer"`).
- [ ] An uncertain deadline shows a visible "Verify this deadline" warning
      banner, not just a badge.
- [ ] A non-existent slug (e.g. `/opportunities/does-not-exist`) shows a
      friendly not-found state, not a crash.

## Guest tracking

- [ ] From a detail page: toggling "Add to shortlist" updates immediately and
      persists after a full page reload.
- [ ] Changing the application stage persists after reload.
- [ ] Typing a note, then clicking away, shows a "Notes saved" confirmation
      (announced for screen readers) and the note persists after reload.
- [ ] "Add starter checklist" adds the 7 generic tasks; checking one off
      persists after reload; deleting one removes it; adding a custom task
      works; "Reset starter tasks" removes only the generic ones (confirmed
      via a dialog) and keeps custom ones.
- [ ] Setting a personal deadline shows "X days remaining"/"today"/"overdue"
      text as appropriate and persists after reload; clearing it removes the
      reminder.

## Custom opportunities

- [ ] `/custom-opportunities/new` requires title, at least one country or
      region, at least one study level, benefit summary, eligibility summary,
      and original deadline wording; an invalid URL shows a field error and
      blocks submission.
- [ ] Choosing "Exact"/"Estimated" requires a calendar date; choosing
      "Rolling"/"Unknown" rejects a calendar date if one is somehow present.
- [ ] Successful creation redirects to the new opportunity's detail page,
      labelled "Custom" and "Self-reported — not officially verified" (never
      "officially verified").
- [ ] Editing an existing custom opportunity preserves its shortlist/stage/
      notes/checklist state.
- [ ] Deleting requires an explicit confirmation dialog; cancelling leaves the
      record untouched.

## Workspace

- [ ] `/workspace` lists every custom opportunity (always) and every built-in
      opportunity with any tracking state (shortlisted, stage changed, notes,
      checklist, or personal deadline).
- [ ] Summary tiles (shortlisted, in progress, overdue/upcoming personal
      deadlines, checklist completion) reflect actual data.
- [ ] An empty workspace (fresh guest, nothing tracked) shows helpful guidance
      with links to browse the catalogue or add a custom opportunity.

## Calendar

- [ ] Agenda view separates "Overdue personal deadlines" from "Upcoming" and
      lists uncertain/undated opportunities in their own section.
- [ ] Month view shows a fluid 7-column grid with no overflow, and correctly
      places any dated events on their calendar day.
- [ ] Filters (official/personal/custom, shortlisted-only) narrow the shown
      events.
- [ ] Downloading a single event's `.ics` and opening it in a real calendar
      app (or a text editor) shows a valid `VEVENT` with the correct date and
      no private note content.
- [ ] "Export all upcoming" downloads a multi-event `.ics` file.

## Settings, backup, and restore

- [ ] Planning preferences (graduation date, target intake year/term,
      preferred study levels/countries) save and persist after reload.
- [ ] "Export full backup (JSON)" downloads a file; opening it shows the
      expected shape (`app`, `schemaVersion`, `createdAt`, `counts`, `data`).
- [ ] "Export applications (CSV)" downloads a readable CSV with no internal
      IDs.
- [ ] Importing that same JSON file shows a backup summary (record counts,
      schema version, created date) before anything is written.
- [ ] Choosing "Replace" clearly warns that current data will be removed
      first; choosing "Merge" does not.
- [ ] Importing a non-JSON file, a JSON file with the wrong shape, or an
      oversized (>5 MB) file shows a clear rejection message and writes
      nothing.
- [ ] "Clear all local data" requires confirmation and actually empties the
      workspace, custom opportunities, and preferences.
- [ ] Storage diagnostics shows IndexedDB/localStorage as Available, the
      current schema version, record counts, and last backup time.

## PWA and offline

- [ ] Against a production build, the browser offers to install the app (or
      Settings → "Install as an app" shows an Install button); iOS Safari
      shows manual guidance instead.
- [ ] After installing and opening as a standalone app, navigation works
      normally.
- [ ] After one successful online visit, turning off networking (DevTools →
      Network → Offline, or turning off Wi-Fi) and reloading `/opportunities`,
      `/workspace`, `/calendar`, and `/settings` still shows the full
      interface (an offline banner appears, but the app remains usable).
- [ ] Navigating to a route that was never visited while offline (with no
      cached entry and no network) falls back to the `/offline` page rather
      than a browser error page.
- [ ] Clicking an official external link while offline is expected to fail
      (it is never cached) — confirm the app doesn't crash when that happens.

## Accessibility keyboard flow

- [ ] Pressing Tab from a fresh page load focuses the "Skip to main content"
      link first; activating it moves focus into `<main>`.
- [ ] The mobile menu button, theme radio buttons, filter checkboxes, sort
      select, and view toggle are all reachable and operable via keyboard
      alone (Tab/Shift+Tab/Enter/Space/arrow keys where applicable).
- [ ] Opening a confirmation dialog (e.g. "Clear all local data") traps focus
      inside it, and Escape or "Cancel" closes it without side effects.
- [ ] Every icon-only control (shortlist toggle, delete checklist item, month
      navigation arrows) has an accessible name (verified via a screen reader
      or the browser's accessibility inspector).
- [ ] Form fields show associated labels and inline error text that is
      announced (not just colour-coded).
