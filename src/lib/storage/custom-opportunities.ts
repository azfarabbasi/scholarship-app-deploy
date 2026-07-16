import type { CustomOpportunityInput } from "@/lib/schemas/custom-opportunity";
import { getDb } from "./db";
import { emitStorageChange } from "./events";
import type { CustomOpportunityRecord } from "./types";

function nowIso(): string {
  return new Date().toISOString();
}

function slugify(title: string): string {
  const base = title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base.length > 0 ? base : "custom-opportunity";
}

export async function getAllCustomOpportunities(): Promise<CustomOpportunityRecord[]> {
  const db = await getDb();
  return db.getAll("customOpportunities");
}

export async function getCustomOpportunityById(id: string): Promise<CustomOpportunityRecord | undefined> {
  const db = await getDb();
  return db.get("customOpportunities", id);
}

export async function getCustomOpportunityBySlug(slug: string): Promise<CustomOpportunityRecord | undefined> {
  const all = await getAllCustomOpportunities();
  return all.find((record) => record.slug === slug);
}

async function generateUniqueSlug(
  title: string,
  builtInSlugs: readonly string[],
  ignoreId?: string,
): Promise<string> {
  const all = await getAllCustomOpportunities();
  const taken = new Set([...all.filter((r) => r.id !== ignoreId).map((r) => r.slug), ...builtInSlugs]);
  const base = slugify(title);
  if (!taken.has(base)) {
    return base;
  }
  let counter = 2;
  while (taken.has(`${base}-${counter}`)) {
    counter += 1;
  }
  return `${base}-${counter}`;
}

export async function createCustomOpportunity(
  input: CustomOpportunityInput,
  builtInSlugs: readonly string[] = [],
): Promise<CustomOpportunityRecord> {
  const db = await getDb();
  const timestamp = nowIso();
  const record: CustomOpportunityRecord = {
    id: crypto.randomUUID(),
    slug: await generateUniqueSlug(input.title, builtInSlugs),
    title: input.title,
    opportunityType: input.opportunityType,
    providerName: input.providerName ?? null,
    countries: input.countries,
    regions: input.regions,
    studyLevels: input.studyLevels,
    benefitSummary: input.benefitSummary,
    eligibilitySummary: input.eligibilitySummary,
    officialUrl: input.officialUrl,
    deadlineKind: input.deadlineKind,
    deadlineRawText: input.deadlineRawText,
    deadlineDate: input.deadlineDate,
    deadlineTimezone: input.deadlineTimezone ?? null,
    verificationNotes: input.verificationNotes ?? null,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  await db.put("customOpportunities", record);
  emitStorageChange("customOpportunities");
  return record;
}

export async function updateCustomOpportunity(
  id: string,
  input: CustomOpportunityInput,
  builtInSlugs: readonly string[] = [],
): Promise<CustomOpportunityRecord> {
  const db = await getDb();
  const existing = await db.get("customOpportunities", id);
  if (!existing) {
    throw new Error("Custom opportunity not found.");
  }

  const slug =
    input.title === existing.title ? existing.slug : await generateUniqueSlug(input.title, builtInSlugs, id);

  const updated: CustomOpportunityRecord = {
    ...existing,
    slug,
    title: input.title,
    opportunityType: input.opportunityType,
    providerName: input.providerName ?? null,
    countries: input.countries,
    regions: input.regions,
    studyLevels: input.studyLevels,
    benefitSummary: input.benefitSummary,
    eligibilitySummary: input.eligibilitySummary,
    officialUrl: input.officialUrl,
    deadlineKind: input.deadlineKind,
    deadlineRawText: input.deadlineRawText,
    deadlineDate: input.deadlineDate,
    deadlineTimezone: input.deadlineTimezone ?? null,
    verificationNotes: input.verificationNotes ?? null,
    updatedAt: nowIso(),
  };
  await db.put("customOpportunities", updated);
  emitStorageChange("customOpportunities");
  return updated;
}

export async function deleteCustomOpportunity(id: string): Promise<void> {
  const db = await getDb();
  await db.delete("customOpportunities", id);
  emitStorageChange("customOpportunities");
}
