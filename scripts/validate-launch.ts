/**
 * Checkpoint 7: `npm run launch:validate`.
 *
 * Focused specifically on launch *environment documentation* readiness (per
 * the checkpoint's §3 "Launch configuration" requirements) — distinct from
 * `checkpoint7:validate`, which checks that Checkpoint 7's own deliverables
 * (docs, scripts, commands) exist. This script verifies every documented
 * production variable is genuinely covered by `.env.example`, that no secret
 * is `NEXT_PUBLIC_`-prefixed, and that optional features default to disabled
 * — all pure, read-only checks against a committed file, safe to run
 * anywhere with no side effects.
 *
 * `validateProductionEnvironment()`'s actual runtime *behavior* (does it
 * really throw/not-throw under simulated production configurations) is a
 * fundamentally different kind of check — it mutates `process.env` to
 * simulate scenarios and exercises live code — and lives in the separate
 * `npm run launch:validate:env-behavior` (`scripts/validate-production-env-behavior.ts`).
 * See Phase 4 item 6 of the launch-audit remediation for why these were split.
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const errors: string[] = [];
let checksPassed = 0;

function check(condition: boolean, message: string): void {
  if (condition) {
    checksPassed += 1;
    return;
  }
  errors.push(message);
}

function read(relativePath: string): string {
  const absolutePath = path.join(root, relativePath);
  return existsSync(absolutePath) ? readFileSync(absolutePath, "utf8") : "";
}

const envExample = read(".env.example");

// ---------------------------------------------------------------------------
// 1. .env.example documents every variable named in the checkpoint brief §3
// ---------------------------------------------------------------------------
const REQUIRED_DOCUMENTED_VARS = [
  "APP_BASE_URL",
  "NEXT_PUBLIC_APP_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_SECRET_KEY",
  "DATABASE_URL",
  "DATABASE_MIGRATION_URL",
  "AI_ENABLED",
  "AI_PROVIDER",
  "GROQ_API_KEY",
  "NEXT_PUBLIC_ANALYTICS_ENABLED",
  "NEXT_PUBLIC_ADS_ENABLED",
  "NEXT_PUBLIC_FEEDBACK_EMAIL",
  "SUPPORT_EMAIL",
  "SECURITY_CONTACT_EMAIL",
  "SENTRY_DSN",
  "NEXT_PUBLIC_SENTRY_DSN",
  "NEXT_PUBLIC_VAPID_PUBLIC_KEY",
  "VAPID_PRIVATE_KEY",
  "APP_ENV",
];
for (const varName of REQUIRED_DOCUMENTED_VARS) {
  check(envExample.includes(`${varName}=`), `.env.example must document ${varName}.`);
}

// ---------------------------------------------------------------------------
// 2. No secret variable is NEXT_PUBLIC_-prefixed
// ---------------------------------------------------------------------------
// SENTRY_DSN is deliberately excluded here: NEXT_PUBLIC_SENTRY_DSN is a real,
// separate, intentionally-public variable (a client-side error-reporting
// endpoint, not a secret — see docs/checkpoint-6/checkpoint-6-architecture.md
// §6), not "SENTRY_DSN with an accidental prefix." Checking for the exact
// substring "NEXT_PUBLIC_SENTRY_DSN" would always false-positive against that
// legitimate variable.
const SECRET_VAR_NAMES = ["SUPABASE_SECRET_KEY", "DATABASE_URL", "DATABASE_MIGRATION_URL", "GROQ_API_KEY", "VAPID_PRIVATE_KEY"];
for (const varName of SECRET_VAR_NAMES) {
  check(!envExample.includes(`NEXT_PUBLIC_${varName}`), `${varName} must never be documented with a NEXT_PUBLIC_ prefix.`);
}

// ---------------------------------------------------------------------------
// 3. Local build never requires optional production services
// ---------------------------------------------------------------------------
check(envExample.includes("AI_ENABLED=false"), "AI must default to disabled in .env.example.");
check(envExample.includes("NEXT_PUBLIC_ANALYTICS_ENABLED=false"), "Analytics must default to disabled in .env.example.");
check(envExample.includes("NEXT_PUBLIC_ADS_ENABLED=false"), "Ads must default to disabled in .env.example.");

function main(): void {
  console.log(`launch:validate: ${checksPassed} check(s) passed.`);

  if (errors.length > 0) {
    console.error(`\nlaunch:validate found ${errors.length} problem(s):\n`);
    for (const error of errors) {
      console.error(`  - ${error}`);
    }
    process.exit(1);
  }

  console.log("launch:validate: launch environment documentation is ready. Run `npm run launch:validate:env-behavior` to also verify validateProductionEnvironment()'s runtime behavior.");
}

main();
