/**
 * Checkpoint 7: `npm run launch:security`.
 *
 * Aggregates the existing `security:secrets` and `security:headers` checks
 * (run as real subprocesses, not reimplemented) with a handful of
 * launch-specific checks the Checkpoint 6 validators don't already cover:
 * abuse-prone-action rate limits, import size limits, correction-report
 * spam friction, and RLS test coverage actually existing on disk. Static
 * and dependency-free — no server or database required.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
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
function exists(relativePath: string): boolean {
  return existsSync(path.join(root, relativePath));
}

function runSubcheck(label: string, command: string, args: string[]): void {
  try {
    // Windows resolves `npx` through a .cmd shim, which execFileSync cannot
    // invoke directly without going through a shell (same pattern used by
    // scripts/db-reset-test.ts's own `run()` helper).
    execFileSync(command, args, { cwd: root, stdio: "pipe", shell: process.platform === "win32" });
    checksPassed += 1;
    console.log(`  [PASS] ${label}`);
  } catch (error) {
    const stdout = error && typeof error === "object" && "stdout" in error ? String((error as { stdout?: Buffer | string }).stdout ?? "") : "";
    errors.push(`${label} failed.${stdout ? ` Output:\n${stdout}` : ""}`);
    console.log(`  [FAIL] ${label}`);
  }
}

console.log("launch:security — re-running the underlying security checks as real subprocesses:");
runSubcheck("security:secrets", "npx", ["tsx", "scripts/security-secrets-scan.ts"]);
runSubcheck("security:headers", "npx", ["tsx", "scripts/security-headers-check.ts"]);

// ---------------------------------------------------------------------------
// Abuse-prone action rate limits
// ---------------------------------------------------------------------------
check(exists("src/lib/ai/rate-limit/guest.ts") && exists("src/lib/ai/rate-limit/user.ts"), "AI rate limiting (guest + signed-in) must exist.");
check(
  read("app/api/correction-reports/route.ts").includes("checkAndConsumeCookieQuota"),
  "The public correction-report endpoint must be rate-limited.",
);
check(
  read("src/lib/csv/parse.ts").includes("CSV_MAX_FILE_SIZE_BYTES") && read("src/lib/csv/parse.ts").includes("CSV_MAX_ROWS"),
  "CSV import must enforce a file-size and row-count limit.",
);
check(read("src/components/opportunities/ReportCorrectionDialog.tsx").includes("honeypot"), "Correction reports must carry honeypot spam friction.");

// ---------------------------------------------------------------------------
// RLS test coverage exists on disk (real, re-runnable — see db:test)
// ---------------------------------------------------------------------------
const REQUIRED_RLS_TEST_FILES = [
  "tests/integration/rls-policies.test.ts",
  "tests/integration/ai-rls.test.ts",
  "tests/integration/student-workspace-rls.test.ts",
  "tests/integration/discovery-rls.test.ts",
];
for (const file of REQUIRED_RLS_TEST_FILES) {
  check(exists(file), `Missing RLS test file: ${file}.`);
}

// ---------------------------------------------------------------------------
// No sensitive document upload (mirrors checkpoint6:validate's check, kept
// here too so launch:security is a self-contained launch-day command)
// ---------------------------------------------------------------------------
const SAFE_FILE_ACCEPT_VALUES = ["application/json", ".csv", "text/csv", ".json"];
function findUnsafeFileInputs(dir: string): string[] {
  const hits: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (["node_modules", ".git", ".next", "coverage"].includes(entry)) continue;
    const fullPath = path.join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      hits.push(...findUnsafeFileInputs(fullPath));
    } else if (entry.endsWith(".tsx") || entry.endsWith(".ts")) {
      const contents = readFileSync(fullPath, "utf8");
      if (/type=["']file["']/.test(contents)) {
        const acceptMatch = contents.match(/accept=["']([^"']+)["']/);
        const accept = acceptMatch?.[1];
        if (!accept || !SAFE_FILE_ACCEPT_VALUES.some((safe) => accept.includes(safe))) {
          hits.push(`${path.relative(root, fullPath)} (accept="${accept ?? "none"}")`);
        }
      }
    }
  }
  return hits;
}
const unsafeUploads = [...findUnsafeFileInputs(path.join(root, "app")), ...findUnsafeFileInputs(path.join(root, "src"))];
check(unsafeUploads.length === 0, `No document/image upload should exist anywhere (found: ${unsafeUploads.join(", ") || "none"}).`);

console.log(`\nlaunch:security: ${checksPassed} check(s) passed.`);

if (errors.length > 0) {
  console.error(`\nlaunch:security found ${errors.length} problem(s):\n`);
  for (const error of errors) {
    console.error(`  - ${error}`);
  }
  process.exit(1);
}

console.log("launch:security: all launch security checks passed.");
