import { and, eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as schema from "../../src/lib/db/schema";
import { client, db, expectRejectionMatching, uniqueSuffix } from "./helpers";

describe("database-enforced invariants", () => {
  const suffix = uniqueSuffix();
  const reviewerId = "44444444-4444-4444-4444-444444444444";
  // A second identity for tests that need an independently-actored
  // verification/approval — the stricter publish gate
  // (0010_publication_integrity_actors.sql) rejects the same person as both
  // reviewer and approver.
  const approverId = "66666666-6666-6666-6666-666666666666";
  let opportunityTypeId: string;
  let providerId: string;
  let organisationId: string;

  beforeAll(async () => {
    const [opportunityType] = await db.select().from(schema.opportunityTypes).where(eq(schema.opportunityTypes.code, "scholarship"));
    if (!opportunityType) throw new Error("Taxonomies are not seeded.");
    opportunityTypeId = opportunityType.id;

    const [organisation] = await db
      .insert(schema.organisations)
      .values({ legalName: `Invariant Org ${suffix}`, displayName: `Invariant Org ${suffix}`, kind: "other", status: "active" })
      .returning();
    organisationId = organisation.id;

    const [provider] = await db
      .insert(schema.providers)
      .values({ organisationId, displayName: `Invariant Provider ${suffix}`, status: "active" })
      .returning();
    providerId = provider.id;

    await db
      .insert(schema.staffProfiles)
      .values({ id: reviewerId, email: `invariant-reviewer-${suffix}@example.com`, displayName: "Invariant Reviewer", status: "active" })
      .onConflictDoNothing({ target: schema.staffProfiles.id });
    await db
      .insert(schema.staffProfiles)
      .values({ id: approverId, email: `invariant-approver-${suffix}@example.com`, displayName: "Invariant Approver", status: "active" })
      .onConflictDoNothing({ target: schema.staffProfiles.id });
  });

  afterAll(async () => {
    await db.delete(schema.staffProfiles).where(eq(schema.staffProfiles.id, reviewerId));
    await db.delete(schema.staffProfiles).where(eq(schema.staffProfiles.id, approverId));
    // `client.end()` deliberately does NOT run here — this file has a second
    // top-level `describe` block below that reuses the same shared
    // `client`/`db` connection from ./helpers, and closes it in its own
    // afterAll once everything in the file is done.
  });

  it("rejects publishing an opportunity with no official source", async () => {
    const [opportunity] = await db
      .insert(schema.opportunities)
      .values({
        slug: `invariant-no-source-${suffix}`,
        title: "No Source",
        summary: "summary",
        opportunityTypeId,
        providerId,
        status: "draft",
      })
      .returning();

    const [version] = await db
      .insert(schema.opportunityVersions)
      .values({ opportunityId: opportunity.id, versionNumber: 1, snapshot: {}, authorStaffProfileId: reviewerId })
      .returning();

    await expectRejectionMatching(
      db
        .update(schema.opportunities)
        .set({ status: "published", publishedAt: new Date(), currentApprovedVersionId: version.id })
        .where(eq(schema.opportunities.id, opportunity.id)),
      /official source/i,
    );

    await db.delete(schema.opportunities).where(eq(schema.opportunities.id, opportunity.id));
  });

  it("rejects publishing without a current_approved_version_id (CHECK constraint)", async () => {
    const [opportunity] = await db
      .insert(schema.opportunities)
      .values({
        slug: `invariant-no-version-${suffix}`,
        title: "No Version",
        summary: "summary",
        opportunityTypeId,
        providerId,
        status: "draft",
      })
      .returning();

    // Give it a real official source, a current verified verification
    // record tied to accepted evidence, and an accepted review assignment —
    // every other publish-gate condition from
    // 0010_publication_integrity_actors.sql — so the *only* thing standing
    // between it and "published" is the missing current_approved_version_id,
    // isolating this from the other, separately-tested trigger conditions.
    const [organisation] = await db.select().from(schema.organisations).where(eq(schema.organisations.id, organisationId));
    const [officialSource] = await db
      .insert(schema.officialSources)
      .values({
        url: `https://example.test/no-version-${suffix}`,
        kind: "opportunity-page",
        label: "Test source",
        sourceOrganisationName: organisation.displayName,
        publisherOrganisationId: organisation.id,
        status: "confirmed-official",
        lastCheckedAt: new Date(),
      })
      .returning();
    await db.insert(schema.opportunityOfficialSources).values({ opportunityId: opportunity.id, officialSourceId: officialSource.id });

    // Must run as one transaction: the deferred constraint trigger
    // `verification_records_require_source` (0002_publication_invariants.sql)
    // validates at transaction end, not at the commit of a lone
    // auto-committed statement — splitting the verification-record insert
    // and its source link across two separate `db.insert()` calls makes the
    // deferred check fire too early, before the source is linked.
    await db.transaction(async (tx) => {
      const [verificationRecord] = await tx
        .insert(schema.verificationRecords)
        .values({
          subjectKind: "opportunity",
          subjectId: opportunity.id,
          opportunityId: opportunity.id,
          reviewerStaffProfileId: reviewerId,
          approvedByStaffProfileId: approverId,
          outcome: "verified",
          status: "verified",
          checkedAt: new Date(),
          summary: "Looks correct",
        })
        .returning();
      await tx
        .insert(schema.verificationRecordSources)
        .values({ verificationRecordId: verificationRecord.id, officialSourceId: officialSource.id });
      await tx.insert(schema.sourceEvidence).values({
        opportunityId: opportunity.id,
        officialSourceId: officialSource.id,
        verificationRecordId: verificationRecord.id,
        kind: "fact",
        status: "accepted",
        evidenceText: "Fixture evidence.",
        capturedByStaffProfileId: reviewerId,
        approvedByStaffProfileId: approverId,
      });
      await tx.insert(schema.reviewAssignments).values({
        subjectKind: "opportunity",
        subjectId: opportunity.id,
        opportunityId: opportunity.id,
        subjectAuthorStaffProfileId: reviewerId,
        reviewerStaffProfileId: approverId,
        assignedByStaffProfileId: approverId,
        requiredRole: "reviewer",
        status: "completed",
        completedAt: new Date(),
        decision: "mark-reviewed",
      });
    });

    await expectRejectionMatching(
      db
        .update(schema.opportunities)
        .set({ status: "published", publishedAt: new Date() })
        .where(eq(schema.opportunities.id, opportunity.id)),
      /current_approved_version|violates check constraint/i,
    );

    await db.delete(schema.opportunities).where(eq(schema.opportunities.id, opportunity.id));
  });

  it("rejects an archived status with no archived_at timestamp (CHECK constraint)", async () => {
    const [opportunity] = await db
      .insert(schema.opportunities)
      .values({
        slug: `invariant-archived-${suffix}`,
        title: "Archived No Timestamp",
        summary: "summary",
        opportunityTypeId,
        providerId,
        status: "draft",
      })
      .returning();

    await expectRejectionMatching(
      db.update(schema.opportunities).set({ status: "archived" }).where(eq(schema.opportunities.id, opportunity.id)),
      /violates check constraint/i,
    );

    await db.delete(schema.opportunities).where(eq(schema.opportunities.id, opportunity.id));
  });

  it("rejects a rolling/unknown deadline occurrence carrying a fabricated exact date", async () => {
    const [opportunity] = await db
      .insert(schema.opportunities)
      .values({ slug: `invariant-deadline-${suffix}`, title: "Deadline Test", summary: "summary", opportunityTypeId, providerId, status: "draft" })
      .returning();
    const [cycle] = await db.insert(schema.deadlineCycles).values({ opportunityId: opportunity.id, status: "draft" }).returning();

    await expectRejectionMatching(
      db.insert(schema.deadlineOccurrences).values({
        deadlineCycleId: cycle.id,
        precision: "rolling",
        closingDate: "2027-01-01",
        rawText: "Rolling",
        verificationStatus: "unverified",
        status: "draft",
      }),
      /violates check constraint/i,
    );

    await db.delete(schema.opportunities).where(eq(schema.opportunities.id, opportunity.id));
  });

  it("audit_log is append-only: UPDATE and DELETE are rejected even for the privileged connection", async () => {
    const [entry] = await db
      .insert(schema.auditLog)
      .values({ action: "create", entityName: "test", actorStaffProfileId: null, actorRole: null })
      .returning();

    await expectRejectionMatching(
      db.update(schema.auditLog).set({ reasonCode: "tampered" }).where(eq(schema.auditLog.id, entry.id)),
      /append-only/i,
    );
    await expectRejectionMatching(db.delete(schema.auditLog).where(eq(schema.auditLog.id, entry.id)), /append-only/i);
  });

  it("a verification record must cite at least one official source before leaving 'pending' (deferred constraint trigger)", async () => {
    const [opportunity] = await db
      .insert(schema.opportunities)
      .values({ slug: `invariant-verification-${suffix}`, title: "Verification Test", summary: "s", opportunityTypeId, providerId, status: "draft" })
      .returning();

    await expectRejectionMatching(
      db.insert(schema.verificationRecords).values({
        subjectKind: "opportunity",
        subjectId: opportunity.id,
        opportunityId: opportunity.id,
        reviewerStaffProfileId: reviewerId,
        outcome: "verified",
        status: "verified",
        checkedAt: new Date(),
        summary: "Looks correct",
      }),
      /official source/i,
    );

    await db.delete(schema.opportunities).where(eq(schema.opportunities.id, opportunity.id));
  });
});

describe("stricter publication gate (0010_publication_integrity_actors.sql)", () => {
  const suffix = uniqueSuffix();
  const reviewerId = "77777777-7777-7777-7777-777777777777";
  const approverId = "88888888-8888-8888-8888-888888888888";
  let opportunityTypeId: string;
  let providerId: string;
  let organisationId: string;

  beforeAll(async () => {
    const [opportunityType] = await db.select().from(schema.opportunityTypes).where(eq(schema.opportunityTypes.code, "scholarship"));
    if (!opportunityType) throw new Error("Taxonomies are not seeded.");
    opportunityTypeId = opportunityType.id;

    const [organisation] = await db
      .insert(schema.organisations)
      .values({ legalName: `Gate Org ${suffix}`, displayName: `Gate Org ${suffix}`, kind: "other", status: "active" })
      .returning();
    organisationId = organisation.id;

    const [provider] = await db
      .insert(schema.providers)
      .values({ organisationId, displayName: `Gate Provider ${suffix}`, status: "active" })
      .returning();
    providerId = provider.id;

    await db
      .insert(schema.staffProfiles)
      .values({ id: reviewerId, email: `gate-reviewer-${suffix}@example.com`, displayName: "Gate Reviewer", status: "active" })
      .onConflictDoNothing({ target: schema.staffProfiles.id });
    await db
      .insert(schema.staffProfiles)
      .values({ id: approverId, email: `gate-approver-${suffix}@example.com`, displayName: "Gate Approver", status: "active" })
      .onConflictDoNothing({ target: schema.staffProfiles.id });
  });

  afterAll(async () => {
    await db.delete(schema.staffProfiles).where(eq(schema.staffProfiles.id, reviewerId));
    await db.delete(schema.staffProfiles).where(eq(schema.staffProfiles.id, approverId));
    await client.end();
  });

  /**
   * Builds an opportunity with every publish-gate condition satisfied except
   * whichever ones the caller explicitly opts out of, so each test below can
   * isolate a single failing condition — mirroring the "isolate one
   * condition" pattern already used above.
   */
  async function buildOpportunity(
    slugSuffix: string,
    options: {
      sourceStatus?: (typeof schema.officialSourceStatusEnum.enumValues)[number];
      verificationStatus?: (typeof schema.verificationRecordStatusEnum.enumValues)[number];
      verificationCheckedAt?: Date;
      evidenceStatus?: (typeof schema.sourceEvidenceStatusEnum.enumValues)[number];
      linkEvidenceToVerification?: boolean;
      reviewOutcome?: string | null;
      assignmentStatus?: (typeof schema.reviewAssignmentStatusEnum.enumValues)[number] | null;
    } = {},
  ) {
    const {
      sourceStatus = "confirmed-official",
      verificationStatus = "verified",
      verificationCheckedAt = new Date(),
      evidenceStatus = "accepted",
      linkEvidenceToVerification = true,
      reviewOutcome = "approve",
      assignmentStatus = "completed",
    } = options;

    const [opportunity] = await db
      .insert(schema.opportunities)
      .values({
        slug: `gate-${slugSuffix}-${suffix}`,
        title: `Gate ${slugSuffix}`,
        summary: "summary",
        opportunityTypeId,
        providerId,
        status: "draft",
      })
      .returning();

    const [officialSource] = await db
      .insert(schema.officialSources)
      .values({
        url: `https://example.test/gate-${slugSuffix}-${suffix}`,
        kind: "opportunity-page",
        label: "Test source",
        sourceOrganisationName: "Test org",
        publisherOrganisationId: organisationId,
        status: sourceStatus,
        lastCheckedAt: new Date(),
      })
      .returning();
    await db.insert(schema.opportunityOfficialSources).values({ opportunityId: opportunity.id, officialSourceId: officialSource.id });

    // One transaction: the deferred constraint trigger
    // `verification_records_require_source` (0002_publication_invariants.sql)
    // validates at transaction end, not at the commit of a lone
    // auto-committed statement.
    const verificationRecord = await db.transaction(async (tx) => {
      const [record] = await tx
        .insert(schema.verificationRecords)
        .values({
          subjectKind: "opportunity",
          subjectId: opportunity.id,
          opportunityId: opportunity.id,
          reviewerStaffProfileId: reviewerId,
          approvedByStaffProfileId: approverId,
          outcome: "verified",
          status: verificationStatus,
          checkedAt: verificationCheckedAt,
          summary: "Fixture verification.",
        })
        .returning();
      await tx.insert(schema.verificationRecordSources).values({ verificationRecordId: record.id, officialSourceId: officialSource.id });
      return record;
    });
    await db.insert(schema.sourceEvidence).values({
      opportunityId: opportunity.id,
      officialSourceId: officialSource.id,
      verificationRecordId: linkEvidenceToVerification ? verificationRecord.id : null,
      kind: "fact",
      status: evidenceStatus,
      evidenceText: "Fixture evidence.",
      capturedByStaffProfileId: reviewerId,
      approvedByStaffProfileId: evidenceStatus === "accepted" ? approverId : null,
    });

    if (assignmentStatus) {
      await db.insert(schema.reviewAssignments).values({
        subjectKind: "opportunity",
        subjectId: opportunity.id,
        opportunityId: opportunity.id,
        subjectAuthorStaffProfileId: reviewerId,
        reviewerStaffProfileId: approverId,
        assignedByStaffProfileId: approverId,
        requiredRole: "reviewer",
        status: assignmentStatus,
        completedAt: assignmentStatus === "completed" ? new Date() : null,
        decision: assignmentStatus === "completed" ? "mark-reviewed" : null,
      });
    }

    const [version] = await db
      .insert(schema.opportunityVersions)
      .values({
        opportunityId: opportunity.id,
        versionNumber: 1,
        snapshot: {},
        authorStaffProfileId: reviewerId,
        reviewOutcome,
      })
      .returning();

    return { opportunityId: opportunity.id, versionId: version.id, officialSourceId: officialSource.id };
  }

  it("publishes successfully when every condition is satisfied (positive control)", async () => {
    const { opportunityId, versionId } = await buildOpportunity("happy-path");
    await db
      .update(schema.opportunities)
      .set({ status: "published", publishedAt: new Date(), currentApprovedVersionId: versionId })
      .where(eq(schema.opportunities.id, opportunityId));
    await db.delete(schema.opportunities).where(eq(schema.opportunities.id, opportunityId));
  });

  it("rejects publishing when the only source is still a candidate, not confirmed-official", async () => {
    const { opportunityId, versionId } = await buildOpportunity("candidate-source", { sourceStatus: "candidate" });
    await expectRejectionMatching(
      db
        .update(schema.opportunities)
        .set({ status: "published", publishedAt: new Date(), currentApprovedVersionId: versionId })
        .where(eq(schema.opportunities.id, opportunityId)),
      /confirmed-official source/i,
    );
    await db.delete(schema.opportunities).where(eq(schema.opportunities.id, opportunityId));
  });

  it("rejects publishing when the verification record is stale (checked more than 400 days ago)", async () => {
    const staleDate = new Date();
    staleDate.setDate(staleDate.getDate() - 500);
    const { opportunityId, versionId } = await buildOpportunity("stale-verification", { verificationCheckedAt: staleDate });
    await expectRejectionMatching(
      db
        .update(schema.opportunities)
        .set({ status: "published", publishedAt: new Date(), currentApprovedVersionId: versionId })
        .where(eq(schema.opportunities.id, opportunityId)),
      /current approved verification/i,
    );
    await db.delete(schema.opportunities).where(eq(schema.opportunities.id, opportunityId));
  });

  it("rejects publishing when the verification record is only 'pending', not 'verified'", async () => {
    const { opportunityId, versionId } = await buildOpportunity("pending-verification", { verificationStatus: "pending" });
    await expectRejectionMatching(
      db
        .update(schema.opportunities)
        .set({ status: "published", publishedAt: new Date(), currentApprovedVersionId: versionId })
        .where(eq(schema.opportunities.id, opportunityId)),
      /current approved verification/i,
    );
    await db.delete(schema.opportunities).where(eq(schema.opportunities.id, opportunityId));
  });

  it("rejects publishing when the verification record is not tied to any accepted evidence", async () => {
    const { opportunityId, versionId } = await buildOpportunity("uncaptured-evidence", { evidenceStatus: "captured" });
    await expectRejectionMatching(
      db
        .update(schema.opportunities)
        .set({ status: "published", publishedAt: new Date(), currentApprovedVersionId: versionId })
        .where(eq(schema.opportunities.id, opportunityId)),
      /current approved verification/i,
    );
    await db.delete(schema.opportunities).where(eq(schema.opportunities.id, opportunityId));
  });

  it("rejects publishing when the current revision was never independently approved", async () => {
    const { opportunityId, versionId } = await buildOpportunity("unapproved-revision", { reviewOutcome: null });
    await expectRejectionMatching(
      db
        .update(schema.opportunities)
        .set({ status: "published", publishedAt: new Date(), currentApprovedVersionId: versionId })
        .where(eq(schema.opportunities.id, opportunityId)),
      /own approved revision/i,
    );
    await db.delete(schema.opportunities).where(eq(schema.opportunities.id, opportunityId));
  });

  it("rejects publishing when there is no completed review assignment", async () => {
    const { opportunityId, versionId } = await buildOpportunity("no-assignment", { assignmentStatus: null });
    await expectRejectionMatching(
      db
        .update(schema.opportunities)
        .set({ status: "published", publishedAt: new Date(), currentApprovedVersionId: versionId })
        .where(eq(schema.opportunities.id, opportunityId)),
      /no valid completed review assignment/i,
    );
    await db.delete(schema.opportunities).where(eq(schema.opportunities.id, opportunityId));
  });

  it("rejects an accepted-but-not-completed review assignment", async () => {
    const { opportunityId, versionId } = await buildOpportunity("accepted-only-assignment", {
      assignmentStatus: "accepted",
    });
    await expectRejectionMatching(
      db
        .update(schema.opportunities)
        .set({ status: "published", publishedAt: new Date(), currentApprovedVersionId: versionId })
        .where(eq(schema.opportunities.id, opportunityId)),
      /no valid completed review assignment/i,
    );
    await db.delete(schema.opportunities).where(eq(schema.opportunities.id, opportunityId));
  });

  it("rejects an approved version that belongs to a different opportunity", async () => {
    const a = await buildOpportunity("cross-version-a");
    const b = await buildOpportunity("cross-version-b");
    await expectRejectionMatching(
      db
        .update(schema.opportunities)
        .set({ status: "published", publishedAt: new Date(), currentApprovedVersionId: b.versionId })
        .where(eq(schema.opportunities.id, a.opportunityId)),
      /own approved revision/i,
    );
    await db.delete(schema.opportunities).where(eq(schema.opportunities.id, a.opportunityId));
    await db.delete(schema.opportunities).where(eq(schema.opportunities.id, b.opportunityId));
  });

  it("rejects demoting the sole qualifying source of a published opportunity back to candidate", async () => {
    const { opportunityId, versionId, officialSourceId } = await buildOpportunity("demote-source");
    await db
      .update(schema.opportunities)
      .set({ status: "published", publishedAt: new Date(), currentApprovedVersionId: versionId })
      .where(eq(schema.opportunities.id, opportunityId));

    await expectRejectionMatching(
      db.update(schema.officialSources).set({ status: "candidate" }).where(eq(schema.officialSources.id, officialSourceId)),
      /only qualifying source for a published opportunity/i,
    );

    await db.delete(schema.opportunities).where(eq(schema.opportunities.id, opportunityId));
  });

  it("rejects unlinking the sole qualifying source from a published opportunity", async () => {
    const { opportunityId, versionId, officialSourceId } = await buildOpportunity("unlink-source");
    await db
      .update(schema.opportunities)
      .set({ status: "published", publishedAt: new Date(), currentApprovedVersionId: versionId })
      .where(eq(schema.opportunities.id, opportunityId));

    await expectRejectionMatching(
      db
        .delete(schema.opportunityOfficialSources)
        .where(
          and(
            eq(schema.opportunityOfficialSources.opportunityId, opportunityId),
            eq(schema.opportunityOfficialSources.officialSourceId, officialSourceId),
          ),
        ),
      /only qualifying source for published opportunity/i,
    );

    await db.delete(schema.opportunities).where(eq(schema.opportunities.id, opportunityId));
  });

  it("rejects a document requirement whose source evidence belongs to a different opportunity", async () => {
    const a = await buildOpportunity("child-id-a");
    const b = await buildOpportunity("child-id-b");

    const [evidenceForA] = await db
      .select()
      .from(schema.sourceEvidence)
      .where(eq(schema.sourceEvidence.opportunityId, a.opportunityId));

    const [template] = await db.select().from(schema.requiredDocumentTemplates).limit(1);

    await expectRejectionMatching(
      db.insert(schema.opportunityDocumentRequirements).values({
        opportunityId: b.opportunityId,
        requiredDocumentTemplateId: template.id,
        requirementLevel: "required",
        sourceEvidenceId: evidenceForA.id,
        status: "draft",
      }),
      /belonging to a different opportunity/i,
    );

    await db.delete(schema.opportunities).where(eq(schema.opportunities.id, a.opportunityId));
    await db.delete(schema.opportunities).where(eq(schema.opportunities.id, b.opportunityId));
  });

  it("rejects the same staff member as both creator and approver of an official source", async () => {
    const [opportunity] = await db
      .insert(schema.opportunities)
      .values({ slug: `gate-self-approval-${suffix}`, title: "Self approval", summary: "s", opportunityTypeId, providerId, status: "draft" })
      .returning();

    await expectRejectionMatching(
      db.insert(schema.officialSources).values({
        url: `https://example.test/self-approval-${suffix}`,
        kind: "opportunity-page",
        label: "Test source",
        sourceOrganisationName: "Test org",
        publisherOrganisationId: organisationId,
        status: "confirmed-official",
        lastCheckedAt: new Date(),
        createdByStaffProfileId: reviewerId,
        approvedByStaffProfileId: reviewerId,
      }),
      /no_self_approval|violates check constraint/i,
    );

    await db.delete(schema.opportunities).where(eq(schema.opportunities.id, opportunity.id));
  });

  it("allows only the transaction-local bootstrap actor to self-approve and does not leak the exception", async () => {
    const [source] = await db.transaction(async (tx) => {
      await tx.execute(
        sql`select set_config('app.bootstrap_admin_actor_id', ${reviewerId}, true)`,
      );
      return tx
        .insert(schema.officialSources)
        .values({
          url: `https://example.test/bootstrap-self-approval-${suffix}`,
          kind: "opportunity-page",
          label: "Bootstrap test source",
          sourceOrganisationName: "Test org",
          publisherOrganisationId: organisationId,
          status: "confirmed-official",
          lastCheckedAt: new Date(),
          createdByStaffProfileId: reviewerId,
          approvedByStaffProfileId: reviewerId,
        })
        .returning();
    });
    expect(source.approvedByStaffProfileId).toBe(reviewerId);

    await expectRejectionMatching(
      db.insert(schema.officialSources).values({
        url: `https://example.test/bootstrap-no-leak-${suffix}`,
        kind: "opportunity-page",
        label: "Bootstrap no-leak source",
        sourceOrganisationName: "Test org",
        publisherOrganisationId: organisationId,
        status: "confirmed-official",
        lastCheckedAt: new Date(),
        createdByStaffProfileId: reviewerId,
        approvedByStaffProfileId: reviewerId,
      }),
      /no_self_approval|violates check constraint/i,
    );

    await expectRejectionMatching(
      db.transaction(async (tx) => {
        await tx.execute(
          sql`select set_config('app.bootstrap_admin_actor_id', ${approverId}, true)`,
        );
        await tx.insert(schema.officialSources).values({
          url: `https://example.test/bootstrap-wrong-actor-${suffix}`,
          kind: "opportunity-page",
          label: "Bootstrap wrong-actor source",
          sourceOrganisationName: "Test org",
          publisherOrganisationId: organisationId,
          status: "confirmed-official",
          lastCheckedAt: new Date(),
          createdByStaffProfileId: reviewerId,
          approvedByStaffProfileId: reviewerId,
        });
      }),
      /no_self_approval|violates check constraint/i,
    );

    await db.delete(schema.officialSources).where(eq(schema.officialSources.id, source.id));
  });

  it("keeps self-review assignments blocked unless the matching bootstrap actor is transaction-local", async () => {
    const [opportunity] = await db
      .insert(schema.opportunities)
      .values({
        slug: `bootstrap-self-review-${suffix}`,
        title: "Bootstrap self review",
        summary: "summary",
        opportunityTypeId,
        providerId,
        status: "in_review",
        createdByStaffProfileId: reviewerId,
      })
      .returning();

    const assignment = {
      subjectKind: "opportunity" as const,
      subjectId: opportunity.id,
      opportunityId: opportunity.id,
      subjectAuthorStaffProfileId: reviewerId,
      reviewerStaffProfileId: reviewerId,
      assignedByStaffProfileId: reviewerId,
      requiredRole: "reviewer" as const,
      status: "assigned" as const,
    };

    await expectRejectionMatching(
      db.insert(schema.reviewAssignments).values(assignment),
      /no_self_review|violates check constraint/i,
    );

    const [created] = await db.transaction(async (tx) => {
      await tx.execute(
        sql`select set_config('app.bootstrap_admin_actor_id', ${reviewerId}, true)`,
      );
      return tx.insert(schema.reviewAssignments).values(assignment).returning();
    });
    expect(created.reviewerStaffProfileId).toBe(reviewerId);

    // CHECK constraints are re-evaluated on later updates too. This protects
    // against a transaction-local exception accidentally becoming a lasting
    // property of the row, while documenting that the manual accept path must
    // explicitly scope the same verified actor again.
    await expectRejectionMatching(
      db
        .update(schema.reviewAssignments)
        .set({ status: "accepted" })
        .where(eq(schema.reviewAssignments.id, created.id)),
      /no_self_review|violates check constraint/i,
    );

    const [accepted] = await db.transaction(async (tx) => {
      await tx.execute(
        sql`select set_config('app.bootstrap_admin_actor_id', ${reviewerId}, true)`,
      );
      return tx
        .update(schema.reviewAssignments)
        .set({ status: "accepted" })
        .where(eq(schema.reviewAssignments.id, created.id))
        .returning();
    });
    expect(accepted.status).toBe("accepted");

    await db.delete(schema.opportunities).where(eq(schema.opportunities.id, opportunity.id));
  });
});
