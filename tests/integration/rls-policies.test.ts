import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as schema from "../../src/lib/db/schema";
import { asRole, client, db, uniqueSuffix } from "./helpers";

describe("row-level security", () => {
  const suffix = uniqueSuffix();
  const staffId = "22222222-2222-2222-2222-222222222222";
  let opportunityTypeId: string;
  let providerId: string;
  let draftOpportunityId: string;
  let publishedOpportunityId: string;

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

    await db
      .update(schema.opportunities)
      .set({ status: "published", publishedAt: new Date(), currentApprovedVersionId: version.id })
      .where(eq(schema.opportunities.id, published.id));
  });

  afterAll(async () => {
    await db.delete(schema.opportunities).where(eq(schema.opportunities.id, draftOpportunityId));
    await db.delete(schema.opportunities).where(eq(schema.opportunities.id, publishedOpportunityId));
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
});
