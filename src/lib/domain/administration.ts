import type {
  DomainEntityName,
  EntityId,
  InternalRecordMetadata,
  IsoDateTime,
  PlatformRole,
  PublicationClassifiedRecord,
  RestrictedRecordMetadata,
  SoftDeletionMetadata,
} from "./common";

export const CORRECTION_REPORT_STATUSES = [
  "submitted",
  "triaged",
  "duplicate",
  "assigned",
  "investigating",
  "resolved",
  "rejected",
  "closed",
  "redacted",
] as const;

export type CorrectionReportStatus =
  (typeof CORRECTION_REPORT_STATUSES)[number];

export interface CorrectionReport
  extends InternalRecordMetadata,
    SoftDeletionMetadata {
  correctionReportId: EntityId;
  opportunityId: EntityId;
  officialSourceId: EntityId | null;
  reporterUserAccountId: EntityId | null;
  guestSubmissionId: string | null;
  summary: string;
  proposedCorrection: string | null;
  status: CorrectionReportStatus;
  resolvedByUserAccountId: EntityId | null;
  resolvedAt: IsoDateTime | null;
}

export const REVIEW_ASSIGNMENT_STATUSES = [
  "queued",
  "assigned",
  "accepted",
  "in-review",
  "blocked",
  "completed",
  "reassigned",
  "cancelled",
  "expired",
] as const;

export type ReviewAssignmentStatus =
  (typeof REVIEW_ASSIGNMENT_STATUSES)[number];

export const REVIEW_SUBJECT_KINDS = [
  "opportunity",
  "correction-report",
  "official-source",
  "verification-record",
] as const;

export type ReviewSubjectKind = (typeof REVIEW_SUBJECT_KINDS)[number];

export type ReviewStaffRole = Extract<
  PlatformRole,
  "Reviewer" | "Senior Reviewer"
>;

export interface ReviewAssignment extends RestrictedRecordMetadata {
  reviewAssignmentId: EntityId;
  subjectKind: ReviewSubjectKind;
  subjectId: EntityId;
  opportunityId: EntityId | null;
  correctionReportId: EntityId | null;
  verificationRecordId: EntityId | null;
  subjectVersion: number;
  subjectAuthorUserAccountId: EntityId | null;
  reviewerUserAccountId: EntityId;
  assignedByUserAccountId: EntityId;
  requiredRole: ReviewStaffRole;
  status: ReviewAssignmentStatus;
  assignedAt: IsoDateTime;
  dueAt: IsoDateTime | null;
  completedAt: IsoDateTime | null;
  conflictOfInterestDeclaredAt: IsoDateTime | null;
  conflictOfInterestDetails: string | null;
  independenceCheckPassedAt: IsoDateTime | null;
  reviewerNotes: string | null;
}

export const AUDIT_ACTIONS = [
  "create",
  "read-sensitive",
  "update",
  "delete",
  "restore",
  "approve",
  "publish",
  "archive",
  "assign",
  "export",
  "sign-in",
  "permission-change",
] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export const AUDIT_LOG_STATUSES = [
  "active",
  "access-restricted",
  "retention-held",
  "anonymised",
  "expired",
] as const;

export type AuditLogStatus = (typeof AUDIT_LOG_STATUSES)[number];

export interface AuditLog {
  dataClassification: "Restricted operational data";
  auditLogId: EntityId;
  actorId: EntityId | null;
  actorRole: PlatformRole;
  action: AuditAction;
  entityName: DomainEntityName;
  entityId: EntityId | null;
  occurredAt: IsoDateTime;
  reasonCode: string | null;
  correlationId: string | null;
  changedFields: readonly string[];
  redactedChangeSummary: string | null;
  containsSecretOrDocumentContent: false;
  retentionExpiresAt: IsoDateTime | null;
  status: AuditLogStatus;
  integrityDigest: string;
  immutable: true;
}

export const FEATURE_FLAG_STATUSES = [
  "draft",
  "scheduled",
  "active",
  "paused",
  "expired",
  "retired",
] as const;

export type FeatureFlagStatus = (typeof FEATURE_FLAG_STATUSES)[number];

export interface FeatureFlag extends RestrictedRecordMetadata {
  featureFlagId: EntityId;
  key: string;
  description: string;
  status: FeatureFlagStatus;
  enabledForRoles: readonly PlatformRole[];
  rolloutPercentage: number;
  expiresAt: IsoDateTime | null;
}

export const ADVERTISEMENT_PLACEMENT_STATUSES = [
  "draft",
  "compliance-review",
  "approved",
  "scheduled",
  "active",
  "paused",
  "completed",
  "rejected",
  "archived",
] as const;

export type AdvertisementPlacementStatus =
  (typeof ADVERTISEMENT_PLACEMENT_STATUSES)[number];

export interface AdvertisementPlacement extends RestrictedRecordMetadata {
  advertisementPlacementId: EntityId;
  placementKey: string;
  label: string;
  surface: string;
  sponsorOrganisationId: EntityId;
  startsAt: IsoDateTime;
  endsAt: IsoDateTime;
  status: AdvertisementPlacementStatus;
  contextualTargetingOnly: true;
  usesSensitivePersonalMetadata: false;
}

interface SponsoredOpportunityDisclosureFields {
  sponsoredOpportunityDisclosureId: EntityId;
  opportunityId: EntityId;
  advertisementPlacementId: EntityId;
  sponsorOrganisationId: EntityId;
  disclosureLabel: string;
  disclosureText: string;
  startsAt: IsoDateTime;
  endsAt: IsoDateTime;
}

export const SPONSORED_OPPORTUNITY_DISCLOSURE_STATUSES = [
  "draft",
  "in-review",
  "approved",
  "active",
  "expired",
  "superseded",
  "withdrawn",
] as const;

export type SponsoredOpportunityDisclosureStatus =
  (typeof SPONSORED_OPPORTUNITY_DISCLOSURE_STATUSES)[number];

export type SponsoredOpportunityDisclosure = PublicationClassifiedRecord<
  SponsoredOpportunityDisclosureFields,
  SponsoredOpportunityDisclosureStatus,
  "draft" | "in-review" | "approved"
>;
