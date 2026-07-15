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

// ---------------------------------------------------------------------------
// Required application routes
// ---------------------------------------------------------------------------

const REQUIRED_ROUTES = [
  "app/page.tsx",
  "app/opportunities/page.tsx",
  "app/opportunities/[slug]/page.tsx",
  "app/workspace/page.tsx",
  "app/calendar/page.tsx",
  "app/custom-opportunities/new/page.tsx",
  "app/custom-opportunities/[id]/edit/page.tsx",
  "app/settings/page.tsx",
  "app/privacy/page.tsx",
  "app/offline/page.tsx",
  "app/not-found.tsx",
  "app/error.tsx",
  "app/layout.tsx",
] as const;

for (const route of REQUIRED_ROUTES) {
  check(exists(route), `Missing required route file: ${route}`);
}

check(
  read("app/opportunities/[slug]/page.tsx").includes("generateStaticParams"),
  "Opportunity detail route must implement generateStaticParams for the 55 built-in opportunities.",
);

// ---------------------------------------------------------------------------
// PWA: manifest, service worker, offline fallback, install/update flow
// ---------------------------------------------------------------------------

check(exists("app/manifest.ts"), "Missing app/manifest.ts (web app manifest).");
check(
  /icons:/.test(read("app/manifest.ts")) && /display:\s*"standalone"/.test(read("app/manifest.ts")),
  "app/manifest.ts must declare icons and standalone display mode.",
);

check(exists("public/sw.js"), "Missing public/sw.js (service worker).");
const serviceWorkerSource = read("public/sw.js");
check(
  /addEventListener\(["']install["']/.test(serviceWorkerSource) &&
    /addEventListener\(["']activate["']/.test(serviceWorkerSource) &&
    /addEventListener\(["']fetch["']/.test(serviceWorkerSource),
  "public/sw.js must register install, activate, and fetch handlers.",
);
check(
  /url\.origin !== self\.location\.origin/.test(serviceWorkerSource),
  "public/sw.js must never intercept/cache cross-origin (official-source) requests.",
);

check(
  exists("src/components/layout/ServiceWorkerRegistration.tsx"),
  "Missing ServiceWorkerRegistration component.",
);
const serviceWorkerRegistration = read("src/components/layout/ServiceWorkerRegistration.tsx");
check(
  /userRequestedRefresh/.test(serviceWorkerRegistration),
  "ServiceWorkerRegistration must only reload on controllerchange after a user-requested refresh " +
    "(a bare controllerchange reload also fires on a visitor's first-ever page load via clients.claim()).",
);

check(
  read("app/offline/page.tsx").length > 0,
  "app/offline/page.tsx must contain a useful offline fallback.",
);

// ---------------------------------------------------------------------------
// Local persistence, backup, custom-opportunity schema, calendar/ICS
// ---------------------------------------------------------------------------

const REQUIRED_LIB_MODULES = [
  "src/lib/deadlines/engine.ts",
  "src/lib/deadlines/personal.ts",
  "src/lib/deadlines/seed-adapter.ts",
  "src/lib/catalogue/repository.ts",
  "src/lib/catalogue/search.ts",
  "src/lib/catalogue/stats.ts",
  "src/lib/catalogue/custom-adapter.ts",
  "src/lib/storage/db.ts",
  "src/lib/storage/workspace.ts",
  "src/lib/storage/custom-opportunities.ts",
  "src/lib/storage/backup.ts",
  "src/lib/storage/preferences.ts",
  "src/lib/storage/diagnostics.ts",
  "src/lib/schemas/custom-opportunity.ts",
  "src/lib/calendar/events.ts",
  "src/lib/calendar/ics.ts",
  "src/lib/analytics/index.ts",
  "src/lib/planning/labels.ts",
] as const;

for (const modulePath of REQUIRED_LIB_MODULES) {
  check(exists(modulePath), `Missing required module: ${modulePath}`);
}

check(
  /SCHEMA_VERSION/.test(read("src/lib/storage/types.ts")),
  "src/lib/storage/types.ts must define a SCHEMA_VERSION constant for versioned local storage.",
);

const backupSource = read("src/lib/storage/backup.ts");
check(
  /containsDangerousKeys/.test(backupSource) && /__proto__/.test(backupSource),
  "Backup import must guard against prototype-pollution keys.",
);
check(
  /MAX_BACKUP_FILE_SIZE_BYTES/.test(backupSource),
  "Backup import must enforce a maximum file size.",
);
check(
  /buildTrackedApplicationsCsv/.test(backupSource),
  "Backup module must provide a CSV export of tracked applications.",
);

const icsSource = read("src/lib/calendar/ics.ts");
check(
  /BEGIN:VCALENDAR/.test(icsSource) && /BEGIN:VEVENT/.test(icsSource),
  "ICS export must generate standards-shaped VCALENDAR/VEVENT blocks.",
);

// ---------------------------------------------------------------------------
// No automatic deadline rollover (Checkpoint 0 policy carried into Checkpoint 1)
// ---------------------------------------------------------------------------

check(
  /automaticDateGenerationAllowed:\s*false/.test(read("src/lib/domain/deadlines.ts")),
  "Canonical deadline recurrence contract must keep automaticDateGenerationAllowed fixed to false.",
);

const deadlineEngineSource = read("src/lib/deadlines/engine.ts");
check(
  !/setFullYear|getFullYear\(\)\s*\+\s*1/.test(deadlineEngineSource),
  "Deadline engine must not contain year-incrementing/rollover date arithmetic.",
);

// ---------------------------------------------------------------------------
// No database, auth, or cloud-sync dependency introduced unintentionally
// ---------------------------------------------------------------------------

const PROHIBITED_DEPENDENCY_KEYWORDS = [
  "pg",
  "postgres",
  "mysql",
  "mysql2",
  "mongodb",
  "mongoose",
  "prisma",
  "@prisma/client",
  "supabase",
  "@supabase/supabase-js",
  "firebase",
  "firebase-admin",
  "next-auth",
  "@auth/core",
  "auth0",
  "passport",
  "bcrypt",
  "bcryptjs",
  "jsonwebtoken",
  "redis",
  "ioredis",
  "sqlite3",
  "better-sqlite3",
  "knex",
  "sequelize",
  "typeorm",
  "drizzle-orm",
] as const;

const packageJson = JSON.parse(read("package.json")) as {
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
};
const allDependencyNames = new Set([
  ...Object.keys(packageJson.dependencies ?? {}),
  ...Object.keys(packageJson.devDependencies ?? {}),
]);

const foundProhibitedDependencies = PROHIBITED_DEPENDENCY_KEYWORDS.filter((name) =>
  allDependencyNames.has(name),
);
check(
  foundProhibitedDependencies.length === 0,
  `Prohibited database/auth/cloud dependency detected: ${foundProhibitedDependencies.join(", ")}.`,
);

// ---------------------------------------------------------------------------
// No sensitive document-upload feature was added
// ---------------------------------------------------------------------------

const PROHIBITED_SENSITIVE_TERMS = [
  "passportNumber",
  "passportFile",
  "transcriptFile",
  "bankStatement",
  "creditCardNumber",
  "socialSecurityNumber",
  "nationalIdNumber",
] as const;

function collectSourceFiles(dir: string, out: string[] = []): string[] {
  const absoluteDir = path.join(root, dir);
  if (!existsSync(absoluteDir)) return out;
  for (const entry of readdirSync(absoluteDir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
    const relative = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      collectSourceFiles(relative, out);
    } else if (/\.(ts|tsx)$/.test(entry.name)) {
      out.push(relative);
    }
  }
  return out;
}

const sourceFiles = [...collectSourceFiles("app"), ...collectSourceFiles("src")];
const sensitiveHits: string[] = [];
const fileInputHits: string[] = [];

for (const file of sourceFiles) {
  const contents = read(file);
  for (const term of PROHIBITED_SENSITIVE_TERMS) {
    if (contents.includes(term)) {
      sensitiveHits.push(`${file}: ${term}`);
    }
  }
  const fileInputMatches = [...contents.matchAll(/<input[^>]*type=["']file["'][^>]*>/g)];
  for (const match of fileInputMatches) {
    if (!/accept=["']application\/json["']/.test(match[0])) {
      fileInputHits.push(`${file}: ${match[0]}`);
    }
  }
}

check(
  sensitiveHits.length === 0,
  `Prohibited sensitive-document field name(s) found: ${sensitiveHits.join(", ")}.`,
);
check(
  fileInputHits.length === 0,
  `Unexpected file input not restricted to JSON backups: ${fileInputHits.join(", ")}.`,
);

// ---------------------------------------------------------------------------
// Authoritative seed dataset still contains exactly 55 records
// ---------------------------------------------------------------------------

let seedCount = 0;
try {
  const seed = JSON.parse(read("data/migrations/v0.1/scholarships.seed.json")) as unknown[];
  seedCount = Array.isArray(seed) ? seed.length : 0;
  check(seedCount === 55, `Authoritative seed dataset must contain exactly 55 records; found ${seedCount}.`);
} catch (error) {
  errors.push(`Migration seed JSON is invalid: ${error instanceof Error ? error.message : String(error)}`);
}

// ---------------------------------------------------------------------------
// Required package scripts
// ---------------------------------------------------------------------------

const REQUIRED_SCRIPTS = [
  "dev",
  "build",
  "start",
  "lint",
  "typecheck",
  "test",
  "test:coverage",
  "test:e2e",
  "data:validate",
  "deadlines:audit",
  "checkpoint0:validate",
  "checkpoint1:validate",
] as const;

for (const script of REQUIRED_SCRIPTS) {
  check(
    typeof packageJson.scripts?.[script] === "string" && packageJson.scripts[script].length > 0,
    `package.json is missing required script: ${script}.`,
  );
}

// ---------------------------------------------------------------------------
// Automated test suites exist (Vitest + Playwright)
// ---------------------------------------------------------------------------

check(exists("vitest.config.ts"), "Missing vitest.config.ts.");
check(exists("playwright.config.ts"), "Missing playwright.config.ts.");

const unitTestFiles = collectSourceFiles("tests/unit").filter((f) => f.endsWith(".test.ts") || f.endsWith(".test.tsx"));
check(unitTestFiles.length >= 10, `Expected at least 10 Vitest unit/component test files; found ${unitTestFiles.length}.`);

const e2eTestFiles = existsSync(path.join(root, "tests/e2e"))
  ? readdirSync(path.join(root, "tests/e2e")).filter((f) => f.endsWith(".spec.ts"))
  : [];
check(e2eTestFiles.length >= 7, `Expected at least 7 Playwright e2e spec files; found ${e2eTestFiles.length}.`);

// ---------------------------------------------------------------------------
// Docker Compose test profile for Playwright
// ---------------------------------------------------------------------------

const composeSource = read("docker-compose.yml");
check(
  /profiles:\s*\[\s*["']test["']\s*\]/.test(composeSource) && /\be2e:/.test(composeSource),
  'docker-compose.yml must define a "test"-profiled e2e service (docker compose --profile test run --rm e2e).',
);
check(
  /network_mode:\s*["']service:web-e2e["']/.test(composeSource),
  "The e2e service should share web-e2e's network namespace so the app is reachable at a secure-context " +
    "localhost origin (service workers do not activate on a plain Docker hostname).",
);

// ---------------------------------------------------------------------------
// Required Checkpoint 1 documentation
// ---------------------------------------------------------------------------

const REQUIRED_DOCS = [
  "docs/checkpoint-1/checkpoint-1-architecture.md",
  "docs/checkpoint-1/checkpoint-1-manual-qa.md",
  "docs/checkpoint-1/checkpoint-1-completion-report.md",
  "docs/checkpoint-1/checkpoint-1-traceability.md",
] as const;

for (const doc of REQUIRED_DOCS) {
  check(exists(doc), `Missing required Checkpoint 1 document: ${doc}.`);
}

check(
  /guest data|local-only|browser-local/i.test(read("README.md")),
  "README.md must describe the guest-local data model.",
);

// ---------------------------------------------------------------------------
// Custom opportunities never claim official verification
// ---------------------------------------------------------------------------

check(
  /never labelled as officially verified|not officially verified/i.test(
    read("src/components/opportunities/badges.tsx"),
  ),
  "Custom-opportunity badges must never claim official verification.",
);

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

if (errors.length > 0) {
  console.error("Checkpoint 1 validation failed:\n");
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  console.error(`\n${checksPassed} checks passed; ${errors.length} checks failed.`);
  process.exitCode = 1;
} else {
  console.log("Checkpoint 1 validation passed.");
  console.log(`- Structural checks passed: ${checksPassed}`);
  console.log(`- Built-in seed records: ${seedCount}`);
  console.log(`- Vitest unit/component test files: ${unitTestFiles.length}`);
  console.log(`- Playwright e2e spec files: ${e2eTestFiles.length}`);
}
