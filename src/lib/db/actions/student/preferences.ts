"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getStudentSession } from "@/lib/auth/student-session";
import { getDb, schema } from "@/lib/db/client";
import {
  displayPreferencesInputSchema,
  planningPreferencesInputSchema,
  type DisplayPreferencesInput,
  type PlanningPreferencesInput,
} from "@/lib/schemas/student-workspace";

export async function getMyPlanningPreferences() {
  const session = await getStudentSession();
  if (!session) return null;
  const db = getDb();
  const [row] = await db
    .select()
    .from(schema.userPlanningPreferences)
    .where(eq(schema.userPlanningPreferences.studentProfileId, session.studentProfileId))
    .limit(1);
  return row ?? null;
}

export async function getMyDisplayPreferences() {
  const session = await getStudentSession();
  if (!session) return null;
  const db = getDb();
  const [row] = await db
    .select()
    .from(schema.userDisplayPreferences)
    .where(eq(schema.userDisplayPreferences.studentProfileId, session.studentProfileId))
    .limit(1);
  return row ?? null;
}

export async function updateMyPlanningPreferences(
  input: PlanningPreferencesInput,
): Promise<{ ok: boolean; error?: string }> {
  const session = await getStudentSession();
  if (!session) return { ok: false, error: "Not signed in." };

  const parsed = planningPreferencesInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid preferences." };
  }

  const db = getDb();
  await db
    .insert(schema.userPlanningPreferences)
    .values({ studentProfileId: session.studentProfileId, ...parsed.data })
    .onConflictDoUpdate({
      target: schema.userPlanningPreferences.studentProfileId,
      set: { ...parsed.data, updatedAt: new Date() },
    });

  revalidatePath("/account");
  revalidatePath("/settings");
  return { ok: true };
}

export async function updateMyDisplayPreferences(
  input: DisplayPreferencesInput,
): Promise<{ ok: boolean; error?: string }> {
  const session = await getStudentSession();
  if (!session) return { ok: false, error: "Not signed in." };

  const parsed = displayPreferencesInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid preferences." };
  }

  const db = getDb();
  const patch: Record<string, unknown> = { updatedAt: new Date() };
  if (parsed.data.theme !== undefined) patch.theme = parsed.data.theme;
  if (parsed.data.catalogueView !== undefined) patch.catalogueView = parsed.data.catalogueView;

  await db
    .insert(schema.userDisplayPreferences)
    .values({
      studentProfileId: session.studentProfileId,
      theme: parsed.data.theme ?? null,
      catalogueView: parsed.data.catalogueView ?? "grid",
    })
    .onConflictDoUpdate({ target: schema.userDisplayPreferences.studentProfileId, set: patch });

  revalidatePath("/account");
  revalidatePath("/settings");
  return { ok: true };
}
