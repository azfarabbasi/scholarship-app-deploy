"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getStudentSession } from "@/lib/auth/student-session";
import { getDb, schema } from "@/lib/db/client";
import { noteInputSchema, type NoteInput } from "@/lib/schemas/student-workspace";

export type NoteRow = typeof schema.userNotes.$inferSelect;

export interface NoteActionResult {
  ok: boolean;
  error?: string;
  conflict?: NoteRow;
  data?: NoteRow;
}

export async function getMyNotes(): Promise<NoteRow[]> {
  const session = await getStudentSession();
  if (!session) return [];
  const db = getDb();
  return db.select().from(schema.userNotes).where(eq(schema.userNotes.studentProfileId, session.studentProfileId));
}

/** Plain text only — the caller must never render `noteText` as HTML. */
export async function upsertNote(input: NoteInput, expectedUpdatedAt?: string | null): Promise<NoteActionResult> {
  const session = await getStudentSession();
  if (!session) return { ok: false, error: "Not signed in." };

  const parsed = noteInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid note." };
  }

  const db = getDb();
  const [existing] = await db
    .select()
    .from(schema.userNotes)
    .where(
      and(
        eq(schema.userNotes.studentProfileId, session.studentProfileId),
        eq(schema.userNotes.targetType, parsed.data.targetType),
        eq(schema.userNotes.targetId, parsed.data.targetId),
      ),
    )
    .limit(1);

  if (existing && expectedUpdatedAt && existing.updatedAt.toISOString() !== expectedUpdatedAt) {
    return { ok: false, error: "This note changed elsewhere since you last loaded it.", conflict: existing };
  }

  const [row] = existing
    ? await db
        .update(schema.userNotes)
        .set({ noteText: parsed.data.noteText, updatedAt: new Date() })
        .where(eq(schema.userNotes.id, existing.id))
        .returning()
    : await db
        .insert(schema.userNotes)
        .values({
          studentProfileId: session.studentProfileId,
          targetType: parsed.data.targetType,
          targetId: parsed.data.targetId,
          noteText: parsed.data.noteText,
        })
        .returning();

  revalidatePath("/workspace");
  return { ok: true, data: row };
}
