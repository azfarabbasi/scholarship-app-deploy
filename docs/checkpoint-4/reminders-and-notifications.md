# Reminders and notifications

How reminders are generated, why an official-deadline reminder is sometimes deliberately refused,
how the notification center surfaces everything, how browser notifications work (and what's
explicitly out of scope), and the saved-search alert mechanism's real cadence.

## The core safety rule: never invent a date

`src/lib/reminders/extract.ts`'s `extractExactVerifiedDeadline(opportunity)` is the single gate an
official-deadline reminder must pass through. It returns a date **only** when all three hold:

1. `deadlineInput.precision === "exact"` — not estimated, rolling, unknown, program-specific, or
   institution-specific.
2. `deadlineInput.verificationStatus === "verified"` — not unverified, stale, conflicting,
   withdrawn, archived, or estimated-from-a-previous-cycle.
3. `deadlineInput.occurrences.length === 1` — exactly one candidate date. Multiple candidate
   occurrences (e.g. a program-specific date alongside a universal one) mean "check the official
   source for which applies to you," never "guess and remind on one of them."

Any opportunity failing even one of these returns `null`, and **no official-deadline reminder is
ever generated for it** — not a best-effort one, not one with a caveat attached. This is
deliberately conservative: an incorrect reminder is worse than no reminder. Personal deadlines have
no such gate — a student's own stated date is always honoured, because it's their own data, not a
claim about official policy.

## Generation

`src/lib/reminders/engine.ts`'s `generateReminderCandidates(items, preferences, now)` is pure —
given a list of `{ targetType, targetId, title, officialExactDeadline, personalDeadline }` items
and the student's lead-day preferences, it returns reminder candidates deterministically:

- One candidate per configured lead day (subset of 0/1/3/7/14/30 days, separately configurable for
  official vs. personal deadlines) per qualifying deadline.
- Each candidate's `stableKey` is `source:targetId:dueDate:leadDays` — this is also the unique
  index enforced at the database layer (`user_reminders_student_stable_key_unique`) and the
  in-memory key checked before a guest-storage upsert. Regenerating reminders (which happens every
  time `/notifications` is opened, or on catalogue load for guests) is therefore always idempotent:
  it can never duplicate a reminder, and it can never resurrect one the student already dismissed
  or marked complete, because the upsert only ever inserts a stable key that doesn't already
  exist — it never overwrites an existing row's `status`.
- A candidate is skipped (not backfilled) if its remind-at time is more than 24 hours in the past
  relative to `now` — a lead-time window that's already meaningfully expired isn't resurrected as
  a stale reminder; a window still within the last day is still surfaced once.

`isReminderActive(reminder, now)` / `isReminderOverdue(reminder, now)`
(`src/lib/reminders/status.ts`) are the only two functions the UI needs to sort reminders into
Overdue / Upcoming / Dismissed-or-completed: a reminder is active once `now` reaches
`dueAt − leadDays`, and overdue once `dueAt` itself has passed while still active/pending.

## Regeneration cadence — deliberately not real-time

Reminders and saved-search alerts are recomputed **when the app is opened** — specifically, when
`NotificationCenter` mounts (guest: `useGuestReminderSync()`; signed-in: `syncMyReminders()` Server
Action) — never on a background timer, cron job, or push subscription. This is documented
explicitly everywhere it matters (component docstrings, the privacy page, this file) precisely so
the UI never implies real-time push when it isn't: "Reminders update the next time you open the
app," not "you'll be notified the instant something changes."

## Saved-search alerts

`src/lib/discovery/saved-search-alerts.ts`'s `diffSavedSearchResults(previousIds, currentIds)` is a
pure, order-independent set diff between a saved search's last-known result-id snapshot and its
current results (recomputed client-side against whatever catalogue data is already loaded). It
reports counts of newly-matching and no-longer-matching opportunities, and `hasAlert` is `false`
whenever nothing actually changed — it never invents an alert. The snapshot is refreshed
(`refreshMySavedSearchSnapshot`/`refreshGuestSavedSearchSnapshot`) every time the check runs, so
each subsequent open only reports what's changed *since the last time the app was open*, not
since the search was first saved.

## Notification center (`/notifications`)

`NotificationCenter.tsx` shows three sections — **Overdue**, **Upcoming**, **Dismissed /
completed** — built entirely from the signed-in student's or guest's own reminders, plus any
saved-search alert messages from the diff above. It explicitly:

- **Never shows staff diagnostics.** The staff-facing discovery-quality queues live entirely under
  `/staff/discovery`, a completely separate, staff-session-gated page; nothing from it is ever
  rendered here.
- **Never shows private note or checklist text.** `createMyNotification()`
  (`src/lib/db/actions/student/notifications.ts`) only ever accepts a title, a generic message, and
  structured target references (`targetType`/`targetId`/`savedSearchId`) — there is no code path
  that copies a note's or checklist item's free-text content into a notification.

Dismissing a reminder sets its status to `dismissed` (cloud) or updates the guest record the same
way; completing sets `completed`. Both move it out of Overdue/Upcoming into the Dismissed/completed
section, and — per the idempotent-regeneration guarantee above — regenerating reminders afterward
will never bring it back.

## Browser notifications

`src/lib/notifications/browser.ts` is a thin wrapper around the standard `Notification` API:
`isBrowserNotificationSupported()`, `getBrowserNotificationPermission()`,
`requestBrowserNotificationPermission()` (must only ever be called synchronously from a
user-initiated click — browsers silently ignore or auto-deny the prompt otherwise), and
`showBrowserNotification(title, body?)` (fails silently if permission isn't granted or the browser
throws — some mobile WebViews do even with permission granted).

**The permission prompt is requested from exactly one place**: the button inside
`NotificationPermissionSection.tsx`'s `onClick` handler. There is no `useEffect`, no page-load
hook, and no code path anywhere in the app that calls `requestPermission()` automatically —
verified structurally (`scripts/validate-checkpoint4.ts` greps for the anti-pattern) and
behaviourally (an e2e test monkey-patches `Notification.requestPermission` before navigation and
asserts zero calls after `/notifications` loads). The whole section is gated behind
`NEXT_PUBLIC_ENABLE_BROWSER_NOTIFICATIONS` (default unset) so, unconfigured, no notification UI
renders at all.

When a browser notification does fire (currently: for an overdue reminder, while `/notifications`
is open in a tab), only a title and a due-date string are ever passed — never note/checklist
content.

### Web Push is explicitly deferred

Only **foreground** notifications work today — a notification only ever fires while the app is
open in a tab, driven by `NotificationCenter`'s own effect. True background delivery (a
notification while the tab/browser is closed) requires a service-worker `push` event handler
subscribed via `PushManager`, a server that holds each subscription and sends VAPID-signed pushes
through the browser vendor's push service, and a scheduler that knows when to actually send one
(none of which exist in this checkpoint). This is a documented, deliberate scope cut — the brief
explicitly allows deferring Web Push "with honest documentation if infrastructure isn't reliable,"
and standing up a push-delivery server was judged out of scope for this pass. `.env.example`
documents `NEXT_PUBLIC_VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` as **reserved for
a future implementation, not currently read anywhere** — so the variable names are settled without
claiming a capability that doesn't exist. `VAPID_PRIVATE_KEY` is deliberately never
`NEXT_PUBLIC_`-prefixed, so if Web Push is built later, the private key still never reaches a
browser bundle by construction.

## No paid notification channels

There is no SMS, WhatsApp, or email notification service anywhere in this checkpoint or any
earlier one — no Twilio/Nexmo/SendGrid/Mailgun/WhatsApp-Business-API/MessageBird dependency exists
in `package.json`, and `scripts/validate-checkpoint4.ts` greps the whole source tree for exactly
that pattern. Every reminder/notification/alert in this checkpoint is delivered entirely within
the ScholarTrack web app (in-page UI, or a same-device browser notification) — never a message
sent through a third-party paid channel.
