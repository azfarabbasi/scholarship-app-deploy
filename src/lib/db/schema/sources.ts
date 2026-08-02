import { sql } from "drizzle-orm";
import { check, pgTable, primaryKey, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { auditTimestamps, publicSelectPolicy, serviceRoleBypassPolicy, staffSelectPolicy } from "./common";
import {
  officialSourceKindEnum,
  officialSourceStatusEnum,
  sourceEvidenceKindEnum,
  sourceEvidenceStatusEnum,
  verificationOutcomeEnum,
  verificationRecordStatusEnum,
  verificationSubjectKindEnum,
  deadlineVerificationStatusEnum,
} from "./enums";
import { opportunities } from "./opportunities";
import { organisations, providers } from "./organisations";
import { staffProfiles } from "./staff";

/** An authoritative provider-controlled page/document that may back one or more facts. */
export const officialSources = pgTable(
  "official_sources",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    url: text("url").notNull(),
    kind: officialSourceKindEnum("kind").notNull(),
    label: text("label").notNull(),
    publisherOrganisationId: uuid("publisher_organisation_id").references(() => organisations.id),
    publisherProviderId: uuid("publisher_provider_id").references(() => providers.id),
    sourceOrganisationName: text("source_organisation_name").notNull(),
    sourceLanguageCode: text("source_language_code"),
    status: officialSourceStatusEnum("status").notNull().default("candidate"),
    lastCheckedAt: timestamp("last_checked_at", { withTimezone: true }),
    lastSuccessfulAccessAt: timestamp("last_successful_access_at", { withTimezone: true }),
    /** Who captured this source as a candidate. Null for legacy-imported rows with no tracked actor. */
    createdByStaffProfileId: uuid("created_by_staff_profile_id").references(() => staffProfiles.id),
    /** Who confirmed it to 'confirmed-official'/'active' — must differ from the creator (see the CHECK below). */
    approvedByStaffProfileId: uuid("approved_by_staff_profile_id").references(() => staffProfiles.id),
    ...auditTimestamps,
  },
  (table) => [
    check(
      "official_sources_single_publisher",
      sql`NOT (${table.publisherOrganisationId} IS NOT NULL AND ${table.publisherProviderId} IS NOT NULL)`,
    ),
    check(
      "official_sources_confirmed_requires_checked_at",
      sql`${table.status} = 'candidate' OR ${table.lastCheckedAt} IS NOT NULL`,
    ),
    check(
      "official_sources_confirmed_requires_publisher",
      sql`${table.status} = 'candidate' OR ${table.publisherOrganisationId} IS NOT NULL OR ${table.publisherProviderId} IS NOT NULL`,
    ),
    // Separation of duties: whoever captured a candidate source may never be
    // the same person who confirms it — mirrors verification_records_no_self_approval.
    check(
      "official_sources_no_self_approval",
      sql`${table.approvedByStaffProfileId} IS NULL OR ${table.createdByStaffProfileId} IS NULL OR ${table.approvedByStaffProfileId} <> ${table.createdByStaffProfileId} OR COALESCE(current_setting('app.bootstrap_admin_actor_id', true), '') = ${table.approvedByStaffProfileId}::text`,
    ),
    check(
      "official_sources_confirmed_requires_approver",
      sql`${table.status} = 'candidate' OR ${table.createdByStaffProfileId} IS NULL OR ${table.approvedByStaffProfileId} IS NOT NULL`,
    ),
    publicSelectPolicy("official_sources", sql`${table.status} NOT IN ('candidate', 'archived')`),
    staffSelectPolicy("official_sources"),
    serviceRoleBypassPolicy("official_sources"),
  ],
).enableRLS();

/** Which official sources back which opportunity. Publication requires at least one row here. */
export const opportunityOfficialSources = pgTable(
  "opportunity_official_sources",
  {
    opportunityId: uuid("opportunity_id")
      .notNull()
      .references(() => opportunities.id, { onDelete: "cascade" }),
    officialSourceId: uuid("official_source_id")
      .notNull()
      .references(() => officialSources.id, { onDelete: "restrict" }),
  },
  (table) => [
    primaryKey({ columns: [table.opportunityId, table.officialSourceId] }),
    publicSelectPolicy(
      "opportunity_official_sources",
      sql`EXISTS (SELECT 1 FROM opportunities o WHERE o.id = ${table.opportunityId} AND o.status = 'published')`,
    ),
    staffSelectPolicy("opportunity_official_sources"),
    serviceRoleBypassPolicy("opportunity_official_sources"),
  ],
).enableRLS();

/** A human review outcome for a defined set of facts. Never derived from URL presence alone. */
export const verificationRecords = pgTable(
  "verification_records",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    subjectKind: verificationSubjectKindEnum("subject_kind").notNull(),
    /** Polymorphic by design (points at whichever table `subject_kind` names); not a DB-level FK. */
    subjectId: uuid("subject_id").notNull(),
    opportunityId: uuid("opportunity_id").references(() => opportunities.id, { onDelete: "cascade" }),
    deadlineOccurrenceId: uuid("deadline_occurrence_id"),
    reviewerStaffProfileId: uuid("reviewer_staff_profile_id")
      .notNull()
      .references(() => staffProfiles.id),
    approvedByStaffProfileId: uuid("approved_by_staff_profile_id").references(() => staffProfiles.id),
    reviewAssignmentId: uuid("review_assignment_id"),
    outcome: verificationOutcomeEnum("outcome").notNull(),
    status: verificationRecordStatusEnum("status").notNull().default("pending"),
    deadlineVerificationStatus: deadlineVerificationStatusEnum("deadline_verification_status"),
    checkedAt: timestamp("checked_at", { withTimezone: true }).notNull().defaultNow(),
    summary: text("summary").notNull(),
    supersedesVerificationRecordId: uuid("supersedes_verification_record_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check(
      "verification_records_no_self_approval",
      sql`${table.approvedByStaffProfileId} IS NULL OR ${table.approvedByStaffProfileId} <> ${table.reviewerStaffProfileId} OR COALESCE(current_setting('app.bootstrap_admin_actor_id', true), '') = ${table.approvedByStaffProfileId}::text`,
    ),
    check(
      "verification_records_verified_requires_approver",
      sql`${table.status} <> 'verified' OR ${table.approvedByStaffProfileId} IS NOT NULL`,
    ),
    staffSelectPolicy("verification_records"),
    serviceRoleBypassPolicy("verification_records"),
  ],
).enableRLS();

/** Every verification must cite at least one official source (enforced in the app layer + trigger). */
export const verificationRecordSources = pgTable(
  "verification_record_sources",
  {
    verificationRecordId: uuid("verification_record_id")
      .notNull()
      .references(() => verificationRecords.id, { onDelete: "cascade" }),
    officialSourceId: uuid("official_source_id")
      .notNull()
      .references(() => officialSources.id, { onDelete: "restrict" }),
  },
  (table) => [
    primaryKey({ columns: [table.verificationRecordId, table.officialSourceId] }),
    staffSelectPolicy("verification_record_sources"),
    serviceRoleBypassPolicy("verification_record_sources"),
  ],
).enableRLS();

/** The exact fact location and minimal evidence text needed to reproduce a verification decision. */
export const sourceEvidence = pgTable(
  "source_evidence",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    opportunityId: uuid("opportunity_id")
      .notNull()
      .references(() => opportunities.id, { onDelete: "cascade" }),
    officialSourceId: uuid("official_source_id")
      .notNull()
      .references(() => officialSources.id, { onDelete: "restrict" }),
    verificationRecordId: uuid("verification_record_id").references(() => verificationRecords.id),
    kind: sourceEvidenceKindEnum("kind").notNull(),
    status: sourceEvidenceStatusEnum("status").notNull().default("captured"),
    sourceLocator: text("source_locator"),
    evidenceText: text("evidence_text").notNull(),
    capturedAt: timestamp("captured_at", { withTimezone: true }).notNull().defaultNow(),
    capturedByStaffProfileId: uuid("captured_by_staff_profile_id")
      .notNull()
      .references(() => staffProfiles.id),
    /** Who accepted this evidence ('captured' -> 'accepted') — must differ from whoever captured it. */
    approvedByStaffProfileId: uuid("approved_by_staff_profile_id").references(() => staffProfiles.id),
    supersededAt: timestamp("superseded_at", { withTimezone: true }),
  },
  (table) => [
    check(
      "source_evidence_no_self_approval",
      sql`${table.approvedByStaffProfileId} IS NULL OR ${table.approvedByStaffProfileId} <> ${table.capturedByStaffProfileId} OR COALESCE(current_setting('app.bootstrap_admin_actor_id', true), '') = ${table.approvedByStaffProfileId}::text`,
    ),
    check(
      "source_evidence_accepted_requires_approver",
      sql`${table.status} <> 'accepted' OR ${table.approvedByStaffProfileId} IS NOT NULL`,
    ),
    staffSelectPolicy("source_evidence"),
    serviceRoleBypassPolicy("source_evidence"),
  ],
).enableRLS();
