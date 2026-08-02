DROP POLICY "import_job_rows_select_staff" ON "import_job_rows" CASCADE;--> statement-breakpoint
ALTER POLICY "staff_profiles_select_staff" ON "staff_profiles" TO authenticated USING ("staff_profiles"."id" = auth.uid() OR app.is_staff(auth.uid(), ARRAY['administrator']::text[]));--> statement-breakpoint
ALTER POLICY "staff_role_assignments_select_staff" ON "staff_role_assignments" TO authenticated USING ("staff_role_assignments"."staff_profile_id" = auth.uid() OR app.is_staff(auth.uid(), ARRAY['administrator']::text[]));--> statement-breakpoint
ALTER POLICY "review_assignments_select_staff" ON "review_assignments" TO authenticated USING ("review_assignments"."reviewer_staff_profile_id" = auth.uid()
        OR "review_assignments"."assigned_by_staff_profile_id" = auth.uid()
        OR "review_assignments"."subject_author_staff_profile_id" = auth.uid()
        OR app.is_staff(auth.uid(), ARRAY['administrator']::text[]));--> statement-breakpoint
ALTER POLICY "duplicate_candidates_select_staff" ON "duplicate_candidates" TO authenticated USING (app.is_staff(auth.uid(), ARRAY['senior_reviewer', 'administrator']::text[]));--> statement-breakpoint
ALTER POLICY "import_jobs_select_staff" ON "import_jobs" TO authenticated USING (app.is_staff(auth.uid(), ARRAY['administrator']::text[]));--> statement-breakpoint
ALTER POLICY "audit_log_select_staff" ON "audit_log" TO authenticated USING (app.is_staff(auth.uid(), ARRAY['administrator']::text[]));--> statement-breakpoint
ALTER POLICY "ai_provider_health_select_staff" ON "ai_provider_health" TO authenticated USING (app.is_staff(auth.uid(), ARRAY['administrator']::text[]));--> statement-breakpoint
ALTER POLICY "ai_safety_events_select_staff" ON "ai_safety_events" TO authenticated USING (app.is_staff(auth.uid(), ARRAY['administrator']::text[]));--> statement-breakpoint

-- Hand-authored (not drizzle-kit generated), same lesson as
-- 0004_student_workspace_grants.sql: RLS policies only restrict *which
-- rows* a role sees, but Postgres still checks the ordinary GRANT system
-- first, and with RLS enabled + no matching policy a SELECT simply returns
-- zero rows rather than raising an error. Row-level import detail has no
-- legitimate direct-REST reader at all, staff or otherwise — even an
-- administrator reviews import results through the app's own privileged
-- server action, never raw Supabase REST. Dropping the policy above is
-- sufficient for RLS to deny every row, but explicitly revoking the base
-- grant is defense in depth: `anon`/`authenticated` cannot read this table
-- even if RLS were ever accidentally disabled or a policy mistakenly
-- reintroduced later.
revoke select on "import_job_rows" from anon, authenticated;