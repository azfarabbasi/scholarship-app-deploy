import "dotenv/config";

/**
 * Fails loudly and early rather than letting every test silently error one
 * by one. `db:test` requires DATABASE_URL to point at a reachable,
 * already-migrated local/test Postgres (run `npm run db:reset:test` first,
 * or `docker compose --profile test run --rm e2e` which does this for you).
 */
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "DATABASE_URL is not set. Integration tests require a local test database — " +
      "run `docker compose up -d db-test` (or `db`) and `npm run db:reset:test` first. " +
      "See docs/checkpoint-2/migration-runbook.md.",
  );
}

if (!/scholartrack_test|localhost|127\.0\.0\.1|db-test/.test(connectionString)) {
  throw new Error(
    "DATABASE_URL does not look like a local/test database. Refusing to run integration tests " +
      "against what might be a shared or production database.",
  );
}
