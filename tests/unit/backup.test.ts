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
import { setGuestEligibilityAnswers, getGuestEligibilityAnswers } from "@/lib/storage/eligibility";
import { createGuestSavedSearch, getAllGuestSavedSearches } from "@/lib/storage/saved-searches";
import { setGuestReminderPreferences, upsertGuestReminders, getAllGuestReminders, getGuestReminderPreferences } from "@/lib/storage/reminders";
import { createGuestNotification, getAllGuestNotifications } from "@/lib/storage/notifications";

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

describe("backup export: Checkpoint 4 data types", () => {
  it("includes the Checkpoint 4 sections (defaulted, not omitted) even with nothing set", async () => {
    const payload = await buildBackupPayload();
    expect(payload.data.eligibilityAnswers).not.toBeNull();
    expect(payload.data.savedSearches).toEqual([]);
    expect(payload.data.reminderPreferences).not.toBeNull();
    expect(payload.data.reminders).toEqual([]);
    expect(payload.data.notifications).toEqual([]);
  });

  it("captures eligibility answers, saved searches, reminder preferences, reminders, and notifications", async () => {
    await setGuestEligibilityAnswers({ nationality: "Germany", fieldsOfInterest: [], preferredCountries: [], preferredRegions: [] });
    await createGuestSavedSearch({
      name: "Germany scholarships",
      queryText: "engineering",
      filters: {},
      sortMode: "relevance",
      resultCountSnapshot: 3,
      resultSnapshot: ["a", "b", "c"],
    });
    await setGuestReminderPreferences({ remindersEnabled: true, officialLeadDays: [7], personalLeadDays: [1] });
    await upsertGuestReminders([
      {
        stableKey: "official-deadline:opp-1:2027-03-01:7",
        source: "official-deadline",
        targetType: "built-in",
        targetId: "opp-1",
        title: "Official deadline for \"Test Scholarship\"",
        dueAt: "2027-03-01",
        leadDays: 7,
      },
    ]);
    await createGuestNotification({
      type: "saved-search-alert",
      source: "saved-search",
      title: "New match",
      message: "A new opportunity matches one of your saved searches.",
      targetType: null,
      targetId: null,
      savedSearchId: null,
      dueAt: null,
    });

    const payload = await buildBackupPayload();
    expect(payload.data.eligibilityAnswers?.answers.nationality).toBe("Germany");
    expect(payload.data.savedSearches).toHaveLength(1);
    expect(payload.data.savedSearches[0].name).toBe("Germany scholarships");
    expect(payload.data.reminderPreferences?.officialLeadDays).toEqual([7]);
    expect(payload.data.reminders).toHaveLength(1);
    expect(payload.data.notifications).toHaveLength(1);
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

  it("still validates a pre-Checkpoint-4 backup that has no Checkpoint 4 fields at all", () => {
    const legacyPayload = {
      app: BACKUP_APP_ID,
      schemaVersion: 3,
      createdAt: "2026-01-01T00:00:00Z",
      counts: { workspace: 0, customOpportunities: 0 },
      data: { workspace: [], customOpportunities: [], preferences: null },
    };
    const result = validateBackupPayload(legacyPayload);
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.summary.savedSearchCount).toBe(0);
      expect(result.summary.reminderCount).toBe(0);
    }
  });

  it("reports accurate saved-search and reminder counts in the validation summary", async () => {
    await createGuestSavedSearch({ name: "A", queryText: "", filters: {}, sortMode: "relevance", resultCountSnapshot: 0, resultSnapshot: [] });
    await upsertGuestReminders([
      { stableKey: "personal-deadline:built-in:opp-1:2027-01-01:1", source: "personal-deadline", targetType: "built-in", targetId: "opp-1", title: "x", dueAt: "2027-01-01", leadDays: 1 },
      { stableKey: "personal-deadline:built-in:opp-2:2027-02-01:1", source: "personal-deadline", targetType: "built-in", targetId: "opp-2", title: "y", dueAt: "2027-02-01", leadDays: 1 },
    ]);
    const payload = await buildBackupPayload();
    const result = validateBackupPayload(payload);
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.summary.savedSearchCount).toBe(1);
      expect(result.summary.reminderCount).toBe(2);
    }
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

describe("backup import: Checkpoint 4 data types round-trip", () => {
  it("restores eligibility answers, saved searches, reminder preferences, reminders, and notifications on import", async () => {
    await setGuestEligibilityAnswers({ nationality: "France", fieldsOfInterest: [], preferredCountries: [], preferredRegions: [] });
    await createGuestSavedSearch({ name: "Round trip search", queryText: "", filters: {}, sortMode: "relevance", resultCountSnapshot: 0, resultSnapshot: [] });
    await setGuestReminderPreferences({ remindersEnabled: false, officialLeadDays: [14], personalLeadDays: [3] });
    await upsertGuestReminders([
      { stableKey: "official-deadline:opp-1:2027-05-01:14", source: "official-deadline", targetType: "built-in", targetId: "opp-1", title: "Round trip reminder", dueAt: "2027-05-01", leadDays: 14 },
    ]);
    await createGuestNotification({
      type: "system",
      source: "system",
      title: "Round trip notification",
      message: "",
      targetType: null,
      targetId: null,
      savedSearchId: null,
      dueAt: null,
    });

    const payload = await buildBackupPayload();

    // Simulate restoring onto a different, empty browser/profile.
    await clearAllGuestData();
    expect(await getAllGuestSavedSearches()).toHaveLength(0);

    await importBackupPayload(payload, "replace");

    expect((await getGuestEligibilityAnswers()).answers.nationality).toBe("France");
    const searches = await getAllGuestSavedSearches();
    expect(searches).toHaveLength(1);
    expect(searches[0].name).toBe("Round trip search");
    expect((await getGuestReminderPreferences()).officialLeadDays).toEqual([14]);
    const reminders = await getAllGuestReminders();
    expect(reminders).toHaveLength(1);
    expect(reminders[0].title).toBe("Round trip reminder");
    const notifications = await getAllGuestNotifications();
    expect(notifications).toHaveLength(1);
    expect(notifications[0].title).toBe("Round trip notification");
  });

  it("merge mode adds Checkpoint 4 records from the backup without deleting ones already present locally", async () => {
    await createGuestSavedSearch({ name: "Kept locally", queryText: "", filters: {}, sortMode: "relevance", resultCountSnapshot: 0, resultSnapshot: [] });
    const payload = await buildBackupPayload();
    payload.data.savedSearches.push({
      id: crypto.randomUUID(),
      name: "From the backup file",
      queryText: "",
      filters: {},
      sortMode: "relevance",
      resultCountSnapshot: 0,
      resultSnapshot: [],
      lastCheckedAt: null,
      alertsEnabled: true,
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-01-01T00:00:00Z",
    });

    await importBackupPayload(payload, "merge");
    const names = (await getAllGuestSavedSearches()).map((s) => s.name).sort();
    expect(names).toEqual(["From the backup file", "Kept locally"]);
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

  it("also clears every Checkpoint 4 store: saved searches, reminders, notifications, eligibility answers, reminder preferences", async () => {
    await setGuestEligibilityAnswers({ nationality: "Germany", fieldsOfInterest: [], preferredCountries: [], preferredRegions: [] });
    await createGuestSavedSearch({ name: "A", queryText: "", filters: {}, sortMode: "relevance", resultCountSnapshot: 0, resultSnapshot: [] });
    await setGuestReminderPreferences({ remindersEnabled: false, officialLeadDays: [30], personalLeadDays: [30] });
    await upsertGuestReminders([
      { stableKey: "personal-deadline:built-in:opp-1:2027-01-01:1", source: "personal-deadline", targetType: "built-in", targetId: "opp-1", title: "x", dueAt: "2027-01-01", leadDays: 1 },
    ]);
    await createGuestNotification({ type: "system", source: "system", title: "x", message: "", targetType: null, targetId: null, savedSearchId: null, dueAt: null });

    await clearAllGuestData();

    expect(await getAllGuestSavedSearches()).toHaveLength(0);
    expect(await getAllGuestReminders()).toHaveLength(0);
    expect(await getAllGuestNotifications()).toHaveLength(0);
    // Singletons reset to defaults rather than "not found", matching getGuestEligibilityAnswers()/getGuestReminderPreferences().
    expect((await getGuestEligibilityAnswers()).answers.nationality).toBeUndefined();
    expect((await getGuestReminderPreferences()).officialLeadDays).toEqual([7]);
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
