import "dotenv/config";
import { defineConfig } from "drizzle-kit";

const connectionString = process.env.DATABASE_MIGRATION_URL ?? process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "DATABASE_MIGRATION_URL (or DATABASE_URL) must be set to run drizzle-kit. Copy .env.example to .env and fill it in — see docs/checkpoint-2/supabase-setup.md.",
  );
}

export default defineConfig({
  schema: "./src/lib/db/schema/index.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url: connectionString },
  verbose: true,
  strict: true,
});
