import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DB_NAME, getDb, resetDbConnectionForTests } from "@/lib/storage/db";

const upsertTracking = vi.fn();
const upsertNote = vi.fn();
const toggleChecklistTask = vi.fn();

vi.mock("@/lib/db/actions/student/tracking", () => ({ upsertTracking: (...args: unknown[]) => upsertTracking(...args) }));
vi.mock("@/lib/db/actions/student/notes", () => ({ upsertNote: (...args: unknown[]) => upsertNote(...args) }));
vi.mock("@/lib/db/actions/student/checklist", () => ({
  addChecklistTask: vi.fn(),
  deleteChecklistTask: vi.fn(),
  renameChecklistTask: vi.fn(),
  toggleChecklistTask: (...args: unknown[]) => toggleChecklistTask(...args),
}));
vi.mock("@/lib/db/actions/student/preferences", () => ({
  updateMyDisplayPreferences: vi.fn(),
  updateMyPlanningPreferences: vi.fn(),
}));

const { clearOutboxForStudent, countPending, enqueueOutboxEntry, flushOutbox, getPendingEntries } = await import("@/lib/sync/outbox");

const STUDENT_A = "aaaaaaaa-0000-4000-8000-000000000001";
const STUDENT_B = "bbbbbbbb-0000-4000-8000-000000000002";

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
  await getDb();
  upsertTracking.mockReset();
  upsertNote.mockReset();
  toggleChecklistTask.mockReset();
});
afterEach(resetDatabase);

describe("sync outbox", () => {
  it("enqueues an entry and reports it as pending for the right student only", async () => {
    await enqueueOutboxEntry({
      id: "entry-1",
      studentProfileId: STUDENT_A,
      createdAt: new Date().toISOString(),
      kind: "tracking",
      opportunityId: "opp-1",
      patch: { shortlisted: true },
    });

    expect(await countPending(STUDENT_A)).toBe(1);
    expect(await countPending(STUDENT_B)).toBe(0);
  });

  it("replays queued entries in creation order and removes them once applied", async () => {
    upsertTracking.mockResolvedValue({ ok: true });
    upsertNote.mockResolvedValue({ ok: true });

    await enqueueOutboxEntry({
      id: "entry-1",
      studentProfileId: STUDENT_A,
      createdAt: "2026-01-01T00:00:00.000Z",
      kind: "tracking",
      opportunityId: "opp-1",
      patch: { shortlisted: true },
    });
    await enqueueOutboxEntry({
      id: "entry-2",
      studentProfileId: STUDENT_A,
      createdAt: "2026-01-01T00:00:01.000Z",
      kind: "note",
      targetType: "built-in",
      targetId: "opp-1",
      noteText: "hello",
    });

    const result = await flushOutbox(STUDENT_A);

    expect(result).toEqual({ flushed: 2, remaining: 0 });
    expect(upsertTracking).toHaveBeenCalledWith("opp-1", { shortlisted: true });
    expect(upsertNote).toHaveBeenCalledWith({ targetType: "built-in", targetId: "opp-1", noteText: "hello" });
    expect(await countPending(STUDENT_A)).toBe(0);
  });

  it("stops at the first failure, leaving it and later entries queued", async () => {
    upsertTracking.mockResolvedValue({ ok: false, error: "conflict" });

    await enqueueOutboxEntry({
      id: "entry-1",
      studentProfileId: STUDENT_A,
      createdAt: "2026-01-01T00:00:00.000Z",
      kind: "tracking",
      opportunityId: "opp-1",
      patch: { shortlisted: true },
    });
    await enqueueOutboxEntry({
      id: "entry-2",
      studentProfileId: STUDENT_A,
      createdAt: "2026-01-01T00:00:01.000Z",
      kind: "checklist-toggle",
      taskId: "task-1",
    });

    const result = await flushOutbox(STUDENT_A);

    expect(result.flushed).toBe(0);
    expect(result.remaining).toBe(2);
    expect(toggleChecklistTask).not.toHaveBeenCalled();
    expect(await countPending(STUDENT_A)).toBe(2);
  });

  it("clearOutboxForStudent only clears the named student's entries", async () => {
    await enqueueOutboxEntry({
      id: "entry-a",
      studentProfileId: STUDENT_A,
      createdAt: new Date().toISOString(),
      kind: "tracking",
      opportunityId: "opp-1",
      patch: {},
    });
    await enqueueOutboxEntry({
      id: "entry-b",
      studentProfileId: STUDENT_B,
      createdAt: new Date().toISOString(),
      kind: "tracking",
      opportunityId: "opp-2",
      patch: {},
    });

    await clearOutboxForStudent(STUDENT_A);

    expect(await countPending(STUDENT_A)).toBe(0);
    expect(await countPending(STUDENT_B)).toBe(1);
  });

  it("getPendingEntries returns entries sorted by creation time", async () => {
    await enqueueOutboxEntry({
      id: "later",
      studentProfileId: STUDENT_A,
      createdAt: "2026-01-02T00:00:00.000Z",
      kind: "checklist-toggle",
      taskId: "task-2",
    });
    await enqueueOutboxEntry({
      id: "earlier",
      studentProfileId: STUDENT_A,
      createdAt: "2026-01-01T00:00:00.000Z",
      kind: "checklist-toggle",
      taskId: "task-1",
    });

    const entries = await getPendingEntries(STUDENT_A);
    expect(entries.map((e) => e.id)).toEqual(["earlier", "later"]);
  });
});
