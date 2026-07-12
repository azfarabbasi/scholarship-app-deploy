import type {
  AuditMetadata,
  EmailAddress,
  EntityId,
  IsoDate,
  IsoDateTime,
  PlatformRole,
  SoftDeletionMetadata,
  WorkspaceOwnedRecordMetadata,
} from "./common";

export const USER_ACCOUNT_STATUSES = [
  "pending-verification",
  "active",
  "suspended",
  "deletion-requested",
  "deactivated",
  "deleted",
] as const;

export type UserAccountStatus = (typeof USER_ACCOUNT_STATUSES)[number];

export type HumanAccountRole = Exclude<
  PlatformRole,
  "Guest" | "System Service"
>;

export interface UserAccount extends AuditMetadata, SoftDeletionMetadata {
  dataClassification: "Private user data";
  userAccountId: EntityId;
  emailAddress: EmailAddress;
  emailVerifiedAt: IsoDateTime | null;
  platformRoles: readonly [HumanAccountRole, ...HumanAccountRole[]];
  status: UserAccountStatus;
  lastSignedInAt: IsoDateTime | null;
  deletionRequestedAt: IsoDateTime | null;
}

export const USER_PROFILE_STATUSES = [
  "local-draft",
  "active",
  "incomplete",
  "migration-pending",
  "archived",
  "deletion-requested",
  "deleted",
] as const;

export type UserProfileStatus = (typeof USER_PROFILE_STATUSES)[number];

export interface UserProfile extends WorkspaceOwnedRecordMetadata {
  dataClassification: "Sensitive personal metadata";
  userProfileId: EntityId;
  displayName: string | null;
  nationalityCountryIds: readonly EntityId[];
  residenceCountryId: EntityId | null;
  provinceOrState: string | null;
  domicile: string | null;
  preferredStudyLevelIds: readonly EntityId[];
  preferredFieldOfStudyIds: readonly EntityId[];
  status: UserProfileStatus;
  profileCompletedAt: IsoDateTime | null;
}

export const EDUCATION_RECORD_STATUSES = [
  "draft",
  "current",
  "completed",
  "withdrawn",
  "archived",
  "deleted",
] as const;

export type EducationRecordStatus =
  (typeof EDUCATION_RECORD_STATUSES)[number];

export interface EducationRecord extends WorkspaceOwnedRecordMetadata {
  dataClassification: "Sensitive personal metadata";
  educationRecordId: EntityId;
  userProfileId: EntityId;
  institutionName: string;
  countryId: EntityId | null;
  studyLevelId: EntityId;
  fieldOfStudyId: EntityId | null;
  qualificationName: string;
  startDate: IsoDate | null;
  graduationDate: IsoDate | null;
  cgpa: number | null;
  cgpaScale: number | null;
  status: EducationRecordStatus;
}

export const EXPERIENCE_RECORD_STATUSES = [
  "draft",
  "current",
  "completed",
  "archived",
  "deleted",
] as const;

export type ExperienceRecordStatus =
  (typeof EXPERIENCE_RECORD_STATUSES)[number];

export interface WorkExperienceRecord extends WorkspaceOwnedRecordMetadata {
  dataClassification: "Sensitive personal metadata";
  workExperienceRecordId: EntityId;
  userProfileId: EntityId;
  organisationName: string;
  roleTitle: string;
  countryId: EntityId | null;
  startDate: IsoDate;
  endDate: IsoDate | null;
  isCurrent: boolean;
  summary: string | null;
  status: ExperienceRecordStatus;
}

export interface ResearchExperienceRecord
  extends WorkspaceOwnedRecordMetadata {
  dataClassification: "Sensitive personal metadata";
  researchExperienceRecordId: EntityId;
  userProfileId: EntityId;
  institutionName: string;
  roleTitle: string;
  fieldOfStudyId: EntityId | null;
  startDate: IsoDate;
  endDate: IsoDate | null;
  isCurrent: boolean;
  summary: string | null;
  status: ExperienceRecordStatus;
}

export const PUBLICATION_STATUSES = [
  "draft",
  "submitted",
  "accepted",
  "published",
  "withdrawn",
  "archived",
  "deleted",
] as const;

export type PublicationStatus = (typeof PUBLICATION_STATUSES)[number];

export interface PublicationRecord extends WorkspaceOwnedRecordMetadata {
  dataClassification: "Sensitive personal metadata";
  publicationRecordId: EntityId;
  userProfileId: EntityId;
  title: string;
  publicationName: string | null;
  publicationDate: IsoDate | null;
  identifier: string | null;
  publicUrl: string | null;
  status: PublicationStatus;
}

export const CERTIFICATION_RECORD_STATUSES = [
  "draft",
  "valid",
  "expiring",
  "expired",
  "revoked",
  "archived",
  "deleted",
] as const;

export type CertificationRecordStatus =
  (typeof CERTIFICATION_RECORD_STATUSES)[number];

export interface CertificationRecord extends WorkspaceOwnedRecordMetadata {
  dataClassification: "Sensitive personal metadata";
  certificationRecordId: EntityId;
  userProfileId: EntityId;
  certificationName: string;
  issuingOrganisation: string;
  issuedOn: IsoDate | null;
  expiresOn: IsoDate | null;
  credentialIdentifier: string | null;
  status: CertificationRecordStatus;
}

export const LANGUAGE_TEST_TYPES = [
  "IELTS",
  "TOEFL",
  "PTE",
  "Duolingo English Test",
  "Cambridge English",
  "other",
] as const;

export type LanguageTestType = (typeof LANGUAGE_TEST_TYPES)[number];

export const LANGUAGE_TEST_RECORD_STATUSES = [
  "planned",
  "booked",
  "taken",
  "valid",
  "expired",
  "cancelled",
  "archived",
  "deleted",
] as const;

export type LanguageTestRecordStatus =
  (typeof LANGUAGE_TEST_RECORD_STATUSES)[number];

export interface LanguageTestRecord extends WorkspaceOwnedRecordMetadata {
  dataClassification: "Sensitive personal metadata";
  languageTestRecordId: EntityId;
  userProfileId: EntityId;
  testType: LanguageTestType;
  testDate: IsoDate | null;
  overallScore: number | null;
  scoreScale: string | null;
  expiresOn: IsoDate | null;
  status: LanguageTestRecordStatus;
}

export const USER_PREFERENCE_STATUSES = [
  "local-draft",
  "active",
  "migration-pending",
  "reset",
  "deleted",
] as const;

export type UserPreferenceStatus =
  (typeof USER_PREFERENCE_STATUSES)[number];

export interface UserPreference extends WorkspaceOwnedRecordMetadata {
  dataClassification: "Private user data";
  userPreferenceId: EntityId;
  locale: string;
  timezone: string;
  preferredCountryIds: readonly EntityId[];
  preferredRegionIds: readonly EntityId[];
  preferredOpportunityTypes: readonly string[];
  darkMode: "system" | "light" | "dark";
  analyticsConsent: boolean;
  aiPersonalisationConsent: boolean;
  status: UserPreferenceStatus;
}
