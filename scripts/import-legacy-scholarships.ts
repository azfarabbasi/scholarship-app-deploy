/**
 * Idempotent importer for the versioned v0.1 migration seed
 * (`data/migrations/v0.1/scholarships.seed.json`) into the relational
 * database. See docs/checkpoint-2/migration-runbook.md for the full
 * operational procedure.
 *
 * Every imported record:
 *  - lands as a DRAFT, never published automatically ("do not mark a record
 *    verified merely because it exists in the seed file").
 *  - keeps overallVerificationStatus = 'unverified' regardless of what the
 *    legacy prototype claimed, because nothing has gone through this
 *    system's actual reviewer + official-source verification workflow yet.
 *  - is traceable back to its source record via `legacy_migration_reference`
 *    ("legacy-id-<n>"), which also makes re-running this script a safe no-op
 *    per record (idempotent).
 *  - preserves the original benefit/eligibility wording verbatim as a
 *    funding_benefits/eligibility_rules row (not a fabricated structured
 *    claim) and keeps migrationNotes in the opportunity description.
 *  - gets one official_sources row in `candidate` status (not
 *    `confirmed-official` — that upgrade is a human reviewer decision) and
 *    exactly one linked source_evidence row.
 *
 * Usage:
 *   npm run db:import:legacy:dry-run   (validates + previews, writes nothing)
 *   npm run db:import:legacy           (writes; safe to re-run)
 *   npm run db:import:legacy:rollback  (deletes everything the most recent
 *                                       non-rolled-back legacy import job created)
 */
import "dotenv/config";
import { and, desc, eq, ne } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import rawSeed from "../data/migrations/v0.1/scholarships.seed.json";
import * as schema from "../src/lib/db/schema";
import { opportunitySeedDatasetSchema, type OpportunitySeed } from "../src/lib/schemas/opportunity-seed";

const args = process.argv.slice(2);
const isDryRun = args.includes("--dry-run");
const isRollback = args.includes("--rollback");

const PLACEHOLDER_ORGANISATION_NAME = "Legacy migration — provider pending identification";
/** Fixed id for the "System Service" identity this script ingests evidence as (never publishes/approves). */
const SYSTEM_MIGRATION_STAFF_ID = "00000000-0000-0000-0000-000000000001";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL must be set.");
  process.exit(1);
}

function slugConflictSuffix(base: string, taken: Set<string>): string {
  if (!taken.has(base)) return base;
  let counter = 2;
  while (taken.has(`${base}-${counter}`)) counter += 1;
  return `${base}-${counter}`;
}

/**
 * Rolls back every currently-imported legacy record, not just the single
 * most recent run: an idempotent re-run after the first real import creates
 * its own (empty) job row, so "most recent job" alone would often point at a
 * run that created nothing. Collecting "created" rows across every
 * not-yet-rolled-back legacy-json-seed job correctly undoes the cumulative
 * imported state regardless of how many runs contributed to it.
 */
async function rollback(db: ReturnType<typeof drizzle<typeof schema>>) {
  const jobs = await db
    .select()
    .from(schema.importJobs)
    .where(
      and(
        eq(schema.importJobs.sourceKind, "legacy-json-seed"),
        eq(schema.importJobs.dryRun, false),
        ne(schema.importJobs.status, "rolled-back"),
      ),
    )
    .orderBy(desc(schema.importJobs.startedAt));

  if (jobs.length === 0) {
    console.log("No rollback-eligible legacy import job found.");
    return;
  }

  let deleted = 0;
  for (const job of jobs) {
    const rows = await db
      .select()
      .from(schema.importJobRows)
      .where(and(eq(schema.importJobRows.importJobId, job.id), eq(schema.importJobRows.outcome, "created")));

    for (const row of rows) {
      if (!row.opportunityId) continue;
      const stillExists = await db.select({ id: schema.opportunities.id }).from(schema.opportunities).where(eq(schema.opportunities.id, row.opportunityId));
      if (stillExists.length > 0) {
        await db.delete(schema.opportunities).where(eq(schema.opportunities.id, row.opportunityId));
        deleted += 1;
      }
    }

    await db.update(schema.importJobs).set({ status: "rolled-back" }).where(eq(schema.importJobs.id, job.id));
  }

  console.log(`Rolled back ${jobs.length} import job(s): deleted ${deleted} opportunity record(s).`);
}

async function ensurePlaceholderProvider(db: ReturnType<typeof drizzle<typeof schema>>) {
  let [organisation] = await db.select().from(schema.organisations).where(eq(schema.organisations.displayName, PLACEHOLDER_ORGANISATION_NAME));
  if (!organisation) {
    [organisation] = await db
      .insert(schema.organisations)
      .values({ legalName: PLACEHOLDER_ORGANISATION_NAME, displayName: PLACEHOLDER_ORGANISATION_NAME, kind: "other", status: "draft" })
      .returning();
  }
  let [provider] = await db.select().from(schema.providers).where(eq(schema.providers.organisationId, organisation.id));
  if (!provider) {
    [provider] = await db
      .insert(schema.providers)
      .values({ organisationId: organisation.id, displayName: PLACEHOLDER_ORGANISATION_NAME, status: "draft" })
      .returning();
  }
  return { organisation, provider };
}

/**
 * A non-human "System Service" identity (see docs/checkpoint-0/roles-and-permissions.md)
 * that this script uses only to attribute the source_evidence rows it
 * captures. A System Service may ingest candidate evidence but can never
 * approve or publish — enforced by never granting this id a reviewer/senior
 * reviewer/administrator role.
 */
async function ensureSystemMigrationStaffProfile(db: ReturnType<typeof drizzle<typeof schema>>) {
  await db
    .insert(schema.staffProfiles)
    .values({
      id: SYSTEM_MIGRATION_STAFF_ID,
      email: "system-migration@scholartrack.internal",
      displayName: "System: legacy migration import",
      status: "active",
    })
    .onConflictDoNothing({ target: schema.staffProfiles.id });

  const [existingAssignment] = await db
    .select()
    .from(schema.staffRoleAssignments)
    .where(and(eq(schema.staffRoleAssignments.staffProfileId, SYSTEM_MIGRATION_STAFF_ID), eq(schema.staffRoleAssignments.role, "system_service")));
  if (!existingAssignment) {
    await db.insert(schema.staffRoleAssignments).values({ staffProfileId: SYSTEM_MIGRATION_STAFF_ID, role: "system_service" });
  }
}

async function main() {
  const client = postgres(connectionString as string, { max: 1 });
  const db = drizzle(client, { schema });

  if (isRollback) {
    await rollback(db);
    await client.end();
    return;
  }

  const parseResult = opportunitySeedDatasetSchema.safeParse(rawSeed);
  if (!parseResult.success) {
    console.error("The seed file failed schema validation:", parseResult.error.issues);
    process.exit(1);
  }
  const records: OpportunitySeed[] = parseResult.data;

  const existingOpportunities = await db.select({ slug: schema.opportunities.slug, legacyMigrationReference: schema.opportunities.legacyMigrationReference }).from(schema.opportunities);
  const existingSlugs = new Set(existingOpportunities.map((o) => o.slug));
  const alreadyImportedRefs = new Set(existingOpportunities.map((o) => o.legacyMigrationReference).filter(Boolean));

  const allCountries = await db.select().from(schema.countries);
  const allStudyLevels = await db.select().from(schema.studyLevels);
  const [scholarshipType] = await db.select().from(schema.opportunityTypes).where(eq(schema.opportunityTypes.code, "scholarship"));
  const [fundingType] = await db.select().from(schema.fundingTypes).where(eq(schema.fundingTypes.code, "unspecified"));

  if (!scholarshipType) {
    console.error('The "scholarship" opportunity type is not seeded. Run `npm run db:seed:taxonomies` first.');
    process.exit(1);
  }

  if (!isDryRun) {
    await ensureSystemMigrationStaffProfile(db);
  }
  const { organisation, provider } = isDryRun ? { organisation: null, provider: null } : await ensurePlaceholderProvider(db);

  const rowOutcomes: { legacyId: number; outcome: string; reason?: string }[] = [];
  let accepted = 0;
  let skippedDuplicate = 0;
  let rejected = 0;
  const jobRowRecords: { rowNumber: number; legacyReference: string; outcome: "created" | "skipped-duplicate" | "rejected"; opportunityId: string | null; errors: unknown }[] = [];

  for (const record of records) {
    const legacyReference = `legacy-id-${record.legacyId}`;

    if (alreadyImportedRefs.has(legacyReference)) {
      skippedDuplicate += 1;
      rowOutcomes.push({ legacyId: record.legacyId, outcome: "skipped-duplicate (already imported)" });
      jobRowRecords.push({ rowNumber: record.legacyId, legacyReference, outcome: "skipped-duplicate", opportunityId: null, errors: null });
      continue;
    }

    const countryIds = record.countries.map((name) => allCountries.find((c) => c.name === name)?.id).filter((id): id is string => Boolean(id));
    const studyLevelIds = record.studyLevels.map((label) => allStudyLevels.find((s) => s.label === label)?.id).filter((id): id is string => Boolean(id));

    if (countryIds.length !== record.countries.length || studyLevelIds.length !== record.studyLevels.length) {
      rejected += 1;
      rowOutcomes.push({ legacyId: record.legacyId, outcome: "rejected", reason: "Unknown country or study level — run db:seed:taxonomies" });
      jobRowRecords.push({ rowNumber: record.legacyId, legacyReference, outcome: "rejected", opportunityId: null, errors: ["Unknown country or study level"] });
      continue;
    }

    if (isDryRun) {
      accepted += 1;
      rowOutcomes.push({ legacyId: record.legacyId, outcome: "would-create" });
      continue;
    }

    const slug = slugConflictSuffix(record.slug, existingSlugs);
    existingSlugs.add(slug);

    const description =
      record.migrationNotes.length > 0 ? `Migration notes (from the v0.1 legacy seed):\n${record.migrationNotes.map((n) => `- ${n}`).join("\n")}` : null;

    const [opportunity] = await db
      .insert(schema.opportunities)
      .values({
        slug,
        title: record.title,
        summary: record.benefitSummary.slice(0, 300),
        description,
        opportunityTypeId: scholarshipType.id,
        providerId: provider!.id,
        officialWebsiteUrl: record.officialUrl,
        status: "draft",
        overallVerificationStatus: "unverified",
        legacyMigrationReference: legacyReference,
      })
      .returning();

    if (countryIds.length > 0) {
      await db.insert(schema.opportunityCountries).values(countryIds.map((countryId) => ({ opportunityId: opportunity.id, countryId })));
    }
    if (studyLevelIds.length > 0) {
      await db.insert(schema.opportunityStudyLevels).values(studyLevelIds.map((studyLevelId) => ({ opportunityId: opportunity.id, studyLevelId })));
    }
    if (record.regions.includes("European Union")) {
      const [euRegion] = await db.select().from(schema.regions).where(eq(schema.regions.code, "EU"));
      if (euRegion) {
        await db.insert(schema.opportunityRegions).values({ opportunityId: opportunity.id, regionId: euRegion.id });
      }
    }

    if (fundingType) {
      await db.insert(schema.fundingBenefits).values({
        opportunityId: opportunity.id,
        fundingTypeId: fundingType.id,
        kind: "other",
        summary: record.benefitSummary,
        status: "draft",
      });
    }

    const [officialSource] = await db
      .insert(schema.officialSources)
      .values({
        url: record.officialUrl,
        kind: "opportunity-page",
        label: record.title,
        sourceOrganisationName: organisation!.displayName,
        publisherOrganisationId: organisation!.id,
        status: "candidate",
      })
      .returning();
    await db.insert(schema.opportunityOfficialSources).values({ opportunityId: opportunity.id, officialSourceId: officialSource.id });

    const [evidence] = await db
      .insert(schema.sourceEvidence)
      .values({
        opportunityId: opportunity.id,
        officialSourceId: officialSource.id,
        kind: "eligibility",
        evidenceText: record.eligibilitySummary,
        sourceLocator: record.source.sourceReference,
        capturedByStaffProfileId: SYSTEM_MIGRATION_STAFF_ID,
        status: "captured",
      })
      .returning();

    if (evidence) {
      const [group] = await db
        .insert(schema.eligibilityRuleGroups)
        .values({ opportunityId: opportunity.id, label: "General eligibility", operator: "all", status: "draft", sourceEvidenceId: evidence.id })
        .returning();
      await db.insert(schema.eligibilityRules).values({
        opportunityId: opportunity.id,
        ruleGroupId: group.id,
        kind: "other",
        fieldKey: "general",
        operator: "exists",
        explanation: record.eligibilitySummary,
        sourceEvidenceId: evidence.id,
        status: "draft",
      });
    }

    const [cycle] = await db
      .insert(schema.deadlineCycles)
      .values({ opportunityId: opportunity.id, cycleYear: record.deadline.cycleYear, status: "draft" })
      .returning();

    const precision = record.deadline.precision;
    const closingDate = record.deadline.dates[0] ?? null;
    await db.insert(schema.deadlineOccurrences).values({
      deadlineCycleId: cycle.id,
      precision,
      closingDate: precision === "exact" || precision === "estimated" ? closingDate : null,
      closingIsEstimated: precision === "estimated",
      rawText: record.deadline.rawText,
      sourceTimezone: record.deadline.timezone,
      verificationStatus: "unverified",
      status: "draft",
    });

    accepted += 1;
    rowOutcomes.push({ legacyId: record.legacyId, outcome: "created" });
    jobRowRecords.push({ rowNumber: record.legacyId, legacyReference, outcome: "created", opportunityId: opportunity.id, errors: null });
  }

  if (!isDryRun) {
    const [job] = await db
      .insert(schema.importJobs)
      .values({
        sourceKind: "legacy-json-seed",
        sourceFilename: "data/migrations/v0.1/scholarships.seed.json",
        status: rejected > 0 ? "completed-with-errors" : "completed",
        dryRun: false,
        totalRows: records.length,
        acceptedRows: accepted,
        rejectedRows: rejected,
        duplicateWarnings: skippedDuplicate,
        completedAt: new Date(),
        resultSummary: { accepted, skippedDuplicate, rejected },
      })
      .returning();

    if (jobRowRecords.length > 0) {
      await db.insert(schema.importJobRows).values(
        jobRowRecords.map((row) => ({
          importJobId: job.id,
          rowNumber: row.rowNumber,
          legacyReference: row.legacyReference,
          outcome: row.outcome,
          opportunityId: row.opportunityId,
          errors: row.errors,
        })),
      );
    }
  }

  console.log(`\n${isDryRun ? "DRY RUN — " : ""}Legacy migration import summary`);
  console.log(`Total records: ${records.length}`);
  console.log(`Created: ${accepted}`);
  console.log(`Skipped as already imported: ${skippedDuplicate}`);
  console.log(`Rejected: ${rejected}`);
  console.log("\nAll imported records land as DRAFT and unverified — none are published automatically.");
  if (rejected > 0) {
    console.log("\nRejected records:");
    for (const row of rowOutcomes.filter((r) => r.outcome === "rejected")) {
      console.log(`  legacy-id-${row.legacyId}: ${row.reason}`);
    }
  }

  await client.end();
}

main().catch((error: unknown) => {
  console.error("Legacy import failed:", error);
  process.exit(1);
});
