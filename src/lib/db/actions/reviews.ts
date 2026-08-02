"use server";

import { and, eq, inArray, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { recordAuditEvent } from "@/lib/audit/log";
import { canAssignReviewers } from "@/lib/auth/permissions";
import { getStaffSession } from "@/lib/auth/session";
import { enableBootstrapAdminConstraintBypass } from "@/lib/db/bootstrap-admin-bypass";
import { getDb, schema } from "@/lib/db/client";
import type { ActionResult } from "./opportunities";

export async function assignReviewer(
  opportunityId: string,
  reviewerStaffProfileId: string,
  dueAt?: string,
): Promise<ActionResult> {
  const session = await getStaffSession();
  if (!session || !canAssignReviewers(session.roles)) {
    return { ok: false, error: "You are not permitted to assign reviewers." };
  }

  const db = getDb();
  const [opportunity] = await db.select().from(schema.opportunities).where(eq(schema.opportunities.id, opportunityId));
  if (!opportunity) return { ok: false, error: "Opportunity not found." };
  if (opportunity.status !== "in_review") {
    return { ok: false, error: "Reviewers can only be assigned while an opportunity is in review." };
  }
  const parsedDueAt = dueAt ? new Date(dueAt) : null;
  if (parsedDueAt && Number.isNaN(parsedDueAt.getTime())) {
    return { ok: false, error: "The review due date is invalid." };
  }

  const usesBootstrapOverride =
    session.isBootstrapAdmin && reviewerStaffProfileId === session.staffProfileId;
  if (reviewerStaffProfileId === opportunity.createdByStaffProfileId && !usesBootstrapOverride) {
    return { ok: false, error: "The author of this draft cannot be assigned as its independent reviewer." };
  }

  const [eligibleReviewerRole] = await db
    .select({ staffProfileId: schema.staffRoleAssignments.staffProfileId })
    .from(schema.staffRoleAssignments)
    .innerJoin(schema.staffProfiles, eq(schema.staffProfiles.id, schema.staffRoleAssignments.staffProfileId))
    .where(
      and(
        eq(schema.staffRoleAssignments.staffProfileId, reviewerStaffProfileId),
        isNull(schema.staffRoleAssignments.revokedAt),
        inArray(schema.staffRoleAssignments.role, ["reviewer", "senior_reviewer"]),
        eq(schema.staffProfiles.status, "active"),
      ),
    )
    .limit(1);
  if (!eligibleReviewerRole && !usesBootstrapOverride) {
    return { ok: false, error: "The selected account is not an active reviewer." };
  }

  const [activeAssignment] = await db
    .select({ id: schema.reviewAssignments.id })
    .from(schema.reviewAssignments)
    .where(
      and(
        eq(schema.reviewAssignments.subjectKind, "opportunity"),
        eq(schema.reviewAssignments.subjectId, opportunityId),
        inArray(schema.reviewAssignments.status, ["queued", "assigned", "accepted", "in-review"]),
      ),
    )
    .limit(1);
  if (activeAssignment) return { ok: false, error: "This opportunity already has an active review assignment." };

  await db.transaction(async (tx) => {
    await enableBootstrapAdminConstraintBypass(tx, usesBootstrapOverride ? session.staffProfileId : null);
    const [assignment] = await tx
      .insert(schema.reviewAssignments)
      .values({
        subjectKind: "opportunity",
        subjectId: opportunityId,
        opportunityId,
        subjectAuthorStaffProfileId: opportunity.createdByStaffProfileId,
        reviewerStaffProfileId,
        assignedByStaffProfileId: session.staffProfileId,
        requiredRole: "reviewer",
        status: "assigned",
        dueAt: parsedDueAt,
      })
      .returning();

    await recordAuditEvent(tx, {
      actorStaffProfileId: session.staffProfileId,
      actorRole: usesBootstrapOverride ? "administrator" : (session.roles[0] ?? null),
      action: "assign",
      entityName: "review_assignments",
      entityId: assignment.id,
      redactedChangeSummary: usesBootstrapOverride
        ? `Bootstrap administrator full-access override: self-assigned opportunity ${opportunityId}.`
        : `Assigned a reviewer to opportunity ${opportunityId}.`,
    });
  });

  revalidatePath("/staff/assignments");
  revalidatePath("/staff/reviews");
  return { ok: true, opportunityId };
}

export async function acceptReviewAssignment(assignmentId: string): Promise<ActionResult> {
  const session = await getStaffSession();
  if (!session) return { ok: false, error: "Not signed in." };

  const db = getDb();
  const [assignment] = await db.select().from(schema.reviewAssignments).where(eq(schema.reviewAssignments.id, assignmentId));
  if (!assignment) return { ok: false, error: "Assignment not found." };
  if (assignment.reviewerStaffProfileId !== session.staffProfileId) {
    return { ok: false, error: "This assignment belongs to a different reviewer." };
  }
  if (assignment.status !== "assigned" && assignment.status !== "queued") {
    return { ok: false, error: "Only a queued or assigned review can be accepted." };
  }
  if (
    !session.isBootstrapAdmin &&
    !session.roles.includes("reviewer") &&
    !session.roles.includes("senior_reviewer")
  ) {
    return { ok: false, error: "Your account is not permitted to accept review assignments." };
  }

  const usesBootstrapOverride =
    session.isBootstrapAdmin && assignment.subjectAuthorStaffProfileId === session.staffProfileId;

  await db.transaction(async (tx) => {
    // A self-assignment was inserted under the same transaction-local
    // exception. PostgreSQL re-evaluates CHECK constraints on UPDATE, so the
    // exact bootstrap actor must be scoped into this later accept transaction
    // as well; otherwise the manual self-assign -> accept path fails even
    // though the one-click review path succeeds.
    await enableBootstrapAdminConstraintBypass(
      tx,
      usesBootstrapOverride ? session.staffProfileId : null,
    );
    await tx
      .update(schema.reviewAssignments)
      .set({ status: "accepted" })
      .where(eq(schema.reviewAssignments.id, assignmentId));

    await recordAuditEvent(tx, {
      actorStaffProfileId: session.staffProfileId,
      actorRole: session.isBootstrapAdmin ? "administrator" : (session.roles[0] ?? null),
      action: "update",
      entityName: "review_assignments",
      entityId: assignmentId,
      redactedChangeSummary: usesBootstrapOverride
        ? "Bootstrap administrator full-access override: accepted a self-review assignment."
        : "Reviewer accepted a review assignment.",
    });
  });

  revalidatePath("/staff/reviews");
  return { ok: true };
}
