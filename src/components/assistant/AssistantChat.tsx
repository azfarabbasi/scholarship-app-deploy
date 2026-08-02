"use client";

import { useEffect, useRef, useState } from "react";
import type { FormEvent, KeyboardEvent } from "react";
import { Check, Copy, ExternalLink, Send, Sparkles, ThumbsDown, ThumbsUp, User } from "lucide-react";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { useLiveAnnouncer } from "@/components/common/LiveAnnouncer";
import { cn } from "@/lib/cn";
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

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  // Clears the "Copied" confirmation, and cancels the timer on unmount so it
  // can't fire setState after the bubble is gone.
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 1600);
    return () => clearTimeout(timer);
  }, [copied]);

  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard?.writeText(text).then(() => setCopied(true));
      }}
      className="rounded-md p-1 text-foreground-muted transition-colors hover:bg-surface-muted hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)]"
      aria-label={copied ? "Copied to clipboard" : "Copy answer"}
    >
      {copied ? (
        <Check className="h-3.5 w-3.5 text-success" aria-hidden="true" />
      ) : (
        <Copy className="h-3.5 w-3.5" aria-hidden="true" />
      )}
    </button>
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
    <div
      className={cn("flex animate-rise gap-2.5", isUser ? "flex-row-reverse" : "flex-row")}
      data-testid={isUser ? "user-message" : "assistant-message"}
    >
      <span
        aria-hidden="true"
        className={cn(
          "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
          isUser ? "bg-surface-muted text-foreground-muted" : "bg-brand text-brand-foreground shadow-e1",
        )}
      >
        {isUser ? <User className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
      </span>

      <div className={cn("flex min-w-0 max-w-[85%] flex-col", isUser ? "items-end" : "items-start")}>
        {/* Names the speaker for assistive tech. The avatar beside the bubble is
            decorative (aria-hidden), so without this a screen reader would read a
            wall of messages with no indication of who said what. Visually the
            avatar already carries it, hence sr-only. */}
        <span className="sr-only">{isUser ? "You" : "Scholarly"}</span>
        <div
          className={cn(
            "rounded-2xl px-4 py-2.5 text-sm",
            isUser
              ? "rounded-tr-sm bg-brand text-brand-foreground"
              : "rounded-tl-sm border border-border bg-surface text-foreground shadow-e1",
          )}
        >
          <p className="whitespace-pre-wrap break-words leading-relaxed">{message.content}</p>
          {!isUser ? <CitationList citations={message.citations} /> : null}
        </div>

        {!isUser ? (
          <div className="mt-1 flex items-center gap-1">
            <CopyButton text={message.content} />
            <FeedbackControls message={message} onFeedback={onFeedback} />
          </div>
        ) : null}
      </div>
    </div>
  );
}

/** Three-dot "thinking" indicator, shaped like an assistant bubble. */
function TypingIndicator() {
  return (
    <div className="flex animate-rise gap-2.5">
      <span
        aria-hidden="true"
        className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand text-brand-foreground shadow-e1"
      >
        <Sparkles className="h-4 w-4" />
      </span>
      <div className="flex items-center gap-1.5 rounded-2xl rounded-tl-sm border border-border bg-surface px-4 py-3.5 shadow-e1">
        {[0, 1, 2].map((index) => (
          <span
            key={index}
            aria-hidden="true"
            className="h-1.5 w-1.5 animate-bounce rounded-full bg-brand motion-reduce:animate-none"
            style={{ animationDelay: `${index * 0.15}s` }}
          />
        ))}
        <span className="sr-only">Scholarly is thinking…</span>
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

export type AssistantChatController = ReturnType<typeof useAssistantChat>;

export interface AssistantChatViewProps extends Omit<AssistantChatProps, keyof UseAssistantChatOptions> {
  chat: AssistantChatController;
  /** Makes the transcript scroll inside a fixed-height panel instead of growing the page. */
  fill?: boolean;
}

/**
 * The presentational half. Split out from {@link AssistantChat} so a parent
 * that owns the chat controller — the full assistant page, which drives it
 * from a conversation sidebar — can render the same UI without a second,
 * unused `useAssistantChat` instance (hooks can't be called conditionally).
 */
export function AssistantChatView({
  chat,
  placeholder,
  emptyStateText,
  suggestedPrompts,
  compact,
  fill,
}: AssistantChatViewProps) {
  const [input, setInput] = useState("");
  const { announce } = useLiveAnnouncer();
  const wasPendingRef = useRef(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (chat.pending && !wasPendingRef.current) {
      announce("Scholarly is thinking…");
    } else if (!chat.pending && wasPendingRef.current) {
      announce("Scholarly answered your question.");
    }
    wasPendingRef.current = chat.pending;
  }, [chat.pending, announce]);

  // Keep the newest turn in view. `block: "nearest"` so this never yanks the
  // whole page when the transcript isn't the scrolling element. Feature-detected
  // because it is a pure enhancement and jsdom (and any non-DOM renderer)
  // doesn't implement scrollIntoView — a missing scroll must not break the chat.
  useEffect(() => {
    const end = endRef.current;
    if (typeof end?.scrollIntoView !== "function") return;
    end.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [chat.messages.length, chat.pending]);

  function submit() {
    if (!input.trim() || chat.pending) return;
    const value = input;
    setInput("");
    void chat.sendMessage(value);
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    submit();
  }

  // Enter sends, Shift+Enter makes a newline — the convention for chat
  // composers, and the reason this is a textarea rather than an input.
  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  }

  const isEmpty = chat.messages.length === 0;

  return (
    <div className={cn("flex flex-col gap-4", fill && "h-full min-h-0")}>
      <div className={cn("flex flex-col gap-4", fill && "min-h-0 flex-1 overflow-y-auto pr-1")}>
        {isEmpty ? (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <span
              aria-hidden="true"
              className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-tint text-brand"
            >
              <Sparkles className="h-7 w-7" />
            </span>
            <p className="max-w-md text-sm leading-relaxed text-foreground-muted">
              {emptyStateText ??
                "Ask about published scholarships and internships. Every answer is grounded in ScholarTrack's stored sources and cites them — Scholarly never makes a final eligibility or funding decision."}
            </p>
            {suggestedPrompts && suggestedPrompts.length > 0 ? (
              <div className="mt-1 flex flex-wrap justify-center gap-2" aria-label="Example questions">
                {suggestedPrompts.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => setInput(prompt)}
                    className="rounded-full border border-border bg-surface px-3.5 py-2 text-xs font-medium text-foreground-muted transition-all hover:-translate-y-0.5 hover:border-brand/40 hover:bg-brand-tint hover:text-brand motion-reduce:hover:translate-y-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)]"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}

        {chat.messages.map((message) => (
          <MessageBubble key={message.id} message={message} onFeedback={chat.giveFeedback} />
        ))}
        {chat.pending ? <TypingIndicator /> : null}
        <div ref={endRef} />
      </div>

      {chat.statusKind && chat.statusKind !== "answered" && chat.statusKind !== "blocked" ? (
        <Alert tone={STATUS_TONE[chat.statusKind] ?? "info"}>{chat.statusText}</Alert>
      ) : null}

      <div className="flex flex-col gap-2">
        <form
          onSubmit={handleSubmit}
          className="flex items-end gap-2 rounded-2xl border border-border bg-surface p-2 shadow-e1 transition-colors focus-within:border-brand/50"
        >
          <label htmlFor="assistant-composer" className="sr-only">
            Ask Scholarly a question
          </label>
          <textarea
            id="assistant-composer"
            value={input}
            rows={1}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder ?? "Ask anything about scholarships…"}
            disabled={chat.pending}
            className="max-h-40 min-h-[2.5rem] flex-1 resize-none bg-transparent px-2 py-2 text-sm text-foreground outline-none placeholder:text-foreground-subtle disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={chat.pending || !input.trim()}
            aria-label="Send message"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand text-brand-foreground transition-all hover:bg-brand-strong hover:shadow-brand disabled:pointer-events-none disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)]"
          >
            <Send className="h-4 w-4" aria-hidden="true" />
          </button>
        </form>

        <div className="flex flex-wrap items-center justify-between gap-2 px-1">
          {!compact ? (
            <label className="flex items-center gap-2 text-xs text-foreground-muted">
              <input
                type="checkbox"
                checked={chat.temporary}
                onChange={(event) => chat.setTemporary(event.target.checked)}
                className="h-3.5 w-3.5 rounded border-border"
              />
              Temporary chat — don&apos;t save
            </label>
          ) : (
            <span />
          )}
          {chat.remainingQuota !== null && chat.remainingQuota <= 3 && chat.statusKind !== "rate-limited" ? (
            <p className="text-xs text-foreground-subtle">{chat.remainingQuota} question(s) left today.</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/** Owns its own chat state — the drop-in used by every embedded surface. */
export function AssistantChat({ placeholder, emptyStateText, suggestedPrompts, compact, ...options }: AssistantChatProps) {
  const chat = useAssistantChat(options);
  return (
    <AssistantChatView
      chat={chat}
      placeholder={placeholder}
      emptyStateText={emptyStateText}
      suggestedPrompts={suggestedPrompts}
      compact={compact}
    />
  );
}
