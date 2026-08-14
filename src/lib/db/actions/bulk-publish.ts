"use server";

import { and, eq, inArray, ne } from "drizzle-orm";
import { getStaffSession } from "@/lib/auth/session";
import { getDb, schema } from "@/lib/db/client";
import { confirmOfficialSource, acceptSourceEvidence } from "@/lib/db/actions/opportunity-relations";
import { createVerificationRecord, approveVerificationRecord } from "@/lib/db/actions/verification";
import { submitForReview, markOpportunityReviewed, approveOpportunity, publishOpportunity } from "@/lib/db/actions/opportunities";
import type { OpportunityWorkflowStatus } from "@/lib/workflow/opportunity-workflow";

export interface BulkPublishResult {
  opportunityId: string;
  title: string;
  ok: boolean;
  error?: string;
}

/** How many opportunities to process at once. Bounded well under the DB pool's max connections (10). */
const CONCURRENCY = 4;
/** Safety cap so a workflow bug can never spin forever instead of just failing loudly. */
const MAX_TRANSITION_STEPS = 6;

async function currentStatus(opportunityId: string): Promise<OpportunityWorkflowStatus | null> {
  const db = getDb();
  const [row] = await db.select({ status: schema.opportunities.status }).from(schema.opportunities).where(eq(schema.opportunities.id, opportunityId));
  return row?.status ?? null;
}

/**
 * Publishes one draft: confirms its official source(s), accepts its
 * evidence, ensures a verified verification record exists, then walks the
 * workflow one transition at a time — re-reading the opportunity's actual
 * status from the database before every single transition, rather than
 * trusting a status a previous step claimed to reach. Trusting an
 * in-memory status across awaited steps was the bug that let two records
 * silently no-op at "submit for review" while still reporting success.
 */
async function publishOne(opportunityId: string, title: string, verificationSummary: string): Promise<BulkPublishResult> {
  const db = getDb();
  try {
    const candidateSources = await db
      .select({ id: schema.officialSources.id })
      .from(schema.opportunityOfficialSources)
      .innerJoin(schema.officialSources, eq(schema.officialSources.id, schema.opportunityOfficialSources.officialSourceId))
      .where(and(eq(schema.opportunityOfficialSources.opportunityId, opportunityId), eq(schema.officialSources.status, "candidate")));
    for (const source of candidateSources) {
      const r = await confirmOfficialSource(opportunityId, source.id, new Date().toISOString().slice(0, 10));
      if (!r.ok) throw new Error(r.error ?? "Could not confirm official source.");
    }

    const capturedEvidence = await db
      .select({ id: schema.sourceEvidence.id })
      .from(schema.sourceEvidence)
      .where(and(eq(schema.sourceEvidence.opportunityId, opportunityId), eq(schema.sourceEvidence.status, "captured")));
    for (const evidence of capturedEvidence) {
      const r = await acceptSourceEvidence(opportunityId, evidence.id);
      if (!r.ok) throw new Error(r.error ?? "Could not accept source evidence.");
    }

    const [existingVerified] = await db
      .select({ id: schema.verificationRecords.id })
      .from(schema.verificationRecords)
      .where(and(eq(schema.verificationRecords.opportunityId, opportunityId), eq(schema.verificationRecords.status, "verified")));

    if (!existingVerified) {
      const confirmedSources = await db
        .select({ id: schema.officialSources.id })
        .from(schema.opportunityOfficialSources)
        .innerJoin(schema.officialSources, eq(schema.officialSources.id, schema.opportunityOfficialSources.officialSourceId))
        .where(and(eq(schema.opportunityOfficialSources.opportunityId, opportunityId), ne(schema.officialSources.status, "candidate")));
      const acceptedEvidence = await db
        .select({ id: schema.sourceEvidence.id })
        .from(schema.sourceEvidence)
        .where(and(eq(schema.sourceEvidence.opportunityId, opportunityId), eq(schema.sourceEvidence.status, "accepted")));

      const [pending] = await db
        .select({ id: schema.verificationRecords.id })
        .from(schema.verificationRecords)
        .where(and(eq(schema.verificationRecords.opportunityId, opportunityId), eq(schema.verificationRecords.status, "pending")));

      let recordId = pending?.id;
      if (!recordId) {
        const created = await createVerificationRecord(opportunityId, {
          outcome: "verified",
          summary: verificationSummary,
          officialSourceIds: confirmedSources.map((s) => s.id),
          linkedSourceEvidenceIds: acceptedEvidence.map((e) => e.id),
        });
        if (!created.ok) throw new Error(created.error ?? "Could not create verification record.");
        const [row] = await db
          .select({ id: schema.verificationRecords.id })
          .from(schema.verificationRecords)
          .where(and(eq(schema.verificationRecords.opportunityId, opportunityId), eq(schema.verificationRecords.status, "pending")));
        recordId = row?.id;
      }
      if (!recordId) throw new Error("Could not locate the pending verification record after creating it.");

      const approved = await approveVerificationRecord(opportunityId, recordId);
      if (!approved.ok) throw new Error(approved.error ?? "Could not confirm verification record.");
    }

    for (let step = 0; step < MAX_TRANSITION_STEPS; step += 1) {
      const status = await currentStatus(opportunityId);
      if (status === "published") break;
      if (status === null) throw new Error("Opportunity disappeared mid-publish.");

      const transitionResult =
        status === "draft"
          ? await submitForReview(opportunityId)
          : status === "in_review"
            ? await markOpportunityReviewed(opportunityId)
            : status === "reviewed"
              ? await approveOpportunity(opportunityId)
              : status === "approved" || status === "scheduled"
                ? await publishOpportunity(opportunityId)
                : null;

      if (transitionResult === null) {
        throw new Error(`No publish path from status "${status}".`);
      }
      if (!transitionResult.ok) {
        throw new Error(transitionResult.error ?? `Could not advance past status "${status}".`);
      }
    }

    const finalStatus = await currentStatus(opportunityId);
    if (finalStatus !== "published") {
      throw new Error(`Stuck at status "${finalStatus}" after ${MAX_TRANSITION_STEPS} steps.`);
    }

    return { opportunityId, title, ok: true };
  } catch (error) {
    return { opportunityId, title, ok: false, error: error instanceof Error ? error.message : "Unknown error." };
  }
}

/**
 * Publishes every selected draft using the exact same actions the
 * per-opportunity review UI calls — no shortcuts, no direct status writes.
 * Every promote/verify/review step still goes through its normal permission
 * and separation-of-duties checks; the only reason this can complete
 * unattended is the self-review exception (`ALLOW_ADMIN_SELF_REVIEW`), so it
 * only runs for an administrator session and fails loudly (per-record, not
 * silently) for anyone else.
 *
 * Never bypasses `app.enforce_opportunity_publication_requirements()` — a
 * record that genuinely can't satisfy it still fails at the `publish` step
 * and is reported as such. Runs a bounded number of opportunities
 * concurrently rather than one at a time.
 */
export async function bulkPublishDrafts(
  opportunityIds: string[],
  verificationSummary: string,
): Promise<{ ok: boolean; error?: string; results?: BulkPublishResult[] }> {
  const session = await getStaffSession();
  if (!session) return { ok: false, error: "Not permitted." };
  if (!session.isBootstrapAdmin) {
    return {
      ok: false,
      error: "Bulk publish requires the self-review exception (ALLOW_ADMIN_SELF_REVIEW) and an administrator session.",
    };
  }
  if (!verificationSummary.trim()) {
    return { ok: false, error: "A verification summary is required." };
  }
  if (opportunityIds.length === 0) {
    return { ok: false, error: "No opportunities selected." };
  }

  const db = getDb();
  const opportunities = await db
    .select({ id: schema.opportunities.id, title: schema.opportunities.title })
    .from(schema.opportunities)
    .where(inArray(schema.opportunities.id, opportunityIds));
  const titleById = new Map(opportunities.map((o) => [o.id, o.title]));

  const results: BulkPublishResult[] = [];
  for (let i = 0; i < opportunityIds.length; i += CONCURRENCY) {
    const batch = opportunityIds.slice(i, i + CONCURRENCY);
    const batchResults = await Promise.all(
      batch.map((id) => publishOne(id, titleById.get(id) ?? "(unknown)", verificationSummary)),
    );
    results.push(...batchResults);
  }

  const anyOk = results.some((r) => r.ok);
  return { ok: anyOk, results };
}
