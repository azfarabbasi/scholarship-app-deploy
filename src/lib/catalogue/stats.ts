import { evaluateDeadline } from "@/lib/deadlines/engine";
import type { WorkspaceRecord } from "@/lib/storage/types";
import type { CatalogueOpportunity, CatalogueStats } from "./types";

const STAGES_NOT_IN_PROGRESS = new Set(["not-started", "withdrawn", "unsuccessful", "awarded"]);

export function computeCatalogueStats(
  opportunities: readonly CatalogueOpportunity[],
  workspaceRecords: readonly WorkspaceRecord[],
  now: Date,
): CatalogueStats {
  const workspaceByOpportunity = new Map(workspaceRecords.map((record) => [record.opportunityId, record]));

  let reliableOpenDeadlines = 0;
  let approaching = 0;
  let passedCurrentCycle = 0;
  let rolling = 0;
  let verificationRequired = 0;
  let shortlisted = 0;
  let applicationsInProgress = 0;

  for (const opportunity of opportunities) {
    const result = evaluateDeadline(opportunity.deadlineInput, now);

    if (result.lifecycleStatus === "open" && result.countdown.allowed) {
      reliableOpenDeadlines += 1;
    }
    if (result.lifecycleStatus === "approaching") {
      approaching += 1;
    }
    if (result.lifecycleStatus === "passed-current-cycle") {
      passedCurrentCycle += 1;
    }
    if (result.lifecycleStatus === "rolling") {
      rolling += 1;
    }
    if (result.verificationRequired) {
      verificationRequired += 1;
    }

    const workspaceRecord = workspaceByOpportunity.get(opportunity.id);
    if (workspaceRecord?.shortlisted) {
      shortlisted += 1;
    }
    if (workspaceRecord && !STAGES_NOT_IN_PROGRESS.has(workspaceRecord.stage)) {
      applicationsInProgress += 1;
    }
  }

  return {
    total: opportunities.length,
    builtIn: opportunities.filter((o) => o.kind === "built-in").length,
    custom: opportunities.filter((o) => o.kind === "custom").length,
    reliableOpenDeadlines,
    approaching,
    passedCurrentCycle,
    rolling,
    verificationRequired,
    shortlisted,
    applicationsInProgress,
  };
}
