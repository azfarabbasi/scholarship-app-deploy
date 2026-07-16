"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Field";
import {
  approveOpportunity,
  archiveOpportunity,
  markOpportunityReviewed,
  publishOpportunity,
  rejectOpportunity,
  requestChangesOnOpportunity,
  resubmitForReview,
  restoreOpportunity,
  scheduleOpportunity,
  submitForReview,
  type ActionResult,
} from "@/lib/db/actions/opportunities";
import type { OpportunityWorkflowStatus, WorkflowTransition } from "@/lib/workflow/opportunity-workflow";
import { availableTransitions } from "@/lib/workflow/opportunity-workflow";

const TRANSITION_LABELS: Record<WorkflowTransition, string> = {
  "submit-for-review": "Submit for review",
  "request-changes": "Request changes",
  "mark-reviewed": "Mark reviewed (send to senior approval)",
  resubmit: "Resubmit for review",
  approve: "Approve",
  schedule: "Schedule",
  publish: "Publish",
  archive: "Archive",
  restore: "Restore to approved",
  reject: "Reject",
  "mark-merged": "Mark as merged",
};

const REASON_REQUIRED: Partial<Record<WorkflowTransition, string>> = {
  "request-changes": "What needs to change?",
  reject: "Reason for rejection",
  archive: "Reason for archiving",
};

interface OpportunityWorkflowActionsProps {
  opportunityId: string;
  status: OpportunityWorkflowStatus;
  isAdministrator: boolean;
}

async function callTransition(
  transition: WorkflowTransition,
  opportunityId: string,
  reason: string,
): Promise<ActionResult> {
  switch (transition) {
    case "submit-for-review":
      return submitForReview(opportunityId);
    case "resubmit":
      return resubmitForReview(opportunityId);
    case "request-changes":
      return requestChangesOnOpportunity(opportunityId, reason);
    case "mark-reviewed":
      return markOpportunityReviewed(opportunityId, reason);
    case "approve":
      return approveOpportunity(opportunityId, reason || undefined);
    case "schedule":
      return scheduleOpportunity(opportunityId);
    case "publish":
      return publishOpportunity(opportunityId);
    case "archive":
      return archiveOpportunity(opportunityId, reason);
    case "restore":
      return restoreOpportunity(opportunityId);
    case "reject":
      return rejectOpportunity(opportunityId, reason);
    case "mark-merged":
      return { ok: false, error: "Use the Duplicates queue to merge records." };
  }
}

export function OpportunityWorkflowActions({ opportunityId, status, isAdministrator }: OpportunityWorkflowActionsProps) {
  const router = useRouter();
  const [pendingTransition, setPendingTransition] = useState<WorkflowTransition | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const transitions = availableTransitions(status).filter((t) => t !== "mark-merged");

  async function run(transition: WorkflowTransition) {
    setBusy(true);
    setError(null);
    const result = await callTransition(transition, opportunityId, reason);
    setBusy(false);
    if (!result.ok) {
      setError(result.error ?? "Action failed.");
      return;
    }
    setPendingTransition(null);
    setReason("");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-3">
      {error ? <Alert tone="danger">{error}</Alert> : null}

      <div className="flex flex-wrap gap-2">
        {transitions.map((transition) => (
          <Button
            key={transition}
            size="sm"
            variant={transition === "reject" || transition === "archive" ? "danger" : "outline"}
            onClick={() => {
              if (REASON_REQUIRED[transition] || (transition === "approve" && isAdministrator)) {
                setPendingTransition(transition);
              } else {
                void run(transition);
              }
            }}
            disabled={busy}
          >
            {TRANSITION_LABELS[transition]}
          </Button>
        ))}
      </div>

      {pendingTransition ? (
        <div className="rounded-md border border-border bg-surface p-3">
          <Label htmlFor="transition-reason">
            {REASON_REQUIRED[pendingTransition] ??
              (pendingTransition === "approve" ? "Administrator override reason (leave blank if you are the independent senior reviewer)" : "Reason (optional)")}
          </Label>
          <Input id="transition-reason" value={reason} onChange={(e) => setReason(e.target.value)} />
          <div className="mt-2 flex gap-2">
            <Button size="sm" disabled={busy} onClick={() => void run(pendingTransition)}>
              Confirm
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setPendingTransition(null);
                setReason("");
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
