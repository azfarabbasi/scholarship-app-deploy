import type { OpportunityTypeCode } from "@/lib/domain";
import type { DeadlineEvaluationInput, DeadlineEvaluationResult } from "@/lib/deadlines/types";
import type { StudyLevel } from "@/lib/schemas/opportunity-seed";
import type { WorkspaceRecord } from "@/lib/storage/types";

export type CatalogueOpportunityKind = "built-in" | "custom";

export type OverallVerificationStatus = "unverified" | "partially_verified" | "verified" | "stale";

/**
 * Public verification display facts — deliberately separate from deadline
 * status, personal-deadline status, and each other (see
 * docs/checkpoint-2/checkpoint-2-architecture.md, "public verification
 * display"). Custom (guest-authored) opportunities always report the
 * `unverified` defaults below; there is nothing to verify them against.
 */
export interface CatalogueVerificationInfo {
  status: OverallVerificationStatus;
  lastCheckedAt: string | null;
  officialSourceLabel: string | null;
  /** True only when every published document requirement for this opportunity carries a verified/published status. */
  documentsVerified: boolean;
  documentCount: number;
  /** True only when every active eligibility rule for this opportunity carries a verified source. */
  eligibilityVerified: boolean;
  eligibilityRuleCount: number;
}

export const UNVERIFIED_CATALOGUE_VERIFICATION: CatalogueVerificationInfo = {
  status: "unverified",
  lastCheckedAt: null,
  officialSourceLabel: null,
  documentsVerified: false,
  documentCount: 0,
  eligibilityVerified: false,
  eligibilityRuleCount: 0,
};

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
  verification: CatalogueVerificationInfo;
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
