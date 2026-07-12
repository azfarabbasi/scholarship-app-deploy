import type {
  EntityId,
  InternalRecordMetadata,
  IsoDate,
  IsoDateTime,
  PublicationClassifiedRecord,
  PublicRecordMetadata,
} from "./common";
import type { DeadlineOccurrence } from "./deadlines";

export const OPPORTUNITY_TYPES = [
  "scholarship",
  "partial-scholarship",
  "internship",
  "fellowship",
  "exchange",
  "research-placement",
  "grant",
  "competition",
  "conference",
  "summer-school",
] as const;

export type OpportunityTypeCode = (typeof OPPORTUNITY_TYPES)[number];

export const OPPORTUNITY_TYPE_STATUSES = [
  "draft",
  "active",
  "deprecated",
  "retired",
] as const;

export type OpportunityTypeStatus =
  (typeof OPPORTUNITY_TYPE_STATUSES)[number];

interface OpportunityTypeFields {
  opportunityTypeId: EntityId;
  code: OpportunityTypeCode;
  label: string;
  description: string | null;
}

export type OpportunityType = PublicationClassifiedRecord<
  OpportunityTypeFields,
  OpportunityTypeStatus,
  "draft"
>;

export const OPPORTUNITY_STATUSES = [
  "draft",
  "in-review",
  "approved",
  "published",
  "archived",
  "superseded",
] as const;

export type OpportunityStatus = (typeof OPPORTUNITY_STATUSES)[number];

interface OpportunityFields {
  opportunityId: EntityId;
  slug: string;
  title: string;
  summary: string;
  description: string | null;
  opportunityTypeId: EntityId;
  providerId: EntityId;
  countryIds: readonly EntityId[];
  regionIds: readonly EntityId[];
  studyLevelIds: readonly EntityId[];
  fieldOfStudyIds: readonly EntityId[];
  fundingTypeIds: readonly EntityId[];
  eligibilityRuleGroupIds: readonly EntityId[];
  deadlineCycleIds: readonly EntityId[];
  intakeIds: readonly EntityId[];
  officialSourceIds: readonly EntityId[];
  documentRequirementIds: readonly EntityId[];
}

type InternalOpportunity = OpportunityFields &
  InternalRecordMetadata & {
    status: "draft" | "in-review" | "approved";
    publishedAt: null;
    archivedAt: null;
  };

type PublishedOpportunity = OpportunityFields &
  PublicRecordMetadata &
  (
    | {
        status: "published";
        publishedAt: IsoDateTime;
        archivedAt: null;
      }
    | {
        status: "archived" | "superseded";
        publishedAt: IsoDateTime;
        archivedAt: IsoDateTime;
      }
  );

/** Draft/review records are Internal; only publication-gated records are Public. */
export type Opportunity = InternalOpportunity | PublishedOpportunity;

export const COUNTRY_STATUSES = [
  "active",
  "deprecated",
  "historical",
] as const;

export type CountryStatus = (typeof COUNTRY_STATUSES)[number];

export interface Country extends PublicRecordMetadata {
  countryId: EntityId;
  isoAlpha2Code: string;
  isoAlpha3Code: string;
  name: string;
  status: CountryStatus;
}

export const REGION_STATUSES = [
  "draft",
  "active",
  "deprecated",
  "historical",
] as const;

export type RegionStatus = (typeof REGION_STATUSES)[number];

interface RegionFields {
  regionId: EntityId;
  code: string;
  name: string;
  countryIds: readonly EntityId[];
  parentRegionId: EntityId | null;
}

export type Region = PublicationClassifiedRecord<
  RegionFields,
  RegionStatus,
  "draft"
>;

export const STUDY_LEVEL_STATUSES = [
  "draft",
  "active",
  "deprecated",
  "retired",
] as const;

export type StudyLevelStatus = (typeof STUDY_LEVEL_STATUSES)[number];

interface StudyLevelFields {
  studyLevelId: EntityId;
  code: string;
  label: string;
  sortOrder: number;
}

export type StudyLevel = PublicationClassifiedRecord<
  StudyLevelFields,
  StudyLevelStatus,
  "draft"
>;

export const FIELD_OF_STUDY_STATUSES = [
  "draft",
  "active",
  "deprecated",
  "merged",
] as const;

export type FieldOfStudyStatus =
  (typeof FIELD_OF_STUDY_STATUSES)[number];

interface FieldOfStudyFields {
  fieldOfStudyId: EntityId;
  code: string;
  label: string;
  parentFieldOfStudyId: EntityId | null;
}

export type FieldOfStudy = PublicationClassifiedRecord<
  FieldOfStudyFields,
  FieldOfStudyStatus,
  "draft"
>;

export const FUNDING_TYPE_STATUSES = [
  "draft",
  "active",
  "deprecated",
  "retired",
] as const;

export type FundingTypeStatus = (typeof FUNDING_TYPE_STATUSES)[number];

interface FundingTypeFields {
  fundingTypeId: EntityId;
  code: string;
  label: string;
  description: string | null;
}

export type FundingType = PublicationClassifiedRecord<
  FundingTypeFields,
  FundingTypeStatus,
  "draft"
>;

export const FUNDING_BENEFIT_KINDS = [
  "tuition",
  "stipend",
  "travel",
  "accommodation",
  "insurance",
  "research-costs",
  "application-fee",
  "other",
] as const;

export type FundingBenefitKind = (typeof FUNDING_BENEFIT_KINDS)[number];

export const FUNDING_BENEFIT_STATUSES = [
  "draft",
  "in-review",
  "verified",
  "published",
  "superseded",
  "withdrawn",
] as const;

export type FundingBenefitStatus =
  (typeof FUNDING_BENEFIT_STATUSES)[number];

interface FundingBenefitFields {
  fundingBenefitId: EntityId;
  opportunityId: EntityId;
  fundingTypeId: EntityId;
  kind: FundingBenefitKind;
  summary: string;
  amount: number | null;
  currencyCode: string | null;
  frequency: string | null;
  conditions: string | null;
  sourceEvidenceId: EntityId | null;
}

export type FundingBenefit = PublicationClassifiedRecord<
  FundingBenefitFields,
  FundingBenefitStatus,
  "draft" | "in-review" | "verified"
>;

export const INTAKE_STATUSES = [
  "draft",
  "announced",
  "open-for-cycle",
  "started",
  "completed",
  "cancelled",
  "historical",
] as const;

export type IntakeStatus = (typeof INTAKE_STATUSES)[number];

interface IntakeFields {
  intakeId: EntityId;
  opportunityId: EntityId;
  label: string;
  academicYear: string | null;
  startDate: IsoDate | null;
  endDate: IsoDate | null;
  deadlineCycleIds: readonly EntityId[];
}

export type Intake = PublicationClassifiedRecord<
  IntakeFields,
  IntakeStatus,
  "draft"
>;

/** The established deadline occurrence contract is the canonical Deadline entity. */
export type Deadline = DeadlineOccurrence;
