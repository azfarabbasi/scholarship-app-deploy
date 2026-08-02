import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as schema from "../../src/lib/db/schema";
import { parseSearchQuery } from "../../src/lib/search/query";
import { searchOpportunities } from "../../src/lib/search/service";
import { client, db, publishOpportunityForTest, uniqueSuffix } from "./helpers";

/**
 * Server-side search (`/api/search`, see `src/lib/search/service.ts`) must
 * only ever surface exactly what the public catalogue itself exposes —
 * published, non-draft, non-archived, non-merged content. This is the
 * server-side visibility guarantee unit tests can't cover on their own,
 * since `searchOpportunities()` reads straight from a real Postgres
 * connection via `getPublishedOpportunities()`.
 */
describe("server-side search: published-only visibility", () => {
  const suffix = uniqueSuffix();
  const reviewerId = "11111111-2222-4333-8444-555555555555";
  // Distinct from reviewerId — the stricter publish gate
  // (0010_publication_integrity_actors.sql) requires an independently
  // confirmed verification record and review assignment.
  const approverId = "11111111-2222-4333-8444-666666666666";
  let opportunityTypeId: string;
  let providerId: string;
  let organisationId: string;
  const opportunityIds: string[] = [];

  async function publishOpportunity(titleSuffix: string) {
    const [opportunity] = await db
      .insert(schema.opportunities)
      .values({
        slug: `search-visibility-${titleSuffix.toLowerCase()}-${suffix}`,
        title: `Search Visibility Fixture ${titleSuffix} ${suffix}`,
        summary: "summary",
        opportunityTypeId,
        providerId,
        status: "draft",
      })
      .returning();
    opportunityIds.push(opportunity.id);

    const [officialSource] = await db
      .insert(schema.officialSources)
      .values({
        url: `https://example.test/search-visibility/${titleSuffix}/${suffix}`,
        kind: "opportunity-page",
        label: "Test source",
        sourceOrganisationName: "Search Visibility Org",
        publisherOrganisationId: organisationId,
        status: "confirmed-official",
        lastCheckedAt: new Date(),
      })
      .returning();
    await db.insert(schema.opportunityOfficialSources).values({ opportunityId: opportunity.id, officialSourceId: officialSource.id });

    const [version] = await db
      .insert(schema.opportunityVersions)
      .values({ opportunityId: opportunity.id, versionNumber: 1, snapshot: {}, authorStaffProfileId: reviewerId })
      .returning();

    await publishOpportunityForTest({
      opportunityId: opportunity.id,
      officialSourceId: officialSource.id,
      versionId: version.id,
      reviewerStaffProfileId: reviewerId,
      approverStaffProfileId: approverId,
    });

    return opportunity.id;
  }

  beforeAll(async () => {
    const [opportunityType] = await db.select().from(schema.opportunityTypes).where(eq(schema.opportunityTypes.code, "scholarship"));
    if (!opportunityType) throw new Error("Taxonomies are not seeded.");
    opportunityTypeId = opportunityType.id;

    const [organisation] = await db
      .insert(schema.organisations)
      .values({ legalName: `Search Visibility Org ${suffix}`, displayName: `Search Visibility Org ${suffix}`, kind: "other", status: "active" })
      .returning();
    organisationId = organisation.id;
    const [provider] = await db
      .insert(schema.providers)
      .values({ organisationId, displayName: `Search Visibility Provider ${suffix}`, status: "active" })
      .returning();
    providerId = provider.id;

    await db
      .insert(schema.staffProfiles)
      .values({ id: reviewerId, email: `search-visibility-reviewer-${suffix}@example.test`, displayName: "Reviewer", status: "active" })
      .onConflictDoNothing({ target: schema.staffProfiles.id });
    await db
      .insert(schema.staffProfiles)
      .values({ id: approverId, email: `search-visibility-approver-${suffix}@example.test`, displayName: "Approver", status: "active" })
      .onConflictDoNothing({ target: schema.staffProfiles.id });

    // Published: must appear in search results.
    await publishOpportunity("Published");

    // Draft: created but never published — must never appear.
    await db.insert(schema.opportunities).values({
      slug: `search-visibility-draft-${suffix}`,
      title: `Search Visibility Fixture Draft ${suffix}`,
      summary: "summary",
      opportunityTypeId,
      providerId,
      status: "draft",
    });

    // Archived: published, then archived — must no longer appear.
    const archivedId = await publishOpportunity("Archived");
    await db
      .update(schema.opportunities)
      .set({ status: "archived", archivedAt: new Date() })
      .where(eq(schema.opportunities.id, archivedId));
  });

  afterAll(async () => {
    await db.delete(schema.opportunities).where(eq(schema.opportunities.slug, `search-visibility-draft-${suffix}`));
    // Deleting the opportunity directly cascades opportunity_versions/
    // opportunity_official_sources/verification_records/etc. via FK — unlike
    // a manual, separate delete of opportunity_official_sources first, this
    // never trips the "cannot unlink the sole qualifying source of a
    // published opportunity" guard: by the time the FK cascade removes the
    // join row, the parent opportunities row is already gone from this
    // transaction's view, so the trigger's "is it still published" check is
    // false and the cascade proceeds.
    for (const id of opportunityIds) {
      await db.delete(schema.opportunities).where(eq(schema.opportunities.id, id));
    }
    await db.delete(schema.staffProfiles).where(eq(schema.staffProfiles.id, reviewerId));
    await db.delete(schema.staffProfiles).where(eq(schema.staffProfiles.id, approverId));
    await client.end();
  });

  it("returns only the published fixture, never the draft or archived ones", async () => {
    const query = parseSearchQuery(new URLSearchParams({ q: `Search Visibility Fixture ${suffix}` }));
    const response = await searchOpportunities(query);
    const titles = response.items.map((item) => item.opportunity.title);
    expect(titles).toEqual([`Search Visibility Fixture Published ${suffix}`]);
  });

  it("never returns the draft fixture itself, even when the query text matches its exact title", async () => {
    const draftTitle = `Search Visibility Fixture Draft ${suffix}`;
    const query = parseSearchQuery(new URLSearchParams({ q: draftTitle }));
    const response = await searchOpportunities(query);
    expect(response.items.some((item) => item.opportunity.title === draftTitle)).toBe(false);
  });

  it("applies safe, deterministic pagination even when a page is requested past the end", async () => {
    const query = parseSearchQuery(new URLSearchParams({ q: `Search Visibility Fixture ${suffix}`, page: "999" }));
    const response = await searchOpportunities(query);
    // Never throws, and clamps back to the last real page rather than returning an out-of-range empty crash.
    expect(response.page).toBeLessThanOrEqual(response.pageCount);
    expect(response.items.length).toBeGreaterThan(0);
  });

  it("tolerates a small typo in the query (JS fallback or pg_trgm, whichever is available)", async () => {
    const typoQuery = `Serach Visibility Fixture ${suffix}`; // "Serach" instead of "Search"
    const query = parseSearchQuery(new URLSearchParams({ q: typoQuery }));
    const response = await searchOpportunities(query);
    expect(response.items.some((item) => item.opportunity.title.includes(`Published ${suffix}`))).toBe(true);
  });
});
