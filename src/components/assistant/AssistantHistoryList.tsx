"use client";

import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardBody } from "@/components/ui/Card";
import { EmptyState } from "@/components/common/EmptyState";
import {
  deleteMyAiConversation,
  getMyAiConversationMessages,
  getMyAiConversations,
  type AiConversationRow,
  type AiMessageRow,
  type AiAnswerCitationRow,
} from "@/lib/db/actions/student/ai-assistant";
import { deleteGuestAiConversation, getAllGuestAiConversations, getGuestAiMessages } from "@/lib/storage/ai-assistant";
import type { GuestAiConversationRecord, GuestAiMessageRecord } from "@/lib/storage/types";

interface AssistantHistoryListProps {
  studentProfileId: string | null;
}

type ConversationRow = AiConversationRow | GuestAiConversationRecord;
type MessageRow = (AiMessageRow & { citations: AiAnswerCitationRow[] }) | GuestAiMessageRecord;

export function AssistantHistoryList({ studentProfileId }: AssistantHistoryListProps) {
  const [conversations, setConversations] = useState<ConversationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<MessageRow[]>([]);

  async function refresh() {
    const list = studentProfileId ? await getMyAiConversations() : await getAllGuestAiConversations();
    setConversations(list);
    setLoading(false);
  }

  useEffect(() => {
    async function load() {
      await refresh();
    }
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentProfileId]);

  async function toggleExpand(id: string) {
    if (expandedId === id) {
      setExpandedId(null);
      setMessages([]);
      return;
    }
    setExpandedId(id);
    const list = studentProfileId ? await getMyAiConversationMessages(id) : await getGuestAiMessages(id);
    setMessages(list);
  }

  async function handleDelete(id: string) {
    if (studentProfileId) {
      await deleteMyAiConversation(id);
    } else {
      await deleteGuestAiConversation(id);
    }
    if (expandedId === id) {
      setExpandedId(null);
      setMessages([]);
    }
    await refresh();
  }

  if (loading) {
    return <p className="text-sm text-foreground-muted">Loading…</p>;
  }

  if (conversations.length === 0) {
    return (
      <EmptyState
        title="No saved conversations yet"
        description={
          studentProfileId
            ? "Enable AI history in assistant settings to start saving conversations here."
            : "Conversations you have with the guest assistant are saved on this device unless you use a temporary chat."
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {conversations.map((conversation) => (
        <Card key={conversation.id}>
          <CardBody className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-foreground">{conversation.title || "Untitled conversation"}</p>
                <div className="mt-1 flex items-center gap-2 text-xs text-foreground-subtle">
                  <Badge tone="neutral">{conversation.scope}</Badge>
                  <span>Updated {new Date(conversation.updatedAt).toLocaleString()}</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => void toggleExpand(conversation.id)}>
                  {expandedId === conversation.id ? "Hide" : "View"}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Delete conversation"
                  onClick={() => void handleDelete(conversation.id)}
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </Button>
              </div>
            </div>

            {expandedId === conversation.id ? (
              <div className="flex flex-col gap-2 border-t border-border pt-3">
                {messages.map((message) => (
                  <div key={message.id} className={message.role === "user" ? "text-right" : "text-left"}>
                    <p className="text-xs font-medium text-foreground-subtle">{message.role === "user" ? "You" : "Assistant"}</p>
                    <p className="text-sm text-foreground">{message.content}</p>
                  </div>
                ))}
              </div>
            ) : null}
          </CardBody>
        </Card>
      ))}
    </div>
  );
}
