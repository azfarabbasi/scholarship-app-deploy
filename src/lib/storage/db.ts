import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import { SCHEMA_VERSION } from "./types";
import type {
  BackupMetaRecord,
  CustomOpportunityRecord,
  PreferencesRecord,
  WorkspaceRecord,
} from "./types";

export const DB_NAME = "scholartrack";

interface ScholarTrackSchema extends DBSchema {
  workspace: { key: string; value: WorkspaceRecord };
  customOpportunities: { key: string; value: CustomOpportunityRecord };
  preferences: { key: string; value: PreferencesRecord };
  meta: { key: string; value: BackupMetaRecord };
}

export type ScholarTrackDb = IDBPDatabase<ScholarTrackSchema>;

let dbPromise: Promise<ScholarTrackDb> | null = null;

export function isIndexedDbAvailable(): boolean {
  try {
    return typeof indexedDB !== "undefined";
  } catch {
    return false;
  }
}

/**
 * Safe upgrade path: every version only ADDS stores that don't already
 * exist. No store is ever dropped or recreated on upgrade, so existing guest
 * data survives ordinary version bumps.
 */
function upgrade(db: ScholarTrackDb): void {
  if (!db.objectStoreNames.contains("workspace")) {
    db.createObjectStore("workspace", { keyPath: "opportunityId" });
  }
  if (!db.objectStoreNames.contains("customOpportunities")) {
    db.createObjectStore("customOpportunities", { keyPath: "id" });
  }
  if (!db.objectStoreNames.contains("preferences")) {
    db.createObjectStore("preferences", { keyPath: "id" });
  }
  if (!db.objectStoreNames.contains("meta")) {
    db.createObjectStore("meta", { keyPath: "key" });
  }
}

export function getDb(): Promise<ScholarTrackDb> {
  if (!isIndexedDbAvailable()) {
    return Promise.reject(new Error("IndexedDB is not available in this browser."));
  }
  if (!dbPromise) {
    dbPromise = openDB<ScholarTrackSchema>(DB_NAME, SCHEMA_VERSION, {
      upgrade(db) {
        upgrade(db);
      },
    });
  }
  return dbPromise;
}

/**
 * Test-only: closes the current connection (if any) and forces a fresh one
 * next time getDb() is called. Closing matters: `indexedDB.deleteDatabase`
 * blocks until every open connection to that database is closed, so tests
 * that delete the database between cases must close first or they hang.
 */
export async function resetDbConnectionForTests(): Promise<void> {
  if (dbPromise) {
    const db = await dbPromise.catch(() => null);
    db?.close();
  }
  dbPromise = null;
}
