import { Badge, type BadgeTone } from "@/components/ui/Badge";
import type { OpportunityWorkflowStatus } from "@/lib/workflow/opportunity-workflow";

/**
 * Staff screens were rendering the raw DB enum (`changes_requested`,
 * `in_review`), which reads as a column name rather than a state. The tone
 * groups the eleven statuses into the four things a reader actually wants to
 * tell apart: live, in-flight, needs-someone, and closed. Colour is never the
 * only signal — the label is always the full human-readable status.
 */
export const WORKFLOW_STATUS_LABELS: Record<OpportunityWorkflowStatus, string> = {
  draft: "Draft",
  in_review: "In review",
  changes_requested: "Changes requested",
  reviewed: "Reviewed",
  approved: "Approved",
  scheduled: "Scheduled",
  published: "Published",
  archived: "Archived",
  rejected: "Rejected",
  superseded: "Superseded",
  merged: "Merged",
};

const WORKFLOW_STATUS_TONES: Record<OpportunityWorkflowStatus, BadgeTone> = {
  draft: "neutral",
  in_review: "blue",
  changes_requested: "amber",
  reviewed: "blue",
  approved: "green",
  scheduled: "blue",
  published: "green",
  archived: "grey",
  rejected: "red",
  superseded: "grey",
  merged: "grey",
};

/**
 * Also used for the adjacent review-assignment enum, which is kebab-cased
 * (`in-review`) where the opportunity workflow is snake-cased — so the fallback
 * humanises both separators rather than leaking either to the screen.
 */
export function workflowStatusLabel(status: string): string {
  return (
    WORKFLOW_STATUS_LABELS[status as OpportunityWorkflowStatus] ??
    status.replace(/[_-]/g, " ").replace(/^./, (char) => char.toUpperCase())
  );
}

export function WorkflowStatusBadge({ status }: { status: string }) {
  const tone = WORKFLOW_STATUS_TONES[status as OpportunityWorkflowStatus] ?? "neutral";
  return <Badge tone={tone}>{workflowStatusLabel(status)}</Badge>;
}
