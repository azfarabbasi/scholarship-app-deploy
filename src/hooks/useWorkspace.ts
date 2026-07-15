"use client";

import { useMemo } from "react";
import {
  addChecklistItem,
  deleteChecklistItem,
  getAllWorkspaceRecords,
  getWorkspaceRecord,
  renameChecklistItem,
  resetGenericChecklist,
  seedGenericChecklist,
  setApplicationStage,
  setNotes,
  setPersonalDeadline,
  toggleChecklistItem,
  toggleShortlisted,
} from "@/lib/storage/workspace";
import type { ApplicationStageOption, WorkspaceRecord } from "@/lib/storage/types";
import { useStorageCollection } from "./useStorageCollection";

export function useWorkspaceRecords(): {
  records: WorkspaceRecord[];
  loading: boolean;
  error: string | null;
} {
  const [records, { loading, error }] = useStorageCollection("workspace", getAllWorkspaceRecords, []);
  return { records, loading, error };
}

export function useWorkspaceRecord(opportunityId: string): {
  record: WorkspaceRecord | undefined;
  loading: boolean;
  error: string | null;
  toggleShortlist: () => Promise<void>;
  setStage: (stage: ApplicationStageOption) => Promise<void>;
  saveNotes: (notes: string) => Promise<void>;
  setDeadline: (isoDate: string | null) => Promise<void>;
  addTask: (label: string) => Promise<void>;
  renameTask: (itemId: string, label: string) => Promise<void>;
  toggleTask: (itemId: string) => Promise<void>;
  deleteTask: (itemId: string) => Promise<void>;
  addGenericChecklist: () => Promise<void>;
  resetGenericTasks: () => Promise<void>;
} {
  const loader = useMemo(() => () => getWorkspaceRecord(opportunityId), [opportunityId]);
  const [record, { loading, error }] = useStorageCollection<WorkspaceRecord | undefined>(
    "workspace",
    loader,
    undefined,
  );

  return {
    record,
    loading,
    error,
    toggleShortlist: async () => {
      await toggleShortlisted(opportunityId);
    },
    setStage: async (stage) => {
      await setApplicationStage(opportunityId, stage);
    },
    saveNotes: async (notes) => {
      await setNotes(opportunityId, notes);
    },
    setDeadline: async (isoDate) => {
      await setPersonalDeadline(opportunityId, isoDate);
    },
    addTask: async (label) => {
      await addChecklistItem(opportunityId, label);
    },
    renameTask: async (itemId, label) => {
      await renameChecklistItem(opportunityId, itemId, label);
    },
    toggleTask: async (itemId) => {
      await toggleChecklistItem(opportunityId, itemId);
    },
    deleteTask: async (itemId) => {
      await deleteChecklistItem(opportunityId, itemId);
    },
    addGenericChecklist: async () => {
      await seedGenericChecklist(opportunityId);
    },
    resetGenericTasks: async () => {
      await resetGenericChecklist(opportunityId);
    },
  };
}
