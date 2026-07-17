"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardBody } from "@/components/ui/Card";
import {
  createAiSourceDocument,
  rebuildAiSourceChunks,
  setAiSourceDocumentStatus,
  type AiSourceDocumentRow,
} from "@/lib/db/actions/ai-staff";

const STATUS_TONE: Record<string, "green" | "amber" | "red" | "grey"> = {
  draft: "grey",
  approved: "green",
  rejected: "red",
  stale: "amber",
};

interface OpportunityOption {
  id: string;
  title: string;
}

interface AiSourceDocumentsManagerProps {
  documents: AiSourceDocumentRow[];
  opportunities: OpportunityOption[];
  canApprove: boolean;
}

export function AiSourceDocumentsManager({ documents, opportunities, canApprove }: AiSourceDocumentsManagerProps) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [sourceText, setSourceText] = useState("");
  const [opportunityId, setOpportunityId] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleCreate() {
    setBusy(true);
    const result = await createAiSourceDocument({ title, sourceText, opportunityId: opportunityId || null });
    setBusy(false);
    if (result.ok) {
      setTitle("");
      setSourceText("");
      setOpportunityId("");
      setMessage("Draft excerpt created.");
      router.refresh();
    } else {
      setMessage(result.error ?? "Failed to create excerpt.");
    }
  }

  async function handleStatus(id: string, status: "draft" | "approved" | "rejected" | "stale") {
    setBusy(true);
    await setAiSourceDocumentStatus(id, status);
    setBusy(false);
    router.refresh();
  }

  async function handleRebuild(id: string) {
    setBusy(true);
    const result = await rebuildAiSourceChunks(id);
    setBusy(false);
    setMessage(result.ok ? `Rebuilt ${result.chunkCount} chunk(s).` : (result.error ?? "Failed."));
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardBody className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold text-foreground">Add a new excerpt</h2>
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Excerpt title"
            className="h-9 rounded-md border border-border bg-surface px-3 text-sm text-foreground"
          />
          <select
            value={opportunityId}
            onChange={(event) => setOpportunityId(event.target.value)}
            className="h-9 rounded-md border border-border bg-surface px-3 text-sm text-foreground"
          >
            <option value="">No linked opportunity (general platform content)</option>
            {opportunities.map((o) => (
              <option key={o.id} value={o.id}>
                {o.title}
              </option>
            ))}
          </select>
          <textarea
            value={sourceText}
            onChange={(event) => setSourceText(event.target.value)}
            placeholder="Plain-text excerpt from the official source — never a file upload."
            rows={4}
            className="rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground"
          />
          <Button size="sm" disabled={busy || !title.trim() || !sourceText.trim()} onClick={() => void handleCreate()} className="w-fit">
            Create draft
          </Button>
          {message ? <p className="text-xs text-foreground-muted">{message}</p> : null}
        </CardBody>
      </Card>

      <div className="flex flex-col gap-3">
        {documents.length === 0 ? (
          <p className="text-sm text-foreground-muted">No AI source excerpts yet.</p>
        ) : (
          documents.map((document) => (
            <Card key={document.id}>
              <CardBody className="flex flex-col gap-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-foreground">{document.title}</p>
                  <Badge tone={STATUS_TONE[document.status] ?? "grey"}>{document.status}</Badge>
                </div>
                <p className="whitespace-pre-line text-xs text-foreground-muted">{document.sourceText.slice(0, 300)}</p>
                {document.staleReason ? <p className="text-xs text-warning">Stale: {document.staleReason}</p> : null}
                <div className="flex flex-wrap gap-2 pt-1">
                  <Button size="sm" variant="outline" disabled={busy} onClick={() => void handleRebuild(document.id)}>
                    Rebuild chunks
                  </Button>
                  {canApprove ? (
                    <>
                      <Button size="sm" variant="outline" disabled={busy || document.status === "approved"} onClick={() => void handleStatus(document.id, "approved")}>
                        Approve
                      </Button>
                      <Button size="sm" variant="outline" disabled={busy || document.status === "rejected"} onClick={() => void handleStatus(document.id, "rejected")}>
                        Reject
                      </Button>
                      <Button size="sm" variant="outline" disabled={busy || document.status === "stale"} onClick={() => void handleStatus(document.id, "stale")}>
                        Mark stale
                      </Button>
                    </>
                  ) : null}
                </div>
              </CardBody>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
