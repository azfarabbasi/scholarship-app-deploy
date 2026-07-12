import type {
  EntityId,
  IsoDate,
  IsoDateTime,
  PublicationClassifiedRecord,
  WorkspaceOwnedRecordMetadata,
} from "./common";

export const SAVED_OPPORTUNITY_STATUSES = [
  "saved",
  "migration-pending",
  "synced",
  "removed",
  "orphaned-by-archive",
] as const;

export type SavedOpportunityStatus =
  (typeof SAVED_OPPORTUNITY_STATUSES)[number];

export interface SavedOpportunity extends WorkspaceOwnedRecordMetadata {
  dataClassification: "Private user data";
  savedOpportunityId: EntityId;
  opportunityId: EntityId;
  savedAt: IsoDateTime;
  priority: "low" | "medium" | "high" | null;
  status: SavedOpportunityStatus;
}

export const APPLICATION_TRACKER_STATUSES = [
  "considering",
  "preparing",
  "ready",
  "submitted-manually",
  "interview",
  "offered",
  "accepted",
  "rejected",
  "withdrawn",
  "closed",
  "deleted",
] as const;

export type ApplicationTrackerStatus =
  (typeof APPLICATION_TRACKER_STATUSES)[number];

export interface ApplicationTracker extends WorkspaceOwnedRecordMetadata {
  dataClassification: "Private user data";
  applicationTrackerId: EntityId;
  opportunityId: EntityId;
  intakeId: EntityId | null;
  currentApplicationStageId: EntityId;
  status: ApplicationTrackerStatus;
  targetDeadlineOccurrenceId: EntityId | null;
  startedAt: IsoDateTime;
  submittedAt: IsoDateTime | null;
  decisionAt: IsoDateTime | null;
  submissionMode: "user-managed";
  autonomousSubmissionAllowed: false;
}

export const APPLICATION_STAGE_CODES = [
  "researching",
  "preparing-documents",
  "drafting-application",
  "ready-to-submit",
  "submitted",
  "awaiting-decision",
  "decision-received",
] as const;

export type ApplicationStageCode =
  (typeof APPLICATION_STAGE_CODES)[number];

export const APPLICATION_STAGE_STATUSES = [
  "draft",
  "active",
  "deprecated",
  "retired",
] as const;

export type ApplicationStageStatus =
  (typeof APPLICATION_STAGE_STATUSES)[number];

interface ApplicationStageFields {
  applicationStageId: EntityId;
  code: ApplicationStageCode;
  label: string;
  sortOrder: number;
  isTerminal: boolean;
}

export type ApplicationStage = PublicationClassifiedRecord<
  ApplicationStageFields,
  ApplicationStageStatus,
  "draft"
>;

export const APPLICATION_ACTIVITY_KINDS = [
  "created",
  "stage-changed",
  "status-changed",
  "task-completed",
  "document-status-changed",
  "submitted-by-user",
  "decision-recorded",
  "note-added",
] as const;

export type ApplicationActivityKind =
  (typeof APPLICATION_ACTIVITY_KINDS)[number];

export const APPLICATION_ACTIVITY_STATUSES = [
  "recorded",
  "corrected",
  "redacted",
  "deleted-with-tracker",
] as const;

export type ApplicationActivityStatus =
  (typeof APPLICATION_ACTIVITY_STATUSES)[number];

export interface ApplicationActivity extends WorkspaceOwnedRecordMetadata {
  dataClassification: "Private user data";
  applicationActivityId: EntityId;
  applicationTrackerId: EntityId;
  kind: ApplicationActivityKind;
  occurredAt: IsoDateTime;
  summary: string;
  fromStageId: EntityId | null;
  toStageId: EntityId | null;
  status: ApplicationActivityStatus;
}

export const USER_NOTE_STATUSES = [
  "draft",
  "active",
  "migration-pending",
  "archived",
  "deleted",
] as const;

export type UserNoteStatus = (typeof USER_NOTE_STATUSES)[number];

export interface UserNote extends WorkspaceOwnedRecordMetadata {
  dataClassification: "Private user data";
  userNoteId: EntityId;
  opportunityId: EntityId | null;
  applicationTrackerId: EntityId | null;
  noteText: string;
  pinned: boolean;
  status: UserNoteStatus;
}

export const USER_TASK_STATUSES = [
  "pending",
  "in-progress",
  "completed",
  "cancelled",
  "overdue",
  "deleted",
] as const;

export type UserTaskStatus = (typeof USER_TASK_STATUSES)[number];

export interface UserTask extends WorkspaceOwnedRecordMetadata {
  dataClassification: "Private user data";
  userTaskId: EntityId;
  opportunityId: EntityId | null;
  applicationTrackerId: EntityId | null;
  title: string;
  description: string | null;
  dueOn: IsoDate | null;
  status: UserTaskStatus;
  completedAt: IsoDateTime | null;
  source: "user" | "platform-template";
}
