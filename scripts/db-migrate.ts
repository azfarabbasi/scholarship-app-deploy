import "dotenv/config";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

const connectionString = process.env.DATABASE_MIGRATION_URL ?? process.env.DATABASE_URL;

if (!connectionString) {
  console.error("DATABASE_MIGRATION_URL (or DATABASE_URL) must be set. See docs/checkpoint-2/supabase-setup.md.");
  process.exit(1);
}

async function main() {
  const migrationClient = postgres(connectionString as string, { max: 1 });
  const db = drizzle(migrationClient);

  console.log("Applying Drizzle migrations from ./drizzle ...");
  await migrate(db, { migrationsFolder: "./drizzle" });
  console.log("Migrations applied successfully.");

  await migrationClient.end();
}

main().catch((error: unknown) => {
  console.error("Migration failed:");
  console.error(error);
  process.exit(1);
});
