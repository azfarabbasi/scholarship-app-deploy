import { eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../../src/lib/db/schema";

const connectionString = process.env.DATABASE_URL as string;

/** Privileged connection (table owner), bypasses RLS — used for fixture setup/teardown. */
export const client = postgres(connectionString, { max: 5 });
export const db = drizzle(client, { schema });

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Runs `fn` inside one Postgres transaction with the role and (optionally) a
 * staff id set via `SET LOCAL` — scoped to that transaction only, so it's
 * automatically undone at commit/rollback and safe to use on a shared,
 * pooled connection. `app.test_current_staff_id` is the same GUC the local
 * auth shim's `auth.uid()` reads (see scripts/db/local-auth-shim.sql).
 */
export async function asRole<T>(
  role: "anon" | "authenticated" | "service_role",
  staffId: string | null,
  fn: (tx: Tx) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    if (staffId) {
      await tx.execute(sql.raw(`set local app.test_current_staff_id = '${staffId}'`));
    }
    await tx.execute(sql.raw(`set local role ${role}`));
    return fn(tx);
  });
}

export function uniqueSuffix(): string {
  return Math.random().toString(36).slice(2, 10);
}

/**
 * Satisfies every condition of the stricter publish gate
 * (`drizzle/0010_publication_integrity_actors.sql`) in one transaction, then
 * flips the opportunity to `published` — for fixtures elsewhere in this
 * suite that just need "a real published opportunity" to test something
 * unrelated (RLS visibility, search, AI retrieval scope, ...) without each
 * one re-deriving the verification/review-assignment mechanics themselves.
 *
 * Must run as a single transaction: the deferred constraint trigger
 * `verification_records_require_source` (0002_publication_invariants.sql)
 * validates at the end of the transaction it ran in, not at commit of a
 * lone auto-committed statement — splitting the verification-record insert
 * and the verification_record_sources insert across two separate
 * `db.insert()` calls (each its own implicit transaction) makes the
 * deferred check fire too early, before the source is linked.
 */
export async function publishOpportunityForTest(params: {
  opportunityId: string;
  officialSourceId: string;
  versionId: string;
  /** Must differ from approverStaffProfileId — the publish gate rejects a verification record approved by its own reviewer. */
  reviewerStaffProfileId: string;
  approverStaffProfileId: string;
}): Promise<void> {
  const { opportunityId, officialSourceId, versionId, reviewerStaffProfileId, approverStaffProfileId } = params;

  await db.transaction(async (tx) => {
    const [verificationRecord] = await tx
      .insert(schema.verificationRecords)
      .values({
        subjectKind: "opportunity",
        subjectId: opportunityId,
        opportunityId,
        reviewerStaffProfileId,
        approvedByStaffProfileId: approverStaffProfileId,
        outcome: "verified",
        status: "verified",
        checkedAt: new Date(),
        summary: "Test fixture verification.",
      })
      .returning();

    await tx.insert(schema.verificationRecordSources).values({ verificationRecordId: verificationRecord.id, officialSourceId });

    await tx.insert(schema.sourceEvidence).values({
      opportunityId,
      officialSourceId,
      verificationRecordId: verificationRecord.id,
      kind: "fact",
      status: "accepted",
      evidenceText: "Test fixture evidence.",
      capturedByStaffProfileId: reviewerStaffProfileId,
      approvedByStaffProfileId: approverStaffProfileId,
    });

    await tx.insert(schema.reviewAssignments).values({
      subjectKind: "opportunity",
      subjectId: opportunityId,
      opportunityId,
      subjectAuthorStaffProfileId: reviewerStaffProfileId,
      reviewerStaffProfileId: approverStaffProfileId,
      assignedByStaffProfileId: approverStaffProfileId,
      requiredRole: "reviewer",
      status: "completed",
      completedAt: new Date(),
      decision: "mark-reviewed",
    });

    await tx.update(schema.opportunityVersions).set({ reviewOutcome: "approve" }).where(eq(schema.opportunityVersions.id, versionId));

    await tx
      .update(schema.opportunities)
      .set({ status: "published", publishedAt: new Date(), currentApprovedVersionId: versionId })
      .where(eq(schema.opportunities.id, opportunityId));
  });
}

/**
 * Drizzle wraps every driver error in a `DrizzleQueryError` whose own
 * `.message` is just the query text/params — the actual Postgres error text
 * (e.g. "append-only", "official source") lives on `.cause.message`. Plain
 * `.rejects.toThrow(/pattern/)` checks only the outer message and always
 * fails, regardless of whether the right error occurred, so integration
 * tests must use this helper instead.
 */
export async function expectRejectionMatching(promise: Promise<unknown>, pattern: RegExp): Promise<void> {
  try {
    await promise;
  } catch (error) {
    const cause = (error as { cause?: unknown }).cause;
    const causeMessage = cause instanceof Error ? cause.message : String(cause ?? "");
    const fullMessage = `${(error as Error).message} ${causeMessage}`;
    if (!pattern.test(fullMessage)) {
      throw new Error(`Expected rejection to match ${pattern}, but got: ${fullMessage}`);
    }
    return;
  }
  throw new Error(`Expected the promise to reject (matching ${pattern}), but it resolved.`);
}
