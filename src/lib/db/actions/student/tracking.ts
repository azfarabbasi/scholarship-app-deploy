"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getStudentSession } from "@/lib/auth/student-session";
import { getDb, schema } from "@/lib/db/client";
import { trackingPatchSchema, type TrackingPatch } from "@/lib/schemas/student-workspace";

export type TrackingRow = typeof schema.userOpportunityTracking.$inferSelect;

export interface TrackingActionResult {
  ok: boolean;
  error?: string;
  conflict?: TrackingRow;
  data?: TrackingRow;
}

export async function getMyTracking(): Promise<TrackingRow[]> {
  const session = await getStudentSession();
  if (!session) return [];
  const db = getDb();
  return db
    .select()
    .from(schema.userOpportunityTracking)
    .where(eq(schema.userOpportunityTracking.studentProfileId, session.studentProfileId));
}

/**
 * Creates or patches a student's tracking row for one built-in opportunity.
 * `expectedUpdatedAt`, when provided, implements simple optimistic
 * concurrency: if the row already changed server-side since the caller last
 * read it, the patch is rejected as a conflict instead of silently
 * overwriting a newer value (see the sync design in
 * `docs/checkpoint-3/checkpoint-3-architecture.md`).
 */
export async function upsertTracking(
  opportunityId: string,
  patch: TrackingPatch,
  expectedUpdatedAt?: string | null,
): Promise<TrackingActionResult> {
  const session = await getStudentSession();
  if (!session) return { ok: false, error: "Not signed in." };

  const parsed = trackingPatchSchema.safeParse(patch);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid tracking data." };
  }

  const db = getDb();
  const [existing] = await db
    .select()
    .from(schema.userOpportunityTracking)
    .where(
      and(
        eq(schema.userOpportunityTracking.studentProfileId, session.studentProfileId),
        eq(schema.userOpportunityTracking.opportunityId, opportunityId),
      ),
    )
    .limit(1);

  if (existing && expectedUpdatedAt && existing.updatedAt.toISOString() !== expectedUpdatedAt) {
    return { ok: false, error: "This item changed elsewhere since you last loaded it.", conflict: existing };
  }

  const personalDeadline =
    parsed.data.personalDeadline === undefined
      ? undefined
      : parsed.data.personalDeadline
        ? new Date(parsed.data.personalDeadline)
        : null;

  const values = { ...parsed.data, personalDeadline };

  const [row] = existing
    ? await db
        .update(schema.userOpportunityTracking)
        .set({ ...values, updatedAt: new Date() })
        .where(eq(schema.userOpportunityTracking.id, existing.id))
        .returning()
    : await db
        .insert(schema.userOpportunityTracking)
        .values({ studentProfileId: session.studentProfileId, opportunityId, ...values })
        .returning();

  revalidatePath("/workspace");
  revalidatePath("/account");
  return { ok: true, data: row };
}

export async function touchLastViewed(opportunityId: string): Promise<void> {
  const session = await getStudentSession();
  if (!session) return;

  const db = getDb();
  const [existing] = await db
    .select({ id: schema.userOpportunityTracking.id })
    .from(schema.userOpportunityTracking)
    .where(
      and(
        eq(schema.userOpportunityTracking.studentProfileId, session.studentProfileId),
        eq(schema.userOpportunityTracking.opportunityId, opportunityId),
      ),
    )
    .limit(1);

  if (existing) {
    await db
      .update(schema.userOpportunityTracking)
      .set({ lastViewedAt: new Date() })
      .where(eq(schema.userOpportunityTracking.id, existing.id));
  }
}
