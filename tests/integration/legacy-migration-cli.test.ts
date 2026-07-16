import { execFileSync } from "node:child_process";
import path from "node:path";
import { eq, like } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as schema from "../../src/lib/db/schema";
import { client, db } from "./helpers";

const repoRoot = path.resolve(__dirname, "../..");

function runImporter(...args: string[]): string {
  // On Windows, `npx` is a .cmd shim, which Node can only execute through a
  // shell (see the Node.js child_process docs on Windows .bat/.cmd files).
  return execFileSync("npx", ["tsx", "scripts/import-legacy-scholarships.ts", ...args], {
    cwd: repoRoot,
    env: process.env,
    encoding: "utf8",
    shell: process.platform === "win32",
  });
}

/**
 * Black-box tests against the real CLI entrypoint (not a refactored helper
 * function) so this exercises exactly what `npm run db:import:legacy` runs.
 */
describe("legacy migration CLI", () => {
  beforeAll(async () => {
    // Start from a known state: nothing imported yet.
    const existing = await db
      .select({ id: schema.opportunities.id })
      .from(schema.opportunities)
      .where(like(schema.opportunities.legacyMigrationReference, "legacy-id-%"));
    for (const row of existing) {
      await db.delete(schema.opportunities).where(eq(schema.opportunities.id, row.id));
    }
  });

  afterAll(async () => {
    await client.end();
  });

  it("dry-run reports all 55 legacy records as creatable and writes nothing", async () => {
    const output = runImporter("--dry-run");
    expect(output).toMatch(/Total records: 55/);
    expect(output).toMatch(/Created: 55/);
    expect(output).toMatch(/Rejected: 0/);

    const count = await db
      .select({ id: schema.opportunities.id })
      .from(schema.opportunities)
      .where(like(schema.opportunities.legacyMigrationReference, "legacy-id-%"));
    expect(count).toHaveLength(0);
  });

  it("imports all 55 records as unverified drafts with an official source each", async () => {
    const output = runImporter();
    expect(output).toMatch(/Created: 55/);

    const rows = await db
      .select()
      .from(schema.opportunities)
      .where(like(schema.opportunities.legacyMigrationReference, "legacy-id-%"));
    expect(rows).toHaveLength(55);
    expect(rows.every((r) => r.status === "draft")).toBe(true);
    expect(rows.every((r) => r.overallVerificationStatus === "unverified")).toBe(true);
    expect(rows.some((r) => r.status === "published")).toBe(false);

    const sourceLinks = await db.select().from(schema.opportunityOfficialSources);
    const opportunityIdsWithSource = new Set(sourceLinks.map((l) => l.opportunityId));
    expect(rows.every((r) => opportunityIdsWithSource.has(r.id))).toBe(true);
  });

  it("is idempotent: re-running creates zero new records and reports all 55 as already imported", async () => {
    const output = runImporter();
    expect(output).toMatch(/Created: 0/);
    expect(output).toMatch(/Skipped as already imported: 55/);

    const rows = await db
      .select({ id: schema.opportunities.id })
      .from(schema.opportunities)
      .where(like(schema.opportunities.legacyMigrationReference, "legacy-id-%"));
    expect(rows).toHaveLength(55);
  });

  it("rollback removes every record the import created", async () => {
    const output = runImporter("--rollback");
    expect(output).toMatch(/deleted 55 opportunity record/);

    const rows = await db
      .select({ id: schema.opportunities.id })
      .from(schema.opportunities)
      .where(like(schema.opportunities.legacyMigrationReference, "legacy-id-%"));
    expect(rows).toHaveLength(0);
  });

  it("re-importing after a rollback works again (not permanently blocked)", async () => {
    const output = runImporter();
    expect(output).toMatch(/Created: 55/);

    const rows = await db
      .select({ id: schema.opportunities.id })
      .from(schema.opportunities)
      .where(like(schema.opportunities.legacyMigrationReference, "legacy-id-%"));
    expect(rows).toHaveLength(55);

    // Leave a clean slate for other integration tests / a following full re-run.
    runImporter("--rollback");
  });
});
