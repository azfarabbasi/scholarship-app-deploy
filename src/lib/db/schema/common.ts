import { sql, type SQL } from "drizzle-orm";
import { pgPolicy, timestamp, uuid, type AnyPgColumn } from "drizzle-orm/pg-core";

/**
 * Builds a `text[]` array literal for use inside a policy's `using`/`withCheck`
 * SQL. Policy definitions are DDL, not parameterized queries, so `sql`'s usual
 * `${value}` bind-parameter interpolation (which renders as `$1`, `$2`, ...)
 * would emit invalid, non-executable placeholders into the migration file.
 * `roles` here is always a small, fixed set of our own `staff_role` enum
 * values passed by call sites in this codebase (never external input), so a
 * strict allowlist check is enough to inline them as safe SQL literals.
 */
function staffRolesArrayLiteral(roles: readonly string[]): SQL {
  for (const role of roles) {
    if (!/^[a-z_]+$/.test(role)) {
      throw new Error(`Invalid staff role for RLS policy literal: ${role}`);
    }
  }
  return sql.raw(`ARRAY[${roles.map((role) => `'${role}'`).join(", ")}]::text[]`);
}
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

/**
 * SELECT policy for reference/catalogue data staff may read. `roles`
 * defaults to `undefined`/omitted, meaning "any active staff role
 * assignment" — the original, broad behavior every non-sensitive
 * staff-shared table still uses. Pass an explicit role list (matching
 * `app.is_staff`'s own `roles text[]` parameter) to narrow a specific,
 * more sensitive table to only the roles that actually need it — e.g.
 * `staffSelectPolicy("audit_log", ["administrator"])`. This mirrors the
 * app layer's own `can*` permission checks in `src/lib/auth/permissions.ts`
 * so RLS (defense-in-depth against direct Supabase REST access, never this
 * app's own authorization mechanism — see
 * `docs/checkpoint-2/checkpoint-2-architecture.md` §4) doesn't stay more
 * permissive than the UI it's meant to back up.
 */
export function staffSelectPolicy(tableName: string, roles?: readonly string[]) {
  const rolesLiteral = roles ? staffRolesArrayLiteral(roles) : sql`NULL`;
  return pgPolicy(`${tableName}_select_staff`, {
    as: "permissive",
    for: "select",
    to: authenticatedRole,
    using: sql`app.is_staff(auth.uid(), ${rolesLiteral})`,
  });
}

/**
 * SELECT policy for a table where a staff member may always see their own
 * row (`ownerColumn = auth.uid()`), and additionally any row if they hold
 * one of `adminRoles` — for tables like `staff_profiles`/
 * `staff_role_assignments` where "the whole directory" is more than a
 * baseline reviewer needs, but "nothing about anyone else at all" would
 * break a staff member seeing their own name/role.
 */
export function staffSelectOwnOrRolePolicy(tableName: string, ownerColumn: AnyPgColumn, adminRoles: readonly string[]) {
  const rolesLiteral = staffRolesArrayLiteral(adminRoles);
  // Reuses the `_select_staff` policy name (same as `staffSelectPolicy`) so
  // drizzle-kit's diff sees an in-place `ALTER POLICY` on this table rather
  // than a drop+create it would otherwise ask us to disambiguate as a
  // rename (drizzle-kit's interactive prompt for that needs a TTY we don't
  // have in CI/non-interactive shells).
  return pgPolicy(`${tableName}_select_staff`, {
    as: "permissive",
    for: "select",
    to: authenticatedRole,
    using: sql`${ownerColumn} = auth.uid() OR app.is_staff(auth.uid(), ${rolesLiteral})`,
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
