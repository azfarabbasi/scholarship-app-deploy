"use server";

import { randomUUID } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getStaffSession } from "@/lib/auth/session";
import {
  canApprove,
  canArchive,
  canCreateDraft,
  canEditDraft,
  canPublish,
  canReview,
  canRestore,
  isAdministratorOverride,
} from "@/lib/auth/permissions";
import { recordAuditEvent } from "@/lib/audit/log";
import { enableBootstrapAdminConstraintBypass } from "@/lib/db/bootstrap-admin-bypass";
import { getDb, schema } from "@/lib/db/client";
import {
  isValidTransition,
  nextStatusFor,
  type WorkflowTransition,
} from "@/lib/workflow/opportunity-workflow";

export interface ActionResult {
  ok: boolean;
  error?: string;
  opportunityId?: string;
}

async function requireSession() {
  const session = await getStaffSession();
  if (!session) {
    return null;
  }
  return session;
}

function slugify(title: string): string {
  const base = title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base.length > 0 ? base : `opportunity-${randomUUID().slice(0, 8)}`;
}

async function uniqueSlug(title: string, ignoreId?: string): Promise<string> {
  const db = getDb();
  const base = slugify(title);
  const existing = await db.select({ slug: schema.opportunities.slug, id: schema.opportunities.id }).from(schema.opportunities);
  const taken = new Set(existing.filter((row) => row.id !== ignoreId).map((row) => row.slug));
  if (!taken.has(base)) return base;
  let counter = 2;
  while (taken.has(`${base}-${counter}`)) counter += 1;
  return `${base}-${counter}`;
}

async function snapshotOpportunity(opportunityId: string) {
  const db = getDb();
  const [opportunity] = await db.select().from(schema.opportunities).where(eq(schema.opportunities.id, opportunityId));
  return opportunity ?? null;
}

async function nextVersionNumber(opportunityId: string): Promise<number> {
  const db = getDb();
  const versions = await db
    .select({ versionNumber: schema.opportunityVersions.versionNumber })
    .from(schema.opportunityVersions)
    .where(eq(schema.opportunityVersions.opportunityId, opportunityId));
  return versions.reduce((max, v) => Math.max(max, v.versionNumber), 0) + 1;
}

export interface CreateOpportunityInput {
  title: string;
  summary: string;
  description: string | null;
  opportunityTypeId: string;
  providerId: string;
  applicationUrl: string | null;
  officialWebsiteUrl: string | null;
}

export async function createOpportunityDraft(input: CreateOpportunityInput): Promise<ActionResult> {
  const session = await requireSession();
  if (!session) return { ok: false, error: "Not signed in." };
  if (!canCreateDraft(session.roles)) return { ok: false, error: "You are not permitted to create opportunity drafts." };

  const db = getDb();
  const slug = await uniqueSlug(input.title);

  const [created] = await db
    .insert(schema.opportunities)
    .values({
      slug,
      title: input.title,
      summary: input.summary,
      description: input.description,
      opportunityTypeId: input.opportunityTypeId,
      providerId: input.providerId,
      applicationUrl: input.applicationUrl,
      officialWebsiteUrl: input.officialWebsiteUrl,
      status: "draft",
      createdByStaffProfileId: session.staffProfileId,
      updatedByStaffProfileId: session.staffProfileId,
    })
    .returning();

  await recordAuditEvent(db, {
    actorStaffProfileId: session.staffProfileId,
    actorRole: session.roles[0] ?? null,
    action: "create",
    entityName: "opportunities",
    entityId: created.id,
    redactedChangeSummary: `Created draft "${input.title}".`,
  });

  revalidatePath("/staff/opportunities");
  return { ok: true, opportunityId: created.id };
}

export interface UpdateOpportunityInput extends CreateOpportunityInput {
  changeReason: string;
}

export async function updateOpportunityDraft(opportunityId: string, input: UpdateOpportunityInput): Promise<ActionResult> {
  const session = await requireSession();
  if (!session) return { ok: false, error: "Not signed in." };

  const db = getDb();
  const opportunity = await snapshotOpportunity(opportunityId);
  if (!opportunity) return { ok: false, error: "Opportunity not found." };

  const isOwnerOrAssigned = opportunity.createdByStaffProfileId === session.staffProfileId;
  if (!canEditDraft(session.roles, isOwnerOrAssigned || session.roles.includes("administrator"))) {
    return { ok: false, error: "You are not permitted to edit this record." };
  }

  // A previous version of this action wrote directly to the live row
  // regardless of status, so a published (or in-review/reviewed/approved/
  // scheduled) record's title/summary/description/URLs could be silently
  // overwritten with no new review — this is exactly the "changes to
  // published content must create a new revision and repeat review"
  // invariant the launch audit flagged as missing. Editing content that has
  // already left the draft stage requires taking it through the workflow
  // (request-changes, or archive + recreate) rather than a direct write.
  if (opportunity.status !== "draft" && opportunity.status !== "changes_requested") {
    const canRequestChangesFromHere = opportunity.status === "in_review" || opportunity.status === "reviewed";
    return {
      ok: false,
      error: canRequestChangesFromHere
        ? `This record is "${opportunity.status}" and can no longer be edited directly. Use "Request changes" to send it back to "changes_requested" first.`
        : `This record is "${opportunity.status}" and can no longer be edited directly — editing content that has already been approved or published requires a formal revision workflow, which is not yet built. Archive and recreate the record if a correction is genuinely needed.`,
    };
  }

  const slug = input.title === opportunity.title ? opportunity.slug : await uniqueSlug(input.title, opportunityId);

  await db.transaction(async (tx) => {
    await tx
      .update(schema.opportunities)
      .set({
        slug,
        title: input.title,
        summary: input.summary,
        description: input.description,
        opportunityTypeId: input.opportunityTypeId,
        providerId: input.providerId,
        applicationUrl: input.applicationUrl,
        officialWebsiteUrl: input.officialWebsiteUrl,
        updatedByStaffProfileId: session.staffProfileId,
        updatedAt: new Date(),
      })
      .where(eq(schema.opportunities.id, opportunityId));

    const versionNumber = await nextVersionNumber(opportunityId);
    await tx.insert(schema.opportunityVersions).values({
      opportunityId,
      versionNumber,
      snapshot: { ...opportunity, ...input },
      changeReason: input.changeReason,
      authorStaffProfileId: session.staffProfileId,
    });

    await recordAuditEvent(tx, {
      actorStaffProfileId: session.staffProfileId,
      actorRole: session.roles[0] ?? null,
      action: "update",
      entityName: "opportunities",
      entityId: opportunityId,
      reasonCode: input.changeReason,
      redactedChangeSummary: `Edited "${input.title}".`,
    });
  });

  revalidatePath(`/staff/opportunities/${opportunityId}`);
  return { ok: true, opportunityId };
}

interface TransitionOptions {
  reason?: string;
  overrideReason?: string;
}

async function runTransition(
  opportunityId: string,
  transition: WorkflowTransition,
  options: TransitionOptions = {},
): Promise<ActionResult> {
  const session = await requireSession();
  if (!session) return { ok: false, error: "Not signed in." };

  const db = getDb();
  const opportunity = await snapshotOpportunity(opportunityId);
  if (!opportunity) return { ok: false, error: "Opportunity not found." };

  if (!isValidTransition(opportunity.status, transition)) {
    return { ok: false, error: `Cannot ${transition} from status "${opportunity.status}".` };
  }

  const authorId = opportunity.createdByStaffProfileId;
  const selfReviewOptions = { bypassSeparationOfDuties: session.isBootstrapAdmin };
  let permitted = false;
  let isOverride = false;
  let usedBootstrapAdminAccess = false;
  let requiresAcceptedReviewerAssignment = false;

  switch (transition) {
    case "submit-for-review":
    case "resubmit":
      permitted = canEditDraft(session.roles, authorId === session.staffProfileId || session.roles.includes("administrator"));
      break;
    case "request-changes":
    case "mark-reviewed": {
      const ordinarilyPermitted = canReview(session.roles, session.staffProfileId, authorId);
      permitted = canReview(session.roles, session.staffProfileId, authorId, selfReviewOptions);
      usedBootstrapAdminAccess = permitted && !ordinarilyPermitted;
      requiresAcceptedReviewerAssignment = permitted && !session.isBootstrapAdmin;
      break;
    }
    case "approve": {
      const ordinarilyPermitted = canApprove(session.roles, session.staffProfileId, authorId);
      permitted = canApprove(session.roles, session.staffProfileId, authorId, selfReviewOptions);
      usedBootstrapAdminAccess = permitted && !ordinarilyPermitted;
      if (!permitted && isAdministratorOverride(session.roles, options.overrideReason)) {
        permitted = true;
        isOverride = true;
      }
      break;
    }
    case "schedule":
    case "publish":
      permitted = canPublish(session.roles);
      break;
    case "archive":
      permitted = canArchive(session.roles);
      break;
    case "restore":
      permitted = canRestore(session.roles);
      break;
    case "reject": {
      const reviewPermitted = canReview(session.roles, session.staffProfileId, authorId, selfReviewOptions);
      const approvalPermitted = canApprove(session.roles, session.staffProfileId, authorId, selfReviewOptions);
      const ordinarilyPermitted =
        canReview(session.roles, session.staffProfileId, authorId) ||
        canApprove(session.roles, session.staffProfileId, authorId);
      permitted = reviewPermitted || approvalPermitted;
      usedBootstrapAdminAccess = permitted && !ordinarilyPermitted;
      requiresAcceptedReviewerAssignment = reviewPermitted && !approvalPermitted && !session.isBootstrapAdmin;
      break;
    }
    case "mark-merged":
      permitted = canArchive(session.roles);
      break;
  }

  if (!permitted) {
    return { ok: false, error: "You are not permitted to perform this action on this record." };
  }

  const nextStatus = nextStatusFor(transition);

  if (transition === "publish") {
    const [sourceCount] = await db
      .select({ count: schema.opportunityOfficialSources.opportunityId })
      .from(schema.opportunityOfficialSources)
      .where(eq(schema.opportunityOfficialSources.opportunityId, opportunityId));
    if (!sourceCount) {
      return { ok: false, error: "This opportunity has no official source yet — add one before publishing." };
    }
    // The rest of the publish gate (confirmed-official source freshness, a
    // current non-stale verified verification record tied to accepted
    // evidence, an independently approved current revision, an accepted/
    // completed review assignment) is enforced by the database trigger
    // `app.enforce_opportunity_publication_requirements` — this check only
    // gives an earlier, friendlier error for the single most common case.
  }

  // "mark-reviewed" requires an assignment this exact reviewer has actually
  // accepted for this exact opportunity — previously nothing connected the
  // review_assignments queue to the workflow transition at all, so a review
  // could be marked complete with no assignment ever having existed. That
  // assignment is completed inside the same transaction below, which is what
  // the publish-gate trigger's "accepted/completed review assignment" check
  // ultimately relies on.
  let reviewAssignmentToComplete: string | null = null;
  let createBootstrapReviewAssignment = false;
  if (transition === "mark-reviewed" || requiresAcceptedReviewerAssignment) {
    const [assignment] = await db
      .select({ id: schema.reviewAssignments.id })
      .from(schema.reviewAssignments)
      .where(
        and(
          eq(schema.reviewAssignments.subjectKind, "opportunity"),
          eq(schema.reviewAssignments.subjectId, opportunityId),
          eq(schema.reviewAssignments.reviewerStaffProfileId, session.staffProfileId),
          eq(schema.reviewAssignments.status, "accepted"),
        ),
      )
      .orderBy(desc(schema.reviewAssignments.assignedAt))
      .limit(1);
    if (!assignment && !(transition === "mark-reviewed" && session.isBootstrapAdmin)) {
      return {
        ok: false,
        error: "You have no accepted review assignment for this opportunity — accept your assignment before marking it reviewed.",
      };
    }
    if (assignment && transition === "mark-reviewed") {
      reviewAssignmentToComplete = assignment.id;
    } else if (!assignment) {
      // Keep the database publication gate intact during one-account testing:
      // materialise the exceptional review as a completed assignment instead
      // of weakening or skipping the assignment invariant.
      createBootstrapReviewAssignment = true;
      usedBootstrapAdminAccess = true;
    }
  }

  await db.transaction(async (tx) => {
    await enableBootstrapAdminConstraintBypass(
      tx,
      session.isBootstrapAdmin && (usedBootstrapAdminAccess || transition === "publish")
        ? session.staffProfileId
        : null,
    );
    const versionNumber = await nextVersionNumber(opportunityId);
    const [newVersion] = await tx
      .insert(schema.opportunityVersions)
      .values({
        opportunityId,
        versionNumber,
        snapshot: opportunity,
        changeReason: options.reason ?? options.overrideReason ?? null,
        authorStaffProfileId: session.staffProfileId,
        reviewOutcome: ["mark-reviewed", "request-changes", "approve", "reject"].includes(transition) ? transition : null,
        publicationOutcome: transition === "publish" ? "published" : transition === "archive" ? "archived" : null,
      })
      .returning();

    const patch: Partial<typeof schema.opportunities.$inferInsert> = {
      status: nextStatus,
      updatedByStaffProfileId: session.staffProfileId,
      updatedAt: new Date(),
    };
    // Deliberately "approve" only, never "publish" too: current_approved_version_id
    // must keep pointing at the revision that was actually reviewed and
    // approved. Publishing creates its own append-only version row for the
    // audit trail (above) but must never move the pointer past it — doing so
    // would let the public catalogue reflect content nobody independently
    // approved (this was a real bug: the previous code reassigned the
    // pointer again at publish, onto a revision whose review_outcome is
    // null).
    if (transition === "approve") {
      patch.currentApprovedVersionId = newVersion.id;
    }
    if (transition === "publish") {
      patch.publishedAt = new Date();
    }
    if (transition === "archive") {
      patch.archivedAt = new Date();
    }

    await tx.update(schema.opportunities).set(patch).where(eq(schema.opportunities.id, opportunityId));

    if (reviewAssignmentToComplete) {
      await tx
        .update(schema.reviewAssignments)
        .set({ status: "completed", completedAt: new Date(), decision: transition })
        .where(eq(schema.reviewAssignments.id, reviewAssignmentToComplete));
    }

    if (createBootstrapReviewAssignment) {
      await tx.insert(schema.reviewAssignments).values({
        subjectKind: "opportunity",
        subjectId: opportunityId,
        opportunityId,
        subjectAuthorStaffProfileId: authorId,
        reviewerStaffProfileId: session.staffProfileId,
        assignedByStaffProfileId: session.staffProfileId,
        requiredRole: "reviewer",
        status: "completed",
        completedAt: new Date(),
        decision: transition,
        reviewerNotes: "Created by the audited bootstrap administrator testing override.",
      });
    }

    await recordAuditEvent(tx, {
      actorStaffProfileId: session.staffProfileId,
      actorRole: isOverride || usedBootstrapAdminAccess ? "administrator" : (session.roles[0] ?? null),
      action:
        transition === "publish"
          ? "publish"
          : transition === "archive"
            ? "archive"
            : transition === "restore"
              ? "restore"
              : transition === "reject"
                ? "reject"
                : transition === "approve"
                  ? "approve"
                  : transition === "request-changes"
                    ? "request-changes"
                    : "submit-review",
      entityName: "opportunities",
      entityId: opportunityId,
      reasonCode: options.reason ?? options.overrideReason ?? null,
      redactedChangeSummary: isOverride
        ? `Administrator override: ${transition} (${options.overrideReason}).`
        : usedBootstrapAdminAccess
          ? `Bootstrap administrator full-access override: ${transition} on "${opportunity.title}".`
          : `${transition} on "${opportunity.title}".`,
    });
  });

  revalidatePath(`/staff/opportunities/${opportunityId}`);
  revalidatePath("/staff/opportunities");
  revalidatePath("/opportunities");
  return { ok: true, opportunityId };
}

export async function submitForReview(opportunityId: string) {
  return runTransition(opportunityId, "submit-for-review");
}
export async function resubmitForReview(opportunityId: string) {
  return runTransition(opportunityId, "resubmit");
}
export async function requestChangesOnOpportunity(opportunityId: string, reason: string) {
  return runTransition(opportunityId, "request-changes", { reason });
}
export async function markOpportunityReviewed(opportunityId: string, reason?: string) {
  return runTransition(opportunityId, "mark-reviewed", { reason });
}
export async function approveOpportunity(opportunityId: string, overrideReason?: string) {
  return runTransition(opportunityId, "approve", { overrideReason });
}
export async function scheduleOpportunity(opportunityId: string) {
  return runTransition(opportunityId, "schedule");
}
export async function publishOpportunity(opportunityId: string) {
  return runTransition(opportunityId, "publish");
}
export async function archiveOpportunity(opportunityId: string, reason: string) {
  return runTransition(opportunityId, "archive", { reason });
}
export async function restoreOpportunity(opportunityId: string) {
  return runTransition(opportunityId, "restore");
}
export async function rejectOpportunity(opportunityId: string, reason: string) {
  return runTransition(opportunityId, "reject", { reason });
}
