import { pgRole } from "drizzle-orm/pg-core";

/**
 * Postgres roles created and managed by Supabase itself (Auth + PostgREST).
 * Marked `.existing()` so Drizzle Kit never tries to CREATE/DROP them — our
 * migrations only attach RLS policies to these roles. The local test-only
 * Postgres container recreates equivalent roles via
 * `scripts/db/local-auth-shim.sql` before migrations run.
 */
export const anonRole = pgRole("anon", { createDb: false, createRole: false, inherit: true }).existing();
export const authenticatedRole = pgRole("authenticated", {
  createDb: false,
  createRole: false,
  inherit: true,
}).existing();
export const serviceRoleRole = pgRole("service_role", {
  createDb: false,
  createRole: false,
  inherit: true,
}).existing();
