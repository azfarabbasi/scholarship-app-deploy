"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { recordAuditEvent } from "@/lib/audit/log";
import { canRunImports } from "@/lib/auth/permissions";
import { getStaffSession } from "@/lib/auth/session";
import { getDb, schema } from "@/lib/db/client";
import { CsvParseError, parseCsvTable } from "@/lib/csv/parse";
import {
  OPPORTUNITY_CSV_COLUMNS,
  opportunityCsvRowSchema,
  splitSemicolonList,
  type OpportunityCsvRow,
} from "@/lib/csv/opportunity-import";

export interface CsvRowOutcome {
  rowNumber: number;
  outcome: "would-create" | "would-skip-duplicate" | "would-reject" | "created" | "skipped-duplicate" | "rejected";
  errors?: string[];
  title?: string;
}

export interface CsvImportResult {
  ok: boolean;
  error?: string;
  totalRows: number;
  accepted: number;
  rejected: number;
  duplicateWarnings: number;
  rows: CsvRowOutcome[];
  importJobId?: string;
}

async function resolveRowReferences(row: OpportunityCsvRow) {
  const db = getDb();
  const errors: string[] = [];

  const [opportunityType] = await db
    .select({ id: schema.opportunityTypes.id })
    .from(schema.opportunityTypes)
    .where(eq(schema.opportunityTypes.code, row.opportunityTypeCode as never));
  if (!opportunityType) errors.push(`Unknown opportunityTypeCode "${row.opportunityTypeCode}"`);

  const countryNames = splitSemicolonList(row.countries);
  const allCountries = await db.select().from(schema.countries);
  const countryIds = countryNames.map((name) => allCountries.find((c) => c.name.toLowerCase() === name.toLowerCase())?.id).filter((id): id is string => Boolean(id));
  if (countryIds.length !== countryNames.length) errors.push(`One or more unknown countries in "${row.countries}"`);

  const studyLevelNames = splitSemicolonList(row.studyLevels);
  const allStudyLevels = await db.select().from(schema.studyLevels);
  const studyLevelIds = studyLevelNames
    .map((name) => allStudyLevels.find((s) => s.label.toLowerCase() === name.toLowerCase())?.id)
    .filter((id): id is string => Boolean(id));
  if (studyLevelIds.length !== studyLevelNames.length) errors.push(`One or more unknown study levels in "${row.studyLevels}"`);

  return { opportunityTypeId: opportunityType?.id, countryIds, studyLevelIds, errors };
}

function slugify(title: string): string {
  return (
    title
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "opportunity"
  );
}

export async function runOpportunityCsvImport(fileText: string, dryRun: boolean): Promise<CsvImportResult> {
  const session = await getStaffSession();
  if (!session || !canRunImports(session.roles)) {
    return { ok: false, error: "Not permitted.", totalRows: 0, accepted: 0, rejected: 0, duplicateWarnings: 0, rows: [] };
  }

  let table;
  try {
    table = parseCsvTable(fileText, OPPORTUNITY_CSV_COLUMNS);
  } catch (error) {
    const message = error instanceof CsvParseError ? error.message : "Could not parse this file as CSV.";
    return { ok: false, error: message, totalRows: 0, accepted: 0, rejected: 0, duplicateWarnings: 0, rows: [] };
  }

  const db = getDb();
  const existingOpportunities = await db.select({ title: schema.opportunities.title, slug: schema.opportunities.slug }).from(schema.opportunities);
  const existingTitles = new Set(existingOpportunities.map((o) => o.title.trim().toLowerCase()));
  const existingSlugs = new Set(existingOpportunities.map((o) => o.slug));

  const outcomes: CsvRowOutcome[] = [];
  let accepted = 0;
  let rejected = 0;
  let duplicateWarnings = 0;

  for (let i = 0; i < table.rows.length; i += 1) {
    const rowNumber = i + 2; // account for the header row
    const parsed = opportunityCsvRowSchema.safeParse(table.rows[i]);

    if (!parsed.success) {
      rejected += 1;
      outcomes.push({
        rowNumber,
        outcome: dryRun ? "would-reject" : "rejected",
        errors: parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`),
      });
      continue;
    }

    if (existingTitles.has(parsed.data.title.trim().toLowerCase())) {
      duplicateWarnings += 1;
      outcomes.push({ rowNumber, outcome: dryRun ? "would-skip-duplicate" : "skipped-duplicate", title: parsed.data.title });
      continue;
    }

    const refs = await resolveRowReferences(parsed.data);
    if (refs.errors.length > 0) {
      rejected += 1;
      outcomes.push({ rowNumber, outcome: dryRun ? "would-reject" : "rejected", errors: refs.errors, title: parsed.data.title });
      continue;
    }

    if (dryRun) {
      accepted += 1;
      outcomes.push({ rowNumber, outcome: "would-create", title: parsed.data.title });
      continue;
    }

    try {
      await db.transaction(async (tx) => {
        let [organisation] = await tx.select().from(schema.organisations).where(eq(schema.organisations.displayName, parsed.data.organisationName));
        if (!organisation) {
          [organisation] = await tx
            .insert(schema.organisations)
            .values({
              legalName: parsed.data.organisationName,
              displayName: parsed.data.organisationName,
              kind: "other",
              status: "active",
              createdByStaffProfileId: session.staffProfileId,
              updatedByStaffProfileId: session.staffProfileId,
            })
            .returning();
        }

        let [provider] = await tx.select().from(schema.providers).where(eq(schema.providers.displayName, parsed.data.providerName));
        if (!provider) {
          [provider] = await tx
            .insert(schema.providers)
            .values({
              organisationId: organisation.id,
              displayName: parsed.data.providerName,
              status: "active",
              createdByStaffProfileId: session.staffProfileId,
              updatedByStaffProfileId: session.staffProfileId,
            })
            .returning();
        }

        let slug = slugify(parsed.data.title);
        if (existingSlugs.has(slug)) {
          let counter = 2;
          while (existingSlugs.has(`${slug}-${counter}`)) counter += 1;
          slug = `${slug}-${counter}`;
        }
        existingSlugs.add(slug);

        const [opportunity] = await tx
          .insert(schema.opportunities)
          .values({
            slug,
            title: parsed.data.title,
            summary: parsed.data.summary,
            opportunityTypeId: refs.opportunityTypeId as string,
            providerId: provider.id,
            applicationUrl: parsed.data.applicationUrl || null,
            officialWebsiteUrl: parsed.data.officialWebsiteUrl || null,
            status: "draft",
            createdByStaffProfileId: session.staffProfileId,
            updatedByStaffProfileId: session.staffProfileId,
          })
          .returning();

        if (refs.countryIds.length > 0) {
          await tx.insert(schema.opportunityCountries).values(refs.countryIds.map((countryId) => ({ opportunityId: opportunity.id, countryId })));
        }
        if (refs.studyLevelIds.length > 0) {
          await tx.insert(schema.opportunityStudyLevels).values(refs.studyLevelIds.map((studyLevelId) => ({ opportunityId: opportunity.id, studyLevelId })));
        }

        const [fundingType] = await tx.select().from(schema.fundingTypes).where(eq(schema.fundingTypes.code, "unspecified"));
        if (fundingType) {
          await tx.insert(schema.fundingBenefits).values({
            opportunityId: opportunity.id,
            fundingTypeId: fundingType.id,
            kind: "other",
            summary: parsed.data.benefitSummary,
            status: "draft",
            createdByStaffProfileId: session.staffProfileId,
          });
        }

        const [officialSource] = await tx
          .insert(schema.officialSources)
          .values({
            url: parsed.data.sourceUrl,
            kind: "opportunity-page",
            label: parsed.data.title,
            sourceOrganisationName: parsed.data.sourceOrganisationName,
            publisherOrganisationId: organisation.id,
            status: "candidate",
            lastCheckedAt: parsed.data.sourceLastCheckedAt ? new Date(parsed.data.sourceLastCheckedAt) : null,
            createdByStaffProfileId: session.staffProfileId,
          })
          .returning();
        await tx.insert(schema.opportunityOfficialSources).values({ opportunityId: opportunity.id, officialSourceId: officialSource.id });

        const [evidence] = await tx
          .insert(schema.sourceEvidence)
          .values({
            opportunityId: opportunity.id,
            officialSourceId: officialSource.id,
            kind: "eligibility",
            evidenceText: parsed.data.eligibilitySummary,
            capturedByStaffProfileId: session.staffProfileId,
            status: "captured",
          })
          .returning();

        const [group] = await tx
          .insert(schema.eligibilityRuleGroups)
          .values({
            opportunityId: opportunity.id,
            label: "General eligibility",
            operator: "all",
            status: "draft",
            sourceEvidenceId: evidence.id,
          })
          .returning();
        await tx.insert(schema.eligibilityRules).values({
          opportunityId: opportunity.id,
          ruleGroupId: group.id,
          kind: "other",
          fieldKey: "general",
          operator: "exists",
          explanation: parsed.data.eligibilitySummary,
          sourceEvidenceId: evidence.id,
          status: "draft",
          createdByStaffProfileId: session.staffProfileId,
        });

        const [cycle] = await tx
          .insert(schema.deadlineCycles)
          .values({ opportunityId: opportunity.id, status: "draft" })
          .returning();
        await tx.insert(schema.deadlineOccurrences).values({
          deadlineCycleId: cycle.id,
          precision: parsed.data.deadlinePrecision,
          closingDate: parsed.data.deadlineDate || null,
          rawText: parsed.data.deadlineRawText,
          verificationStatus: "unverified",
          status: "draft",
        });

        existingTitles.add(parsed.data.title.trim().toLowerCase());
      });

      accepted += 1;
      outcomes.push({ rowNumber, outcome: "created", title: parsed.data.title });
    } catch (error) {
      rejected += 1;
      outcomes.push({
        rowNumber,
        outcome: "rejected",
        errors: [error instanceof Error ? error.message : "Unknown database error"],
        title: parsed.data.title,
      });
    }
  }

  const [job] = await db
    .insert(schema.importJobs)
    .values({
      sourceKind: "csv",
      status: dryRun ? "dry-run-completed" : rejected > 0 ? "completed-with-errors" : "completed",
      dryRun,
      totalRows: table.rows.length,
      acceptedRows: accepted,
      rejectedRows: rejected,
      duplicateWarnings,
      validationErrors: outcomes.filter((o) => o.errors),
      actorStaffProfileId: session.staffProfileId,
      completedAt: new Date(),
      resultSummary: { accepted, rejected, duplicateWarnings },
    })
    .returning();

  await recordAuditEvent(db, {
    actorStaffProfileId: session.staffProfileId,
    actorRole: session.roles[0] ?? null,
    action: dryRun ? "read-sensitive" : "create",
    entityName: "import_jobs",
    entityId: job.id,
    redactedChangeSummary: `CSV import ${dryRun ? "dry run" : "run"}: ${accepted} accepted, ${rejected} rejected, ${duplicateWarnings} duplicate warnings.`,
  });

  if (!dryRun) {
    revalidatePath("/staff/opportunities");
    revalidatePath("/staff/imports");
  }

  return { ok: true, totalRows: table.rows.length, accepted, rejected, duplicateWarnings, rows: outcomes, importJobId: job.id };
}
