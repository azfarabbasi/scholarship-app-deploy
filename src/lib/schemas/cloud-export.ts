import { z } from "zod";
import { isHttpUrl } from "@/lib/security/url";
import { applicationStageValueSchema, workspaceTargetTypeSchema } from "./student-workspace";

/**
 * The cloud account export/import format (Checkpoint 3) — deliberately
 * distinct from the guest backup format in `src/lib/storage/backup.ts`,
 * since it carries cloud-only fields (server-generated ids, sync
 * metadata) instead of the guest IndexedDB row shape. Every object schema
 * is `.strict()` so an unrecognised or prototype-polluting key is rejected
 * rather than silently ignored or assigned.
 *
 * Every array/string field below is explicitly bounded (row count, item
 * length) — a raw `z.array(...)`/`z.string()` with no cap accepts an
 * arbitrarily large payload up to `MAX_CLOUD_IMPORT_FILE_SIZE_BYTES` on its
 * own; the real DoS risk is one field looping millions of times inside a
 * single import transaction, or one absurdly long string, well within that
 * byte budget. The caps here are generous for any real account (thousands of
 * tracked opportunities/notes would be an extreme outlier) but bounded.
 */
export const CLOUD_EXPORT_APP_ID = "scholartrack-account";
export const CLOUD_EXPORT_SCHEMA_VERSION = 2;
export const MAX_CLOUD_IMPORT_FILE_SIZE_BYTES = 5 * 1024 * 1024;

/** Oldest schema version this importer still understands. Bump only alongside an explicit, tested migration path. */
const MIN_SUPPORTED_SCHEMA_VERSION = 1;

const MAX_ROWS = 5_000;
const MAX_SMALL_ARRAY = 200;
const MAX_SHORT_TEXT = 300;
const MAX_TEXT = 20_000;
const MAX_URL_LENGTH = 2048;

const isoDateTime = z.string().max(MAX_SHORT_TEXT).refine((value) => !Number.isNaN(Date.parse(value)), { message: "Invalid timestamp" });
const shortText = z.string().max(MAX_SHORT_TEXT);
const longText = z.string().max(MAX_TEXT);
const stringArray = z.array(shortText).max(MAX_SMALL_ARRAY);

/** Only ever `http:`/`https:` — never `javascript:`, `data:`, `file:`, or any other scheme that could be dangerous if later rendered as a link. */
const httpUrlSchema = z
  .string()
  .max(MAX_URL_LENGTH)
  .refine(isHttpUrl, { message: "Must be an http:// or https:// URL" });
const nullableHttpUrl = httpUrlSchema.nullable();

const profileExportSchema = z
  .object({
    displayName: shortText.nullable(),
    countryOrRegion: shortText.nullable(),
    currentStudyLevel: shortText.nullable(),
    intendedStudyLevel: shortText.nullable(),
    graduationYear: z.number().int().nullable(),
    targetIntakeYear: z.number().int().nullable(),
    targetIntakeTerm: shortText.nullable(),
    preferredCountries: stringArray,
    preferredStudyLevels: stringArray,
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
    noteText: longText,
    createdAt: isoDateTime,
    updatedAt: isoDateTime,
  })
  .strict();

const checklistTaskExportSchema = z
  .object({
    id: z.uuid(),
    targetType: workspaceTargetTypeSchema,
    targetId: z.uuid(),
    taskText: longText,
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
    slug: shortText,
    title: shortText,
    opportunityType: shortText,
    providerName: shortText.nullable(),
    countries: stringArray,
    regions: stringArray,
    studyLevels: stringArray,
    benefitSummary: longText,
    eligibilitySummary: longText,
    officialUrl: nullableHttpUrl,
    deadlineKind: z.enum(["exact", "estimated", "rolling", "unknown"]),
    deadlineRawText: longText,
    deadlineDate: shortText.nullable(),
    deadlineTimezone: shortText.nullable(),
    verificationNotes: longText.nullable(),
    archivedAt: isoDateTime.nullable(),
    createdAt: isoDateTime,
    updatedAt: isoDateTime,
  })
  .strict();

const planningPreferencesExportSchema = z
  .object({
    expectedGraduationDate: shortText.nullable(),
    targetIntakeYear: z.number().int().nullable(),
    targetIntakeTerm: shortText.nullable(),
    preferredStudyLevels: stringArray,
    preferredCountries: stringArray,
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
    countryOfResidence: shortText.nullable(),
    nationality: shortText.nullable(),
    currentStudyLevel: shortText.nullable(),
    intendedStudyLevel: shortText.nullable(),
    fieldsOfInterest: stringArray,
    graduationYear: z.number().int().nullable(),
    targetIntakeYear: z.number().int().nullable(),
    targetIntakeTerm: shortText.nullable(),
    preferredCountries: stringArray,
    preferredRegions: stringArray,
    languageTestStatus: shortText.nullable(),
    researchExperience: shortText.nullable(),
    workExperienceYears: z.number().int().nullable(),
    finalYearStatus: shortText.nullable(),
    fundingPreference: shortText.nullable(),
    studyMode: shortText.nullable(),
  })
  .strict()
  .nullable();

const savedSearchExportSchema = z
  .object({
    id: z.uuid(),
    name: shortText,
    queryText: longText,
    filters: z.record(z.string().max(MAX_SHORT_TEXT), z.unknown()),
    sortMode: shortText,
    resultCountSnapshot: z.number().int().nullable(),
    resultSnapshot: z.array(z.uuid()).max(MAX_ROWS),
    lastCheckedAt: isoDateTime.nullable(),
    alertsEnabled: z.boolean(),
    createdAt: isoDateTime,
    updatedAt: isoDateTime,
  })
  .strict();

const reminderPreferencesExportSchema = z
  .object({
    remindersEnabled: z.boolean(),
    officialLeadDays: z.array(z.number().int()).max(MAX_SMALL_ARRAY),
    personalLeadDays: z.array(z.number().int()).max(MAX_SMALL_ARRAY),
    savedSearchAlertsEnabled: z.boolean(),
  })
  .strict()
  .nullable();

const reminderExportSchema = z
  .object({
    id: z.uuid(),
    stableKey: shortText,
    source: z.enum(["official-deadline", "personal-deadline", "checklist", "saved-search", "system"]),
    targetType: z.enum(["built-in", "custom"]).nullable(),
    targetId: z.uuid().nullable(),
    title: shortText,
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
    title: shortText,
    message: longText,
    targetType: z.enum(["built-in", "custom"]).nullable(),
    targetId: z.uuid().nullable(),
    savedSearchId: z.uuid().nullable(),
    dueAt: isoDateTime.nullable(),
    status: z.enum(["unread", "read", "dismissed"]),
    readAt: isoDateTime.nullable(),
    createdAt: isoDateTime,
  })
  .strict();

const aiCitationExportSchema = z
  .object({
    citationType: z.enum(["official-source", "structured-data", "workspace-context", "match-explanation"]),
    opportunityId: z.uuid().nullable(),
    officialSourceId: z.uuid().nullable(),
    sourceChunkId: z.uuid().nullable(),
    label: shortText,
    url: nullableHttpUrl,
    verificationStatus: shortText.nullable(),
    checkedAt: isoDateTime.nullable(),
  })
  .strict();

const aiConversationExportSchema = z
  .object({
    id: z.uuid(),
    scope: z.enum(["general", "opportunity", "comparison", "workspace", "matching"]),
    targetOpportunityId: z.uuid().nullable(),
    title: shortText,
    createdAt: isoDateTime,
    updatedAt: isoDateTime,
  })
  .strict();

const aiMessageExportSchema = z
  .object({
    id: z.uuid(),
    conversationId: z.uuid(),
    role: z.enum(["user", "assistant"]),
    content: longText,
    blockedReason: shortText.nullable(),
    citations: z.array(aiCitationExportSchema).max(MAX_SMALL_ARRAY),
    createdAt: isoDateTime,
  })
  .strict();

export const cloudExportPayloadSchema = z
  .object({
    app: z.literal(CLOUD_EXPORT_APP_ID),
    schemaVersion: z.number().int().positive(),
    exportedAt: isoDateTime,
    profile: profileExportSchema,
    tracking: z.array(trackingExportSchema).max(MAX_ROWS),
    notes: z.array(noteExportSchema).max(MAX_ROWS),
    checklistTasks: z.array(checklistTaskExportSchema).max(MAX_ROWS),
    customOpportunities: z.array(customOpportunityExportSchema).max(MAX_ROWS),
    planningPreferences: planningPreferencesExportSchema,
    displayPreferences: displayPreferencesExportSchema,
    syncMetadata: syncMetadataExportSchema,
    // Optional: absent in an export produced before Checkpoint 4.
    eligibilityAnswers: eligibilityAnswersExportSchema.optional(),
    savedSearches: z.array(savedSearchExportSchema).max(MAX_ROWS).optional(),
    reminderPreferences: reminderPreferencesExportSchema.optional(),
    reminders: z.array(reminderExportSchema).max(MAX_ROWS).optional(),
    notifications: z.array(notificationExportSchema).max(MAX_ROWS).optional(),
    // Optional: only present when the student has AI history enabled (Checkpoint 5) — never included otherwise.
    aiConversations: z.array(aiConversationExportSchema).max(MAX_ROWS).optional(),
    aiMessages: z.array(aiMessageExportSchema).max(MAX_ROWS).optional(),
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

  // A schema version newer than this build understands means the file was
  // exported by a future version of ScholarTrack whose export shape this
  // code has never seen validated against — accepting it on the strength of
  // "the fields happened to parse" would be a false sense of safety, not
  // real compatibility. An older, still-supported version is fine: the
  // schema above already reflects every field a supported older export can
  // legally omit (see the `.optional()` markers).
  if (payload.schemaVersion > CLOUD_EXPORT_SCHEMA_VERSION) {
    return {
      valid: false,
      errors: [
        `This file was exported by a newer version of ScholarTrack (schema v${payload.schemaVersion}) than this app supports (v${CLOUD_EXPORT_SCHEMA_VERSION}). Update the app before importing it.`,
      ],
    };
  }
  if (payload.schemaVersion < MIN_SUPPORTED_SCHEMA_VERSION) {
    return {
      valid: false,
      errors: [`This file's schema version (v${payload.schemaVersion}) is too old to import.`],
    };
  }

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
