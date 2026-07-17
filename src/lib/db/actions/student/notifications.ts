"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getStudentSession } from "@/lib/auth/student-session";
import { getDb, schema } from "@/lib/db/client";

export type NotificationRow = typeof schema.userNotifications.$inferSelect;

export async function getMyNotifications(): Promise<NotificationRow[]> {
  const session = await getStudentSession();
  if (!session) return [];
  const db = getDb();
  return db.select().from(schema.userNotifications).where(eq(schema.userNotifications.studentProfileId, session.studentProfileId));
}

export interface NotificationCandidate {
  type: (typeof schema.userNotifications.$inferInsert)["type"];
  source: (typeof schema.userNotifications.$inferInsert)["source"];
  title: string;
  message: string;
  targetType?: "built-in" | "custom" | null;
  targetId?: string | null;
  savedSearchId?: string | null;
  dueAt?: string | null;
}

/** Never includes private note text — only titles, generic messages, and structured target references. */
export async function createMyNotification(input: NotificationCandidate): Promise<{ ok: boolean }> {
  const session = await getStudentSession();
  if (!session) return { ok: false };

  const db = getDb();
  await db.insert(schema.userNotifications).values({
    studentProfileId: session.studentProfileId,
    type: input.type,
    source: input.source,
    title: input.title,
    message: input.message,
    targetType: input.targetType ?? null,
    targetId: input.targetId ?? null,
    savedSearchId: input.savedSearchId ?? null,
    dueAt: input.dueAt ? new Date(input.dueAt) : null,
  });

  revalidatePath("/notifications");
  return { ok: true };
}

async function requireOwnedNotification(studentProfileId: string, id: string) {
  const db = getDb();
  const [row] = await db
    .select()
    .from(schema.userNotifications)
    .where(and(eq(schema.userNotifications.id, id), eq(schema.userNotifications.studentProfileId, studentProfileId)))
    .limit(1);
  return row ?? null;
}

export async function setMyNotificationStatus(id: string, status: "unread" | "read" | "dismissed"): Promise<{ ok: boolean; error?: string }> {
  const session = await getStudentSession();
  if (!session) return { ok: false, error: "Not signed in." };
  const existing = await requireOwnedNotification(session.studentProfileId, id);
  if (!existing) return { ok: false, error: "Notification not found." };

  const db = getDb();
  await db
    .update(schema.userNotifications)
    .set({ status, readAt: status === "read" || status === "dismissed" ? new Date() : existing.readAt })
    .where(eq(schema.userNotifications.id, id));
  revalidatePath("/notifications");
  return { ok: true };
}

export async function deleteMyNotification(id: string): Promise<{ ok: boolean; error?: string }> {
  const session = await getStudentSession();
  if (!session) return { ok: false, error: "Not signed in." };
  const existing = await requireOwnedNotification(session.studentProfileId, id);
  if (!existing) return { ok: false, error: "Notification not found." };

  const db = getDb();
  await db.delete(schema.userNotifications).where(eq(schema.userNotifications.id, id));
  revalidatePath("/notifications");
  return { ok: true };
}

export async function clearAllMyNotifications(): Promise<{ ok: boolean }> {
  const session = await getStudentSession();
  if (!session) return { ok: false };
  const db = getDb();
  await db.delete(schema.userNotifications).where(eq(schema.userNotifications.studentProfileId, session.studentProfileId));
  revalidatePath("/notifications");
  return { ok: true };
}
