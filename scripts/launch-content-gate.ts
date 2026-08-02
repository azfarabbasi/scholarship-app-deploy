/**
 * Checkpoint 7 / Phase 4 item 7: `npm run launch:content:gate`.
 *
 * `npm run launch:content` (`launch-content-report.ts`) reports the real,
 * database-queried published-record count but never fails — it degrades to
 * "not checked" with exit 0 when there's no database, and even when the
 * 100-record target isn't met it only prints a warning, by design, since
 * it's meant to be safe to run in any environment (including routine CI
 * against no database at all). That leaves nothing that actually GATES a
 * launch: a warning in log output is easy to miss or ignore.
 *
 * This script is the actual gate: it fails loudly (non-zero exit) unless
 * the real database's published count reaches the target. Unlike the report
 * above, a MISSING database is also a failure here, not a graceful
 * "not checked" — you cannot certify launch readiness without being able to
 * query the real data. Never wired into the routine push/PR CI pipeline
 * (`.github/workflows/ci.yml`) — it would permanently fail there, since CI's
 * ephemeral database only ever holds imported legacy/test fixtures, never
 * real reviewed content. Run this manually (or from a dedicated,
 * separately-triggered "launch readiness" workflow) against the real or a
 * staging database before actually announcing a launch.
 *
 * This script never fabricates, approves, or publishes anything — it only
 * ever reads. If the gate is red, the fix is real review work, never
 * lowering the target or bulk-publishing unreviewed content.
 */
import "dotenv/config";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../src/lib/db/schema";

const DEFAULT_TARGET = 100;

/**
 * Override only for a deliberate, documented "limited beta" launch (see
 * docs/checkpoint-7/production-deployment-runbook.md §0) — never set this to
 * paper over a target that hasn't actually been reached. Must be a positive
 * integer; anything else is treated as a configuration error, not a lowered
 * target.
 */
function resolveTarget(): number {
  const raw = process.env.LAUNCH_CONTENT_TARGET;
  if (!raw) return DEFAULT_TARGET;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    console.error(`launch:content:gate: LAUNCH_CONTENT_TARGET="${raw}" is not a positive integer.`);
    process.exit(1);
  }
  return parsed;
}

async function main() {
  const target = resolveTarget();
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    console.error("launch:content:gate: DATABASE_URL is not set — cannot certify content readiness without querying the real database.");
    console.error("This gate fails closed: no database means launch readiness is unproven, not assumed passing.");
    process.exit(1);
  }

  const client = postgres(connectionString, { max: 1 });
  const db = drizzle(client, { schema });

  try {
    const publishedRows = await db
      .select({ id: schema.opportunities.id })
      .from(schema.opportunities)
      .where(eq(schema.opportunities.status, "published"));
    const published = publishedRows.length;

    console.log(`launch:content:gate: ${published} published record(s) / target ${target}.`);

    if (published < target) {
      console.error(
        `launch:content:gate: RED — only ${published}/${target} real, human-reviewed published opportunities exist. ` +
          "Do not launch, and do not close this gate by fabricating, bulk-approving, or bulk-publishing content — " +
          "only genuine staff review (see docs/checkpoint-7/database-launch-runbook.md) may raise this count.",
      );
      process.exit(1);
    }

    console.log(`launch:content:gate: GREEN — ${published}/${target} published opportunities meets the content-readiness target.`);
  } finally {
    await client.end();
  }
}

main().catch((error: unknown) => {
  console.error("launch:content:gate failed:", error);
  process.exit(1);
});
