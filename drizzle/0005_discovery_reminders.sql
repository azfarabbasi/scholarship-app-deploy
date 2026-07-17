CREATE TYPE "public"."notification_status" AS ENUM('unread', 'read', 'dismissed');--> statement-breakpoint
CREATE TYPE "public"."notification_type" AS ENUM('reminder-upcoming', 'reminder-overdue', 'saved-search-alert', 'system');--> statement-breakpoint
CREATE TYPE "public"."reminder_source" AS ENUM('official-deadline', 'personal-deadline', 'checklist', 'saved-search', 'system');--> statement-breakpoint
CREATE TYPE "public"."reminder_status" AS ENUM('pending', 'dismissed', 'completed');--> statement-breakpoint
CREATE TABLE "user_eligibility_answers" (
	"student_profile_id" uuid PRIMARY KEY NOT NULL,
	"country_of_residence" text,
	"nationality" text,
	"current_study_level" text,
	"intended_study_level" text,
	"fields_of_interest" text[] DEFAULT '{}'::text[] NOT NULL,
	"graduation_year" integer,
	"target_intake_year" integer,
	"target_intake_term" text,
	"preferred_countries" text[] DEFAULT '{}'::text[] NOT NULL,
	"preferred_regions" text[] DEFAULT '{}'::text[] NOT NULL,
	"language_test_status" text,
	"research_experience" text,
	"work_experience_years" integer,
	"final_year_status" text,
	"funding_preference" text,
	"study_mode" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_eligibility_answers" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "user_notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_profile_id" uuid NOT NULL,
	"type" "notification_type" NOT NULL,
	"source" "reminder_source" DEFAULT 'system' NOT NULL,
	"title" text NOT NULL,
	"message" text DEFAULT '' NOT NULL,
	"target_type" "workspace_target_type",
	"target_id" uuid,
	"saved_search_id" uuid,
	"due_at" timestamp with time zone,
	"status" "notification_status" DEFAULT 'unread' NOT NULL,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_notifications" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "user_reminder_preferences" (
	"student_profile_id" uuid PRIMARY KEY NOT NULL,
	"reminders_enabled" boolean DEFAULT true NOT NULL,
	"official_lead_days" integer[] DEFAULT '{7}'::integer[] NOT NULL,
	"personal_lead_days" integer[] DEFAULT '{1,7}'::integer[] NOT NULL,
	"saved_search_alerts_enabled" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_reminder_preferences" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "user_reminders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_profile_id" uuid NOT NULL,
	"stable_key" text NOT NULL,
	"source" "reminder_source" NOT NULL,
	"target_type" "workspace_target_type",
	"target_id" uuid,
	"title" text NOT NULL,
	"due_at" timestamp with time zone NOT NULL,
	"lead_days" integer DEFAULT 0 NOT NULL,
	"status" "reminder_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_reminders" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "user_saved_searches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_profile_id" uuid NOT NULL,
	"name" text NOT NULL,
	"query_text" text DEFAULT '' NOT NULL,
	"filters" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"sort_mode" text DEFAULT 'nearest-deadline' NOT NULL,
	"result_count_snapshot" integer,
	"result_snapshot" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"last_checked_at" timestamp with time zone,
	"alerts_enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_saved_searches" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "user_eligibility_answers" ADD CONSTRAINT "user_eligibility_answers_student_profile_id_student_profiles_id_fk" FOREIGN KEY ("student_profile_id") REFERENCES "public"."student_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_notifications" ADD CONSTRAINT "user_notifications_student_profile_id_student_profiles_id_fk" FOREIGN KEY ("student_profile_id") REFERENCES "public"."student_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_reminder_preferences" ADD CONSTRAINT "user_reminder_preferences_student_profile_id_student_profiles_id_fk" FOREIGN KEY ("student_profile_id") REFERENCES "public"."student_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_reminders" ADD CONSTRAINT "user_reminders_student_profile_id_student_profiles_id_fk" FOREIGN KEY ("student_profile_id") REFERENCES "public"."student_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_saved_searches" ADD CONSTRAINT "user_saved_searches_student_profile_id_student_profiles_id_fk" FOREIGN KEY ("student_profile_id") REFERENCES "public"."student_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "user_reminders_student_stable_key_unique" ON "user_reminders" USING btree ("student_profile_id","stable_key");--> statement-breakpoint
CREATE POLICY "user_eligibility_answers_owner_all" ON "user_eligibility_answers" AS PERMISSIVE FOR ALL TO "authenticated" USING ("user_eligibility_answers"."student_profile_id" = auth.uid()) WITH CHECK ("user_eligibility_answers"."student_profile_id" = auth.uid());--> statement-breakpoint
CREATE POLICY "user_eligibility_answers_service_role_all" ON "user_eligibility_answers" AS PERMISSIVE FOR ALL TO "service_role" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "user_notifications_owner_all" ON "user_notifications" AS PERMISSIVE FOR ALL TO "authenticated" USING ("user_notifications"."student_profile_id" = auth.uid()) WITH CHECK ("user_notifications"."student_profile_id" = auth.uid());--> statement-breakpoint
CREATE POLICY "user_notifications_service_role_all" ON "user_notifications" AS PERMISSIVE FOR ALL TO "service_role" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "user_reminder_preferences_owner_all" ON "user_reminder_preferences" AS PERMISSIVE FOR ALL TO "authenticated" USING ("user_reminder_preferences"."student_profile_id" = auth.uid()) WITH CHECK ("user_reminder_preferences"."student_profile_id" = auth.uid());--> statement-breakpoint
CREATE POLICY "user_reminder_preferences_service_role_all" ON "user_reminder_preferences" AS PERMISSIVE FOR ALL TO "service_role" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "user_reminders_owner_all" ON "user_reminders" AS PERMISSIVE FOR ALL TO "authenticated" USING ("user_reminders"."student_profile_id" = auth.uid()) WITH CHECK ("user_reminders"."student_profile_id" = auth.uid());--> statement-breakpoint
CREATE POLICY "user_reminders_service_role_all" ON "user_reminders" AS PERMISSIVE FOR ALL TO "service_role" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "user_saved_searches_owner_all" ON "user_saved_searches" AS PERMISSIVE FOR ALL TO "authenticated" USING ("user_saved_searches"."student_profile_id" = auth.uid()) WITH CHECK ("user_saved_searches"."student_profile_id" = auth.uid());--> statement-breakpoint
CREATE POLICY "user_saved_searches_service_role_all" ON "user_saved_searches" AS PERMISSIVE FOR ALL TO "service_role" USING (true) WITH CHECK (true);