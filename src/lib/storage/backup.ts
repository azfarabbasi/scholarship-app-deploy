import { z } from "zod";
import { getAllCustomOpportunities } from "./custom-opportunities";
import { getDb } from "./db";
import { emitStorageChange } from "./events";
import { getPreferences } from "./preferences";
import { SCHEMA_VERSION } from "./types";
import type {
  CustomOpportunityRecord,
  PreferencesRecord,
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
    },
  };
}

export async function buildBackupPayload(): Promise<BackupPayload> {
  const [workspace, customOpportunities, preferences] = await Promise.all([
    getAllWorkspaceRecords(),
    getAllCustomOpportunities(),
    getPreferences(),
  ]);

  return {
    app: BACKUP_APP_ID,
    schemaVersion: SCHEMA_VERSION,
    createdAt: new Date().toISOString(),
    counts: { workspace: workspace.length, customOpportunities: customOpportunities.length },
    data: { workspace, customOpportunities, preferences },
  };
}

export type ImportMode = "merge" | "replace";

export async function importBackupPayload(
  payload: BackupPayload,
  mode: ImportMode,
): Promise<{ workspaceImported: number; customOpportunitiesImported: number }> {
  const db = await getDb();

  if (mode === "replace") {
    await Promise.all([
      db.clear("workspace"),
      db.clear("customOpportunities"),
      db.clear("preferences"),
    ]);
  }

  const tx = db.transaction(["workspace", "customOpportunities", "preferences"], "readwrite");
  await Promise.all([
    ...payload.data.workspace.map((record) => tx.objectStore("workspace").put(record)),
    ...payload.data.customOpportunities.map((record) => tx.objectStore("customOpportunities").put(record)),
    payload.data.preferences
      ? tx.objectStore("preferences").put(payload.data.preferences)
      : Promise.resolve(),
  ]);
  await tx.done;

  emitStorageChange("workspace");
  emitStorageChange("customOpportunities");
  emitStorageChange("preferences");

  return {
    workspaceImported: payload.data.workspace.length,
    customOpportunitiesImported: payload.data.customOpportunities.length,
  };
}

export async function clearAllGuestData(): Promise<void> {
  const db = await getDb();
  await Promise.all([
    db.clear("workspace"),
    db.clear("customOpportunities"),
    db.clear("preferences"),
  ]);
  emitStorageChange("workspace");
  emitStorageChange("customOpportunities");
  emitStorageChange("preferences");
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
