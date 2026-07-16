/**
 * Verifies the legacy migration's actual database state against the
 * original 55-record seed and reports honestly — never claims success it
 * cannot back up with a real count. Used by `npm run db:verify:migration`.
 */
import "dotenv/config";
import { eq, like } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../src/lib/db/schema";
import { opportunitySeedDatasetSchema } from "../src/lib/schemas/opportunity-seed";
import rawSeed from "../data/migrations/v0.1/scholarships.seed.json";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL must be set.");
  process.exit(1);
}

async function main() {
  const client = postgres(connectionString as string, { max: 1 });
  const db = drizzle(client, { schema });

  const expected = opportunitySeedDatasetSchema.parse(rawSeed).length;

  const imported = await db
    .select({ id: schema.opportunities.id, status: schema.opportunities.status, legacyMigrationReference: schema.opportunities.legacyMigrationReference })
    .from(schema.opportunities)
    .where(like(schema.opportunities.legacyMigrationReference, "legacy-id-%"));

  const withSource = await db
    .select({ opportunityId: schema.opportunityOfficialSources.opportunityId })
    .from(schema.opportunityOfficialSources);
  const withSourceIds = new Set(withSource.map((r) => r.opportunityId));

  const withFabricatedVerifiedDate = await db
    .select({ id: schema.opportunities.id })
    .from(schema.opportunities)
    .where(eq(schema.opportunities.overallVerificationStatus, "verified"));

  const published = imported.filter((o) => o.status === "published").length;
  const pendingReview = imported.filter((o) => o.status !== "published" && o.status !== "archived" && o.status !== "rejected").length;
  const missingSource = imported.filter((o) => !withSourceIds.has(o.id));

  console.log("Legacy migration verification report");
  console.log("=====================================");
  console.log(`Expected legacy records (from the seed file): ${expected}`);
  console.log(`Imported (traceable via legacy_migration_reference): ${imported.length}`);
  console.log(`Published: ${published}`);
  console.log(`Pending review (not yet published/archived/rejected): ${pendingReview}`);
  console.log(`With at least one official source: ${imported.length - missingSource.length}`);
  console.log(`Legacy-imported records incorrectly marked "verified": ${withFabricatedVerifiedDate.filter((v) => imported.some((o) => o.id === v.id)).length}`);

  const problems: string[] = [];
  if (imported.length !== expected) problems.push(`Expected ${expected} imported records, found ${imported.length}.`);
  if (missingSource.length > 0) problems.push(`${missingSource.length} imported record(s) have no official source.`);

  if (problems.length > 0) {
    console.log("\nISSUES FOUND:");
    problems.forEach((p) => console.log(`  - ${p}`));
    process.exitCode = 1;
  } else {
    console.log("\nNo issues found.");
  }

  await client.end();
}

main().catch((error: unknown) => {
  console.error("Verification failed:", error);
  process.exit(1);
});
