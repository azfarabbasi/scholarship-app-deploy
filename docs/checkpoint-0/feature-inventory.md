# Checkpoint 0 Feature Inventory

## Purpose and classification method

This inventory classifies the observable features and implementation patterns in
the read-only `ScholarTrack_Europe` prototype. A user capability can be preserved
while its legacy implementation is redesigned or replaced; those cases are called
out explicitly. This is a planning inventory, not approval to implement features
or migrate data during Checkpoint 0.

## Preserve

Preserve these user outcomes in the production platform:

- Guest access without a mandatory account.
- A clear opportunity catalogue with scholarship name, geography, study level,
  funding summary, eligibility summary, deadline information, and an official
  source link.
- Prominent accuracy guidance telling users to verify eligibility, calls, and
  deadlines against official sources.
- Search across the opportunity facts users are likely to remember.
- Filters for country, study level, deadline state, and shortlisted items.
- Sorting by deadline, name, country, and personal progress.
- Dashboard counts for total, available, soon, passed, and non-exact deadlines.
- A shortlist that can be changed from both catalogue and detail contexts.
- Per-opportunity application status, personal priority, and notes.
- Per-opportunity checklist completion and both item-level and overall progress.
- User-added checklist items and the ability to remove those custom items.
- A user-entered deadline override with an explicit personal verification marker
  and a way to return to the published deadline.
- Human-readable countdowns based on the user's current date, including a clear
  "today" state.
- Data portability for guest data and a user-controlled reset flow.
- Light/dark theme support, responsive layouts, grid/list catalogue options, a
  useful empty state, and printable output.

## Redesign

Keep the underlying need, but redesign the behavior or interaction before it
ships:

- **Deadline presentation:** model exact, estimated, rolling, and unknown dates
  explicitly; show source, verification status, last-checked date, cycle, and
  timezone/cutoff rules together rather than appending a vague note to a date.
- **Countdown semantics:** define inclusive/exclusive day rules, timezone
  boundaries, multiple rounds, expired cycles, and the transition to a newly
  verified cycle. Never let an estimate look authoritative.
- **Catalogue navigation:** retain fast cards and list views, but use scalable,
  accessible React controls and shareable/filter-preserving navigation rather
  than one ephemeral page state.
- **Details experience:** retain focused opportunity details, but use an
  accessible route, drawer, or dialog with focus placement, focus trapping,
  return-focus behavior, semantic headings, and robust browser history.
- **Verification notice:** keep accuracy warnings visible where decisions are
  made. A one-time dismissible global banner is insufficient for changed or
  unverified records.
- **Checklists:** make templates opportunity-aware and let users track completion
  without uploading the sensitive documents themselves in the first-year core
  version.
- **Overall progress:** distinguish opportunities a guest is actually pursuing
  from all catalogue records; otherwise untouched default checklists dominate the
  percentage.
- **Local guest persistence:** retain local-first guest tracking through a typed,
  versioned storage boundary with quota/error handling, migrations, and an
  eventual opt-in account synchronisation path.
- **Backup and restore:** retain export/import, but add an explicit schema version,
  validation, size limits, safe merge/replace choices, compatibility handling,
  and a preview before destructive replacement.
- **CSV and print export:** retain useful exports, but protect spreadsheet users
  from formula injection, document which records are exported, and produce an
  accessible print layout.
- **Theme behavior:** follow system preference by default, persist an explicit
  override, expose the current state in the control's accessible name, and react
  appropriately to system preference changes.
- **Responsive behavior:** design and test mobile interactions deliberately,
  including filters, long names, dialogs, safe areas, zoom, touch targets, and
  narrow-screen export actions.

## Replace

Replace these legacy technical approaches rather than porting them:

- The global `window.SCHOLARSHIPS` array and monolithic `app.js` state/rendering
  model, with typed application boundaries appropriate to Next.js and React.
- Repeated `innerHTML` rendering and repeated per-element event-listener binding,
  with declarative components and event handling.
- Hard-coded opportunity facts and 2026 deadline values as the runtime source of
  truth, with a governed data model that preserves source evidence and editorial
  verification metadata.
- Numeric positional IDs as durable record identity, with stable identifiers that
  survive imports, deduplication, renaming, and source reconciliation.
- Unvalidated arbitrary objects read from `localStorage` and restored from JSON,
  with schema-validated, versioned guest data.
- Local-device date calculations as the only deadline authority, with a tested
  deadline policy that accounts for official timezone and cutoff metadata while
  still presenting the user's local context.
- A single free-text `deadlineText` plus optional date array as the entire deadline
  model, with explicit deadline/cycle/round records.
- A bare official URL as proof of accuracy, with source records containing the
  official URL, fact provenance, verification state, and last-checked date.

## Defer

These capabilities are outside the first Checkpoint and should wait for their
planned phase or a separate product decision:

- Optional accounts, cross-device synchronisation, and guest-to-account data
  reconciliation.
- Installable PWA packaging, offline caching policy, background refresh, and PWA
  update UX; responsive PWA support remains planned, not cancelled.
- Notification delivery. Any future reminder channel must respect the free-first
  strategy and cannot create a paid email, SMS, or WhatsApp dependency.
- Sensitive student document storage, previews, extraction, or uploads.
- Autonomous form filling or scholarship/internship application submission.
- Editorial/admin workflow, bulk ingestion, and scheduled source re-verification
  until the opportunity data governance model is approved.

## Remove

Do not carry these assumptions or behaviors into the production platform:

- The hard-coded "2026 scholarship planning workspace" as a permanent product
  scope.
- Treating guide-derived dates or broad month windows as if they were exact
  deadlines merely because a representative date exists in `deadlineDates`.
- Initializing and persisting a full 12-item checklist for every one of the 55
  records before the user chooses to track them.
- Restoring an entire backup after checking only that `state` is an object.
- Silently swallowing all browser-storage parse failures without recovery or an
  explanation to the user.
- Any dependence on uploaded sensitive documents, paid email/SMS/WhatsApp, or
  autonomous application submission; these conflict with locked project rules.

## Checkpoint 0 disposition

No feature above is implemented or migrated in this checkpoint. The production
baseline only records the desired outcomes and the legacy patterns that need a
safer, accessible, source-verifiable design.
