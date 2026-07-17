CREATE TYPE "public"."ai_citation_source_type" AS ENUM('official-source', 'structured-data', 'workspace-context', 'match-explanation');--> statement-breakpoint
CREATE TYPE "public"."ai_conversation_scope" AS ENUM('general', 'opportunity', 'comparison', 'workspace', 'matching');--> statement-breakpoint
CREATE TYPE "public"."ai_evaluation_result" AS ENUM('pass', 'fail', 'error');--> statement-breakpoint
CREATE TYPE "public"."ai_feedback_rating" AS ENUM('helpful', 'not-helpful', 'incorrect', 'missing-citation', 'outdated-source', 'unsafe-misleading', 'other');--> statement-breakpoint
CREATE TYPE "public"."ai_message_role" AS ENUM('user', 'assistant');--> statement-breakpoint
CREATE TYPE "public"."ai_safety_event_kind" AS ENUM('hidden-prompt-request', 'secret-request', 'other-user-data-request', 'prompt-injection', 'invented-fact-request', 'output-claim-stripped', 'rate-limit-exceeded', 'provider-error');--> statement-breakpoint
CREATE TYPE "public"."ai_source_status" AS ENUM('draft', 'approved', 'rejected', 'stale');--> statement-breakpoint
CREATE TYPE "public"."ai_usage_subject_type" AS ENUM('user');--> statement-breakpoint
CREATE TABLE "ai_answer_citations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"message_id" uuid NOT NULL,
	"student_profile_id" uuid NOT NULL,
	"citation_type" "ai_citation_source_type" NOT NULL,
	"opportunity_id" uuid,
	"official_source_id" uuid,
	"source_chunk_id" uuid,
	"label" text NOT NULL,
	"url" text,
	"verification_status" text,
	"checked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ai_answer_citations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "ai_conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_profile_id" uuid NOT NULL,
	"scope" "ai_conversation_scope" NOT NULL,
	"target_opportunity_id" uuid,
	"title" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ai_conversations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "ai_evaluation_cases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"scope" "ai_conversation_scope" DEFAULT 'general' NOT NULL,
	"prompt" text NOT NULL,
	"expectations" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ai_evaluation_cases" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "ai_evaluation_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"evaluation_case_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"result" "ai_evaluation_result" NOT NULL,
	"details" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ai_evaluation_runs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "ai_feedback" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"message_id" uuid NOT NULL,
	"student_profile_id" uuid,
	"rating" "ai_feedback_rating" NOT NULL,
	"comment" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ai_feedback" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "ai_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"student_profile_id" uuid NOT NULL,
	"role" "ai_message_role" NOT NULL,
	"content" text NOT NULL,
	"blocked_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ai_messages" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "ai_prompt_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"content" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ai_prompt_templates" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "ai_provider_health" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"manually_disabled" boolean DEFAULT false NOT NULL,
	"disabled_reason" text,
	"disabled_by_staff_profile_id" uuid,
	"disabled_at" timestamp with time zone,
	"last_checked_at" timestamp with time zone,
	"last_status" text,
	"last_error" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ai_provider_health" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "ai_retrieval_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"message_id" uuid NOT NULL,
	"student_profile_id" uuid NOT NULL,
	"retrieved_chunk_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"chunk_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ai_retrieval_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "ai_safety_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_profile_id" uuid,
	"message_id" uuid,
	"kind" "ai_safety_event_kind" NOT NULL,
	"redacted_summary" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ai_safety_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "ai_source_chunks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" uuid NOT NULL,
	"opportunity_id" uuid,
	"official_source_id" uuid,
	"chunk_index" integer DEFAULT 0 NOT NULL,
	"chunk_text" text NOT NULL,
	"status" "ai_source_status" DEFAULT 'draft' NOT NULL,
	"token_count_estimate" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ai_source_chunks" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "ai_source_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"opportunity_id" uuid,
	"official_source_id" uuid,
	"source_evidence_id" uuid,
	"required_document_id" uuid,
	"eligibility_rule_id" uuid,
	"title" text NOT NULL,
	"source_text" text NOT NULL,
	"status" "ai_source_status" DEFAULT 'draft' NOT NULL,
	"stale_reason" text,
	"checked_at" timestamp with time zone,
	"created_by_staff_profile_id" uuid,
	"approved_by_staff_profile_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ai_source_documents" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "ai_usage_limits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"subject_type" "ai_usage_subject_type" DEFAULT 'user' NOT NULL,
	"student_profile_id" uuid NOT NULL,
	"usage_date" date NOT NULL,
	"request_count" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ai_usage_limits" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "ai_answer_citations" ADD CONSTRAINT "ai_answer_citations_message_id_ai_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."ai_messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_answer_citations" ADD CONSTRAINT "ai_answer_citations_student_profile_id_student_profiles_id_fk" FOREIGN KEY ("student_profile_id") REFERENCES "public"."student_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_answer_citations" ADD CONSTRAINT "ai_answer_citations_opportunity_id_opportunities_id_fk" FOREIGN KEY ("opportunity_id") REFERENCES "public"."opportunities"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_answer_citations" ADD CONSTRAINT "ai_answer_citations_official_source_id_official_sources_id_fk" FOREIGN KEY ("official_source_id") REFERENCES "public"."official_sources"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_answer_citations" ADD CONSTRAINT "ai_answer_citations_source_chunk_id_ai_source_chunks_id_fk" FOREIGN KEY ("source_chunk_id") REFERENCES "public"."ai_source_chunks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_conversations" ADD CONSTRAINT "ai_conversations_student_profile_id_student_profiles_id_fk" FOREIGN KEY ("student_profile_id") REFERENCES "public"."student_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_conversations" ADD CONSTRAINT "ai_conversations_target_opportunity_id_opportunities_id_fk" FOREIGN KEY ("target_opportunity_id") REFERENCES "public"."opportunities"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_evaluation_runs" ADD CONSTRAINT "ai_evaluation_runs_evaluation_case_id_ai_evaluation_cases_id_fk" FOREIGN KEY ("evaluation_case_id") REFERENCES "public"."ai_evaluation_cases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_feedback" ADD CONSTRAINT "ai_feedback_message_id_ai_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."ai_messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_feedback" ADD CONSTRAINT "ai_feedback_student_profile_id_student_profiles_id_fk" FOREIGN KEY ("student_profile_id") REFERENCES "public"."student_profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_messages" ADD CONSTRAINT "ai_messages_conversation_id_ai_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."ai_conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_messages" ADD CONSTRAINT "ai_messages_student_profile_id_student_profiles_id_fk" FOREIGN KEY ("student_profile_id") REFERENCES "public"."student_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_provider_health" ADD CONSTRAINT "ai_provider_health_disabled_by_staff_profile_id_staff_profiles_id_fk" FOREIGN KEY ("disabled_by_staff_profile_id") REFERENCES "public"."staff_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_retrieval_events" ADD CONSTRAINT "ai_retrieval_events_message_id_ai_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."ai_messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_retrieval_events" ADD CONSTRAINT "ai_retrieval_events_student_profile_id_student_profiles_id_fk" FOREIGN KEY ("student_profile_id") REFERENCES "public"."student_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_safety_events" ADD CONSTRAINT "ai_safety_events_student_profile_id_student_profiles_id_fk" FOREIGN KEY ("student_profile_id") REFERENCES "public"."student_profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_safety_events" ADD CONSTRAINT "ai_safety_events_message_id_ai_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."ai_messages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_source_chunks" ADD CONSTRAINT "ai_source_chunks_document_id_ai_source_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."ai_source_documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_source_chunks" ADD CONSTRAINT "ai_source_chunks_opportunity_id_opportunities_id_fk" FOREIGN KEY ("opportunity_id") REFERENCES "public"."opportunities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_source_chunks" ADD CONSTRAINT "ai_source_chunks_official_source_id_official_sources_id_fk" FOREIGN KEY ("official_source_id") REFERENCES "public"."official_sources"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_source_documents" ADD CONSTRAINT "ai_source_documents_opportunity_id_opportunities_id_fk" FOREIGN KEY ("opportunity_id") REFERENCES "public"."opportunities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_source_documents" ADD CONSTRAINT "ai_source_documents_official_source_id_official_sources_id_fk" FOREIGN KEY ("official_source_id") REFERENCES "public"."official_sources"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_source_documents" ADD CONSTRAINT "ai_source_documents_source_evidence_id_source_evidence_id_fk" FOREIGN KEY ("source_evidence_id") REFERENCES "public"."source_evidence"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_source_documents" ADD CONSTRAINT "ai_source_documents_required_document_id_opportunity_document_requirements_id_fk" FOREIGN KEY ("required_document_id") REFERENCES "public"."opportunity_document_requirements"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_source_documents" ADD CONSTRAINT "ai_source_documents_eligibility_rule_id_eligibility_rules_id_fk" FOREIGN KEY ("eligibility_rule_id") REFERENCES "public"."eligibility_rules"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_source_documents" ADD CONSTRAINT "ai_source_documents_created_by_staff_profile_id_staff_profiles_id_fk" FOREIGN KEY ("created_by_staff_profile_id") REFERENCES "public"."staff_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_source_documents" ADD CONSTRAINT "ai_source_documents_approved_by_staff_profile_id_staff_profiles_id_fk" FOREIGN KEY ("approved_by_staff_profile_id") REFERENCES "public"."staff_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_usage_limits" ADD CONSTRAINT "ai_usage_limits_student_profile_id_student_profiles_id_fk" FOREIGN KEY ("student_profile_id") REFERENCES "public"."student_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "ai_evaluation_cases_key_unique" ON "ai_evaluation_cases" USING btree ("key");--> statement-breakpoint
CREATE UNIQUE INDEX "ai_prompt_templates_key_unique" ON "ai_prompt_templates" USING btree ("key");--> statement-breakpoint
CREATE UNIQUE INDEX "ai_usage_limits_student_date_unique" ON "ai_usage_limits" USING btree ("student_profile_id","usage_date");--> statement-breakpoint
CREATE POLICY "ai_answer_citations_owner_all" ON "ai_answer_citations" AS PERMISSIVE FOR ALL TO "authenticated" USING ("ai_answer_citations"."student_profile_id" = auth.uid()) WITH CHECK ("ai_answer_citations"."student_profile_id" = auth.uid());--> statement-breakpoint
CREATE POLICY "ai_answer_citations_service_role_all" ON "ai_answer_citations" AS PERMISSIVE FOR ALL TO "service_role" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "ai_conversations_owner_all" ON "ai_conversations" AS PERMISSIVE FOR ALL TO "authenticated" USING ("ai_conversations"."student_profile_id" = auth.uid()) WITH CHECK ("ai_conversations"."student_profile_id" = auth.uid());--> statement-breakpoint
CREATE POLICY "ai_conversations_service_role_all" ON "ai_conversations" AS PERMISSIVE FOR ALL TO "service_role" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "ai_evaluation_cases_select_staff" ON "ai_evaluation_cases" AS PERMISSIVE FOR SELECT TO "authenticated" USING (app.is_staff(auth.uid(), NULL));--> statement-breakpoint
CREATE POLICY "ai_evaluation_cases_service_role_all" ON "ai_evaluation_cases" AS PERMISSIVE FOR ALL TO "service_role" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "ai_evaluation_runs_select_staff" ON "ai_evaluation_runs" AS PERMISSIVE FOR SELECT TO "authenticated" USING (app.is_staff(auth.uid(), NULL));--> statement-breakpoint
CREATE POLICY "ai_evaluation_runs_service_role_all" ON "ai_evaluation_runs" AS PERMISSIVE FOR ALL TO "service_role" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "ai_feedback_owner_all" ON "ai_feedback" AS PERMISSIVE FOR ALL TO "authenticated" USING ("ai_feedback"."student_profile_id" = auth.uid()) WITH CHECK ("ai_feedback"."student_profile_id" = auth.uid());--> statement-breakpoint
CREATE POLICY "ai_feedback_select_staff" ON "ai_feedback" AS PERMISSIVE FOR SELECT TO "authenticated" USING (app.is_staff(auth.uid(), NULL));--> statement-breakpoint
CREATE POLICY "ai_feedback_service_role_all" ON "ai_feedback" AS PERMISSIVE FOR ALL TO "service_role" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "ai_messages_owner_all" ON "ai_messages" AS PERMISSIVE FOR ALL TO "authenticated" USING ("ai_messages"."student_profile_id" = auth.uid()) WITH CHECK ("ai_messages"."student_profile_id" = auth.uid());--> statement-breakpoint
CREATE POLICY "ai_messages_service_role_all" ON "ai_messages" AS PERMISSIVE FOR ALL TO "service_role" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "ai_prompt_templates_select_staff" ON "ai_prompt_templates" AS PERMISSIVE FOR SELECT TO "authenticated" USING (app.is_staff(auth.uid(), NULL));--> statement-breakpoint
CREATE POLICY "ai_prompt_templates_service_role_all" ON "ai_prompt_templates" AS PERMISSIVE FOR ALL TO "service_role" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "ai_provider_health_select_staff" ON "ai_provider_health" AS PERMISSIVE FOR SELECT TO "authenticated" USING (app.is_staff(auth.uid(), NULL));--> statement-breakpoint
CREATE POLICY "ai_provider_health_service_role_all" ON "ai_provider_health" AS PERMISSIVE FOR ALL TO "service_role" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "ai_retrieval_events_owner_all" ON "ai_retrieval_events" AS PERMISSIVE FOR ALL TO "authenticated" USING ("ai_retrieval_events"."student_profile_id" = auth.uid()) WITH CHECK ("ai_retrieval_events"."student_profile_id" = auth.uid());--> statement-breakpoint
CREATE POLICY "ai_retrieval_events_service_role_all" ON "ai_retrieval_events" AS PERMISSIVE FOR ALL TO "service_role" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "ai_safety_events_select_staff" ON "ai_safety_events" AS PERMISSIVE FOR SELECT TO "authenticated" USING (app.is_staff(auth.uid(), NULL));--> statement-breakpoint
CREATE POLICY "ai_safety_events_service_role_all" ON "ai_safety_events" AS PERMISSIVE FOR ALL TO "service_role" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "ai_source_chunks_select_public" ON "ai_source_chunks" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING ("ai_source_chunks"."status" = 'approved' AND ("ai_source_chunks"."opportunity_id" IS NULL OR EXISTS (SELECT 1 FROM opportunities o WHERE o.id = "ai_source_chunks"."opportunity_id" AND o.status = 'published')));--> statement-breakpoint
CREATE POLICY "ai_source_chunks_select_staff" ON "ai_source_chunks" AS PERMISSIVE FOR SELECT TO "authenticated" USING (app.is_staff(auth.uid(), NULL));--> statement-breakpoint
CREATE POLICY "ai_source_chunks_service_role_all" ON "ai_source_chunks" AS PERMISSIVE FOR ALL TO "service_role" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "ai_source_documents_select_public" ON "ai_source_documents" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING ("ai_source_documents"."status" = 'approved' AND ("ai_source_documents"."opportunity_id" IS NULL OR EXISTS (SELECT 1 FROM opportunities o WHERE o.id = "ai_source_documents"."opportunity_id" AND o.status = 'published')));--> statement-breakpoint
CREATE POLICY "ai_source_documents_select_staff" ON "ai_source_documents" AS PERMISSIVE FOR SELECT TO "authenticated" USING (app.is_staff(auth.uid(), NULL));--> statement-breakpoint
CREATE POLICY "ai_source_documents_service_role_all" ON "ai_source_documents" AS PERMISSIVE FOR ALL TO "service_role" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "ai_usage_limits_owner_select" ON "ai_usage_limits" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("ai_usage_limits"."student_profile_id" = auth.uid());--> statement-breakpoint
CREATE POLICY "ai_usage_limits_service_role_all" ON "ai_usage_limits" AS PERMISSIVE FOR ALL TO "service_role" USING (true) WITH CHECK (true);