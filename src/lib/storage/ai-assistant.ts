import { getDb } from "./db";
import { emitStorageChange } from "./events";
import type { AiConversationScope, GuestAiConversationRecord, GuestAiMessageRecord } from "./types";

/**
 * Guest AI assistant history — local by default, same as every other guest
 * store (see `docs/checkpoint-5/checkpoint-5-architecture.md`, "conversation
 * storage"). Never uploaded to Supabase automatically; a signed-in student
 * must explicitly opt in during guest-data migration before any of this
 * reaches the cloud (see `src/lib/storage/backup.ts` for the existing
 * migration flow this follows).
 */

/**
 * Pinned first (most recently pinned first), then the rest by recency —
 * the same ordering the signed-in `getMyAiConversations` produces in SQL, so
 * the sidebar looks identical whether history lives locally or in the cloud.
 */
export async function getAllGuestAiConversations(): Promise<GuestAiConversationRecord[]> {
  const db = await getDb();
  const all = await db.getAll("aiConversations");
  return all.sort((a, b) => {
    const pinA = a.pinnedAt ?? null;
    const pinB = b.pinnedAt ?? null;
    if (pinA && pinB) return pinB.localeCompare(pinA);
    if (pinA) return -1;
    if (pinB) return 1;
    return b.updatedAt.localeCompare(a.updatedAt);
  });
}

export async function renameGuestAiConversation(id: string, title: string): Promise<void> {
  const trimmed = title.trim();
  if (trimmed.length === 0) return;
  const db = await getDb();
  const conversation = await db.get("aiConversations", id);
  if (!conversation) return;
  await db.put("aiConversations", {
    ...conversation,
    title: trimmed.slice(0, 120),
    updatedAt: new Date().toISOString(),
  });
  emitStorageChange("aiConversations");
}

export async function setGuestAiConversationPinned(id: string, pinned: boolean): Promise<void> {
  const db = await getDb();
  const conversation = await db.get("aiConversations", id);
  if (!conversation) return;
  // `updatedAt` untouched — pinning isn't a content edit, and bumping it would
  // reorder the unpinned list as soon as the chat is unpinned again.
  await db.put("aiConversations", {
    ...conversation,
    pinnedAt: pinned ? new Date().toISOString() : null,
  });
  emitStorageChange("aiConversations");
}

export async function getGuestAiConversation(id: string): Promise<GuestAiConversationRecord | undefined> {
  const db = await getDb();
  return db.get("aiConversations", id);
}

export async function createGuestAiConversation(
  scope: AiConversationScope,
  targetOpportunityId: string | null = null,
): Promise<GuestAiConversationRecord> {
  const db = await getDb();
  const timestamp = new Date().toISOString();
  const record: GuestAiConversationRecord = {
    id: crypto.randomUUID(),
    scope,
    targetOpportunityId,
    title: "",
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  await db.put("aiConversations", record);
  emitStorageChange("aiConversations");
  return record;
}

export async function getGuestAiMessages(conversationId: string): Promise<GuestAiMessageRecord[]> {
  const db = await getDb();
  const all = await db.getAll("aiMessages");
  return all.filter((message) => message.conversationId === conversationId).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

/**
 * Appends a message and, for the first user message in a conversation, uses
 * it (truncated) as the conversation's display title — mirrors how most chat
 * UIs derive a title from the opening message rather than asking the user to
 * name every conversation.
 */
export async function addGuestAiMessage(message: Omit<GuestAiMessageRecord, "id" | "createdAt">): Promise<GuestAiMessageRecord> {
  const db = await getDb();
  const timestamp = new Date().toISOString();
  const record: GuestAiMessageRecord = { ...message, id: crypto.randomUUID(), createdAt: timestamp };
  await db.put("aiMessages", record);

  const conversation = await db.get("aiConversations", message.conversationId);
  if (conversation) {
    const title = conversation.title || (message.role === "user" ? message.content.slice(0, 60) : conversation.title);
    await db.put("aiConversations", { ...conversation, title, updatedAt: timestamp });
  }

  emitStorageChange("aiMessages");
  emitStorageChange("aiConversations");
  return record;
}

export async function deleteGuestAiConversation(id: string): Promise<void> {
  const db = await getDb();
  await db.delete("aiConversations", id);
  const messages = await db.getAll("aiMessages");
  const tx = db.transaction("aiMessages", "readwrite");
  await Promise.all(messages.filter((message) => message.conversationId === id).map((message) => tx.store.delete(message.id)));
  await tx.done;
  emitStorageChange("aiConversations");
  emitStorageChange("aiMessages");
}

/** Used by the "clear local AI history" privacy control — removes every guest conversation and message. */
export async function clearAllGuestAiHistory(): Promise<void> {
  const db = await getDb();
  await db.clear("aiConversations");
  await db.clear("aiMessages");
  emitStorageChange("aiConversations");
  emitStorageChange("aiMessages");
}
