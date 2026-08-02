/**
 * Checkpoint 7 / Phase 4: `npm run launch:validate:env-behavior`.
 *
 * Split out of `validate-launch.ts` (which now covers only static,
 * side-effect-free checks against the committed `.env.example` file) because
 * this script is a fundamentally different kind of check: it MUTATES the
 * current process's `process.env` to simulate several production
 * configurations and calls the real, live `validateProductionEnvironment()`
 * function, asserting on its actual throw/no-throw behavior. That's real
 * behavioral verification of live code, not a read-only documentation check —
 * conflating the two in one script made it unclear which failures meant "the
 * docs are incomplete" versus "the boot-time guard itself is broken," and
 * risked a leaked/dirty `process.env` mutation affecting whatever command
 * happened to run in the same shell session afterward if a future edit ever
 * introduced an early-return before the `finally` block. This script is
 * self-contained and restores `process.env` when it finishes.
 */

const errors: string[] = [];
let checksPassed = 0;

function check(condition: boolean, message: string): void {
  if (condition) {
    checksPassed += 1;
    return;
  }
  errors.push(message);
}

const REQUIRED_PRODUCTION_ENV: Record<string, string> = {
  SUPABASE_SECRET_KEY: "test-secret",
  DATABASE_URL: "postgres://test:test@localhost:5432/test",
  NEXT_PUBLIC_SUPABASE_URL: "https://test.supabase.co",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "test-key",
  APP_BASE_URL: "https://example.com",
  NEXT_PUBLIC_APP_URL: "https://example.com",
  ENABLE_DATABASE_CATALOGUE: "true",
  ENABLE_STAFF_ADMIN: "true",
};

const ALL_MANAGED_KEYS = [...Object.keys(REQUIRED_PRODUCTION_ENV), "APP_ENV", "ALLOW_ADMIN_SELF_REVIEW"];

async function throwsOnValidate(): Promise<boolean> {
  const { validateProductionEnvironment, resetPublicEnvCacheForTests } = await import("../src/lib/env");
  resetPublicEnvCacheForTests();
  try {
    validateProductionEnvironment();
    return false;
  } catch {
    return true;
  }
}

function setCompleteProductionEnv(): void {
  for (const [key, value] of Object.entries(REQUIRED_PRODUCTION_ENV)) {
    process.env[key] = value;
  }
  process.env.APP_ENV = "production";
  delete process.env.ALLOW_ADMIN_SELF_REVIEW;
}

async function checkProductionValidationBehavior(): Promise<void> {
  const originalEnv = { ...process.env };
  try {
    for (const key of ALL_MANAGED_KEYS) delete process.env[key];
    process.env.APP_ENV = "production";
    check(await throwsOnValidate(), "validateProductionEnvironment() must throw when APP_ENV=production but required variables are missing.");

    setCompleteProductionEnv();
    check(!(await throwsOnValidate()), "validateProductionEnvironment() must NOT throw once every required production variable is set.");

    process.env.APP_ENV = "development";
    check(!(await throwsOnValidate()), "validateProductionEnvironment() must be a no-op outside APP_ENV=production, even with nothing configured.");

    // --- Phase 4 item 5: ENABLE_DATABASE_CATALOGUE / ENABLE_STAFF_ADMIN / ALLOW_ADMIN_SELF_REVIEW ---

    setCompleteProductionEnv();
    delete process.env.ENABLE_DATABASE_CATALOGUE;
    check(await throwsOnValidate(), "validateProductionEnvironment() must throw when ENABLE_DATABASE_CATALOGUE is left unset in production.");

    setCompleteProductionEnv();
    delete process.env.ENABLE_STAFF_ADMIN;
    check(await throwsOnValidate(), "validateProductionEnvironment() must throw when ENABLE_STAFF_ADMIN is left unset in production.");

    setCompleteProductionEnv();
    process.env.ENABLE_DATABASE_CATALOGUE = "false";
    check(
      !(await throwsOnValidate()),
      "validateProductionEnvironment() must NOT throw when ENABLE_DATABASE_CATALOGUE is explicitly \"false\" — this is the documented emergency-rollback state (production-deployment-runbook.md §5), not a misconfiguration.",
    );

    setCompleteProductionEnv();
    process.env.ALLOW_ADMIN_SELF_REVIEW = "true";
    check(await throwsOnValidate(), "validateProductionEnvironment() must throw when ALLOW_ADMIN_SELF_REVIEW=true in production — it must never be enabled outside local development.");

    setCompleteProductionEnv();
    process.env.ALLOW_ADMIN_SELF_REVIEW = "false";
    check(!(await throwsOnValidate()), "validateProductionEnvironment() must NOT throw when ALLOW_ADMIN_SELF_REVIEW is explicitly \"false\".");
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

  console.log(`launch:validate:env-behavior: ${checksPassed} check(s) passed.`);

  if (errors.length > 0) {
    console.error(`\nlaunch:validate:env-behavior found ${errors.length} problem(s):\n`);
    for (const error of errors) {
      console.error(`  - ${error}`);
    }
    process.exit(1);
  }

  console.log("launch:validate:env-behavior: validateProductionEnvironment() behaves correctly under every simulated scenario.");
}

main().catch((error: unknown) => {
  console.error("launch:validate:env-behavior failed:", error);
  process.exit(1);
});
