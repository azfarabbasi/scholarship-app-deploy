import { jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { serviceRoleBypassPolicy, staffSelectPolicy } from "./common";
import { auditActionEnum, auditLogStatusEnum, staffRoleEnum } from "./enums";

/**
 * Append-only by construction: a `BEFORE UPDATE OR DELETE` trigger
 * (`audit_log_immutable`, defined in the hand-written
 * `drizzle/0000_auth_helpers.sql` migration) unconditionally rejects any
 * mutation, including from our own privileged server connection. No secret,
 * credential, note body, or document content is ever written to this table —
 * `redacted_change_summary` is a pre-redacted, reviewer-authored string, not
 * raw before/after row data.
 */
export const auditLog = pgTable(
  "audit_log",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    actorStaffProfileId: uuid("actor_staff_profile_id"),
    actorRole: staffRoleEnum("actor_role"),
    action: auditActionEnum("action").notNull(),
    entityName: text("entity_name").notNull(),
    entityId: uuid("entity_id"),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
    reasonCode: text("reason_code"),
    correlationId: text("correlation_id"),
    changedFields: jsonb("changed_fields"),
    redactedChangeSummary: text("redacted_change_summary"),
    retentionExpiresAt: timestamp("retention_expires_at", { withTimezone: true }),
    status: auditLogStatusEnum("status").notNull().default("active"),
  },
  () => [staffSelectPolicy("audit_log"), serviceRoleBypassPolicy("audit_log")],
).enableRLS();
