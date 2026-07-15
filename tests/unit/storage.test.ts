import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DB_NAME, getDb, isIndexedDbAvailable, resetDbConnectionForTests } from "@/lib/storage/db";
import {
  addChecklistItem,
  deleteWorkspaceRecord,
  getAllWorkspaceRecords,
  getWorkspaceRecord,
  resetGenericChecklist,
  seedGenericChecklist,
  setApplicationStage,
  setNotes,
  setPersonalDeadline,
  toggleChecklistItem,
  toggleShortlisted,
} from "@/lib/storage/workspace";
import {
  createCustomOpportunity,
  deleteCustomOpportunity,
  getAllCustomOpportunities,
  getCustomOpportunityById,
  updateCustomOpportunity,
} from "@/lib/storage/custom-opportunities";
import { getPreferences, updateDisplayPreferences, updatePlanningPreferences } from "@/lib/storage/preferences";
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

beforeEach(async () => {
  await resetDatabase();
});

afterEach(async () => {
  await resetDatabase();
});

const sampleCustomInput: CustomOpportunityInput = {
  title: "My Local Scholarship",
  opportunityType: "scholarship",
  providerName: null,
  countries: ["Germany"],
  regions: [],
  studyLevels: ["Master"],
  benefitSummary: "Covers tuition",
  eligibilitySummary: "Open to all",
  officialUrl: null,
  deadlineKind: "exact",
  deadlineRawText: "1 March 2027",
  deadlineDate: "2027-03-01",
  deadlineTimezone: null,
  verificationNotes: null,
};

describe("IndexedDB schema initialization", () => {
  it("reports IndexedDB as available in this test environment", () => {
    expect(isIndexedDbAvailable()).toBe(true);
  });

  it("opens the database and creates all expected object stores", async () => {
    const db = await getDb();
    expect([...db.objectStoreNames]).toEqual(
      expect.arrayContaining(["workspace", "customOpportunities", "preferences", "meta"]),
    );
  });

  it("uses the current schema version constant", () => {
    expect(SCHEMA_VERSION).toBeGreaterThanOrEqual(1);
  });
});

describe("workspace tracking persistence", () => {
  it("writes and reads back shortlist state", async () => {
    await toggleShortlisted("built-in-1");
    const record = await getWorkspaceRecord("built-in-1");
    expect(record?.shortlisted).toBe(true);
  });

  it("persists across a simulated reload (fresh DB connection)", async () => {
    await toggleShortlisted("built-in-1");
    await resetDbConnectionForTests();
    const record = await getWorkspaceRecord("built-in-1");
    expect(record?.shortlisted).toBe(true);
  });

  it("sets an application stage", async () => {
    await setApplicationStage("built-in-1", "submitted");
    const record = await getWorkspaceRecord("built-in-1");
    expect(record?.stage).toBe("submitted");
  });

  it("saves notes as plain text without transformation", async () => {
    await setNotes("built-in-1", "<script>alert(1)</script> plain text note");
    const record = await getWorkspaceRecord("built-in-1");
    expect(record?.notes).toBe("<script>alert(1)</script> plain text note");
  });

  it("sets and clears a personal deadline", async () => {
    await setPersonalDeadline("built-in-1", "2027-05-01");
    expect((await getWorkspaceRecord("built-in-1"))?.personalDeadline).toBe("2027-05-01");
    await setPersonalDeadline("built-in-1", null);
    expect((await getWorkspaceRecord("built-in-1"))?.personalDeadline).toBeNull();
  });

  it("adds, completes, and tracks checklist progress", async () => {
    await addChecklistItem("built-in-1", "Request references");
    let record = await getWorkspaceRecord("built-in-1");
    expect(record?.checklist).toHaveLength(1);

    const itemId = record!.checklist[0].id;
    await toggleChecklistItem("built-in-1", itemId);
    record = await getWorkspaceRecord("built-in-1");
    expect(record?.checklist[0].completed).toBe(true);
  });

  it("seeds the generic starter checklist and can reset only template tasks", async () => {
    await seedGenericChecklist("built-in-1");
    await addChecklistItem("built-in-1", "My own custom task");
    let record = await getWorkspaceRecord("built-in-1");
    const totalWithCustom = record!.checklist.length;
    expect(totalWithCustom).toBeGreaterThan(1);

    await resetGenericChecklist("built-in-1");
    record = await getWorkspaceRecord("built-in-1");
    expect(record?.checklist).toHaveLength(1);
    expect(record?.checklist[0].label).toBe("My own custom task");
  });

  it("does not create duplicate records for the same opportunity", async () => {
    await toggleShortlisted("built-in-1");
    await setNotes("built-in-1", "note one");
    await setApplicationStage("built-in-1", "researching");
    const all = await getAllWorkspaceRecords();
    expect(all.filter((r) => r.opportunityId === "built-in-1")).toHaveLength(1);
  });

  it("deletes a workspace record", async () => {
    await toggleShortlisted("built-in-1");
    await deleteWorkspaceRecord("built-in-1");
    expect(await getWorkspaceRecord("built-in-1")).toBeUndefined();
  });

  it("handles a storage failure gracefully (IndexedDB unavailable)", async () => {
    const originalIndexedDb = globalThis.indexedDB;
    // @ts-expect-error simulate an environment without IndexedDB
    delete globalThis.indexedDB;
    await resetDbConnectionForTests();

    await expect(getWorkspaceRecord("built-in-1")).rejects.toThrow(/IndexedDB is not available/);

    globalThis.indexedDB = originalIndexedDb;
    await resetDbConnectionForTests();
  });
});

describe("custom opportunities persistence", () => {
  it("creates a custom opportunity with a stable, unique ID and slug", async () => {
    const record = await createCustomOpportunity(sampleCustomInput);
    expect(record.id).toBeTruthy();
    expect(record.slug).toBe("my-local-scholarship");
  });

  it("edits a custom opportunity while preserving its ID", async () => {
    const created = await createCustomOpportunity(sampleCustomInput);
    const updated = await updateCustomOpportunity(created.id, { ...sampleCustomInput, title: "Updated Title" });
    expect(updated.id).toBe(created.id);
    expect(updated.title).toBe("Updated Title");
  });

  it("deletes a custom opportunity", async () => {
    const created = await createCustomOpportunity(sampleCustomInput);
    await deleteCustomOpportunity(created.id);
    expect(await getCustomOpportunityById(created.id)).toBeUndefined();
  });

  it("does not create duplicate custom opportunities for repeated identical creates", async () => {
    await createCustomOpportunity(sampleCustomInput);
    await createCustomOpportunity(sampleCustomInput);
    const all = await getAllCustomOpportunities();
    expect(all).toHaveLength(2); // two distinct records, but each with a unique id/slug
    expect(new Set(all.map((r) => r.id)).size).toBe(2);
    expect(new Set(all.map((r) => r.slug)).size).toBe(2);
  });
});

describe("preferences persistence", () => {
  it("returns sensible defaults before anything is saved", async () => {
    const preferences = await getPreferences();
    expect(preferences.planning.preferredCountries).toEqual([]);
    expect(preferences.display.catalogueView).toBe("grid");
  });

  it("persists planning preference updates", async () => {
    await updatePlanningPreferences({ targetIntakeYear: 2028, preferredCountries: ["Germany"] });
    const preferences = await getPreferences();
    expect(preferences.planning.targetIntakeYear).toBe(2028);
    expect(preferences.planning.preferredCountries).toEqual(["Germany"]);
  });

  it("persists display preference updates", async () => {
    await updateDisplayPreferences({ catalogueView: "list" });
    const preferences = await getPreferences();
    expect(preferences.display.catalogueView).toBe("list");
  });
});
