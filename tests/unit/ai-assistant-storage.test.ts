import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  addGuestAiMessage,
  clearAllGuestAiHistory,
  createGuestAiConversation,
  deleteGuestAiConversation,
  getAllGuestAiConversations,
  getGuestAiMessages,
} from "@/lib/storage/ai-assistant";
import { DB_NAME, resetDbConnectionForTests } from "@/lib/storage/db";

async function resetDatabase() {
  await resetDbConnectionForTests();
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DB_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () => resolve();
  });
}

beforeEach(async () => {
  await resetDatabase();
});

afterEach(async () => {
  await resetDatabase();
});

describe("guest AI assistant storage", () => {
  it("creates a conversation and lists it", async () => {
    const conversation = await createGuestAiConversation("general", null);
    const all = await getAllGuestAiConversations();
    expect(all).toHaveLength(1);
    expect(all[0].id).toBe(conversation.id);
    expect(all[0].scope).toBe("general");
  });

  it("appends messages and derives the conversation title from the first user message", async () => {
    const conversation = await createGuestAiConversation("opportunity", "opp-1");
    await addGuestAiMessage({
      conversationId: conversation.id,
      role: "user",
      content: "What is the deadline for this opportunity?",
      blockedReason: null,
      citations: [],
    });
    await addGuestAiMessage({
      conversationId: conversation.id,
      role: "assistant",
      content: "Based on stored source data...",
      blockedReason: null,
      citations: [],
    });

    const messages = await getGuestAiMessages(conversation.id);
    expect(messages).toHaveLength(2);
    expect(messages[0].role).toBe("user");
    expect(messages[1].role).toBe("assistant");

    const [updated] = await getAllGuestAiConversations();
    expect(updated.title).toBe("What is the deadline for this opportunity?");
  });

  it("deletes a conversation and all of its messages", async () => {
    const conversation = await createGuestAiConversation("general", null);
    await addGuestAiMessage({ conversationId: conversation.id, role: "user", content: "Hi", blockedReason: null, citations: [] });

    await deleteGuestAiConversation(conversation.id);

    expect(await getAllGuestAiConversations()).toEqual([]);
    expect(await getGuestAiMessages(conversation.id)).toEqual([]);
  });

  it("clears all guest AI history across every conversation", async () => {
    const a = await createGuestAiConversation("general", null);
    const b = await createGuestAiConversation("workspace", null);
    await addGuestAiMessage({ conversationId: a.id, role: "user", content: "Hi", blockedReason: null, citations: [] });
    await addGuestAiMessage({ conversationId: b.id, role: "user", content: "Hi again", blockedReason: null, citations: [] });

    await clearAllGuestAiHistory();

    expect(await getAllGuestAiConversations()).toEqual([]);
    expect(await getGuestAiMessages(a.id)).toEqual([]);
    expect(await getGuestAiMessages(b.id)).toEqual([]);
  });

  it("keeps messages from different conversations isolated from one another", async () => {
    const a = await createGuestAiConversation("general", null);
    const b = await createGuestAiConversation("general", null);
    await addGuestAiMessage({ conversationId: a.id, role: "user", content: "Question in conversation A", blockedReason: null, citations: [] });
    await addGuestAiMessage({ conversationId: b.id, role: "user", content: "Question in conversation B", blockedReason: null, citations: [] });

    const messagesA = await getGuestAiMessages(a.id);
    const messagesB = await getGuestAiMessages(b.id);
    expect(messagesA).toHaveLength(1);
    expect(messagesB).toHaveLength(1);
    expect(messagesA[0].content).toBe("Question in conversation A");
    expect(messagesB[0].content).toBe("Question in conversation B");
  });
});
