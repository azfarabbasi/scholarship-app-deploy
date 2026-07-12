import type {
  EntityId,
  IsoDateTime,
  WorkspaceOwnedRecordMetadata,
} from "./common";

export const REMINDER_KINDS = [
  "deadline",
  "task",
  "document-expiry",
  "application-follow-up",
] as const;

export type ReminderKind = (typeof REMINDER_KINDS)[number];

export const REMINDER_STATUSES = [
  "scheduled",
  "due",
  "sent",
  "failed",
  "snoozed",
  "cancelled",
  "expired",
  "deleted",
] as const;

export type ReminderStatus = (typeof REMINDER_STATUSES)[number];

export interface Reminder extends WorkspaceOwnedRecordMetadata {
  dataClassification: "Private user data";
  reminderId: EntityId;
  kind: ReminderKind;
  opportunityId: EntityId | null;
  applicationTrackerId: EntityId | null;
  userTaskId: EntityId | null;
  masterDocumentRecordId: EntityId | null;
  scheduledFor: IsoDateTime;
  timezone: string;
  message: string;
  status: ReminderStatus;
  deliveredAt: IsoDateTime | null;
}

export const NOTIFICATION_CHANNELS = [
  "in-app",
  "browser-push",
] as const;

export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];

export const NOTIFICATION_PREFERENCE_STATUSES = [
  "unset",
  "enabled",
  "paused",
  "revoked",
  "reset",
  "deleted",
] as const;

export type NotificationPreferenceStatus =
  (typeof NOTIFICATION_PREFERENCE_STATUSES)[number];

export interface NotificationPreference
  extends WorkspaceOwnedRecordMetadata {
  dataClassification: "Private user data";
  notificationPreferenceId: EntityId;
  channel: NotificationChannel;
  enabled: boolean;
  deadlineReminderOffsetsDays: readonly number[];
  quietHoursStart: string | null;
  quietHoursEnd: string | null;
  timezone: string;
  consentedAt: IsoDateTime | null;
  status: NotificationPreferenceStatus;
}
