/**
 * Checkpoint 6: `npm run security:secrets`.
 *
 * A deliberately narrow, low-false-positive scanner for specific SHAPES of
 * value that are almost never legitimate to commit — a real Supabase secret
 * key, a legacy Supabase JWT, a Groq API key, a PEM private key block, or a
 * PostgreSQL connection string with embedded non-placeholder credentials —
 * rather than a generic "looks like a long random string near the word
 * SECRET" heuristic, which would constantly flag safe, documented constants
 * such as `src/lib/ai/rate-limit/guest.ts`'s local-only fallback signing
 * secret. This is a repository safety net, not a security product; it
 * complements (never replaces) `.gitignore` and code review.
 *
 * Also verifies the structural guarantees the rest of Checkpoint 6 depends
 * on: `.env`/`.env.local`/`.env*.local` stay git-ignored, `.env.example`
 * warns against real secrets, and no `NEXT_PUBLIC_` variable name anywhere
 * in the repository looks like it is meant to carry a secret.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const findings: string[] = [];
let filesScanned = 0;

const IGNORED_DIR_NAMES = new Set([
  "node_modules",
  ".git",
  ".next",
  "coverage",
  "playwright-report",
  "test-results",
  ".turbo",
  ".vercel",
]);

const SCAN_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".json",
  ".md",
  ".mdx",
  ".yml",
  ".yaml",
  ".sql",
  ".example",
  ".txt",
]);

/**
 * Real local `.env`/`.env.local`/`.env*.local` files are EXPECTED to hold a
 * developer's genuine credentials — that is their entire purpose — and
 * `.gitignore` (checked separately below) is what actually keeps them out of
 * the repository. Scanning their contents for "secret-shaped values" would
 * just flag a developer's own correctly-configured local environment, so
 * they are deliberately excluded from the content scan (unlike
 * `.env.example`, which must only ever contain placeholders and stays in
 * scope). Validator scripts (this file and `validate-checkpoint*.ts`) are
 * also excluded from the NEXT_PUBLIC_-name check, since their entire job is
 * to reference forbidden variable-name patterns as negative assertions.
 */
function isEnvLocalFile(relativePath: string): boolean {
  const base = path.basename(relativePath);
  return base === ".env" || base === ".env.local" || (base.startsWith(".env.") && base.endsWith(".local"));
}

/** Committed, documented, local-only Docker Postgres credentials — not a real secret. See docker-compose.yml. */
const KNOWN_SAFE_SUBSTRINGS = [
  "scholartrack_dev_password",
  "scholartrack_test_password",
  "not-for-production",
  "local-fallback",
  "__REPLACE_WITH_",
  "your-project-ref",
  "example.com",
  ":PASSWORD@", // docs/checkpoint-2/supabase-setup.md's illustrative connection-string shape
  "abcdefghijklmnopqrstuvwxyz1234567890", // deliberately fake test fixture values (e.g. tests/unit/ai-safety.test.ts)
  "postgres://ci:ci@localhost", // .github/workflows/ci.yml's throwaway placeholder, satisfying drizzle.config.ts's presence check only — never a real database
];

interface SecretPattern {
  name: string;
  regex: RegExp;
}

const SECRET_PATTERNS: SecretPattern[] = [
  { name: "Supabase secret key (sb_secret_...)", regex: /\bsb_secret_[A-Za-z0-9_-]{10,}\b/g },
  {
    name: "Legacy Supabase/JWT-shaped token",
    regex: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g,
  },
  { name: "Groq API key (gsk_...)", regex: /\bgsk_[A-Za-z0-9]{20,}\b/g },
  { name: "PEM private key block", regex: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g },
  {
    name: "PostgreSQL connection string with embedded credentials",
    regex: /postgres(?:ql)?:\/\/[^:\s/'"]+:[^@\s'"]+@[^\s'"/]+/g,
  },
];

function isIgnoredDir(name: string): boolean {
  return IGNORED_DIR_NAMES.has(name);
}

function shouldScanFile(filePath: string): boolean {
  const ext = path.extname(filePath);
  return SCAN_EXTENSIONS.has(ext) || path.basename(filePath).startsWith(".env");
}

function walk(dir: string, files: string[]): void {
  for (const entry of readdirSync(dir)) {
    if (isIgnoredDir(entry)) continue;
    const fullPath = path.join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      walk(fullPath, files);
    } else if (stat.isFile() && shouldScanFile(fullPath)) {
      files.push(fullPath);
    }
  }
}

function containsSafeMarker(matchedText: string, line: string): boolean {
  return KNOWN_SAFE_SUBSTRINGS.some((safe) => matchedText.includes(safe) || line.includes(safe));
}

/**
 * Prefer git's own view of "what would actually be committed" (tracked +
 * untracked-but-not-ignored) over a raw filesystem walk — this is what
 * makes scanning genuinely safe to run against a developer's real working
 * tree: a real `.env`/`.env.local` full of live credentials is `git
 * check-ignore`d and simply never reaches the scan, no allowlisting needed.
 * Falls back to a full filesystem walk (still skipping `isEnvLocalFile`
 * explicitly) if this isn't a git repository at all.
 */
function listCandidateFiles(): string[] {
  try {
    const output = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard"], {
      cwd: root,
      encoding: "utf8",
    });
    return output
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((relativePath) => path.join(root, relativePath))
      .filter((fullPath) => existsSync(fullPath) && statSync(fullPath).isFile() && shouldScanFile(fullPath));
  } catch {
    const files: string[] = [];
    walk(root, files);
    return files;
  }
}

const allFiles: string[] = listCandidateFiles();

for (const filePath of allFiles) {
  const relativePath = path.relative(root, filePath).split(path.sep).join("/");
  if (isEnvLocalFile(relativePath)) continue;
  const contents = readFileSync(filePath, "utf8");
  filesScanned += 1;

  const lines = contents.split("\n");
  for (const pattern of SECRET_PATTERNS) {
    pattern.regex.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.regex.exec(contents)) !== null) {
      const upToMatch = contents.slice(0, match.index);
      const lineNumber = upToMatch.split("\n").length;
      const line = lines[lineNumber - 1] ?? "";
      if (containsSafeMarker(match[0], line)) continue;
      findings.push(`${relativePath}:${lineNumber} — possible ${pattern.name}: "${match[0].slice(0, 24)}…"`);
    }
  }

  // "No secret key may use NEXT_PUBLIC" — a NEXT_PUBLIC_ variable name that
  // itself contains SECRET/PRIVATE/PASSWORD, or ends in _KEY/_TOKEN outside
  // the specific, documented, genuinely-public exceptions below.
  const PUBLIC_SAFE_KEY_NAMES = new Set([
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    "NEXT_PUBLIC_ADSENSE_CLIENT_ID",
    "NEXT_PUBLIC_CLOUDFLARE_WEB_ANALYTICS_TOKEN",
    "NEXT_PUBLIC_VAPID_PUBLIC_KEY",
  ]);
  const isValidatorScript = /^scripts\/(validate-checkpoint\d+|security-secrets-scan)\.ts$/.test(relativePath);
  const nextPublicNameRegex = /\bNEXT_PUBLIC_[A-Z0-9_]*(?:SECRET|PRIVATE|PASSWORD|_KEY|_TOKEN)[A-Z0-9_]*\b/g;
  let publicMatch: RegExpExecArray | null;
  while (!isValidatorScript && (publicMatch = nextPublicNameRegex.exec(contents)) !== null) {
    const name = publicMatch[0];
    if (PUBLIC_SAFE_KEY_NAMES.has(name)) continue;
    if (name.includes("VAPID_PRIVATE_KEY")) continue; // NEXT_PUBLIC_VAPID_PUBLIC_KEY only; the private one never carries the prefix.
    const upToMatch = contents.slice(0, publicMatch.index);
    const lineNumber = upToMatch.split("\n").length;
    findings.push(
      `${relativePath}:${lineNumber} — "${name}" looks like a secret but is prefixed NEXT_PUBLIC_ (would ship to the browser).`,
    );
  }
}

// ---------------------------------------------------------------------------
// Structural checks
// ---------------------------------------------------------------------------

const gitignore = existsSync(path.join(root, ".gitignore")) ? readFileSync(path.join(root, ".gitignore"), "utf8") : "";
for (const pattern of [".env", ".env.local", ".env*.local"]) {
  if (!gitignore.includes(pattern)) {
    findings.push(`.gitignore does not list "${pattern}" — local environment files could be committed by accident.`);
  }
}

const envExample = existsSync(path.join(root, ".env.example"))
  ? readFileSync(path.join(root, ".env.example"), "utf8")
  : "";
if (!/never commit/i.test(envExample)) {
  findings.push(".env.example is missing an explicit \"never commit real credentials/secrets\" warning comment.");
}

// Belt-and-suspenders on top of the .gitignore text check above: ask git
// directly whether it is actually tracking any real local environment file.
try {
  const tracked = execFileSync("git", ["ls-files", ".env", ".env.local", ".env.development.local", ".env.production.local"], {
    cwd: root,
    encoding: "utf8",
  })
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  for (const trackedFile of tracked) {
    findings.push(`"${trackedFile}" is tracked by git — a real local environment file must never be committed.`);
  }
} catch {
  // Not a git repository at all — nothing to check here; the .gitignore text check above still applies.
}

console.log(`Scanned ${filesScanned} files across the repository (excluding node_modules/.next/coverage/etc.).`);

if (findings.length > 0) {
  console.error(`\nsecurity:secrets found ${findings.length} issue(s):\n`);
  for (const finding of findings) {
    console.error(`  - ${finding}`);
  }
  console.error("\nIf a finding is a false positive for a genuinely safe, documented value, add its distinguishing");
  console.error("substring to KNOWN_SAFE_SUBSTRINGS in scripts/security-secrets-scan.ts with a comment explaining why.");
  process.exit(1);
}

console.log("security:secrets: no risky secret-shaped values found. Structural .gitignore/.env.example checks passed.");
