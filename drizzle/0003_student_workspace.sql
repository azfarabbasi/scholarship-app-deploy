CREATE TYPE "public"."application_stage" AS ENUM('not-started', 'researching', 'preparing', 'ready-to-apply', 'submitted', 'interview-or-assessment', 'awarded', 'unsuccessful', 'withdrawn');--> statement-breakpoint
CREATE TYPE "public"."checklist_task_source" AS ENUM('generic', 'user-created', 'imported');--> statement-breakpoint
CREATE TYPE "public"."custom_deadline_kind" AS ENUM('exact', 'estimated', 'rolling', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."data_request_status" AS ENUM('pending', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."data_request_type" AS ENUM('export', 'deletion');--> statement-breakpoint
CREATE TYPE "public"."workspace_target_type" AS ENUM('built-in', 'custom');--> statement-breakpoint
CREATE TABLE "student_profiles" (
	"id" uuid PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"display_name" text,
	"country_or_region" text,
	"current_study_level" text,
	"intended_study_level" text,
	"graduation_year" integer,
	"target_intake_year" integer,
	"target_intake_term" text,
	"preferred_countries" text[] DEFAULT '{}'::text[] NOT NULL,
	"preferred_study_levels" text[] DEFAULT '{}'::text[] NOT NULL,
	"onboarding_completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "student_profiles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "user_checklist_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_profile_id" uuid NOT NULL,
	"target_type" "workspace_target_type" NOT NULL,
	"target_id" uuid NOT NULL,
	"task_text" text NOT NULL,
	"completed" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"source_type" "checklist_task_source" DEFAULT 'user-created' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_checklist_tasks" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "user_custom_opportunities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_profile_id" uuid NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"opportunity_type" text NOT NULL,
	"provider_name" text,
	"countries" text[] DEFAULT '{}'::text[] NOT NULL,
	"regions" text[] DEFAULT '{}'::text[] NOT NULL,
	"study_levels" text[] DEFAULT '{}'::text[] NOT NULL,
	"benefit_summary" text NOT NULL,
	"eligibility_summary" text NOT NULL,
	"official_url" text,
	"deadline_kind" "custom_deadline_kind" NOT NULL,
	"deadline_raw_text" text NOT NULL,
	"deadline_date" text,
	"deadline_timezone" text,
	"verification_notes" text,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_custom_opportunities" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "user_data_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_profile_id" uuid NOT NULL,
	"request_type" "data_request_type" NOT NULL,
	"status" "data_request_status" DEFAULT 'pending' NOT NULL,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"audit_reference" text
);
--> statement-breakpoint
ALTER TABLE "user_data_requests" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "user_display_preferences" (
	"student_profile_id" uuid PRIMARY KEY NOT NULL,
	"theme" text,
	"catalogue_view" text DEFAULT 'grid' NOT NULL,
	"dashboard_preferences" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_display_preferences" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "user_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_profile_id" uuid NOT NULL,
	"target_type" "workspace_target_type" NOT NULL,
	"target_id" uuid NOT NULL,
	"note_text" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_notes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "user_opportunity_tracking" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_profile_id" uuid NOT NULL,
	"opportunity_id" uuid NOT NULL,
	"shortlisted" boolean DEFAULT false NOT NULL,
	"stage" "application_stage" DEFAULT 'not-started' NOT NULL,
	"personal_deadline" timestamp with time zone,
	"priority" integer,
	"archived" boolean DEFAULT false NOT NULL,
	"last_viewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_opportunity_tracking" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "user_planning_preferences" (
	"student_profile_id" uuid PRIMARY KEY NOT NULL,
	"expected_graduation_date" text,
	"target_intake_year" integer,
	"target_intake_term" text,
	"preferred_study_levels" text[] DEFAULT '{}'::text[] NOT NULL,
	"preferred_countries" text[] DEFAULT '{}'::text[] NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_planning_preferences" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "user_sync_state" (
	"student_profile_id" uuid PRIMARY KEY NOT NULL,
	"device_id" text,
	"last_successful_sync_at" timestamp with time zone,
	"last_conflict_at" timestamp with time zone,
	"schema_version" integer DEFAULT 1 NOT NULL,
	"local_migration_completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_sync_state" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "user_checklist_tasks" ADD CONSTRAINT "user_checklist_tasks_student_profile_id_student_profiles_id_fk" FOREIGN KEY ("student_profile_id") REFERENCES "public"."student_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_custom_opportunities" ADD CONSTRAINT "user_custom_opportunities_student_profile_id_student_profiles_id_fk" FOREIGN KEY ("student_profile_id") REFERENCES "public"."student_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_data_requests" ADD CONSTRAINT "user_data_requests_student_profile_id_student_profiles_id_fk" FOREIGN KEY ("student_profile_id") REFERENCES "public"."student_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_display_preferences" ADD CONSTRAINT "user_display_preferences_student_profile_id_student_profiles_id_fk" FOREIGN KEY ("student_profile_id") REFERENCES "public"."student_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_notes" ADD CONSTRAINT "user_notes_student_profile_id_student_profiles_id_fk" FOREIGN KEY ("student_profile_id") REFERENCES "public"."student_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_opportunity_tracking" ADD CONSTRAINT "user_opportunity_tracking_student_profile_id_student_profiles_id_fk" FOREIGN KEY ("student_profile_id") REFERENCES "public"."student_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_opportunity_tracking" ADD CONSTRAINT "user_opportunity_tracking_opportunity_id_opportunities_id_fk" FOREIGN KEY ("opportunity_id") REFERENCES "public"."opportunities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_planning_preferences" ADD CONSTRAINT "user_planning_preferences_student_profile_id_student_profiles_id_fk" FOREIGN KEY ("student_profile_id") REFERENCES "public"."student_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_sync_state" ADD CONSTRAINT "user_sync_state_student_profile_id_student_profiles_id_fk" FOREIGN KEY ("student_profile_id") REFERENCES "public"."student_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "user_custom_opportunities_student_slug_unique" ON "user_custom_opportunities" USING btree ("student_profile_id","slug");--> statement-breakpoint
CREATE UNIQUE INDEX "user_notes_student_target_unique" ON "user_notes" USING btree ("student_profile_id","target_type","target_id");--> statement-breakpoint
CREATE UNIQUE INDEX "user_opportunity_tracking_student_opportunity_unique" ON "user_opportunity_tracking" USING btree ("student_profile_id","opportunity_id");--> statement-breakpoint
CREATE POLICY "student_profiles_owner_all" ON "student_profiles" AS PERMISSIVE FOR ALL TO "authenticated" USING ("student_profiles"."id" = auth.uid()) WITH CHECK ("student_profiles"."id" = auth.uid());--> statement-breakpoint
CREATE POLICY "student_profiles_service_role_all" ON "student_profiles" AS PERMISSIVE FOR ALL TO "service_role" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "user_checklist_tasks_owner_all" ON "user_checklist_tasks" AS PERMISSIVE FOR ALL TO "authenticated" USING ("user_checklist_tasks"."student_profile_id" = auth.uid()) WITH CHECK ("user_checklist_tasks"."student_profile_id" = auth.uid());--> statement-breakpoint
CREATE POLICY "user_checklist_tasks_service_role_all" ON "user_checklist_tasks" AS PERMISSIVE FOR ALL TO "service_role" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "user_custom_opportunities_owner_all" ON "user_custom_opportunities" AS PERMISSIVE FOR ALL TO "authenticated" USING ("user_custom_opportunities"."student_profile_id" = auth.uid()) WITH CHECK ("user_custom_opportunities"."student_profile_id" = auth.uid());--> statement-breakpoint
CREATE POLICY "user_custom_opportunities_service_role_all" ON "user_custom_opportunities" AS PERMISSIVE FOR ALL TO "service_role" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "user_data_requests_owner_select" ON "user_data_requests" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("user_data_requests"."student_profile_id" = auth.uid());--> statement-breakpoint
CREATE POLICY "user_data_requests_owner_insert" ON "user_data_requests" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ("user_data_requests"."student_profile_id" = auth.uid());--> statement-breakpoint
CREATE POLICY "user_data_requests_service_role_all" ON "user_data_requests" AS PERMISSIVE FOR ALL TO "service_role" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "user_display_preferences_owner_all" ON "user_display_preferences" AS PERMISSIVE FOR ALL TO "authenticated" USING ("user_display_preferences"."student_profile_id" = auth.uid()) WITH CHECK ("user_display_preferences"."student_profile_id" = auth.uid());--> statement-breakpoint
CREATE POLICY "user_display_preferences_service_role_all" ON "user_display_preferences" AS PERMISSIVE FOR ALL TO "service_role" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "user_notes_owner_all" ON "user_notes" AS PERMISSIVE FOR ALL TO "authenticated" USING ("user_notes"."student_profile_id" = auth.uid()) WITH CHECK ("user_notes"."student_profile_id" = auth.uid());--> statement-breakpoint
CREATE POLICY "user_notes_service_role_all" ON "user_notes" AS PERMISSIVE FOR ALL TO "service_role" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "user_opportunity_tracking_owner_all" ON "user_opportunity_tracking" AS PERMISSIVE FOR ALL TO "authenticated" USING ("user_opportunity_tracking"."student_profile_id" = auth.uid()) WITH CHECK ("user_opportunity_tracking"."student_profile_id" = auth.uid());--> statement-breakpoint
CREATE POLICY "user_opportunity_tracking_service_role_all" ON "user_opportunity_tracking" AS PERMISSIVE FOR ALL TO "service_role" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "user_planning_preferences_owner_all" ON "user_planning_preferences" AS PERMISSIVE FOR ALL TO "authenticated" USING ("user_planning_preferences"."student_profile_id" = auth.uid()) WITH CHECK ("user_planning_preferences"."student_profile_id" = auth.uid());--> statement-breakpoint
CREATE POLICY "user_planning_preferences_service_role_all" ON "user_planning_preferences" AS PERMISSIVE FOR ALL TO "service_role" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "user_sync_state_owner_all" ON "user_sync_state" AS PERMISSIVE FOR ALL TO "authenticated" USING ("user_sync_state"."student_profile_id" = auth.uid()) WITH CHECK ("user_sync_state"."student_profile_id" = auth.uid());--> statement-breakpoint
CREATE POLICY "user_sync_state_service_role_all" ON "user_sync_state" AS PERMISSIVE FOR ALL TO "service_role" USING (true) WITH CHECK (true);