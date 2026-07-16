import { sql, type SQL } from "drizzle-orm";
import { pgPolicy, timestamp, uuid, type AnyPgColumn } from "drizzle-orm/pg-core";
import { anonRole, authenticatedRole, serviceRoleRole } from "./roles";

/** Standard collision-resistant primary key: server-generated UUID v4. */
export function idColumn() {
  return uuid("id").defaultRandom().primaryKey();
}

/** `created_at` / `updated_at` pair used by every governed table. */
export const auditTimestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
};

/** SQL fragment used by `using`/`withCheck` policies to read the caller's JWT staff id. */
export const currentStaffId = sql`auth.uid()`;

/**
 * Server-side mutations run through our own Next.js server using the
 * privileged `DATABASE_URL` connection (the table owner role), which bypasses
 * RLS entirely — that connection is never reachable from a browser. RLS here
 * exists purely to lock down Supabase's auto-generated PostgREST "data API",
 * which is reachable directly from a browser using the public anon key and
 * would otherwise expose every table. Every table therefore gets exactly one
 * of these two read policies, and — for defense in depth, since our app does
 * not use the service_role key for normal operation — an explicit
 * `service_role` bypass policy. No table grants `anon`/`authenticated` an
 * INSERT/UPDATE/DELETE policy: with RLS enabled and no matching policy,
 * Postgres denies the operation by default, so every write must go through
 * our authorised server code.
 */
export function serviceRoleBypassPolicy(tableName: string) {
  return pgPolicy(`${tableName}_service_role_all`, {
    as: "permissive",
    for: "all",
    to: serviceRoleRole,
    using: sql`true`,
    withCheck: sql`true`,
  });
}

/** SELECT policy for reference/catalogue data any staff member (any role) may read. */
export function staffSelectPolicy(tableName: string) {
  return pgPolicy(`${tableName}_select_staff`, {
    as: "permissive",
    for: "select",
    to: authenticatedRole,
    using: sql`app.is_staff(auth.uid(), NULL)`,
  });
}

/** SELECT policy for public taxonomy/catalogue data, gated by a per-table predicate. */
export function publicSelectPolicy(tableName: string, predicate: SQL) {
  return pgPolicy(`${tableName}_select_public`, {
    as: "permissive",
    for: "select",
    to: [anonRole, authenticatedRole],
    using: predicate,
  });
}

/**
 * Student workspace tables (Checkpoint 3) are owned by an individual student,
 * never staff or the public. `ownerColumn` must be the table's own foreign
 * key back to `student_profiles.id` (or `student_profiles.id` itself). This
 * is the ONLY read/write policy those tables get — deliberately no
 * `staffSelectPolicy`, so staff never get casual read access to private
 * student workspace data (see `docs/checkpoint-3/privacy-and-data-controls.md`).
 * As with every other table, this is defense-in-depth against Supabase's
 * PostgREST data API; our own server bypasses RLS via the privileged
 * connection and enforces ownership in `src/lib/auth/student-session.ts` /
 * the Server Actions under `src/lib/db/actions/student/`.
 */
export function ownerAllPolicy(tableName: string, ownerColumn: AnyPgColumn) {
  return pgPolicy(`${tableName}_owner_all`, {
    as: "permissive",
    for: "all",
    to: authenticatedRole,
    using: sql`${ownerColumn} = auth.uid()`,
    withCheck: sql`${ownerColumn} = auth.uid()`,
  });
}

/**
 * Append-only variant for student-visible request logs (export/deletion
 * requests): the student may read and create their own rows, but never
 * edit or delete one after the fact — mirroring the staff audit log's
 * immutability, scoped to the student's own records.
 */
export function ownerReadInsertPolicies(tableName: string, ownerColumn: AnyPgColumn) {
  return [
    pgPolicy(`${tableName}_owner_select`, {
      as: "permissive",
      for: "select",
      to: authenticatedRole,
      using: sql`${ownerColumn} = auth.uid()`,
    }),
    pgPolicy(`${tableName}_owner_insert`, {
      as: "permissive",
      for: "insert",
      to: authenticatedRole,
      withCheck: sql`${ownerColumn} = auth.uid()`,
    }),
  ];
}
