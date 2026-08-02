import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as schema from "../../src/lib/db/schema";
import { retrieveForQuestion } from "../../src/lib/ai/rag/retrieval";
import { db, client, publishOpportunityForTest, uniqueSuffix } from "./helpers";

/**
 * Phase 3 items 4/5: retrieval must only ever surface `approved` chunks for
 * a currently-`published` opportunity, and a scope naming one or more real
 * opportunity slugs that don't resolve to anything must return zero results
 * — never silently fall back to an unscoped global search.
 */
describe("AI retrieval security (Phase 3 items 4 and 5)", () => {
  const suffix = uniqueSuffix();
  const staffId = "77777777-7777-4777-a777-777777777777";
  const approverId = "88888888-8888-4888-a888-888888888888";

  let opportunityId: string;
  let opportunitySlug: string;
  let documentId: string;
  let approvedChunkId: string;
  let draftChunkId: string;
  let rejectedChunkId: string;
  let staleChunkId: string;

  beforeAll(async () => {
    const [opportunityType] = await db.select().from(schema.opportunityTypes).where(eq(schema.opportunityTypes.code, "scholarship"));
    if (!opportunityType) {
      throw new Error("Taxonomies are not seeded. Run `npm run db:seed:taxonomies` against the test database first.");
    }

    const [organisation] = await db
      .insert(schema.organisations)
      .values({ legalName: `AI Retrieval Org ${suffix}`, displayName: `AI Retrieval Org ${suffix}`, kind: "other", status: "active" })
      .returning();
    const [provider] = await db
      .insert(schema.providers)
      .values({ organisationId: organisation.id, displayName: `AI Retrieval Provider ${suffix}`, status: "active" })
      .returning();

    await db
      .insert(schema.staffProfiles)
      .values({ id: staffId, email: `ai-retrieval-staff-${suffix}@example.test`, displayName: "Staff", status: "active" });
    await db.insert(schema.staffRoleAssignments).values({ staffProfileId: staffId, role: "reviewer" });
    await db
      .insert(schema.staffProfiles)
      .values({ id: approverId, email: `ai-retrieval-approver-${suffix}@example.test`, displayName: "Approver", status: "active" });
    await db.insert(schema.staffRoleAssignments).values({ staffProfileId: approverId, role: "senior_reviewer" });

    opportunitySlug = `ai-retrieval-test-${suffix}`;
    const [opportunity] = await db
      .insert(schema.opportunities)
      .values({
        slug: opportunitySlug,
        title: "AI Retrieval Test Scholarship",
        summary: "A published opportunity for AI retrieval testing.",
        opportunityTypeId: opportunityType.id,
        providerId: provider.id,
        status: "draft",
      })
      .returning();
    opportunityId = opportunity.id;

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
    await db.insert(schema.opportunityOfficialSources).values({ opportunityId, officialSourceId: officialSource.id });

    const [version] = await db
      .insert(schema.opportunityVersions)
      .values({ opportunityId, versionNumber: 1, snapshot: {}, authorStaffProfileId: staffId })
      .returning();

    await publishOpportunityForTest({
      opportunityId,
      officialSourceId: officialSource.id,
      versionId: version.id,
      reviewerStaffProfileId: staffId,
      approverStaffProfileId: approverId,
    });

    const [document] = await db
      .insert(schema.aiSourceDocuments)
      .values({
        opportunityId,
        officialSourceId: officialSource.id,
        title: "Test source excerpt",
        sourceText: "Applicants must submit a full application including transcripts by the stated deadline.",
        status: "approved",
        createdByStaffProfileId: staffId,
        approvedByStaffProfileId: approverId,
      })
      .returning();
    documentId = document.id;

    const [approvedChunk] = await db
      .insert(schema.aiSourceChunks)
      .values({
        documentId,
        opportunityId,
        officialSourceId: officialSource.id,
        chunkIndex: 0,
        chunkText: `Approved chunk unique marker ${suffix}: applicants must submit transcripts by the deadline.`,
        status: "approved",
      })
      .returning();
    approvedChunkId = approvedChunk.id;

    const [draftChunk] = await db
      .insert(schema.aiSourceChunks)
      .values({
        documentId,
        opportunityId,
        officialSourceId: officialSource.id,
        chunkIndex: 1,
        chunkText: `Draft chunk unique marker ${suffix}: this text is not yet approved for retrieval.`,
        status: "draft",
      })
      .returning();
    draftChunkId = draftChunk.id;

    const [rejectedChunk] = await db
      .insert(schema.aiSourceChunks)
      .values({
        documentId,
        opportunityId,
        officialSourceId: officialSource.id,
        chunkIndex: 2,
        chunkText: `Rejected chunk unique marker ${suffix}: this text was rejected and must never be retrievable.`,
        status: "rejected",
      })
      .returning();
    rejectedChunkId = rejectedChunk.id;

    const [staleChunk] = await db
      .insert(schema.aiSourceChunks)
      .values({
        documentId,
        opportunityId,
        officialSourceId: officialSource.id,
        chunkIndex: 3,
        chunkText: `Stale chunk unique marker ${suffix}: this text is stale and must never be retrievable.`,
        status: "stale",
      })
      .returning();
    staleChunkId = staleChunk.id;
  });

  afterAll(async () => {
    await db.delete(schema.aiSourceChunks).where(eq(schema.aiSourceChunks.documentId, documentId));
    await db.delete(schema.aiSourceDocuments).where(eq(schema.aiSourceDocuments.id, documentId));
    await db.delete(schema.opportunities).where(eq(schema.opportunities.id, opportunityId));
    await db.delete(schema.staffRoleAssignments).where(eq(schema.staffRoleAssignments.staffProfileId, approverId));
    await db.delete(schema.staffProfiles).where(eq(schema.staffProfiles.id, approverId));
    await db.delete(schema.staffRoleAssignments).where(eq(schema.staffRoleAssignments.staffProfileId, staffId));
    await db.delete(schema.staffProfiles).where(eq(schema.staffProfiles.id, staffId));
    await client.end();
  });

  it("retrieves only the approved chunk, never draft/rejected/stale chunks for the same document", async () => {
    const result = await retrieveForQuestion({ question: "unique marker", opportunitySlugs: [opportunitySlug] });

    const chunkIds = result.sources.map((s) => s.chunkId);
    expect(chunkIds).toContain(approvedChunkId);
    expect(chunkIds).not.toContain(draftChunkId);
    expect(chunkIds).not.toContain(rejectedChunkId);
    expect(chunkIds).not.toContain(staleChunkId);
  });

  it("returns zero results for a scope naming a slug that doesn't resolve to any real opportunity, never falling back to a global search", async () => {
    const result = await retrieveForQuestion({
      question: "unique marker",
      opportunitySlugs: [`nonexistent-slug-${suffix}`],
    });

    expect(result.sources).toHaveLength(0);
    expect(result.structuredFacts).toHaveLength(0);
  });

  it("still searches globally (unscoped) when no opportunitySlugs are given at all", async () => {
    const result = await retrieveForQuestion({ question: "unique marker" });

    // Global search still finds the approved chunk (no scope restriction applied).
    expect(result.sources.map((s) => s.chunkId)).toContain(approvedChunkId);
  });
});
