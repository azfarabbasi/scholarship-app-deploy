"use client";

import {
  Check,
  MessageSquarePlus,
  MoreHorizontal,
  Pencil,
  Pin,
  PinOff,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import {
  deleteMyAiConversation,
  getMyAiConversations,
  renameMyAiConversation,
  setMyAiConversationPinned,
} from "@/lib/db/actions/student/ai-assistant";
import {
  deleteGuestAiConversation,
  getAllGuestAiConversations,
  renameGuestAiConversation,
  setGuestAiConversationPinned,
} from "@/lib/storage/ai-assistant";

/** The subset both the server row and the guest IndexedDB record satisfy. */
export interface ConversationSummary {
  id: string;
  title: string;
  updatedAt: string | Date;
  pinnedAt?: string | Date | null;
}

interface ConversationSidebarProps {
  studentProfileId: string | null;
  activeConversationId: string | null;
  onSelect: (id: string) => void;
  onNewChat: () => void;
  /** Bumped by the parent after a turn completes so a new/renamed chat appears. */
  refreshToken?: number;
}

function relativeTime(value: string | Date): string {
  const then = new Date(value).getTime();
  const minutes = Math.round((Date.now() - then) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(value).toLocaleDateString();
}

export function ConversationSidebar({
  studentProfileId,
  activeConversationId,
  onSelect,
  onNewChat,
  refreshToken = 0,
}: ConversationSidebarProps) {
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const searchId = useId();
  const renameInputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  async function refresh() {
    const list = studentProfileId ? await getMyAiConversations() : await getAllGuestAiConversations();
    setConversations(list);
    setLoading(false);
  }

  useEffect(() => {
    // Wrapped so the state updates happen after an await rather than
    // synchronously inside the effect body (react-hooks/set-state-in-effect) —
    // the same shape AssistantHistoryList uses.
    async function load() {
      await refresh();
    }
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentProfileId, refreshToken]);

  // Closes the open row menu on a click *outside* it. Containment is checked
  // against the menu element rather than relying on stopPropagation from the
  // menu's own handlers: the delete action is a two-step confirm that re-renders
  // the menu's contents, and a blanket "any click closes" listener tore the menu
  // down before the confirm step could ever appear.
  useEffect(() => {
    if (!menuOpenId) return;
    function handlePointerDown(event: MouseEvent) {
      const menu = menuRef.current;
      if (menu && event.target instanceof Node && menu.contains(event.target)) return;
      setMenuOpenId(null);
      setConfirmDeleteId(null);
    }
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [menuOpenId]);

  useEffect(() => {
    if (renamingId) renameInputRef.current?.select();
  }, [renamingId]);

  async function handleTogglePin(conversation: ConversationSummary) {
    const nextPinned = !conversation.pinnedAt;
    if (studentProfileId) await setMyAiConversationPinned(conversation.id, nextPinned);
    else await setGuestAiConversationPinned(conversation.id, nextPinned);
    setMenuOpenId(null);
    await refresh();
  }

  async function handleRenameSubmit(id: string) {
    const title = renameValue.trim();
    setRenamingId(null);
    if (!title) return;
    if (studentProfileId) await renameMyAiConversation(id, title);
    else await renameGuestAiConversation(id, title);
    await refresh();
  }

  async function handleDelete(id: string) {
    if (studentProfileId) await deleteMyAiConversation(id);
    else await deleteGuestAiConversation(id);
    setConfirmDeleteId(null);
    setMenuOpenId(null);
    if (id === activeConversationId) onNewChat();
    await refresh();
  }

  const filtered = query.trim()
    ? conversations.filter((c) => (c.title || "Untitled").toLowerCase().includes(query.trim().toLowerCase()))
    : conversations;
  const pinned = filtered.filter((c) => c.pinnedAt);
  const recent = filtered.filter((c) => !c.pinnedAt);

  function renderRow(conversation: ConversationSummary) {
    const isActive = conversation.id === activeConversationId;
    const isRenaming = renamingId === conversation.id;
    const isConfirming = confirmDeleteId === conversation.id;
    const title = conversation.title || "Untitled chat";

    if (isRenaming) {
      return (
        <li key={conversation.id}>
          <form
            className="flex items-center gap-1 rounded-lg border border-brand/40 bg-surface p-1"
            onSubmit={(event) => {
              event.preventDefault();
              void handleRenameSubmit(conversation.id);
            }}
          >
            <input
              ref={renameInputRef}
              value={renameValue}
              onChange={(event) => setRenameValue(event.target.value)}
              onKeyDown={(event) => event.key === "Escape" && setRenamingId(null)}
              maxLength={120}
              aria-label={`Rename ${title}`}
              className="min-w-0 flex-1 bg-transparent px-2 py-1 text-sm text-foreground outline-none"
            />
            <button
              type="submit"
              aria-label="Save name"
              className="rounded p-1 text-brand hover:bg-brand-tint focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)]"
            >
              <Check className="h-4 w-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              aria-label="Cancel rename"
              onClick={() => setRenamingId(null)}
              className="rounded p-1 text-foreground-subtle hover:bg-surface-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)]"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </form>
        </li>
      );
    }

    return (
      <li key={conversation.id} className="group/row relative">
        <div
          className={cn(
            "flex items-center gap-1 rounded-lg transition-colors",
            isActive ? "bg-brand-tint" : "hover:bg-surface-muted",
          )}
        >
          <button
            type="button"
            onClick={() => onSelect(conversation.id)}
            aria-current={isActive ? "true" : undefined}
            className="min-w-0 flex-1 rounded-lg px-3 py-2 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)]"
          >
            <span
              className={cn(
                "flex items-center gap-1.5 truncate text-sm",
                isActive ? "font-medium text-brand" : "text-foreground",
              )}
            >
              {conversation.pinnedAt ? (
                <Pin className="h-3 w-3 shrink-0 text-brand" aria-label="Pinned" />
              ) : null}
              <span className="truncate">{title}</span>
            </span>
            <span className="mt-0.5 block text-xs text-foreground-subtle">{relativeTime(conversation.updatedAt)}</span>
          </button>

          <button
            type="button"
            aria-label={`Actions for ${title}`}
            aria-expanded={menuOpenId === conversation.id}
            onClick={(event) => {
              event.stopPropagation();
              setMenuOpenId(menuOpenId === conversation.id ? null : conversation.id);
              setConfirmDeleteId(null);
            }}
            className="mr-1 shrink-0 rounded p-1.5 text-foreground-subtle opacity-0 transition-opacity hover:bg-surface hover:text-foreground focus-visible:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)] group-hover/row:opacity-100"
          >
            <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        {menuOpenId === conversation.id ? (
          <div
            ref={menuRef}
            role="menu"
            className="animate-scale-in absolute right-1 top-full z-20 mt-1 w-44 overflow-hidden rounded-lg border border-border bg-surface p-1 shadow-e3"
          >
            <button
              type="button"
              role="menuitem"
              onClick={() => void handleTogglePin(conversation)}
              className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm text-foreground hover:bg-surface-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)]"
            >
              {conversation.pinnedAt ? (
                <>
                  <PinOff className="h-4 w-4" aria-hidden="true" /> Unpin
                </>
              ) : (
                <>
                  <Pin className="h-4 w-4" aria-hidden="true" /> Pin to top
                </>
              )}
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setRenameValue(title);
                setRenamingId(conversation.id);
                setMenuOpenId(null);
              }}
              className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm text-foreground hover:bg-surface-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)]"
            >
              <Pencil className="h-4 w-4" aria-hidden="true" /> Rename
            </button>
            {isConfirming ? (
              <button
                type="button"
                role="menuitem"
                onClick={() => void handleDelete(conversation.id)}
                className="flex w-full items-center gap-2 rounded-md bg-danger-tint px-2.5 py-2 text-left text-sm font-medium text-danger focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)]"
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" /> Tap to confirm
              </button>
            ) : (
              <button
                type="button"
                role="menuitem"
                onClick={() => setConfirmDeleteId(conversation.id)}
                className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm text-danger hover:bg-danger-tint focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)]"
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" /> Delete
              </button>
            )}
          </div>
        ) : null}
      </li>
    );
  }

  return (
    <div className="flex h-full flex-col gap-3">
      <button
        type="button"
        onClick={onNewChat}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand px-3 py-2.5 text-sm font-semibold text-brand-foreground shadow-e1 transition-all hover:bg-brand-strong hover:shadow-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)]"
      >
        <MessageSquarePlus className="h-4 w-4" aria-hidden="true" />
        New chat
      </button>

      <div className="relative">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-foreground-subtle"
        />
        <label htmlFor={searchId} className="sr-only">
          Search conversations
        </label>
        <input
          id={searchId}
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search chats…"
          className="w-full rounded-lg border border-border bg-surface py-2 pl-8 pr-3 text-sm text-foreground placeholder:text-foreground-subtle focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)]"
        />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {loading ? (
          <p className="px-3 py-2 text-sm text-foreground-subtle">Loading…</p>
        ) : filtered.length === 0 ? (
          <p className="px-3 py-6 text-center text-sm text-foreground-subtle">
            {query.trim() ? "No chats match that search." : "No saved chats yet."}
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            {pinned.length > 0 ? (
              <div>
                <p className="px-3 pb-1 text-[0.68rem] font-semibold uppercase tracking-wider text-foreground-subtle">
                  Pinned
                </p>
                <ul className="flex flex-col gap-0.5">{pinned.map(renderRow)}</ul>
              </div>
            ) : null}
            {recent.length > 0 ? (
              <div>
                <p className="px-3 pb-1 text-[0.68rem] font-semibold uppercase tracking-wider text-foreground-subtle">
                  {pinned.length > 0 ? "Recent" : "All chats"}
                </p>
                <ul className="flex flex-col gap-0.5">{recent.map(renderRow)}</ul>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
