import "server-only";
import type { Database } from "@/lib/db/client";
import { schema } from "@/lib/db/client";
import type { StaffRole } from "@/lib/auth/permissions";

type AuditAction = (typeof schema.auditActionEnum.enumValues)[number];

/** Accepts either the base client or a `db.transaction(async (tx) => ...)` callback's `tx`. */
export type DbExecutor = Database | Parameters<Parameters<Database["transaction"]>[0]>[0];

export interface AuditEventInput {
  actorStaffProfileId: string | null;
  actorRole: StaffRole | null;
  action: AuditAction;
  entityName: string;
  entityId: string | null;
  reasonCode?: string | null;
  correlationId?: string | null;
  changedFields?: readonly string[];
  /** Pre-redacted, human-authored summary — never raw row contents. */
  redactedChangeSummary?: string | null;
}

/**
 * Every mutation server action should call this in the same transaction as
 * its data change. The table itself is append-only (see the
 * `audit_log_immutable_*` triggers in `drizzle/0002_publication_invariants.sql`),
 * so this function only ever inserts.
 */
export async function recordAuditEvent(db: DbExecutor, event: AuditEventInput): Promise<void> {
  await db.insert(schema.auditLog).values({
    actorStaffProfileId: event.actorStaffProfileId,
    actorRole: event.actorRole,
    action: event.action,
    entityName: event.entityName,
    entityId: event.entityId,
    reasonCode: event.reasonCode ?? null,
    correlationId: event.correlationId ?? null,
    changedFields: event.changedFields ?? null,
    redactedChangeSummary: event.redactedChangeSummary ?? null,
  });
}
