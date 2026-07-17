import { z } from "zod";
import { getAllGuestAiConversations, getGuestAiMessages } from "./ai-assistant";
import { getAllCustomOpportunities } from "./custom-opportunities";
import { getDb } from "./db";
import { getGuestEligibilityAnswers } from "./eligibility";
import { emitStorageChange } from "./events";
import { getAllGuestNotifications } from "./notifications";
import { getPreferences } from "./preferences";
import { getGuestReminderPreferences, getAllGuestReminders } from "./reminders";
import { getAllGuestSavedSearches } from "./saved-searches";
import { SCHEMA_VERSION } from "./types";
import type {
  CustomOpportunityRecord,
  EligibilityAnswersRecord,
  GuestAiConversationRecord,
  GuestAiMessageRecord,
  NotificationRecord,
  PreferencesRecord,
  ReminderPreferencesRecord,
  ReminderRecord,
  SavedSearchRecord,
  WorkspaceRecord,
} from "./types";
import { getAllWorkspaceRecords } from "./workspace";

export const MAX_BACKUP_FILE_SIZE_BYTES = 5 * 1024 * 1024;
export const BACKUP_APP_ID = "scholartrack";

export interface BackupPayload {
  app: typeof BACKUP_APP_ID;
  schemaVersion: number;
  createdAt: string;
  counts: { workspace: number; customOpportunities: number };
  data: {
    workspace: WorkspaceRecord[];
    customOpportunities: CustomOpportunityRecord[];
    preferences: PreferencesRecord | null;
    eligibilityAnswers: EligibilityAnswersRecord | null;
    savedSearches: SavedSearchRecord[];
    reminderPreferences: ReminderPreferencesRecord | null;
    reminders: ReminderRecord[];
    notifications: NotificationRecord[];
    /** Absent unless the user explicitly opted in to including AI history in this export — never included by default (see Checkpoint 5 privacy controls). */
    aiConversations?: GuestAiConversationRecord[];
    aiMessages?: GuestAiMessageRecord[];
  };
}

const DANGEROUS_KEYS = new Set(["__proto__", "constructor", "prototype"]);

/** Defense in depth against prototype pollution, ahead of schema validation. */
export function containsDangerousKeys(value: unknown): boolean {
  if (Array.isArray(value)) {
    return value.some(containsDangerousKeys);
  }
  if (value && typeof value === "object") {
    for (const key of Object.keys(value)) {
      if (DANGEROUS_KEYS.has(key)) {
        return true;
      }
      if (containsDangerousKeys((value as Record<string, unknown>)[key])) {
        return true;
      }
    }
  }
  return false;
}

export const checklistItemSchema = z
  .object({
    id: z.string().min(1),
    label: z.string(),
    completed: z.boolean(),
    origin: z.enum(["template", "user"]),
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .strict();

export const workspaceRecordSchema = z
  .object({
    opportunityId: z.string().min(1),
    shortlisted: z.boolean(),
    stage: z.string(),
    notes: z.string(),
    checklist: z.array(checklistItemSchema),
    personalDeadline: z.string().nullable(),
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .strict();

export const customOpportunityRecordSchema = z
  .object({
    id: z.string().min(1),
    slug: z.string().min(1),
    title: z.string(),
    opportunityType: z.string(),
    providerName: z.string().nullable(),
    countries: z.array(z.string()),
    regions: z.array(z.string()),
    studyLevels: z.array(z.string()),
    benefitSummary: z.string(),
    eligibilitySummary: z.string(),
    officialUrl: z.string().nullable(),
    deadlineKind: z.string(),
    deadlineRawText: z.string(),
    deadlineDate: z.string().nullable(),
    deadlineTimezone: z.string().nullable(),
    verificationNotes: z.string().nullable(),
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .strict();

export const preferencesRecordSchema = z
  .object({
    id: z.literal("singleton"),
    planning: z
      .object({
        expectedGraduationDate: z.string().nullable(),
        targetIntakeYear: z.number().nullable(),
        targetIntakeTerm: z.string().nullable(),
        preferredStudyLevels: z.array(z.string()),
        preferredCountries: z.array(z.string()),
      })
      .strict(),
    display: z
      .object({
        catalogueView: z.enum(["grid", "list"]),
      })
      .strict(),
    updatedAt: z.string(),
  })
  .strict();

export const eligibilityAnswersRecordSchema = z
  .object({
    id: z.literal("singleton"),
    answers: z.record(z.string(), z.unknown()),
    updatedAt: z.string(),
  })
  .strict();

export const savedSearchRecordSchema = z
  .object({
    id: z.string().min(1),
    name: z.string(),
    queryText: z.string(),
    filters: z.record(z.string(), z.unknown()),
    sortMode: z.string(),
    resultCountSnapshot: z.number().nullable(),
    resultSnapshot: z.array(z.string()),
    lastCheckedAt: z.string().nullable(),
    alertsEnabled: z.boolean(),
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .strict();

export const reminderPreferencesRecordSchema = z
  .object({
    id: z.literal("singleton"),
    remindersEnabled: z.boolean(),
    officialLeadDays: z.array(z.number()),
    personalLeadDays: z.array(z.number()),
    savedSearchAlertsEnabled: z.boolean(),
    updatedAt: z.string(),
  })
  .strict();

export const reminderRecordSchema = z
  .object({
    id: z.string().min(1),
    stableKey: z.string(),
    source: z.enum(["official-deadline", "personal-deadline", "checklist", "saved-search", "system"]),
    targetType: z.enum(["built-in", "custom"]).nullable(),
    targetId: z.string().nullable(),
    title: z.string(),
    dueAt: z.string(),
    leadDays: z.number(),
    status: z.enum(["pending", "dismissed", "completed"]),
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .strict();

export const notificationRecordSchema = z
  .object({
    id: z.string().min(1),
    type: z.enum(["reminder-upcoming", "reminder-overdue", "saved-search-alert", "system"]),
    source: z.enum(["official-deadline", "personal-deadline", "checklist", "saved-search", "system"]),
    title: z.string(),
    message: z.string(),
    targetType: z.enum(["built-in", "custom"]).nullable(),
    targetId: z.string().nullable(),
    savedSearchId: z.string().nullable(),
    dueAt: z.string().nullable(),
    status: z.enum(["unread", "read", "dismissed"]),
    readAt: z.string().nullable(),
    createdAt: z.string(),
  })
  .strict();

export const guestAiCitationRecordSchema = z
  .object({
    citationType: z.enum(["official-source", "structured-data", "workspace-context", "match-explanation"]),
    opportunityId: z.string().nullable(),
    officialSourceId: z.string().nullable(),
    sourceChunkId: z.string().nullable(),
    label: z.string(),
    url: z.string().nullable(),
    verificationStatus: z.string().nullable(),
    checkedAt: z.string().nullable(),
  })
  .strict();

export const guestAiConversationRecordSchema = z
  .object({
    id: z.string().min(1),
    scope: z.enum(["general", "opportunity", "comparison", "workspace", "matching"]),
    targetOpportunityId: z.string().nullable(),
    title: z.string(),
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .strict();

export const guestAiMessageRecordSchema = z
  .object({
    id: z.string().min(1),
    conversationId: z.string().min(1),
    role: z.enum(["user", "assistant"]),
    content: z.string(),
    blockedReason: z.string().nullable(),
    citations: z.array(guestAiCitationRecordSchema),
    createdAt: z.string(),
  })
  .strict();

export const backupPayloadSchema = z
  .object({
    app: z.literal(BACKUP_APP_ID),
    schemaVersion: z.number().int().positive(),
    createdAt: z.string(),
    counts: z
      .object({
        workspace: z.number().int().nonnegative(),
        customOpportunities: z.number().int().nonnegative(),
      })
      .strict(),
    data: z
      .object({
        workspace: z.array(workspaceRecordSchema),
        customOpportunities: z.array(customOpportunityRecordSchema),
        preferences: preferencesRecordSchema.nullable(),
        // Optional: absent in a backup exported before Checkpoint 4.
        eligibilityAnswers: eligibilityAnswersRecordSchema.nullable().optional(),
        savedSearches: z.array(savedSearchRecordSchema).optional(),
        reminderPreferences: reminderPreferencesRecordSchema.nullable().optional(),
        reminders: z.array(reminderRecordSchema).optional(),
        notifications: z.array(notificationRecordSchema).optional(),
        // Optional: only present when the user explicitly chose to include AI history in this export.
        aiConversations: z.array(guestAiConversationRecordSchema).optional(),
        aiMessages: z.array(guestAiMessageRecordSchema).optional(),
      })
      .strict(),
  })
  .strict();

export interface BackupValidationSuccess {
  valid: true;
  payload: BackupPayload;
  summary: {
    schemaVersion: number;
    createdAt: string;
    workspaceCount: number;
    customOpportunityCount: number;
    hasPreferences: boolean;
    savedSearchCount: number;
    reminderCount: number;
  };
}

export interface BackupValidationFailure {
  valid: false;
  errors: string[];
}

export function validateBackupPayload(json: unknown): BackupValidationSuccess | BackupValidationFailure {
  if (containsDangerousKeys(json)) {
    return { valid: false, errors: ["The file contains unsafe object keys and was rejected."] };
  }

  const result = backupPayloadSchema.safeParse(json);
  if (!result.success) {
    return {
      valid: false,
      errors: result.error.issues.map((issue) => `${issue.path.join(".") || "<root>"}: ${issue.message}`),
    };
  }

  const payload = result.data as BackupPayload;
  return {
    valid: true,
    payload,
    summary: {
      schemaVersion: payload.schemaVersion,
      createdAt: payload.createdAt,
      workspaceCount: payload.data.workspace.length,
      customOpportunityCount: payload.data.customOpportunities.length,
      hasPreferences: payload.data.preferences !== null,
      savedSearchCount: payload.data.savedSearches?.length ?? 0,
      reminderCount: payload.data.reminders?.length ?? 0,
    },
  };
}

export interface BuildBackupPayloadOptions {
  /** Off by default — AI conversation history is only ever included in an export when the user explicitly opts in (Checkpoint 5 privacy control). */
  includeAiHistory?: boolean;
}

export async function buildBackupPayload(options: BuildBackupPayloadOptions = {}): Promise<BackupPayload> {
  const [workspace, customOpportunities, preferences, eligibilityAnswers, savedSearches, reminderPreferences, reminders, notifications] =
    await Promise.all([
      getAllWorkspaceRecords(),
      getAllCustomOpportunities(),
      getPreferences(),
      getGuestEligibilityAnswers(),
      getAllGuestSavedSearches(),
      getGuestReminderPreferences(),
      getAllGuestReminders(),
      getAllGuestNotifications(),
    ]);

  let aiConversations: GuestAiConversationRecord[] | undefined;
  let aiMessages: GuestAiMessageRecord[] | undefined;
  if (options.includeAiHistory) {
    aiConversations = await getAllGuestAiConversations();
    aiMessages = (await Promise.all(aiConversations.map((c) => getGuestAiMessages(c.id)))).flat();
  }

  return {
    app: BACKUP_APP_ID,
    schemaVersion: SCHEMA_VERSION,
    createdAt: new Date().toISOString(),
    counts: { workspace: workspace.length, customOpportunities: customOpportunities.length },
    data: {
      workspace,
      customOpportunities,
      preferences,
      eligibilityAnswers,
      savedSearches,
      reminderPreferences,
      reminders,
      notifications,
      aiConversations,
      aiMessages,
    },
  };
}

export type ImportMode = "merge" | "replace";

const CHECKPOINT4_STORES = ["savedSearches", "reminders", "notifications", "eligibilityAnswers", "reminderPreferences"] as const;
const CHECKPOINT5_STORES = ["aiConversations", "aiMessages"] as const;

export async function importBackupPayload(
  payload: BackupPayload,
  mode: ImportMode,
): Promise<{ workspaceImported: number; customOpportunitiesImported: number }> {
  const db = await getDb();
  const allStores = ["workspace", "customOpportunities", "preferences", ...CHECKPOINT4_STORES, ...CHECKPOINT5_STORES] as const;

  if (mode === "replace") {
    await Promise.all(allStores.map((store) => db.clear(store)));
  }

  const tx = db.transaction(allStores, "readwrite");
  await Promise.all([
    ...payload.data.workspace.map((record) => tx.objectStore("workspace").put(record)),
    ...payload.data.customOpportunities.map((record) => tx.objectStore("customOpportunities").put(record)),
    payload.data.preferences ? tx.objectStore("preferences").put(payload.data.preferences) : Promise.resolve(),
    payload.data.eligibilityAnswers ? tx.objectStore("eligibilityAnswers").put(payload.data.eligibilityAnswers) : Promise.resolve(),
    payload.data.reminderPreferences ? tx.objectStore("reminderPreferences").put(payload.data.reminderPreferences) : Promise.resolve(),
    ...(payload.data.savedSearches ?? []).map((record) => tx.objectStore("savedSearches").put(record)),
    ...(payload.data.reminders ?? []).map((record) => tx.objectStore("reminders").put(record)),
    ...(payload.data.notifications ?? []).map((record) => tx.objectStore("notifications").put(record)),
    ...(payload.data.aiConversations ?? []).map((record) => tx.objectStore("aiConversations").put(record)),
    ...(payload.data.aiMessages ?? []).map((record) => tx.objectStore("aiMessages").put(record)),
  ]);
  await tx.done;

  for (const store of allStores) {
    emitStorageChange(store);
  }

  return {
    workspaceImported: payload.data.workspace.length,
    customOpportunitiesImported: payload.data.customOpportunities.length,
  };
}

export async function clearAllGuestData(): Promise<void> {
  const db = await getDb();
  const allStores = ["workspace", "customOpportunities", "preferences", ...CHECKPOINT4_STORES, ...CHECKPOINT5_STORES] as const;
  await Promise.all(allStores.map((store) => db.clear(store)));
  for (const store of allStores) {
    emitStorageChange(store);
  }
}

export async function recordBackupCreated(): Promise<void> {
  const db = await getDb();
  await db.put("meta", { key: "backupMeta", lastBackupAt: new Date().toISOString() });
  emitStorageChange("backup");
}

export async function getLastBackupAt(): Promise<string | null> {
  const db = await getDb();
  const meta = await db.get("meta", "backupMeta");
  return meta?.lastBackupAt ?? null;
}

function csvEscape(value: string): string {
  const needsQuoting = /[",\n]/.test(value);
  const escaped = value.replace(/"/g, '""');
  return needsQuoting ? `"${escaped}"` : escaped;
}

export interface TrackedApplicationCsvRow {
  title: string;
  kind: "built-in" | "custom";
  stage: string;
  shortlisted: boolean;
  personalDeadline: string | null;
  checklistDone: number;
  checklistTotal: number;
  updatedAt: string;
}

export function buildTrackedApplicationsCsv(rows: readonly TrackedApplicationCsvRow[]): string {
  const header = [
    "Title",
    "Type",
    "Application stage",
    "Shortlisted",
    "Personal deadline",
    "Checklist progress",
    "Last updated",
  ];
  const lines = [header.join(",")];

  for (const row of rows) {
    lines.push(
      [
        csvEscape(row.title),
        row.kind === "built-in" ? "Built-in" : "Custom",
        csvEscape(row.stage),
        row.shortlisted ? "Yes" : "No",
        row.personalDeadline ?? "",
        `${row.checklistDone}/${row.checklistTotal}`,
        row.updatedAt,
      ].join(","),
    );
  }

  return lines.join("\r\n");
}
