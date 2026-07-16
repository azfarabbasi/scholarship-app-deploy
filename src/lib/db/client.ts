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

  const client = postgres(connectionString, { max: 10 });
  cachedDb = drizzle(client, { schema });
  return cachedDb;
}

export type Database = ReturnType<typeof getDb>;
export { schema };
