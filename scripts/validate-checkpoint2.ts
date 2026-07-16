import { existsSync, readFileSync, readdirSync } from "node:fs";
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

function listFilesRecursive(relativeDir: string): string[] {
  const absoluteDir = path.join(root, relativeDir);
  if (!existsSync(absoluteDir)) return [];
  const out: string[] = [];
  for (const entry of readdirSync(absoluteDir, { withFileTypes: true })) {
    const rel = path.join(relativeDir, entry.name);
    if (entry.isDirectory()) {
      out.push(...listFilesRecursive(rel));
    } else if (/\.(ts|tsx)$/.test(entry.name)) {
      out.push(rel);
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// 1. Drizzle schema is the version-controlled source of truth
// ---------------------------------------------------------------------------

const REQUIRED_SCHEMA_FILES = [
  "src/lib/db/schema/index.ts",
  "src/lib/db/schema/enums.ts",
  "src/lib/db/schema/roles.ts",
  "src/lib/db/schema/staff.ts",
  "src/lib/db/schema/taxonomies.ts",
  "src/lib/db/schema/organisations.ts",
  "src/lib/db/schema/opportunities.ts",
  "src/lib/db/schema/funding.ts",
  "src/lib/db/schema/deadlines.ts",
  "src/lib/db/schema/sources.ts",
  "src/lib/db/schema/documents.ts",
  "src/lib/db/schema/eligibility.ts",
  "src/lib/db/schema/workflow.ts",
  "src/lib/db/schema/corrections.ts",
  "src/lib/db/schema/duplicates.ts",
  "src/lib/db/schema/imports.ts",
  "src/lib/db/schema/audit.ts",
];
for (const file of REQUIRED_SCHEMA_FILES) {
  check(exists(file), `Missing required Drizzle schema module: ${file}`);
}

const schemaSource = REQUIRED_SCHEMA_FILES.map((f) => read(f)).join("\n");

const REQUIRED_TABLES = [
  'pgTable(\n  "staff_profiles"',
  'pgTable(\n  "staff_role_assignments"',
  'pgTable(\n  "organisations"',
  'pgTable(\n  "providers"',
  'pgTable(\n  "opportunities"',
  'pgTable(\n  "opportunity_versions"',
  'pgTable(\n  "opportunity_slug_redirects"',
  'pgTable(\n  "deadline_cycles"',
  'pgTable(\n  "deadline_occurrences"',
  'pgTable(\n  "deadline_occurrence_history"',
  'pgTable(\n  "official_sources"',
  'pgTable(\n  "verification_records"',
  'pgTable(\n  "source_evidence"',
  'pgTable(\n  "required_document_templates"',
  'pgTable(\n  "opportunity_document_requirements"',
  'pgTable(\n  "eligibility_rule_groups"',
  'pgTable(\n  "eligibility_rules"',
  'pgTable(\n  "review_assignments"',
  'pgTable(\n  "correction_reports"',
  'pgTable(\n  "duplicate_candidates"',
  'pgTable(\n  "import_jobs"',
  'pgTable(\n  "audit_log"',
];
for (const tableSignature of REQUIRED_TABLES) {
  const tableName = tableSignature.match(/"([a-z_]+)"/)?.[1] ?? tableSignature;
  check(schemaSource.includes(tableSignature), `Missing required table definition: ${tableName}`);
}

// ---------------------------------------------------------------------------
// 2. Generated + hand-authored SQL migrations exist and encode RLS/triggers
// ---------------------------------------------------------------------------

const migrationFiles = exists("drizzle") ? readdirSync(path.join(root, "drizzle")).filter((f) => f.endsWith(".sql")) : [];
check(migrationFiles.length >= 3, "Expected at least 3 migration files under drizzle/ (auth helpers, init schema, publication invariants).");

const allMigrationSql = migrationFiles.map((f) => read(path.join("drizzle", f))).join("\n");
check(/enable row level security/i.test(allMigrationSql), "No migration enables row level security.");
check(/create policy/i.test(allMigrationSql), "No migration creates an RLS policy.");
check(/create trigger/i.test(allMigrationSql), "No migration creates a database trigger.");
check(
  /cannot be published without at least one official source/i.test(allMigrationSql),
  "The official-source publication trigger is missing.",
);
check(/is append-only/i.test(allMigrationSql), "The audit_log append-only trigger is missing.");
check(exists("scripts/db/local-auth-shim.sql"), "Missing scripts/db/local-auth-shim.sql (local RLS test shim).");

// ---------------------------------------------------------------------------
// 3. Staff authentication routes + server-side role enforcement
// ---------------------------------------------------------------------------

const REQUIRED_STAFF_AUTH_FILES = [
  "app/staff/login/page.tsx",
  "app/staff/auth/callback/route.ts",
  "app/staff/logout/route.ts",
  "app/staff/unauthorized/page.tsx",
  "app/staff/(protected)/layout.tsx",
  "src/lib/supabase/client.ts",
  "src/lib/supabase/server.ts",
  "src/lib/supabase/middleware.ts",
  "src/lib/auth/session.ts",
  "src/lib/auth/permissions.ts",
  "middleware.ts",
  "scripts/bootstrap-admin.ts",
];
for (const file of REQUIRED_STAFF_AUTH_FILES) {
  check(exists(file), `Missing required staff-auth file: ${file}`);
}

check(read("src/lib/auth/session.ts").includes("getClaims"), "Staff session verification must use getClaims() (or an equivalent secure JWT check), not raw client-supplied state.");
check(
  read("src/lib/supabase/middleware.ts").includes("/staff") && read("src/lib/supabase/middleware.ts").includes("sanitizeNextPath"),
  "Staff route middleware must gate /staff and sanitize the redirect target (no open redirect).",
);
check(
  /canCreateDraft|canApprove|canPublish/.test(read("src/lib/db/actions/opportunities.ts")),
  "Opportunity server actions must call the permission-matrix functions before mutating.",
);
check(
  read("scripts/bootstrap-admin.ts").includes("--confirm") && read("scripts/bootstrap-admin.ts").includes("--force"),
  "The bootstrap script must require explicit confirmation and refuse to silently create a second administrator.",
);

// ---------------------------------------------------------------------------
// 4. Public database repository replaces the JSON seed as the runtime source
// ---------------------------------------------------------------------------

check(exists("src/lib/catalogue/db-repository.ts"), "Missing src/lib/catalogue/db-repository.ts.");
check(exists("src/lib/catalogue/legacy-seed-repository.ts"), "Missing src/lib/catalogue/legacy-seed-repository.ts (migration/test fixture only).");
check(read("src/lib/catalogue/db-repository.ts").includes('status = \'published\'') || read("src/lib/catalogue/db-repository.ts").includes('"published"'), "The database repository must filter to published records only.");

const runtimeDirs = ["app", "src/components", "src/hooks"];
const forbiddenImportPattern = /catalogue\/legacy-seed-repository|scholarships\.seed\.json/;
const offendingFiles: string[] = [];
for (const dir of runtimeDirs) {
  for (const file of listFilesRecursive(dir)) {
    if (forbiddenImportPattern.test(read(file))) {
      offendingFiles.push(file);
    }
  }
}
check(
  offendingFiles.length === 0,
  `Public runtime code must never import the seed JSON or legacy-seed-repository directly. Offending file(s): ${offendingFiles.join(", ")}`,
);

check(exists("app/api/opportunities/route.ts"), "Missing the public /api/opportunities route.");
check(read("app/api/opportunities/route.ts").includes("force-dynamic"), "/api/opportunities must be dynamic, never statically cached at build time.");
check(exists("src/hooks/useBuiltInOpportunities.ts"), "Missing the client hook that fetches/caches the database-backed catalogue.");
check(
  read("src/hooks/useBuiltInOpportunities.ts").includes("isServiceUnavailable") && read("src/hooks/useBuiltInOpportunities.ts").includes("isStale"),
  "The catalogue hook must distinguish a truthful offline-unavailable state from a stale cached snapshot.",
);

// ---------------------------------------------------------------------------
// 5. Review/publication workflow, version + deadline history
// ---------------------------------------------------------------------------

check(exists("src/lib/workflow/opportunity-workflow.ts"), "Missing the opportunity workflow state machine.");
check(exists("src/lib/db/actions/opportunities.ts"), "Missing opportunity workflow server actions.");
const workflowActions = read("src/lib/db/actions/opportunities.ts");
for (const requiredAction of ["submitForReview", "approveOpportunity", "publishOpportunity", "archiveOpportunity", "restoreOpportunity", "rejectOpportunity"]) {
  check(workflowActions.includes(requiredAction), `Missing workflow action: ${requiredAction}`);
}
check(exists("app/staff/(protected)/opportunities/[id]/history/page.tsx"), "Missing the opportunity version-history staff page.");
check(exists("app/staff/(protected)/reviews/page.tsx"), "Missing the staff reviews queue page.");
check(exists("app/staff/(protected)/assignments/page.tsx"), "Missing the staff review-assignment page.");

// ---------------------------------------------------------------------------
// 6. Required documents, eligibility rules, corrections, duplicates, imports, audit, team
// ---------------------------------------------------------------------------

const REQUIRED_STAFF_PAGES = [
  "app/staff/(protected)/page.tsx",
  "app/staff/(protected)/opportunities/page.tsx",
  "app/staff/(protected)/opportunities/new/page.tsx",
  "app/staff/(protected)/opportunities/[id]/page.tsx",
  "app/staff/(protected)/opportunities/[id]/edit/page.tsx",
  "app/staff/(protected)/organisations/page.tsx",
  "app/staff/(protected)/taxonomies/page.tsx",
  "app/staff/(protected)/documents/page.tsx",
  "app/staff/(protected)/eligibility-rules/page.tsx",
  "app/staff/(protected)/corrections/page.tsx",
  "app/staff/(protected)/duplicates/page.tsx",
  "app/staff/(protected)/imports/page.tsx",
  "app/staff/(protected)/audit/page.tsx",
  "app/staff/(protected)/team/page.tsx",
];
for (const file of REQUIRED_STAFF_PAGES) {
  check(exists(file), `Missing required staff admin page: ${file}`);
}

check(exists("app/api/correction-reports/route.ts"), "Missing the public correction-report submission route.");
check(read("app/api/correction-reports/route.ts").includes("honeypot"), "Correction-report submission must check the honeypot field.");
check(exists("src/lib/duplicates/detect.ts"), "Missing duplicate-detection logic.");
check(exists("src/lib/db/actions/duplicates.ts") && read("src/lib/db/actions/duplicates.ts").includes("mergeDuplicates"), "Missing the duplicate-merge action.");

check(exists("src/lib/csv/parse.ts") && exists("src/lib/csv/export.ts") && exists("src/lib/csv/opportunity-import.ts"), "Missing CSV import/export utilities.");
check(read("src/lib/csv/export.ts").includes("escapeCsvFormulaInjection"), "CSV export must escape formula-injection payloads.");
check(exists("app/api/staff/csv-template/route.ts"), "Missing the downloadable CSV import template route.");
check(exists("app/api/staff/export/opportunities/route.ts"), "Missing the published-opportunity CSV export route.");

check(exists("src/lib/audit/log.ts"), "Missing the audit-logging helper.");

// ---------------------------------------------------------------------------
// 7. Original 55-record migration tool
// ---------------------------------------------------------------------------

check(exists("scripts/import-legacy-scholarships.ts"), "Missing the legacy migration import script.");
const importerSource = read("scripts/import-legacy-scholarships.ts");
check(importerSource.includes("--dry-run"), "Legacy importer must support --dry-run.");
check(importerSource.includes("--rollback"), "Legacy importer must support --rollback.");
check(importerSource.includes('status: "draft"'), "Legacy importer must land records as drafts, never auto-published.");
check(importerSource.includes("legacyMigrationReference") || importerSource.includes("legacy_migration_reference"), "Legacy importer must record a stable legacy reference for idempotency.");
check(exists("scripts/verify-migration.ts"), "Missing scripts/verify-migration.ts.");

// ---------------------------------------------------------------------------
// 8. Environment validation and secret hygiene
// ---------------------------------------------------------------------------

check(exists("src/lib/env.ts"), "Missing src/lib/env.ts (environment validation module).");
const envModule = read("src/lib/env.ts");
check(envModule.includes("getPublicEnv") && envModule.includes("getServerEnv"), "src/lib/env.ts must separate public and server-only environment access.");
check(!/NEXT_PUBLIC_SUPABASE_SECRET|NEXT_PUBLIC_DATABASE_URL/.test(envModule), "A secret must never be read through a NEXT_PUBLIC_* variable name.");

const envExample = read(".env.example");
check(envExample.includes("NEXT_PUBLIC_SUPABASE_URL"), ".env.example must document NEXT_PUBLIC_SUPABASE_URL.");
check(envExample.includes("SUPABASE_SECRET_KEY") && !envExample.includes("NEXT_PUBLIC_SUPABASE_SECRET_KEY"), ".env.example must document SUPABASE_SECRET_KEY as server-only (never NEXT_PUBLIC-prefixed).");
check(envExample.includes("DATABASE_URL"), ".env.example must document DATABASE_URL.");
check(envExample.includes("BOOTSTRAP_ADMIN_EMAIL"), ".env.example must document BOOTSTRAP_ADMIN_EMAIL.");

for (const file of listFilesRecursive("src").concat(listFilesRecursive("app"))) {
  const content = read(file);
  check(
    !/NEXT_PUBLIC_[A-Z_]*SECRET|NEXT_PUBLIC_[A-Z_]*DATABASE_URL/.test(content),
    `Possible secret exposed through a NEXT_PUBLIC_* name in ${file}.`,
  );
}

// ---------------------------------------------------------------------------
// 9. PWA excludes staff/private routes from caching
// ---------------------------------------------------------------------------

const serviceWorkerSource = read("public/sw.js");
check(
  serviceWorkerSource.includes('"/staff"') || serviceWorkerSource.includes("startsWith(\"/staff\")"),
  "public/sw.js must explicitly bypass /staff routes from all caching.",
);
check(
  serviceWorkerSource.includes("/api/staff"),
  "public/sw.js must explicitly bypass /api/staff routes from all caching.",
);

// ---------------------------------------------------------------------------
// 10. No sensitive-file upload; no accidental student-account feature
// ---------------------------------------------------------------------------

const allSourceFiles = listFilesRecursive("src").concat(listFilesRecursive("app"));
// A bare `type="file"` input is not inherently a sensitive-document upload —
// the guest JSON backup restore and the staff CSV importer both use one for
// structured data, which this checkpoint explicitly requires. What must
// never exist is a file input that accepts document/image formats (the
// shape a passport/transcript/certificate upload would take), or a
// server-side upload-handling library.
const structuredDataAcceptPattern = /accept=["'][^"']*(?:\.csv|text\/csv|application\/json)[^"']*["']/i;
const fileInputPattern = /type=["']file["']/i;
const serverUploadLibraryPattern = /\bmulter\b|\bformidable\b|\bbusboy\b/i;
const fileUploadOffenders = allSourceFiles.filter((f) => {
  const content = read(f);
  if (serverUploadLibraryPattern.test(content)) return true;
  return fileInputPattern.test(content) && !structuredDataAcceptPattern.test(content);
});
check(
  fileUploadOffenders.length === 0,
  `No sensitive-file upload UI is permitted (only structured .csv/.json data uploads are allowed). Found suspicious pattern in: ${fileUploadOffenders.join(", ")}`,
);

check(!/pgTable\(\s*"user_accounts"|pgTable\(\s*"user_profiles"/.test(schemaSource), "Checkpoint 2 must not introduce student account/profile tables yet.");
check(!/ENABLE_STUDENT|student_role/i.test(read("src/lib/auth/permissions.ts")), "Checkpoint 2's staff permission matrix must not include a Student role.");

// ---------------------------------------------------------------------------
// 11. Required documentation
// ---------------------------------------------------------------------------

const REQUIRED_DOCS = [
  "docs/checkpoint-2/checkpoint-2-architecture.md",
  "docs/checkpoint-2/database-schema.md",
  "docs/checkpoint-2/staff-roles-and-workflows.md",
  "docs/checkpoint-2/supabase-setup.md",
  "docs/checkpoint-2/migration-runbook.md",
  "docs/checkpoint-2/data-verification-procedure.md",
  "docs/checkpoint-2/checkpoint-2-manual-qa.md",
  "docs/checkpoint-2/checkpoint-2-traceability.md",
  "docs/checkpoint-2/checkpoint-2-completion-report.md",
];
for (const file of REQUIRED_DOCS) {
  check(exists(file) && read(file).trim().length > 200, `Missing or too-short required documentation file: ${file}`);
}

// ---------------------------------------------------------------------------
// 12. package.json commands
// ---------------------------------------------------------------------------

const packageJson = JSON.parse(read("package.json")) as { scripts?: Record<string, string> };
const REQUIRED_SCRIPTS = [
  "checkpoint2:validate",
  "db:generate",
  "db:migrate",
  "db:check",
  "db:seed",
  "db:reset:test",
  "db:test",
  "db:import:legacy:dry-run",
  "db:import:legacy",
  "db:import:legacy:rollback",
  "db:verify:migration",
];
for (const script of REQUIRED_SCRIPTS) {
  check(Boolean(packageJson.scripts?.[script]), `Missing required package.json script: ${script}`);
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

console.log(`Checkpoint 2 validation: ${checksPassed} check(s) passed, ${errors.length} failed.`);
if (errors.length > 0) {
  console.error("\nFailures:");
  for (const error of errors) {
    console.error(`  - ${error}`);
  }
  process.exit(1);
}
