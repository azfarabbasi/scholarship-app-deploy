import "server-only";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { EnvironmentConfigurationError, getServerEnv } from "@/lib/env";
import * as schema from "./schema";

/**
 * The privileged, direct-to-Postgres connection our server code uses for
 * every read and write. It connects as the table owner and therefore
 * bypasses RLS entirely — RLS in this project exists to lock down Supabase's
 * separate PostgREST "data API" (see the design note in
 * `src/lib/db/schema/common.ts`), not to gate this connection. Every
 * mutation must therefore be authorised in application code (see
 * `src/lib/auth/permissions.ts`) before it reaches this client.
 */

let cachedDb: ReturnType<typeof drizzle<typeof schema>> | null = null;

export function getDb() {
  if (cachedDb) {
    return cachedDb;
  }

  let connectionString: string;
  try {
    connectionString = getServerEnv("the database").DATABASE_URL;
  } catch (error) {
    if (error instanceof EnvironmentConfigurationError) {
      throw error;
    }
    throw new EnvironmentConfigurationError("the database");
  }

  // `prepare: false` is required against Supabase's Transaction pooler
  // (port 6543, pgbouncer in transaction mode): a prepared statement is
  // scoped to one physical Postgres backend connection, but the pooler can
  // route each query to a different backend, so a statement prepared on one
  // connection can be executed against another that never prepared it.
  // Symptom seen in practice: a query silently returns zero rows for a row
  // that demonstrably exists, intermittently and worse under concurrency —
  // not an error, just wrong results. Safe to disable unconditionally, even
  // against a direct (non-pooled) connection; it only forgoes an
  // optimization there, never changes correctness.
  const client = postgres(connectionString, { max: 10, prepare: false });
  cachedDb = drizzle(client, { schema });
  return cachedDb;
}

export type Database = ReturnType<typeof getDb>;
export { schema };
