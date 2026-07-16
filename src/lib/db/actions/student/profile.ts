"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getStudentSession } from "@/lib/auth/student-session";
import { getDb, schema } from "@/lib/db/client";
import { studentProfileInputSchema, type StudentProfileInput } from "@/lib/schemas/student-workspace";

export interface ActionResult<T = undefined> {
  ok: boolean;
  error?: string;
  data?: T;
}

export async function getMyProfile() {
  const session = await getStudentSession();
  if (!session) return null;

  const db = getDb();
  const [profile] = await db
    .select()
    .from(schema.studentProfiles)
    .where(eq(schema.studentProfiles.id, session.studentProfileId))
    .limit(1);
  return profile ?? null;
}

export async function updateMyProfile(input: StudentProfileInput): Promise<ActionResult> {
  const session = await getStudentSession();
  if (!session) return { ok: false, error: "Not signed in." };

  const parsed = studentProfileInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid profile data." };
  }

  const db = getDb();
  await db
    .update(schema.studentProfiles)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(schema.studentProfiles.id, session.studentProfileId));

  revalidatePath("/account");
  return { ok: true };
}

export async function completeOnboarding(): Promise<ActionResult> {
  const session = await getStudentSession();
  if (!session) return { ok: false, error: "Not signed in." };

  const db = getDb();
  await db
    .update(schema.studentProfiles)
    .set({ onboardingCompletedAt: new Date(), updatedAt: new Date() })
    .where(eq(schema.studentProfiles.id, session.studentProfileId));

  revalidatePath("/account");
  return { ok: true };
}
