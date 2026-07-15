import { getDb } from "./db";
import { emitStorageChange } from "./events";
import {
  GENERIC_CHECKLIST_TEMPLATE,
  type ApplicationStageOption,
  type ChecklistItem,
  type WorkspaceRecord,
} from "./types";

function nowIso(): string {
  return new Date().toISOString();
}

function createChecklistItem(label: string, origin: ChecklistItem["origin"]): ChecklistItem {
  const timestamp = nowIso();
  return {
    id: crypto.randomUUID(),
    label,
    completed: false,
    origin,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function emptyRecord(opportunityId: string): WorkspaceRecord {
  const timestamp = nowIso();
  return {
    opportunityId,
    shortlisted: false,
    stage: "not-started",
    notes: "",
    checklist: [],
    personalDeadline: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export async function getWorkspaceRecord(opportunityId: string): Promise<WorkspaceRecord | undefined> {
  const db = await getDb();
  return db.get("workspace", opportunityId);
}

export async function getAllWorkspaceRecords(): Promise<WorkspaceRecord[]> {
  const db = await getDb();
  return db.getAll("workspace");
}

async function upsert(
  opportunityId: string,
  mutate: (record: WorkspaceRecord) => WorkspaceRecord,
): Promise<WorkspaceRecord> {
  const db = await getDb();
  const existing = (await db.get("workspace", opportunityId)) ?? emptyRecord(opportunityId);
  const updated = { ...mutate(existing), opportunityId, updatedAt: nowIso() };
  await db.put("workspace", updated);
  emitStorageChange("workspace");
  return updated;
}

export async function setShortlisted(opportunityId: string, shortlisted: boolean): Promise<WorkspaceRecord> {
  return upsert(opportunityId, (record) => ({ ...record, shortlisted }));
}

export async function toggleShortlisted(opportunityId: string): Promise<WorkspaceRecord> {
  return upsert(opportunityId, (record) => ({ ...record, shortlisted: !record.shortlisted }));
}

export async function setApplicationStage(
  opportunityId: string,
  stage: ApplicationStageOption,
): Promise<WorkspaceRecord> {
  return upsert(opportunityId, (record) => ({ ...record, stage }));
}

export async function setNotes(opportunityId: string, notes: string): Promise<WorkspaceRecord> {
  return upsert(opportunityId, (record) => ({ ...record, notes }));
}

export async function setPersonalDeadline(
  opportunityId: string,
  isoDate: string | null,
): Promise<WorkspaceRecord> {
  return upsert(opportunityId, (record) => ({ ...record, personalDeadline: isoDate }));
}

export async function addChecklistItem(opportunityId: string, label: string): Promise<WorkspaceRecord> {
  return upsert(opportunityId, (record) => ({
    ...record,
    checklist: [...record.checklist, createChecklistItem(label, "user")],
  }));
}

export async function seedGenericChecklist(opportunityId: string): Promise<WorkspaceRecord> {
  return upsert(opportunityId, (record) => ({
    ...record,
    checklist: [
      ...record.checklist,
      ...GENERIC_CHECKLIST_TEMPLATE.map((label) => createChecklistItem(label, "template")),
    ],
  }));
}

export async function renameChecklistItem(
  opportunityId: string,
  itemId: string,
  label: string,
): Promise<WorkspaceRecord> {
  return upsert(opportunityId, (record) => ({
    ...record,
    checklist: record.checklist.map((item) =>
      item.id === itemId ? { ...item, label, updatedAt: nowIso() } : item,
    ),
  }));
}

export async function toggleChecklistItem(opportunityId: string, itemId: string): Promise<WorkspaceRecord> {
  return upsert(opportunityId, (record) => ({
    ...record,
    checklist: record.checklist.map((item) =>
      item.id === itemId ? { ...item, completed: !item.completed, updatedAt: nowIso() } : item,
    ),
  }));
}

export async function deleteChecklistItem(opportunityId: string, itemId: string): Promise<WorkspaceRecord> {
  return upsert(opportunityId, (record) => ({
    ...record,
    checklist: record.checklist.filter((item) => item.id !== itemId),
  }));
}

export async function resetGenericChecklist(opportunityId: string): Promise<WorkspaceRecord> {
  return upsert(opportunityId, (record) => ({
    ...record,
    checklist: record.checklist.filter((item) => item.origin !== "template"),
  }));
}

export async function deleteWorkspaceRecord(opportunityId: string): Promise<void> {
  const db = await getDb();
  await db.delete("workspace", opportunityId);
  emitStorageChange("workspace");
}

export function checklistProgress(checklist: readonly ChecklistItem[]): { done: number; total: number } {
  return { done: checklist.filter((item) => item.completed).length, total: checklist.length };
}
