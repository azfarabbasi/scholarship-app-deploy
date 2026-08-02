"use client";

import { useCallback, useState } from "react";
import type { AssistantResultKind } from "@/lib/ai/assistant";
import { trackEvent } from "@/lib/analytics";
import { addGuestAiMessage, createGuestAiConversation } from "@/lib/storage/ai-assistant";
import {
  askAssistantAction,
  submitAiFeedback,
  type AiConversationScope,
  type AiFeedbackRating,
} from "@/lib/db/actions/student/ai-assistant";
import type { CitationDraft } from "@/lib/ai/rag/citations";
import type { MatchResult } from "@/lib/matching/types";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  blockedReason?: string | null;
  citations: CitationDraft[];
  /** Present only for a signed-in, history-enabled turn — required to submit feedback. */
  assistantMessageId?: string;
  feedbackSubmitted?: boolean;
}

export interface UseAssistantChatOptions {
  studentProfileId: string | null;
  scope: AiConversationScope;
  opportunitySlugs?: string[];
  matchResults?: Array<{ opportunitySlug: string; match: MatchResult }>;
  /** Starts the "temporary chat" toggle already on — used by surfaces (like the floating Scholarly widget) that never offer a way to view saved history, so a turn would otherwise persist silently with no way to find it again. */
  defaultTemporary?: boolean;
}

/**
 * Shared chat state/logic behind every assistant surface (general, opportunity
 * detail, workspace, comparison, matching-explanation). Handles both
 * persistence paths transparently: signed-in students get cloud persistence
 * via `askAssistantAction` (only when they've enabled history and this isn't
 * a temporary chat); guests get local IndexedDB persistence via
 * `src/lib/storage/ai-assistant.ts` under the same condition. Neither path
 * ever runs when `temporary` is on — messages then live only in this
 * component's React state for the current page view.
 */
export function useAssistantChat(options: UseAssistantChatOptions) {
  const { studentProfileId, scope, opportunitySlugs, matchResults, defaultTemporary } = options;
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [pending, setPending] = useState(false);
  const [statusKind, setStatusKind] = useState<AssistantResultKind | null>(null);
  const [statusText, setStatusText] = useState<string | null>(null);
  const [remainingQuota, setRemainingQuota] = useState<number | null>(null);
  const [temporary, setTemporary] = useState(defaultTemporary ?? false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [guestConversationId, setGuestConversationId] = useState<string | null>(null);

  const sendMessage = useCallback(
    async (question: string) => {
      const trimmed = question.trim();
      if (!trimmed || pending) return;

      setPending(true);
      setStatusKind(null);
      setStatusText(null);

      const userMessage: ChatMessage = { id: crypto.randomUUID(), role: "user", content: trimmed, citations: [] };
      setMessages((prev) => [...prev, userMessage]);

      try {
        const result = await askAssistantAction({
          question: trimmed,
          scope,
          opportunitySlugs,
          matchResults,
          conversationId: conversationId ?? undefined,
          temporary,
        });

        setStatusKind(result.kind);
        setStatusText(result.kind === "answered" ? null : result.text);
        if (typeof result.remainingQuota === "number") setRemainingQuota(result.remainingQuota);

        // "unavailable"/"rate-limited"/"provider-error" are system-level
        // states shown once via the status banner, not a conversational
        // reply — only "answered" and "blocked" (a natural-reading refusal)
        // become an assistant chat bubble.
        if (result.kind === "answered" || result.kind === "blocked") {
          const assistantMessage: ChatMessage = {
            id: crypto.randomUUID(),
            role: "assistant",
            content: result.text,
            blockedReason: result.blockedReason ?? null,
            citations: result.citations,
            assistantMessageId: result.assistantMessageId,
          };
          setMessages((prev) => [...prev, assistantMessage]);
        }

        if (result.conversationId) {
          setConversationId(result.conversationId);
        }

        if (!studentProfileId && !temporary && result.kind === "answered") {
          let localConversationId = guestConversationId;
          if (!localConversationId) {
            const created = await createGuestAiConversation(scope, opportunitySlugs?.[0] ?? null);
            localConversationId = created.id;
            setGuestConversationId(localConversationId);
          }
          await addGuestAiMessage({ conversationId: localConversationId, role: "user", content: trimmed, blockedReason: null, citations: [] });
          await addGuestAiMessage({
            conversationId: localConversationId,
            role: "assistant",
            content: result.text,
            blockedReason: result.blockedReason ?? null,
            citations: result.citations,
          });
        }
      } catch {
        setStatusKind("provider-error");
        setStatusText("Something went wrong sending that question. Please try again.");
      } finally {
        setPending(false);
      }
    },
    [pending, scope, opportunitySlugs, matchResults, conversationId, temporary, studentProfileId, guestConversationId],
  );

  const giveFeedback = useCallback(async (message: ChatMessage, rating: AiFeedbackRating, comment?: string) => {
    if (!message.assistantMessageId) {
      return { ok: false, error: "Feedback isn't available for this message (AI history isn't enabled)." };
    }
    const result = await submitAiFeedback({ messageId: message.assistantMessageId, rating, comment });
    if (result.ok) {
      setMessages((prev) => prev.map((m) => (m.id === message.id ? { ...m, feedbackSubmitted: true } : m)));
      trackEvent("ai_answer_feedback_category", { rating });
    }
    return result;
  }, []);

  /**
   * Replaces the visible thread with an already-persisted conversation, so the
   * sidebar can switch between saved chats and continued turns append to the
   * right one. Both id slots are set because which one the next `sendMessage`
   * uses depends on whether the caller is signed in (server conversation) or a
   * guest (IndexedDB conversation).
   */
  const loadConversation = useCallback(
    (id: string, loadedMessages: ChatMessage[]) => {
      setMessages(loadedMessages);
      setStatusKind(null);
      setStatusText(null);
      if (studentProfileId) {
        setConversationId(id);
        setGuestConversationId(null);
      } else {
        setGuestConversationId(id);
        setConversationId(null);
      }
    },
    [studentProfileId],
  );

  /** Clears the thread so the next turn opens a brand-new conversation. */
  const startNewConversation = useCallback(() => {
    setMessages([]);
    setStatusKind(null);
    setStatusText(null);
    setConversationId(null);
    setGuestConversationId(null);
  }, []);

  return {
    messages,
    pending,
    statusKind,
    statusText,
    remainingQuota,
    temporary,
    setTemporary,
    sendMessage,
    giveFeedback,
    loadConversation,
    startNewConversation,
    /** The conversation the next turn will append to, or null for a fresh thread. */
    activeConversationId: studentProfileId ? conversationId : guestConversationId,
  };
}
