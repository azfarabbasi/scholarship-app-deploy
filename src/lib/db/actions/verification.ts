"use server";

import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { recordAuditEvent } from "@/lib/audit/log";
import { canManageDocumentsAndEligibility } from "@/lib/auth/permissions";
import { getStaffSession } from "@/lib/auth/session";
import { enableBootstrapAdminConstraintBypass } from "@/lib/db/bootstrap-admin-bypass";
import { getDb, schema } from "@/lib/db/client";
import type { ActionResult } from "./opportunities";

/**
 * Verification records and deadline cycles/occurrences had no staff UI or
 * Server Actions at all before this file — the schemas existed
 * (`src/lib/db/schema/sources.ts`, `src/lib/db/schema/deadlines.ts`) but
 * nothing let a reviewer actually create one, which meant an imported record
 * could never satisfy the stricter publish gate added in
 * `drizzle/0010_publication_integrity_actors.sql` (it requires a current,
 * non-stale, verified verification record). This is the minimum surface
 * needed to make that gate reachable, not a full verification-workflow UI.
 */

async function requireEditorSession() {
  const session = await getStaffSession();
  if (!session || !canManageDocumentsAndEligibility(session.roles)) {
    return null;
  }
  return session;
}

async function sourcesBelongToOpportunity(officialSourceIds: string[], opportunityId: string): Promise<boolean> {
  if (officialSourceIds.length === 0) return false;
  const db = getDb();
  const rows = await db
    .select({ officialSourceId: schema.opportunityOfficialSources.officialSourceId })
    .from(schema.opportunityOfficialSources)
    .where(
      and(
        eq(schema.opportunityOfficialSources.opportunityId, opportunityId),
        inArray(schema.opportunityOfficialSources.officialSourceId, officialSourceIds),
      ),
    );
  return rows.length === officialSourceIds.length;
}

async function evidenceBelongsToOpportunity(sourceEvidenceIds: string[], opportunityId: string): Promise<boolean> {
  if (sourceEvidenceIds.length === 0) return true;
  const db = getDb();
  const rows = await db
    .select({ id: schema.sourceEvidence.id })
    .from(schema.sourceEvidence)
    .where(and(eq(schema.sourceEvidence.opportunityId, opportunityId), inArray(schema.sourceEvidence.id, sourceEvidenceIds)));
  return rows.length === sourceEvidenceIds.length;
}

export interface CreateVerificationRecordInput {
  outcome: (typeof schema.verificationOutcomeEnum.enumValues)[number];
  summary: string;
  officialSourceIds: string[];
  /** Existing accepted source_evidence rows this verification confirms — linked via source_evidence.verification_record_id. */
  linkedSourceEvidenceIds?: string[];
}

/**
 * Creates a `pending` verification record for the opportunity itself
 * (`subject_kind = 'opportunity'`) and cites the given official sources —
 * the deferred constraint trigger from `0002_publication_invariants.sql`
 * requires at least one before the record could ever leave `pending`.
 * Deliberately never independently-approved at creation time — see
 * {@link approveVerificationRecord}.
 */
export async function createVerificationRecord(opportunityId: string, input: CreateVerificationRecordInput): Promise<ActionResult> {
  const session = await requireEditorSession();
  if (!session) return { ok: false, error: "Not permitted." };

  if (!(await sourcesBelongToOpportunity(input.officialSourceIds, opportunityId))) {
    return { ok: false, error: "One or more selected sources do not belong to this opportunity." };
  }
  const linkedSourceEvidenceIds = input.linkedSourceEvidenceIds ?? [];
  if (!(await evidenceBelongsToOpportunity(linkedSourceEvidenceIds, opportunityId))) {
    return { ok: false, error: "One or more selected evidence entries do not belong to this opportunity." };
  }

  const db = getDb();
  let usesBootstrapEvidenceOverride = false;
  if (session.isBootstrapAdmin && linkedSourceEvidenceIds.length > 0) {
    const [selfApprovedEvidence] = await db
      .select({ id: schema.sourceEvidence.id })
      .from(schema.sourceEvidence)
      .where(
        and(
          inArray(schema.sourceEvidence.id, linkedSourceEvidenceIds),
          eq(schema.sourceEvidence.capturedByStaffProfileId, session.staffProfileId),
          eq(schema.sourceEvidence.approvedByStaffProfileId, session.staffProfileId),
        ),
      )
      .limit(1);
    usesBootstrapEvidenceOverride = Boolean(selfApprovedEvidence);
  }

  await db.transaction(async (tx) => {
    // Linking a previously self-accepted evidence row is an UPDATE, so
    // PostgreSQL re-evaluates its self-approval CHECK. Re-scope the exact
    // verified bootstrap actor to this transaction; the exception remains
    // actor-bound and cannot affect evidence approved by anyone else.
    await enableBootstrapAdminConstraintBypass(
      tx,
      usesBootstrapEvidenceOverride ? session.staffProfileId : null,
    );
    const [record] = await tx
      .insert(schema.verificationRecords)
      .values({
        subjectKind: "opportunity",
        subjectId: opportunityId,
        opportunityId,
        reviewerStaffProfileId: session.staffProfileId,
        outcome: input.outcome,
        status: "pending",
        summary: input.summary,
      })
      .returning();

    await tx.insert(schema.verificationRecordSources).values(
      input.officialSourceIds.map((officialSourceId) => ({ verificationRecordId: record.id, officialSourceId })),
    );

    if (linkedSourceEvidenceIds.length > 0) {
      await tx
        .update(schema.sourceEvidence)
        .set({ verificationRecordId: record.id })
        .where(inArray(schema.sourceEvidence.id, linkedSourceEvidenceIds));
    }

    await recordAuditEvent(tx, {
      actorStaffProfileId: session.staffProfileId,
      actorRole: usesBootstrapEvidenceOverride ? "administrator" : (session.roles[0] ?? null),
      action: "create",
      entityName: "verification_records",
      entityId: record.id,
      redactedChangeSummary: usesBootstrapEvidenceOverride
        ? `Bootstrap administrator full-access override: linked self-accepted evidence while creating a pending verification record for opportunity ${opportunityId}.`
        : `Created a pending verification record for opportunity ${opportunityId}.`,
    });
  });

  revalidatePath(`/staff/opportunities/${opportunityId}`);
  return { ok: true, opportunityId };
}

/**
 * Independently confirms a pending verification record — the confirming
 * staff member must differ from the original reviewer (enforced here and, as
 * a hard backstop, by the `verification_records_no_self_approval` CHECK
 * constraint from Checkpoint 2). Only an `outcome: 'verified'` record can
 * reach `status: 'verified'`, the one status the publish-gate trigger
 * accepts — every other outcome is confirmed into an honest non-passing
 * status instead of a fabricated "verified".
 */
export async function approveVerificationRecord(opportunityId: string, verificationRecordId: string): Promise<ActionResult> {
  const session = await requireEditorSession();
  if (!session) return { ok: false, error: "Not permitted." };

  const db = getDb();
  const [record] = await db.select().from(schema.verificationRecords).where(eq(schema.verificationRecords.id, verificationRecordId));
  if (!record) return { ok: false, error: "Verification record not found." };
  if (record.opportunityId !== opportunityId) {
    return { ok: false, error: "That verification record does not belong to this opportunity." };
  }
  if (record.status !== "pending") return { ok: false, error: "Only a pending verification record can be confirmed." };
  const usesBootstrapOverride = record.reviewerStaffProfileId === session.staffProfileId;
  if (usesBootstrapOverride && !session.isBootstrapAdmin) {
    return { ok: false, error: "You created this verification record — a different reviewer must confirm it." };
  }

  const statusForOutcome: Record<(typeof schema.verificationOutcomeEnum.enumValues)[number], (typeof schema.verificationRecordStatusEnum.enumValues)[number]> = {
    verified: "verified",
    "partially-verified": "in-review",
    conflicting: "conflicting",
    "changes-required": "rejected",
    "unable-to-verify": "rejected",
    withdrawn: "withdrawn",
  };

  await db.transaction(async (tx) => {
    await enableBootstrapAdminConstraintBypass(tx, usesBootstrapOverride ? session.staffProfileId : null);
    await tx
      .update(schema.verificationRecords)
      .set({ status: statusForOutcome[record.outcome], approvedByStaffProfileId: session.staffProfileId })
      .where(eq(schema.verificationRecords.id, verificationRecordId));

    await recordAuditEvent(tx, {
      actorStaffProfileId: session.staffProfileId,
      actorRole: usesBootstrapOverride ? "administrator" : (session.roles[0] ?? null),
      action: "approve",
      entityName: "verification_records",
      entityId: verificationRecordId,
      redactedChangeSummary: usesBootstrapOverride
        ? `Bootstrap administrator full-access override: confirmed verification record ${verificationRecordId}.`
        : `Confirmed verification record ${verificationRecordId} for opportunity ${opportunityId}.`,
    });
  });

  revalidatePath(`/staff/opportunities/${opportunityId}`);
  return { ok: true, opportunityId };
}

export interface CreateDeadlineCycleInput {
  cycleLabel?: string;
  cycleYear?: number;
  recurrenceCadence: (typeof schema.deadlineRecurrenceCadenceEnum.enumValues)[number];
  recurrenceDocumentedBySource: boolean;
  recurrenceSourceText?: string;
}

/** Creates a `draft` application cycle. See `docs/checkpoint-0/deadline-intelligence-spec.md` for the cycle/occurrence model. */
export async function createDeadlineCycle(opportunityId: string, input: CreateDeadlineCycleInput): Promise<ActionResult> {
  const session = await requireEditorSession();
  if (!session) return { ok: false, error: "Not permitted." };

  const db = getDb();
  const [cycle] = await db
    .insert(schema.deadlineCycles)
    .values({
      opportunityId,
      cycleLabel: input.cycleLabel || null,
      cycleYear: input.cycleYear ?? null,
      recurrenceCadence: input.recurrenceCadence,
      recurrenceDocumentedBySource: input.recurrenceDocumentedBySource,
      recurrenceSourceText: input.recurrenceSourceText || null,
      status: "draft",
    })
    .returning();

  await recordAuditEvent(db, {
    actorStaffProfileId: session.staffProfileId,
    actorRole: session.roles[0] ?? null,
    action: "create",
    entityName: "deadline_cycles",
    entityId: cycle.id,
    redactedChangeSummary: `Created a draft deadline cycle for opportunity ${opportunityId}.`,
  });

  revalidatePath(`/staff/opportunities/${opportunityId}`);
  return { ok: true, opportunityId };
}

/** Promotes a draft cycle to `active`, making it eligible to feed the public deadline evaluator. */
export async function activateDeadlineCycle(opportunityId: string, deadlineCycleId: string): Promise<ActionResult> {
  const session = await requireEditorSession();
  if (!session) return { ok: false, error: "Not permitted." };

  const db = getDb();
  const [cycle] = await db.select().from(schema.deadlineCycles).where(eq(schema.deadlineCycles.id, deadlineCycleId));
  if (!cycle || cycle.opportunityId !== opportunityId) {
    return { ok: false, error: "That deadline cycle does not belong to this opportunity." };
  }
  if (cycle.status !== "draft") return { ok: false, error: "Only a draft deadline cycle can be activated." };
  await db.update(schema.deadlineCycles).set({ status: "active" }).where(eq(schema.deadlineCycles.id, deadlineCycleId));

  await recordAuditEvent(db, {
    actorStaffProfileId: session.staffProfileId,
    actorRole: session.roles[0] ?? null,
    action: "update",
    entityName: "deadline_cycles",
    entityId: deadlineCycleId,
    redactedChangeSummary: `Activated deadline cycle ${deadlineCycleId}.`,
  });

  revalidatePath(`/staff/opportunities/${opportunityId}`);
  return { ok: true, opportunityId };
}

export interface CreateDeadlineOccurrenceInput {
  deadlineCycleId: string;
  role: (typeof schema.deadlineRoleEnum.enumValues)[number];
  precision: (typeof schema.deadlinePrecisionEnum.enumValues)[number];
  openingDate?: string;
  closingDate?: string;
  rawText: string;
  sourceTimezone?: string;
  verificationStatus: (typeof schema.deadlineVerificationStatusEnum.enumValues)[number];
}

/**
 * Creates a `draft` occurrence within a cycle. `precision`/date combinations
 * that would fabricate a date for an uncertain deadline are rejected by the
 * database's own CHECK constraints
 * (`deadline_occurrences_no_fabricated_dates` / `_exact_requires_date`) —
 * this action does not duplicate that logic, it just surfaces whatever the
 * database itself rejects.
 */
export async function createDeadlineOccurrence(opportunityId: string, input: CreateDeadlineOccurrenceInput): Promise<ActionResult> {
  const session = await requireEditorSession();
  if (!session) return { ok: false, error: "Not permitted." };

  const db = getDb();
  const [cycle] = await db.select().from(schema.deadlineCycles).where(eq(schema.deadlineCycles.id, input.deadlineCycleId));
  if (!cycle || cycle.opportunityId !== opportunityId) {
    return { ok: false, error: "That deadline cycle does not belong to this opportunity." };
  }

  try {
    await db.insert(schema.deadlineOccurrences).values({
      deadlineCycleId: input.deadlineCycleId,
      role: input.role,
      precision: input.precision,
      openingDate: input.openingDate || null,
      closingDate: input.closingDate || null,
      rawText: input.rawText,
      sourceTimezone: input.sourceTimezone || null,
      verificationStatus: input.verificationStatus,
      status: "draft",
    });
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Could not create the deadline occurrence." };
  }

  await recordAuditEvent(db, {
    actorStaffProfileId: session.staffProfileId,
    actorRole: session.roles[0] ?? null,
    action: "create",
    entityName: "deadline_occurrences",
    entityId: input.deadlineCycleId,
    redactedChangeSummary: `Created a draft deadline occurrence for opportunity ${opportunityId}.`,
  });

  revalidatePath(`/staff/opportunities/${opportunityId}`);
  return { ok: true, opportunityId };
}

/** Promotes a draft occurrence to `active`, making it eligible to feed the public deadline evaluator. */
export async function activateDeadlineOccurrence(opportunityId: string, deadlineOccurrenceId: string): Promise<ActionResult> {
  const session = await requireEditorSession();
  if (!session) return { ok: false, error: "Not permitted." };

  const db = getDb();
  const [occurrence] = await db
    .select({ status: schema.deadlineOccurrences.status, opportunityId: schema.deadlineCycles.opportunityId })
    .from(schema.deadlineOccurrences)
    .innerJoin(schema.deadlineCycles, eq(schema.deadlineCycles.id, schema.deadlineOccurrences.deadlineCycleId))
    .where(eq(schema.deadlineOccurrences.id, deadlineOccurrenceId));
  if (!occurrence || occurrence.opportunityId !== opportunityId) {
    return { ok: false, error: "That deadline occurrence does not belong to this opportunity." };
  }
  if (occurrence.status !== "draft") {
    return { ok: false, error: "Only a draft deadline occurrence can be activated." };
  }
  await db.update(schema.deadlineOccurrences).set({ status: "active" }).where(eq(schema.deadlineOccurrences.id, deadlineOccurrenceId));

  await recordAuditEvent(db, {
    actorStaffProfileId: session.staffProfileId,
    actorRole: session.roles[0] ?? null,
    action: "update",
    entityName: "deadline_occurrences",
    entityId: deadlineOccurrenceId,
    redactedChangeSummary: `Activated deadline occurrence ${deadlineOccurrenceId}.`,
  });

  revalidatePath(`/staff/opportunities/${opportunityId}`);
  return { ok: true, opportunityId };
}
