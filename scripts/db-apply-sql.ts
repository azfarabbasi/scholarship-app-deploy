/**
 * Applies a single raw .sql file to DATABASE_URL. Used for
 * scripts/db/local-auth-shim.sql, which is TEST-ONLY tooling and must never
 * be pointed at a real Supabase project (see the safety guard below).
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import postgres from "postgres";

const filePath = process.argv[2];
if (!filePath) {
  console.error("Usage: tsx scripts/db-apply-sql.ts <path-to-sql-file>");
  process.exit(1);
}

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL must be set.");
  process.exit(1);
}

if (filePath.includes("local-auth-shim") && !/scholartrack_test|localhost|127\.0\.0\.1/.test(connectionString)) {
  console.error(
    "Refusing to apply the local-auth-shim to a connection string that doesn't look like a local/test database. " +
      "This file redefines auth.uid()/auth.role() and must never run against a real Supabase project.",
  );
  process.exit(1);
}

async function main() {
  const sql = postgres(connectionString as string, { max: 1 });
  const fileContents = readFileSync(filePath, "utf8");
  await sql.unsafe(fileContents);
  await sql.end();
  console.log(`Applied ${filePath}`);
}

main().catch((error: unknown) => {
  console.error(`Failed to apply ${filePath}:`, error);
  process.exit(1);
});
