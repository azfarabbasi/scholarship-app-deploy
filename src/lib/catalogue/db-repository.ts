import "server-only";
import { and, asc, eq, inArray } from "drizzle-orm";
import { getDb, schema } from "@/lib/db/client";
import type { DeadlineEvaluationInput, DeadlineOccurrenceFact } from "@/lib/deadlines/types";
import type { OpportunityTypeCode } from "@/lib/domain";
import type { StudyLevel } from "@/lib/schemas/opportunity-seed";
import type { CatalogueOpportunity, CatalogueVerificationInfo } from "./types";

/**
 * The database-backed public catalogue repository — the ONLY source of
 * public opportunity content for the production UI (see the module comment
 * in `legacy-seed-repository.ts`). Every query here selects columns/rows a
 * signed-out visitor is allowed to see; it never reaches into draft,
 * archived, or staff-only tables.
 *
 * Benefit/eligibility "summary" text does not exist as flat columns on
 * `opportunities` — the normalised schema stores them as structured
 * `funding_benefits`/`eligibility_rules` rows instead (see
 * docs/checkpoint-2/database-schema.md). This module joins and concatenates
 * those rows into the single display string the existing catalogue UI
 * expects, rather than inventing a duplicate flat field.
 */

function groupBy<T, K>(items: readonly T[], keyOf: (item: T) => K): Map<K, T[]> {
  const map = new Map<K, T[]>();
  for (const item of items) {
    const key = keyOf(item);
    const list = map.get(key);
    if (list) {
      list.push(item);
    } else {
      map.set(key, [item]);
    }
  }
  return map;
}

function buildDeadlineInput(
  cycles: (typeof schema.deadlineCycles.$inferSelect)[],
  occurrencesByCycle: Map<string, (typeof schema.deadlineOccurrences.$inferSelect)[]>,
  officialUrl: string | null,
  lastCheckedAt: string | null,
): DeadlineEvaluationInput {
  if (cycles.length === 0) {
    return {
      cycleYear: null,
      precision: "unknown",
      verificationStatus: "unverified",
      recurrence: { cadence: "unknown", automaticDateGenerationAllowed: false },
      occurrences: [],
    };
  }

  // Prefer the most recently opened/announced cycle; fall back to the
  // highest cycle year, then the most recently created row.
  const preferredStatusOrder = ["active", "announced", "in-review", "completed", "draft", "withdrawn", "historical"];
  const [cycle] = [...cycles].sort((a, b) => {
    const statusDiff = preferredStatusOrder.indexOf(a.status) - preferredStatusOrder.indexOf(b.status);
    if (statusDiff !== 0) return statusDiff;
    const yearDiff = (b.cycleYear ?? -1) - (a.cycleYear ?? -1);
    if (yearDiff !== 0) return yearDiff;
    return b.createdAt.getTime() - a.createdAt.getTime();
  });

  const occurrences = occurrencesByCycle.get(cycle.id) ?? [];
  const occurrenceFacts: DeadlineOccurrenceFact[] = occurrences.map((occurrence) => ({
    kind: occurrence.closingDate ? "closing" : "opening",
    scope:
      occurrence.scopeKind === "universal"
        ? "universal"
        : occurrence.scopeProgramId
          ? "program-specific"
          : "institution-specific",
    scopeReference: occurrence.scopeProgramId ?? occurrence.scopeInstitutionId ?? null,
    rawText: occurrence.rawText,
    officialUrl,
    lastCheckedAt: occurrence.verificationStatus === "verified" ? lastCheckedAt : null,
    sourceTimezone: occurrence.sourceTimezone,
    sourceDate: occurrence.closingDate ?? occurrence.openingDate,
    sourceDateTime: null,
    projectedDate: null,
  }));

  const primaryOccurrence = occurrences[0];

  return {
    cycleYear: cycle.cycleYear,
    precision: primaryOccurrence?.precision ?? "unknown",
    verificationStatus: primaryOccurrence?.verificationStatus ?? "unverified",
    recurrence: {
      cadence: cycle.recurrenceCadence,
      intervalYears: cycle.recurrenceIntervalYears,
      documentedByOfficialSource: cycle.recurrenceDocumentedBySource,
      automaticDateGenerationAllowed: false,
    },
    occurrences: occurrenceFacts,
  };
}

export async function getPublishedOpportunities(): Promise<CatalogueOpportunity[]> {
  const db = getDb();

  const rows = await db
    .select({
      id: schema.opportunities.id,
      slug: schema.opportunities.slug,
      title: schema.opportunities.title,
      officialWebsiteUrl: schema.opportunities.officialWebsiteUrl,
      applicationUrl: schema.opportunities.applicationUrl,
      overallVerificationStatus: schema.opportunities.overallVerificationStatus,
      legacyMigrationReference: schema.opportunities.legacyMigrationReference,
      createdAt: schema.opportunities.createdAt,
      updatedAt: schema.opportunities.updatedAt,
      opportunityTypeCode: schema.opportunityTypes.code,
      providerDisplayName: schema.providers.displayName,
    })
    .from(schema.opportunities)
    .innerJoin(schema.opportunityTypes, eq(schema.opportunities.opportunityTypeId, schema.opportunityTypes.id))
    .innerJoin(schema.providers, eq(schema.opportunities.providerId, schema.providers.id))
    .where(eq(schema.opportunities.status, "published"))
    .orderBy(asc(schema.opportunities.title));

  if (rows.length === 0) {
    return [];
  }

  const ids = rows.map((row) => row.id);

  const [countryLinks, regionLinks, studyLevelLinks, benefits, eligibilityRules, sourceLinks, cycles, docRequirements] =
    await Promise.all([
      db
        .select({ opportunityId: schema.opportunityCountries.opportunityId, name: schema.countries.name })
        .from(schema.opportunityCountries)
        .innerJoin(schema.countries, eq(schema.opportunityCountries.countryId, schema.countries.id))
        .where(inArray(schema.opportunityCountries.opportunityId, ids)),
      db
        .select({ opportunityId: schema.opportunityRegions.opportunityId, name: schema.regions.name })
        .from(schema.opportunityRegions)
        .innerJoin(schema.regions, eq(schema.opportunityRegions.regionId, schema.regions.id))
        .where(inArray(schema.opportunityRegions.opportunityId, ids)),
      db
        .select({ opportunityId: schema.opportunityStudyLevels.opportunityId, label: schema.studyLevels.label })
        .from(schema.opportunityStudyLevels)
        .innerJoin(schema.studyLevels, eq(schema.opportunityStudyLevels.studyLevelId, schema.studyLevels.id))
        .where(inArray(schema.opportunityStudyLevels.opportunityId, ids)),
      db
        .select({ opportunityId: schema.fundingBenefits.opportunityId, summary: schema.fundingBenefits.summary })
        .from(schema.fundingBenefits)
        .where(and(inArray(schema.fundingBenefits.opportunityId, ids), eq(schema.fundingBenefits.status, "published"))),
      db
        .select({ opportunityId: schema.eligibilityRules.opportunityId, explanation: schema.eligibilityRules.explanation })
        .from(schema.eligibilityRules)
        .where(and(inArray(schema.eligibilityRules.opportunityId, ids), eq(schema.eligibilityRules.status, "active"))),
      db
        .select({
          opportunityId: schema.opportunityOfficialSources.opportunityId,
          label: schema.officialSources.label,
          url: schema.officialSources.url,
          lastCheckedAt: schema.officialSources.lastCheckedAt,
          createdAt: schema.officialSources.createdAt,
        })
        .from(schema.opportunityOfficialSources)
        .innerJoin(schema.officialSources, eq(schema.opportunityOfficialSources.officialSourceId, schema.officialSources.id))
        .where(inArray(schema.opportunityOfficialSources.opportunityId, ids)),
      db.select().from(schema.deadlineCycles).where(inArray(schema.deadlineCycles.opportunityId, ids)),
      db
        .select({ opportunityId: schema.opportunityDocumentRequirements.opportunityId })
        .from(schema.opportunityDocumentRequirements)
        .where(
          and(
            inArray(schema.opportunityDocumentRequirements.opportunityId, ids),
            eq(schema.opportunityDocumentRequirements.status, "published"),
          ),
        ),
    ]);

  const cycleIds = cycles.map((cycle) => cycle.id);
  const occurrences =
    cycleIds.length > 0
      ? await db.select().from(schema.deadlineOccurrences).where(inArray(schema.deadlineOccurrences.deadlineCycleId, cycleIds))
      : [];

  const countriesByOpportunity = groupBy(countryLinks, (row) => row.opportunityId);
  const regionsByOpportunity = groupBy(regionLinks, (row) => row.opportunityId);
  const studyLevelsByOpportunity = groupBy(studyLevelLinks, (row) => row.opportunityId);
  const benefitsByOpportunity = groupBy(benefits, (row) => row.opportunityId);
  const eligibilityRulesByOpportunity = groupBy(eligibilityRules, (row) => row.opportunityId);
  const sourcesByOpportunity = groupBy(sourceLinks, (row) => row.opportunityId);
  const cyclesByOpportunity = groupBy(cycles, (row) => row.opportunityId);
  const occurrencesByCycle = groupBy(occurrences, (row) => row.deadlineCycleId);
  const documentCountByOpportunity = new Map<string, number>();
  for (const row of docRequirements) {
    documentCountByOpportunity.set(row.opportunityId, (documentCountByOpportunity.get(row.opportunityId) ?? 0) + 1);
  }

  return rows.map((row): CatalogueOpportunity => {
    const sources = [...(sourcesByOpportunity.get(row.id) ?? [])].sort(
      (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
    );
    const primarySource = sources[0] ?? null;
    const officialUrl = row.applicationUrl ?? row.officialWebsiteUrl ?? primarySource?.url ?? null;
    const eligibilityRuleCount = eligibilityRulesByOpportunity.get(row.id)?.length ?? 0;
    const documentCount = documentCountByOpportunity.get(row.id) ?? 0;

    const verification: CatalogueVerificationInfo = {
      status: row.overallVerificationStatus,
      lastCheckedAt: primarySource?.lastCheckedAt?.toISOString() ?? null,
      officialSourceLabel: primarySource?.label ?? null,
      documentsVerified: documentCount > 0,
      documentCount,
      eligibilityVerified: eligibilityRuleCount > 0,
      eligibilityRuleCount,
    };

    const legacyIdMatch = row.legacyMigrationReference?.match(/(\d+)$/);

    return {
      kind: "built-in",
      id: row.id,
      legacyId: legacyIdMatch ? Number(legacyIdMatch[1]) : null,
      slug: row.slug,
      title: row.title,
      opportunityType: row.opportunityTypeCode as OpportunityTypeCode,
      providerName: row.providerDisplayName,
      countries: (countriesByOpportunity.get(row.id) ?? []).map((r) => r.name),
      regions: (regionsByOpportunity.get(row.id) ?? []).map((r) => r.name),
      studyLevels: (studyLevelsByOpportunity.get(row.id) ?? []).map((r) => r.label as StudyLevel),
      benefitSummary:
        (benefitsByOpportunity.get(row.id) ?? []).map((b) => b.summary).join(" ") || "See the official source for funding details.",
      eligibilitySummary:
        (eligibilityRulesByOpportunity.get(row.id) ?? []).map((r) => r.explanation).join(" ") ||
        "See the official source for eligibility details.",
      officialUrl,
      verificationNotes: null,
      verification,
      deadlineInput: buildDeadlineInput(
        cyclesByOpportunity.get(row.id) ?? [],
        occurrencesByCycle,
        officialUrl,
        verification.lastCheckedAt,
      ),
      deadlineRawText: (cyclesByOpportunity.get(row.id) ?? [])
        .flatMap((cycle) => occurrencesByCycle.get(cycle.id) ?? [])
        .map((occurrence) => occurrence.rawText)[0] ?? "See the official source for the current deadline.",
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  });
}

export async function getPublishedOpportunityBySlug(slug: string): Promise<CatalogueOpportunity | null> {
  const all = await getPublishedOpportunities();
  const direct = all.find((opportunity) => opportunity.slug === slug);
  if (direct) {
    return direct;
  }

  // Resolve old slugs left behind by a duplicate merge or a rename.
  const db = getDb();
  const [redirect] = await db
    .select({ canonicalOpportunityId: schema.opportunitySlugRedirects.canonicalOpportunityId })
    .from(schema.opportunitySlugRedirects)
    .where(eq(schema.opportunitySlugRedirects.oldSlug, slug))
    .limit(1);

  if (!redirect) {
    return null;
  }

  return all.find((opportunity) => opportunity.id === redirect.canonicalOpportunityId) ?? null;
}

export async function getPublishedOpportunityCount(): Promise<number> {
  const opportunities = await getPublishedOpportunities();
  return opportunities.length;
}
