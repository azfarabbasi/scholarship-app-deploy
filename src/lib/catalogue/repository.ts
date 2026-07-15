import rawSeed from "../../../data/migrations/v0.1/scholarships.seed.json";
import { seedDeadlineToEvaluationInput } from "@/lib/deadlines/seed-adapter";
import { opportunitySeedSchema, type OpportunitySeed } from "@/lib/schemas/opportunity-seed";
import type { CatalogueOpportunity } from "./types";

export const EXPECTED_BUILT_IN_COUNT = 55;

function toCatalogueOpportunity(seed: OpportunitySeed): CatalogueOpportunity {
  return {
    kind: "built-in",
    id: `built-in-${seed.legacyId}`,
    legacyId: seed.legacyId,
    slug: seed.slug,
    title: seed.title,
    opportunityType: seed.opportunityType,
    providerName: seed.providerName,
    countries: [...seed.countries],
    regions: [...seed.regions],
    studyLevels: [...seed.studyLevels],
    benefitSummary: seed.benefitSummary,
    eligibilitySummary: seed.eligibilitySummary,
    officialUrl: seed.officialUrl,
    verificationNotes: null,
    deadlineInput: seedDeadlineToEvaluationInput(seed.deadline, seed.source),
    deadlineRawText: seed.deadline.rawText,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

interface LoadResult {
  opportunities: CatalogueOpportunity[];
  invalidRecordCount: number;
}

function loadBuiltInOpportunities(): LoadResult {
  const records = Array.isArray(rawSeed) ? rawSeed : [];
  const opportunities: CatalogueOpportunity[] = [];
  let invalidRecordCount = 0;

  for (const record of records) {
    const result = opportunitySeedSchema.safeParse(record);
    if (!result.success) {
      invalidRecordCount += 1;
      if (process.env.NODE_ENV !== "production") {
        console.error("ScholarTrack: skipped an invalid built-in opportunity seed record.", result.error.issues);
      }
      continue;
    }
    opportunities.push(toCatalogueOpportunity(result.data));
  }

  return { opportunities, invalidRecordCount };
}

let cached: LoadResult | null = null;

function getLoadResult(): LoadResult {
  if (!cached) {
    cached = loadBuiltInOpportunities();
  }
  return cached;
}

/** All valid built-in (seed-derived) opportunities. Safely skips invalid records. */
export function getAllBuiltInOpportunities(): CatalogueOpportunity[] {
  return getLoadResult().opportunities;
}

/** Number of seed records that failed schema validation (0 for the approved seed). */
export function getInvalidBuiltInRecordCount(): number {
  return getLoadResult().invalidRecordCount;
}

export function getBuiltInOpportunityBySlug(slug: string): CatalogueOpportunity | undefined {
  return getAllBuiltInOpportunities().find((opportunity) => opportunity.slug === slug);
}

export function getBuiltInOpportunityByLegacyId(legacyId: number): CatalogueOpportunity | undefined {
  return getAllBuiltInOpportunities().find((opportunity) => opportunity.legacyId === legacyId);
}

export function getBuiltInOpportunityById(id: string): CatalogueOpportunity | undefined {
  return getAllBuiltInOpportunities().find((opportunity) => opportunity.id === id);
}

function uniqueSorted(values: Iterable<string>): string[] {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

export function getUniqueCountries(opportunities: readonly CatalogueOpportunity[] = getAllBuiltInOpportunities()): string[] {
  return uniqueSorted(opportunities.flatMap((o) => o.countries));
}

export function getUniqueRegions(opportunities: readonly CatalogueOpportunity[] = getAllBuiltInOpportunities()): string[] {
  return uniqueSorted(opportunities.flatMap((o) => o.regions));
}

export function getUniqueStudyLevels(opportunities: readonly CatalogueOpportunity[] = getAllBuiltInOpportunities()): string[] {
  return uniqueSorted(opportunities.flatMap((o) => o.studyLevels));
}

export function getUniqueOpportunityTypes(opportunities: readonly CatalogueOpportunity[] = getAllBuiltInOpportunities()): string[] {
  return uniqueSorted(opportunities.map((o) => o.opportunityType));
}

export const DEADLINE_PRECISION_OPTIONS = [
  "exact",
  "estimated",
  "rolling",
  "unknown",
  "program-specific",
  "institution-specific",
] as const;

export function getDeadlinePrecisionOptions(): readonly string[] {
  return DEADLINE_PRECISION_OPTIONS;
}
