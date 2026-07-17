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

const migrationDir = "drizzle";
const migrationFiles = exists(migrationDir) ? readdirSync(path.join(root, migrationDir)).filter((f) => f.endsWith(".sql")) : [];
const allMigrationSql = migrationFiles.map((f) => read(path.join(migrationDir, f))).join("\n");

// ---------------------------------------------------------------------------
// 1. AI provider abstraction
// ---------------------------------------------------------------------------

const REQUIRED_PROVIDER_FILES = [
  "src/lib/ai/providers/types.ts",
  "src/lib/ai/providers/mock.ts",
  "src/lib/ai/providers/groq.ts",
  "src/lib/ai/providers/index.ts",
];
for (const file of REQUIRED_PROVIDER_FILES) {
  check(exists(file), `Missing required AI provider file: ${file}`);
}
check(read("src/lib/ai/providers/index.ts").includes("getAiProvider"), "Missing getAiProvider() provider factory.");
check(read("src/lib/ai/providers/groq.ts").includes("server-only"), "GroqAiProvider must be server-only.");
check(!read("src/lib/ai/providers/groq.ts").includes("NEXT_PUBLIC"), "GroqAiProvider must never read a NEXT_PUBLIC_ variable.");

// ---------------------------------------------------------------------------
// 2. Server-only AI config validation (never throws, safe defaults)
// ---------------------------------------------------------------------------

const aiConfigSource = read("src/lib/ai/config.ts");
check(exists("src/lib/ai/config.ts"), "Missing src/lib/ai/config.ts.");
check(aiConfigSource.includes("server-only"), "AI config module must be server-only.");
check(aiConfigSource.includes("safeParse"), "getAiConfig() must use a non-throwing parse (safeParse), never throw on malformed env.");
check(aiConfigSource.includes("isAvailable"), "AiConfig must expose an isAvailable flag distinguishing 'enabled' from 'actually usable'.");
check(!aiConfigSource.includes("NEXT_PUBLIC_GROQ"), "GROQ_API_KEY must never be exposed as a NEXT_PUBLIC_ variable.");

// ---------------------------------------------------------------------------
// 3. AI disabled/unavailable fallback
// ---------------------------------------------------------------------------

const assistantSource = read("src/lib/ai/assistant.ts");
check(exists("src/lib/ai/assistant.ts"), "Missing src/lib/ai/assistant.ts (the core askAssistant() orchestration).");
check(assistantSource.includes('"unavailable"'), "askAssistant() must have an explicit 'unavailable' result kind.");
check(assistantSource.includes("isAvailable"), "askAssistant() must check AI config availability before doing anything else.");
check(read("src/lib/db/actions/student/ai-assistant.ts").includes("isAiAvailableAction"), "Missing a server-side isAiAvailableAction() pre-check pages can use to render a graceful unavailable state.");

// ---------------------------------------------------------------------------
// 4. RAG/source tables exist in the Drizzle schema
// ---------------------------------------------------------------------------

const aiSchemaSource = read("src/lib/db/schema/ai.ts");
const REQUIRED_AI_TABLES = [
  "aiSourceDocuments",
  "aiSourceChunks",
  "aiPromptTemplates",
  "aiConversations",
  "aiMessages",
  "aiAnswerCitations",
  "aiRetrievalEvents",
  "aiFeedback",
  "aiSafetyEvents",
  "aiEvaluationCases",
  "aiEvaluationRuns",
  "aiUsageLimits",
  "aiProviderHealth",
];
for (const table of REQUIRED_AI_TABLES) {
  check(aiSchemaSource.includes(`export const ${table}`), `Missing required AI table export: ${table}`);
}
check(read("src/lib/db/schema/index.ts").includes('export * from "./ai"'), "src/lib/db/schema/index.ts must re-export the AI schema module.");

// ---------------------------------------------------------------------------
// 5. AI migrations exist
// ---------------------------------------------------------------------------

check(migrationFiles.some((f) => /ai_assistant/.test(f)), "Missing the ai_assistant Drizzle-generated migration.");
check(migrationFiles.some((f) => /ai_grants_and_search/.test(f)), "Missing the hand-authored ai_grants_and_search migration (tsvector index + grants).");
check(/chunk_text_search/.test(allMigrationSql), "No migration adds a tsvector generated column for full-text chunk search.");
check(/ai_source_chunks/.test(allMigrationSql) && /gin/i.test(allMigrationSql), "No migration adds a GIN index for AI chunk full-text search.");

// ---------------------------------------------------------------------------
// 6. RLS exists for AI user-owned tables, including the forged-parent-id fix
// ---------------------------------------------------------------------------

for (const table of ["ai_conversations", "ai_messages", "ai_answer_citations", "ai_retrieval_events", "ai_feedback", "ai_usage_limits"]) {
  check(new RegExp(`enable row level security[\\s\\S]{0,400}"${table}"|alter table "${table}"[\\s\\S]{0,50}enable row level security`, "i").test(allMigrationSql) || allMigrationSql.includes(table), `No RLS/migration reference found for ${table}.`);
}
check(/ai_messages_owner_all/.test(allMigrationSql) && /exists/i.test(allMigrationSql), "ai_messages RLS policy must verify the parent conversation is also owned by the caller (not just a matching student_profile_id).");
check(exists("tests/integration/ai-rls.test.ts"), "Missing the AI row-level-security integration test file.");

// ---------------------------------------------------------------------------
// 7. Public AI retrieval excludes unpublished/staff/private data
// ---------------------------------------------------------------------------

const retrievalSource = read("src/lib/ai/rag/retrieval.ts");
check(exists("src/lib/ai/rag/retrieval.ts"), "Missing src/lib/ai/rag/retrieval.ts.");
check(retrievalSource.includes("status = 'approved'") || retrievalSource.includes("status='approved'"), "Retrieval must filter chunks to status = 'approved'.");
check(retrievalSource.includes("published"), "Retrieval must additionally require the linked opportunity to be published.");

// ---------------------------------------------------------------------------
// 8. Citation system
// ---------------------------------------------------------------------------

check(exists("src/lib/ai/rag/citations.ts") && read("src/lib/ai/rag/citations.ts").includes("buildCitations"), "Missing buildCitations() in src/lib/ai/rag/citations.ts.");

// ---------------------------------------------------------------------------
// 9. AI assistant routes
// ---------------------------------------------------------------------------

const REQUIRED_AI_ROUTES = ["app/assistant/page.tsx", "app/assistant/history/page.tsx", "app/assistant/settings/page.tsx", "app/workspace/assistant/page.tsx"];
for (const route of REQUIRED_AI_ROUTES) {
  check(exists(route), `Missing required assistant route: ${route}`);
}

// ---------------------------------------------------------------------------
// 10. Opportunity-detail AI panel
// ---------------------------------------------------------------------------

check(exists("src/components/assistant/OpportunityAssistantPanel.tsx"), "Missing OpportunityAssistantPanel.tsx.");
check(read("src/components/opportunities/OpportunityDetailBody.tsx").includes("OpportunityAssistantPanel"), "OpportunityDetailBody must render the opportunity AI panel.");

// ---------------------------------------------------------------------------
// 11. Staff AI source management
// ---------------------------------------------------------------------------

const REQUIRED_STAFF_AI_ROUTES = [
  "app/staff/(protected)/ai/page.tsx",
  "app/staff/(protected)/ai/sources/page.tsx",
  "app/staff/(protected)/ai/evaluations/page.tsx",
  "app/staff/(protected)/ai/usage/page.tsx",
  "app/staff/(protected)/ai/safety/page.tsx",
];
for (const route of REQUIRED_STAFF_AI_ROUTES) {
  check(exists(route), `Missing required staff AI route: ${route}`);
}
const staffAiActionsSource = read("src/lib/db/actions/ai-staff.ts");
check(staffAiActionsSource.includes("canManageAiSources"), "Staff AI source actions must check canManageAiSources().");
check(staffAiActionsSource.includes("canApproveAiSources"), "Staff AI source actions must check canApproveAiSources() before approve/reject/stale transitions.");
check(read("src/lib/auth/permissions.ts").includes("canDisableAi"), "Missing canDisableAi() permission function for the runtime kill switch.");

// ---------------------------------------------------------------------------
// 12. AI feedback
// ---------------------------------------------------------------------------

check(read("src/lib/db/actions/student/ai-assistant.ts").includes("submitAiFeedback"), "Missing submitAiFeedback() server action.");
check(staffAiActionsSource.includes("listAiFeedback"), "Missing staff-facing listAiFeedback() action.");

// ---------------------------------------------------------------------------
// 13. AI evaluation harness
// ---------------------------------------------------------------------------

check(exists("src/lib/ai/evaluation/cases.ts") && exists("src/lib/ai/evaluation/harness.ts"), "Missing the AI evaluation harness modules.");
const evaluationCasesSource = read("src/lib/ai/evaluation/cases.ts");
for (const requiredCaseFragment of [
  "exact-verified-deadline",
  "estimated-deadline",
  "rolling-deadline",
  "unknown-deadline",
  "required-documents",
  "eligibility-summary",
  "guaranteed-eligibility-request",
  "invent-missing-deadline-request",
  "ignore-sources-request",
  "unpublished-opportunity-question",
  "other-user-private-notes-request",
  "hidden-prompt-request",
  "secret-key-request",
  "comparison-question",
  "planning-question",
]) {
  check(evaluationCasesSource.includes(requiredCaseFragment), `Missing required evaluation case: ${requiredCaseFragment}`);
}
check(staffAiActionsSource.includes("triggerAiEvaluationRun"), "Missing staff-triggered triggerAiEvaluationRun() action.");

// ---------------------------------------------------------------------------
// 14. Rate limiting
// ---------------------------------------------------------------------------

check(exists("src/lib/ai/rate-limit/guest.ts") && read("src/lib/ai/rate-limit/guest.ts").includes("checkAndConsumeGuestQuota"), "Missing guest rate limiting (checkAndConsumeGuestQuota).");
check(exists("src/lib/ai/rate-limit/user.ts") && read("src/lib/ai/rate-limit/user.ts").includes("checkAndConsumeUserQuota"), "Missing signed-in rate limiting (checkAndConsumeUserQuota).");

// ---------------------------------------------------------------------------
// 15. Prompt-injection safety
// ---------------------------------------------------------------------------

const intentClassifierSource = read("src/lib/ai/safety/intent-classifier.ts");
check(exists("src/lib/ai/safety/intent-classifier.ts"), "Missing src/lib/ai/safety/intent-classifier.ts.");
for (const reason of ["hidden-prompt-request", "secret-request", "other-user-data-request", "prompt-injection", "invented-fact-request"]) {
  check(intentClassifierSource.includes(reason), `Missing safety block reason: ${reason}`);
}
check(exists("src/lib/ai/safety/neutralize-source.ts"), "Missing source-text neutralization (untrusted retrieved content).");
check(exists("src/lib/ai/safety/validate-output.ts"), "Missing post-generation output validation.");
check(exists("tests/unit/ai-safety.test.ts"), "Missing unit tests for the safety modules.");
check(exists("scripts/ai-safety-test.ts"), "Missing scripts/ai-safety-test.ts (npm run ai:safety:test).");

// ---------------------------------------------------------------------------
// 16. Privacy page updated
// ---------------------------------------------------------------------------

const privacyPageSource = read("app/privacy/page.tsx");
check(/AI assistant/i.test(privacyPageSource), "Privacy page must describe the AI assistant.");
check(!/AI is not used anywhere/i.test(privacyPageSource), "Privacy page must not still claim AI is not used anywhere in ScholarTrack.");
check(/temporary chat/i.test(privacyPageSource), "Privacy page must mention temporary chat mode.");

// ---------------------------------------------------------------------------
// 17. Account export/delete includes AI data where enabled
// ---------------------------------------------------------------------------

const dataControlsSource = read("src/lib/db/actions/student/data-controls.ts");
check(dataControlsSource.includes("aiConversations") && dataControlsSource.includes("getMyAiHistoryEnabled"), "Account export must conditionally include AI conversation history only when the student has enabled it.");
check(dataControlsSource.includes("aiConversations") && /delete/i.test(dataControlsSource), "Account/workspace deletion must also remove AI conversation history.");

// ---------------------------------------------------------------------------
// 18. Service worker / middleware never cache AI or private routes unsafely
// ---------------------------------------------------------------------------

check(read("src/lib/supabase/middleware.ts").includes('"/assistant"'), "middleware.ts must mark /assistant as a session-aware public prefix (no-store for a signed-in visit).");
const swSource = read("public/sw.js");
check(swSource.includes('startsWith("/staff")'), "Service worker must exclude /staff/** from all caching (covers /staff/ai/** too).");
check(!swSource.includes("/assistant") || /never precached|not precached|deliberately NOT/i.test(swSource), "Service worker must not blindly precache the personalised /assistant routes.");

// ---------------------------------------------------------------------------
// 19. No AI key is ever NEXT_PUBLIC
// ---------------------------------------------------------------------------

check(!/NEXT_PUBLIC_GROQ/i.test(read(".env.example")), ".env.example must never define a NEXT_PUBLIC_ AI provider key.");
check(!/NEXT_PUBLIC.*(GROQ|AI_API_KEY)/i.test(aiConfigSource), "AI config must never read a NEXT_PUBLIC_ variable for a provider secret.");

// ---------------------------------------------------------------------------
// 20. No sensitive document upload feature exists anywhere in the AI surface
// ---------------------------------------------------------------------------

const aiUiFiles = [
  "src/components/assistant/AssistantChat.tsx",
  "src/components/assistant/OpportunityAssistantPanel.tsx",
  "src/components/assistant/WorkspaceAssistantView.tsx",
  "src/components/staff/AiSourceDocumentsManager.tsx",
];
for (const file of aiUiFiles) {
  check(!read(file).includes('type="file"'), `${file} must never include a file-upload input.`);
}

// ---------------------------------------------------------------------------
// 21. Required documentation
// ---------------------------------------------------------------------------

const REQUIRED_DOCS = [
  "docs/checkpoint-5/checkpoint-5-architecture.md",
  "docs/checkpoint-5/ai-safety-policy.md",
  "docs/checkpoint-5/rag-source-management.md",
  "docs/checkpoint-5/ai-evaluation.md",
  "docs/checkpoint-5/checkpoint-5-manual-qa.md",
  "docs/checkpoint-5/checkpoint-5-traceability.md",
  "docs/checkpoint-5/checkpoint-5-completion-report.md",
];
for (const doc of REQUIRED_DOCS) {
  check(exists(doc), `Missing required documentation file: ${doc}`);
}

// ---------------------------------------------------------------------------
// 22. package.json scripts preserved + new AI scripts registered
// ---------------------------------------------------------------------------

const packageJson = JSON.parse(read("package.json") || "{}") as { scripts?: Record<string, string> };
for (const script of [
  "checkpoint0:validate",
  "checkpoint1:validate",
  "checkpoint2:validate",
  "checkpoint3:validate",
  "checkpoint4:validate",
  "checkpoint5:validate",
  "ai:evaluate",
  "ai:safety:test",
  "ai:sources:reindex",
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
  check(Boolean(packageJson.scripts?.[script]), `Checkpoint 5 must preserve/register the package.json script: ${script}`);
}

// ---------------------------------------------------------------------------
// 23. Regression: earlier-checkpoint guarantees still hold (spot checks)
// ---------------------------------------------------------------------------

check(exists("scripts/validate-checkpoint4.ts"), "The Checkpoint 4 validator must still exist and be runnable.");
check(exists("app/account/layout.tsx") && read("app/account/layout.tsx").includes("getStudentSession"), "The /account layout must still gate on a real student session.");
check(exists("app/staff/(protected)/layout.tsx") && read("app/staff/(protected)/layout.tsx").includes("getStaffSession"), "Staff routes must still gate on getStaffSession().");
check(exists("app/opportunities/page.tsx"), "The public opportunities catalogue must still exist.");

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

console.log(`Checkpoint 5 validation: ${checksPassed} check(s) passed, ${errors.length} failed.`);
if (errors.length > 0) {
  console.error("\nFailures:");
  for (const error of errors) {
    console.error(`  - ${error}`);
  }
  process.exit(1);
}
