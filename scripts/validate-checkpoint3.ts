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

/**
 * A page "reviewed for Checkpoint N" stays valid once a later checkpoint
 * reviews it again — e.g. the privacy page says "Last reviewed for
 * Checkpoint 5" today, having been revisited since Checkpoint 3. Matching
 * the exact literal "Checkpoint 3" would make this check fail forever after
 * the very next legitimate review, which is exactly the kind of
 * validator staleness this phase is fixing (see Phase 4 item 8).
 */
function reviewedForCheckpointAtLeast(source: string, minVersion: number): boolean {
  const versions = [...source.matchAll(/Checkpoint (\d+)/gi)].map((m) => Number(m[1]));
  return versions.some((version) => version >= minVersion);
}

function listFilesRecursive(relativeDir: string): string[] {
  const absoluteDir = path.join(root, relativeDir);
  if (!existsSync(absoluteDir)) return [];
  const out: string[] = [];
  for (const entry of readdirSync(absoluteDir, { withFileTypes: true })) {
    const rel = path.join(relativeDir, entry.name);
    if (entry.isDirectory()) {
      out.push(...listFilesRecursive(rel));
    } else if (/\.(ts|tsx|js)$/.test(entry.name)) {
      out.push(rel);
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// 1. Student auth routes exist
// ---------------------------------------------------------------------------

const REQUIRED_AUTH_FILES = [
  "app/auth/login/page.tsx",
  "app/auth/signup/page.tsx",
  "app/auth/callback/route.ts",
  "app/auth/logout/route.ts",
  "src/components/auth/StudentLoginForm.tsx",
  "src/components/auth/StudentSignupForm.tsx",
  "src/lib/auth/student-session.ts",
];
for (const file of REQUIRED_AUTH_FILES) {
  check(exists(file), `Missing required student-auth file: ${file}`);
}

check(read("src/lib/auth/student-session.ts").includes("getClaims"), "Student session verification must use getClaims() (or an equivalent secure JWT check), not raw client-supplied state.");

const middlewareSource = read("src/lib/supabase/middleware.ts");
check(middlewareSource.includes("/account") && middlewareSource.includes("sanitizeRedirectPath"), "Middleware must gate /account and sanitize the redirect target (no open redirect).");
check(
  read("src/components/auth/StudentLoginForm.tsx").includes("sanitizeRedirectPath") &&
    read("src/components/auth/StudentLoginForm.tsx").includes('"/staff"'),
  "The student login form's redirect sanitizer must reject a /staff destination.",
);

// ---------------------------------------------------------------------------
// 2. /account/** routes exist
// ---------------------------------------------------------------------------

const REQUIRED_ACCOUNT_FILES = [
  "app/account/layout.tsx",
  "app/account/page.tsx",
  "app/account/sync/page.tsx",
  "app/account/data/page.tsx",
  "app/account/delete/page.tsx",
  "app/account/security/page.tsx",
];
for (const file of REQUIRED_ACCOUNT_FILES) {
  check(exists(file), `Missing required account page: ${file}`);
}
check(read("app/account/layout.tsx").includes("getStudentSession"), "The /account layout must gate on a real student session, not client-side state.");

// ---------------------------------------------------------------------------
// 3. Cloud workspace tables exist in the Drizzle schema + migrations + RLS
// ---------------------------------------------------------------------------

check(exists("src/lib/db/schema/student.ts"), "Missing src/lib/db/schema/student.ts.");
const studentSchemaSource = read("src/lib/db/schema/student.ts");

const REQUIRED_TABLES = [
  "student_profiles",
  "user_opportunity_tracking",
  "user_custom_opportunities",
  "user_notes",
  "user_checklist_tasks",
  "user_planning_preferences",
  "user_display_preferences",
  "user_sync_state",
  "user_data_requests",
];
for (const table of REQUIRED_TABLES) {
  check(studentSchemaSource.includes(`"${table}"`), `Missing required student-workspace table definition: ${table}`);
  check(new RegExp(`${table}[\\s\\S]{0,400}\\.enableRLS\\(\\)`).test(studentSchemaSource), `Table ${table} must call .enableRLS().`);
}

check(read("src/lib/db/schema/common.ts").includes("ownerAllPolicy"), "Missing the owner-scoped RLS policy helper (ownerAllPolicy) in common.ts.");
check(!/staffSelectPolicy/.test(studentSchemaSource), "Student workspace tables must not grant staff a broad select policy (see privacy-and-data-controls.md).");

const migrationFiles = exists("drizzle") ? readdirSync(path.join(root, "drizzle")).filter((f) => f.endsWith(".sql")) : [];
check(migrationFiles.length >= 5, "Expected at least 5 migration files under drizzle/ (Checkpoint 2's three plus the Checkpoint 3 student-workspace schema and grants).");

const allMigrationSql = migrationFiles.map((f) => read(path.join("drizzle", f))).join("\n");
check(/create table "student_profiles"/i.test(allMigrationSql), "No migration creates the student_profiles table.");
check(/create table "user_opportunity_tracking"/i.test(allMigrationSql), "No migration creates the user_opportunity_tracking table.");
check(/_owner_all/.test(allMigrationSql), "No migration creates an owner-scoped RLS policy for a student-workspace table.");
check(/revoke select on[\s\S]*student_profiles/i.test(allMigrationSql), "No migration revokes anon's default SELECT grant on student-owned tables.");

// ---------------------------------------------------------------------------
// 4. Guest mode still exists, unmodified in behaviour
// ---------------------------------------------------------------------------

const REQUIRED_GUEST_FILES = [
  "src/lib/storage/workspace.ts",
  "src/lib/storage/custom-opportunities.ts",
  "src/lib/storage/preferences.ts",
  "src/lib/storage/backup.ts",
  "src/hooks/useWorkspace.ts",
  "src/components/workspace/WorkspaceView.tsx",
];
for (const file of REQUIRED_GUEST_FILES) {
  check(exists(file), `Missing required guest-mode file (must be preserved): ${file}`);
}
check(read("app/workspace/page.tsx").includes("WorkspaceView"), "The workspace page must still render the guest WorkspaceView for signed-out visitors.");
check(!/login required|must sign in|account required/i.test(read("app/workspace/page.tsx")), "The workspace page must never require login for basic tracking.");

// ---------------------------------------------------------------------------
// 5. Local-to-cloud migration module + sync layer exist
// ---------------------------------------------------------------------------

check(exists("src/lib/db/actions/student/sync.ts"), "Missing the guest-to-cloud migration server actions module.");
const migrationActionSource = read("src/lib/db/actions/student/sync.ts");
check(migrationActionSource.includes("applyGuestMigration"), "Missing applyGuestMigration.");
check(migrationActionSource.includes("getMigrationContext"), "Missing getMigrationContext (migration preview support).");
check(/"copy"/.test(migrationActionSource) && /"merge"/.test(migrationActionSource) && /"replace"/.test(migrationActionSource), "Migration must support copy, merge, and replace modes.");
check(exists("src/components/account/MigrationPanel.tsx"), "Missing the migration preview/apply UI.");
check(read("src/components/account/MigrationPanel.tsx").includes("never deleted"), "The migration UI must state that local guest data is never deleted by migration.");

const REQUIRED_SYNC_FILES = [
  "src/lib/sync/status.ts",
  "src/lib/sync/outbox.ts",
  "src/lib/sync/cloud-cache.ts",
  "src/hooks/useCloudWorkspace.ts",
  "src/hooks/useSyncStatus.ts",
];
for (const file of REQUIRED_SYNC_FILES) {
  check(exists(file), `Missing required sync-layer file: ${file}`);
}
check(read("src/lib/storage/db.ts").includes("syncOutbox") && read("src/lib/storage/db.ts").includes("cloudCache"), "IndexedDB schema must define syncOutbox and cloudCache stores for the offline queue and cloud cache.");

// ---------------------------------------------------------------------------
// 6. Account export/import + deletion controls exist
// ---------------------------------------------------------------------------

check(exists("src/lib/db/actions/student/data-controls.ts"), "Missing the account export/import/deletion server actions module.");
const dataControlsSource = read("src/lib/db/actions/student/data-controls.ts");
for (const fn of ["exportMyData", "importMyAccountData", "deleteMyWorkspaceData", "deleteMyAccount"]) {
  check(dataControlsSource.includes(fn), `Missing required data-control action: ${fn}`);
}
check(exists("src/lib/schemas/cloud-export.ts"), "Missing the cloud-export schema/validator module.");
const cloudExportSchemaSource = read("src/lib/schemas/cloud-export.ts");
check(cloudExportSchemaSource.includes("containsDangerousKeys"), "Cloud import must reject prototype-pollution keys.");
check(cloudExportSchemaSource.includes("MAX_CLOUD_IMPORT_FILE_SIZE_BYTES"), "Cloud import must enforce a maximum file size.");
check(dataControlsSource.includes("auth.admin.deleteUser") || dataControlsSource.includes("createSupabaseAdminClient"), "Full account deletion must use the server-side Admin API, never a client-exposed service-role key.");
check(!/SUPABASE_SECRET_KEY/.test(read("src/components/account/DeleteAccountSection.tsx")), "The secret key must never appear in client-side account-deletion UI code.");

// ---------------------------------------------------------------------------
// 7. Privacy page updated
// ---------------------------------------------------------------------------

const privacySource = read("app/privacy/page.tsx");
check(reviewedForCheckpointAtLeast(privacySource, 3), "Privacy page must be marked as reviewed for Checkpoint 3 (or a later checkpoint's review, which supersedes it).");
check(/account data is stored/i.test(privacySource), "Privacy page must explain where account data is stored.");
check(/staff cannot casually browse/i.test(privacySource), "Privacy page must state that staff cannot casually browse student private data.");
check(
  /AI is not used/i.test(privacySource) || (/AI assistant/i.test(privacySource) && /never a final eligibility/i.test(privacySource)),
  "Privacy page must state that AI is not used — or, if an AI assistant was added in a later checkpoint (Checkpoint 5), disclose it with its safety guarantees (never a final eligibility/admission/funding decision).",
);

// ---------------------------------------------------------------------------
// 8. Staff routes remain separate from student accounts
// ---------------------------------------------------------------------------

check(exists("app/staff/(protected)/layout.tsx") && read("app/staff/(protected)/layout.tsx").includes("getStaffSession"), "Staff routes must still gate on getStaffSession(), independent of student sessions.");
check(!/getStudentSession/.test(read("app/staff/(protected)/layout.tsx")), "Staff layout must never resolve or depend on a student session.");
check(!/getStaffSession/.test(read("app/account/layout.tsx")), "Account layout must never resolve or depend on a staff session.");

// ---------------------------------------------------------------------------
// 9. No sensitive-file upload added; no AI added
// ---------------------------------------------------------------------------

const allSourceFiles = listFilesRecursive("src").concat(listFilesRecursive("app"));
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
  `No sensitive-file upload UI is permitted. Found suspicious pattern in: ${fileUploadOffenders.join(", ")}`,
);

const aiLibraryPattern = /openai|anthropic|@ai-sdk|langchain/i;
const packageJsonSource = read("package.json");
check(!aiLibraryPattern.test(packageJsonSource), "No AI SDK/library dependency may be added in Checkpoint 3.");
check(!/recommendationScore|eligibilityScore|aiSuggested/i.test(studentSchemaSource), "No AI-derived recommendation/eligibility-scoring field may be added to the student schema.");

check(!/date_of_birth|passport_number|financial_document|bank_account/i.test(studentSchemaSource), "Student schema must never collect date of birth, passport numbers, or financial/bank details.");

// ---------------------------------------------------------------------------
// 10. Service worker does not unsafely cache private staff/student responses
// ---------------------------------------------------------------------------

const serviceWorkerSource = read("public/sw.js");
check(serviceWorkerSource.includes('"/account"') || serviceWorkerSource.includes('startsWith("/account")'), "public/sw.js must explicitly bypass /account routes from all caching.");
check(serviceWorkerSource.includes("/api/account"), "public/sw.js must explicitly bypass /api/account routes from all caching.");
check(serviceWorkerSource.includes('"/staff"') || serviceWorkerSource.includes('startsWith("/staff")'), "public/sw.js must still bypass /staff routes from all caching.");
check(serviceWorkerSource.includes("/api/staff"), "public/sw.js must still bypass /api/staff routes from all caching.");
check(serviceWorkerSource.includes("Cache-Control"), "public/sw.js must respect a no-store/private Cache-Control on session-aware navigations, not cache every response unconditionally.");
check(middlewareSource.includes("no-store"), "Middleware must mark session-aware public pages (e.g. /workspace, /privacy) no-store when a user is signed in, so the service worker never caches one person's data for another.");

// ---------------------------------------------------------------------------
// 11. Required tests exist
// ---------------------------------------------------------------------------

const REQUIRED_TEST_FILES = [
  "tests/unit/student-workspace-schemas.test.ts",
  "tests/unit/cloud-export-schema.test.ts",
  "tests/unit/sync-outbox.test.ts",
  "tests/integration/student-workspace-rls.test.ts",
  "tests/e2e/student-auth-and-sync.spec.ts",
];
for (const file of REQUIRED_TEST_FILES) {
  check(exists(file), `Missing required test file: ${file}`);
}
check(read("tests/integration/student-workspace-rls.test.ts").includes("cannot read another student"), "RLS integration tests must prove cross-user access is denied.");
check(read("tests/e2e/student-auth-and-sync.spec.ts").includes("cannot access /staff"), "E2E tests must prove a signed-in student cannot access /staff.");

// ---------------------------------------------------------------------------
// 12. Required documentation
// ---------------------------------------------------------------------------

const REQUIRED_DOCS = [
  "docs/checkpoint-3/checkpoint-3-architecture.md",
  "docs/checkpoint-3/student-auth-and-sync.md",
  "docs/checkpoint-3/privacy-and-data-controls.md",
  "docs/checkpoint-3/checkpoint-3-manual-qa.md",
  "docs/checkpoint-3/checkpoint-3-traceability.md",
  "docs/checkpoint-3/checkpoint-3-completion-report.md",
];
for (const file of REQUIRED_DOCS) {
  check(exists(file) && read(file).trim().length > 200, `Missing or too-short required documentation file: ${file}`);
}

// ---------------------------------------------------------------------------
// 13. package.json commands
// ---------------------------------------------------------------------------

const packageJson = JSON.parse(read("package.json")) as { scripts?: Record<string, string> };
check(Boolean(packageJson.scripts?.["checkpoint3:validate"]), "Missing required package.json script: checkpoint3:validate");
for (const script of ["checkpoint0:validate", "checkpoint1:validate", "checkpoint2:validate", "data:validate", "deadlines:audit", "db:test", "db:verify:migration", "typecheck", "test", "test:coverage", "test:e2e", "lint", "build"]) {
  check(Boolean(packageJson.scripts?.[script]), `Checkpoint 3 must preserve the existing package.json script: ${script}`);
}

// ---------------------------------------------------------------------------
// 14. Preserved Checkpoint 2 guarantees (spot checks, not a full re-run)
// ---------------------------------------------------------------------------

check(exists("app/staff/login/page.tsx"), "Staff login route must still exist.");
check(exists("src/lib/catalogue/db-repository.ts"), "The database-backed public catalogue repository must still exist.");
check(exists("scripts/validate-checkpoint2.ts"), "The Checkpoint 2 validator must still exist and be runnable.");

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

console.log(`Checkpoint 3 validation: ${checksPassed} check(s) passed, ${errors.length} failed.`);
if (errors.length > 0) {
  console.error("\nFailures:");
  for (const error of errors) {
    console.error(`  - ${error}`);
  }
  process.exit(1);
}
