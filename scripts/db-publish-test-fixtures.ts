/**
 * TEST-ONLY fixture helper: publishes every draft, legacy-imported
 * opportunity by directly writing the version/verification/review rows a
 * senior reviewer would normally produce through the staff review workflow
 * UI.
 *
 * This script exists solely so the Playwright e2e suite (which has no real
 * Supabase staff credentials to drive the actual review UI) can exercise the
 * public, database-backed catalogue against realistic published data. It is
 * never used by the real editorial workflow and must never run against a
 * database that isn't a local/test one (see the guard below).
 *
 * Must satisfy the same stricter publish gate every other publish path does
 * (`app.enforce_opportunity_publication_requirements()`, added in
 * `drizzle/0010_publication_integrity_actors.sql`): a `confirmed-official`
 * official source with a checked-at timestamp, a current `verified`
 * verification record tied to `accepted` evidence, an independently
 * approved revision (`review_outcome = 'approve'`), and an accepted/
 * completed review assignment — each requiring an APPROVER distinct from
 * the original creator/reviewer. `import-legacy-scholarships.ts` already
 * creates a `candidate` official source and `captured` evidence row per
 * opportunity (and the `SYSTEM_MIGRATION_STAFF_ID` staff profile this
 * script also uses as the reviewer/creator); this script's job is
 * promoting those to the qualifying statuses and adding the second,
 * distinct approver actor, exactly mirroring
 * `tests/integration/helpers.ts`'s `publishOpportunityForTest()`.
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
/** Distinct from the migration/reviewer actor above — the publish gate rejects a verification record/review assignment approved by its own reviewer. */
const SYSTEM_MIGRATION_APPROVER_ID = "00000000-0000-0000-0000-000000000002";

async function main() {
  const client = postgres(connectionString as string, { max: 1 });
  const db = drizzle(client, { schema });

  await db
    .insert(schema.staffProfiles)
    .values({ id: SYSTEM_MIGRATION_APPROVER_ID, email: "system-migration-approver@scholartrack.test", displayName: "System Migration Approver", status: "active" })
    .onConflictDoNothing({ target: schema.staffProfiles.id });
  await db
    .insert(schema.staffRoleAssignments)
    .values({ staffProfileId: SYSTEM_MIGRATION_APPROVER_ID, role: "senior_reviewer" })
    .onConflictDoNothing();

  const drafts = await db
    .select()
    .from(schema.opportunities)
    .where(and(like(schema.opportunities.legacyMigrationReference, "legacy-id-%"), eq(schema.opportunities.status, "draft")));

  let published = 0;
  for (const opportunity of drafts) {
    const [officialSourceLink] = await db
      .select({ officialSourceId: schema.opportunityOfficialSources.officialSourceId })
      .from(schema.opportunityOfficialSources)
      .where(eq(schema.opportunityOfficialSources.opportunityId, opportunity.id))
      .limit(1);
    const [evidenceRow] = await db
      .select({ id: schema.sourceEvidence.id })
      .from(schema.sourceEvidence)
      .where(eq(schema.sourceEvidence.opportunityId, opportunity.id))
      .limit(1);

    if (!officialSourceLink || !evidenceRow) {
      console.warn(`Skipping opportunity ${opportunity.id}: missing the official source/evidence import-legacy-scholarships.ts should have created.`);
      continue;
    }

    await db.transaction(async (tx) => {
      await tx
        .update(schema.officialSources)
        .set({ status: "confirmed-official", lastCheckedAt: new Date(), approvedByStaffProfileId: SYSTEM_MIGRATION_APPROVER_ID })
        .where(eq(schema.officialSources.id, officialSourceLink.officialSourceId));

      const [verificationRecord] = await tx
        .insert(schema.verificationRecords)
        .values({
          subjectKind: "opportunity",
          subjectId: opportunity.id,
          opportunityId: opportunity.id,
          reviewerStaffProfileId: SYSTEM_MIGRATION_STAFF_ID,
          approvedByStaffProfileId: SYSTEM_MIGRATION_APPROVER_ID,
          outcome: "verified",
          status: "verified",
          checkedAt: new Date(),
          summary: "Test-fixture verification for the e2e suite.",
        })
        .returning();

      // Must be linked back to this specific verification record (not just
      // promoted to "accepted") — the publish gate checks that link, not
      // merely the evidence row's own status.
      await tx
        .update(schema.sourceEvidence)
        .set({ status: "accepted", approvedByStaffProfileId: SYSTEM_MIGRATION_APPROVER_ID, verificationRecordId: verificationRecord.id })
        .where(eq(schema.sourceEvidence.id, evidenceRow.id));

      await tx.insert(schema.verificationRecordSources).values({ verificationRecordId: verificationRecord.id, officialSourceId: officialSourceLink.officialSourceId });

      await tx.insert(schema.reviewAssignments).values({
        subjectKind: "opportunity",
        subjectId: opportunity.id,
        opportunityId: opportunity.id,
        subjectAuthorStaffProfileId: SYSTEM_MIGRATION_STAFF_ID,
        reviewerStaffProfileId: SYSTEM_MIGRATION_APPROVER_ID,
        assignedByStaffProfileId: SYSTEM_MIGRATION_APPROVER_ID,
        requiredRole: "reviewer",
        status: "completed",
        completedAt: new Date(),
        decision: "mark-reviewed",
      });

      const [version] = await tx
        .insert(schema.opportunityVersions)
        .values({
          opportunityId: opportunity.id,
          versionNumber: 1,
          snapshot: {},
          authorStaffProfileId: SYSTEM_MIGRATION_STAFF_ID,
          reviewOutcome: "approve",
        })
        .returning();

      await tx
        .update(schema.opportunities)
        .set({ status: "published", publishedAt: new Date(), currentApprovedVersionId: version.id })
        .where(eq(schema.opportunities.id, opportunity.id));

      await tx.update(schema.fundingBenefits).set({ status: "published" }).where(eq(schema.fundingBenefits.opportunityId, opportunity.id));
      await tx.update(schema.eligibilityRules).set({ status: "active" }).where(eq(schema.eligibilityRules.opportunityId, opportunity.id));
      await tx
        .update(schema.eligibilityRuleGroups)
        .set({ status: "active" })
        .where(eq(schema.eligibilityRuleGroups.opportunityId, opportunity.id));
    });

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
