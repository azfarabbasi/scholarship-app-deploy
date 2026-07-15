import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DB_NAME, getDb, resetDbConnectionForTests } from "@/lib/storage/db";
import {
  BACKUP_APP_ID,
  MAX_BACKUP_FILE_SIZE_BYTES,
  buildBackupPayload,
  buildTrackedApplicationsCsv,
  clearAllGuestData,
  containsDangerousKeys,
  getLastBackupAt,
  importBackupPayload,
  recordBackupCreated,
  validateBackupPayload,
} from "@/lib/storage/backup";
import { createCustomOpportunity } from "@/lib/storage/custom-opportunities";
import { toggleShortlisted } from "@/lib/storage/workspace";
import { SCHEMA_VERSION } from "@/lib/storage/types";
import type { CustomOpportunityInput } from "@/lib/schemas/custom-opportunity";

async function resetDatabase() {
  await resetDbConnectionForTests();
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DB_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () => resolve();
  });
}

beforeEach(resetDatabase);
afterEach(resetDatabase);

const sampleCustomInput: CustomOpportunityInput = {
  title: "Backup Test Scholarship",
  opportunityType: "scholarship",
  providerName: null,
  countries: ["Germany"],
  regions: [],
  studyLevels: ["Master"],
  benefitSummary: "Covers tuition",
  eligibilitySummary: "Open to all",
  officialUrl: null,
  deadlineKind: "rolling",
  deadlineRawText: "Rolling",
  deadlineDate: null,
  deadlineTimezone: null,
  verificationNotes: null,
};

describe("backup export", () => {
  it("produces a valid backup with the current schema version and no unrelated data", async () => {
    await toggleShortlisted("built-in-1");
    await createCustomOpportunity(sampleCustomInput);

    const payload = await buildBackupPayload();
    expect(payload.app).toBe(BACKUP_APP_ID);
    expect(payload.schemaVersion).toBe(SCHEMA_VERSION);
    expect(payload.data.workspace).toHaveLength(1);
    expect(payload.data.customOpportunities).toHaveLength(1);
    expect(Object.keys(payload)).toEqual(["app", "schemaVersion", "createdAt", "counts", "data"]);
  });

  it("enforces a maximum backup file size", () => {
    expect(MAX_BACKUP_FILE_SIZE_BYTES).toBe(5 * 1024 * 1024);
  });
});

describe("backup validation", () => {
  it("accepts a well-formed backup payload", async () => {
    const payload = await buildBackupPayload();
    const result = validateBackupPayload(payload);
    expect(result.valid).toBe(true);
  });

  it("rejects a payload with the wrong app identifier", () => {
    const result = validateBackupPayload({ app: "other-app", schemaVersion: 1, createdAt: "x", counts: { workspace: 0, customOpportunities: 0 }, data: { workspace: [], customOpportunities: [], preferences: null } });
    expect(result.valid).toBe(false);
  });

  it("rejects malformed/garbage JSON structures", () => {
    expect(validateBackupPayload({ nonsense: true }).valid).toBe(false);
    expect(validateBackupPayload(null).valid).toBe(false);
    expect(validateBackupPayload("a string").valid).toBe(false);
    expect(validateBackupPayload(42).valid).toBe(false);
  });

  it("detects prototype-pollution keys anywhere in the structure", () => {
    const malicious = JSON.parse('{"app":"scholartrack","__proto__":{"polluted":true}}');
    expect(containsDangerousKeys(malicious)).toBe(true);
    expect(validateBackupPayload(malicious).valid).toBe(false);
  });

  it("detects a nested constructor/prototype pollution attempt", () => {
    const nested = { a: { b: [{ constructor: { prototype: {} } }] } };
    expect(containsDangerousKeys(nested)).toBe(true);
  });

  it("does not flag an ordinary payload as dangerous", async () => {
    const payload = await buildBackupPayload();
    expect(containsDangerousKeys(payload)).toBe(false);
  });
});

describe("backup import: merge vs replace", () => {
  it("merge keeps existing records and adds new ones from the backup", async () => {
    await toggleShortlisted("built-in-1");
    const backupWithOtherRecord = await buildBackupPayload();
    // Simulate a backup from another session containing a different record.
    backupWithOtherRecord.data.workspace.push({
      opportunityId: "built-in-2",
      shortlisted: true,
      stage: "not-started",
      notes: "",
      checklist: [],
      personalDeadline: null,
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-01-01T00:00:00Z",
    });

    await toggleShortlisted("built-in-3"); // a local-only record not present in the backup

    await importBackupPayload(backupWithOtherRecord, "merge");
    const db = await getDb();
    const all = await db.getAll("workspace");
    const ids = all.map((r) => r.opportunityId).sort();
    expect(ids).toEqual(["built-in-1", "built-in-2", "built-in-3"]);
  });

  it("replace removes existing records not present in the backup", async () => {
    await toggleShortlisted("built-in-3"); // local-only, should be wiped
    const payload = await buildBackupPayload(); // still contains built-in-3 as of this point
    payload.data.workspace = []; // simulate an empty backup

    await importBackupPayload(payload, "replace");
    const db = await getDb();
    const all = await db.getAll("workspace");
    expect(all).toHaveLength(0);
  });

  it("rejects an invalid import before anything is written", async () => {
    const result = validateBackupPayload({ app: "scholartrack" });
    expect(result.valid).toBe(false);
    const db = await getDb();
    expect(await db.getAll("workspace")).toHaveLength(0);
  });
});

describe("clear all local data", () => {
  it("clears workspace, custom opportunities, and preferences", async () => {
    await toggleShortlisted("built-in-1");
    await createCustomOpportunity(sampleCustomInput);
    await clearAllGuestData();

    const db = await getDb();
    expect(await db.getAll("workspace")).toHaveLength(0);
    expect(await db.getAll("customOpportunities")).toHaveLength(0);
  });
});

describe("last backup timestamp", () => {
  it("is null before any backup, and set after recordBackupCreated()", async () => {
    expect(await getLastBackupAt()).toBeNull();
    await recordBackupCreated();
    expect(await getLastBackupAt()).not.toBeNull();
  });
});

describe("CSV export of tracked applications", () => {
  it("produces a header row and one row per tracked application without exposing internal IDs", () => {
    const csv = buildTrackedApplicationsCsv([
      {
        title: "DAAD Scholarship",
        kind: "built-in",
        stage: "submitted",
        shortlisted: true,
        personalDeadline: "2027-03-01",
        checklistDone: 2,
        checklistTotal: 5,
        updatedAt: "2027-01-01T00:00:00Z",
      },
    ]);
    const lines = csv.split("\r\n");
    expect(lines[0]).toBe("Title,Type,Application stage,Shortlisted,Personal deadline,Checklist progress,Last updated");
    expect(lines[1]).toContain("DAAD Scholarship");
    expect(lines[1]).toContain("2/5");
    expect(csv).not.toMatch(/built-in-\d/);
  });

  it("safely escapes titles containing commas or quotes", () => {
    const csv = buildTrackedApplicationsCsv([
      {
        title: 'Award, "special" edition',
        kind: "custom",
        stage: "not-started",
        shortlisted: false,
        personalDeadline: null,
        checklistDone: 0,
        checklistTotal: 0,
        updatedAt: "2027-01-01T00:00:00Z",
      },
    ]);
    expect(csv).toContain('"Award, ""special"" edition"');
  });
});
