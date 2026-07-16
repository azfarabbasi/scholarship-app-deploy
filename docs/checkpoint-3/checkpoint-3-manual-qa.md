# Checkpoint 3 manual QA

Exact manual test steps for guest mode, login, signup, migration, sync, offline queue, export,
import, deletion, staff regression, mobile, and accessibility. Run through this after any change
to auth, sync, or the workspace UI, and before treating the checkpoint as complete.

## Guest mode (no account)

1. Open the app in a fresh/incognito window. Go to `/workspace`. Confirm the "using ScholarTrack
   as a guest" banner appears, with links to sign up/sign in.
2. Browse `/opportunities`, open one, shortlist it, set a stage, add a note, add a checklist
   task, set a personal deadline.
3. Return to `/workspace` — the item appears with all of the above intact.
4. Reload the page — data persists (IndexedDB).
5. `/settings` → export a JSON backup, confirm the file downloads.
6. Confirm `/privacy` shows the guest-specific banner and explains local-only storage.

## Login

1. Go to `/auth/login` directly. Confirm email/password fields render and the page doesn't loop.
2. Submit with a wrong password. Confirm a clear "Sign-in failed" alert appears, not a crash or
   silent no-op.
3. Sign in with a real, confirmed test account. Confirm redirect to `/account` (or the `next`
   param if you arrived via a redirect from a protected page).
4. Visit `/account/security`, change the password, sign out, sign back in with the new password.

## Signup

1. Go to `/auth/signup`. Submit with a new email + password ≥ 8 characters.
2. If email confirmation is on: confirm the "check your email" screen appears (not a silent
   failure) and that the confirmation link, once clicked, redirects to `/auth/callback` then
   into the app.
3. If email confirmation is off (local-only workaround): confirm immediate redirect to
   `/account`.
4. Confirm no password appears anywhere in the browser's network/console logs.

## Migration (guest → cloud)

1. As a guest, build up some tracked opportunities, notes, checklist tasks, and a custom
   opportunity per the guest-mode steps above.
2. Sign up/sign in.
3. Go to `/account/sync`. Confirm the preview shows accurate local counts and current cloud
   counts (0 for a brand-new account).
4. Choose **copy**, apply, confirm the result summary counts match what you created.
5. Go to `/workspace` — confirm the cloud view now shows the migrated items with notes/checklist
   intact.
6. Confirm the guest data is still present if you open a private/incognito window (unaffected by
   migration).
7. Re-run the same migration a second time (copy mode) — confirm nothing duplicates (idempotent).
8. Test merge mode: edit an item in both the guest browser and the cloud account with different
   timestamps, migrate with "merge," confirm the newer one wins.
9. Test replace mode: confirm the second "Continue with replace…" confirmation step is required
   before anything is deleted.

## Sync

1. With two browser windows signed into the same account, change a shortlist in one, reload the
   other — the change appears.
2. Confirm the sync status indicator shows "Saved" with a recent timestamp after a successful
   change.

## Offline queue

1. Sign in, open DevTools → Network → Offline.
2. Toggle a shortlist / edit a note / add a checklist task. Confirm the UI updates immediately
   and the sync indicator shows "Offline — will sync when you reconnect."
3. Set Network back to Online. Confirm the indicator returns to "Saved" within a few seconds and
   the change is reflected after a reload.
4. Confirm `/staff` and `/account` pages fail honestly (no stale privileged content) when
   offline and never visited online first.

## Export

1. `/account/data` → "Export account data" — confirm a JSON file downloads and contains no
   `password`, `token`, `cookie`, or staff-shaped fields when opened in a text editor.
2. `/settings` → guest export — confirm it downloads a separate, differently-named file.

## Import

1. Export your account data from step above, then re-import it via `/account/data` in **merge**
   mode — confirm the summary shows the expected counts and nothing duplicates.
2. Try importing a deliberately malformed JSON file (e.g. missing a required field) — confirm a
   clear rejection message, not a crash.
3. Try importing a JSON file containing a top-level `__proto__` key — confirm it's rejected with
   an "unsafe object keys" message.
4. Try importing a file larger than 5&nbsp;MB — confirm it's rejected before any parsing.

## Deletion

1. `/account/delete` → "Delete cloud workspace data" — confirm the confirmation dialog appears,
   confirm afterwards that `/workspace` shows an empty cloud workspace but you're still signed
   in.
2. `/account/delete` → "Delete account" — confirm the confirmation dialog, confirm afterwards you
   are signed out and redirected to `/`, and that signing in with the same credentials now fails
   (account deleted).
3. Confirm guest/local data on a separate browser profile is unaffected by either deletion.

## Staff regression

1. Confirm `/staff/login` still works independently and a staff account still cannot reach
   `/account`-only features by virtue of being staff (no default overlap).
2. Confirm a signed-in *student* account, when visiting `/staff/opportunities`, is redirected to
   `/staff/login` (never granted access, never shown a mixed-permission page).
3. Confirm the staff review/publish workflow, correction reports, and duplicate queue all still
   work exactly as in Checkpoint 2.

## Mobile

1. Repeat the guest-mode and signed-in-workspace steps at a narrow viewport (or a real phone).
   Confirm the account nav collapses sensibly and the sync status indicator remains legible.
2. Confirm the mobile navigation still includes the "Account" link alongside "Staff portal."

## Accessibility

1. Tab through `/auth/login`, `/auth/signup`, and `/account/*` pages with keyboard only — confirm
   every control is reachable and focus is visible.
2. Confirm form errors (wrong password, invalid import file) are announced via `role="alert"`.
3. Confirm the sync status indicator has `role="status"` so it's announced without stealing
   focus.
