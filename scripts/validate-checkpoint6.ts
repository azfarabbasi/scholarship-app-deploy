import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
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
const envTs = read("src/lib/env.ts");
const middlewareTs = read("src/lib/supabase/middleware.ts");
const nextConfigTs = read("next.config.ts");
const swJs = read("public/sw.js");

// ---------------------------------------------------------------------------
// 1. Production environment validation
// ---------------------------------------------------------------------------
check(exists("instrumentation.ts"), "Missing instrumentation.ts (boot-time production config validation).");
check(read("instrumentation.ts").includes("validateProductionEnvironment"), "instrumentation.ts must call validateProductionEnvironment().");
check(envTs.includes("export function validateProductionEnvironment"), "src/lib/env.ts must export validateProductionEnvironment().");
check(envTs.includes("APP_ENV"), "src/lib/env.ts must define APP_ENV (development/test/preview/production).");
check(read(".env.example").includes("APP_ENV="), ".env.example must document APP_ENV.");

// ---------------------------------------------------------------------------
// 2. Security headers
// ---------------------------------------------------------------------------
check(nextConfigTs.includes("X-Content-Type-Options"), "next.config.ts must set X-Content-Type-Options.");
check(nextConfigTs.includes("X-Frame-Options"), "next.config.ts must set X-Frame-Options.");
check(exists("src/lib/security/csp.ts"), "Missing src/lib/security/csp.ts.");
check(middlewareTs.includes("Content-Security-Policy"), "middleware.ts must set a Content-Security-Policy header.");
check(middlewareTs.includes("Strict-Transport-Security"), "middleware.ts must set Strict-Transport-Security in production.");
check(exists("scripts/security-headers-check.ts"), "Missing scripts/security-headers-check.ts.");
check(scripts["security:headers"] === "tsx scripts/security-headers-check.ts", "package.json must define the security:headers script.");

// ---------------------------------------------------------------------------
// 3. Private no-store / noindex rules
// ---------------------------------------------------------------------------
check(middlewareTs.includes("NOINDEX_PREFIXES"), "middleware.ts must define NOINDEX_PREFIXES.");
check(middlewareTs.includes("X-Robots-Tag"), "middleware.ts must set X-Robots-Tag for noindexed routes.");
check(middlewareTs.includes('"/staff"') && middlewareTs.includes('"/account"') && middlewareTs.includes('"/auth"'), "Staff, account, and auth routes must be noindexed.");
check(middlewareTs.includes("no-store"), "middleware.ts must retain no-store handling for private routes.");

// ---------------------------------------------------------------------------
// 4. Sitemap and robots
// ---------------------------------------------------------------------------
check(exists("app/sitemap.ts"), "Missing app/sitemap.ts.");
check(exists("app/robots.ts"), "Missing app/robots.ts.");
check(read("app/sitemap.ts").includes("getPublishedOpportunities"), "sitemap.ts must only include published opportunities.");

// ---------------------------------------------------------------------------
// 5. SEO metadata + structured data
// ---------------------------------------------------------------------------
check(exists("src/lib/seo/metadata.ts"), "Missing src/lib/seo/metadata.ts (shared metadata helper).");
check(exists("src/components/common/JsonLd.tsx"), "Missing src/components/common/JsonLd.tsx.");
check(exists("scripts/seo-validate.ts"), "Missing scripts/seo-validate.ts.");
check(scripts["seo:validate"] === "tsx scripts/seo-validate.ts", "package.json must define the seo:validate script.");
check(read("app/page.tsx").includes("WebSite"), "Homepage must include WebSite structured data.");
check(read("app/faq/page.tsx").includes("FAQPage"), "The FAQ page must include FAQPage structured data.");
check(read("app/opportunities/[slug]/page.tsx").includes("EducationalOccupationalProgram"), "Opportunity detail page must include EducationalOccupationalProgram structured data.");

// ---------------------------------------------------------------------------
// 6. Analytics abstraction, disabled by default
// ---------------------------------------------------------------------------
check(exists("src/lib/analytics/index.ts"), "Missing src/lib/analytics/index.ts.");
const analyticsSource = read("src/lib/analytics/index.ts");
check(analyticsSource.includes("isAnalyticsConfigured"), "Analytics module must gate on isAnalyticsConfigured().");
check(envTs.includes("NEXT_PUBLIC_ANALYTICS_ENABLED: booleanFlag"), "NEXT_PUBLIC_ANALYTICS_ENABLED must default to false (booleanFlag, unset = false).");
check(read(".env.example").includes("NEXT_PUBLIC_ANALYTICS_ENABLED=false"), ".env.example must document analytics as disabled by default.");
const analyticsEventNameMatch = analyticsSource.match(/export type AnalyticsEventName =([\s\S]*?);/);
const analyticsEventNames = analyticsEventNameMatch ? analyticsEventNameMatch[1] : "";
check(
  !/note|checklist|transcript|passport|chat_text|search_query/i.test(analyticsEventNames),
  "Analytics event NAMES must never reference private content fields directly (notes, checklist text, chat text, raw search queries, etc.).",
);

// ---------------------------------------------------------------------------
// 7. Observability: health endpoints, error boundaries
// ---------------------------------------------------------------------------
check(exists("app/api/health/route.ts"), "Missing /api/health.");
check(exists("app/api/ready/route.ts"), "Missing /api/ready.");
check(exists("app/api/version/route.ts"), "Missing /api/version.");
check(exists("app/error.tsx"), "Missing app/error.tsx (route-level error boundary).");
check(exists("app/global-error.tsx"), "Missing app/global-error.tsx (root-layout error boundary).");
check(exists("src/lib/observability/logger.ts"), "Missing src/lib/observability/logger.ts.");
check(exists("app/staff/(protected)/ops/page.tsx"), "Missing the staff-only /staff/ops diagnostics page.");
check(read("app/staff/(protected)/ops/page.tsx").includes("canViewOpsDiagnostics"), "/staff/ops must be permission-gated.");
const versionRouteSource = read("app/api/version/route.ts");
check(!/SUPABASE_SECRET_KEY|GROQ_API_KEY|DATABASE_URL/.test(versionRouteSource), "/api/version must never reference a secret env var name.");

// ---------------------------------------------------------------------------
// 8. Ad abstraction, disabled by default, with a policy page
// ---------------------------------------------------------------------------
check(exists("src/components/ads/AdSlot.tsx"), "Missing src/components/ads/AdSlot.tsx.");
const adSlotSource = read("src/components/ads/AdSlot.tsx");
check(adSlotSource.includes("isAdsConfigured"), "AdSlot must gate on isAdsConfigured().");
check(adSlotSource.includes('aria-label="Advertisement"'), "AdSlot must carry an accessible \"Advertisement\" label.");
check(envTs.includes("NEXT_PUBLIC_ADS_ENABLED: booleanFlag"), "NEXT_PUBLIC_ADS_ENABLED must default to false.");
check(read(".env.example").includes("NEXT_PUBLIC_ADS_ENABLED=false"), ".env.example must document ads as disabled by default.");
check(exists("app/advertising-policy/page.tsx"), "Missing /advertising-policy.");
for (const excluded of ["/auth", "/account", "/staff", "/privacy", "/security", "/assistant"]) {
  check(adSlotSource.includes(`"${excluded}"`), `AdSlot's excluded-path list must include "${excluded}".`);
}

// ---------------------------------------------------------------------------
// 9. Legal / trust pages
// ---------------------------------------------------------------------------
const REQUIRED_CONTENT_PAGES = [
  "app/privacy/page.tsx",
  "app/terms/page.tsx",
  "app/disclaimer/page.tsx",
  "app/security/page.tsx",
  "app/accessibility/page.tsx",
  "app/about/page.tsx",
  "app/methodology/page.tsx",
  "app/contact/page.tsx",
  "app/faq/page.tsx",
  "app/status/page.tsx",
  "app/data-sources/page.tsx",
  "app/verification-policy/page.tsx",
];
for (const page of REQUIRED_CONTENT_PAGES) {
  check(exists(page), `Missing required legal/trust page: ${page}.`);
}

// ---------------------------------------------------------------------------
// 10. Deployment and backup/recovery documentation
// ---------------------------------------------------------------------------
check(exists("docs/checkpoint-6/production-deployment-runbook.md"), "Missing production-deployment-runbook.md.");
check(exists("docs/checkpoint-6/backup-and-recovery.md"), "Missing backup-and-recovery.md.");

// ---------------------------------------------------------------------------
// 11. CI workflow
// ---------------------------------------------------------------------------
const ciWorkflowExists = exists(".github/workflows/ci.yml") || (exists(".github/workflows") && readdirSync(path.join(root, ".github/workflows")).length > 0);
check(ciWorkflowExists, "Missing a GitHub Actions workflow under .github/workflows/ (or a documented reason for deferral).");
if (ciWorkflowExists) {
  const ciSource = read(".github/workflows/ci.yml");
  check(!/\$\{\{\s*secrets\./.test(ciSource), "CI workflow must not require repository secrets for ordinary runs.");
  check(ciSource.includes("checkpoint6:validate"), "CI workflow must run checkpoint6:validate.");
  check(ciSource.includes("security:secrets"), "CI workflow must run the secret scan.");
}

// ---------------------------------------------------------------------------
// 12. Secret scan / accessibility test / perf audit commands
// ---------------------------------------------------------------------------
check(scripts["security:secrets"] === "tsx scripts/security-secrets-scan.ts", "package.json must define the security:secrets script.");
check(exists("scripts/security-secrets-scan.ts"), "Missing scripts/security-secrets-scan.ts.");
check(typeof scripts["accessibility:test"] === "string" && scripts["accessibility:test"].includes("accessibility.spec.ts"), "package.json must define the accessibility:test script.");
check(typeof scripts["perf:audit"] === "string", "package.json must define the perf:audit script.");
check(exists("scripts/perf-audit.ts"), "Missing scripts/perf-audit.ts.");

// ---------------------------------------------------------------------------
// 13. Service worker excludes private routes (regression check)
// ---------------------------------------------------------------------------
check(swJs.includes('"/staff"') || swJs.includes("startsWith(\"/staff\")"), "sw.js must exclude /staff from interception/caching.");
check(swJs.includes('"/account"') || swJs.includes("startsWith(\"/account\")"), "sw.js must exclude /account from interception/caching.");
check(swJs.includes('"/auth"') || swJs.includes("startsWith(\"/auth\")"), "sw.js must exclude /auth from interception/caching.");

// ---------------------------------------------------------------------------
// 14. No sensitive DOCUMENT upload, no required paid service
// ---------------------------------------------------------------------------
// PROJECT_RULES.md bans uploading sensitive STUDENT DOCUMENTS (passports,
// transcripts, financial documents) — not structured-data imports. Existing,
// pre-Checkpoint-6 features already accept a previous JSON backup/export
// (guest and account data) and a staff CSV bulk import; both are safe,
// narrowly-scoped, non-document file inputs. This check verifies every
// `type="file"` input in the app is restricted to one of those safe MIME/
// extension types — never a generic/document/image/PDF accept attribute,
// which would indicate an actual new document-upload feature.
const SAFE_FILE_ACCEPT_VALUES = ["application/json", ".csv", "text/csv", ".json"];
function findFileUploadInputs(dir: string, hits: { file: string; accept: string | null }[]): void {
  for (const entry of readdirSync(dir)) {
    if (["node_modules", ".git", ".next", "coverage", "playwright-report", "test-results"].includes(entry)) continue;
    const fullPath = path.join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      findFileUploadInputs(fullPath, hits);
    } else if (entry.endsWith(".tsx") || entry.endsWith(".ts")) {
      const contents = readFileSync(fullPath, "utf8");
      if (/type=["']file["']/.test(contents)) {
        const acceptMatch = contents.match(/accept=["']([^"']+)["']/);
        hits.push({ file: path.relative(root, fullPath), accept: acceptMatch ? acceptMatch[1] : null });
      }
    }
  }
}
const fileUploadHits: { file: string; accept: string | null }[] = [];
findFileUploadInputs(path.join(root, "app"), fileUploadHits);
findFileUploadInputs(path.join(root, "src"), fileUploadHits);

for (const hit of fileUploadHits) {
  const isSafe = Boolean(hit.accept) && SAFE_FILE_ACCEPT_VALUES.some((safe) => hit.accept!.includes(safe));
  check(isSafe, `${hit.file} has a file input with accept="${hit.accept ?? "(none)"}" — only JSON/CSV structured-data imports are permitted, never a document/image upload.`);
}
check(!read("package.json").match(/"dependencies"[\s\S]*?"@sentry\/|"dependencies"[\s\S]*?"posthog-js/), "No paid/required analytics or error-reporting SDK dependency should be required — Sentry/analytics stay optional and DSN/token-gated.");

// ---------------------------------------------------------------------------
// 15. Required tests exist
// ---------------------------------------------------------------------------
const REQUIRED_TEST_FILES = [
  "tests/unit/security-headers.test.ts",
  "tests/unit/cookie-rate-limit.test.ts",
  "tests/unit/env-checkpoint6.test.ts",
  "tests/e2e/production-readiness.spec.ts",
  "tests/e2e/accessibility.spec.ts",
];
for (const file of REQUIRED_TEST_FILES) {
  check(exists(file), `Missing required test file: ${file}.`);
}

// ---------------------------------------------------------------------------
// 16. Required documentation exists
// ---------------------------------------------------------------------------
const REQUIRED_DOCS = [
  "docs/checkpoint-6/checkpoint-6-architecture.md",
  "docs/checkpoint-6/production-deployment-runbook.md",
  "docs/checkpoint-6/security-hardening.md",
  "docs/checkpoint-6/seo-and-content-strategy.md",
  "docs/checkpoint-6/analytics-and-ads-policy.md",
  "docs/checkpoint-6/backup-and-recovery.md",
  "docs/checkpoint-6/checkpoint-6-manual-qa.md",
  "docs/checkpoint-6/checkpoint-6-traceability.md",
  "docs/checkpoint-6/checkpoint-6-completion-report.md",
];
for (const doc of REQUIRED_DOCS) {
  check(exists(doc), `Missing required documentation: ${doc}.`);
}

console.log(`checkpoint6:validate: ${checksPassed} check(s) passed.`);

if (errors.length > 0) {
  console.error(`\ncheckpoint6:validate found ${errors.length} problem(s):\n`);
  for (const error of errors) {
    console.error(`  - ${error}`);
  }
  process.exit(1);
}

console.log("checkpoint6:validate: all checks passed.");
