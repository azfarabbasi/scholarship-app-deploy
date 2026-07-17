-- Hand-authored migration (Checkpoint 4). Two jobs:
--
-- 1. The same grant/revoke baseline the Checkpoint 3 student tables needed
--    (see 0004_student_workspace_grants.sql for the full reasoning):
--    `authenticated` gets a real write grant (RLS then narrows every row to
--    the caller's own), and `anon`'s inherited default SELECT is explicitly
--    revoked so a missing RLS policy could never be the only barrier between
--    an anonymous visitor and private discovery/reminder data.
--
-- 2. Best-effort full-text/similarity search support: enable pg_trgm and add
--    GIN trigram indexes on the public search columns. Wrapped in a DO block
--    with an exception handler because CREATE EXTENSION requires database
--    privileges that a locked-down environment may not grant — the search
--    service detects at runtime whether pg_trgm is available and falls back
--    to plain ILIKE matching when it is not (documented graceful fallback,
--    never a hard requirement).
grant select, insert, update, delete on
  user_saved_searches,
  user_eligibility_answers,
  user_reminder_preferences,
  user_reminders,
  user_notifications
to authenticated;
--> statement-breakpoint

grant select, insert, update, delete on
  user_saved_searches,
  user_eligibility_answers,
  user_reminder_preferences,
  user_reminders,
  user_notifications
to service_role;
--> statement-breakpoint

revoke select on
  user_saved_searches,
  user_eligibility_answers,
  user_reminder_preferences,
  user_reminders,
  user_notifications
from anon;
--> statement-breakpoint

do $$
begin
  create extension if not exists pg_trgm;
  create index if not exists opportunities_title_trgm_idx on opportunities using gin (title gin_trgm_ops);
  create index if not exists providers_display_name_trgm_idx on providers using gin (display_name gin_trgm_ops);
exception
  when insufficient_privilege then
    raise notice 'pg_trgm unavailable (insufficient privilege) - search will use the documented ILIKE fallback';
  when undefined_file then
    raise notice 'pg_trgm extension files not installed - search will use the documented ILIKE fallback';
end
$$;
