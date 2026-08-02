import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as schema from "../../src/lib/db/schema";
import { asRole, client, db, expectRejectionMatching, publishOpportunityForTest, uniqueSuffix } from "./helpers";

describe("row-level security", () => {
  const suffix = uniqueSuffix();
  const staffId = "22222222-2222-2222-2222-222222222222";
  // A second staff identity, distinct from staffId — the stricter publish
  // gate in drizzle/0010_publication_integrity_actors.sql requires an
  // independently approved revision and an accepted/completed review
  // assignment, both of which reject the same person acting as their own
  // reviewer/approver.
  const reviewerId = "55555555-5555-5555-5555-555555555555";
  // Extra identities for the 0011_narrow_staff_rls_policies.sql regression
  // tests below: an administrator (sees everything the narrowed policies
  // gate), and a plain reviewer with zero involvement in any fixture row
  // (proves "not just any staff role" for review_assignments specifically).
  const administratorId = "44444444-4444-4444-4444-444444444444";
  const outsiderReviewerId = "11111111-1111-4111-a111-111111111111";
  let opportunityTypeId: string;
  let providerId: string;
  let draftOpportunityId: string;
  let publishedOpportunityId: string;
  let reviewAssignmentId: string;
  let duplicateCandidateId: string;
  let importJobId: string;
  let importJobRowId: string;
  let auditLogId: string;

  beforeAll(async () => {
    const [opportunityType] = await db.select().from(schema.opportunityTypes).where(eq(schema.opportunityTypes.code, "scholarship"));
    if (!opportunityType) {
      throw new Error('Taxonomies are not seeded. Run `npm run db:seed:taxonomies` against the test database first.');
    }
    opportunityTypeId = opportunityType.id;

    const [organisation] = await db
      .insert(schema.organisations)
      .values({ legalName: `RLS Test Org ${suffix}`, displayName: `RLS Test Org ${suffix}`, kind: "other", status: "active" })
      .returning();
    const [provider] = await db
      .insert(schema.providers)
      .values({ organisationId: organisation.id, displayName: `RLS Test Provider ${suffix}`, status: "active" })
      .returning();
    providerId = provider.id;

    await db
      .insert(schema.staffProfiles)
      .values({ id: staffId, email: `rls-test-${suffix}@example.com`, displayName: "RLS Test Reviewer", status: "active" })
      .onConflictDoNothing({ target: schema.staffProfiles.id });
    await db.insert(schema.staffRoleAssignments).values({ staffProfileId: staffId, role: "reviewer" });

    await db
      .insert(schema.staffProfiles)
      .values({ id: reviewerId, email: `rls-test-approver-${suffix}@example.com`, displayName: "RLS Test Approver", status: "active" })
      .onConflictDoNothing({ target: schema.staffProfiles.id });
    await db.insert(schema.staffRoleAssignments).values({ staffProfileId: reviewerId, role: "senior_reviewer" });

    const [draft] = await db
      .insert(schema.opportunities)
      .values({
        slug: `rls-test-draft-${suffix}`,
        title: "RLS Test Draft",
        summary: "A draft opportunity for RLS testing.",
        opportunityTypeId,
        providerId,
        status: "draft",
      })
      .returning();
    draftOpportunityId = draft.id;

    const [officialSource] = await db
      .insert(schema.officialSources)
      .values({
        url: `https://example.test/${suffix}`,
        kind: "opportunity-page",
        label: "Test source",
        sourceOrganisationName: organisation.displayName,
        publisherOrganisationId: organisation.id,
        status: "confirmed-official",
        lastCheckedAt: new Date(),
      })
      .returning();

    const [published] = await db
      .insert(schema.opportunities)
      .values({
        slug: `rls-test-published-${suffix}`,
        title: "RLS Test Published",
        summary: "A published opportunity for RLS testing.",
        opportunityTypeId,
        providerId,
        status: "draft",
      })
      .returning();
    publishedOpportunityId = published.id;

    await db.insert(schema.opportunityOfficialSources).values({ opportunityId: published.id, officialSourceId: officialSource.id });

    const [version] = await db
      .insert(schema.opportunityVersions)
      .values({ opportunityId: published.id, versionNumber: 1, snapshot: {}, authorStaffProfileId: staffId })
      .returning();

    // The stricter publish gate (0010_publication_integrity_actors.sql)
    // additionally requires an independently approved version, a current
    // non-stale verified verification record tied to accepted evidence, and
    // an accepted/completed review assignment for this exact opportunity —
    // publishOpportunityForTest sets all of that up in one transaction (the
    // deferred verification-record-requires-source constraint trigger only
    // validates at transaction end, so it can't be split across separate
    // auto-committed statements).
    await publishOpportunityForTest({
      opportunityId: published.id,
      officialSourceId: officialSource.id,
      versionId: version.id,
      reviewerStaffProfileId: staffId,
      approverStaffProfileId: reviewerId,
    });

    const [reviewAssignment] = await db
      .select({ id: schema.reviewAssignments.id })
      .from(schema.reviewAssignments)
      .where(eq(schema.reviewAssignments.opportunityId, publishedOpportunityId));
    reviewAssignmentId = reviewAssignment.id;

    await db
      .insert(schema.staffProfiles)
      .values({ id: administratorId, email: `rls-test-admin-${suffix}@example.com`, displayName: "RLS Test Administrator", status: "active" })
      .onConflictDoNothing({ target: schema.staffProfiles.id });
    await db.insert(schema.staffRoleAssignments).values({ staffProfileId: administratorId, role: "administrator" });

    await db
      .insert(schema.staffProfiles)
      .values({ id: outsiderReviewerId, email: `rls-test-outsider-${suffix}@example.com`, displayName: "RLS Test Outsider", status: "active" })
      .onConflictDoNothing({ target: schema.staffProfiles.id });
    await db.insert(schema.staffRoleAssignments).values({ staffProfileId: outsiderReviewerId, role: "reviewer" });

    const [duplicateCandidate] = await db
      .insert(schema.duplicateCandidates)
      .values({
        canonicalOpportunityId: publishedOpportunityId,
        duplicateOpportunityId: draftOpportunityId,
        detectionReason: "RLS test fixture",
        confidenceScore: "0.900",
      })
      .returning();
    duplicateCandidateId = duplicateCandidate.id;

    const [importJob] = await db
      .insert(schema.importJobs)
      .values({ sourceKind: "csv", sourceFilename: "rls-test.csv", actorStaffProfileId: administratorId })
      .returning();
    importJobId = importJob.id;

    const [importJobRow] = await db
      .insert(schema.importJobRows)
      .values({ importJobId, rowNumber: 1, outcome: "created" })
      .returning();
    importJobRowId = importJobRow.id;

    const [auditRow] = await db
      .insert(schema.auditLog)
      .values({ actorStaffProfileId: administratorId, actorRole: "administrator", action: "create", entityName: "opportunities", entityId: publishedOpportunityId })
      .returning();
    auditLogId = auditRow.id;
  });

  afterAll(async () => {
    // audit_log is append-only (app.reject_mutation() trigger, see
    // 0000_auth_helpers.sql / 0002_publication_invariants.sql) — the test
    // fixture row is deliberately left in place; this is an ephemeral,
    // tmpfs-backed test database that gets fully reset before every full run.
    await db.delete(schema.importJobRows).where(eq(schema.importJobRows.id, importJobRowId));
    await db.delete(schema.importJobs).where(eq(schema.importJobs.id, importJobId));
    await db.delete(schema.duplicateCandidates).where(eq(schema.duplicateCandidates.id, duplicateCandidateId));
    await db.delete(schema.opportunities).where(eq(schema.opportunities.id, draftOpportunityId));
    await db.delete(schema.opportunities).where(eq(schema.opportunities.id, publishedOpportunityId));
    await db.delete(schema.staffRoleAssignments).where(eq(schema.staffRoleAssignments.staffProfileId, outsiderReviewerId));
    await db.delete(schema.staffProfiles).where(eq(schema.staffProfiles.id, outsiderReviewerId));
    await db.delete(schema.staffRoleAssignments).where(eq(schema.staffRoleAssignments.staffProfileId, administratorId));
    await db.delete(schema.staffProfiles).where(eq(schema.staffProfiles.id, administratorId));
    await db.delete(schema.staffRoleAssignments).where(eq(schema.staffRoleAssignments.staffProfileId, reviewerId));
    await db.delete(schema.staffProfiles).where(eq(schema.staffProfiles.id, reviewerId));
    await db.delete(schema.staffRoleAssignments).where(eq(schema.staffRoleAssignments.staffProfileId, staffId));
    await db.delete(schema.staffProfiles).where(eq(schema.staffProfiles.id, staffId));
    await client.end();
  });

  it("anon can see the published opportunity but not the draft", async () => {
    const rows = await asRole("anon", null, (tx) => tx.select({ id: schema.opportunities.id }).from(schema.opportunities));
    const ids = rows.map((r) => r.id);
    expect(ids).toContain(publishedOpportunityId);
    expect(ids).not.toContain(draftOpportunityId);
  });

  it("staff (any active role) can see both the draft and the published record", async () => {
    const rows = await asRole("authenticated", staffId, (tx) => tx.select({ id: schema.opportunities.id }).from(schema.opportunities));
    const ids = rows.map((r) => r.id);
    expect(ids).toContain(publishedOpportunityId);
    expect(ids).toContain(draftOpportunityId);
  });

  it("an authenticated user with no staff role assignment sees only published records, same as anon", async () => {
    const unassignedId = "33333333-3333-3333-3333-333333333333";
    const rows = await asRole("authenticated", unassignedId, (tx) => tx.select({ id: schema.opportunities.id }).from(schema.opportunities));
    const ids = rows.map((r) => r.id);
    expect(ids).toContain(publishedOpportunityId);
    expect(ids).not.toContain(draftOpportunityId);
  });

  it("anon cannot update opportunity data", async () => {
    await expect(
      asRole("anon", null, (tx) =>
        tx.update(schema.opportunities).set({ title: "Hacked" }).where(eq(schema.opportunities.id, publishedOpportunityId)),
      ),
    ).rejects.toThrow();
  });

  it("anon cannot read the staff directory or audit log", async () => {
    const staffRows = await asRole("anon", null, (tx) => tx.select().from(schema.staffProfiles));
    expect(staffRows).toHaveLength(0);
    const auditRows = await asRole("anon", null, (tx) => tx.select().from(schema.auditLog));
    expect(auditRows).toHaveLength(0);
  });

  it("anon cannot read correction reports or import jobs", async () => {
    const corrections = await asRole("anon", null, (tx) => tx.select().from(schema.correctionReports));
    expect(corrections).toHaveLength(0);
    const imports = await asRole("anon", null, (tx) => tx.select().from(schema.importJobs));
    expect(imports).toHaveLength(0);
  });

  it("anon cannot see an archived or merged opportunity even if it was published before", async () => {
    const [version] = await db
      .select()
      .from(schema.opportunityVersions)
      .where(eq(schema.opportunityVersions.opportunityId, publishedOpportunityId));
    await db
      .update(schema.opportunities)
      .set({ status: "archived", archivedAt: new Date() })
      .where(eq(schema.opportunities.id, publishedOpportunityId));

    const rows = await asRole("anon", null, (tx) => tx.select({ id: schema.opportunities.id }).from(schema.opportunities));
    expect(rows.map((r) => r.id)).not.toContain(publishedOpportunityId);

    // restore for other tests / afterAll cleanup expectations
    await db
      .update(schema.opportunities)
      .set({ status: "published", archivedAt: null, currentApprovedVersionId: version.id })
      .where(eq(schema.opportunities.id, publishedOpportunityId));
  });

  it("every table exposed to Supabase's data API has RLS enabled", async () => {
    const rows = await client.unsafe(
      `select relname from pg_class join pg_namespace on pg_namespace.oid = pg_class.relnamespace
       where nspname = 'public' and relkind = 'r' and relrowsecurity = false`,
    );
    expect(rows).toHaveLength(0);
  });

  describe("0011_narrow_staff_rls_policies.sql — narrowed staff-only tables", () => {
    it("a staff member can read their own staff_profiles row but not another's", async () => {
      const ownRow = await asRole("authenticated", staffId, (tx) => tx.select().from(schema.staffProfiles).where(eq(schema.staffProfiles.id, staffId)));
      expect(ownRow).toHaveLength(1);

      const othersRow = await asRole("authenticated", staffId, (tx) => tx.select().from(schema.staffProfiles).where(eq(schema.staffProfiles.id, reviewerId)));
      expect(othersRow).toHaveLength(0);
    });

    it("an administrator can read any staff_profiles row", async () => {
      const rows = await asRole("authenticated", administratorId, (tx) => tx.select().from(schema.staffProfiles).where(eq(schema.staffProfiles.id, staffId)));
      expect(rows).toHaveLength(1);
    });

    it("a staff member can read their own staff_role_assignments but not another's", async () => {
      const ownRow = await asRole("authenticated", staffId, (tx) => tx.select().from(schema.staffRoleAssignments).where(eq(schema.staffRoleAssignments.staffProfileId, staffId)));
      expect(ownRow.length).toBeGreaterThan(0);

      const othersRow = await asRole("authenticated", staffId, (tx) => tx.select().from(schema.staffRoleAssignments).where(eq(schema.staffRoleAssignments.staffProfileId, reviewerId)));
      expect(othersRow).toHaveLength(0);
    });

    it("a reviewer uninvolved in a review assignment cannot read it via direct REST", async () => {
      const rows = await asRole("authenticated", outsiderReviewerId, (tx) =>
        tx.select().from(schema.reviewAssignments).where(eq(schema.reviewAssignments.id, reviewAssignmentId)),
      );
      expect(rows).toHaveLength(0);
    });

    it("a reviewer who IS party to the review assignment (reviewer/assigner/subject author) can read it", async () => {
      const rows = await asRole("authenticated", reviewerId, (tx) =>
        tx.select().from(schema.reviewAssignments).where(eq(schema.reviewAssignments.id, reviewAssignmentId)),
      );
      expect(rows).toHaveLength(1);
    });

    it("an administrator can read any review assignment regardless of involvement", async () => {
      const rows = await asRole("authenticated", administratorId, (tx) =>
        tx.select().from(schema.reviewAssignments).where(eq(schema.reviewAssignments.id, reviewAssignmentId)),
      );
      expect(rows).toHaveLength(1);
    });

    it("a plain reviewer cannot read duplicate_candidates via direct REST", async () => {
      const rows = await asRole("authenticated", staffId, (tx) => tx.select().from(schema.duplicateCandidates).where(eq(schema.duplicateCandidates.id, duplicateCandidateId)));
      expect(rows).toHaveLength(0);
    });

    it("a senior_reviewer or administrator can read duplicate_candidates", async () => {
      const seniorRows = await asRole("authenticated", reviewerId, (tx) => tx.select().from(schema.duplicateCandidates).where(eq(schema.duplicateCandidates.id, duplicateCandidateId)));
      expect(seniorRows).toHaveLength(1);

      const adminRows = await asRole("authenticated", administratorId, (tx) => tx.select().from(schema.duplicateCandidates).where(eq(schema.duplicateCandidates.id, duplicateCandidateId)));
      expect(adminRows).toHaveLength(1);
    });

    it("a non-administrator staff member cannot read import_jobs via direct REST", async () => {
      const rows = await asRole("authenticated", reviewerId, (tx) => tx.select().from(schema.importJobs).where(eq(schema.importJobs.id, importJobId)));
      expect(rows).toHaveLength(0);
    });

    it("an administrator can read import_jobs", async () => {
      const rows = await asRole("authenticated", administratorId, (tx) => tx.select().from(schema.importJobs).where(eq(schema.importJobs.id, importJobId)));
      expect(rows).toHaveLength(1);
    });

    it("nobody — not even an administrator — can read import_job_rows via direct REST (service_role only)", async () => {
      await expectRejectionMatching(
        asRole("authenticated", administratorId, (tx) => tx.select().from(schema.importJobRows).where(eq(schema.importJobRows.id, importJobRowId))),
        /permission denied/i,
      );
    });

    it("service_role can still read import_job_rows", async () => {
      const rows = await asRole("service_role", null, (tx) => tx.select().from(schema.importJobRows).where(eq(schema.importJobRows.id, importJobRowId)));
      expect(rows).toHaveLength(1);
    });

    it("a non-administrator staff member cannot read audit_log via direct REST", async () => {
      const rows = await asRole("authenticated", reviewerId, (tx) => tx.select().from(schema.auditLog).where(eq(schema.auditLog.id, auditLogId)));
      expect(rows).toHaveLength(0);
    });

    it("an administrator can read audit_log", async () => {
      const rows = await asRole("authenticated", administratorId, (tx) => tx.select().from(schema.auditLog).where(eq(schema.auditLog.id, auditLogId)));
      expect(rows).toHaveLength(1);
    });
  });
});
