import type {
  EntityId,
  InternalRecordMetadata,
  IsoDateTime,
  PublicRecordMetadata,
  UrlString,
} from "./common";
import type {
  DeadlineSource,
  DeadlineVerificationStatus,
} from "./deadlines";

export type OfficialSourcePublisher =
  | {
      kind: "provider";
      providerId: EntityId;
      organisationId: EntityId | null;
    }
  | {
      kind: "organisation";
      providerId: null;
      organisationId: EntityId;
    };

export const OFFICIAL_SOURCE_KINDS = [
  "opportunity-page",
  "provider-page",
  "official-guidance",
  "official-document",
  "official-announcement",
  "official-application-portal",
] as const;

export type OfficialSourceKind = (typeof OFFICIAL_SOURCE_KINDS)[number];

export const OFFICIAL_SOURCE_STATUSES = [
  "candidate",
  "confirmed-official",
  "active",
  "changed",
  "unavailable",
  "superseded",
  "archived",
] as const;

export type OfficialSourceStatus =
  (typeof OFFICIAL_SOURCE_STATUSES)[number];

interface OfficialSourceFields {
  officialSourceId: EntityId;
  opportunityIds: readonly EntityId[];
  responsiblePublisher: OfficialSourcePublisher;
  kind: OfficialSourceKind;
  label: string;
  url: UrlString;
  sourceOrganisationName: string;
  sourceLanguageCode: string | null;
  lastSuccessfulAccessAt: IsoDateTime | null;
}

type CandidateOfficialSource = OfficialSourceFields &
  InternalRecordMetadata & {
    status: "candidate";
    lastCheckedAt: IsoDateTime | null;
  };

type PublishedOfficialSource = OfficialSourceFields &
  PublicRecordMetadata & {
    status: Exclude<OfficialSourceStatus, "candidate">;
    lastCheckedAt: IsoDateTime;
  };

export type OfficialSource = CandidateOfficialSource | PublishedOfficialSource;

export const VERIFICATION_OUTCOMES = [
  "verified",
  "partially-verified",
  "conflicting",
  "changes-required",
  "unable-to-verify",
  "withdrawn",
] as const;

export type VerificationOutcome = (typeof VERIFICATION_OUTCOMES)[number];

export const VERIFICATION_RECORD_STATUSES = [
  "pending",
  "in-review",
  "verified",
  "rejected",
  "stale",
  "conflicting",
  "withdrawn",
  "superseded",
  "archived",
] as const;

export type VerificationRecordStatus =
  (typeof VERIFICATION_RECORD_STATUSES)[number];

export const VERIFICATION_SUBJECT_KINDS = [
  "opportunity",
  "provider",
  "deadline-occurrence",
  "deadline-cycle",
  "intake",
  "funding-benefit",
  "eligibility-rule",
  "document-requirement",
] as const;

export type VerificationSubjectKind =
  (typeof VERIFICATION_SUBJECT_KINDS)[number];

export interface VerificationRecord extends InternalRecordMetadata {
  verificationRecordId: EntityId;
  subjectKind: VerificationSubjectKind;
  subjectId: EntityId;
  opportunityId: EntityId | null;
  deadlineOccurrenceId: EntityId | null;
  officialSourceIds: readonly [EntityId, ...EntityId[]];
  reviewerUserAccountId: EntityId;
  approvedByUserAccountId: EntityId | null;
  reviewAssignmentId: EntityId | null;
  outcome: VerificationOutcome;
  status: VerificationRecordStatus;
  deadlineVerificationStatus: DeadlineVerificationStatus | null;
  checkedAt: IsoDateTime;
  summary: string;
  evidenceIds: readonly [EntityId, ...EntityId[]];
  supersedesVerificationRecordId: EntityId | null;
}

export const SOURCE_EVIDENCE_KINDS = [
  "fact",
  "deadline",
  "eligibility",
  "funding",
  "document-requirement",
  "intake",
] as const;

export type SourceEvidenceKind = (typeof SOURCE_EVIDENCE_KINDS)[number];

export const SOURCE_EVIDENCE_STATUSES = [
  "captured",
  "accepted",
  "superseded",
  "unavailable",
  "retention-expired",
  "redacted",
] as const;

export type SourceEvidenceStatus =
  (typeof SOURCE_EVIDENCE_STATUSES)[number];

export interface SourceEvidence extends InternalRecordMetadata {
  sourceEvidenceId: EntityId;
  opportunityId: EntityId;
  officialSourceId: EntityId;
  verificationRecordId: EntityId | null;
  kind: SourceEvidenceKind;
  status: SourceEvidenceStatus;
  sourceLocator: string | null;
  evidenceText: string;
  capturedAt: IsoDateTime;
  capturedByActorId: EntityId;
  deadlineSourceSnapshot: DeadlineSource | null;
  supersededAt: IsoDateTime | null;
}
