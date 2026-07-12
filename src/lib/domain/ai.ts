import type {
  EntityId,
  IsoDateTime,
  RestrictedRecordMetadata,
  WorkspaceOwnedRecordMetadata,
} from "./common";

export const AI_INTERACTION_PURPOSES = [
  "source-grounded-answer",
  "eligibility-explanation",
  "application-guidance",
  "staff-extraction-draft",
] as const;

export type AIInteractionPurpose =
  (typeof AI_INTERACTION_PURPOSES)[number];

export const AI_INTERACTION_STATUSES = [
  "requested",
  "completed",
  "refused",
  "failed",
  "redacted",
  "retention-expired",
  "deleted",
] as const;

export type AIInteractionStatus =
  (typeof AI_INTERACTION_STATUSES)[number];

export const AI_HUMAN_APPROVAL_STATUSES = [
  "not-required",
  "pending",
  "approved",
  "rejected",
] as const;

export type AIHumanApprovalStatus =
  (typeof AI_HUMAN_APPROVAL_STATUSES)[number];

interface AIInteractionBase extends WorkspaceOwnedRecordMetadata {
  dataClassification: "Sensitive personal metadata";
  aiInteractionRecordId: EntityId;
  modelIdentifier: string;
  rawPromptRetained: false;
  rawResponseRetained: false;
  startedAt: IsoDateTime;
  completedAt: IsoDateTime | null;
  inputTokenCount: number;
  outputTokenCount: number;
}

export type AIInteractionRetention =
  | {
      status: Exclude<AIInteractionStatus, "retention-expired" | "deleted">;
      retentionMode: "none";
      promptSummary: null;
      responseSummary: null;
      retentionExpiresAt: null;
    }
  | {
      status: Exclude<AIInteractionStatus, "retention-expired" | "deleted">;
      retentionMode: "redacted-summary";
      promptSummary: string;
      responseSummary: string | null;
      retentionExpiresAt: IsoDateTime;
    }
  | {
      status: "retention-expired" | "deleted";
      retentionMode: "none";
      promptSummary: null;
      responseSummary: null;
      retentionExpiresAt: null;
    };

type GroundedStudentInteraction = {
  purpose: "source-grounded-answer" | "application-guidance";
  opportunityId: EntityId;
  deterministicEligibilityResultId: null;
  officialSourceIds: readonly [EntityId, ...EntityId[]];
  sourceEvidenceIds: readonly [EntityId, ...EntityId[]];
  consentVersion: string;
  humanApprovalStatus: "not-required";
  approvedForDownstreamUseAt: null;
};

type EligibilityExplanationInteraction = {
  purpose: "eligibility-explanation";
  opportunityId: EntityId;
  deterministicEligibilityResultId: EntityId;
  officialSourceIds: readonly [EntityId, ...EntityId[]];
  sourceEvidenceIds: readonly [EntityId, ...EntityId[]];
  consentVersion: string;
  humanApprovalStatus: "not-required";
  approvedForDownstreamUseAt: null;
};

type StaffExtractionInteraction = {
  purpose: "staff-extraction-draft";
  opportunityId: EntityId;
  deterministicEligibilityResultId: null;
  officialSourceIds: readonly [EntityId, ...EntityId[]];
  sourceEvidenceIds: readonly [EntityId, ...EntityId[]];
  consentVersion: null;
} & (
  | {
      humanApprovalStatus: "pending" | "rejected";
      approvedForDownstreamUseAt: null;
    }
  | {
      humanApprovalStatus: "approved";
      approvedForDownstreamUseAt: IsoDateTime;
    }
);

export type AIInteractionContext =
  | GroundedStudentInteraction
  | EligibilityExplanationInteraction
  | StaffExtractionInteraction;

export type AIInteractionRecord = AIInteractionBase &
  AIInteractionRetention &
  AIInteractionContext;

export const AI_QUOTA_PERIODS = ["daily", "monthly"] as const;

export type AIQuotaPeriod = (typeof AI_QUOTA_PERIODS)[number];

export const AI_USAGE_QUOTA_STATUSES = [
  "active",
  "near-limit",
  "exhausted",
  "reset",
  "suspended",
  "expired",
] as const;

export type AIUsageQuotaStatus =
  (typeof AI_USAGE_QUOTA_STATUSES)[number];

export type AIQuotaSubject =
  | {
      kind: "account";
      userAccountId: EntityId;
      anonymousSubjectId: null;
    }
  | {
      kind: "anonymous";
      userAccountId: null;
      anonymousSubjectId: string;
    };

export interface AIUsageQuota extends RestrictedRecordMetadata {
  aiUsageQuotaId: EntityId;
  subject: AIQuotaSubject;
  period: AIQuotaPeriod;
  periodStartAt: IsoDateTime;
  periodEndAt: IsoDateTime;
  requestLimit: number;
  requestCount: number;
  inputTokenLimit: number;
  inputTokenCount: number;
  outputTokenLimit: number;
  outputTokenCount: number;
  quotaExceededAt: IsoDateTime | null;
  status: AIUsageQuotaStatus;
}
