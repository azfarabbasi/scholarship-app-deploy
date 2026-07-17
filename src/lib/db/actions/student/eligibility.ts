"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getStudentSession } from "@/lib/auth/student-session";
import { getDb, schema } from "@/lib/db/client";
import { eligibilityAnswersSchema, type EligibilityAnswersInput } from "@/lib/schemas/eligibility-answers";

export async function getMyEligibilityAnswers() {
  const session = await getStudentSession();
  if (!session) return null;
  const db = getDb();
  const [row] = await db
    .select()
    .from(schema.userEligibilityAnswers)
    .where(eq(schema.userEligibilityAnswers.studentProfileId, session.studentProfileId))
    .limit(1);
  return row ?? null;
}

export async function updateMyEligibilityAnswers(input: EligibilityAnswersInput): Promise<{ ok: boolean; error?: string }> {
  const session = await getStudentSession();
  if (!session) return { ok: false, error: "Not signed in." };

  const parsed = eligibilityAnswersSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid eligibility answers." };
  }

  const db = getDb();
  await db
    .insert(schema.userEligibilityAnswers)
    .values({ studentProfileId: session.studentProfileId, ...parsed.data })
    .onConflictDoUpdate({
      target: schema.userEligibilityAnswers.studentProfileId,
      set: { ...parsed.data, updatedAt: new Date() },
    });

  revalidatePath("/eligibility");
  revalidatePath("/workspace");
  return { ok: true };
}

export async function clearMyEligibilityAnswers(): Promise<{ ok: boolean }> {
  const session = await getStudentSession();
  if (!session) return { ok: false };
  const db = getDb();
  await db.delete(schema.userEligibilityAnswers).where(eq(schema.userEligibilityAnswers.studentProfileId, session.studentProfileId));
  revalidatePath("/eligibility");
  return { ok: true };
}
