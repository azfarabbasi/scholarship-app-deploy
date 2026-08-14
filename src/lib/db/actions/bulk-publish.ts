"use server";

import { and, eq, inArray, ne } from "drizzle-orm";
import { getStaffSession } from "@/lib/auth/session";
import { getDb, schema } from "@/lib/db/client";
import { confirmOfficialSource, acceptSourceEvidence } from "@/lib/db/actions/opportunity-relations";
import { createVerificationRecord, approveVerificationRecord } from "@/lib/db/actions/verification";
import { submitForReview, markOpportunityReviewed, approveOpportunity, publishOpportunity } from "@/lib/db/actions/opportunities";

export interface BulkPublishResult {
  opportunityId: string;
  title: string;
  ok: boolean;
  error?: string;
}

/**
 * Walks each selected draft through the real publication pipeline using the
 * exact same actions the per-opportunity review UI calls — no shortcuts, no
 * direct status writes. Every promote/verify/review step still goes through
 * its normal permission and separation-of-duties checks; the only reason
 * this can complete unattended is the audited bootstrap-admin exception
 * (`ALLOW_ADMIN_SELF_REVIEW`), so it only runs for the bootstrap admin
 * session and fails loudly (per-record, not silently) for anyone else.
 *
 * Never bypasses `app.enforce_opportunity_publication_requirements()` — a
 * record that genuinely can't satisfy it (e.g. missing evidence) still
 * fails at the `publish` step and is reported as such.
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
      error:
        "Bulk publish requires the bootstrap administrator account (the one matching BOOTSTRAP_ADMIN_EMAIL) — sign in as that account and try again.",
    };
  }
  if (!verificationSummary.trim()) {
    return { ok: false, error: "A verification summary is required." };
  }
  if (opportunityIds.length === 0) {
    return { ok: false, error: "No opportunities selected." };
  }

  const db = getDb();
  const results: BulkPublishResult[] = [];

  for (const opportunityId of opportunityIds) {
    const [opportunity] = await db
      .select({ id: schema.opportunities.id, title: schema.opportunities.title, status: schema.opportunities.status })
      .from(schema.opportunities)
      .where(eq(schema.opportunities.id, opportunityId));

    if (!opportunity) {
      results.push({ opportunityId, title: "(unknown)", ok: false, error: "Opportunity not found." });
      continue;
    }

    try {
      // 1. Confirm every candidate official source.
      const candidateSources = await db
        .select({ id: schema.officialSources.id })
        .from(schema.opportunityOfficialSources)
        .innerJoin(schema.officialSources, eq(schema.officialSources.id, schema.opportunityOfficialSources.officialSourceId))
        .where(and(eq(schema.opportunityOfficialSources.opportunityId, opportunityId), eq(schema.officialSources.status, "candidate")));
      for (const source of candidateSources) {
        const r = await confirmOfficialSource(opportunityId, source.id, new Date().toISOString().slice(0, 10));
        if (!r.ok) throw new Error(r.error ?? "Could not confirm official source.");
      }

      // 2. Accept every captured evidence row.
      const capturedEvidence = await db
        .select({ id: schema.sourceEvidence.id })
        .from(schema.sourceEvidence)
        .where(and(eq(schema.sourceEvidence.opportunityId, opportunityId), eq(schema.sourceEvidence.status, "captured")));
      for (const evidence of capturedEvidence) {
        const r = await acceptSourceEvidence(opportunityId, evidence.id);
        if (!r.ok) throw new Error(r.error ?? "Could not accept source evidence.");
      }

      // 3. Ensure a verified verification record exists.
      const [existingVerified] = await db
        .select({ id: schema.verificationRecords.id })
        .from(schema.verificationRecords)
        .where(and(eq(schema.verificationRecords.opportunityId, opportunityId), eq(schema.verificationRecords.status, "verified")));

      if (!existingVerified) {
        const confirmedSources = await db
          .select({ id: schema.officialSources.id })
          .from(schema.opportunityOfficialSources)
          .innerJoin(schema.officialSources, eq(schema.officialSources.id, schema.opportunityOfficialSources.officialSourceId))
          .where(
            and(
              eq(schema.opportunityOfficialSources.opportunityId, opportunityId),
              ne(schema.officialSources.status, "candidate"),
            ),
          );
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

      // 4. Walk the workflow: draft -> in_review -> reviewed -> approved -> published.
      let status = opportunity.status;
      if (status === "draft") {
        const r = await submitForReview(opportunityId);
        if (!r.ok) throw new Error(r.error ?? "Could not submit for review.");
        status = "in_review";
      }
      if (status === "in_review") {
        const r = await markOpportunityReviewed(opportunityId);
        if (!r.ok) throw new Error(r.error ?? "Could not mark reviewed.");
        status = "reviewed";
      }
      if (status === "reviewed") {
        const r = await approveOpportunity(opportunityId);
        if (!r.ok) throw new Error(r.error ?? "Could not approve.");
        status = "approved";
      }
      if (status === "approved" || status === "scheduled") {
        const r = await publishOpportunity(opportunityId);
        if (!r.ok) throw new Error(r.error ?? "Could not publish.");
      }

      results.push({ opportunityId, title: opportunity.title, ok: true });
    } catch (error) {
      results.push({
        opportunityId,
        title: opportunity.title,
        ok: false,
        error: error instanceof Error ? error.message : "Unknown error.",
      });
    }
  }

  const anyOk = results.some((r) => r.ok);
  return { ok: anyOk, results };
}
