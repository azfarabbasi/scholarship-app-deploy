/**
 * Checkpoint 7: `npm run launch:validate`.
 *
 * Focused specifically on launch *environment configuration* readiness (per
 * the checkpoint's §3 "Launch configuration" requirements) — distinct from
 * `checkpoint7:validate`, which checks that Checkpoint 7's own deliverables
 * (docs, scripts, commands) exist. This script verifies every documented
 * production variable is genuinely covered by `.env.example`, and exercises
 * `validateProductionEnvironment()` directly against simulated environments
 * to confirm it actually catches a missing-config production deployment
 * rather than just existing in source.
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

// ---------------------------------------------------------------------------
// 4. validateProductionEnvironment() actually catches a misconfigured
//    production deployment — exercised directly, not just checked for
//    existence in source.
// ---------------------------------------------------------------------------
async function checkProductionValidationBehavior(): Promise<void> {
  const originalEnv = { ...process.env };
  try {
    for (const key of ["APP_ENV", "SUPABASE_SECRET_KEY", "DATABASE_URL", "NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "APP_BASE_URL", "NEXT_PUBLIC_APP_URL"]) {
      delete process.env[key];
    }
    process.env.APP_ENV = "production";

    const { validateProductionEnvironment, resetPublicEnvCacheForTests } = await import("../src/lib/env");
    resetPublicEnvCacheForTests();

    let threw = false;
    try {
      validateProductionEnvironment();
    } catch {
      threw = true;
    }
    check(threw, "validateProductionEnvironment() must throw when APP_ENV=production but required variables are missing.");

    process.env.SUPABASE_SECRET_KEY = "test-secret";
    process.env.DATABASE_URL = "postgres://test:test@localhost:5432/test";
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "test-key";
    process.env.APP_BASE_URL = "https://example.com";
    process.env.NEXT_PUBLIC_APP_URL = "https://example.com";
    resetPublicEnvCacheForTests();

    let threwWhenComplete = false;
    try {
      validateProductionEnvironment();
    } catch {
      threwWhenComplete = true;
    }
    check(!threwWhenComplete, "validateProductionEnvironment() must NOT throw once every required production variable is set.");

    process.env.APP_ENV = "development";
    resetPublicEnvCacheForTests();
    let threwInDev = false;
    try {
      validateProductionEnvironment();
    } catch {
      threwInDev = true;
    }
    check(!threwInDev, "validateProductionEnvironment() must be a no-op outside APP_ENV=production, even with nothing configured.");
  } finally {
    for (const key of Object.keys(process.env)) {
      if (!(key in originalEnv)) delete process.env[key];
    }
    Object.assign(process.env, originalEnv);
    const { resetPublicEnvCacheForTests } = await import("../src/lib/env");
    resetPublicEnvCacheForTests();
  }
}

async function main(): Promise<void> {
  await checkProductionValidationBehavior();

  console.log(`launch:validate: ${checksPassed} check(s) passed.`);

  if (errors.length > 0) {
    console.error(`\nlaunch:validate found ${errors.length} problem(s):\n`);
    for (const error of errors) {
      console.error(`  - ${error}`);
    }
    process.exit(1);
  }

  console.log("launch:validate: launch environment configuration is ready.");
}

main().catch((error: unknown) => {
  console.error("launch:validate failed:", error);
  process.exit(1);
});
