import { describe, expect, it } from "vitest";
import {
  availableTransitions,
  isTerminal,
  isValidTransition,
  nextStatusFor,
  OPPORTUNITY_WORKFLOW_STATUSES,
  type OpportunityWorkflowStatus,
} from "@/lib/workflow/opportunity-workflow";

describe("opportunity workflow state machine", () => {
  it("draft can only be submitted for review or rejected", () => {
    expect(isValidTransition("draft", "submit-for-review")).toBe(true);
    expect(isValidTransition("draft", "reject")).toBe(true);
    expect(isValidTransition("draft", "publish")).toBe(false);
    expect(isValidTransition("draft", "approve")).toBe(false);
  });

  it("publishing requires prior approval (approved or scheduled only)", () => {
    expect(isValidTransition("approved", "publish")).toBe(true);
    expect(isValidTransition("scheduled", "publish")).toBe(true);
    expect(isValidTransition("reviewed", "publish")).toBe(false);
    expect(isValidTransition("draft", "publish")).toBe(false);
  });

  it("archive is only reachable from published, and restore returns to approved (not published)", () => {
    expect(isValidTransition("published", "archive")).toBe(true);
    expect(isValidTransition("draft", "archive")).toBe(false);
    expect(isValidTransition("archived", "restore")).toBe(true);
    expect(nextStatusFor("restore")).toBe("approved");
  });

  it("changes_requested loops back into in_review via resubmit, not straight to reviewed/approved", () => {
    expect(isValidTransition("changes_requested", "resubmit")).toBe(true);
    expect(isValidTransition("changes_requested", "approve")).toBe(false);
    expect(nextStatusFor("resubmit")).toBe("in_review");
  });

  it("rejection is available from every pre-approval state but not from published/archived", () => {
    expect(isValidTransition("draft", "reject")).toBe(true);
    expect(isValidTransition("in_review", "reject")).toBe(true);
    expect(isValidTransition("reviewed", "reject")).toBe(true);
    expect(isValidTransition("changes_requested", "reject")).toBe(true);
    expect(isValidTransition("published", "reject")).toBe(false);
    expect(isValidTransition("archived", "reject")).toBe(false);
  });

  it("rejected/superseded/merged are terminal", () => {
    expect(isTerminal("rejected")).toBe(true);
    expect(isTerminal("superseded")).toBe(true);
    expect(isTerminal("merged")).toBe(true);
    expect(isTerminal("draft")).toBe(false);
    expect(isTerminal("published")).toBe(false);
  });

  it("availableTransitions never offers an invalid transition for any status", () => {
    for (const status of OPPORTUNITY_WORKFLOW_STATUSES) {
      for (const transition of availableTransitions(status as OpportunityWorkflowStatus)) {
        expect(isValidTransition(status as OpportunityWorkflowStatus, transition)).toBe(true);
      }
    }
  });

  it("terminal statuses offer no transitions except (for non-merged) none at all", () => {
    expect(availableTransitions("rejected")).toEqual([]);
    expect(availableTransitions("superseded")).toEqual([]);
  });
});
