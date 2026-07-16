import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, it } from "vitest";
import * as schema from "../../src/lib/db/schema";
import { client, db, expectRejectionMatching, uniqueSuffix } from "./helpers";

describe("database-enforced invariants", () => {
  const suffix = uniqueSuffix();
  const reviewerId = "44444444-4444-4444-4444-444444444444";
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
  });

  afterAll(async () => {
    await db.delete(schema.staffProfiles).where(eq(schema.staffProfiles.id, reviewerId));
    await client.end();
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

    // Give it a real official source so the *only* thing standing between it
    // and "published" is the missing current_approved_version_id — isolating
    // the CHECK constraint from the separate official-source trigger.
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
