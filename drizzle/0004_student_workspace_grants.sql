-- Hand-authored migration. Same lesson as 0002_publication_invariants.sql:
-- RLS policies restrict *which rows* a role sees, but Postgres still checks
-- the ordinary GRANT system first. 0002 gave `authenticated` a blanket
-- SELECT on every table (including future ones, via ALTER DEFAULT
-- PRIVILEGES) but never INSERT/UPDATE/DELETE, because no Checkpoint 2 table
-- was ever meant to be written by `authenticated` through Supabase's
-- PostgREST data API. Student workspace tables are different: they are
-- genuinely owned and written by the signed-in student, so `authenticated`
-- needs the full baseline here — the owner-scoped RLS policies from 0003
-- are what actually narrows every row down to the caller's own.
grant select, insert, update, delete on
  student_profiles,
  user_opportunity_tracking,
  user_custom_opportunities,
  user_notes,
  user_checklist_tasks,
  user_planning_preferences,
  user_display_preferences,
  user_sync_state,
  user_data_requests
to authenticated;
--> statement-breakpoint

-- service_role already gets full access via ALTER DEFAULT PRIVILEGES from
-- 0002 for any new table, but stated explicitly here for the same reason
-- 0002 stated it explicitly: defense in depth, not reliance on inherited
-- defaults.
grant select, insert, update, delete on
  student_profiles,
  user_opportunity_tracking,
  user_custom_opportunities,
  user_notes,
  user_checklist_tasks,
  user_planning_preferences,
  user_display_preferences,
  user_sync_state,
  user_data_requests
to service_role;
--> statement-breakpoint

-- Anonymous (signed-out) callers must never read or write student data —
-- no grant is added for `anon` on any of these tables. `anon` did receive a
-- blanket SELECT via 0002's ALTER DEFAULT PRIVILEGES; revoke it back off
-- explicitly for this table set so a missing/misconfigured RLS policy can
-- never be the only thing standing between a guest and private student data.
revoke select on
  student_profiles,
  user_opportunity_tracking,
  user_custom_opportunities,
  user_notes,
  user_checklist_tasks,
  user_planning_preferences,
  user_display_preferences,
  user_sync_state,
  user_data_requests
from anon;
