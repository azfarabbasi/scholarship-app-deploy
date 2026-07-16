"use server";

import { randomUUID } from "node:crypto";
import { desc, eq } from "drizzle-orm";
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
import { getDb, schema } from "@/lib/db/client";
import { getServerEnv } from "@/lib/env";
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
  const selfReviewOptions = { adminSelfReviewAllowed: getServerEnv("opportunity workflow").ALLOW_ADMIN_SELF_REVIEW };
  let permitted = false;
  let isOverride = false;

  switch (transition) {
    case "submit-for-review":
    case "resubmit":
      permitted = canEditDraft(session.roles, authorId === session.staffProfileId || session.roles.includes("administrator"));
      break;
    case "request-changes":
    case "mark-reviewed":
      permitted = canReview(session.roles, session.staffProfileId, authorId, selfReviewOptions);
      break;
    case "approve":
      permitted = canApprove(session.roles, session.staffProfileId, authorId, selfReviewOptions);
      if (!permitted && isAdministratorOverride(session.roles, options.overrideReason)) {
        permitted = true;
        isOverride = true;
      }
      break;
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
    case "reject":
      permitted =
        canReview(session.roles, session.staffProfileId, authorId, selfReviewOptions) ||
        canApprove(session.roles, session.staffProfileId, authorId, selfReviewOptions);
      break;
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
  }

  await db.transaction(async (tx) => {
    const versionNumber = await nextVersionNumber(opportunityId);
    await tx.insert(schema.opportunityVersions).values({
      opportunityId,
      versionNumber,
      snapshot: opportunity,
      changeReason: options.reason ?? options.overrideReason ?? null,
      authorStaffProfileId: session.staffProfileId,
      reviewOutcome: ["mark-reviewed", "request-changes", "approve", "reject"].includes(transition) ? transition : null,
      publicationOutcome: transition === "publish" ? "published" : transition === "archive" ? "archived" : null,
    });

    const patch: Partial<typeof schema.opportunities.$inferInsert> = {
      status: nextStatus,
      updatedByStaffProfileId: session.staffProfileId,
      updatedAt: new Date(),
    };
    if (transition === "publish" || transition === "approve") {
      const [latestVersion] = await tx
        .select({ id: schema.opportunityVersions.id })
        .from(schema.opportunityVersions)
        .where(eq(schema.opportunityVersions.opportunityId, opportunityId))
        .orderBy(desc(schema.opportunityVersions.versionNumber))
        .limit(1);
      if (latestVersion) patch.currentApprovedVersionId = latestVersion.id;
    }
    if (transition === "publish") {
      patch.publishedAt = new Date();
    }
    if (transition === "archive") {
      patch.archivedAt = new Date();
    }

    await tx.update(schema.opportunities).set(patch).where(eq(schema.opportunities.id, opportunityId));

    await recordAuditEvent(tx, {
      actorStaffProfileId: session.staffProfileId,
      actorRole: session.roles[0] ?? null,
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
