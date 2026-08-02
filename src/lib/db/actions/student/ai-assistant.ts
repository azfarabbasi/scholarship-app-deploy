"use server";

import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { cookies } from "next/headers";
import { getStudentSession } from "@/lib/auth/student-session";
import { askAssistant, type AssistantAnswer, type AssistantResultKind } from "@/lib/ai/assistant";
import { getAiConfig } from "@/lib/ai/config";
import { GUEST_AI_QUOTA_COOKIE_NAME } from "@/lib/ai/rate-limit/guest";
import type { CitationDraft } from "@/lib/ai/rag/citations";
import { askAssistantActionInputSchema } from "@/lib/schemas/ai-assistant";
import { getDb, schema } from "@/lib/db/client";
import type { MatchResult } from "@/lib/matching/types";

/**
 * A cheap, read-only pre-check server components use to decide whether to
 * render the chat UI at all versus a static "unavailable" state — checks
 * both the env-level switch and the staff runtime kill switch, without
 * spending a provider call or a rate-limit slot the way a real question
 * would.
 */
export async function isAiAvailableAction(): Promise<boolean> {
  if (!getAiConfig().isAvailable) return false;
  try {
    const db = getDb();
    const [row] = await db.select({ manuallyDisabled: schema.aiProviderHealth.manuallyDisabled }).from(schema.aiProviderHealth).limit(1);
    return !row?.manuallyDisabled;
  } catch {
    // Fails closed: if the health check itself can't be answered, the
    // honest state is "not confirmed available," never "assume enabled."
    return false;
  }
}

/**
 * The one Server Action every AI-facing client component calls. It hides
 * the guest-vs-signed-in split from the UI: guests get their quota tracked
 * via a signed cookie this action reads and rewrites; signed-in students get
 * a durable DB counter, and their turn is persisted ONLY when they have
 * explicitly enabled AI history (see `getMyAiHistoryEnabled`/
 * `setMyAiHistoryEnabled` below) and did not request a temporary chat.
 */

const GUEST_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 48;

export type AiConversationScope = (typeof schema.aiConversationScopeEnum.enumValues)[number];

export interface AskAssistantActionInput {
  question: string;
  scope?: AiConversationScope;
  opportunitySlugs?: string[];
  matchResults?: Array<{ opportunitySlug: string; match: MatchResult }>;
  /** Existing conversation to append to — ignored for guests (guest conversations are managed entirely client-side against IndexedDB). */
  conversationId?: string | null;
  /** When true, this turn is never persisted server-side regardless of the student's history setting. */
  temporary?: boolean;
}

export interface AskAssistantActionResult {
  kind: AssistantResultKind;
  text: string;
  citations: CitationDraft[];
  blockedReason?: AssistantAnswer["blockedReason"];
  remainingQuota?: number;
  /** Present only when the turn was persisted for a signed-in student. */
  conversationId?: string;
  /** Present only when the turn was persisted — pass this to `submitAiFeedback`. */
  assistantMessageId?: string;
}

async function getDisplayPreferencesRow(studentProfileId: string) {
  const db = getDb();
  const [row] = await db
    .select()
    .from(schema.userDisplayPreferences)
    .where(eq(schema.userDisplayPreferences.studentProfileId, studentProfileId))
    .limit(1);
  return row ?? null;
}

/** Stored as a flag inside `user_display_preferences.dashboard_preferences` — a small UI setting, not worth a dedicated table/column. */
export async function getMyAiHistoryEnabled(): Promise<boolean> {
  const session = await getStudentSession();
  if (!session) return false;
  const row = await getDisplayPreferencesRow(session.studentProfileId);
  const prefs = (row?.dashboardPreferences ?? {}) as Record<string, unknown>;
  return prefs.aiHistoryEnabled === true;
}

export async function setMyAiHistoryEnabled(enabled: boolean): Promise<{ ok: boolean; error?: string }> {
  const session = await getStudentSession();
  if (!session) return { ok: false, error: "Not signed in." };

  const db = getDb();
  const existing = await getDisplayPreferencesRow(session.studentProfileId);
  const prefs = { ...((existing?.dashboardPreferences as Record<string, unknown>) ?? {}), aiHistoryEnabled: enabled };

  if (existing) {
    await db
      .update(schema.userDisplayPreferences)
      .set({ dashboardPreferences: prefs, updatedAt: new Date() })
      .where(eq(schema.userDisplayPreferences.studentProfileId, session.studentProfileId));
  } else {
    await db.insert(schema.userDisplayPreferences).values({ studentProfileId: session.studentProfileId, dashboardPreferences: prefs });
  }

  if (!enabled) {
    await clearMyAiHistory();
  }

  return { ok: true };
}

async function resolveOpportunityId(slug: string | null | undefined): Promise<string | null> {
  if (!slug) return null;
  const db = getDb();
  const [row] = await db
    .select({ id: schema.opportunities.id })
    .from(schema.opportunities)
    .where(and(eq(schema.opportunities.slug, slug), eq(schema.opportunities.status, "published")))
    .limit(1);
  return row?.id ?? null;
}

async function persistTurn(params: {
  studentProfileId: string;
  conversationId: string | null;
  scope: AiConversationScope;
  targetOpportunitySlug: string | null | undefined;
  question: string;
  answer: AssistantAnswer;
}): Promise<{ conversationId: string; assistantMessageId: string }> {
  const db = getDb();
  let conversationId = params.conversationId;

  if (conversationId) {
    const [existing] = await db
      .select({ id: schema.aiConversations.id })
      .from(schema.aiConversations)
      .where(and(eq(schema.aiConversations.id, conversationId), eq(schema.aiConversations.studentProfileId, params.studentProfileId)))
      .limit(1);
    if (!existing) conversationId = null;
  }

  if (!conversationId) {
    const targetOpportunityId = await resolveOpportunityId(params.targetOpportunitySlug);
    const [created] = await db
      .insert(schema.aiConversations)
      .values({
        studentProfileId: params.studentProfileId,
        scope: params.scope,
        targetOpportunityId,
        title: params.question.slice(0, 60),
      })
      .returning({ id: schema.aiConversations.id });
    conversationId = created.id;
  } else {
    await db.update(schema.aiConversations).set({ updatedAt: new Date() }).where(eq(schema.aiConversations.id, conversationId));
  }

  await db.insert(schema.aiMessages).values({
    conversationId,
    studentProfileId: params.studentProfileId,
    role: "user",
    content: params.question,
  });

  const [assistantMessage] = await db
    .insert(schema.aiMessages)
    .values({
      conversationId,
      studentProfileId: params.studentProfileId,
      role: "assistant",
      content: params.answer.text,
      blockedReason: params.answer.blockedReason ?? null,
    })
    .returning({ id: schema.aiMessages.id });

  if (params.answer.citations.length > 0) {
    await db.insert(schema.aiAnswerCitations).values(
      params.answer.citations.map((citation) => ({
        messageId: assistantMessage.id,
        studentProfileId: params.studentProfileId,
        citationType: citation.citationType,
        opportunityId: citation.opportunityId,
        officialSourceId: citation.officialSourceId,
        sourceChunkId: citation.sourceChunkId,
        label: citation.label,
        url: citation.url,
        verificationStatus: citation.verificationStatus,
        checkedAt: citation.checkedAt ? new Date(citation.checkedAt) : null,
      })),
    );
  }

  return { conversationId, assistantMessageId: assistantMessage.id };
}

const BLOCKED_INPUT_RESULT: AskAssistantActionResult = {
  kind: "blocked",
  text: "That message couldn't be processed. Please ask a shorter, specific question.",
  citations: [],
};

export async function askAssistantAction(rawInput: AskAssistantActionInput): Promise<AskAssistantActionResult> {
  // Every array field here (opportunitySlugs, matchResults) directly drives
  // how much structured-fact context gets assembled into the prompt — an
  // unbounded array from a malicious or malfunctioning caller is an
  // unbounded prompt, independent of the token-budget trim in
  // `src/lib/ai/rag/retrieval.ts` (defense in depth, not a substitute for it).
  const parsed = askAssistantActionInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    return BLOCKED_INPUT_RESULT;
  }
  const input = parsed.data;

  const session = await getStudentSession();
  const scope: AiConversationScope = input.scope ?? "general";
  const matchResults = input.matchResults
    ? new Map(input.matchResults.map((entry) => [entry.opportunitySlug, entry.match]))
    : undefined;

  if (session) {
    const answer = await askAssistant({
      question: input.question,
      opportunitySlugs: input.opportunitySlugs,
      matchResults,
      requester: { kind: "student", studentProfileId: session.studentProfileId },
    });

    let conversationId: string | undefined;
    let assistantMessageId: string | undefined;
    if (answer.kind === "answered" && !input.temporary) {
      const historyEnabled = await getMyAiHistoryEnabled();
      if (historyEnabled) {
        const persisted = await persistTurn({
          studentProfileId: session.studentProfileId,
          conversationId: input.conversationId ?? null,
          scope,
          targetOpportunitySlug: input.opportunitySlugs?.[0],
          question: input.question,
          answer,
        });
        conversationId = persisted.conversationId;
        assistantMessageId = persisted.assistantMessageId;
      }
    }

    return {
      kind: answer.kind,
      text: answer.text,
      citations: answer.citations,
      blockedReason: answer.blockedReason,
      remainingQuota: answer.remainingQuota,
      conversationId,
      assistantMessageId,
    };
  }

  const cookieStore = await cookies();
  const existingCookie = cookieStore.get(GUEST_AI_QUOTA_COOKIE_NAME)?.value ?? null;
  const answer = await askAssistant({
    question: input.question,
    opportunitySlugs: input.opportunitySlugs,
    matchResults,
    requester: { kind: "guest", guestCookieValue: existingCookie },
  });

  if (answer.nextGuestCookieValue) {
    cookieStore.set(GUEST_AI_QUOTA_COOKIE_NAME, answer.nextGuestCookieValue, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: GUEST_COOKIE_MAX_AGE_SECONDS,
      secure: process.env.NODE_ENV === "production",
    });
  }

  return { kind: answer.kind, text: answer.text, citations: answer.citations, blockedReason: answer.blockedReason, remainingQuota: answer.remainingQuota };
}

// --- Signed-in conversation history (read/manage only what history-enabled persisted) ---------

export type AiConversationRow = typeof schema.aiConversations.$inferSelect;
export type AiMessageRow = typeof schema.aiMessages.$inferSelect;
export type AiAnswerCitationRow = typeof schema.aiAnswerCitations.$inferSelect;

/**
 * Pinned conversations first (most recently pinned first), then everything else
 * by recency. `pinnedAt DESC NULLS LAST` does both in one ordering: an unpinned
 * row has a null `pinnedAt` and so always sorts after every pinned one.
 */
export async function getMyAiConversations(): Promise<AiConversationRow[]> {
  const session = await getStudentSession();
  if (!session) return [];
  const db = getDb();
  return db
    .select()
    .from(schema.aiConversations)
    .where(eq(schema.aiConversations.studentProfileId, session.studentProfileId))
    .orderBy(sql`${schema.aiConversations.pinnedAt} DESC NULLS LAST`, desc(schema.aiConversations.updatedAt));
}

/** Max length accepted for a conversation title, matching the input's maxLength. */
const MAX_CONVERSATION_TITLE = 120;

export async function renameMyAiConversation(
  id: string,
  title: string,
): Promise<{ ok: boolean; error?: string }> {
  const session = await getStudentSession();
  if (!session) return { ok: false, error: "Not signed in." };

  const trimmed = title.trim();
  if (trimmed.length === 0) return { ok: false, error: "Title cannot be empty." };
  if (trimmed.length > MAX_CONVERSATION_TITLE) {
    return { ok: false, error: `Title must be ${MAX_CONVERSATION_TITLE} characters or fewer.` };
  }

  const db = getDb();
  // The ownership predicate is part of the UPDATE, not a prior SELECT, so a
  // caller can never rename another student's conversation by guessing an id.
  const result = await db
    .update(schema.aiConversations)
    .set({ title: trimmed, updatedAt: new Date() })
    .where(and(eq(schema.aiConversations.id, id), eq(schema.aiConversations.studentProfileId, session.studentProfileId)))
    .returning({ id: schema.aiConversations.id });

  if (result.length === 0) return { ok: false, error: "Conversation not found." };
  return { ok: true };
}

export async function setMyAiConversationPinned(
  id: string,
  pinned: boolean,
): Promise<{ ok: boolean; error?: string }> {
  const session = await getStudentSession();
  if (!session) return { ok: false, error: "Not signed in." };

  const db = getDb();
  // `updatedAt` is deliberately left alone: pinning is not a content edit, and
  // touching it would reorder the unpinned list the moment a chat is unpinned.
  const result = await db
    .update(schema.aiConversations)
    .set({ pinnedAt: pinned ? new Date() : null })
    .where(and(eq(schema.aiConversations.id, id), eq(schema.aiConversations.studentProfileId, session.studentProfileId)))
    .returning({ id: schema.aiConversations.id });

  if (result.length === 0) return { ok: false, error: "Conversation not found." };
  return { ok: true };
}

export async function getMyAiConversationMessages(
  conversationId: string,
): Promise<Array<AiMessageRow & { citations: AiAnswerCitationRow[] }>> {
  const session = await getStudentSession();
  if (!session) return [];

  const db = getDb();
  const [conversation] = await db
    .select({ id: schema.aiConversations.id })
    .from(schema.aiConversations)
    .where(and(eq(schema.aiConversations.id, conversationId), eq(schema.aiConversations.studentProfileId, session.studentProfileId)))
    .limit(1);
  if (!conversation) return [];

  const messages = await db
    .select()
    .from(schema.aiMessages)
    .where(eq(schema.aiMessages.conversationId, conversationId))
    .orderBy(asc(schema.aiMessages.createdAt));
  if (messages.length === 0) return [];

  const citations = await db
    .select()
    .from(schema.aiAnswerCitations)
    .where(inArray(schema.aiAnswerCitations.messageId, messages.map((message) => message.id)));
  const citationsByMessage = new Map<string, AiAnswerCitationRow[]>();
  for (const citation of citations) {
    const list = citationsByMessage.get(citation.messageId) ?? [];
    list.push(citation);
    citationsByMessage.set(citation.messageId, list);
  }

  return messages.map((message) => ({ ...message, citations: citationsByMessage.get(message.id) ?? [] }));
}

export async function deleteMyAiConversation(id: string): Promise<{ ok: boolean; error?: string }> {
  const session = await getStudentSession();
  if (!session) return { ok: false, error: "Not signed in." };
  const db = getDb();
  const result = await db
    .delete(schema.aiConversations)
    .where(and(eq(schema.aiConversations.id, id), eq(schema.aiConversations.studentProfileId, session.studentProfileId)))
    .returning({ id: schema.aiConversations.id });
  if (result.length === 0) return { ok: false, error: "Conversation not found." };
  return { ok: true };
}

/** Deletes every persisted conversation/message/citation for the signed-in student — used by "clear cloud history" and when history is disabled. */
export async function clearMyAiHistory(): Promise<{ ok: boolean; error?: string }> {
  const session = await getStudentSession();
  if (!session) return { ok: false, error: "Not signed in." };
  const db = getDb();
  await db.delete(schema.aiConversations).where(eq(schema.aiConversations.studentProfileId, session.studentProfileId));
  return { ok: true };
}

// --- Feedback ------------------------------------------------------------------------

export type AiFeedbackRating = (typeof schema.aiFeedbackRatingEnum.enumValues)[number];

/**
 * Requires a signed-in student and a message they own — `ai_messages`/
 * `ai_feedback` both require a real persisted message row, which only exists
 * for a signed-in student with AI history enabled. A guest (or a signed-in
 * student who has not enabled history) has nothing server-side to attach
 * feedback to; the assistant UI only shows the feedback control on messages
 * that came back with a `conversationId`.
 */
export async function submitAiFeedback(input: {
  messageId: string;
  rating: AiFeedbackRating;
  comment?: string;
}): Promise<{ ok: boolean; error?: string }> {
  const session = await getStudentSession();
  if (!session) return { ok: false, error: "Not signed in." };

  const db = getDb();
  const [message] = await db
    .select({ id: schema.aiMessages.id })
    .from(schema.aiMessages)
    .where(and(eq(schema.aiMessages.id, input.messageId), eq(schema.aiMessages.studentProfileId, session.studentProfileId)))
    .limit(1);
  if (!message) return { ok: false, error: "Message not found." };

  await db.insert(schema.aiFeedback).values({
    messageId: input.messageId,
    studentProfileId: session.studentProfileId,
    rating: input.rating,
    comment: input.comment?.trim() ? input.comment.trim().slice(0, 1000) : null,
  });

  return { ok: true };
}
