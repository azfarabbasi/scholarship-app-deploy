import { sql } from "drizzle-orm";
import {
  check,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { auditTimestamps, publicSelectPolicy, serviceRoleBypassPolicy, staffSelectPolicy } from "./common";
import { opportunityStatusEnum, overallVerificationStatusEnum } from "./enums";
import { providers } from "./organisations";
import { staffProfiles } from "./staff";
import { countries, fieldsOfStudy, fundingTypes, opportunityTypes, regions, studyLevels } from "./taxonomies";

const PUBLIC_OPPORTUNITY_PREDICATE = sql`status = 'published'`;

/**
 * The single opportunity record. `opportunity_versions` (below) holds the
 * append-only revision history; `current_approved_version_id` always points
 * at the version that produced the currently published fields, so publishing
 * a new draft never silently rewrites what the public already sees.
 */
export const opportunities = pgTable(
  "opportunities",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    summary: text("summary").notNull(),
    description: text("description"),
    opportunityTypeId: uuid("opportunity_type_id")
      .notNull()
      .references(() => opportunityTypes.id, { onDelete: "restrict" }),
    providerId: uuid("provider_id")
      .notNull()
      .references(() => providers.id, { onDelete: "restrict" }),
    languageCode: text("language_code").notNull().default("en"),
    applicationUrl: text("application_url"),
    officialWebsiteUrl: text("official_website_url"),
    status: opportunityStatusEnum("status").notNull().default("draft"),
    overallVerificationStatus: overallVerificationStatusEnum("overall_verification_status")
      .notNull()
      .default("unverified"),
    // Same-file circular FK to `opportunityVersions` (defined below); the lazy
    // arrow function defers the reference until after module evaluation.
    currentApprovedVersionId: uuid("current_approved_version_id").references((): AnyPgColumn => opportunityVersions.id),
    mergedIntoOpportunityId: uuid("merged_into_opportunity_id"),
    /** e.g. `"legacy-id-14"`; traceability back to the v0.1 migration seed. Null for records not sourced from it. */
    legacyMigrationReference: text("legacy_migration_reference"),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdByStaffProfileId: uuid("created_by_staff_profile_id").references(() => staffProfiles.id),
    updatedByStaffProfileId: uuid("updated_by_staff_profile_id").references(() => staffProfiles.id),
    ...auditTimestamps,
  },
  (table) => [
    uniqueIndex("opportunities_slug_key").on(table.slug),
    uniqueIndex("opportunities_legacy_migration_reference_key")
      .on(table.legacyMigrationReference)
      .where(sql`${table.legacyMigrationReference} IS NOT NULL`),
    check(
      "opportunities_published_requires_version_and_timestamp",
      sql`${table.status} <> 'published' OR (${table.publishedAt} IS NOT NULL AND ${table.currentApprovedVersionId} IS NOT NULL)`,
    ),
    check("opportunities_archived_requires_timestamp", sql`${table.status} <> 'archived' OR ${table.archivedAt} IS NOT NULL`),
    check(
      "opportunities_merged_requires_target",
      sql`${table.status} <> 'merged' OR ${table.mergedIntoOpportunityId} IS NOT NULL`,
    ),
    publicSelectPolicy("opportunities", PUBLIC_OPPORTUNITY_PREDICATE),
    staffSelectPolicy("opportunities"),
    serviceRoleBypassPolicy("opportunities"),
  ],
).enableRLS();

/** Append-only. A row is written on every draft save and on every publish/approve outcome. */
export const opportunityVersions = pgTable(
  "opportunity_versions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    opportunityId: uuid("opportunity_id")
      .notNull()
      .references(() => opportunities.id, { onDelete: "cascade" }),
    versionNumber: integer("version_number").notNull(),
    /** Full structured snapshot of the opportunity + its scoped relations at save time. */
    snapshot: jsonb("snapshot").notNull(),
    changeReason: text("change_reason"),
    authorStaffProfileId: uuid("author_staff_profile_id")
      .notNull()
      .references(() => staffProfiles.id),
    previousVersionId: uuid("previous_version_id"),
    reviewOutcome: text("review_outcome"),
    publicationOutcome: text("publication_outcome"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("opportunity_versions_opportunity_version_key").on(table.opportunityId, table.versionNumber),
    check("opportunity_versions_number_positive", sql`${table.versionNumber} > 0`),
    staffSelectPolicy("opportunity_versions"),
    serviceRoleBypassPolicy("opportunity_versions"),
  ],
).enableRLS();

export const opportunitySlugRedirects = pgTable(
  "opportunity_slug_redirects",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    oldSlug: text("old_slug").notNull(),
    canonicalOpportunityId: uuid("canonical_opportunity_id")
      .notNull()
      .references(() => opportunities.id, { onDelete: "cascade" }),
    reason: text("reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("opportunity_slug_redirects_old_slug_key").on(table.oldSlug),
    publicSelectPolicy("opportunity_slug_redirects", sql`true`),
    staffSelectPolicy("opportunity_slug_redirects"),
    serviceRoleBypassPolicy("opportunity_slug_redirects"),
  ],
).enableRLS();

// ---------------------------------------------------------------------------
// Taxonomy join tables. Each is a thin (opportunity, taxonomy value) pair;
// public visibility follows the parent opportunity's publication state.
// ---------------------------------------------------------------------------

export const opportunityCountries = pgTable(
  "opportunity_countries",
  {
    opportunityId: uuid("opportunity_id")
      .notNull()
      .references(() => opportunities.id, { onDelete: "cascade" }),
    countryId: uuid("country_id")
      .notNull()
      .references(() => countries.id, { onDelete: "restrict" }),
  },
  (table) => [
    primaryKey({ columns: [table.opportunityId, table.countryId] }),
    publicSelectPolicy(
      "opportunity_countries",
      sql`EXISTS (SELECT 1 FROM opportunities o WHERE o.id = ${table.opportunityId} AND o.status = 'published')`,
    ),
    staffSelectPolicy("opportunity_countries"),
    serviceRoleBypassPolicy("opportunity_countries"),
  ],
).enableRLS();

export const opportunityRegions = pgTable(
  "opportunity_regions",
  {
    opportunityId: uuid("opportunity_id")
      .notNull()
      .references(() => opportunities.id, { onDelete: "cascade" }),
    regionId: uuid("region_id")
      .notNull()
      .references(() => regions.id, { onDelete: "restrict" }),
  },
  (table) => [
    primaryKey({ columns: [table.opportunityId, table.regionId] }),
    publicSelectPolicy(
      "opportunity_regions",
      sql`EXISTS (SELECT 1 FROM opportunities o WHERE o.id = ${table.opportunityId} AND o.status = 'published')`,
    ),
    staffSelectPolicy("opportunity_regions"),
    serviceRoleBypassPolicy("opportunity_regions"),
  ],
).enableRLS();

export const opportunityStudyLevels = pgTable(
  "opportunity_study_levels",
  {
    opportunityId: uuid("opportunity_id")
      .notNull()
      .references(() => opportunities.id, { onDelete: "cascade" }),
    studyLevelId: uuid("study_level_id")
      .notNull()
      .references(() => studyLevels.id, { onDelete: "restrict" }),
  },
  (table) => [
    primaryKey({ columns: [table.opportunityId, table.studyLevelId] }),
    publicSelectPolicy(
      "opportunity_study_levels",
      sql`EXISTS (SELECT 1 FROM opportunities o WHERE o.id = ${table.opportunityId} AND o.status = 'published')`,
    ),
    staffSelectPolicy("opportunity_study_levels"),
    serviceRoleBypassPolicy("opportunity_study_levels"),
  ],
).enableRLS();

export const opportunityFieldsOfStudy = pgTable(
  "opportunity_fields_of_study",
  {
    opportunityId: uuid("opportunity_id")
      .notNull()
      .references(() => opportunities.id, { onDelete: "cascade" }),
    fieldOfStudyId: uuid("field_of_study_id")
      .notNull()
      .references(() => fieldsOfStudy.id, { onDelete: "restrict" }),
  },
  (table) => [
    primaryKey({ columns: [table.opportunityId, table.fieldOfStudyId] }),
    publicSelectPolicy(
      "opportunity_fields_of_study",
      sql`EXISTS (SELECT 1 FROM opportunities o WHERE o.id = ${table.opportunityId} AND o.status = 'published')`,
    ),
    staffSelectPolicy("opportunity_fields_of_study"),
    serviceRoleBypassPolicy("opportunity_fields_of_study"),
  ],
).enableRLS();

export const opportunityFundingTypes = pgTable(
  "opportunity_funding_types",
  {
    opportunityId: uuid("opportunity_id")
      .notNull()
      .references(() => opportunities.id, { onDelete: "cascade" }),
    fundingTypeId: uuid("funding_type_id")
      .notNull()
      .references(() => fundingTypes.id, { onDelete: "restrict" }),
  },
  (table) => [
    primaryKey({ columns: [table.opportunityId, table.fundingTypeId] }),
    publicSelectPolicy(
      "opportunity_funding_types",
      sql`EXISTS (SELECT 1 FROM opportunities o WHERE o.id = ${table.opportunityId} AND o.status = 'published')`,
    ),
    staffSelectPolicy("opportunity_funding_types"),
    serviceRoleBypassPolicy("opportunity_funding_types"),
  ],
).enableRLS();
