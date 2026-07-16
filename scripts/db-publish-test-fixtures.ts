/**
 * TEST-ONLY fixture helper: publishes every draft, legacy-imported
 * opportunity by directly writing the version/status rows a senior reviewer
 * would normally produce through the staff review workflow UI.
 *
 * This script exists solely so the Playwright e2e suite (which has no real
 * Supabase staff credentials to drive the actual review UI) can exercise the
 * public, database-backed catalogue against realistic published data. It is
 * never used by the real editorial workflow and must never run against a
 * database that isn't a local/test one (see the guard below).
 */
import "dotenv/config";
import { eq, isNull, and, like } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../src/lib/db/schema";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL must be set.");
  process.exit(1);
}
if (!/scholartrack_test|localhost|127\.0\.0\.1|db-test/.test(connectionString)) {
  console.error("Refusing to run: this script is test-fixture-only and must not run against a non-local database.");
  process.exit(1);
}

const SYSTEM_MIGRATION_STAFF_ID = "00000000-0000-0000-0000-000000000001";

async function main() {
  const client = postgres(connectionString as string, { max: 1 });
  const db = drizzle(client, { schema });

  const drafts = await db
    .select()
    .from(schema.opportunities)
    .where(and(like(schema.opportunities.legacyMigrationReference, "legacy-id-%"), eq(schema.opportunities.status, "draft")));

  let published = 0;
  for (const opportunity of drafts) {
    const [version] = await db
      .insert(schema.opportunityVersions)
      .values({
        opportunityId: opportunity.id,
        versionNumber: 1,
        snapshot: {},
        authorStaffProfileId: SYSTEM_MIGRATION_STAFF_ID,
        reviewOutcome: "approved",
        publicationOutcome: "published",
      })
      .returning();

    await db
      .update(schema.opportunities)
      .set({ status: "published", publishedAt: new Date(), currentApprovedVersionId: version.id })
      .where(eq(schema.opportunities.id, opportunity.id));

    await db.update(schema.fundingBenefits).set({ status: "published" }).where(eq(schema.fundingBenefits.opportunityId, opportunity.id));
    await db.update(schema.eligibilityRules).set({ status: "active" }).where(eq(schema.eligibilityRules.opportunityId, opportunity.id));
    await db
      .update(schema.eligibilityRuleGroups)
      .set({ status: "active" })
      .where(eq(schema.eligibilityRuleGroups.opportunityId, opportunity.id));

    published += 1;
  }

  console.log(`Published ${published} test-fixture opportunity record(s) for e2e testing.`);

  const stillDraft = await db
    .select({ id: schema.opportunities.id })
    .from(schema.opportunities)
    .where(and(like(schema.opportunities.legacyMigrationReference, "legacy-id-%"), isNull(schema.opportunities.publishedAt)));
  console.log(`${stillDraft.length} legacy record(s) remain unpublished.`);

  await client.end();
}

main().catch((error: unknown) => {
  console.error("Publishing test fixtures failed:", error);
  process.exit(1);
});
