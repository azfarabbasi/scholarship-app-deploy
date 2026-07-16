/**
 * Pure opportunity workflow state machine (no DB access — see
 * `src/lib/db/actions/opportunities.ts` for the transactional mutations that
 * call into this). Kept pure and dependency-free so it is exhaustively unit
 * testable and so the exact same rules can be asserted against in a
 * `checkpoint2:validate` structural check.
 */

export const OPPORTUNITY_WORKFLOW_STATUSES = [
  "draft",
  "in_review",
  "changes_requested",
  "reviewed",
  "approved",
  "scheduled",
  "published",
  "archived",
  "rejected",
  "superseded",
  "merged",
] as const;

export type OpportunityWorkflowStatus = (typeof OPPORTUNITY_WORKFLOW_STATUSES)[number];

export type WorkflowTransition =
  | "submit-for-review"
  | "request-changes"
  | "mark-reviewed"
  | "resubmit"
  | "approve"
  | "schedule"
  | "publish"
  | "archive"
  | "restore"
  | "reject"
  | "mark-merged";

interface TransitionRule {
  from: readonly OpportunityWorkflowStatus[];
  to: OpportunityWorkflowStatus;
}

/**
 * The single source of truth for which transition is legal from which
 * status. `archive` and `restore` are intentionally the only ways in/out of
 * `archived`; `reject` is available from every non-terminal, non-published
 * state; merging is handled by the duplicate-merge workflow, which still
 * calls {@link isValidTransition} with `mark-merged` so both paths share one
 * rulebook.
 */
const TRANSITION_RULES: Record<WorkflowTransition, TransitionRule> = {
  "submit-for-review": { from: ["draft", "changes_requested"], to: "in_review" },
  "request-changes": { from: ["in_review", "reviewed"], to: "changes_requested" },
  "mark-reviewed": { from: ["in_review"], to: "reviewed" },
  resubmit: { from: ["changes_requested"], to: "in_review" },
  approve: { from: ["reviewed"], to: "approved" },
  schedule: { from: ["approved"], to: "scheduled" },
  publish: { from: ["approved", "scheduled"], to: "published" },
  archive: { from: ["published"], to: "archived" },
  restore: { from: ["archived"], to: "approved" },
  reject: { from: ["draft", "in_review", "reviewed", "changes_requested"], to: "rejected" },
  "mark-merged": { from: ["draft", "in_review", "reviewed", "approved", "scheduled", "published"], to: "merged" },
};

export function isValidTransition(from: OpportunityWorkflowStatus, transition: WorkflowTransition): boolean {
  return TRANSITION_RULES[transition].from.includes(from);
}

export function nextStatusFor(transition: WorkflowTransition): OpportunityWorkflowStatus {
  return TRANSITION_RULES[transition].to;
}

/** Every transition available from a given status, for building UI action buttons. */
export function availableTransitions(from: OpportunityWorkflowStatus): WorkflowTransition[] {
  return (Object.keys(TRANSITION_RULES) as WorkflowTransition[]).filter((transition) =>
    isValidTransition(from, transition),
  );
}

export const TERMINAL_STATUSES: readonly OpportunityWorkflowStatus[] = ["rejected", "superseded", "merged"];

export function isTerminal(status: OpportunityWorkflowStatus): boolean {
  return TERMINAL_STATUSES.includes(status);
}
