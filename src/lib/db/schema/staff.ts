import { sql } from "drizzle-orm";
import { pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { serviceRoleBypassPolicy, staffSelectOwnOrRolePolicy } from "./common";
import { staffProfileStatusEnum, staffRoleEnum } from "./enums";

/**
 * One row per staff member, keyed by their Supabase Auth user id (never a
 * second identity). Created by the bootstrap script or an administrator
 * invite flow — never through public registration.
 */
export const staffProfiles = pgTable(
  "staff_profiles",
  {
    /** Same value as `auth.users.id`; intentionally not a DB-level FK across schemas. */
    id: uuid("id").primaryKey(),
    email: text("email").notNull(),
    displayName: text("display_name").notNull(),
    status: staffProfileStatusEnum("status").notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("staff_profiles_email_key").on(table.email),
    // A staff member may always read their own row (needed for the account
    // nav/session UI); reading the *whole* directory via direct Supabase
    // REST is narrowed to administrators only, matching `canManageStaff` in
    // `src/lib/auth/permissions.ts` — the app itself resolves assignee names
    // through the privileged server connection, not this policy. Nobody
    // except our privileged server (bootstrap/invite flow) writes.
    staffSelectOwnOrRolePolicy("staff_profiles", table.id, ["administrator"]),
    serviceRoleBypassPolicy("staff_profiles"),
  ],
).enableRLS();

/**
 * A staff member's role grant. Revocation is soft (`revoked_at`) so history
 * is preserved for audit. Only one active (non-revoked) row may exist per
 * (staff, role) pair — enforced by the partial unique index below.
 */
export const staffRoleAssignments = pgTable(
  "staff_role_assignments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    staffProfileId: uuid("staff_profile_id")
      .notNull()
      .references(() => staffProfiles.id, { onDelete: "cascade" }),
    role: staffRoleEnum("role").notNull(),
    assignedByStaffProfileId: uuid("assigned_by_staff_profile_id").references(() => staffProfiles.id),
    assignedAt: timestamp("assigned_at", { withTimezone: true }).notNull().defaultNow(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    revokedByStaffProfileId: uuid("revoked_by_staff_profile_id").references(() => staffProfiles.id),
  },
  (table) => [
    uniqueIndex("staff_role_assignments_active_unique")
      .on(table.staffProfileId, table.role)
      .where(sql`${table.revokedAt} IS NULL`),
    // Same reasoning as `staff_profiles` above: a staff member may read
    // their own role grants; seeing everyone else's role assignments via
    // direct REST is administrator-only.
    staffSelectOwnOrRolePolicy("staff_role_assignments", table.staffProfileId, ["administrator"]),
    serviceRoleBypassPolicy("staff_role_assignments"),
  ],
).enableRLS();
