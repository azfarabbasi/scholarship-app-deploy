# Student auth and sync: setup, testing, and troubleshooting

Beginner-friendly companion to `docs/checkpoint-2/supabase-setup.md` — read that first if you
haven't already configured a Supabase project for this repository. This document covers only
what's new for student accounts.

## 1. Supabase Auth settings for student sign-up

Student sign-up uses the **same** Supabase project and the **same** `NEXT_PUBLIC_SUPABASE_URL` /
`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` / `SUPABASE_SECRET_KEY` you already set up for staff. No
new Supabase project is required. Two settings matter specifically for students:

- **Authentication → Providers → Email → "Confirm email"**: ON by default. With it on, a new
  student must click a confirmation link before `signInWithPassword` will succeed — this is
  correct, secure production behaviour and the app handles it (the signup form shows "check your
  email" when `signUp()` doesn't return a session).
- **Authentication → URL Configuration → Redirect URLs**: add
  `http://localhost:3000/auth/callback` (and your deployed origin's equivalent) so the
  confirmation-email link and any magic-link/OAuth flow redirect back into this app instead of
  being rejected.

## 2. Local signup/login testing

Two supported ways to test signup locally, from least to most effort:

1. **Use a real inbox.** Sign up with a real email address you control at `/auth/signup`,
   receive Supabase's confirmation email, click the link, then sign in at `/auth/login`. This
   exercises the exact production flow and is the recommended default.
2. **Temporarily disable email confirmation** (local/dev project only — never do this on a
   production project): Supabase Dashboard → Authentication → Providers → Email → turn off
   "Confirm email". `signUp()` will then return a session immediately and the signup form
   redirects straight to `/account`. Turn it back on before treating the project as anything
   resembling production — this document does not endorse leaving it off; it is a documented,
   explicit local-development workaround, not a silent bypass.

Do **not** attempt to work around email confirmation by editing the database directly to mark a
user confirmed — that touches Supabase's own `auth.users` table, which this project's Drizzle
schema deliberately never manages.

## 3. Migration from guest to account

1. Use ScholarTrack as a guest first — shortlist something, add a note, add a custom
   opportunity. This all lives in this browser's IndexedDB.
2. Sign up / sign in.
3. Go to `/account/sync`. The migration panel reads your local guest data and shows counts
   alongside your current cloud counts.
4. Pick **copy**, **merge**, or **replace** (replace requires a second confirmation click) and
   apply. Your local guest data is never deleted by this step — check `/settings` afterwards if
   you want to clear it separately.

## 4. Testing cloud sync

1. Sign in on one browser, shortlist an opportunity via `/workspace`'s search box.
2. Sign in with the same account in a different browser (or an incognito window) — the same
   tracked item should appear after the page loads (`useCloudWorkspace` fetches fresh from the
   server on mount).
3. To test the offline queue: open DevTools → Network → set to "Offline", toggle a shortlist or
   edit a note. The change applies locally immediately and the sync indicator shows "Offline —
   will sync when you reconnect". Set Network back to "Online" — the queued change is replayed
   automatically and the indicator returns to "Saved".

## 5. Troubleshooting common login/sync issues

**"Account sign-in is not configured for this deployment yet."**
Same root cause as the equivalent staff-login message — `NEXT_PUBLIC_SUPABASE_URL` /
`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` aren't reaching the browser bundle. See
`docs/checkpoint-2/supabase-setup.md`'s troubleshooting section; it applies identically here
since both forms use `createSupabaseBrowserClient()`.

**Signed up but sign-in fails with "Email not confirmed."**
Expected if "Confirm email" is on and you haven't clicked the confirmation link yet. Check your
inbox (and spam folder), or use the local-only workaround in section 1 above.

**Signed in, but `/account` shows no data after migrating.**
Confirm the migration actually ran on `/account/sync` (it shows a result summary on success) and
that you're signed into the *same* account you migrated into — a second account will correctly
show nothing, since workspace data is never shared between accounts.

**Cross-device sync doesn't seem to update.**
`useCloudWorkspace` re-fetches on mount, not on a background poll — reload the page on the
second device/browser to see the latest state. Live cross-tab push sync is out of scope for this
checkpoint.

**Running Playwright's authenticated student e2e tests locally.**
They're gated behind `E2E_STUDENT_EMAIL` / `E2E_STUDENT_PASSWORD` (and, for the cross-user
isolation test, `E2E_STUDENT2_EMAIL` / `E2E_STUDENT2_PASSWORD`) — confirmed, real test accounts
on your Supabase project. Without them set, those tests report a clear skip reason rather than a
false pass, exactly like the staff e2e tests in Checkpoint 2.
