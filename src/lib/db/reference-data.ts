import "server-only";
import { asc } from "drizzle-orm";
import { getDb, schema } from "./client";

export interface OptionRow {
  id: string;
  label: string;
}

export async function getOpportunityTypeOptions(): Promise<OptionRow[]> {
  const db = getDb();
  const rows = await db
    .select({ id: schema.opportunityTypes.id, label: schema.opportunityTypes.label })
    .from(schema.opportunityTypes)
    .orderBy(asc(schema.opportunityTypes.sortOrder));
  return rows;
}

export async function getProviderOptions(): Promise<OptionRow[]> {
  const db = getDb();
  const rows = await db
    .select({ id: schema.providers.id, label: schema.providers.displayName })
    .from(schema.providers)
    .orderBy(asc(schema.providers.displayName));
  return rows;
}

export async function getOrganisationOptions(): Promise<OptionRow[]> {
  const db = getDb();
  const rows = await db
    .select({ id: schema.organisations.id, label: schema.organisations.displayName })
    .from(schema.organisations)
    .orderBy(asc(schema.organisations.displayName));
  return rows;
}

export async function getCountryOptions(): Promise<OptionRow[]> {
  const db = getDb();
  const rows = await db.select({ id: schema.countries.id, label: schema.countries.name }).from(schema.countries).orderBy(asc(schema.countries.name));
  return rows;
}

export async function getRegionOptions(): Promise<OptionRow[]> {
  const db = getDb();
  const rows = await db.select({ id: schema.regions.id, label: schema.regions.name }).from(schema.regions).orderBy(asc(schema.regions.name));
  return rows;
}

export async function getStudyLevelOptions(): Promise<OptionRow[]> {
  const db = getDb();
  const rows = await db
    .select({ id: schema.studyLevels.id, label: schema.studyLevels.label })
    .from(schema.studyLevels)
    .orderBy(asc(schema.studyLevels.sortOrder));
  return rows;
}

export async function getFundingTypeOptions(): Promise<OptionRow[]> {
  const db = getDb();
  const rows = await db.select({ id: schema.fundingTypes.id, label: schema.fundingTypes.label }).from(schema.fundingTypes).orderBy(asc(schema.fundingTypes.label));
  return rows;
}

export async function getFieldOfStudyOptions(): Promise<OptionRow[]> {
  const db = getDb();
  const rows = await db
    .select({ id: schema.fieldsOfStudy.id, label: schema.fieldsOfStudy.label })
    .from(schema.fieldsOfStudy)
    .orderBy(asc(schema.fieldsOfStudy.label));
  return rows;
}

export async function getRequiredDocumentTemplateOptions(): Promise<OptionRow[]> {
  const db = getDb();
  const rows = await db
    .select({ id: schema.requiredDocumentTemplates.id, label: schema.requiredDocumentTemplates.label })
    .from(schema.requiredDocumentTemplates)
    .orderBy(asc(schema.requiredDocumentTemplates.label));
  return rows;
}
