import "server-only";
import { and, eq, sql } from "drizzle-orm";
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

/**
 * A single atomic `INSERT ... ON CONFLICT ... DO UPDATE ... WHERE` statement,
 * not a read-then-write: two concurrent requests each doing a separate
 * SELECT-then-INSERT/UPDATE could both read the same "one under the limit"
 * count and both proceed, letting a student exceed `dailyLimit` by racing
 * requests. Postgres evaluates the `WHERE` guard and increments the row
 * under its own per-row lock in one round trip, so only one of two
 * concurrent requests at the boundary can ever win; the `WHERE` clause only
 * gates the UPDATE branch of a genuine conflict, never the INSERT branch, so
 * the very first request of the day always succeeds regardless of it.
 */
export async function checkAndConsumeUserQuota(studentProfileId: string, dailyLimit: number): Promise<UserRateLimitResult> {
  const db = getDb();
  const usageDate = todayUtc();

  const [row] = await db
    .insert(schema.aiUsageLimits)
    .values({ studentProfileId, usageDate, requestCount: 1, subjectType: "user" })
    .onConflictDoUpdate({
      target: [schema.aiUsageLimits.studentProfileId, schema.aiUsageLimits.usageDate],
      set: { requestCount: sql`${schema.aiUsageLimits.requestCount} + 1`, updatedAt: new Date() },
      setWhere: sql`${schema.aiUsageLimits.requestCount} < ${dailyLimit}`,
    })
    .returning({ requestCount: schema.aiUsageLimits.requestCount });

  if (row) {
    return { allowed: true, remaining: Math.max(0, dailyLimit - row.requestCount) };
  }

  // Conflict occurred but the WHERE guard blocked the update — already at or over the limit.
  const [existing] = await db
    .select({ requestCount: schema.aiUsageLimits.requestCount })
    .from(schema.aiUsageLimits)
    .where(and(eq(schema.aiUsageLimits.studentProfileId, studentProfileId), eq(schema.aiUsageLimits.usageDate, usageDate)));
  return { allowed: false, remaining: Math.max(0, dailyLimit - (existing?.requestCount ?? dailyLimit)) };
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
