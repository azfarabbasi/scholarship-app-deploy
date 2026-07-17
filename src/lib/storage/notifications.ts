import { getDb } from "./db";
import { emitStorageChange } from "./events";
import type { NotificationRecord, NotificationStatus } from "./types";

export async function getAllGuestNotifications(): Promise<NotificationRecord[]> {
  const db = await getDb();
  return db.getAll("notifications");
}

export async function createGuestNotification(
  input: Omit<NotificationRecord, "id" | "status" | "readAt" | "createdAt">,
): Promise<NotificationRecord> {
  const db = await getDb();
  const record: NotificationRecord = { ...input, id: crypto.randomUUID(), status: "unread", readAt: null, createdAt: new Date().toISOString() };
  await db.put("notifications", record);
  emitStorageChange("notifications");
  return record;
}

export async function setGuestNotificationStatus(id: string, status: NotificationStatus): Promise<void> {
  const db = await getDb();
  const existing = await db.get("notifications", id);
  if (!existing) return;
  await db.put("notifications", { ...existing, status, readAt: status === "read" || status === "dismissed" ? new Date().toISOString() : existing.readAt });
  emitStorageChange("notifications");
}

export async function deleteGuestNotification(id: string): Promise<void> {
  const db = await getDb();
  await db.delete("notifications", id);
  emitStorageChange("notifications");
}

export async function clearAllGuestNotifications(): Promise<void> {
  const db = await getDb();
  await db.clear("notifications");
  emitStorageChange("notifications");
}
