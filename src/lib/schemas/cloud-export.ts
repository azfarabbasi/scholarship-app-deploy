import { z } from "zod";
import { applicationStageValueSchema, workspaceTargetTypeSchema } from "./student-workspace";

/**
 * The cloud account export/import format (Checkpoint 3) — deliberately
 * distinct from the guest backup format in `src/lib/storage/backup.ts`,
 * since it carries cloud-only fields (server-generated ids, sync
 * metadata) instead of the guest IndexedDB row shape. Every object schema
 * is `.strict()` so an unrecognised or prototype-polluting key is rejected
 * rather than silently ignored or assigned.
 */
export const CLOUD_EXPORT_APP_ID = "scholartrack-account";
export const CLOUD_EXPORT_SCHEMA_VERSION = 2;
export const MAX_CLOUD_IMPORT_FILE_SIZE_BYTES = 5 * 1024 * 1024;

const isoDateTime = z.string().refine((value) => !Number.isNaN(Date.parse(value)), { message: "Invalid timestamp" });

const profileExportSchema = z
  .object({
    displayName: z.string().nullable(),
    countryOrRegion: z.string().nullable(),
    currentStudyLevel: z.string().nullable(),
    intendedStudyLevel: z.string().nullable(),
    graduationYear: z.number().int().nullable(),
    targetIntakeYear: z.number().int().nullable(),
    targetIntakeTerm: z.string().nullable(),
    preferredCountries: z.array(z.string()),
    preferredStudyLevels: z.array(z.string()),
    onboardingCompletedAt: isoDateTime.nullable(),
  })
  .strict();

const trackingExportSchema = z
  .object({
    id: z.uuid(),
    opportunityId: z.uuid(),
    shortlisted: z.boolean(),
    stage: applicationStageValueSchema,
    personalDeadline: isoDateTime.nullable(),
    priority: z.number().int().nullable(),
    archived: z.boolean(),
    lastViewedAt: isoDateTime.nullable(),
    createdAt: isoDateTime,
    updatedAt: isoDateTime,
  })
  .strict();

const noteExportSchema = z
  .object({
    id: z.uuid(),
    targetType: workspaceTargetTypeSchema,
    targetId: z.uuid(),
    noteText: z.string(),
    createdAt: isoDateTime,
    updatedAt: isoDateTime,
  })
  .strict();

const checklistTaskExportSchema = z
  .object({
    id: z.uuid(),
    targetType: workspaceTargetTypeSchema,
    targetId: z.uuid(),
    taskText: z.string(),
    completed: z.boolean(),
    sortOrder: z.number().int(),
    sourceType: z.enum(["generic", "user-created", "imported"]),
    createdAt: isoDateTime,
    updatedAt: isoDateTime,
  })
  .strict();

const customOpportunityExportSchema = z
  .object({
    id: z.uuid(),
    slug: z.string(),
    title: z.string(),
    opportunityType: z.string(),
    providerName: z.string().nullable(),
    countries: z.array(z.string()),
    regions: z.array(z.string()),
    studyLevels: z.array(z.string()),
    benefitSummary: z.string(),
    eligibilitySummary: z.string(),
    officialUrl: z.string().nullable(),
    deadlineKind: z.enum(["exact", "estimated", "rolling", "unknown"]),
    deadlineRawText: z.string(),
    deadlineDate: z.string().nullable(),
    deadlineTimezone: z.string().nullable(),
    verificationNotes: z.string().nullable(),
    archivedAt: isoDateTime.nullable(),
    createdAt: isoDateTime,
    updatedAt: isoDateTime,
  })
  .strict();

const planningPreferencesExportSchema = z
  .object({
    expectedGraduationDate: z.string().nullable(),
    targetIntakeYear: z.number().int().nullable(),
    targetIntakeTerm: z.string().nullable(),
    preferredStudyLevels: z.array(z.string()),
    preferredCountries: z.array(z.string()),
  })
  .strict()
  .nullable();

const displayPreferencesExportSchema = z
  .object({
    theme: z.enum(["system", "light", "dark"]).nullable(),
    catalogueView: z.enum(["grid", "list"]),
  })
  .strict()
  .nullable();

const syncMetadataExportSchema = z
  .object({
    lastSuccessfulSyncAt: isoDateTime.nullable(),
    schemaVersion: z.number().int(),
  })
  .strict()
  .nullable();

const eligibilityAnswersExportSchema = z
  .object({
    countryOfResidence: z.string().nullable(),
    nationality: z.string().nullable(),
    currentStudyLevel: z.string().nullable(),
    intendedStudyLevel: z.string().nullable(),
    fieldsOfInterest: z.array(z.string()),
    graduationYear: z.number().int().nullable(),
    targetIntakeYear: z.number().int().nullable(),
    targetIntakeTerm: z.string().nullable(),
    preferredCountries: z.array(z.string()),
    preferredRegions: z.array(z.string()),
    languageTestStatus: z.string().nullable(),
    researchExperience: z.string().nullable(),
    workExperienceYears: z.number().int().nullable(),
    finalYearStatus: z.string().nullable(),
    fundingPreference: z.string().nullable(),
    studyMode: z.string().nullable(),
  })
  .strict()
  .nullable();

const savedSearchExportSchema = z
  .object({
    id: z.uuid(),
    name: z.string(),
    queryText: z.string(),
    filters: z.record(z.string(), z.unknown()),
    sortMode: z.string(),
    resultCountSnapshot: z.number().int().nullable(),
    resultSnapshot: z.array(z.string()),
    lastCheckedAt: isoDateTime.nullable(),
    alertsEnabled: z.boolean(),
    createdAt: isoDateTime,
    updatedAt: isoDateTime,
  })
  .strict();

const reminderPreferencesExportSchema = z
  .object({
    remindersEnabled: z.boolean(),
    officialLeadDays: z.array(z.number().int()),
    personalLeadDays: z.array(z.number().int()),
    savedSearchAlertsEnabled: z.boolean(),
  })
  .strict()
  .nullable();

const reminderExportSchema = z
  .object({
    id: z.uuid(),
    stableKey: z.string(),
    source: z.enum(["official-deadline", "personal-deadline", "checklist", "saved-search", "system"]),
    targetType: z.enum(["built-in", "custom"]).nullable(),
    targetId: z.string().nullable(),
    title: z.string(),
    dueAt: isoDateTime,
    leadDays: z.number().int(),
    status: z.enum(["pending", "dismissed", "completed"]),
    createdAt: isoDateTime,
    updatedAt: isoDateTime,
  })
  .strict();

const notificationExportSchema = z
  .object({
    id: z.uuid(),
    type: z.enum(["reminder-upcoming", "reminder-overdue", "saved-search-alert", "system"]),
    source: z.enum(["official-deadline", "personal-deadline", "checklist", "saved-search", "system"]),
    title: z.string(),
    message: z.string(),
    targetType: z.enum(["built-in", "custom"]).nullable(),
    targetId: z.string().nullable(),
    savedSearchId: z.string().nullable(),
    dueAt: isoDateTime.nullable(),
    status: z.enum(["unread", "read", "dismissed"]),
    readAt: isoDateTime.nullable(),
    createdAt: isoDateTime,
  })
  .strict();

const aiCitationExportSchema = z
  .object({
    citationType: z.enum(["official-source", "structured-data", "workspace-context", "match-explanation"]),
    opportunityId: z.string().nullable(),
    officialSourceId: z.string().nullable(),
    sourceChunkId: z.string().nullable(),
    label: z.string(),
    url: z.string().nullable(),
    verificationStatus: z.string().nullable(),
    checkedAt: isoDateTime.nullable(),
  })
  .strict();

const aiConversationExportSchema = z
  .object({
    id: z.uuid(),
    scope: z.enum(["general", "opportunity", "comparison", "workspace", "matching"]),
    targetOpportunityId: z.string().nullable(),
    title: z.string(),
    createdAt: isoDateTime,
    updatedAt: isoDateTime,
  })
  .strict();

const aiMessageExportSchema = z
  .object({
    id: z.uuid(),
    conversationId: z.uuid(),
    role: z.enum(["user", "assistant"]),
    content: z.string(),
    blockedReason: z.string().nullable(),
    citations: z.array(aiCitationExportSchema),
    createdAt: isoDateTime,
  })
  .strict();

export const cloudExportPayloadSchema = z
  .object({
    app: z.literal(CLOUD_EXPORT_APP_ID),
    schemaVersion: z.number().int().positive(),
    exportedAt: isoDateTime,
    profile: profileExportSchema,
    tracking: z.array(trackingExportSchema),
    notes: z.array(noteExportSchema),
    checklistTasks: z.array(checklistTaskExportSchema),
    customOpportunities: z.array(customOpportunityExportSchema),
    planningPreferences: planningPreferencesExportSchema,
    displayPreferences: displayPreferencesExportSchema,
    syncMetadata: syncMetadataExportSchema,
    // Optional: absent in an export produced before Checkpoint 4.
    eligibilityAnswers: eligibilityAnswersExportSchema.optional(),
    savedSearches: z.array(savedSearchExportSchema).optional(),
    reminderPreferences: reminderPreferencesExportSchema.optional(),
    reminders: z.array(reminderExportSchema).optional(),
    notifications: z.array(notificationExportSchema).optional(),
    // Optional: only present when the student has AI history enabled (Checkpoint 5) — never included otherwise.
    aiConversations: z.array(aiConversationExportSchema).optional(),
    aiMessages: z.array(aiMessageExportSchema).optional(),
  })
  .strict();

export type CloudExportPayload = z.infer<typeof cloudExportPayloadSchema>;

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

export interface CloudImportValidationSuccess {
  valid: true;
  payload: CloudExportPayload;
  summary: {
    trackingCount: number;
    notesCount: number;
    checklistTaskCount: number;
    customOpportunityCount: number;
    savedSearchCount: number;
    reminderCount: number;
    exportedAt: string;
  };
}

export interface CloudImportValidationFailure {
  valid: false;
  errors: string[];
}

export function validateCloudExportPayload(json: unknown): CloudImportValidationSuccess | CloudImportValidationFailure {
  if (containsDangerousKeys(json)) {
    return { valid: false, errors: ["The file contains unsafe object keys and was rejected."] };
  }

  const result = cloudExportPayloadSchema.safeParse(json);
  if (!result.success) {
    return {
      valid: false,
      errors: result.error.issues.map((issue) => `${issue.path.join(".") || "<root>"}: ${issue.message}`),
    };
  }

  const payload = result.data;
  return {
    valid: true,
    payload,
    summary: {
      trackingCount: payload.tracking.length,
      notesCount: payload.notes.length,
      checklistTaskCount: payload.checklistTasks.length,
      customOpportunityCount: payload.customOpportunities.length,
      savedSearchCount: payload.savedSearches?.length ?? 0,
      reminderCount: payload.reminders?.length ?? 0,
      exportedAt: payload.exportedAt,
    },
  };
}
