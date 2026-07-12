import type {
  EntityId,
  IsoDate,
  IsoDateTime,
  PublicationClassifiedRecord,
  WorkspaceOwnedRecordMetadata,
} from "./common";

export const DOCUMENT_CATEGORIES = [
  "identity-proof",
  "academic-record",
  "qualification",
  "language-test",
  "curriculum-vitae",
  "personal-statement",
  "research-proposal",
  "reference",
  "employment-record",
  "portfolio",
  "other",
] as const;

export type DocumentCategory = (typeof DOCUMENT_CATEGORIES)[number];

export const DOCUMENT_TEMPLATE_STATUSES = [
  "draft",
  "active",
  "deprecated",
  "retired",
] as const;

export type DocumentTemplateStatus =
  (typeof DOCUMENT_TEMPLATE_STATUSES)[number];

interface RequiredDocumentTemplateFields {
  requiredDocumentTemplateId: EntityId;
  code: string;
  label: string;
  description: string | null;
  category: DocumentCategory;
  mayExpire: boolean;
}

export type RequiredDocumentTemplate = PublicationClassifiedRecord<
  RequiredDocumentTemplateFields,
  DocumentTemplateStatus,
  "draft"
>;

export const DOCUMENT_REQUIREMENT_LEVELS = [
  "required",
  "conditionally-required",
  "optional",
] as const;

export type DocumentRequirementLevel =
  (typeof DOCUMENT_REQUIREMENT_LEVELS)[number];

export const DOCUMENT_REQUIREMENT_STATUSES = [
  "draft",
  "in-review",
  "verified",
  "published",
  "superseded",
  "withdrawn",
] as const;

export type DocumentRequirementStatus =
  (typeof DOCUMENT_REQUIREMENT_STATUSES)[number];

interface OpportunityDocumentRequirementFields {
  opportunityDocumentRequirementId: EntityId;
  opportunityId: EntityId;
  requiredDocumentTemplateId: EntityId;
  requirementLevel: DocumentRequirementLevel;
  instructions: string | null;
  conditionSummary: string | null;
  sourceEvidenceId: EntityId;
}

export type OpportunityDocumentRequirement = PublicationClassifiedRecord<
  OpportunityDocumentRequirementFields,
  DocumentRequirementStatus,
  "draft" | "in-review" | "verified"
>;

export const MASTER_DOCUMENT_STATUSES = [
  "missing",
  "planned",
  "draft",
  "ready",
  "needs-update",
  "expired",
  "archived",
  "deleted",
] as const;

export type MasterDocumentStatus =
  (typeof MASTER_DOCUMENT_STATUSES)[number];

/** Metadata-only representation of a reusable student document. */
export interface MasterDocumentRecord extends WorkspaceOwnedRecordMetadata {
  dataClassification: "Sensitive personal metadata";
  masterDocumentRecordId: EntityId;
  requiredDocumentTemplateId: EntityId;
  category: DocumentCategory;
  displayLabel: string | null;
  versionLabel: string | null;
  status: MasterDocumentStatus;
  expiresOn: IsoDate | null;
}

export const APPLICATION_DOCUMENT_STATUSES = [
  "not-started",
  "not-applicable",
  "planned",
  "in-progress",
  "ready",
  "needs-update",
  "expired",
  "removed",
] as const;

export type ApplicationDocumentStatus =
  (typeof APPLICATION_DOCUMENT_STATUSES)[number];

/** Metadata-only progress state for one application requirement. */
export interface ApplicationDocumentProgress
  extends WorkspaceOwnedRecordMetadata {
  dataClassification: "Sensitive personal metadata";
  applicationDocumentProgressId: EntityId;
  applicationTrackerId: EntityId;
  opportunityDocumentRequirementId: EntityId;
  masterDocumentRecordId: EntityId | null;
  status: ApplicationDocumentStatus;
  versionLabel: string | null;
  expiresOn: IsoDate | null;
  completedAt: IsoDateTime | null;
}
