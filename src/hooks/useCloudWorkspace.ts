"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getMyTracking } from "@/lib/db/actions/student/tracking";
import { getMyNotes } from "@/lib/db/actions/student/notes";
import { getMyChecklistTasks } from "@/lib/db/actions/student/checklist";
import { upsertTracking } from "@/lib/db/actions/student/tracking";
import { upsertNote } from "@/lib/db/actions/student/notes";
import { addChecklistTask, deleteChecklistTask, renameChecklistTask, toggleChecklistTask } from "@/lib/db/actions/student/checklist";
import type { TrackingPatch } from "@/lib/schemas/student-workspace";
import type { CloudWorkspaceSnapshot } from "@/lib/storage/types";
import { clearCloudCache, readCloudCache, writeCloudCache } from "@/lib/sync/cloud-cache";
import { clearOutboxForStudent, countPending, enqueueOutboxEntry, flushOutbox } from "@/lib/sync/outbox";
import { recordSynced, resetSyncStatus, setPendingCount, setSyncStatus } from "@/lib/sync/status";
import { useOnlineStatus } from "./useOnlineStatus";

function emptySnapshot(): CloudWorkspaceSnapshot {
  return { tracking: [], notes: [], checklistTasks: [], customOpportunities: [] };
}

function toSnapshot(
  tracking: Awaited<ReturnType<typeof getMyTracking>>,
  notes: Awaited<ReturnType<typeof getMyNotes>>,
  checklistTasks: Awaited<ReturnType<typeof getMyChecklistTasks>>,
): Pick<CloudWorkspaceSnapshot, "tracking" | "notes" | "checklistTasks"> {
  return {
    tracking: tracking.map((row) => ({
      id: row.id,
      opportunityId: row.opportunityId,
      shortlisted: row.shortlisted,
      stage: row.stage,
      personalDeadline: row.personalDeadline ? row.personalDeadline.toISOString() : null,
      priority: row.priority,
      archived: row.archived,
      updatedAt: row.updatedAt.toISOString(),
    })),
    notes: notes.map((row) => ({
      id: row.id,
      targetType: row.targetType,
      targetId: row.targetId,
      noteText: row.noteText,
      updatedAt: row.updatedAt.toISOString(),
    })),
    checklistTasks: checklistTasks.map((row) => ({
      id: row.id,
      targetType: row.targetType,
      targetId: row.targetId,
      taskText: row.taskText,
      completed: row.completed,
      sortOrder: row.sortOrder,
      updatedAt: row.updatedAt.toISOString(),
    })),
  };
}

/**
 * Signed-in equivalent of the guest `useWorkspaceRecords`/`useWorkspaceRecord`
 * hooks: cloud-backed tracking, notes, and checklist tasks, cached locally
 * for offline reads and with mutations queued when the network is
 * unavailable (see `src/lib/sync/outbox.ts`). Deliberately independent of
 * the guest hooks in `src/hooks/useWorkspace.ts` — signed-in and guest data
 * paths never share code, so guest mode stays completely unaffected by
 * anything in this file.
 */
export function useCloudWorkspace(studentProfileId: string | null) {
  const online = useOnlineStatus();
  const [snapshot, setSnapshot] = useState<CloudWorkspaceSnapshot>(emptySnapshot());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const flushingRef = useRef(false);

  const refresh = useCallback(async () => {
    if (!studentProfileId) {
      setSnapshot(emptySnapshot());
      setLoading(false);
      return;
    }

    try {
      const [tracking, notes, checklistTasks] = await Promise.all([getMyTracking(), getMyNotes(), getMyChecklistTasks()]);
      const cached = await readCloudCache(studentProfileId);
      const next: CloudWorkspaceSnapshot = { ...toSnapshot(tracking, notes, checklistTasks), customOpportunities: cached?.customOpportunities ?? [] };
      setSnapshot(next);
      await writeCloudCache(studentProfileId, next);
      const pending = await countPending(studentProfileId);
      setPendingCount(pending);
      if (pending === 0) {
        recordSynced(new Date().toISOString());
      }
      setError(null);
    } catch {
      const cached = await readCloudCache(studentProfileId);
      if (cached) {
        setSnapshot(cached);
        setError(null);
      } else {
        setError("Could not load your cloud workspace. You may be offline.");
      }
      setSyncStatus("offline");
    } finally {
      setLoading(false);
    }
  }, [studentProfileId]);

  useEffect(() => {
    // Data fetching on mount, matching `useBuiltInOpportunities`'s pattern —
    // `refresh` sets state only after its own network/IndexedDB awaits
    // resolve, never synchronously within this effect body.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, [refresh]);

  // Flush the outbox and re-sync whenever we come back online.
  useEffect(() => {
    if (!studentProfileId || !online || flushingRef.current) return;
    flushingRef.current = true;
    flushOutbox(studentProfileId)
      .then(() => refresh())
      .finally(() => {
        flushingRef.current = false;
      });
  }, [online, studentProfileId, refresh]);

  useEffect(() => {
    if (!online) {
      setSyncStatus("offline");
    }
  }, [online]);

  const patchTracking = useCallback(
    async (opportunityId: string, patch: TrackingPatch) => {
      if (!studentProfileId) return;

      setSnapshot((prev) => {
        const existingIndex = prev.tracking.findIndex((row) => row.opportunityId === opportunityId);
        const nowIso = new Date().toISOString();
        if (existingIndex === -1) {
          return {
            ...prev,
            tracking: [
              ...prev.tracking,
              {
                id: opportunityId,
                opportunityId,
                shortlisted: patch.shortlisted ?? false,
                stage: patch.stage ?? "not-started",
                personalDeadline: patch.personalDeadline ?? null,
                priority: patch.priority ?? null,
                archived: patch.archived ?? false,
                updatedAt: nowIso,
              },
            ],
          };
        }
        const updated = [...prev.tracking];
        updated[existingIndex] = { ...updated[existingIndex], ...patch, updatedAt: nowIso };
        return { ...prev, tracking: updated };
      });

      if (!online) {
        await enqueueOutboxEntry({
          id: crypto.randomUUID(),
          studentProfileId,
          createdAt: new Date().toISOString(),
          kind: "tracking",
          opportunityId,
          patch,
        });
        return;
      }

      setSyncStatus("saving");
      const result = await upsertTracking(opportunityId, patch);
      if (!result.ok) {
        await enqueueOutboxEntry({
          id: crypto.randomUUID(),
          studentProfileId,
          createdAt: new Date().toISOString(),
          kind: "tracking",
          opportunityId,
          patch,
        });
        setSyncStatus(result.conflict ? "conflict" : "failed");
        return;
      }
      recordSynced(new Date().toISOString());
      if (studentProfileId) await writeCloudCache(studentProfileId, { ...snapshot });
    },
    [online, studentProfileId, snapshot],
  );

  const saveNote = useCallback(
    async (targetType: "built-in" | "custom", targetId: string, noteText: string) => {
      if (!studentProfileId) return;

      setSnapshot((prev) => {
        const idx = prev.notes.findIndex((n) => n.targetType === targetType && n.targetId === targetId);
        const nowIso = new Date().toISOString();
        if (idx === -1) {
          return { ...prev, notes: [...prev.notes, { id: crypto.randomUUID(), targetType, targetId, noteText, updatedAt: nowIso }] };
        }
        const updated = [...prev.notes];
        updated[idx] = { ...updated[idx], noteText, updatedAt: nowIso };
        return { ...prev, notes: updated };
      });

      if (!online) {
        await enqueueOutboxEntry({ id: crypto.randomUUID(), studentProfileId, createdAt: new Date().toISOString(), kind: "note", targetType, targetId, noteText });
        return;
      }

      setSyncStatus("saving");
      const result = await upsertNote({ targetType, targetId, noteText });
      if (!result.ok) {
        await enqueueOutboxEntry({ id: crypto.randomUUID(), studentProfileId, createdAt: new Date().toISOString(), kind: "note", targetType, targetId, noteText });
        setSyncStatus(result.conflict ? "conflict" : "failed");
        return;
      }
      recordSynced(new Date().toISOString());
    },
    [online, studentProfileId],
  );

  const addTask = useCallback(
    async (targetType: "built-in" | "custom", targetId: string, taskText: string) => {
      if (!studentProfileId) return;
      const optimisticId = crypto.randomUUID();
      setSnapshot((prev) => ({
        ...prev,
        checklistTasks: [
          ...prev.checklistTasks,
          { id: optimisticId, targetType, targetId, taskText, completed: false, sortOrder: prev.checklistTasks.length, updatedAt: new Date().toISOString() },
        ],
      }));

      if (!online) {
        await enqueueOutboxEntry({ id: crypto.randomUUID(), studentProfileId, createdAt: new Date().toISOString(), kind: "checklist-add", targetType, targetId, taskText });
        return;
      }

      setSyncStatus("saving");
      const result = await addChecklistTask({ targetType, targetId, taskText, sourceType: "user-created" });
      if (!result.ok) {
        await enqueueOutboxEntry({ id: crypto.randomUUID(), studentProfileId, createdAt: new Date().toISOString(), kind: "checklist-add", targetType, targetId, taskText });
        setSyncStatus("failed");
        return;
      }
      recordSynced(new Date().toISOString());
      await refresh();
    },
    [online, studentProfileId, refresh],
  );

  const toggleTask = useCallback(
    async (taskId: string) => {
      if (!studentProfileId) return;
      setSnapshot((prev) => ({
        ...prev,
        checklistTasks: prev.checklistTasks.map((t) => (t.id === taskId ? { ...t, completed: !t.completed, updatedAt: new Date().toISOString() } : t)),
      }));

      if (!online) {
        await enqueueOutboxEntry({ id: crypto.randomUUID(), studentProfileId, createdAt: new Date().toISOString(), kind: "checklist-toggle", taskId });
        return;
      }
      setSyncStatus("saving");
      const result = await toggleChecklistTask(taskId);
      if (!result.ok) {
        await enqueueOutboxEntry({ id: crypto.randomUUID(), studentProfileId, createdAt: new Date().toISOString(), kind: "checklist-toggle", taskId });
        setSyncStatus("failed");
        return;
      }
      recordSynced(new Date().toISOString());
    },
    [online, studentProfileId],
  );

  const renameTask = useCallback(
    async (taskId: string, taskText: string) => {
      if (!studentProfileId) return;
      setSnapshot((prev) => ({
        ...prev,
        checklistTasks: prev.checklistTasks.map((t) => (t.id === taskId ? { ...t, taskText, updatedAt: new Date().toISOString() } : t)),
      }));

      if (!online) {
        await enqueueOutboxEntry({ id: crypto.randomUUID(), studentProfileId, createdAt: new Date().toISOString(), kind: "checklist-rename", taskId, taskText });
        return;
      }
      setSyncStatus("saving");
      const result = await renameChecklistTask(taskId, taskText);
      if (!result.ok) {
        await enqueueOutboxEntry({ id: crypto.randomUUID(), studentProfileId, createdAt: new Date().toISOString(), kind: "checklist-rename", taskId, taskText });
        setSyncStatus("failed");
        return;
      }
      recordSynced(new Date().toISOString());
    },
    [online, studentProfileId],
  );

  const deleteTask = useCallback(
    async (taskId: string) => {
      if (!studentProfileId) return;
      setSnapshot((prev) => ({ ...prev, checklistTasks: prev.checklistTasks.filter((t) => t.id !== taskId) }));

      if (!online) {
        await enqueueOutboxEntry({ id: crypto.randomUUID(), studentProfileId, createdAt: new Date().toISOString(), kind: "checklist-delete", taskId });
        return;
      }
      setSyncStatus("saving");
      const result = await deleteChecklistTask(taskId);
      if (!result.ok) {
        setSyncStatus("failed");
        return;
      }
      recordSynced(new Date().toISOString());
    },
    [online, studentProfileId],
  );

  return { snapshot, loading, error, refresh, patchTracking, saveNote, addTask, toggleTask, renameTask, deleteTask };
}

/** Call on sign-out — clears the local cloud cache and outbox for this student so they never leak to the next user of this device. */
export async function clearCloudWorkspaceLocalState(studentProfileId: string): Promise<void> {
  await Promise.all([clearCloudCache(studentProfileId), clearOutboxForStudent(studentProfileId)]);
  resetSyncStatus();
}
