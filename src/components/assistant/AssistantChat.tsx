"use client";

import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { ExternalLink, Send, Sparkles, ThumbsDown, ThumbsUp } from "lucide-react";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { useLiveAnnouncer } from "@/components/common/LiveAnnouncer";
import { useAssistantChat, type ChatMessage, type UseAssistantChatOptions } from "@/hooks/useAssistantChat";

const CITATION_TYPE_LABEL: Record<string, string> = {
  "official-source": "Official source",
  "structured-data": "ScholarTrack data",
  "workspace-context": "Your workspace",
  "match-explanation": "Match explanation",
};

function CitationList({ citations }: { citations: ChatMessage["citations"] }) {
  if (citations.length === 0) return null;
  return (
    <ul className="mt-2 flex flex-col gap-1.5 border-t border-border pt-2">
      {citations.map((citation, index) => (
        <li key={index} className="flex flex-wrap items-center gap-1.5 text-xs text-foreground-muted">
          <Badge tone="neutral">{CITATION_TYPE_LABEL[citation.citationType] ?? citation.citationType}</Badge>
          <span>{citation.label}</span>
          {citation.verificationStatus ? <span>· {citation.verificationStatus.replace(/-/g, " ")}</span> : null}
          {citation.checkedAt ? <span>· checked {new Date(citation.checkedAt).toLocaleDateString()}</span> : null}
          {citation.url ? (
            <a
              href={citation.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-0.5 text-brand hover:underline"
            >
              Official link <ExternalLink className="h-3 w-3" aria-hidden="true" />
            </a>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

function FeedbackControls({
  message,
  onFeedback,
}: {
  message: ChatMessage;
  onFeedback: (message: ChatMessage, rating: "helpful" | "not-helpful") => void;
}) {
  if (!message.assistantMessageId) return null;
  if (message.feedbackSubmitted) {
    return <p className="mt-2 text-xs text-foreground-subtle">Thanks for the feedback.</p>;
  }
  return (
    <div className="mt-2 flex items-center gap-2">
      <span className="text-xs text-foreground-subtle">Was this helpful?</span>
      <button
        type="button"
        onClick={() => onFeedback(message, "helpful")}
        className="rounded-md p-1 text-foreground-muted hover:bg-surface-muted hover:text-success"
        aria-label="Helpful"
      >
        <ThumbsUp className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
      <button
        type="button"
        onClick={() => onFeedback(message, "not-helpful")}
        className="rounded-md p-1 text-foreground-muted hover:bg-surface-muted hover:text-danger"
        aria-label="Not helpful"
      >
        <ThumbsDown className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
    </div>
  );
}

function MessageBubble({
  message,
  onFeedback,
}: {
  message: ChatMessage;
  onFeedback: (message: ChatMessage, rating: "helpful" | "not-helpful") => void;
}) {
  const isUser = message.role === "user";
  return (
    <div className={isUser ? "flex justify-end" : "flex justify-start"} data-testid={isUser ? "user-message" : "assistant-message"}>
      <div
        className={
          isUser
            ? "max-w-[85%] rounded-lg bg-brand px-3.5 py-2.5 text-sm text-brand-foreground"
            : "max-w-[85%] rounded-lg border border-border bg-surface px-3.5 py-2.5 text-sm text-foreground"
        }
      >
        {!isUser ? (
          <div className="mb-1 flex items-center gap-1 text-xs font-medium text-brand">
            <Sparkles className="h-3 w-3" aria-hidden="true" />
            Scholarly
          </div>
        ) : null}
        <p className="whitespace-pre-wrap">{message.content}</p>
        {!isUser ? <CitationList citations={message.citations} /> : null}
        {!isUser ? <FeedbackControls message={message} onFeedback={onFeedback} /> : null}
      </div>
    </div>
  );
}

const STATUS_TONE: Record<string, "warning" | "danger"> = {
  unavailable: "warning",
  "rate-limited": "warning",
  blocked: "warning",
  "provider-error": "danger",
};

export interface AssistantChatProps extends UseAssistantChatOptions {
  placeholder?: string;
  emptyStateText?: string;
  /** Short example questions shown as clickable chips while the conversation is empty — fills the input, doesn't send automatically. */
  suggestedPrompts?: string[];
  /** Hides the "temporary chat" toggle for tight spaces (e.g. the floating Scholarly widget) — pair with `defaultTemporary: true` so the behavior it controls still applies. */
  compact?: boolean;
}

export function AssistantChat({ placeholder, emptyStateText, suggestedPrompts, compact, ...options }: AssistantChatProps) {
  const chat = useAssistantChat(options);
  const [input, setInput] = useState("");
  const { announce } = useLiveAnnouncer();
  const wasPendingRef = useRef(false);

  useEffect(() => {
    if (chat.pending && !wasPendingRef.current) {
      announce("Scholarly is thinking…");
    } else if (!chat.pending && wasPendingRef.current) {
      announce("Scholarly answered your question.");
    }
    wasPendingRef.current = chat.pending;
  }, [chat.pending, announce]);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!input.trim() || chat.pending) return;
    const value = input;
    setInput("");
    void chat.sendMessage(value);
  }

  return (
    <div className="flex flex-col gap-4">
      {!compact ? (
        <label className="flex items-center gap-2 text-sm text-foreground-muted">
          <input
            type="checkbox"
            checked={chat.temporary}
            onChange={(event) => chat.setTemporary(event.target.checked)}
            className="h-4 w-4 rounded border-border"
          />
          Temporary chat — don&apos;t save this conversation
        </label>
      ) : null}

      <div className="flex flex-col gap-3">
        {chat.messages.length === 0 ? (
          <p className="text-sm text-foreground-muted">
            {emptyStateText ??
              "Ask a question about published scholarships and internships. Answers are grounded in ScholarTrack's stored source data, with citations — never a final eligibility or admission decision."}
          </p>
        ) : null}
        {chat.messages.length === 0 && suggestedPrompts && suggestedPrompts.length > 0 ? (
          <div className="flex flex-wrap gap-2" aria-label="Example questions">
            {suggestedPrompts.map((prompt) => (
              <button
                key={prompt}
                type="button"
                onClick={() => setInput(prompt)}
                className="rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-medium text-foreground-muted hover:border-brand/40 hover:bg-brand-tint hover:text-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)]"
              >
                {prompt}
              </button>
            ))}
          </div>
        ) : null}
        {chat.messages.map((message) => (
          <MessageBubble key={message.id} message={message} onFeedback={chat.giveFeedback} />
        ))}
        {chat.pending ? <p className="text-sm text-foreground-subtle">Thinking…</p> : null}
      </div>

      {chat.statusKind && chat.statusKind !== "answered" && chat.statusKind !== "blocked" ? (
        <Alert tone={STATUS_TONE[chat.statusKind] ?? "info"}>{chat.statusText}</Alert>
      ) : null}

      {chat.remainingQuota !== null && chat.remainingQuota <= 3 && chat.statusKind !== "rate-limited" ? (
        <p className="text-xs text-foreground-subtle">{chat.remainingQuota} question(s) left today.</p>
      ) : null}

      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder={placeholder ?? "Ask a question…"}
          disabled={chat.pending}
          className="h-10 flex-1 rounded-md border border-border bg-surface px-3 text-sm text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)]"
        />
        <Button type="submit" disabled={chat.pending || !input.trim()}>
          <Send className="h-4 w-4" aria-hidden="true" />
          Send
        </Button>
      </form>
    </div>
  );
}
