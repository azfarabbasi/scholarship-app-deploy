/**
 * Fully resets the LOCAL TEST database: drops and recreates the public/app/
 * drizzle schemas, re-applies the local auth shim, runs every migration, and
 * seeds taxonomies. Used by `npm run db:reset:test` and by the Docker `test`
 * profile's `web-e2e`/`e2e` services on every run (see docker-compose.yml).
 *
 * Refuses to run unless DATABASE_URL clearly points at a local/test database
 * — this is a destructive operation and must never be pointed at a shared or
 * cloud database by accident.
 */
import "dotenv/config";
import { execFileSync } from "node:child_process";
import postgres from "postgres";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL must be set.");
  process.exit(1);
}

if (!/scholartrack_test|localhost|127\.0\.0\.1|db-test/.test(connectionString)) {
  console.error(
    "Refusing to reset a database whose connection string doesn't look like a local/test database " +
      `(got: ${connectionString.replace(/:[^:@]+@/, ":***@")}). Set DATABASE_URL to the db-test service or localhost.`,
  );
  process.exit(1);
}

function run(command: string, args: string[]) {
  console.log(`$ ${command} ${args.join(" ")}`);
  execFileSync(command, args, { stdio: "inherit", shell: process.platform === "win32" });
}

async function resetSchemas() {
  const sql = postgres(connectionString as string, { max: 1 });
  await sql.unsafe("drop schema if exists public cascade;");
  await sql.unsafe("create schema public;");
  await sql.unsafe("drop schema if exists app cascade;");
  await sql.unsafe("drop schema if exists auth cascade;");
  await sql.unsafe("drop schema if exists drizzle cascade;");
  await sql.end();
}

async function main() {
  console.log("Resetting local test database schemas...");
  await resetSchemas();
  run("npx", ["tsx", "scripts/db-apply-sql.ts", "scripts/db/local-auth-shim.sql"]);
  run("npx", ["tsx", "scripts/db-migrate.ts"]);
  run("npx", ["tsx", "scripts/db-seed-taxonomies.ts"]);
  console.log("Local test database reset complete.");
}

main().catch((error: unknown) => {
  console.error("db:reset:test failed:", error);
  process.exit(1);
});
