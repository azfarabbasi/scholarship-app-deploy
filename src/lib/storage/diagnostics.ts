import { getAllCustomOpportunities } from "./custom-opportunities";
import { getDb, isIndexedDbAvailable } from "./db";
import { getLastBackupAt } from "./backup";
import { SCHEMA_VERSION } from "./types";
import { getAllWorkspaceRecords } from "./workspace";

export interface StorageDiagnostics {
  localStorageAvailable: boolean;
  indexedDbAvailable: boolean;
  schemaVersion: number;
  workspaceRecordCount: number;
  customOpportunityCount: number;
  lastBackupAt: string | null;
}

export function isLocalStorageAvailable(): boolean {
  try {
    const testKey = "__scholartrack_storage_test__";
    window.localStorage.setItem(testKey, "1");
    window.localStorage.removeItem(testKey);
    return true;
  } catch {
    return false;
  }
}

export async function getStorageDiagnostics(): Promise<StorageDiagnostics> {
  const indexedDbAvailable = isIndexedDbAvailable();
  const localStorageAvailable = isLocalStorageAvailable();

  if (!indexedDbAvailable) {
    return {
      localStorageAvailable,
      indexedDbAvailable,
      schemaVersion: SCHEMA_VERSION,
      workspaceRecordCount: 0,
      customOpportunityCount: 0,
      lastBackupAt: null,
    };
  }

  await getDb();
  const [workspace, custom, lastBackupAt] = await Promise.all([
    getAllWorkspaceRecords(),
    getAllCustomOpportunities(),
    getLastBackupAt(),
  ]);

  return {
    localStorageAvailable,
    indexedDbAvailable,
    schemaVersion: SCHEMA_VERSION,
    workspaceRecordCount: workspace.length,
    customOpportunityCount: custom.length,
    lastBackupAt,
  };
}
