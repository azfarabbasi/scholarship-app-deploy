"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { recordAuditEvent } from "@/lib/audit/log";
import { canAssignReviewers } from "@/lib/auth/permissions";
import { getStaffSession } from "@/lib/auth/session";
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

  if (reviewerStaffProfileId === opportunity.createdByStaffProfileId) {
    return { ok: false, error: "The author of this draft cannot be assigned as its independent reviewer." };
  }

  const [assignment] = await db
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
      dueAt: dueAt ? new Date(dueAt) : null,
    })
    .returning();

  await recordAuditEvent(db, {
    actorStaffProfileId: session.staffProfileId,
    actorRole: session.roles[0] ?? null,
    action: "assign",
    entityName: "review_assignments",
    entityId: assignment.id,
    redactedChangeSummary: `Assigned a reviewer to opportunity ${opportunityId}.`,
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

  await db
    .update(schema.reviewAssignments)
    .set({ status: "accepted" })
    .where(eq(schema.reviewAssignments.id, assignmentId));

  revalidatePath("/staff/reviews");
  return { ok: true };
}
