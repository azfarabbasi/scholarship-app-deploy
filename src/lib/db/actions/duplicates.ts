"use server";

import { eq, notInArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { recordAuditEvent } from "@/lib/audit/log";
import { canManageDuplicates } from "@/lib/auth/permissions";
import { getStaffSession } from "@/lib/auth/session";
import { getDb, schema } from "@/lib/db/client";
import { detectDuplicatePairs } from "@/lib/duplicates/detect";
import type { ActionResult } from "./opportunities";

async function requireDuplicateManagerSession() {
  const session = await getStaffSession();
  if (!session || !canManageDuplicates(session.roles)) return null;
  return session;
}

export async function runDuplicateDetection(): Promise<ActionResult & { created?: number }> {
  const session = await requireDuplicateManagerSession();
  if (!session) return { ok: false, error: "Not permitted." };

  const db = getDb();
  const candidates = await db
    .select({
      id: schema.opportunities.id,
      title: schema.opportunities.title,
      providerId: schema.opportunities.providerId,
      applicationUrl: schema.opportunities.applicationUrl,
      officialWebsiteUrl: schema.opportunities.officialWebsiteUrl,
      legacyMigrationReference: schema.opportunities.legacyMigrationReference,
    })
    .from(schema.opportunities)
    .where(notInArray(schema.opportunities.status, ["merged", "archived", "rejected"]));

  const pairs = detectDuplicatePairs(candidates);

  const existing = await db.select().from(schema.duplicateCandidates);
  const existingKeys = new Set(
    existing.map((row) => [row.canonicalOpportunityId, row.duplicateOpportunityId].sort().join(":")),
  );

  let created = 0;
  for (const pair of pairs) {
    const key = [pair.aId, pair.bId].sort().join(":");
    if (existingKeys.has(key)) continue;

    await db.insert(schema.duplicateCandidates).values({
      canonicalOpportunityId: pair.aId,
      duplicateOpportunityId: pair.bId,
      detectionReason: pair.reason,
      confidenceScore: pair.confidenceScore.toFixed(3),
      status: "pending",
    });
    existingKeys.add(key);
    created += 1;
  }

  if (created > 0) {
    await recordAuditEvent(db, {
      actorStaffProfileId: session.staffProfileId,
      actorRole: session.roles[0] ?? null,
      action: "create",
      entityName: "duplicate_candidates",
      entityId: null,
      redactedChangeSummary: `Duplicate detection run found ${created} new candidate(s).`,
    });
  }

  revalidatePath("/staff/duplicates");
  return { ok: true, created };
}

export async function dismissDuplicateCandidate(candidateId: string, reason: string): Promise<ActionResult> {
  const session = await requireDuplicateManagerSession();
  if (!session) return { ok: false, error: "Not permitted." };

  const db = getDb();
  await db
    .update(schema.duplicateCandidates)
    .set({ status: "dismissed-false-positive", reviewedByStaffProfileId: session.staffProfileId, reviewedAt: new Date(), resolutionNotes: reason })
    .where(eq(schema.duplicateCandidates.id, candidateId));

  await recordAuditEvent(db, {
    actorStaffProfileId: session.staffProfileId,
    actorRole: session.roles[0] ?? null,
    action: "update",
    entityName: "duplicate_candidates",
    entityId: candidateId,
    reasonCode: reason,
    redactedChangeSummary: "Dismissed a duplicate candidate as a false positive.",
  });

  revalidatePath("/staff/duplicates");
  return { ok: true };
}

/**
 * Merges `duplicateOpportunityId` into `canonicalOpportunityId`: the
 * duplicate is marked `merged` (never independently published again), its
 * old slug redirects to the canonical record, and the candidate row is
 * closed out. Reversible in that the duplicate row and its full history
 * remain in the database — only its status and a redirect are added.
 */
export async function mergeDuplicates(candidateId: string, reason: string): Promise<ActionResult> {
  const session = await requireDuplicateManagerSession();
  if (!session) return { ok: false, error: "Not permitted." };

  const db = getDb();
  const [candidate] = await db.select().from(schema.duplicateCandidates).where(eq(schema.duplicateCandidates.id, candidateId));
  if (!candidate) return { ok: false, error: "Duplicate candidate not found." };

  const [duplicateOpportunity] = await db
    .select()
    .from(schema.opportunities)
    .where(eq(schema.opportunities.id, candidate.duplicateOpportunityId));
  if (!duplicateOpportunity) return { ok: false, error: "Duplicate opportunity not found." };

  await db.transaction(async (tx) => {
    await tx
      .update(schema.opportunities)
      .set({ status: "merged", mergedIntoOpportunityId: candidate.canonicalOpportunityId, updatedAt: new Date() })
      .where(eq(schema.opportunities.id, candidate.duplicateOpportunityId));

    await tx.insert(schema.opportunitySlugRedirects).values({
      oldSlug: duplicateOpportunity.slug,
      canonicalOpportunityId: candidate.canonicalOpportunityId,
      reason: `Merged duplicate: ${reason}`,
    });

    await tx
      .update(schema.duplicateCandidates)
      .set({ status: "merged", reviewedByStaffProfileId: session.staffProfileId, reviewedAt: new Date(), resolutionNotes: reason })
      .where(eq(schema.duplicateCandidates.id, candidateId));

    await recordAuditEvent(tx, {
      actorStaffProfileId: session.staffProfileId,
      actorRole: session.roles[0] ?? null,
      action: "merge",
      entityName: "opportunities",
      entityId: candidate.duplicateOpportunityId,
      reasonCode: reason,
      redactedChangeSummary: `Merged opportunity ${candidate.duplicateOpportunityId} into ${candidate.canonicalOpportunityId}.`,
    });
  });

  revalidatePath("/staff/duplicates");
  revalidatePath("/staff/opportunities");
  revalidatePath("/opportunities");
  return { ok: true };
}
