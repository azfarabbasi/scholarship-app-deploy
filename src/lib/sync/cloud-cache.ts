import { getDb } from "@/lib/storage/db";
import type { CloudWorkspaceSnapshot } from "@/lib/storage/types";

export async function readCloudCache(studentProfileId: string): Promise<CloudWorkspaceSnapshot | null> {
  const db = await getDb();
  const record = await db.get("cloudCache", studentProfileId);
  return record?.snapshot ?? null;
}

export async function writeCloudCache(studentProfileId: string, snapshot: CloudWorkspaceSnapshot): Promise<void> {
  const db = await getDb();
  await db.put("cloudCache", { studentProfileId, snapshot, cachedAt: new Date().toISOString() });
}

/** Removes the cached cloud snapshot — used on sign-out so it never leaks to the next person using this device. */
export async function clearCloudCache(studentProfileId: string): Promise<void> {
  const db = await getDb();
  await db.delete("cloudCache", studentProfileId);
}
