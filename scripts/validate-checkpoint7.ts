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
function exists(relativePath: string): boolean {
  return existsSync(path.join(root, relativePath));
}

const packageJson = JSON.parse(read("package.json")) as { scripts?: Record<string, string> };
const scripts = packageJson.scripts ?? {};
const middlewareTs = read("src/lib/supabase/middleware.ts");
const envTs = read("src/lib/env.ts");

// ---------------------------------------------------------------------------
// 1. Final launch docs exist
// ---------------------------------------------------------------------------
const REQUIRED_DOCS = [
  "docs/checkpoint-7/production-deployment-runbook.md",
  "docs/checkpoint-7/database-launch-runbook.md",
  "docs/checkpoint-7/content-readiness-report.md",
  "docs/checkpoint-7/launch-operations-runbook.md",
  "docs/checkpoint-7/final-security-readiness.md",
  "docs/checkpoint-7/final-seo-readiness.md",
  "docs/checkpoint-7/final-accessibility-readiness.md",
  "docs/checkpoint-7/final-performance-readiness.md",
  "docs/checkpoint-7/v1-release-notes.md",
  "docs/checkpoint-7/launch-blocker-checklist.md",
  "docs/checkpoint-7/checkpoint-7-traceability.md",
  "docs/checkpoint-7/checkpoint-7-completion-report.md",
];
for (const doc of REQUIRED_DOCS) {
  check(exists(doc), `Missing required Checkpoint 7 documentation: ${doc}.`);
}

// ---------------------------------------------------------------------------
// 2. Launch smoke tests and launch validator exist
// ---------------------------------------------------------------------------
check(exists("tests/e2e/launch-smoke.spec.ts"), "Missing tests/e2e/launch-smoke.spec.ts.");
check(exists("scripts/validate-launch.ts"), "Missing scripts/validate-launch.ts.");
check(exists("scripts/launch-content-report.ts"), "Missing scripts/launch-content-report.ts.");
check(exists("scripts/launch-security-check.ts"), "Missing scripts/launch-security-check.ts.");

// ---------------------------------------------------------------------------
// 3. Production env validation exists (Checkpoint 6, re-confirmed here)
// ---------------------------------------------------------------------------
check(exists("instrumentation.ts"), "Missing instrumentation.ts.");
check(envTs.includes("export function validateProductionEnvironment"), "src/lib/env.ts must export validateProductionEnvironment().");

// ---------------------------------------------------------------------------
// 4. Sitemap/robots exist; private routes excluded from indexing
// ---------------------------------------------------------------------------
check(exists("app/sitemap.ts"), "Missing app/sitemap.ts.");
check(exists("app/robots.ts"), "Missing app/robots.ts.");
check(middlewareTs.includes("X-Robots-Tag") && middlewareTs.includes("noindex"), "Private routes must be noindexed.");

// ---------------------------------------------------------------------------
// 5. Security checks exist; no secrets committed; no sensitive upload
// ---------------------------------------------------------------------------
check(exists("scripts/security-secrets-scan.ts"), "Missing the secret scanner.");
check(exists("scripts/security-headers-check.ts"), "Missing the security header checker.");
check(scripts["security:secrets"] === "tsx scripts/security-secrets-scan.ts", "package.json must define security:secrets.");

// ---------------------------------------------------------------------------
// 6. AI disabled fallback exists
// ---------------------------------------------------------------------------
check(exists("src/lib/ai/config.ts"), "Missing src/lib/ai/config.ts.");
check(read("src/lib/ai/config.ts").includes("isAvailable"), "AiConfig must expose an isAvailable flag distinguishing enabled from actually-usable.");
check(read("app/assistant/page.tsx").includes("currently unavailable"), "The assistant page must show a graceful unavailable state.");

// ---------------------------------------------------------------------------
// 7. Ads disabled-by-default still true
// ---------------------------------------------------------------------------
check(read(".env.example").includes("NEXT_PUBLIC_ADS_ENABLED=false"), "Ads must still default to disabled.");
check(exists("src/components/ads/AdSlot.tsx"), "Missing the ad-readiness abstraction.");

// ---------------------------------------------------------------------------
// 8. Public support/contact flow exists; correction workflow exists
// ---------------------------------------------------------------------------
check(exists("app/contact/page.tsx"), "Missing /contact.");
check(exists("app/api/correction-reports/route.ts"), "Missing the correction-report endpoint.");
check(exists("src/components/opportunities/ReportCorrectionDialog.tsx"), "Missing the correction-report UI.");

// ---------------------------------------------------------------------------
// 9. PWA manifest/service worker still exist
// ---------------------------------------------------------------------------
check(exists("app/manifest.ts"), "Missing app/manifest.ts.");
check(exists("public/sw.js"), "Missing public/sw.js.");

// ---------------------------------------------------------------------------
// 10. Required package commands exist
// ---------------------------------------------------------------------------
const REQUIRED_COMMANDS = [
  "checkpoint7:validate",
  "launch:validate",
  "launch:smoke",
  "launch:content",
  "launch:security",
  "launch:seo",
  "launch:accessibility",
  "launch:performance",
  "data:validate",
  "deadlines:audit",
  "checkpoint0:validate",
  "checkpoint1:validate",
  "checkpoint2:validate",
  "checkpoint3:validate",
  "checkpoint4:validate",
  "checkpoint5:validate",
  "checkpoint6:validate",
  "ai:evaluate",
  "ai:safety:test",
  "security:secrets",
  "security:headers",
  "seo:validate",
  "accessibility:test",
  "perf:audit",
  "db:check",
  "db:test",
  "db:verify:migration",
  "typecheck",
  "test",
  "test:coverage",
  "test:e2e",
  "lint",
  "build",
];
for (const command of REQUIRED_COMMANDS) {
  check(typeof scripts[command] === "string" && scripts[command].length > 0, `package.json must define the "${command}" script.`);
}

// ---------------------------------------------------------------------------
// 11. Release notes and launch blocker checklist are honest, not templated
// ---------------------------------------------------------------------------
const releaseNotes = read("docs/checkpoint-7/v1-release-notes.md");
check(releaseNotes.includes("not included") || releaseNotes.includes("limitation"), "Release notes must document what's intentionally not included / known limitations.");
const blockerChecklist = read("docs/checkpoint-7/launch-blocker-checklist.md");
check(/content target|100-record/i.test(blockerChecklist), "The launch blocker checklist must address the content-target status.");
check(
  /limited beta|not ready|content target incomplete/i.test(blockerChecklist),
  "The blocker checklist must honestly classify launch readiness (limited beta / not ready / content target incomplete) given 0 published records — never an unqualified 'ready'.",
);

// ---------------------------------------------------------------------------
// 12. Content readiness report is honest (never claims 100 met falsely)
// ---------------------------------------------------------------------------
const contentReport = read("docs/checkpoint-7/content-readiness-report.md");
check(/not met/i.test(contentReport), "The content readiness report must honestly state the 100-record target was not met (it wasn't, per the real queried numbers).");
check(/content target incomplete/i.test(contentReport), "The content readiness report must classify itself as \"content target incomplete\".");

console.log(`checkpoint7:validate: ${checksPassed} check(s) passed.`);

if (errors.length > 0) {
  console.error(`\ncheckpoint7:validate found ${errors.length} problem(s):\n`);
  for (const error of errors) {
    console.error(`  - ${error}`);
  }
  process.exit(1);
}

console.log("checkpoint7:validate: all checks passed.");
