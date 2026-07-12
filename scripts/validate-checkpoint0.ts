import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import ts from "typescript";

import {
  DATA_CLASSIFICATIONS,
  DOMAIN_ENTITY_NAMES,
  PLATFORM_ROLES,
} from "../src/lib/domain/index";

const root = process.cwd();
const errors: string[] = [];
let checksPassed = 0;

const EXPECTED_ROLES = [
  "Guest",
  "Student",
  "Reviewer",
  "Senior Reviewer",
  "Administrator",
  "System Service",
] as const;

const EXPECTED_CLASSIFICATIONS = [
  "Public",
  "Internal",
  "Private user data",
  "Sensitive personal metadata",
  "Restricted operational data",
  "Prohibited Year 1 data",
] as const;

const EXPECTED_ENTITIES = [
  "Opportunity",
  "OpportunityType",
  "Provider",
  "Organisation",
  "Country",
  "Region",
  "StudyLevel",
  "FieldOfStudy",
  "FundingType",
  "FundingBenefit",
  "EligibilityRule",
  "EligibilityRuleGroup",
  "Deadline",
  "DeadlineCycle",
  "Intake",
  "OfficialSource",
  "VerificationRecord",
  "SourceEvidence",
  "RequiredDocumentTemplate",
  "OpportunityDocumentRequirement",
  "UserAccount",
  "UserProfile",
  "EducationRecord",
  "WorkExperienceRecord",
  "ResearchExperienceRecord",
  "PublicationRecord",
  "CertificationRecord",
  "LanguageTestRecord",
  "UserPreference",
  "SavedOpportunity",
  "ApplicationTracker",
  "ApplicationStage",
  "ApplicationActivity",
  "UserNote",
  "UserTask",
  "MasterDocumentRecord",
  "ApplicationDocumentProgress",
  "Reminder",
  "NotificationPreference",
  "CorrectionReport",
  "ReviewAssignment",
  "AuditLog",
  "AIInteractionRecord",
  "AIUsageQuota",
  "FeatureFlag",
  "AdvertisementPlacement",
  "SponsoredOpportunityDisclosure",
] as const;

const ADR_FILES = [
  "ADR-001-read-only-prototype-and-production-codebase.md",
  "ADR-002-guest-first-optional-accounts.md",
  "ADR-003-no-sensitive-file-storage-year-one.md",
  "ADR-004-deterministic-eligibility-before-ai.md",
  "ADR-005-official-source-verification-first.md",
  "ADR-006-postgresql-relational-domain-model.md",
  "ADR-007-docker-first-development.md",
  "ADR-008-free-first-infrastructure-budget.md",
  "ADR-009-pwa-before-native-mobile.md",
  "ADR-010-human-approval-for-ai-extracted-data.md",
] as const;

const DOMAIN_MODULES = [
  "common.ts",
  "deadlines.ts",
  "opportunity.ts",
  "provider.ts",
  "eligibility.ts",
  "verification.ts",
  "documents.ts",
  "user-profile.ts",
  "application-tracking.ts",
  "notifications.ts",
  "administration.ts",
  "ai.ts",
  "index.ts",
] as const;

const CHECKPOINT_DOCUMENTS = [
  "baseline-audit.md",
  "feature-inventory.md",
  "dataset-inventory.md",
  "migration-dataset-report.md",
  "deadline-intelligence-spec.md",
  "deadline-audit-report.md",
  "domain-model-spec.md",
  "domain-model.mmd",
  "roles-and-permissions.md",
  "privacy-boundary.md",
  "data-ownership-and-deletion.md",
  "v1-product-backlog.md",
  "checkpoint-acceptance-criteria.md",
  "roadmap-traceability.md",
  "checkpoint-0-completion-report.md",
] as const;

const REQUIRED_FILES = [
  "PROJECT_RULES.md",
  "README.md",
  "Dockerfile",
  "docker-compose.yml",
  ".dockerignore",
  ".env.example",
  "package.json",
  "data/migrations/v0.1/scholarships.seed.json",
  "data/migrations/v0.1/scholarships.seed.csv",
  "data/test-scenarios/deadline-scenarios.json",
  "src/lib/schemas/opportunity-seed.ts",
  "scripts/validate-opportunity-seed.ts",
  "scripts/audit-deadlines.ts",
  "scripts/validate-checkpoint0.ts",
  ...CHECKPOINT_DOCUMENTS.map((name) => `docs/checkpoint-0/${name}`),
  ...ADR_FILES.map((name) => `docs/adr/${name}`),
  ...DOMAIN_MODULES.map((name) => `src/lib/domain/${name}`),
] as const;

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

function duplicates(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const repeated = new Set<string>();

  for (const value of values) {
    if (seen.has(value)) {
      repeated.add(value);
    }
    seen.add(value);
  }

  return [...repeated];
}

function checkExactSet(
  label: string,
  actual: readonly string[],
  expected: readonly string[],
): void {
  const actualSet = new Set(actual);
  const expectedSet = new Set(expected);
  const missing = expected.filter((value) => !actualSet.has(value));
  const unexpected = actual.filter((value) => !expectedSet.has(value));

  check(
    missing.length === 0 && unexpected.length === 0,
    `${label} differs from the required set (missing: ${missing.join(", ") || "none"}; unexpected: ${unexpected.join(", ") || "none"}).`,
  );
}

for (const relativePath of REQUIRED_FILES) {
  check(existsSync(path.join(root, relativePath)), `Missing required file: ${relativePath}`);
}

check(duplicates(PLATFORM_ROLES).length === 0, "PLATFORM_ROLES contains duplicate names.");
checkExactSet("PLATFORM_ROLES", PLATFORM_ROLES, EXPECTED_ROLES);
check(
  duplicates(DATA_CLASSIFICATIONS).length === 0,
  "DATA_CLASSIFICATIONS contains duplicate names.",
);
checkExactSet(
  "DATA_CLASSIFICATIONS",
  DATA_CLASSIFICATIONS,
  EXPECTED_CLASSIFICATIONS,
);
check(
  duplicates(DOMAIN_ENTITY_NAMES).length === 0,
  "DOMAIN_ENTITY_NAMES contains duplicate names.",
);
checkExactSet("DOMAIN_ENTITY_NAMES", DOMAIN_ENTITY_NAMES, EXPECTED_ENTITIES);
check(DOMAIN_ENTITY_NAMES.length === 47, "DOMAIN_ENTITY_NAMES must contain exactly 47 entities.");

const domainDirectory = path.join(root, "src/lib/domain");
const domainPaths = DOMAIN_MODULES.map((name) => path.join(domainDirectory, name));
const tsconfigPath = path.join(root, "tsconfig.json");
const configResult = ts.readConfigFile(tsconfigPath, ts.sys.readFile);

if (configResult.error) {
  errors.push(
    `Unable to read tsconfig.json: ${ts.flattenDiagnosticMessageText(configResult.error.messageText, " ")}`,
  );
} else {
  const parsedConfig = ts.parseJsonConfigFileContent(
    configResult.config,
    ts.sys,
    root,
    { incremental: false, noEmit: true, tsBuildInfoFile: undefined },
    tsconfigPath,
  );
  const program = ts.createProgram({
    rootNames: domainPaths,
    options: parsedConfig.options,
  });
  const diagnostics = [
    ...parsedConfig.errors,
    ...ts.getPreEmitDiagnostics(program),
  ];

  check(
    diagnostics.length === 0,
    diagnostics.length === 0
      ? "Domain modules compile."
      : `Domain modules do not compile:\n${ts.formatDiagnosticsWithColorAndContext(diagnostics, {
          getCanonicalFileName: (fileName) => fileName,
          getCurrentDirectory: () => root,
          getNewLine: () => "\n",
        })}`,
  );

  const exportedDomainTypes = new Set<string>();
  for (const sourceFile of program.getSourceFiles()) {
    if (!sourceFile.fileName.startsWith(domainDirectory) || sourceFile.isDeclarationFile) {
      continue;
    }

    for (const statement of sourceFile.statements) {
      const statementModifiers = ts.canHaveModifiers(statement)
        ? ts.getModifiers(statement)
        : undefined;
      const hasExportModifier = statementModifiers?.some(
        (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword,
      );
      if (
        hasExportModifier &&
        (ts.isInterfaceDeclaration(statement) || ts.isTypeAliasDeclaration(statement))
      ) {
        exportedDomainTypes.add(statement.name.text);
      }
    }
  }

  const missingDomainTypes = EXPECTED_ENTITIES.filter(
    (entity) => !exportedDomainTypes.has(entity),
  );
  check(
    missingDomainTypes.length === 0,
    `No exported TypeScript contract was found for: ${missingDomainTypes.join(", ")}.`,
  );
}

const roleDocument = read("docs/checkpoint-0/roles-and-permissions.md");
const documentedRoles = [...roleDocument.matchAll(/^###\s+\d+\.\s+(.+?)\s*$/gm)].map(
  (match) => match[1],
);
check(duplicates(documentedRoles).length === 0, "roles-and-permissions.md contains duplicate role names.");
checkExactSet("Documented roles", documentedRoles, EXPECTED_ROLES);

const permissionSection = roleDocument.match(
  /## Permission matrix\s*([\s\S]*?)(?=\n## )/,
)?.[1];
const permissionRows = (permissionSection ?? "")
  .split(/\r?\n/)
  .filter((line) => /^\|.*\|$/.test(line.trim()) && !/^\|\s*-/.test(line.trim()))
  .slice(1);
check(permissionRows.length === 25, `Permission matrix must contain 25 capabilities; found ${permissionRows.length}.`);
for (const role of EXPECTED_ROLES) {
  check(
    permissionSection?.includes(`| ${role} |`) ?? false,
    `Permission matrix is missing the ${role} column.`,
  );
}

const privacyDocument = read("docs/checkpoint-0/privacy-boundary.md");
const documentedClassifications = [
  ...privacyDocument.matchAll(/^###\s+\d+\.\s+(.+?)\s*$/gm),
].map((match) => match[1]);
check(
  duplicates(documentedClassifications).length === 0,
  "privacy-boundary.md contains duplicate classification names.",
);
checkExactSet(
  "Documented data classifications",
  documentedClassifications,
  EXPECTED_CLASSIFICATIONS,
);

const PRIVACY_ITEMS = [
  "Opportunity records",
  "Official sources",
  "Verification history",
  "Reviewer notes",
  "Nationality",
  "Residence",
  "Province and domicile",
  "CGPA",
  "Graduation date",
  "Work experience",
  "Research experience",
  "Publications",
  "Language-test status",
  "Shortlist",
  "Notes",
  "Application progress",
  "Document-readiness metadata",
  "Referee contact details",
  "Notifications",
  "Logs",
  "Analytics",
  "AI prompts and responses",
  "API keys",
  "Passwords",
  "Passports",
  "Transcripts",
  "Certificates",
  "Financial documents",
] as const;

for (const item of PRIVACY_ITEMS) {
  check(
    privacyDocument.includes(`| ${item} |`),
    `Privacy classification register is missing: ${item}.`,
  );
}

for (const phrase of [
  "passport files or images",
  "transcript files or images",
  "certificate files or images",
  "bank statements",
  "permanently deletable",
]) {
  check(
    privacyDocument.toLowerCase().includes(phrase),
    `Privacy boundary is missing the required rule containing: ${phrase}.`,
  );
}
check(
  /guest[\s\S]{0,100}(?:remain|leaves?)[\s\S]{0,40}(?:browser-)?local/i.test(
    privacyDocument,
  ),
  "Privacy boundary must keep guest data local until confirmed migration.",
);
check(
  /(?:must not sell student data|student data[\s\S]{0,40}must not be sold)/i.test(
    privacyDocument,
  ),
  "Privacy boundary must prohibit selling student data.",
);

const ownershipDocument = read("docs/checkpoint-0/data-ownership-and-deletion.md");
const OWNERSHIP_CATEGORIES = [
  "Guest local data",
  "Registered student data",
  "Public opportunity data",
  "Archived opportunity data",
  "Correction reports",
  "Reviewer work",
  "Audit logs",
  "AI interaction records",
  "Analytics events",
  "Advertising events",
] as const;
for (const category of OWNERSHIP_CATEGORIES) {
  check(
    ownershipDocument.includes(`### ${category}`) || ownershipDocument.includes(`| ${category} |`),
    `Ownership/deletion policy is missing: ${category}.`,
  );
}

const domainSpecification = read("docs/checkpoint-0/domain-model-spec.md");
const entityMatches = [
  ...domainSpecification.matchAll(/^###\s+(\d+)\.\s+(.+?)\s*$/gm),
];
const documentedEntities = entityMatches.map((match) => match[2]);
check(duplicates(documentedEntities).length === 0, "domain-model-spec.md contains duplicate entity names.");
checkExactSet("Documented domain entities", documentedEntities, EXPECTED_ENTITIES);
check(documentedEntities.length === 47, `Domain specification must define 47 entities; found ${documentedEntities.length}.`);

const REQUIRED_ENTITY_FIELDS = [
  "Purpose",
  "Ownership",
  "Classification",
  "Important identifiers",
  "Important fields",
  "Required relationships",
  "Optional relationships",
  "Lifecycle states",
  "Audit requirements",
  "Deletion behavior",
  "Year 1 status",
] as const;

for (const [index, match] of entityMatches.entries()) {
  const sectionEnd = entityMatches[index + 1]?.index ?? domainSpecification.length;
  const section = domainSpecification.slice(match.index, sectionEnd);
  const entityName = match[2];

  for (const field of REQUIRED_ENTITY_FIELDS) {
    check(
      section.includes(`**${field}:**`),
      `${entityName} is missing its ${field} definition.`,
    );
  }

  const classification = section.match(/\*\*Classification:\*\*\s+`([^`]+)`/)?.[1];
  check(
    classification !== undefined && EXPECTED_CLASSIFICATIONS.includes(
      classification as (typeof EXPECTED_CLASSIFICATIONS)[number],
    ),
    `${entityName} has a missing or invalid classification: ${classification ?? "missing"}.`,
  );

  const yearOneStatus = section.match(/\*\*Year 1 status:\*\*\s+`([^`]+)`/)?.[1];
  check(
    yearOneStatus === "required immediately" ||
      yearOneStatus === "required later in Year 1" ||
      yearOneStatus === "deferred beyond Year 1",
    `${entityName} has a missing or invalid Year 1 status: ${yearOneStatus ?? "missing"}.`,
  );
}

const deadlineTypeNames = [
  "DeadlinePrecision",
  "DeadlineLifecycleStatus",
  "DeadlineVerificationStatus",
  "DeadlineCycle",
  "DeadlineOccurrence",
  "DeadlineSource",
  "DeadlineDisplayState",
] as const;
const nonDeadlineModules = DOMAIN_MODULES.filter(
  (name) => name !== "deadlines.ts" && name !== "index.ts",
);
for (const moduleName of nonDeadlineModules) {
  const source = read(`src/lib/domain/${moduleName}`);
  for (const typeName of deadlineTypeNames) {
    check(
      !new RegExp(`export\\s+(?:interface|type|enum|class|const)\\s+${typeName}\\b`).test(source),
      `${moduleName} redefines canonical deadline contract ${typeName}.`,
    );
  }
}

const opportunityContracts = read("src/lib/domain/opportunity.ts");
check(
  /import type \{[\s\S]*?DeadlineOccurrence[\s\S]*?\} from "\.\/deadlines";/.test(
    opportunityContracts,
  ),
  "opportunity.ts must import DeadlineOccurrence from deadlines.ts.",
);
check(
  /export type Deadline = DeadlineOccurrence;/.test(opportunityContracts),
  "The commercial Deadline entity must alias the canonical DeadlineOccurrence contract.",
);
check(
  !/OpportunityDeadlineCycle/.test(opportunityContracts),
  "opportunity.ts must not create a duplicate alias for canonical DeadlineCycle.",
);
const deadlineContracts = read("src/lib/domain/deadlines.ts");
check(
  deadlineContracts.includes("export type DeadlineOccurrence =") &&
    deadlineContracts.includes("openingBoundary:") &&
    deadlineContracts.includes("closingBoundary:"),
  "DeadlineOccurrence must retain opening and closing boundaries as separate facts.",
);
check(
  !/DeadlineOccurrenceFields[\s\S]*?lifecycleStatus[\s\S]*?export type DeadlineOccurrence/.test(
    deadlineContracts,
  ),
  "DeadlineOccurrence must not persist derived lifecycleStatus.",
);
check(
  /precision: "rolling" \| "unknown";\s*openingBoundary: null;\s*closingBoundary: null;/.test(
    deadlineContracts,
  ),
  "Rolling and unknown deadline occurrences must be structurally undated.",
);
check(
  /verificationStatus: "verified";\s*lastCheckedAt: DeadlineDateTime;/.test(
    deadlineContracts,
  ),
  "Verified deadline sources must require a last-checked timestamp.",
);
check(
  read("src/lib/domain/index.ts").includes('export * from "./deadlines";'),
  "The domain barrel must export the canonical deadline contracts.",
);

const mermaid = read("docs/checkpoint-0/domain-model.mmd");
check(/^erDiagram\s*$/m.test(mermaid), "domain-model.mmd must use Mermaid erDiagram syntax.");
check(
  !/(?:<[^>]+>|classDef\b|\bstyle\s+|%%\{)/i.test(mermaid),
  "domain-model.mmd contains unsupported HTML, styling, or directives.",
);
const mermaidBlocks = [...mermaid.matchAll(/^\s{4}([A-Z][A-Z0-9_]*) \{$/gm)].map(
  (match) => match[1],
);
check(duplicates(mermaidBlocks).length === 0, "domain-model.mmd contains duplicate entity blocks.");
const REQUIRED_MERMAID_ENTITIES = [
  "OPPORTUNITY",
  "PROVIDER",
  "OPPORTUNITY_TYPE",
  "DEADLINE",
  "DEADLINE_CYCLE",
  "INTAKE",
  "ELIGIBILITY_RULE",
  "OFFICIAL_SOURCE",
  "VERIFICATION_RECORD",
  "REQUIRED_DOCUMENT_TEMPLATE",
  "USER_ACCOUNT",
  "USER_PROFILE",
  "SAVED_OPPORTUNITY",
  "APPLICATION_TRACKER",
  "APPLICATION_ACTIVITY",
  "MASTER_DOCUMENT_RECORD",
  "APPLICATION_DOCUMENT_PROGRESS",
  "REMINDER",
  "CORRECTION_REPORT",
  "REVIEW_ASSIGNMENT",
  "AUDIT_LOG",
  "AI_INTERACTION_RECORD",
] as const;
for (const entity of REQUIRED_MERMAID_ENTITIES) {
  check(mermaidBlocks.includes(entity), `domain-model.mmd is missing entity block ${entity}.`);
}
const relationshipMatches = [
  ...mermaid.matchAll(
    /^\s{4}([A-Z][A-Z0-9_]*)\s+[|}{o]+--[|}{o]+\s+([A-Z][A-Z0-9_]*)\s+:\s+\S+/gm,
  ),
];
for (const relationship of relationshipMatches) {
  check(
    mermaidBlocks.includes(relationship[1]) && mermaidBlocks.includes(relationship[2]),
    `Mermaid relationship uses an undefined entity: ${relationship[1]} -> ${relationship[2]}.`,
  );
}
check(relationshipMatches.length >= 30, `ERD should contain at least 30 major relationships; found ${relationshipMatches.length}.`);

for (const adrFile of ADR_FILES) {
  const adr = read(`docs/adr/${adrFile}`);
  for (const section of [
    "Status",
    "Context",
    "Decision",
    "Consequences",
    "Alternatives considered",
  ]) {
    const present =
      section === "Status"
        ? /\*\*Status:\*\*\s+\S+/.test(adr)
        : new RegExp(`^## ${section}$`, "m").test(adr);
    check(present, `${adrFile} is missing its ${section} section.`);
  }
}
const adrDirectoryEntries = existsSync(path.join(root, "docs/adr"))
  ? readdirSync(path.join(root, "docs/adr")).filter((name) => /^ADR-\d{3}.*\.md$/.test(name))
  : [];
checkExactSet("Checkpoint 0 ADR filenames", adrDirectoryEntries, ADR_FILES);

interface BacklogItem {
  id: string;
  checkpoint: number;
  title: string;
  section: string;
  priority: string;
  deferredStatus: string;
}

const backlog = read("docs/checkpoint-0/v1-product-backlog.md");
const backlogHeadingMatches = [
  ...backlog.matchAll(/^###\s+(C([1-7])-\d{2})\s+[^\r\n]*?([^\r\n]*)$/gm),
];
const backlogItems: BacklogItem[] = backlogHeadingMatches.map((match, index) => {
  const sectionEnd = backlogHeadingMatches[index + 1]?.index ?? backlog.length;
  const section = backlog.slice(match.index, sectionEnd);
  const heading = match[0].replace(/^###\s+/, "");
  const title = heading
    .slice(match[1].length)
    .replace(/^[\s\u2013\u2014:-]+/, "")
    .trim();

  return {
    id: match[1],
    checkpoint: Number(match[2]),
    title,
    section,
    priority: section.match(/^- \*\*Priority:\*\*\s+(.+)$/m)?.[1].trim() ?? "",
    deferredStatus:
      section.match(/^- \*\*Deferred status:\*\*\s+(.+)$/m)?.[1].trim() ?? "",
  };
});

const backlogIds = backlogItems.map((item) => item.id);
check(backlogItems.length > 0, "No backlog items were parsed.");
check(duplicates(backlogIds).length === 0, `Backlog IDs are duplicated: ${duplicates(backlogIds).join(", ")}.`);
for (let checkpoint = 1; checkpoint <= 7; checkpoint += 1) {
  check(
    backlogItems.some((item) => item.checkpoint === checkpoint),
    `Checkpoint ${checkpoint} has no backlog items.`,
  );
}

const BACKLOG_FIELDS = [
  "Checkpoint",
  "Priority",
  "User value",
  "Dependencies",
  "Acceptance summary",
  "Security/privacy consideration",
  "Test requirement",
  "Deferred status",
] as const;
const VALID_PRIORITIES = ["Must", "Should", "Could", "Won't in Year 1"] as const;
for (const item of backlogItems) {
  for (const field of BACKLOG_FIELDS) {
    check(
      new RegExp(`^- \\*\\*${field}:\\*\\*\\s+\\S`, "m").test(item.section),
      `${item.id} is missing backlog field ${field}.`,
    );
  }
  check(
    item.section.includes(`**Checkpoint:** Checkpoint ${item.checkpoint}`),
    `${item.id} has an invalid checkpoint reference.`,
  );
  check(
    VALID_PRIORITIES.includes(item.priority as (typeof VALID_PRIORITIES)[number]),
    `${item.id} has invalid priority: ${item.priority || "missing"}.`,
  );
  check(
    item.deferredStatus === "Not deferred." ||
      item.deferredStatus === "Deferred beyond Year 1.",
    `${item.id} has invalid deferred status: ${item.deferredStatus || "missing"}.`,
  );
}

const uploadBacklogItems = backlogItems.filter((item) =>
  /(?:sensitive student document file uploads?|passport-file upload|transcript-file upload|certificate-file upload)/i.test(
    `${item.title}\n${item.section}`,
  ),
);
for (const item of uploadBacklogItems) {
  check(
    item.priority === "Won't in Year 1" &&
      item.deferredStatus === "Deferred beyond Year 1.",
    `${item.id} declares prohibited sensitive file storage as active Year 1 work.`,
  );
}
const prohibitedUploadItem = backlogItems.find((item) => item.id === "C3-07");
check(
  prohibitedUploadItem?.priority === "Won't in Year 1" &&
    prohibitedUploadItem.deferredStatus === "Deferred beyond Year 1.",
  "C3-07 must explicitly defer sensitive student document uploads beyond Year 1.",
);

const documentContracts = read("src/lib/domain/documents.ts");
const prohibitedDocumentFields = [
  "fileUrl",
  "filePath",
  "storagePath",
  "objectKey",
  "uploadKey",
  "uploadToken",
  "contentBytes",
  "base64",
  "blob",
  "binary",
  "readinessNotes",
  "issuedOn",
] as const;
for (const field of prohibitedDocumentFields) {
  check(
    !new RegExp(`\\b${field}\\b`, "i").test(documentContracts),
    `documents.ts declares prohibited Year 1 document field or payload concept: ${field}.`,
  );
}

const roadmap = read("docs/checkpoint-0/roadmap-traceability.md");
check(
  /^\| Roadmap checkpoint \|/m.test(roadmap),
  "Roadmap traceability tables must include an explicit Roadmap checkpoint column.",
);
const roadmapTableIds = roadmap
  .split(/\r?\n/)
  .filter((line) => line.trimStart().startsWith("|"))
  .flatMap((line) => [...line.matchAll(/`(C[1-7]-\d{2})`/g)].map((match) => match[1]));
const unknownRoadmapIds = roadmapTableIds.filter((id) => !backlogIds.includes(id));
check(
  unknownRoadmapIds.length === 0,
  `Roadmap references unknown backlog IDs: ${[...new Set(unknownRoadmapIds)].join(", ")}.`,
);
const missingRoadmapIds = backlogIds.filter((id) => !roadmapTableIds.includes(id));
check(
  missingRoadmapIds.length === 0,
  `Roadmap omits backlog IDs: ${missingRoadmapIds.join(", ")}.`,
);
check(
  duplicates(roadmapTableIds).length === 0,
  `Roadmap table repeats backlog IDs: ${duplicates(roadmapTableIds).join(", ")}.`,
);

const acceptance = read("docs/checkpoint-0/checkpoint-acceptance-criteria.md");
for (let checkpoint = 1; checkpoint <= 7; checkpoint += 1) {
  check(
    new RegExp(`^## Checkpoint ${checkpoint}:`, "m").test(acceptance),
    `Acceptance criteria are missing Checkpoint ${checkpoint}.`,
  );
}
const ACCEPTANCE_SECTIONS = [
  "Global definition of done",
  "Docker validation requirements",
  "Lint requirements",
  "Build requirements",
  "Test requirements",
  "Accessibility requirements",
  "Security requirements",
  "Privacy requirements",
  "Data-verification requirements",
  "Documentation requirements",
  "Git and release requirements",
  "Cost review requirements",
  "Rollback requirements",
] as const;
for (const section of ACCEPTANCE_SECTIONS) {
  check(
    new RegExp(`^## ${section}$`, "m").test(acceptance),
    `Acceptance criteria are missing section: ${section}.`,
  );
}
for (const requiredDoneStatement of [
  "works through the documented Docker workflow",
  "Lint passes",
  "production build passes",
  "Relevant unit, integration, end-to-end",
  "No critical security issue remains",
  "No unrelated regression is introduced",
  "Documentation, contracts, diagrams, runbooks",
  "official source evidence, verification status, and last-checked time",
  "Private-data and guest/account boundaries are respected",
  "cost impact is reviewed against the USD 100 ceiling",
]) {
  check(
    acceptance.includes(requiredDoneStatement),
    `Global definition of done is missing: ${requiredDoneStatement}.`,
  );
}

let seedCount = 0;
try {
  const seed = JSON.parse(read("data/migrations/v0.1/scholarships.seed.json")) as
    | unknown[]
    | { records?: unknown[] };
  const records = Array.isArray(seed) ? seed : seed.records;
  seedCount = records?.length ?? 0;
  check(seedCount === 55, `Migration dataset must contain exactly 55 records; found ${seedCount}.`);
} catch (error) {
  errors.push(
    `Migration seed JSON is invalid: ${error instanceof Error ? error.message : String(error)}`,
  );
}

const packageJson = JSON.parse(read("package.json")) as {
  scripts?: Record<string, string>;
};
check(
  packageJson.scripts?.["checkpoint0:validate"] ===
    "tsx scripts/validate-checkpoint0.ts",
  "package.json must expose checkpoint0:validate with the expected script.",
);

if (errors.length > 0) {
  console.error("Checkpoint 0 validation failed:\n");
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  console.error(`\n${checksPassed} checks passed; ${errors.length} checks failed.`);
  process.exitCode = 1;
} else {
  console.log("Checkpoint 0 validation passed.");
  console.log(`- Structural checks passed: ${checksPassed}`);
  console.log(`- Domain entities: ${DOMAIN_ENTITY_NAMES.length}`);
  console.log(`- Roles: ${PLATFORM_ROLES.length}`);
  console.log(`- Data classifications: ${DATA_CLASSIFICATIONS.length}`);
  console.log(`- ADRs: ${ADR_FILES.length}`);
  console.log(`- Backlog items: ${backlogItems.length}`);
  console.log(`- Migration records: ${seedCount}`);
}
