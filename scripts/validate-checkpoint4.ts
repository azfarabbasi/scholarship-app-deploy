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
    } else if (/\.(ts|tsx|js)$/.test(entry.name)) {
      out.push(rel);
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// 1. Search: schema, ranking, service, and the /api/search route exist
// ---------------------------------------------------------------------------

const REQUIRED_SEARCH_FILES = [
  "src/lib/search/types.ts",
  "src/lib/search/query.ts",
  "src/lib/search/rank.ts",
  "src/lib/search/service.ts",
  "app/api/search/route.ts",
];
for (const file of REQUIRED_SEARCH_FILES) {
  check(exists(file), `Missing required search file: ${file}`);
}
const searchServiceSource = read("src/lib/search/service.ts");
check(searchServiceSource.includes("getPublishedOpportunities"), "Server-side search must read from the published-only catalogue repository, never a broader draft/archived query.");
check(searchServiceSource.includes("isTrgmAvailable") || searchServiceSource.includes("trgm"), "Search service must check pg_trgm availability rather than assuming it's installed.");

const migrationDir = "drizzle";
const migrationFiles = exists(migrationDir) ? readdirSync(path.join(root, migrationDir)).filter((f) => f.endsWith(".sql")) : [];
const allMigrationSql = migrationFiles.map((f) => read(path.join(migrationDir, f))).join("\n");
check(/pg_trgm/i.test(allMigrationSql), "No migration creates the pg_trgm extension for typo-tolerant search.");
check(/exception/i.test(allMigrationSql) && /pg_trgm/i.test(allMigrationSql), "The pg_trgm extension creation must be exception-guarded for hosting environments that disallow CREATE EXTENSION.");

// ---------------------------------------------------------------------------
// 2. Matching engine: pure, deterministic, cautious labels, never AI
// ---------------------------------------------------------------------------

check(exists("src/lib/matching/engine.ts") && exists("src/lib/matching/types.ts"), "Missing the matching engine module.");
const matchTypesSource = read("src/lib/matching/types.ts");
const REQUIRED_MATCH_LABELS = [
  "strong-potential-fit",
  "possible-fit",
  "needs-verification",
  "missing-information",
  "likely-not-a-fit",
  "deadline-risk",
  "not-enough-rule-data",
];
for (const label of REQUIRED_MATCH_LABELS) {
  check(matchTypesSource.includes(label), `Missing required match label: ${label}`);
}
check(/never a (final|guarantee)/i.test(matchTypesSource), "The match disclaimer must explicitly say it is never a final eligibility/admission/funding decision.");

const matchEngineSource = read("src/lib/matching/engine.ts");
check(/pure|deterministic/i.test(matchEngineSource), "The matching engine's own documentation must describe it as pure/deterministic.");
check(!/openai|anthropic|@ai-sdk|langchain|fetch\(/i.test(matchEngineSource), "The matching engine must never call an AI service or make a network request — it must be pure and offline-computable.");
check(
  /eligibility-rule/.test(matchEngineSource) && /preference/.test(matchEngineSource),
  "The matching engine must distinguish formal eligibility-rule reasons from mere planning-preference reasons (separate `source` tags).",
);
check(/"missing"/.test(matchEngineSource), "Rule kinds the engine can't map with confidence must resolve to \"missing\", never a guessed match.");

// ---------------------------------------------------------------------------
// 3. Eligibility questionnaire: optional, and excludes sensitive data
// ---------------------------------------------------------------------------

check(exists("src/lib/schemas/eligibility-answers.ts"), "Missing the eligibility-answers schema.");
const eligibilitySchemaSource = read("src/lib/schemas/eligibility-answers.ts");
check(exists("app/eligibility/page.tsx"), "Missing the /eligibility page.");
// Matches an actual schema field declaration (`fieldName:`), not prose in a comment describing what's excluded.
check(
  !/\b(passportNumber|nationalId|idNumber|homeAddress|bankAccount|financialDocument|medicalRecord|religion|ethnicity|transcriptFile|cvFile|recommendationLetter)\s*:/.test(eligibilitySchemaSource),
  "Eligibility schema must never collect passport/ID/address/financial/medical/religious/ethnic/transcript/CV/recommendation-letter data.",
);
check(/strict\(\)/.test(eligibilitySchemaSource), "Eligibility answers schema must be `.strict()` so an unexpected field is rejected outright, not silently accepted.");

// ---------------------------------------------------------------------------
// 4. Discovery database schema: 5 new tables, all RLS-enabled, no staff-select
// ---------------------------------------------------------------------------

check(exists("src/lib/db/schema/discovery.ts"), "Missing src/lib/db/schema/discovery.ts.");
const discoverySchemaSource = read("src/lib/db/schema/discovery.ts");
const REQUIRED_DISCOVERY_TABLES = [
  "user_saved_searches",
  "user_eligibility_answers",
  "user_reminder_preferences",
  "user_reminders",
  "user_notifications",
];
for (const table of REQUIRED_DISCOVERY_TABLES) {
  check(discoverySchemaSource.includes(`"${table}"`), `Missing required discovery-data table definition: ${table}`);
  check(new RegExp(`${table}[\\s\\S]{0,600}\\.enableRLS\\(\\)`).test(discoverySchemaSource), `Table ${table} must call .enableRLS().`);
}
check(!/staffSelectPolicy/.test(discoverySchemaSource), "Discovery tables must never grant staff a default select policy — staff have zero casual access to eligibility/discovery data.");
check(/ownerAllPolicy/.test(discoverySchemaSource), "Discovery tables must use the owner-scoped RLS policy helper.");
check(/user_reminders_student_stable_key_unique|uniqueIndex/.test(discoverySchemaSource), "user_reminders must enforce a unique (student, stableKey) index so regeneration never duplicates a reminder.");

check(/revoke select on[\s\S]*user_saved_searches|revoke select on[\s\S]*user_eligibility_answers/i.test(allMigrationSql), "No migration revokes anon's default SELECT grant on the new discovery tables.");
check(/grant select, insert, update, delete on/i.test(allMigrationSql) && /authenticated/.test(allMigrationSql), "No migration grants authenticated the explicit INSERT/UPDATE/DELETE needed on discovery tables (RLS alone doesn't grant).");

// ---------------------------------------------------------------------------
// 5. Reminders: never invented, exact+verified+single-occurrence only for official deadlines
// ---------------------------------------------------------------------------

check(exists("src/lib/reminders/extract.ts") && exists("src/lib/reminders/engine.ts") && exists("src/lib/reminders/status.ts"), "Missing the reminders engine modules.");
const reminderExtractSource = read("src/lib/reminders/extract.ts");
check(reminderExtractSource.includes('"exact"'), "Official-deadline reminders must require exact precision.");
check(reminderExtractSource.includes('"verified"'), "Official-deadline reminders must require verified status.");
check(/occurrences\.length\s*!==\s*1|occurrences\.length\s*===\s*1/.test(reminderExtractSource), "Official-deadline reminders must require exactly one candidate occurrence.");

const reminderEngineSource = read("src/lib/reminders/engine.ts");
check(/stableKey/.test(reminderEngineSource), "Reminder candidates must carry a deterministic stableKey to prevent duplication.");
check(exists("src/components/discovery/ReminderPreferencesForm.tsx"), "Missing the reminder lead-day preferences UI.");
const reminderPreferencesFormSource = read("src/components/discovery/ReminderPreferencesForm.tsx");
check(exists("src/lib/storage/types.ts") && /REMINDER_LEAD_DAY_OPTIONS/.test(read("src/lib/storage/types.ts")), "Missing the shared reminder lead-day option list (0/1/3/7/14/30).");
check(/officialLeadDays|personalLeadDays/.test(reminderPreferencesFormSource), "The reminder preferences UI must let a student configure official and personal lead days separately.");

// ---------------------------------------------------------------------------
// 6. Notification center: never staff diagnostics, never private note text
// ---------------------------------------------------------------------------

check(exists("app/notifications/page.tsx") && exists("src/components/notifications/NotificationCenter.tsx"), "Missing the /notifications page or its NotificationCenter component.");
check(exists("src/lib/db/actions/student/notifications.ts"), "Missing the notification server actions module.");
const notificationActionsSource = read("src/lib/db/actions/student/notifications.ts");
check(!/noteText/.test(notificationActionsSource), "Notification creation must never accept or store private note text.");
check(/never includes private note text|Never includes private note text/i.test(notificationActionsSource), "The notification-creation function must be documented as never including private note text.");

// ---------------------------------------------------------------------------
// 7. Browser notifications: permission only from an explicit click, gated by env flag
// ---------------------------------------------------------------------------

check(exists("src/lib/notifications/browser.ts"), "Missing the browser Notification API helper module.");
const browserNotifSource = read("src/lib/notifications/browser.ts");
check(browserNotifSource.includes("requestPermission"), "Missing requestBrowserNotificationPermission wiring to the real Notification API.");
check(exists("src/components/notifications/NotificationPermissionSection.tsx"), "Missing the notification-permission UI section.");
const notifSectionSource = read("src/components/notifications/NotificationPermissionSection.tsx");
check(/onClick/.test(notifSectionSource), "Browser notification permission must only be requested from a click handler.");
check(!/useEffect\([^)]*\{\s*[^}]*requestBrowserNotificationPermission/.test(notifSectionSource.replace(/\s+/g, " ")), "Browser notification permission must never be requested automatically inside a useEffect / on page load.");
check(/NEXT_PUBLIC_ENABLE_BROWSER_NOTIFICATIONS/.test(notifSectionSource), "The browser-notification UI must be gated behind the NEXT_PUBLIC_ENABLE_BROWSER_NOTIFICATIONS flag.");
check(read(".env.example").includes("NEXT_PUBLIC_ENABLE_BROWSER_NOTIFICATIONS"), ".env.example must document NEXT_PUBLIC_ENABLE_BROWSER_NOTIFICATIONS.");
check(read(".env.example").includes("VAPID_PRIVATE_KEY") && !new RegExp("NEXT_PUBLIC_VAPID_PRIVATE_KEY").test(read(".env.example")), ".env.example must document a server-only VAPID_PRIVATE_KEY, never a NEXT_PUBLIC_-prefixed one.");

// ---------------------------------------------------------------------------
// 8. Comparison: 2-4 items, browser-local only (not a database table)
// ---------------------------------------------------------------------------

check(exists("app/compare/page.tsx") && exists("src/components/opportunities/ComparisonView.tsx"), "Missing the /compare page or ComparisonView component.");
check(exists("src/hooks/useComparisonSelection.ts"), "Missing the comparison-selection hook.");
const comparisonHookSource = read("src/hooks/useComparisonSelection.ts");
check(/MAX_ITEMS\s*=\s*4/.test(comparisonHookSource), "Comparison must cap at 4 selected items.");
check(!/schema\.\w*comparison/i.test(discoverySchemaSource), "Comparison selection must stay client-side (localStorage) and never become its own RLS-governed database table.");

// ---------------------------------------------------------------------------
// 9. Staff discovery-quality support page: protected, aggregate-only
// ---------------------------------------------------------------------------

check(exists("app/staff/(protected)/discovery/page.tsx"), "Missing the staff discovery-quality page under the protected staff route group (so it inherits getStaffSession() gating).");
check(exists("src/lib/db/actions/discovery-quality.ts"), "Missing the discovery-quality staff server actions module.");
const discoveryQualitySource = read("src/lib/db/actions/discovery-quality.ts");
check(/getStaffSession/.test(discoveryQualitySource), "Discovery-quality actions must independently re-check a real staff session, not just rely on route placement.");
check(!/\.select\(\)[\s\S]{0,80}from\(schema\.userSavedSearches\)|\.select\(\)[\s\S]{0,80}from\(schema\.userReminders\)/.test(discoveryQualitySource), "Staff discovery-quality diagnostics must use aggregate counts, never a raw per-row select of another student's saved searches or reminders.");
check(read("src/components/staff/StaffNav.tsx").includes("/staff/discovery"), "The staff discovery-quality page must be linked from staff navigation.");

// ---------------------------------------------------------------------------
// 10. Guest backup + cloud export/import + migration extended for all new data
// ---------------------------------------------------------------------------

const backupSource = read("src/lib/storage/backup.ts");
check(/eligibilityAnswers/.test(backupSource) && /savedSearches/.test(backupSource) && /reminderPreferences/.test(backupSource) && /reminders/.test(backupSource) && /notifications/.test(backupSource), "Guest backup payload must include all 5 Checkpoint 4 data types.");
check(/SCHEMA_VERSION\s*=\s*4/.test(read("src/lib/storage/types.ts")), "Guest storage SCHEMA_VERSION must be bumped to 4 for the new IndexedDB stores.");

const cloudExportSource = read("src/lib/schemas/cloud-export.ts");
check(/CLOUD_EXPORT_SCHEMA_VERSION\s*=\s*2/.test(cloudExportSource), "Cloud export schema version must be bumped to 2.");
check(/eligibilityAnswers[\s\S]{0,40}\.optional\(\)/.test(cloudExportSource), "New cloud-export fields must be `.optional()` so pre-Checkpoint-4 exports remain valid.");

const dataControlsSource2 = read("src/lib/db/actions/student/data-controls.ts");
for (const table of ["userSavedSearches", "userEligibilityAnswers", "userReminderPreferences", "userReminders", "userNotifications"]) {
  check(dataControlsSource2.includes(table), `exportMyData/importMyAccountData/deletion must reference schema.${table}.`);
}

const syncActionSource2 = read("src/lib/db/actions/student/sync.ts");
check(/eligibilityAnswers/.test(syncActionSource2) && /savedSearches/.test(syncActionSource2) && /reminderPreferences/.test(syncActionSource2), "Guest-to-cloud migration (applyGuestMigration) must cover eligibility answers, saved searches, and reminder preferences/reminders.");

// ---------------------------------------------------------------------------
// 11. Privacy page, service worker, and env documentation updated
// ---------------------------------------------------------------------------

const privacySource2 = read("app/privacy/page.tsx");
check(privacySource2.includes("Checkpoint 4"), "Privacy page must be marked as reviewed for Checkpoint 4.");
check(/eligibility answers are optional/i.test(privacySource2), "Privacy page must state eligibility answers are optional.");
check(/no AI|not used anywhere/i.test(privacySource2), "Privacy page must state matching is rule-based, not AI.");
check(/planning aid/i.test(privacySource2), "Privacy page must describe match labels as a planning aid, never a final decision.");
check(/browser notification/i.test(privacySource2), "Privacy page must explain browser-notification device visibility.");
check(/no paid SMS|no.*paid.*notification/i.test(privacySource2), "Privacy page must state there is no paid SMS/WhatsApp/email notification service.");

const serviceWorkerSource2 = read("public/sw.js");
check(/isCacheable|no-store/i.test(serviceWorkerSource2), "public/sw.js must honor Cache-Control no-store/private before writing any response to Cache Storage, including the precache step.");
check(read("src/lib/supabase/middleware.ts").includes("/eligibility") && read("src/lib/supabase/middleware.ts").includes("/notifications"), "Middleware must mark /eligibility and /notifications no-store for a signed-in visitor.");

// ---------------------------------------------------------------------------
// 12. Guest mode preserved, never forced login, no AI, no sensitive uploads
// ---------------------------------------------------------------------------

check(exists("src/lib/storage/workspace.ts") && exists("src/components/workspace/WorkspaceView.tsx"), "Guest workspace mode (from earlier checkpoints) must still exist, unmodified in availability.");
check(!/login required|must sign in|account required/i.test(read("app/eligibility/page.tsx")), "The eligibility page must never require login.");
check(!/login required|must sign in|account required/i.test(read("app/notifications/page.tsx")), "The notifications page must never require login.");

const allSourceFiles2 = listFilesRecursive("src").concat(listFilesRecursive("app"));
const structuredDataAcceptPattern2 = /accept=["'][^"']*(?:\.csv|text\/csv|application\/json)[^"']*["']/i;
const fileInputPattern2 = /type=["']file["']/i;
const fileUploadOffenders2 = allSourceFiles2.filter((f) => {
  const content = read(f);
  return fileInputPattern2.test(content) && !structuredDataAcceptPattern2.test(content);
});
check(fileUploadOffenders2.length === 0, `No sensitive-file upload UI is permitted. Found suspicious pattern in: ${fileUploadOffenders2.join(", ")}`);

const aiLibraryPattern2 = /openai|anthropic|@ai-sdk|langchain/i;
check(!aiLibraryPattern2.test(read("package.json")), "No AI SDK/library dependency may be added in Checkpoint 4.");

const paidNotificationPattern = /twilio|nexmo|sendgrid|@sendgrid|mailgun|whatsapp-business|messagebird/i;
const paidNotificationOffenders = allSourceFiles2.filter((f) => paidNotificationPattern.test(read(f)));
check(paidNotificationOffenders.length === 0, `No paid SMS/WhatsApp/email provider dependency is permitted. Found in: ${paidNotificationOffenders.join(", ")}`);
check(!paidNotificationPattern.test(read("package.json")), "package.json must not depend on a paid SMS/WhatsApp/email notification provider.");

// ---------------------------------------------------------------------------
// 13. Required tests exist
// ---------------------------------------------------------------------------

const REQUIRED_TEST_FILES_4 = [
  "tests/unit/matching-engine.test.ts",
  "tests/unit/reminders-engine.test.ts",
  "tests/unit/eligibility-answers-schema.test.ts",
  "tests/unit/search-rank.test.ts",
  "tests/unit/search-query.test.ts",
  "tests/unit/saved-search-alerts.test.ts",
  "tests/integration/discovery-rls.test.ts",
  "tests/integration/search-visibility.test.ts",
  "tests/e2e/discovery.spec.ts",
];
for (const file of REQUIRED_TEST_FILES_4) {
  check(exists(file), `Missing required Checkpoint 4 test file: ${file}`);
}
check(read("tests/integration/discovery-rls.test.ts").includes("staff has no default read access") || read("tests/integration/discovery-rls.test.ts").includes("staff cannot read"), "Discovery RLS integration tests must prove staff has no default read access to student discovery data.");
check(read("tests/unit/backup.test.ts").includes("Checkpoint 4"), "Guest backup unit tests must cover the Checkpoint 4 data types (round-trip), not just the Checkpoint 3 shape.");
check(read("tests/unit/cloud-export-schema.test.ts").includes("Checkpoint 4"), "Cloud export schema unit tests must cover the Checkpoint 4 fields.");

// ---------------------------------------------------------------------------
// 14. Required documentation
// ---------------------------------------------------------------------------

const REQUIRED_DOCS_4 = [
  "docs/checkpoint-4/checkpoint-4-architecture.md",
  "docs/checkpoint-4/eligibility-matching-spec.md",
  "docs/checkpoint-4/reminders-and-notifications.md",
  "docs/checkpoint-4/checkpoint-4-manual-qa.md",
  "docs/checkpoint-4/checkpoint-4-traceability.md",
  "docs/checkpoint-4/checkpoint-4-completion-report.md",
];
for (const file of REQUIRED_DOCS_4) {
  check(exists(file) && read(file).trim().length > 200, `Missing or too-short required documentation file: ${file}`);
}

// ---------------------------------------------------------------------------
// 15. package.json commands preserved + checkpoint4:validate registered
// ---------------------------------------------------------------------------

const packageJson2 = JSON.parse(read("package.json")) as { scripts?: Record<string, string> };
check(Boolean(packageJson2.scripts?.["checkpoint4:validate"]), "Missing required package.json script: checkpoint4:validate");
for (const script of [
  "checkpoint0:validate",
  "checkpoint1:validate",
  "checkpoint2:validate",
  "checkpoint3:validate",
  "data:validate",
  "deadlines:audit",
  "db:check",
  "db:test",
  "db:verify:migration",
  "typecheck",
  "test",
  "test:coverage",
  "test:e2e",
  "lint",
  "build",
]) {
  check(Boolean(packageJson2.scripts?.[script]), `Checkpoint 4 must preserve the existing package.json script: ${script}`);
}

// ---------------------------------------------------------------------------
// 16. Preserved earlier-checkpoint guarantees (spot checks, not a full re-run)
// ---------------------------------------------------------------------------

check(exists("scripts/validate-checkpoint3.ts"), "The Checkpoint 3 validator must still exist and be runnable.");
check(exists("app/account/layout.tsx") && read("app/account/layout.tsx").includes("getStudentSession"), "The /account layout must still gate on a real student session.");
check(exists("app/staff/(protected)/layout.tsx") && read("app/staff/(protected)/layout.tsx").includes("getStaffSession"), "Staff routes must still gate on getStaffSession().");

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

console.log(`Checkpoint 4 validation: ${checksPassed} check(s) passed, ${errors.length} failed.`);
if (errors.length > 0) {
  console.error("\nFailures:");
  for (const error of errors) {
    console.error(`  - ${error}`);
  }
  process.exit(1);
}
