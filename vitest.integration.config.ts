import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * Separate config for tests that need a real Postgres connection (schema,
 * RLS, triggers, migration idempotency). Run via `npm run db:test` against
 * the ephemeral `db-test` container — see docs/checkpoint-2/migration-runbook.md.
 * Never mixed into the default `npm run test` run, which must stay usable
 * with no database at all.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    globals: true,
    setupFiles: ["./tests/integration/setup.ts"],
    include: ["tests/integration/**/*.test.ts"],
    testTimeout: 20000,
    hookTimeout: 20000,
    // These tests share one real Postgres database and mutate global tables
    // (opportunities, audit_log, import_jobs) — running test files in
    // parallel would race. Sequential is slower but correct.
    fileParallelism: false,
  },
});
