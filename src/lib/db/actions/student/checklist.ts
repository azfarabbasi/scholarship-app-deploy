"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getStudentSession } from "@/lib/auth/student-session";
import { getDb, schema } from "@/lib/db/client";
import { checklistTaskInputSchema, type ChecklistTaskInput } from "@/lib/schemas/student-workspace";

export type ChecklistTaskRow = typeof schema.userChecklistTasks.$inferSelect;

export interface ChecklistActionResult {
  ok: boolean;
  error?: string;
  data?: ChecklistTaskRow;
}

export async function getMyChecklistTasks(): Promise<ChecklistTaskRow[]> {
  const session = await getStudentSession();
  if (!session) return [];
  const db = getDb();
  return db
    .select()
    .from(schema.userChecklistTasks)
    .where(eq(schema.userChecklistTasks.studentProfileId, session.studentProfileId));
}

export async function addChecklistTask(input: ChecklistTaskInput): Promise<ChecklistActionResult> {
  const session = await getStudentSession();
  if (!session) return { ok: false, error: "Not signed in." };

  const parsed = checklistTaskInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid task." };
  }

  const db = getDb();
  const existingCount = await db
    .select({ id: schema.userChecklistTasks.id })
    .from(schema.userChecklistTasks)
    .where(
      and(
        eq(schema.userChecklistTasks.studentProfileId, session.studentProfileId),
        eq(schema.userChecklistTasks.targetType, parsed.data.targetType),
        eq(schema.userChecklistTasks.targetId, parsed.data.targetId),
      ),
    );

  const [row] = await db
    .insert(schema.userChecklistTasks)
    .values({
      studentProfileId: session.studentProfileId,
      targetType: parsed.data.targetType,
      targetId: parsed.data.targetId,
      taskText: parsed.data.taskText,
      sourceType: parsed.data.sourceType,
      sortOrder: existingCount.length,
    })
    .returning();

  revalidatePath("/workspace");
  return { ok: true, data: row };
}

async function requireOwnedTask(studentProfileId: string, taskId: string) {
  const db = getDb();
  const [task] = await db
    .select()
    .from(schema.userChecklistTasks)
    .where(and(eq(schema.userChecklistTasks.id, taskId), eq(schema.userChecklistTasks.studentProfileId, studentProfileId)))
    .limit(1);
  return task ?? null;
}

export async function toggleChecklistTask(taskId: string): Promise<ChecklistActionResult> {
  const session = await getStudentSession();
  if (!session) return { ok: false, error: "Not signed in." };

  const task = await requireOwnedTask(session.studentProfileId, taskId);
  if (!task) return { ok: false, error: "Task not found." };

  const db = getDb();
  const [row] = await db
    .update(schema.userChecklistTasks)
    .set({ completed: !task.completed, updatedAt: new Date() })
    .where(eq(schema.userChecklistTasks.id, taskId))
    .returning();

  revalidatePath("/workspace");
  return { ok: true, data: row };
}

export async function renameChecklistTask(taskId: string, taskText: string): Promise<ChecklistActionResult> {
  const session = await getStudentSession();
  if (!session) return { ok: false, error: "Not signed in." };

  const trimmed = taskText.trim();
  if (trimmed.length === 0 || trimmed.length > 500) {
    return { ok: false, error: "Task text must be 1-500 characters." };
  }

  const task = await requireOwnedTask(session.studentProfileId, taskId);
  if (!task) return { ok: false, error: "Task not found." };

  const db = getDb();
  const [row] = await db
    .update(schema.userChecklistTasks)
    .set({ taskText: trimmed, updatedAt: new Date() })
    .where(eq(schema.userChecklistTasks.id, taskId))
    .returning();

  revalidatePath("/workspace");
  return { ok: true, data: row };
}

export async function deleteChecklistTask(taskId: string): Promise<{ ok: boolean; error?: string }> {
  const session = await getStudentSession();
  if (!session) return { ok: false, error: "Not signed in." };

  const task = await requireOwnedTask(session.studentProfileId, taskId);
  if (!task) return { ok: false, error: "Task not found." };

  const db = getDb();
  await db.delete(schema.userChecklistTasks).where(eq(schema.userChecklistTasks.id, taskId));

  revalidatePath("/workspace");
  return { ok: true };
}
