import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as schema from "../../src/lib/db/schema";
import { asRole, client, db, expectRejectionMatching, publishOpportunityForTest, uniqueSuffix } from "./helpers";

describe("student workspace row-level security", () => {
  const suffix = uniqueSuffix();
  const studentA = "44444444-4444-4444-4444-444444444444";
  const studentB = "55555555-5555-5555-5555-555555555555";
  const staffOnlyId = "66666666-6666-6666-6666-666666666666";
  // Distinct from staffOnlyId — the stricter publish gate
  // (0010_publication_integrity_actors.sql) requires an independently
  // confirmed verification record and review assignment.
  const approverId = "66666666-6666-6666-6666-777777777777";
  let opportunityId: string;
  let trackingAId: string;

  beforeAll(async () => {
    const [opportunityType] = await db.select().from(schema.opportunityTypes).where(eq(schema.opportunityTypes.code, "scholarship"));
    if (!opportunityType) {
      throw new Error("Taxonomies are not seeded. Run `npm run db:seed:taxonomies` against the test database first.");
    }

    const [organisation] = await db
      .insert(schema.organisations)
      .values({ legalName: `Student RLS Org ${suffix}`, displayName: `Student RLS Org ${suffix}`, kind: "other", status: "active" })
      .returning();
    const [provider] = await db
      .insert(schema.providers)
      .values({ organisationId: organisation.id, displayName: `Student RLS Provider ${suffix}`, status: "active" })
      .returning();

    await db
      .insert(schema.staffProfiles)
      .values({ id: staffOnlyId, email: `staff-only-${suffix}@example.test`, displayName: "Staff Only", status: "active" });
    await db.insert(schema.staffRoleAssignments).values({ staffProfileId: staffOnlyId, role: "reviewer" });
    await db
      .insert(schema.staffProfiles)
      .values({ id: approverId, email: `student-rls-approver-${suffix}@example.test`, displayName: "Approver", status: "active" });
    await db.insert(schema.staffRoleAssignments).values({ staffProfileId: approverId, role: "senior_reviewer" });

    const [opportunity] = await db
      .insert(schema.opportunities)
      .values({
        slug: `student-rls-test-${suffix}`,
        title: "Student RLS Test Opportunity",
        summary: "An opportunity for student-workspace RLS testing.",
        opportunityTypeId: opportunityType.id,
        providerId: provider.id,
        status: "draft",
      })
      .returning();
    opportunityId = opportunity.id;

    const [officialSource] = await db
      .insert(schema.officialSources)
      .values({
        url: `https://example.test/student-rls/${suffix}`,
        kind: "opportunity-page",
        label: "Test source",
        sourceOrganisationName: organisation.displayName,
        publisherOrganisationId: organisation.id,
        status: "confirmed-official",
        lastCheckedAt: new Date(),
      })
      .returning();
    await db.insert(schema.opportunityOfficialSources).values({ opportunityId, officialSourceId: officialSource.id });

    const [version] = await db
      .insert(schema.opportunityVersions)
      .values({ opportunityId, versionNumber: 1, snapshot: {}, authorStaffProfileId: staffOnlyId })
      .returning();

    await publishOpportunityForTest({
      opportunityId,
      officialSourceId: officialSource.id,
      versionId: version.id,
      reviewerStaffProfileId: staffOnlyId,
      approverStaffProfileId: approverId,
    });

    await db
      .insert(schema.studentProfiles)
      .values([
        { id: studentA, email: `student-a-${suffix}@example.test` },
        { id: studentB, email: `student-b-${suffix}@example.test` },
      ]);

    const [tracking] = await db
      .insert(schema.userOpportunityTracking)
      .values({ studentProfileId: studentA, opportunityId, shortlisted: true })
      .returning();
    trackingAId = tracking.id;
  });

  afterAll(async () => {
    await db.delete(schema.userOpportunityTracking).where(eq(schema.userOpportunityTracking.opportunityId, opportunityId));
    await db.delete(schema.opportunities).where(eq(schema.opportunities.id, opportunityId));
    await db.delete(schema.staffRoleAssignments).where(eq(schema.staffRoleAssignments.staffProfileId, staffOnlyId));
    await db.delete(schema.staffProfiles).where(eq(schema.staffProfiles.id, staffOnlyId));
    await db.delete(schema.staffRoleAssignments).where(eq(schema.staffRoleAssignments.staffProfileId, approverId));
    await db.delete(schema.staffProfiles).where(eq(schema.staffProfiles.id, approverId));
    await db.delete(schema.studentProfiles).where(eq(schema.studentProfiles.id, studentA));
    await db.delete(schema.studentProfiles).where(eq(schema.studentProfiles.id, studentB));
    await client.end();
  });

  it("a student can read their own profile", async () => {
    const rows = await asRole("authenticated", studentA, (tx) => tx.select().from(schema.studentProfiles));
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe(studentA);
  });

  it("a student cannot read another student's profile", async () => {
    const rows = await asRole("authenticated", studentB, (tx) =>
      tx.select().from(schema.studentProfiles).where(eq(schema.studentProfiles.id, studentA)),
    );
    expect(rows).toHaveLength(0);
  });

  it("anonymous cannot read any student profile (denied at the grant level, not just filtered by RLS)", async () => {
    await expectRejectionMatching(
      asRole("anon", null, (tx) => tx.select().from(schema.studentProfiles)),
      /permission denied/i,
    );
  });

  it("staff role does not automatically bypass student profile privacy", async () => {
    const rows = await asRole("authenticated", staffOnlyId, (tx) => tx.select().from(schema.studentProfiles));
    expect(rows).toHaveLength(0);
  });

  it("a student can read their own tracking row", async () => {
    const rows = await asRole("authenticated", studentA, (tx) =>
      tx.select().from(schema.userOpportunityTracking).where(eq(schema.userOpportunityTracking.opportunityId, opportunityId)),
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].studentProfileId).toBe(studentA);
  });

  it("a student cannot read another student's tracking row", async () => {
    const rows = await asRole("authenticated", studentB, (tx) =>
      tx.select().from(schema.userOpportunityTracking).where(eq(schema.userOpportunityTracking.opportunityId, opportunityId)),
    );
    expect(rows).toHaveLength(0);
  });

  it("a student cannot update another student's tracking row", async () => {
    await asRole("authenticated", studentB, (tx) =>
      tx.update(schema.userOpportunityTracking).set({ shortlisted: false }).where(eq(schema.userOpportunityTracking.id, trackingAId)),
    );

    const [row] = await db.select().from(schema.userOpportunityTracking).where(eq(schema.userOpportunityTracking.id, trackingAId));
    expect(row.shortlisted).toBe(true);
  });

  it("a student cannot insert a tracking row owned by someone else", async () => {
    await expectRejectionMatching(
      asRole("authenticated", studentB, (tx) =>
        tx.insert(schema.userOpportunityTracking).values({ studentProfileId: studentA, opportunityId, stage: "researching" }),
      ),
      /row-level security/i,
    );
  });

  it("anonymous cannot read tracking data (denied at the grant level, not just filtered by RLS)", async () => {
    await expectRejectionMatching(
      asRole("anon", null, (tx) => tx.select().from(schema.userOpportunityTracking)),
      /permission denied/i,
    );
  });

  it("a student can create and read their own note; another student cannot", async () => {
    await asRole("authenticated", studentA, (tx) =>
      tx.insert(schema.userNotes).values({ studentProfileId: studentA, targetType: "built-in", targetId: opportunityId, noteText: "Ask for a reference letter." }),
    );

    const own = await asRole("authenticated", studentA, (tx) => tx.select().from(schema.userNotes));
    expect(own).toHaveLength(1);

    const other = await asRole("authenticated", studentB, (tx) => tx.select().from(schema.userNotes));
    expect(other).toHaveLength(0);

    await db.delete(schema.userNotes).where(and(eq(schema.userNotes.studentProfileId, studentA), eq(schema.userNotes.targetId, opportunityId)));
  });

  it("a student cannot modify another student's checklist tasks", async () => {
    const [task] = await db
      .insert(schema.userChecklistTasks)
      .values({ studentProfileId: studentA, targetType: "built-in", targetId: opportunityId, taskText: "Request transcript" })
      .returning();

    await asRole("authenticated", studentB, (tx) =>
      tx.update(schema.userChecklistTasks).set({ completed: true }).where(eq(schema.userChecklistTasks.id, task.id)),
    );

    const [row] = await db.select().from(schema.userChecklistTasks).where(eq(schema.userChecklistTasks.id, task.id));
    expect(row.completed).toBe(false);

    await asRole("authenticated", studentB, (tx) => tx.delete(schema.userChecklistTasks).where(eq(schema.userChecklistTasks.id, task.id)));
    const [stillThere] = await db.select().from(schema.userChecklistTasks).where(eq(schema.userChecklistTasks.id, task.id));
    expect(stillThere).toBeDefined();

    await db.delete(schema.userChecklistTasks).where(eq(schema.userChecklistTasks.id, task.id));
  });

  it("a student cannot read another student's custom opportunities", async () => {
    const [custom] = await db
      .insert(schema.userCustomOpportunities)
      .values({
        studentProfileId: studentA,
        slug: `custom-${suffix}`,
        title: "My Custom Opportunity",
        opportunityType: "scholarship",
        benefitSummary: "Covers tuition",
        eligibilitySummary: "Open to all",
        deadlineKind: "unknown",
        deadlineRawText: "Rolling",
      })
      .returning();

    const other = await asRole("authenticated", studentB, (tx) =>
      tx.select().from(schema.userCustomOpportunities).where(eq(schema.userCustomOpportunities.id, custom.id)),
    );
    expect(other).toHaveLength(0);

    const own = await asRole("authenticated", studentA, (tx) =>
      tx.select().from(schema.userCustomOpportunities).where(eq(schema.userCustomOpportunities.id, custom.id)),
    );
    expect(own).toHaveLength(1);

    await db.delete(schema.userCustomOpportunities).where(eq(schema.userCustomOpportunities.id, custom.id));
  });

  it("user_data_requests is append-only for the owning student (no update/delete policy)", async () => {
    await asRole("authenticated", studentA, (tx) =>
      tx.insert(schema.userDataRequests).values({ studentProfileId: studentA, requestType: "export", status: "completed" }),
    );

    const [request] = await db.select().from(schema.userDataRequests).where(eq(schema.userDataRequests.studentProfileId, studentA));
    expect(request).toBeDefined();

    // No UPDATE policy exists for `authenticated` on this table, so RLS
    // silently narrows the update to zero matching rows rather than
    // throwing — the row must come back completely unchanged.
    await asRole("authenticated", studentA, (tx) =>
      tx.update(schema.userDataRequests).set({ status: "failed" }).where(eq(schema.userDataRequests.id, request.id)),
    );
    const [afterUpdateAttempt] = await db.select().from(schema.userDataRequests).where(eq(schema.userDataRequests.id, request.id));
    expect(afterUpdateAttempt.status).toBe("completed");

    await db.delete(schema.userDataRequests).where(eq(schema.userDataRequests.id, request.id));
  });
});
