import { getDb } from "@/lib/storage/db";
import type { OutboxEntry } from "@/lib/storage/types";
import { upsertTracking } from "@/lib/db/actions/student/tracking";
import { upsertNote } from "@/lib/db/actions/student/notes";
import {
  addChecklistTask,
  deleteChecklistTask,
  renameChecklistTask,
  toggleChecklistTask,
} from "@/lib/db/actions/student/checklist";
import { updateMyDisplayPreferences, updateMyPlanningPreferences } from "@/lib/db/actions/student/preferences";
import type { TrackingPatch } from "@/lib/schemas/student-workspace";
import { setPendingCount, setSyncStatus } from "./status";

export async function enqueueOutboxEntry(entry: OutboxEntry): Promise<void> {
  const db = await getDb();
  await db.put("syncOutbox", entry);
  const pending = await countPending(entry.studentProfileId);
  setPendingCount(pending);
}

export async function countPending(studentProfileId: string): Promise<number> {
  const db = await getDb();
  const all = await db.getAll("syncOutbox");
  return all.filter((entry) => entry.studentProfileId === studentProfileId).length;
}

export async function getPendingEntries(studentProfileId: string): Promise<OutboxEntry[]> {
  const db = await getDb();
  const all = await db.getAll("syncOutbox");
  return all.filter((entry) => entry.studentProfileId === studentProfileId).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

/** Removes every queued entry for a student — used on sign-out so the queue never crosses accounts. */
export async function clearOutboxForStudent(studentProfileId: string): Promise<void> {
  const db = await getDb();
  const all = await db.getAll("syncOutbox");
  await Promise.all(
    all.filter((entry) => entry.studentProfileId === studentProfileId).map((entry) => db.delete("syncOutbox", entry.id)),
  );
}

async function replay(entry: OutboxEntry): Promise<{ ok: boolean }> {
  switch (entry.kind) {
    case "tracking":
      return upsertTracking(entry.opportunityId, entry.patch as TrackingPatch);
    case "note":
      return upsertNote({ targetType: entry.targetType, targetId: entry.targetId, noteText: entry.noteText });
    case "checklist-add":
      return addChecklistTask({ targetType: entry.targetType, targetId: entry.targetId, taskText: entry.taskText, sourceType: "user-created" });
    case "checklist-toggle":
      return toggleChecklistTask(entry.taskId);
    case "checklist-rename":
      return renameChecklistTask(entry.taskId, entry.taskText);
    case "checklist-delete":
      return deleteChecklistTask(entry.taskId);
    case "planning-preferences":
      return updateMyPlanningPreferences(entry.patch as Parameters<typeof updateMyPlanningPreferences>[0]);
    case "display-preferences":
      return updateMyDisplayPreferences(entry.patch as Parameters<typeof updateMyDisplayPreferences>[0]);
  }
}

/**
 * Replays every queued mutation for a student, in the order they were made.
 * Stops at the first failure (leaving it and everything after it queued)
 * rather than reordering or dropping entries — a later edit must never
 * apply before an earlier one it depends on.
 */
export async function flushOutbox(studentProfileId: string): Promise<{ flushed: number; remaining: number }> {
  const entries = await getPendingEntries(studentProfileId);
  if (entries.length === 0) {
    return { flushed: 0, remaining: 0 };
  }

  setSyncStatus("saving");
  const db = await getDb();
  let flushed = 0;

  for (const entry of entries) {
    try {
      const result = await replay(entry);
      if (!result.ok) {
        setSyncStatus("failed");
        return { flushed, remaining: entries.length - flushed };
      }
      await db.delete("syncOutbox", entry.id);
      flushed += 1;
    } catch {
      setSyncStatus("failed");
      return { flushed, remaining: entries.length - flushed };
    }
  }

  const remaining = await countPending(studentProfileId);
  setPendingCount(remaining);
  if (remaining === 0) {
    setSyncStatus("saved");
  }
  return { flushed, remaining };
}
