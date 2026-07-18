/**
 * Checkpoint 7: `npm run launch:content`.
 *
 * Computes the real content-readiness numbers directly from the database —
 * never estimated, never inflated. Degrades gracefully (reports "not
 * checked", exit 0) when no database is configured, matching this
 * project's established pattern (`isDatabaseConfigured()`), since this
 * script must be safe to run in any environment including plain CI. See
 * `docs/checkpoint-7/content-readiness-report.md` for the narrative report
 * built from a real run of this script.
 */
import "dotenv/config";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../src/lib/db/schema";

const PUBLISHED_TARGET = 100;

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.log("launch:content: DATABASE_URL is not set — content readiness was not checked.");
    console.log("This is expected in an environment with no database (e.g. plain CI). Run this against a");
    console.log("real or staging database before launch.");
    return;
  }

  const client = postgres(connectionString, { max: 1 });
  const db = drizzle(client, { schema });

  try {
    const opportunities = await db
      .select({ id: schema.opportunities.id, status: schema.opportunities.status, verification: schema.opportunities.overallVerificationStatus })
      .from(schema.opportunities);

    const total = opportunities.length;
    const byStatus = new Map<string, number>();
    for (const o of opportunities) {
      byStatus.set(o.status, (byStatus.get(o.status) ?? 0) + 1);
    }
    const published = byStatus.get("published") ?? 0;
    const verified = opportunities.filter((o) => o.verification === "verified").length;

    const sourcedIds = new Set(
      (await db.select({ opportunityId: schema.opportunityOfficialSources.opportunityId }).from(schema.opportunityOfficialSources)).map(
        (r) => r.opportunityId,
      ),
    );
    const eligibilityIds = new Set(
      (await db.select({ opportunityId: schema.eligibilityRules.opportunityId }).from(schema.eligibilityRules)).map((r) => r.opportunityId),
    );
    const documentIds = new Set(
      (await db.select({ opportunityId: schema.opportunityDocumentRequirements.opportunityId }).from(schema.opportunityDocumentRequirements)).map(
        (r) => r.opportunityId,
      ),
    );

    const deadlinePrecisionCounts = await db
      .select({ precision: schema.deadlineOccurrences.precision })
      .from(schema.deadlineOccurrences);
    const precisionTally = new Map<string, number>();
    for (const row of deadlinePrecisionCounts) {
      precisionTally.set(row.precision, (precisionTally.get(row.precision) ?? 0) + 1);
    }

    // Only meaningful for published records — an unpublished draft can't be "stale" in the
    // public-facing sense (see docs/checkpoint-6/backup-and-recovery.md §12).
    const publishedOpportunities = await db
      .select({ id: schema.opportunities.id })
      .from(schema.opportunities)
      .where(eq(schema.opportunities.status, "published"));
    const staleCount =
      publishedOpportunities.length > 0
        ? opportunities.filter((o) => o.status === "published" && o.verification === "stale").length
        : 0;

    console.log("Checkpoint 7 content readiness — real database numbers");
    console.log("========================================================");
    console.log(`Total opportunities: ${total}`);
    console.log(`Published: ${published}`);
    console.log(`Pending review (in_review): ${byStatus.get("in_review") ?? 0}`);
    console.log(`Draft: ${byStatus.get("draft") ?? 0}`);
    console.log(`Reviewed (not yet published): ${byStatus.get("reviewed") ?? 0}`);
    console.log(`Approved (not yet published): ${byStatus.get("approved") ?? 0}`);
    console.log(`Rejected: ${byStatus.get("rejected") ?? 0}`);
    console.log(`Archived: ${byStatus.get("archived") ?? 0}`);
    console.log(`With an official source: ${sourcedIds.size} / ${total}`);
    console.log(`Marked verified (overall_verification_status): ${verified} / ${total}`);
    console.log(`With structured eligibility rule data: ${eligibilityIds.size} / ${total}`);
    console.log(`With required-document data: ${documentIds.size} / ${total}`);
    console.log(`Stale (published but needing re-review): ${staleCount}`);
    console.log("Deadline precision:");
    for (const [precision, count] of precisionTally.entries()) {
      console.log(`  ${precision}: ${count}`);
    }

    console.log(`\n100-record target: ${published >= PUBLISHED_TARGET ? "MET" : "NOT MET"} (${published}/${PUBLISHED_TARGET} published)`);
    if (published < PUBLISHED_TARGET) {
      console.log(
        `This launch must be reported as "content target incomplete" — never claim the ${PUBLISHED_TARGET}-record target passed unless ` +
          "the published count above genuinely reaches it.",
      );
    }
  } finally {
    await client.end();
  }
}

main().catch((error: unknown) => {
  console.error("launch:content failed:", error);
  process.exit(1);
});
