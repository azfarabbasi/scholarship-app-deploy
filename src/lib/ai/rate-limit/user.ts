import "server-only";
import { and, eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db/client";

/**
 * Signed-in daily AI usage limiting, backed by `ai_usage_limits`. Unlike the
 * guest cookie, this is a durable per-student counter the student may only
 * *read* (see the hand-written read-only RLS policy in
 * `src/lib/db/schema/ai.ts`) — only this server-side function ever
 * increments it, so a student can never reset their own quota by racing a
 * client-side write.
 */

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

export interface UserRateLimitResult {
  allowed: boolean;
  remaining: number;
}

export async function checkAndConsumeUserQuota(studentProfileId: string, dailyLimit: number): Promise<UserRateLimitResult> {
  const db = getDb();
  const usageDate = todayUtc();

  const [existing] = await db
    .select()
    .from(schema.aiUsageLimits)
    .where(and(eq(schema.aiUsageLimits.studentProfileId, studentProfileId), eq(schema.aiUsageLimits.usageDate, usageDate)));

  const currentCount = existing?.requestCount ?? 0;
  if (currentCount >= dailyLimit) {
    return { allowed: false, remaining: 0 };
  }

  const nextCount = currentCount + 1;
  if (existing) {
    await db
      .update(schema.aiUsageLimits)
      .set({ requestCount: nextCount, updatedAt: new Date() })
      .where(eq(schema.aiUsageLimits.id, existing.id));
  } else {
    await db.insert(schema.aiUsageLimits).values({ studentProfileId, usageDate, requestCount: nextCount, subjectType: "user" });
  }

  return { allowed: true, remaining: Math.max(0, dailyLimit - nextCount) };
}

/** Read-only usage lookup for the student's own "View AI usage" display — never increments. */
export async function getUserQuotaUsage(studentProfileId: string): Promise<{ usageDate: string; requestCount: number }> {
  const db = getDb();
  const usageDate = todayUtc();
  const [existing] = await db
    .select()
    .from(schema.aiUsageLimits)
    .where(and(eq(schema.aiUsageLimits.studentProfileId, studentProfileId), eq(schema.aiUsageLimits.usageDate, usageDate)));
  return { usageDate, requestCount: existing?.requestCount ?? 0 };
}
