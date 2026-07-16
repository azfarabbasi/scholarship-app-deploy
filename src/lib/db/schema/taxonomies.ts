import { sql } from "drizzle-orm";
import { boolean, integer, pgTable, primaryKey, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { auditTimestamps, publicSelectPolicy, serviceRoleBypassPolicy, staffSelectPolicy } from "./common";
import {
  countryStatusEnum,
  documentCategoryEnum,
  documentTemplateStatusEnum,
  fieldOfStudyStatusEnum,
  fundingTypeStatusEnum,
  opportunityTypeCodeEnum,
  opportunityTypeStatusEnum,
  regionStatusEnum,
  studyLevelStatusEnum,
} from "./enums";

export const countries = pgTable(
  "countries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    isoAlpha2Code: text("iso_alpha2_code").notNull(),
    isoAlpha3Code: text("iso_alpha3_code").notNull(),
    name: text("name").notNull(),
    status: countryStatusEnum("status").notNull().default("active"),
    ...auditTimestamps,
  },
  (table) => [
    uniqueIndex("countries_iso_alpha2_key").on(table.isoAlpha2Code),
    uniqueIndex("countries_iso_alpha3_key").on(table.isoAlpha3Code),
    publicSelectPolicy("countries", sql`${table.status} = 'active'`),
    staffSelectPolicy("countries"),
    serviceRoleBypassPolicy("countries"),
  ],
).enableRLS();

export const regions = pgTable(
  "regions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    code: text("code").notNull(),
    name: text("name").notNull(),
    parentRegionId: uuid("parent_region_id"),
    status: regionStatusEnum("status").notNull().default("draft"),
    ...auditTimestamps,
  },
  (table) => [
    uniqueIndex("regions_code_key").on(table.code),
    publicSelectPolicy("regions", sql`${table.status} = 'active'`),
    staffSelectPolicy("regions"),
    serviceRoleBypassPolicy("regions"),
  ],
).enableRLS();

export const regionCountries = pgTable(
  "region_countries",
  {
    regionId: uuid("region_id")
      .notNull()
      .references(() => regions.id, { onDelete: "cascade" }),
    countryId: uuid("country_id")
      .notNull()
      .references(() => countries.id, { onDelete: "cascade" }),
  },
  (table) => [
    primaryKey({ columns: [table.regionId, table.countryId] }),
    publicSelectPolicy("region_countries", sql`true`),
    staffSelectPolicy("region_countries"),
    serviceRoleBypassPolicy("region_countries"),
  ],
).enableRLS();

export const studyLevels = pgTable(
  "study_levels",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    code: text("code").notNull(),
    label: text("label").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    status: studyLevelStatusEnum("status").notNull().default("draft"),
    ...auditTimestamps,
  },
  (table) => [
    uniqueIndex("study_levels_code_key").on(table.code),
    publicSelectPolicy("study_levels", sql`${table.status} = 'active'`),
    staffSelectPolicy("study_levels"),
    serviceRoleBypassPolicy("study_levels"),
  ],
).enableRLS();

export const fieldsOfStudy = pgTable(
  "fields_of_study",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    code: text("code").notNull(),
    label: text("label").notNull(),
    parentFieldOfStudyId: uuid("parent_field_of_study_id"),
    status: fieldOfStudyStatusEnum("status").notNull().default("draft"),
    ...auditTimestamps,
  },
  (table) => [
    uniqueIndex("fields_of_study_code_key").on(table.code),
    publicSelectPolicy("fields_of_study", sql`${table.status} = 'active'`),
    staffSelectPolicy("fields_of_study"),
    serviceRoleBypassPolicy("fields_of_study"),
  ],
).enableRLS();

export const fundingTypes = pgTable(
  "funding_types",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    code: text("code").notNull(),
    label: text("label").notNull(),
    description: text("description"),
    status: fundingTypeStatusEnum("status").notNull().default("draft"),
    ...auditTimestamps,
  },
  (table) => [
    uniqueIndex("funding_types_code_key").on(table.code),
    publicSelectPolicy("funding_types", sql`${table.status} = 'active'`),
    staffSelectPolicy("funding_types"),
    serviceRoleBypassPolicy("funding_types"),
  ],
).enableRLS();

/** Seeded once with the ten codes from `OPPORTUNITY_TYPES` in `src/lib/domain/opportunity.ts`. */
export const opportunityTypes = pgTable(
  "opportunity_types",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    code: opportunityTypeCodeEnum("code").notNull(),
    label: text("label").notNull(),
    description: text("description"),
    sortOrder: integer("sort_order").notNull().default(0),
    status: opportunityTypeStatusEnum("status").notNull().default("draft"),
    ...auditTimestamps,
  },
  (table) => [
    uniqueIndex("opportunity_types_code_key").on(table.code),
    publicSelectPolicy("opportunity_types", sql`${table.status} = 'active'`),
    staffSelectPolicy("opportunity_types"),
    serviceRoleBypassPolicy("opportunity_types"),
  ],
).enableRLS();

/** Reusable document *categories* — never a file, upload, or file reference. */
export const requiredDocumentTemplates = pgTable(
  "required_document_templates",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    code: text("code").notNull(),
    label: text("label").notNull(),
    description: text("description"),
    category: documentCategoryEnum("category").notNull(),
    mayExpire: boolean("may_expire").notNull().default(false),
    status: documentTemplateStatusEnum("status").notNull().default("draft"),
    ...auditTimestamps,
  },
  (table) => [
    uniqueIndex("required_document_templates_code_key").on(table.code),
    publicSelectPolicy("required_document_templates", sql`${table.status} = 'active'`),
    staffSelectPolicy("required_document_templates"),
    serviceRoleBypassPolicy("required_document_templates"),
  ],
).enableRLS();
