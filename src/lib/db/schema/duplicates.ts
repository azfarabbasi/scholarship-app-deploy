import { sql } from "drizzle-orm";
import { check, numeric, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { serviceRoleBypassPolicy, staffSelectPolicy } from "./common";
import { duplicateCandidateStatusEnum } from "./enums";
import { opportunities } from "./opportunities";
import { staffProfiles } from "./staff";

export const duplicateCandidates = pgTable(
  "duplicate_candidates",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    canonicalOpportunityId: uuid("canonical_opportunity_id")
      .notNull()
      .references(() => opportunities.id, { onDelete: "cascade" }),
    duplicateOpportunityId: uuid("duplicate_opportunity_id")
      .notNull()
      .references(() => opportunities.id, { onDelete: "cascade" }),
    detectionReason: text("detection_reason").notNull(),
    confidenceScore: numeric("confidence_score", { precision: 4, scale: 3 }).notNull(),
    status: duplicateCandidateStatusEnum("status").notNull().default("pending"),
    reviewedByStaffProfileId: uuid("reviewed_by_staff_profile_id").references(() => staffProfiles.id),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    resolutionNotes: text("resolution_notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check("duplicate_candidates_not_self", sql`${table.canonicalOpportunityId} <> ${table.duplicateOpportunityId}`),
    check(
      "duplicate_candidates_confidence_range",
      sql`${table.confidenceScore} >= 0 AND ${table.confidenceScore} <= 1`,
    ),
    // Matches `canManageDuplicates` in `src/lib/auth/permissions.ts` — a
    // baseline reviewer has no legitimate reason to browse duplicate
    // candidates via direct Supabase REST.
    staffSelectPolicy("duplicate_candidates", ["senior_reviewer", "administrator"]),
    serviceRoleBypassPolicy("duplicate_candidates"),
  ],
).enableRLS();
