# Checkpoint 0 baseline audit

## Scope and method

This document records the behavior of the legacy `ScholarTrack_Europe` static prototype so that the useful product model can be carried forward deliberately. The legacy folder was inspected read-only. No file in it was modified, formatted, renamed, moved, deleted, or generated.

The audit is based on direct source inspection of:

- `ScholarTrack_Europe/index.html` — the complete single-page interface and its two dialogs.
- `ScholarTrack_Europe/styles.css` — visual states, dark theme, responsive breakpoints, and print rules.
- `ScholarTrack_Europe/app.js` — deadline calculation, filtering, user state, storage, export, and interaction behavior.
- `ScholarTrack_Europe/data.js` — the 55 embedded opportunity records.
- `ScholarTrack_Europe/README.txt` and `start_server.bat` — intended local startup and storage behavior.

No official opportunity URL was checked against the live web as part of this audit. No browser, screen-reader, or device-matrix test was performed, so accessibility, compatibility, and layout observations below are source-based concerns rather than conformance results.

## Baseline summary

The prototype is a client-only, single-page scholarship planning tool. It presents 55 embedded records, calculates deadline states from the user's local date, and keeps a separate shortlist, status, priority, notes field, custom deadline, and document checklist for each record. It has no server, routes, account, synchronisation, notification service, application-submission integration, or student-document upload feature. User state is stored in browser `localStorage`; JSON backup/restore is the only transfer mechanism.

The core product idea is sound: a guest can immediately discover opportunities and track preparation without creating an account. The implementation is intentionally prototype-grade: dates and facts are hard-coded, provenance is not modelled, state is coupled to numeric IDs, restore input is weakly validated, and dialog accessibility is incomplete.

## Current pages and interface sections

There is one HTML page and no client-side routing (`index.html:10-147`). The visible information architecture is:

1. **Sticky top bar** — brand, descriptive subtitle, live local date, and theme toggle.
2. **Hero** — 2026 planning message, “View shortlist,” and “Backup & restore” actions.
3. **Dismissible accuracy notice** — warns that estimated and verification-required dates must be checked on official websites.
4. **Overview statistics** — total, available, due within 30 days, passed, verify/rolling, and overall document progress. The first five cards act as filters; the progress card is informational.
5. **Sticky discovery toolbar** — free-text search plus country, study-level, deadline-status, and sort controls.
6. **Results/view row** — result count, active filter summary, CSV export, print/save-PDF, and grid/list controls.
7. **Scholarship results** — cards in grid or list presentation, followed by a filter-empty state when applicable.
8. **Footer** — local-storage and official-verification reminders.
9. **Scholarship detail drawer** — a right-side modal containing funding and eligibility, application planning, deadline override, checklist/progress, official link, shortlist action, and save action (`index.html:149-261`).
10. **Backup and restore dialog** — JSON download, JSON restore, and reset-all-progress controls (`index.html:263-291`).
11. **Toast status region** — brief polite announcements for saves and other actions.

There are no separate scholarship-detail URLs. Refreshing or sharing a URL cannot reopen a selected scholarship or reproduce a filter state.

## Existing user-visible features

### Opportunity browsing

Each card displays the country, at most the first two study levels, opportunity name, benefit summary, calculated deadline status, checklist completion, application status, priority, shortlist star, and an “Open tracker” action (`app.js:295-350`). The detail drawer adds full eligibility text, the guide's original deadline wording, and an outbound source link.

The page also provides:

- dynamic counts for all deadline groups;
- clickable status-summary cards;
- grid and list layouts;
- an empty-results state with a clear-filters action;
- print styling intended for a compact card overview; and
- a persistent accuracy warning that the user can dismiss.

### Per-opportunity planning

For every record, the user can:

- add or remove it from a shortlist;
- choose an application status;
- choose a personal priority;
- save free-text notes;
- enter a personal deadline and mark it verified;
- reset the deadline to the guide value;
- complete a 12-item default document checklist;
- add and remove custom checklist items; and
- open the stored source URL in a new tab.

The application-status choices are: Not started, Researching, Preparing documents, Ready to apply, Submitted, Interview, Awarded, and Not applying. Priorities are Normal, High, Top priority, and Low (`index.html:181-202`).

The default checklist covers identity, degree/graduation proof, transcripts, CV, motivation letter, recommendations, language result, program form, scholarship form, work-experience proof, research proposal, and certified translations (`app.js:7-20`). Several default items are explicitly conditional, but all still count equally in the progress denominator.

## Deadline and countdown behavior

The deadline implementation is in `app.js:120-187`.

- “Today” is constructed at local midnight from the user's device clock and timezone.
- Date strings use a date-only `YYYY-MM-DD` parser and are converted to local `Date` objects.
- Remaining days are calculated with `Math.ceil((target - today) / 86,400,000)`.
- The live date and all cards/statistics are rendered at startup and recalculated every 60 seconds while the page remains open (`app.js:685-695`).
- When a record has multiple dated deadlines, the first date on or after today is selected. After all dates pass, the latest listed date is used to report expiry.
- A saved custom deadline takes precedence over every guide date whether or not the user ticks “verified.”
- A `rolling` record never receives a countdown unless the user supplies a custom deadline.
- A record with no `deadlineDates` is shown as “Verification required” unless its precision is `rolling`.
- An `estimated` dated record is counted down like a dated record, but its formatted date is suffixed with “Estimated from guide.”

The dated status thresholds are exact:

- fewer than 0 days: **expired**, “Deadline passed,” plus the number of days ago;
- 0 days: **soon**, “Deadline today”;
- 1–30 days: **soon**, days left;
- 31 or more days: **open**, days left.

The date displayed to the user is locale-formatted by the browser. The custom deadline's internal precision is marked `verified` or `custom`, but that distinction is not surfaced in the card or status banner; users only see it again through the checkbox in the editor.

### Deadline status and color behavior

Deadline cards, the detail banner, and the card's top strip share these visual mappings (`styles.css:174-178`, `styles.css:190-200`, and `styles.css:229-235`):

| Runtime status | User-facing meaning | Visual treatment | Icon |
| --- | --- | --- | --- |
| `open` | More than 30 days remain | Green | Check mark |
| `soon` | Today through 30 days remain | Amber | Exclamation mark |
| `expired` | Selected deadline has passed | Red | Cross |
| `rolling` | Rolling or ongoing | Blue | Circular arrow |
| `verify` | No precise date; verification required | Blue | Question mark |

The overview cards use corresponding green, amber, red, and blue-grey top borders; overall progress uses purple. Status is not communicated by color alone because the UI also includes text and icons. Rolling and verification-required records remain visually the same color, however, and are combined in one overview count.

### Deadline caveats

- All embedded `deadlineDates` belong to 2026. Nothing automatically advances a recurring deadline into a later cycle.
- Broad windows are represented by one synthetic endpoint, so the countdown can look more exact than the underlying fact. For example, “April–July application window” maps to `2026-07-31`, and “February” maps to `2026-02-28`.
- Device clock or timezone errors directly change every status.
- Dividing local-midnight timestamps by a fixed 24-hour duration can produce an off-by-one result across daylight-saving transitions in affected timezones.
- The minute refresh rerenders the list and statistics but does not refresh an already-open detail banner; that banner can become stale across midnight until reopened.

## Scholarship filtering and sorting

Filtering and sorting are implemented in `app.js:195-255`.

### Search and filters

- Search is a case-insensitive substring match across name, country, benefit, eligibility, guide deadline text, and study levels.
- Country is an exact match against the record's full country string.
- Study level matches any value in a record's `levels` array.
- Deadline filters are Available, Due within 30 days, Passed, Rolling, Verification required, and Shortlisted only.
- “Available” intentionally includes both `open` and `soon`.
- “Verification required” intentionally includes both `verify` and `rolling`, even though Rolling also has its own filter.
- Filters combine with logical AND.
- Search updates on each input event; select controls update on change.
- Reset clears search and all filters and restores nearest-deadline sorting.
- Clicking an overview statistic applies the corresponding deadline filter and scrolls to the toolbar.

Composite values such as “Spain / Portugal” or “Germany / EU” appear as their own country options rather than being discoverable under each constituent country. The active-filter text reports country, level, and deadline status, but not the search term or selected sort.

### Sorting

The choices are:

- **Nearest deadline** — status groups are ordered soon, open, rolling, verify, expired; dated records within the same group are ascending; name breaks remaining ties.
- **Name A–Z**.
- **Country A–Z**, then name.
- **Highest progress**, then name.

Because all expired records form the final group and are sorted in ascending date order, the oldest expired deadline appears before the most recently expired deadline. The label “Nearest deadline” therefore describes upcoming records better than it describes the expired group. Custom deadlines immediately affect filters, statistics, and sorting after they are saved.

## Shortlist behavior

The shortlist is a Boolean `favorite` value stored separately for each numeric record ID.

- The card star and drawer button both toggle it immediately and save it without requiring “Save changes.”
- The hero's “View shortlist” button selects the Shortlisted only status filter and scrolls to the toolbar.
- Removing a favorite while the shortlist filter is active removes that card from the current result set on rerender.
- A toast announces whether the record was added or removed.
- Shortlist state is included in JSON backup and CSV export.

The favorite button's accessible name remains “Toggle shortlist” and does not expose the current state with `aria-pressed`.

## Checklist and progress behavior

`app.js:94-117` initialises 12 default documents per scholarship. At startup, the application eagerly creates state for all 55 records and writes it to local storage, resulting in 660 default checklist entries before any user interaction.

- Checkbox changes save immediately.
- A custom item is trimmed, limited to 80 characters by the HTML input, assigned a timestamp-based ID, and saved immediately.
- Only custom items have a remove action; default items cannot be removed or marked not applicable.
- Per-record progress is rounded to the nearest whole percent from completed items divided by all items.
- Progress appears as completed/total text, percentage text, and bars on cards and in the drawer.
- Overall progress combines every checklist item for every scholarship, including custom items and conditional defaults.
- Adding or removing a custom item changes the relevant denominator and the overall denominator.

The prototype stores checklist completion flags, not actual documents. The backup file picker accepts tracker JSON only; there is no student-document upload capability.

## Notes, priority, and application-status behavior

Notes, status, priority, custom deadline, and the verified checkbox are populated from per-record state when the drawer opens. Unlike shortlist and checklist actions, these values are only copied back to state when “Save changes” is pressed (`app.js:429-442`). Notes are trimmed at that point.

Closing with the close button, backdrop, or Escape silently discards unsaved planning-field edits. This creates mixed save semantics: favorites, checklist changes, custom checklist items, and “Reset to guide” save immediately, while notes/status/priority/deadline edits require explicit save. There is no dirty-state warning, revision history, application event history, attachment, or separate note entries.

The selected application status and priority appear on the card. Neither is currently filterable or sortable except that checklist progress can be sorted. Search does not include personal notes.

## Backup, restore, CSV, and print behavior

### JSON backup and restore

The downloaded JSON contains the application name, backup version `1`, export timestamp, the complete per-record state object, and settings (`app.js:510-520`). Settings include the theme and dismissed-notice flag. This supports manual transfer between browser profiles or devices.

Restore reads a local JSON file, checks only that `payload.state` has JavaScript type `object`, replaces all current state/settings, saves both local-storage keys, reapplies the theme, and rerenders (`app.js:522-542`). It does not merge backups.

The validation is insufficient for production:

- it does not validate application name, version, record IDs, field types, array shape, date format, item length, or payload size;
- JavaScript `null` also has type `object`, so a payload with `state: null` passes the stated type check and can break later state access;
- malformed-but-parseable records can produce invalid deadline calculations or runtime errors; and
- there is no migration path between backup schemas despite the exported version field.

“Reset all local progress” asks for browser confirmation, removes the state key, and regenerates fresh defaults on rerender. It does not clear settings, so the chosen theme and notice dismissal remain.

### CSV export

CSV export includes only the currently filtered and sorted records. Columns include scholarship, country, levels, guide deadline text, calculated status and days left, application status, priority, shortlist, document counts/progress, notes, and official URL (`app.js:471-490`). It does not include benefit, eligibility, the actual custom deadline value, the custom deadline's verification flag, or checklist item detail.

All cells are quoted and embedded quotes are escaped. User-entered notes are not protected against spreadsheet formula interpretation, and the file has no explicit UTF-8 byte-order marker, so production export needs spreadsheet-safety and compatibility testing.

### Print / Save PDF

The print action invokes the browser print dialog. Print CSS hides navigation/actions and produces a two-column card overview (`styles.css:318-328`). It prints the current result view, not full drawer content, notes, or individual checklist items. “Save PDF” depends on the browser's print destination rather than an application-generated PDF.

## Dark-mode behavior

The first load uses a saved theme if present; otherwise it reads `prefers-color-scheme` and chooses dark or light (`app.js:556-566`). The toggle flips the current value and persists it under the settings key.

CSS custom properties provide dark equivalents for background, surfaces, text, borders, status colors, and shadows (`styles.css:2-40`). The implementation does not listen for operating-system theme changes after startup when no explicit preference exists. The toggle glyph does not change, and current state is not exposed with `aria-pressed` or a state-specific label.

## Browser-storage behavior

Two local-storage keys are used (`app.js:5-6`):

- `scholartrackEuropeStateV1` — per-ID favorite, application status, priority, notes, custom deadline, verification flag, and checklist items.
- `scholartrackEuropeSettingsV1` — theme and notice-dismissal settings.

Reads are protected against JSON parse errors and fall back to empty objects. Writes are synchronous and are not protected against unavailable storage or quota errors. State is origin-, browser-profile-, and device-specific; clearing site data, changing origin/port, using another browser profile, or losing the device loses the working copy unless the user has a backup.

The prototype can be opened as a local file, but its README recommends `python -m http.server 8080` for more reliable browser storage. There is no encryption, access control, server backup, cross-device synchronisation, conflict handling, or account recovery. Notes and planning metadata are readable by any script executing under the same origin and by anyone with access to the browser profile. Filters and grid/list view are session-memory only and are not persisted.

## Current limitations

- The opportunity catalogue is a fixed global array and cannot be updated independently of shipping a new `data.js` file.
- Every dated cycle is hard-coded to 2026; recurring calls do not roll forward.
- There is one tracker state per catalogue record, so users cannot track separate programs, rounds, or parallel applications under one umbrella opportunity.
- Opportunity requirements are not modelled. Every scholarship starts with the same generic checklist, and conditional items still lower progress.
- There are no reminders, calendar export, notifications, saved searches, personal eligibility profile, comparison workflow, or update alerts.
- There is no account, cross-device sync, collaborative access, history, or conflict resolution.
- There are no separate detail routes, deep links, shareable searches, or server-rendered discovery pages.
- Application status is a single current value rather than a timeline.
- Notes are a single unstructured text field.
- CSV and print are summaries, not complete portable records.
- The app provides an outbound link only; it does not assist with or autonomously submit an application.
- It is responsive CSS but is not a PWA: there is no manifest, install metadata, service worker, offline cache strategy, or update lifecycle.

## Technical risks

1. **Hard-coded, client-trusted time data.** Statuses depend on the device clock and date-only client arithmetic. There is no authoritative cycle or timezone model.
2. **False precision.** Estimated month/window endpoints participate in the same countdown algorithm as exact dates.
3. **Unvalidated persistence.** Restore accepts structurally unsafe data, while normal local-storage writes have no error handling.
4. **ID coupling.** User state is keyed only by sequential numeric dataset IDs. Reusing or changing an ID could attach old notes/checklists to the wrong opportunity.
5. **No schema or migrations.** The `V1` keys and backup version identify a version but no compatibility/migration code exists.
6. **Eager storage duplication.** The same 12 checklist objects are copied for all 55 records on first load, consuming local-storage space before the user tracks anything.
7. **Whole-list rerenders.** Filtering and the one-minute timer rebuild all cards and bind fresh listeners. This is acceptable for 55 records but does not scale and can cause noisy assistive-technology announcements.
8. **Mixed persistence semantics.** Some drawer changes are immediate and others are staged, making data loss easy when the drawer closes.
9. **Global, untyped architecture.** `window.SCHOLARSHIPS`, stringly typed states, and direct DOM templates provide no compile-time contract or runtime schema validation.
10. **No automated quality gates.** The legacy folder contains no tests, type checking, lint configuration, dependency lockfile, build pipeline, monitoring, or error reporting.
11. **Browser compatibility assumptions.** Styling uses features such as `color-mix`, `backdrop-filter`, sticky positioning, and print grids without a documented support matrix.
12. **Export trust boundary.** Restored user content and spreadsheet export need input limits, schema checks, formula neutralisation, and failure handling in a production implementation.

The prototype does escape dynamic text before inserting card/checklist HTML and opens dataset links with `rel="noopener noreferrer"`; those defensive details are worth retaining in equivalent production code.

## Data-quality risks

The embedded catalogue contains 55 unique numeric IDs and ten fields per record: `id`, `name`, `country`, `benefit`, `eligibility`, `deadlineText`, `deadlineDates`, `precision`, `levels`, and `url`. Its declared precision distribution is 24 `exact`, 20 `estimated`, 5 `rolling`, and 6 `unknown`. These labels describe the prototype data; they are not evidence that an official source was checked.

Key risks are:

- There is no official-source identity, citation, source type, verification status, verifier, evidence snapshot, or last-checked timestamp.
- The single URL is presented as the “official application source,” but the model does not distinguish an information page, programme catalogue, institution page, call document, or application portal.
- Exact, estimated, and unknown facts have no confidence reason or audit trail.
- Broad and programme-specific windows are collapsed to one artificial date to drive countdowns.
- All dated values are tied to one cycle with no open date, cycle label, recurrence, timezone, or institution/program override.
- Country values mix single countries, composite strings, and regions (`EU-wide`, `Spain / Portugal`, `Austria / Hungary`, and `Germany / EU`), which weakens facets and reporting.
- Study level is a small mixed taxonomy (`Bachelor`, `Master`, `PhD`, `Postdoc`, `Research`, and `Exchange`) that combines degree levels with opportunity modes/career stages.
- Benefits and eligibility are unstructured prose with currencies, payment periods, waivers, approximations, and conditional statements that cannot be compared reliably.
- The catalogue mixes scholarships, fellowships, grants, mobility programmes, broad funding schemes, and a free-tuition policy. These will require explicit opportunity-type modelling.
- Umbrella and specific entries can overlap, such as general DAAD scholarships and a DAAD Master's entry, creating potential duplicates for discovery and reporting.
- Scholarship-specific required documents, citizenship rules, discipline, host institutions/programs, funding components, application route, and selection stages are absent.
- Some descriptions explicitly qualify facts with “as stated in the guide,” demonstrating that they were transcribed rather than independently verified.
- URLs and current names were not live-checked during this checkpoint, so link validity, renames, changed benefits, and changed eligibility remain unresolved.

Production must not treat the 55 records as verified merely because the UI labels some dates `exact`.

## Accessibility concerns

Positive foundations include English document language, semantic header/main/footer structure, native buttons and form controls, visible form labels in the drawer, labelled icon buttons, an `aria-live` result region, a polite toast status region, modal roles, Escape-to-close behavior, and text/icon reinforcement for status colors.

Concerns to address before production are:

- Opening a drawer/dialog does not move focus into it, trap focus, mark the background inert, or restore focus to the opener on close.
- Grid/list, theme, and shortlist toggles expose visual state through CSS or glyphs but do not expose state through `aria-pressed` or state-specific accessible names.
- There is no skip link, and the combination of sticky top bar and sticky toolbar increases keyboard travel and screen obstruction.
- Buttons and links have no consistent custom `:focus-visible` treatment; only form fields receive an explicit focus style.
- The restore file input is `display: none` inside a styled label, leaving no explicit keyboard-focusable restore control.
- A custom document row is a `<label>` containing both a checkbox and a remove button, which nests separate interactive behavior inside one label and can be confusing to keyboard and assistive-technology users.
- The entire results container is polite-live and is rebuilt on every search keystroke and minute refresh, which may announce too much content. A concise result-count announcement would be safer.
- Smooth scrolling and drawer animation have no `prefers-reduced-motion` alternative.
- The detail drawer has no unsaved-change warning, an accessibility and usability risk for users who close it accidentally.
- Visual contrast, zoom to 200–400%, forced-colors mode, screen-reader behavior, keyboard-only completion, target sizes, and status comprehension have not been tested.
- Several controls are below commonly recommended touch-target dimensions, notably the 34px favorite button and compact segmented-view buttons.

## Responsive-design behavior and concerns

The stylesheet has two breakpoints (`styles.css:291-317`):

- At 1180px and below, statistics change from six to three columns, scholarships from three to two columns, and the toolbar stacks with wrapping filters.
- At 760px and below, scholarships become one column; statistics remain two columns; hero, result actions, footer, official-source block, and reset area stack; detail two-column sections collapse; list mode falls back to a vertical card; and panel padding is reduced.

This is a useful responsive baseline, but production should verify:

- two statistics columns at very narrow widths, where labels and counts can become cramped;
- top-bar overflow from brand, full live-date value, and theme control on small devices;
- the toolbar's fixed `top: 69px`, which assumes a top-bar height and can overlap if text wraps or zoom changes it;
- fixed `height: 100%` drawer behavior under mobile browser chrome and on-screen keyboards; dynamic viewport units and safe-area insets are absent;
- fixed drawer footer overlap with long content, enlarged text, and keyboard input;
- long scholarship names, country composites, benefits, and translated text;
- touch target sizes and spacing;
- landscape phones, tablets, foldables, and browser zoom; and
- print pagination and two-column print layout for long cards.

## Features and behaviors to preserve

The new platform should preserve the intent of these capabilities, even where the implementation changes:

- immediate guest access without an account;
- local-first planning for guest users;
- the clear opportunity-card to detail-tracker workflow;
- human-readable deadline status, days remaining, original deadline wording, and explicit uncertainty;
- separate rolling, unknown/verification-required, estimated, and exact concepts;
- prominent instruction to verify official facts before acting;
- country, level, deadline-status, search, and sort discovery tools;
- shortlist and quick shortlist-only view;
- per-opportunity application status, priority, notes, and checklist;
- custom personal deadlines with a way to reset to catalogue facts;
- per-opportunity and overall preparation progress;
- manual custom checklist items;
- official-source outbound links with safe new-tab behavior;
- portable guest-data backup and useful export;
- dark theme respecting system preference;
- grid/list choice, responsive layouts, empty states, and clear save feedback; and
- no autonomous application submission and no storage of sensitive student files in the first-year core experience.

## Features and implementation patterns not to copy directly

- Do not copy hard-coded annual dates or turn broad windows into authoritative-looking exact countdowns.
- Do not equate the prototype's `exact` label with officially verified current data.
- Do not copy the global `window.SCHOLARSHIPS` data model or sequential-ID persistence contract.
- Do not use one unvalidated `localStorage` object as the only long-term state architecture.
- Do not eagerly duplicate every default checklist for every catalogue item.
- Do not make conditional documents count as required without a not-applicable/requirement model.
- Do not retain mixed immediate-versus-explicit save behavior without clear interaction design.
- Do not treat a user-ticked “verified” checkbox as source verification evidence.
- Do not present every stored URL as an official application portal without classifying and checking it.
- Do not preserve the combined rolling/verify facet if research shows users need distinct meanings.
- Do not copy unsafe backup restore or spreadsheet export behavior.
- Do not reproduce drawer/dialog focus handling, unlabeled toggle state, undersized controls, or motion without reduced-motion support.
- Do not rely on a fixed 30-day urgency threshold as the only prioritisation model; make its product meaning explicit and test it.
- Do not copy the static prototype's lack of routeability, schema validation, tests, update lifecycle, and observability.

## Static prototype versus planned production platform

| Area | Static prototype | Planned production platform baseline |
| --- | --- | --- |
| Runtime | HTML/CSS/JavaScript opened directly or served by Python | Next.js, React, and TypeScript web application with a production-upgradable build/deployment path |
| Product surface | Responsive website only; no install lifecycle | Web application with a responsive PWA planned |
| Catalogue | 55 records in a global JavaScript array | Validated, typed opportunity data separated from presentation and capable of controlled updates |
| Fact governance | Guide-derived prose/date fields and one URL | Official sources, explicit verification status, and last-checked dates required for opportunity facts |
| Deadline model | 2026 date strings plus precision label | Cycle-aware facts that distinguish exact, estimated, rolling, unknown, personal, and source-verified dates without false precision |
| Guest experience | Always anonymous and local-only | Guest mode remains available |
| Accounts | None | Optional accounts added later for synchronisation, not required for first use |
| Persistence | Synchronous browser `localStorage`; manual JSON transfer | Deliberate guest persistence now, with a compatible future synchronisation model and schema/version handling |
| Student files | No uploads; checkboxes only | No sensitive student-document uploads in the first-year core version |
| Application action | Outbound official link only | No autonomous scholarship or internship application submission |
| Communications | No email, SMS, WhatsApp, or reminders | No paid email, SMS, or WhatsApp dependency; future communication must respect the free-first constraint |
| Cost/dependencies | No hosted services | Free-first services and first-year cost ceiling of USD 100 |
| Portability | Full JSON backup, filtered CSV, browser print | Safe, validated, versioned portability designed around guest mode and later account sync |
| Quality model | No types, tests, lint, build, or runtime validation | Type-safe application with lint/build validation, accessible interaction patterns, and production error handling |
| PWA/offline | Local files work without a network, but no PWA primitives | PWA lifecycle and offline behavior to be designed explicitly rather than inferred from static-file access |

## Audit conclusion

The prototype should be treated as a behavioral reference, not a production implementation or verified data source. Its strongest baseline is the low-friction guest workflow: discover, shortlist, understand deadline urgency, plan documents, record progress, and leave for an official source. The new platform should retain that workflow while replacing hard-coded cycle data, weak provenance, unsafe persistence/import assumptions, and incomplete accessibility with typed, validated, source-governed, production-ready foundations.
