/** PostgreSQL-compatible scalar aliases used by the domain contracts. */
export type EntityId = string;
export type IsoDate = string;
export type IsoDateTime = string;
export type UrlString = string;
export type EmailAddress = string;

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue =
  | JsonPrimitive
  | readonly JsonValue[]
  | { readonly [key: string]: JsonValue };

export const PLATFORM_ROLES = [
  "Guest",
  "Student",
  "Reviewer",
  "Senior Reviewer",
  "Administrator",
  "System Service",
] as const;

export type PlatformRole = (typeof PLATFORM_ROLES)[number];

export const DATA_CLASSIFICATIONS = [
  "Public",
  "Internal",
  "Private user data",
  "Sensitive personal metadata",
  "Restricted operational data",
  "Prohibited Year 1 data",
] as const;

export type DataClassification = (typeof DATA_CLASSIFICATIONS)[number];

export const DOMAIN_ENTITY_NAMES = [
  "Opportunity",
  "OpportunityType",
  "Provider",
  "Organisation",
  "Country",
  "Region",
  "StudyLevel",
  "FieldOfStudy",
  "FundingType",
  "FundingBenefit",
  "EligibilityRule",
  "EligibilityRuleGroup",
  "Deadline",
  "DeadlineCycle",
  "Intake",
  "OfficialSource",
  "VerificationRecord",
  "SourceEvidence",
  "RequiredDocumentTemplate",
  "OpportunityDocumentRequirement",
  "UserAccount",
  "UserProfile",
  "EducationRecord",
  "WorkExperienceRecord",
  "ResearchExperienceRecord",
  "PublicationRecord",
  "CertificationRecord",
  "LanguageTestRecord",
  "UserPreference",
  "SavedOpportunity",
  "ApplicationTracker",
  "ApplicationStage",
  "ApplicationActivity",
  "UserNote",
  "UserTask",
  "MasterDocumentRecord",
  "ApplicationDocumentProgress",
  "Reminder",
  "NotificationPreference",
  "CorrectionReport",
  "ReviewAssignment",
  "AuditLog",
  "AIInteractionRecord",
  "AIUsageQuota",
  "FeatureFlag",
  "AdvertisementPlacement",
  "SponsoredOpportunityDisclosure",
] as const;

export type DomainEntityName = (typeof DOMAIN_ENTITY_NAMES)[number];

export const USER_DATA_SCOPES = ["guest-local", "account-cloud"] as const;

export type UserDataScope = (typeof USER_DATA_SCOPES)[number];

export interface AuditMetadata {
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
  createdByActorId: EntityId | null;
  updatedByActorId: EntityId | null;
  version: number;
}

export interface SoftDeletionMetadata {
  deletedAt: IsoDateTime | null;
  deletedByActorId: EntityId | null;
}

export interface PublicRecordMetadata extends AuditMetadata {
  dataClassification: "Public";
}

export interface InternalRecordMetadata extends AuditMetadata {
  dataClassification: "Internal";
}

/**
 * Couples catalogue lifecycle with visibility so an unpublished record cannot
 * accidentally satisfy a Public contract.
 */
export type PublicationClassifiedRecord<
  Fields,
  Status extends string,
  InternalStatus extends Status,
> = Fields &
  (
    | (InternalRecordMetadata & { status: InternalStatus })
    | (PublicRecordMetadata & {
        status: Exclude<Status, InternalStatus>;
      })
  );

export interface RestrictedRecordMetadata extends AuditMetadata {
  dataClassification: "Restricted operational data";
}

export interface GuestLocalOwnership {
  dataScope: "guest-local";
  ownerUserAccountId: null;
  guestLocalId: string;
}

export interface AccountCloudOwnership {
  dataScope: "account-cloud";
  ownerUserAccountId: EntityId;
  guestLocalId: null;
}

export type WorkspaceOwnership = GuestLocalOwnership | AccountCloudOwnership;

/** Supports local guest ownership without implying a cloud guest account. */
export interface WorkspaceOwnedRecordMetadata
  extends AuditMetadata,
    SoftDeletionMetadata {
  dataClassification: "Private user data" | "Sensitive personal metadata";
  ownership: WorkspaceOwnership;
}
