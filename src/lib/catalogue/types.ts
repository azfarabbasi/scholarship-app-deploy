import type { OpportunityTypeCode } from "@/lib/domain";
import type { DeadlineEvaluationInput, DeadlineEvaluationResult } from "@/lib/deadlines/types";
import type { StudyLevel } from "@/lib/schemas/opportunity-seed";
import type { WorkspaceRecord } from "@/lib/storage/types";

export type CatalogueOpportunityKind = "built-in" | "custom";

/**
 * The unified, display-ready shape used across the catalogue, workspace, and
 * calendar. Built-in records are derived from the versioned seed at build
 * time; custom records are supplied by the guest-local storage layer at
 * runtime. Both share this shape so views never need to special-case origin,
 * while `kind` keeps them clearly distinguishable in the UI.
 */
export interface CatalogueOpportunity {
  kind: CatalogueOpportunityKind;
  id: string;
  legacyId: number | null;
  slug: string;
  title: string;
  opportunityType: OpportunityTypeCode;
  providerName: string | null;
  countries: string[];
  regions: string[];
  studyLevels: StudyLevel[];
  benefitSummary: string;
  eligibilitySummary: string;
  officialUrl: string | null;
  verificationNotes: string | null;
  deadlineInput: DeadlineEvaluationInput;
  deadlineRawText: string;
  createdAt: string;
  updatedAt: string;
}

export interface EnrichedOpportunity {
  opportunity: CatalogueOpportunity;
  evaluation: DeadlineEvaluationResult;
  workspace: WorkspaceRecord | null;
}

export interface CatalogueStats {
  total: number;
  builtIn: number;
  custom: number;
  reliableOpenDeadlines: number;
  approaching: number;
  passedCurrentCycle: number;
  rolling: number;
  verificationRequired: number;
  shortlisted: number;
  applicationsInProgress: number;
}
