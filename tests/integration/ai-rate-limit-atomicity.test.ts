import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as schema from "../../src/lib/db/schema";
import { checkAndConsumeUserQuota } from "../../src/lib/ai/rate-limit/user";
import { db, client, uniqueSuffix } from "./helpers";

/**
 * Phase 3 item 10: a read-then-write quota check (SELECT current count, THEN
 * INSERT/UPDATE) lets two concurrent requests both read the same
 * under-the-limit count and both proceed, letting a student exceed their
 * daily limit by racing requests. The fix is a single atomic
 * `INSERT ... ON CONFLICT ... DO UPDATE ... WHERE` — this test proves it by
 * actually firing concurrent requests and counting how many were allowed.
 */
describe("checkAndConsumeUserQuota atomicity (Phase 3 item 10)", () => {
  const suffix = uniqueSuffix();
  const studentId = "99999999-1111-4999-a999-999999999999";

  beforeAll(async () => {
    await db.insert(schema.studentProfiles).values({ id: studentId, email: `ai-rate-limit-${suffix}@example.test` });
  });

  afterAll(async () => {
    await db.delete(schema.aiUsageLimits).where(eq(schema.aiUsageLimits.studentProfileId, studentId));
    await db.delete(schema.studentProfiles).where(eq(schema.studentProfiles.id, studentId));
    await client.end();
  });

  it("never allows more than dailyLimit requests through, even when fired concurrently", async () => {
    const dailyLimit = 5;
    const concurrentRequests = 20;

    const results = await Promise.all(
      Array.from({ length: concurrentRequests }, () => checkAndConsumeUserQuota(studentId, dailyLimit)),
    );

    const allowedCount = results.filter((r) => r.allowed).length;
    expect(allowedCount).toBe(dailyLimit);

    const [row] = await db.select().from(schema.aiUsageLimits).where(eq(schema.aiUsageLimits.studentProfileId, studentId));
    expect(row?.requestCount).toBe(dailyLimit);
  });

  it("the first request of a fresh day always succeeds (INSERT branch, not gated by the WHERE guard)", async () => {
    const freshStudentId = "99999999-2222-4999-a999-999999999999";
    await db.insert(schema.studentProfiles).values({ id: freshStudentId, email: `ai-rate-limit-fresh-${suffix}@example.test` });

    const result = await checkAndConsumeUserQuota(freshStudentId, 10);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(9);

    await db.delete(schema.aiUsageLimits).where(eq(schema.aiUsageLimits.studentProfileId, freshStudentId));
    await db.delete(schema.studentProfiles).where(eq(schema.studentProfiles.id, freshStudentId));
  });

  it("rejects every request once the limit is already reached", async () => {
    const exhaustedId = "99999999-3333-4999-a999-999999999999";
    await db.insert(schema.studentProfiles).values({ id: exhaustedId, email: `ai-rate-limit-exhausted-${suffix}@example.test` });

    for (let i = 0; i < 3; i += 1) {
      await checkAndConsumeUserQuota(exhaustedId, 3);
    }
    const overLimit = await checkAndConsumeUserQuota(exhaustedId, 3);
    expect(overLimit.allowed).toBe(false);
    expect(overLimit.remaining).toBe(0);

    await db.delete(schema.aiUsageLimits).where(eq(schema.aiUsageLimits.studentProfileId, exhaustedId));
    await db.delete(schema.studentProfiles).where(eq(schema.studentProfiles.id, exhaustedId));
  });
});
