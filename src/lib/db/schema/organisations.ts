import { sql } from "drizzle-orm";
import { pgTable, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { auditTimestamps, publicSelectPolicy, serviceRoleBypassPolicy, staffSelectPolicy } from "./common";
import { organisationKindEnum, organisationStatusEnum, providerStatusEnum } from "./enums";
import { countries } from "./taxonomies";
import { staffProfiles } from "./staff";

const PUBLIC_ORGANISATION_STATUSES = sql`status IN ('verified', 'active')`;

export const organisations = pgTable(
  "organisations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    legalName: text("legal_name").notNull(),
    displayName: text("display_name").notNull(),
    kind: organisationKindEnum("kind").notNull(),
    websiteUrl: text("website_url"),
    headquartersCountryId: uuid("headquarters_country_id").references(() => countries.id),
    status: organisationStatusEnum("status").notNull().default("draft"),
    mergedIntoOrganisationId: uuid("merged_into_organisation_id"),
    createdByStaffProfileId: uuid("created_by_staff_profile_id").references(() => staffProfiles.id),
    updatedByStaffProfileId: uuid("updated_by_staff_profile_id").references(() => staffProfiles.id),
    ...auditTimestamps,
  },
  (table) => [
    uniqueIndex("organisations_legal_name_key").on(table.legalName),
    publicSelectPolicy("organisations", PUBLIC_ORGANISATION_STATUSES),
    staffSelectPolicy("organisations"),
    serviceRoleBypassPolicy("organisations"),
  ],
).enableRLS();

export const providers = pgTable(
  "providers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organisationId: uuid("organisation_id")
      .notNull()
      .references(() => organisations.id, { onDelete: "restrict" }),
    displayName: text("display_name").notNull(),
    shortName: text("short_name"),
    description: text("description"),
    officialWebsiteUrl: text("official_website_url"),
    countryId: uuid("country_id").references(() => countries.id),
    status: providerStatusEnum("status").notNull().default("draft"),
    supersededByProviderId: uuid("superseded_by_provider_id"),
    createdByStaffProfileId: uuid("created_by_staff_profile_id").references(() => staffProfiles.id),
    updatedByStaffProfileId: uuid("updated_by_staff_profile_id").references(() => staffProfiles.id),
    ...auditTimestamps,
  },
  (table) => [
    uniqueIndex("providers_display_name_key").on(table.displayName),
    publicSelectPolicy("providers", sql`${table.status} IN ('verified', 'active')`),
    staffSelectPolicy("providers"),
    serviceRoleBypassPolicy("providers"),
  ],
).enableRLS();
