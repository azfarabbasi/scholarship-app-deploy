"use client";

import { PanelLeftClose, PanelLeftOpen, Sparkles } from "lucide-react";
import { useCallback, useState } from "react";
import { AssistantChatView } from "./AssistantChat";
import { ConversationSidebar } from "./ConversationSidebar";
import { cn } from "@/lib/cn";
import { useAssistantChat, type ChatMessage } from "@/hooks/useAssistantChat";
import { getMyAiConversationMessages } from "@/lib/db/actions/student/ai-assistant";
import { getGuestAiMessages } from "@/lib/storage/ai-assistant";

interface AssistantWorkspaceProps {
  studentProfileId: string | null;
  suggestedPrompts: string[];
}

/**
 * The full-page Scholarly surface: a conversation sidebar beside the chat.
 *
 * The chat controller lives here rather than inside `AssistantChat` so the
 * sidebar can switch the visible thread and so a completed turn can refresh
 * the conversation list.
 */
export function AssistantWorkspace({ studentProfileId, suggestedPrompts }: AssistantWorkspaceProps) {
  const chat = useAssistantChat({ studentProfileId, scope: "general" });
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [refreshToken, setRefreshToken] = useState(0);
  const [loadingConversation, setLoadingConversation] = useState(false);

  const messageCount = chat.messages.length;
  const pending = chat.pending;

  // Refresh the sidebar whenever a turn finishes, so a brand-new conversation
  // (or an auto-derived title) shows up without a manual reload.
  const [lastSeen, setLastSeen] = useState({ count: 0, pending: false });
  if (lastSeen.count !== messageCount || lastSeen.pending !== pending) {
    setLastSeen({ count: messageCount, pending });
    if (!pending && messageCount > 0) setRefreshToken((token) => token + 1);
  }

  const handleSelect = useCallback(
    async (id: string) => {
      setLoadingConversation(true);
      try {
        const rows = studentProfileId ? await getMyAiConversationMessages(id) : await getGuestAiMessages(id);
        const loaded: ChatMessage[] = rows.map((row) => ({
          id: row.id,
          role: row.role === "user" ? "user" : "assistant",
          content: row.content,
          blockedReason: row.blockedReason ?? null,
          citations: "citations" in row && Array.isArray(row.citations) ? (row.citations as ChatMessage["citations"]) : [],
          assistantMessageId: row.role === "assistant" ? row.id : undefined,
        }));
        chat.loadConversation(id, loaded);
      } finally {
        setLoadingConversation(false);
      }
    },
    [studentProfileId, chat],
  );

  return (
    <div className="flex min-h-[70vh] gap-5">
      <aside
        className={cn(
          "shrink-0 transition-all duration-300",
          sidebarOpen ? "hidden w-72 lg:block" : "hidden w-0 overflow-hidden",
        )}
        aria-label="Conversations"
      >
        <div className="sticky top-20 h-[calc(100vh-7rem)] rounded-xl border border-border bg-surface p-3 shadow-e1">
          <ConversationSidebar
            studentProfileId={studentProfileId}
            activeConversationId={chat.activeConversationId}
            onSelect={(id) => void handleSelect(id)}
            onNewChat={chat.startNewConversation}
            refreshToken={refreshToken}
          />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col gap-4">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setSidebarOpen((open) => !open)}
            aria-expanded={sidebarOpen}
            className="hidden shrink-0 items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 py-2 text-xs font-medium text-foreground-muted transition-colors hover:bg-surface-muted hover:text-foreground lg:inline-flex focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)]"
          >
            {sidebarOpen ? (
              <PanelLeftClose className="h-4 w-4" aria-hidden="true" />
            ) : (
              <PanelLeftOpen className="h-4 w-4" aria-hidden="true" />
            )}
            {sidebarOpen ? "Hide chats" : "Show chats"}
          </button>

          {/* Plain text, not a bordered chip: as a chip it sat next to the real
              buttons and read as a third one, duplicating the sidebar's
              "New chat" action. This only ever reports state. */}
          <p className="flex items-center gap-1.5 text-xs text-foreground-subtle" aria-live="polite">
            <Sparkles className="h-3.5 w-3.5 text-brand" aria-hidden="true" />
            {loadingConversation
              ? "Loading chat…"
              : chat.activeConversationId
                ? "Continuing a saved chat"
                : chat.temporary
                  ? "Temporary — this chat won't be saved"
                  : "New chat"}
          </p>
        </div>

        <div className="flex min-h-0 flex-1 flex-col rounded-xl border border-border bg-background/40 p-4 sm:p-5">
          <AssistantChatView chat={chat} suggestedPrompts={suggestedPrompts} fill />
        </div>
      </div>
    </div>
  );
}
