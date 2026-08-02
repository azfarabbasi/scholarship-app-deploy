import { sql } from "drizzle-orm";
import { boolean, date, integer, jsonb, pgPolicy, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { auditTimestamps, ownerAllPolicy, publicSelectPolicy, serviceRoleBypassPolicy, staffSelectPolicy } from "./common";
import {
  aiCitationSourceTypeEnum,
  aiConversationScopeEnum,
  aiEvaluationResultEnum,
  aiFeedbackRatingEnum,
  aiMessageRoleEnum,
  aiSafetyEventKindEnum,
  aiSourceStatusEnum,
  aiUsageSubjectTypeEnum,
} from "./enums";
import { eligibilityRules } from "./eligibility";
import { opportunityDocumentRequirements } from "./documents";
import { opportunities } from "./opportunities";
import { officialSources, sourceEvidence } from "./sources";
import { authenticatedRole } from "./roles";
import { staffProfiles } from "./staff";
import { studentProfiles } from "./student";

/**
 * Checkpoint 5: a source-grounded AI assistant. Every table here either (a)
 * holds staff-curated, publicly-retrievable source material with its own
 * approval lifecycle (never implicitly "verified" just because it was
 * chunked — see ADR-010), or (b) holds a signed-in student's own AI activity,
 * owner-scoped exactly like the Checkpoint 3/4 workspace tables. See
 * `docs/checkpoint-5/checkpoint-5-architecture.md`.
 */

// --- Source material (staff-managed, feeds retrieval) -----------------------------

/**
 * A staff-authored excerpt of official-source text — plain text only, never
 * a file. Optionally linked back to existing verification evidence, a
 * specific required-document requirement, or a specific eligibility rule, so
 * staff can trace an excerpt to the fact it supports. Being linked or
 * chunked never implies AI-retrieval approval; only `status = 'approved'`
 * does.
 */
export const aiSourceDocuments = pgTable(
  "ai_source_documents",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    opportunityId: uuid("opportunity_id").references(() => opportunities.id, { onDelete: "cascade" }),
    officialSourceId: uuid("official_source_id").references(() => officialSources.id, { onDelete: "restrict" }),
    sourceEvidenceId: uuid("source_evidence_id").references(() => sourceEvidence.id, { onDelete: "set null" }),
    requiredDocumentId: uuid("required_document_id").references(() => opportunityDocumentRequirements.id, { onDelete: "set null" }),
    eligibilityRuleId: uuid("eligibility_rule_id").references(() => eligibilityRules.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    sourceText: text("source_text").notNull(),
    status: aiSourceStatusEnum("status").notNull().default("draft"),
    staleReason: text("stale_reason"),
    checkedAt: timestamp("checked_at", { withTimezone: true }),
    createdByStaffProfileId: uuid("created_by_staff_profile_id").references(() => staffProfiles.id),
    approvedByStaffProfileId: uuid("approved_by_staff_profile_id").references(() => staffProfiles.id),
    ...auditTimestamps,
  },
  (table) => [
    publicSelectPolicy(
      "ai_source_documents",
      sql`${table.status} = 'approved' AND (${table.opportunityId} IS NULL OR EXISTS (SELECT 1 FROM opportunities o WHERE o.id = ${table.opportunityId} AND o.status = 'published'))`,
    ),
    staffSelectPolicy("ai_source_documents"),
    serviceRoleBypassPolicy("ai_source_documents"),
  ],
).enableRLS();

/**
 * Retrieval-sized pieces of a document's text (see
 * `src/lib/ai/rag/chunking.ts`). `opportunityId`/`officialSourceId` are
 * denormalized copies of the parent document's, purely so a retrieval query
 * never needs a join; `status` is likewise synced from the parent document
 * whenever it's (re)approved — "rebuild chunks" re-derives both.
 */
export const aiSourceChunks = pgTable(
  "ai_source_chunks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    documentId: uuid("document_id")
      .notNull()
      .references(() => aiSourceDocuments.id, { onDelete: "cascade" }),
    opportunityId: uuid("opportunity_id").references(() => opportunities.id, { onDelete: "cascade" }),
    officialSourceId: uuid("official_source_id").references(() => officialSources.id, { onDelete: "set null" }),
    chunkIndex: integer("chunk_index").notNull().default(0),
    chunkText: text("chunk_text").notNull(),
    status: aiSourceStatusEnum("status").notNull().default("draft"),
    tokenCountEstimate: integer("token_count_estimate").notNull().default(0),
    ...auditTimestamps,
  },
  (table) => [
    publicSelectPolicy(
      "ai_source_chunks",
      sql`${table.status} = 'approved' AND (${table.opportunityId} IS NULL OR EXISTS (SELECT 1 FROM opportunities o WHERE o.id = ${table.opportunityId} AND o.status = 'published'))`,
    ),
    staffSelectPolicy("ai_source_chunks"),
    serviceRoleBypassPolicy("ai_source_chunks"),
  ],
).enableRLS();

/** The active system-prompt template(s) — versioned so a prompt change is traceable, never edited via a public/student-facing UI. */
export const aiPromptTemplates = pgTable(
  "ai_prompt_templates",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    key: text("key").notNull(),
    version: integer("version").notNull().default(1),
    content: text("content").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    ...auditTimestamps,
  },
  (table) => [
    uniqueIndex("ai_prompt_templates_key_unique").on(table.key),
    staffSelectPolicy("ai_prompt_templates"),
    serviceRoleBypassPolicy("ai_prompt_templates"),
  ],
).enableRLS();

// --- Signed-in conversation history (owner-scoped, never staff-visible) -----------

/** A signed-in student's own AI conversation. Guests never get a row here — guest history stays local (IndexedDB) unless the student signs in and enables cloud history. */
export const aiConversations = pgTable(
  "ai_conversations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    studentProfileId: uuid("student_profile_id")
      .notNull()
      .references(() => studentProfiles.id, { onDelete: "cascade" }),
    scope: aiConversationScopeEnum("scope").notNull(),
    targetOpportunityId: uuid("target_opportunity_id").references(() => opportunities.id, { onDelete: "set null" }),
    title: text("title").notNull().default(""),
    /**
     * When the student pinned this conversation, or null if unpinned. A
     * timestamp rather than a boolean so pinned conversations keep a stable,
     * meaningful order among themselves (most recently pinned first) instead of
     * re-shuffling on every `updatedAt` touch.
     */
    pinnedAt: timestamp("pinned_at", { withTimezone: true }),
    ...auditTimestamps,
  },
  (table) => [ownerAllPolicy("ai_conversations", table.studentProfileId), serviceRoleBypassPolicy("ai_conversations")],
).enableRLS();

/** `studentProfileId` is denormalized from the parent conversation so RLS never needs a subquery/join. */
export const aiMessages = pgTable(
  "ai_messages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => aiConversations.id, { onDelete: "cascade" }),
    studentProfileId: uuid("student_profile_id")
      .notNull()
      .references(() => studentProfiles.id, { onDelete: "cascade" }),
    role: aiMessageRoleEnum("role").notNull(),
    content: text("content").notNull(),
    blockedReason: text("blocked_reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // Deliberately NOT the shared `ownerAllPolicy` helper: checking only
    // `student_profile_id = auth.uid()` would let a student attach a
    // message (with their own id) to a *conversation they don't own* by
    // forging `conversation_id` — the EXISTS clause additionally requires
    // the parent conversation to belong to the same caller.
    pgPolicy("ai_messages_owner_all", {
      as: "permissive",
      for: "all",
      to: authenticatedRole,
      using: sql`${table.studentProfileId} = auth.uid() AND EXISTS (SELECT 1 FROM ai_conversations c WHERE c.id = ${table.conversationId} AND c.student_profile_id = auth.uid())`,
      withCheck: sql`${table.studentProfileId} = auth.uid() AND EXISTS (SELECT 1 FROM ai_conversations c WHERE c.id = ${table.conversationId} AND c.student_profile_id = auth.uid())`,
    }),
    serviceRoleBypassPolicy("ai_messages"),
  ],
).enableRLS();

/** Every factual claim in an assistant message must have a row here — never rendered without one (see `src/lib/ai/rag/citations.ts`). */
export const aiAnswerCitations = pgTable(
  "ai_answer_citations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    messageId: uuid("message_id")
      .notNull()
      .references(() => aiMessages.id, { onDelete: "cascade" }),
    studentProfileId: uuid("student_profile_id")
      .notNull()
      .references(() => studentProfiles.id, { onDelete: "cascade" }),
    citationType: aiCitationSourceTypeEnum("citation_type").notNull(),
    opportunityId: uuid("opportunity_id").references(() => opportunities.id, { onDelete: "set null" }),
    officialSourceId: uuid("official_source_id").references(() => officialSources.id, { onDelete: "set null" }),
    sourceChunkId: uuid("source_chunk_id").references(() => aiSourceChunks.id, { onDelete: "set null" }),
    label: text("label").notNull(),
    url: text("url"),
    verificationStatus: text("verification_status"),
    checkedAt: timestamp("checked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // Same reasoning as `ai_messages` above: also requires the referenced
    // message to belong to the caller, not just a matching `student_profile_id`.
    pgPolicy("ai_answer_citations_owner_all", {
      as: "permissive",
      for: "all",
      to: authenticatedRole,
      using: sql`${table.studentProfileId} = auth.uid() AND EXISTS (SELECT 1 FROM ai_messages m WHERE m.id = ${table.messageId} AND m.student_profile_id = auth.uid())`,
      withCheck: sql`${table.studentProfileId} = auth.uid() AND EXISTS (SELECT 1 FROM ai_messages m WHERE m.id = ${table.messageId} AND m.student_profile_id = auth.uid())`,
    }),
    serviceRoleBypassPolicy("ai_answer_citations"),
  ],
).enableRLS();

/**
 * What was retrieved for a given message — kept owner-visible only
 * (deliberately **no** staff-select policy, matching the Checkpoint 4
 * discovery-data precedent: staff coverage diagnostics are computed from
 * public chunk/opportunity data alone, never from a student's own retrieval
 * history).
 */
export const aiRetrievalEvents = pgTable(
  "ai_retrieval_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    messageId: uuid("message_id")
      .notNull()
      .references(() => aiMessages.id, { onDelete: "cascade" }),
    studentProfileId: uuid("student_profile_id")
      .notNull()
      .references(() => studentProfiles.id, { onDelete: "cascade" }),
    retrievedChunkIds: jsonb("retrieved_chunk_ids").notNull().default(sql`'[]'::jsonb`),
    chunkCount: integer("chunk_count").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // Same reasoning as `ai_messages` above.
    pgPolicy("ai_retrieval_events_owner_all", {
      as: "permissive",
      for: "all",
      to: authenticatedRole,
      using: sql`${table.studentProfileId} = auth.uid() AND EXISTS (SELECT 1 FROM ai_messages m WHERE m.id = ${table.messageId} AND m.student_profile_id = auth.uid())`,
      withCheck: sql`${table.studentProfileId} = auth.uid() AND EXISTS (SELECT 1 FROM ai_messages m WHERE m.id = ${table.messageId} AND m.student_profile_id = auth.uid())`,
    }),
    serviceRoleBypassPolicy("ai_retrieval_events"),
  ],
).enableRLS();

/**
 * Feedback is deliberately **not** private the way conversations are: like
 * `correction_reports`, it's content the student chose to submit for staff
 * review, so staff get read access here (never for conversations/citations
 * themselves). `studentProfileId` is nullable — a guest can leave feedback,
 * which then has no RLS "owner" and is visible only to staff/service-role.
 */
export const aiFeedback = pgTable(
  "ai_feedback",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    messageId: uuid("message_id")
      .notNull()
      .references(() => aiMessages.id, { onDelete: "cascade" }),
    studentProfileId: uuid("student_profile_id").references(() => studentProfiles.id, { onDelete: "set null" }),
    rating: aiFeedbackRatingEnum("rating").notNull(),
    comment: text("comment"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // Same forged-parent-id reasoning as `ai_messages` above: also requires
    // the referenced message to belong to the caller, not just a matching
    // `student_profile_id` — otherwise a student could attach feedback to
    // another student's message.
    pgPolicy("ai_feedback_owner_all", {
      as: "permissive",
      for: "all",
      to: authenticatedRole,
      using: sql`${table.studentProfileId} = auth.uid() AND EXISTS (SELECT 1 FROM ai_messages m WHERE m.id = ${table.messageId} AND m.student_profile_id = auth.uid())`,
      withCheck: sql`${table.studentProfileId} = auth.uid() AND EXISTS (SELECT 1 FROM ai_messages m WHERE m.id = ${table.messageId} AND m.student_profile_id = auth.uid())`,
    }),
    staffSelectPolicy("ai_feedback"),
    serviceRoleBypassPolicy("ai_feedback"),
  ],
).enableRLS();

/**
 * Safety/abuse records — staff-visible like the audit log (never
 * owner-visible; this is an operational monitoring record, not a personal
 * one). `redactedSummary` must never contain the full raw prompt or answer.
 */
export const aiSafetyEvents = pgTable(
  "ai_safety_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    studentProfileId: uuid("student_profile_id").references(() => studentProfiles.id, { onDelete: "set null" }),
    messageId: uuid("message_id").references(() => aiMessages.id, { onDelete: "set null" }),
    kind: aiSafetyEventKindEnum("kind").notNull(),
    redactedSummary: text("redacted_summary").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  // Matches `canViewAiSafetyLog` in `src/lib/auth/permissions.ts` —
  // administrator-only; these events can reference a specific student.
  () => [staffSelectPolicy("ai_safety_events", ["administrator"]), serviceRoleBypassPolicy("ai_safety_events")],
).enableRLS();

// --- Evaluation harness (staff/internal only) --------------------------------------

/** Fixture questions the evaluation harness runs against the (mock, by default) provider — see `scripts/ai-evaluate.ts`. */
export const aiEvaluationCases = pgTable(
  "ai_evaluation_cases",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    key: text("key").notNull(),
    scope: aiConversationScopeEnum("scope").notNull().default("general"),
    prompt: text("prompt").notNull(),
    expectations: jsonb("expectations").notNull().default(sql`'{}'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("ai_evaluation_cases_key_unique").on(table.key), staffSelectPolicy("ai_evaluation_cases"), serviceRoleBypassPolicy("ai_evaluation_cases")],
).enableRLS();

export const aiEvaluationRuns = pgTable(
  "ai_evaluation_runs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    evaluationCaseId: uuid("evaluation_case_id")
      .notNull()
      .references(() => aiEvaluationCases.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(),
    result: aiEvaluationResultEnum("result").notNull(),
    details: jsonb("details").notNull().default(sql`'{}'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  () => [staffSelectPolicy("ai_evaluation_runs"), serviceRoleBypassPolicy("ai_evaluation_runs")],
).enableRLS();

// --- Rate limiting and provider health ---------------------------------------------

/**
 * Daily per-signed-in-user request counters. Guests are limited via a
 * signed, client-held cookie instead (see
 * `src/lib/ai/rate-limit/guest.ts`) — never a growing table of anonymous
 * device identifiers. A student may **read** their own usage (Checkpoint 0's
 * permission matrix lists "View AI usage" as Student:Own) but never write to
 * it directly — only our server increments it, which is why this gets a
 * hand-written read-only policy rather than `ownerAllPolicy`.
 */
export const aiUsageLimits = pgTable(
  "ai_usage_limits",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    subjectType: aiUsageSubjectTypeEnum("subject_type").notNull().default("user"),
    studentProfileId: uuid("student_profile_id")
      .notNull()
      .references(() => studentProfiles.id, { onDelete: "cascade" }),
    usageDate: date("usage_date").notNull(),
    requestCount: integer("request_count").notNull().default(0),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("ai_usage_limits_student_date_unique").on(table.studentProfileId, table.usageDate),
    pgPolicy("ai_usage_limits_owner_select", {
      as: "permissive",
      for: "select",
      to: authenticatedRole,
      using: sql`${table.studentProfileId} = auth.uid()`,
    }),
    serviceRoleBypassPolicy("ai_usage_limits"),
  ],
).enableRLS();

/**
 * Single-row-per-check provider health/runtime-control record. Staff
 * (administrator, via a Server Action) can flip `manually_disabled` to pause
 * AI instantly without a redeploy — a runtime kill switch distinct from the
 * `AI_ENABLED` env var, which only takes effect on the next deploy/restart.
 */
export const aiProviderHealth = pgTable(
  "ai_provider_health",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    manuallyDisabled: boolean("manually_disabled").notNull().default(false),
    disabledReason: text("disabled_reason"),
    disabledByStaffProfileId: uuid("disabled_by_staff_profile_id").references(() => staffProfiles.id),
    disabledAt: timestamp("disabled_at", { withTimezone: true }),
    lastCheckedAt: timestamp("last_checked_at", { withTimezone: true }),
    lastStatus: text("last_status"),
    lastError: text("last_error"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  // Matches `canDisableAi` in `src/lib/auth/permissions.ts` —
  // administrator-only; the app's own AI-availability check reads this
  // through the privileged server connection, not direct REST.
  () => [staffSelectPolicy("ai_provider_health", ["administrator"]), serviceRoleBypassPolicy("ai_provider_health")],
).enableRLS();
