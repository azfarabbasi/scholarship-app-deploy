import type {
  EntityId,
  PublicationClassifiedRecord,
  UrlString,
} from "./common";

export const ORGANISATION_KINDS = [
  "government",
  "university",
  "foundation",
  "non-profit",
  "company",
  "multilateral-organisation",
  "research-institute",
  "other",
] as const;

export type OrganisationKind = (typeof ORGANISATION_KINDS)[number];

export const ORGANISATION_STATUSES = [
  "draft",
  "verified",
  "active",
  "inactive",
  "merged",
] as const;

export type OrganisationStatus = (typeof ORGANISATION_STATUSES)[number];

interface OrganisationFields {
  organisationId: EntityId;
  legalName: string;
  displayName: string;
  kind: OrganisationKind;
  websiteUrl: UrlString | null;
  headquartersCountryId: EntityId | null;
}

export type Organisation = PublicationClassifiedRecord<
  OrganisationFields,
  OrganisationStatus,
  "draft"
>;

export const PROVIDER_STATUSES = [
  "draft",
  "verified",
  "active",
  "inactive",
  "superseded",
] as const;

export type ProviderStatus = (typeof PROVIDER_STATUSES)[number];

interface ProviderFields {
  providerId: EntityId;
  organisationId: EntityId;
  displayName: string;
  shortName: string | null;
  description: string | null;
  officialWebsiteUrl: UrlString | null;
  countryId: EntityId | null;
}

export type Provider = PublicationClassifiedRecord<
  ProviderFields,
  ProviderStatus,
  "draft"
>;
