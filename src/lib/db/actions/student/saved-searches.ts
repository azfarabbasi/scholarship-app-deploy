"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getStudentSession } from "@/lib/auth/student-session";
import { getDb, schema } from "@/lib/db/client";

export type SavedSearchRow = typeof schema.userSavedSearches.$inferSelect;

export interface SaveSearchInput {
  name: string;
  queryText: string;
  filters: Record<string, unknown>;
  sortMode: string;
  resultCountSnapshot: number;
  resultSnapshot: string[];
}

function validateName(name: string): string | null {
  const trimmed = name.trim();
  if (trimmed.length === 0 || trimmed.length > 150) return null;
  return trimmed;
}

export async function getMySavedSearches(): Promise<SavedSearchRow[]> {
  const session = await getStudentSession();
  if (!session) return [];
  const db = getDb();
  return db.select().from(schema.userSavedSearches).where(eq(schema.userSavedSearches.studentProfileId, session.studentProfileId));
}

export async function createMySavedSearch(input: SaveSearchInput): Promise<{ ok: boolean; error?: string; data?: SavedSearchRow }> {
  const session = await getStudentSession();
  if (!session) return { ok: false, error: "Not signed in." };

  const name = validateName(input.name);
  if (!name) return { ok: false, error: "Name must be 1-150 characters." };

  const db = getDb();
  const [row] = await db
    .insert(schema.userSavedSearches)
    .values({
      studentProfileId: session.studentProfileId,
      name,
      queryText: input.queryText,
      filters: input.filters,
      sortMode: input.sortMode,
      resultCountSnapshot: input.resultCountSnapshot,
      resultSnapshot: input.resultSnapshot,
      lastCheckedAt: new Date(),
    })
    .returning();

  revalidatePath("/opportunities");
  return { ok: true, data: row };
}

async function requireOwned(studentProfileId: string, id: string) {
  const db = getDb();
  const [row] = await db
    .select()
    .from(schema.userSavedSearches)
    .where(and(eq(schema.userSavedSearches.id, id), eq(schema.userSavedSearches.studentProfileId, studentProfileId)))
    .limit(1);
  return row ?? null;
}

export async function renameMySavedSearch(id: string, name: string): Promise<{ ok: boolean; error?: string }> {
  const session = await getStudentSession();
  if (!session) return { ok: false, error: "Not signed in." };
  const validName = validateName(name);
  if (!validName) return { ok: false, error: "Name must be 1-150 characters." };
  const existing = await requireOwned(session.studentProfileId, id);
  if (!existing) return { ok: false, error: "Saved search not found." };

  const db = getDb();
  await db.update(schema.userSavedSearches).set({ name: validName, updatedAt: new Date() }).where(eq(schema.userSavedSearches.id, id));
  revalidatePath("/opportunities");
  return { ok: true };
}

export async function setMySavedSearchAlerts(id: string, alertsEnabled: boolean): Promise<{ ok: boolean; error?: string }> {
  const session = await getStudentSession();
  if (!session) return { ok: false, error: "Not signed in." };
  const existing = await requireOwned(session.studentProfileId, id);
  if (!existing) return { ok: false, error: "Saved search not found." };

  const db = getDb();
  await db.update(schema.userSavedSearches).set({ alertsEnabled, updatedAt: new Date() }).where(eq(schema.userSavedSearches.id, id));
  revalidatePath("/opportunities");
  return { ok: true };
}

export async function refreshMySavedSearchSnapshot(
  id: string,
  resultCountSnapshot: number,
  resultSnapshot: string[],
): Promise<{ ok: boolean; error?: string }> {
  const session = await getStudentSession();
  if (!session) return { ok: false, error: "Not signed in." };
  const existing = await requireOwned(session.studentProfileId, id);
  if (!existing) return { ok: false, error: "Saved search not found." };

  const db = getDb();
  await db
    .update(schema.userSavedSearches)
    .set({ resultCountSnapshot, resultSnapshot, lastCheckedAt: new Date(), updatedAt: new Date() })
    .where(eq(schema.userSavedSearches.id, id));
  return { ok: true };
}

export async function deleteMySavedSearch(id: string): Promise<{ ok: boolean; error?: string }> {
  const session = await getStudentSession();
  if (!session) return { ok: false, error: "Not signed in." };
  const existing = await requireOwned(session.studentProfileId, id);
  if (!existing) return { ok: false, error: "Saved search not found." };

  const db = getDb();
  await db.delete(schema.userSavedSearches).where(eq(schema.userSavedSearches.id, id));
  revalidatePath("/opportunities");
  return { ok: true };
}
