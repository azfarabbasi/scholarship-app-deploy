/**
 * Checkpoint 6: `npm run perf:audit`.
 *
 * A pragmatic, dependency-free performance budget rather than a full
 * bundle-analyzer integration (justified per PROJECT_RULES.md's "don't add
 * heavy tooling unless justified" — see docs/checkpoint-6/checkpoint-6-architecture.md
 * for the reasoning). Next.js 16's Turbopack production build no longer
 * prints a per-route size table to stdout the way the older webpack builder
 * did, so this script measures the real, authoritative artifact instead:
 * every JS chunk actually written to `.next/static/chunks`. Budgets below
 * were calibrated against this app's actual current output (~2.3 MB total
 * across ~60 chunks, largest ~280 KB) with real headroom for growth — not
 * picked arbitrarily.
 *
 * Set PERF_AUDIT_SKIP_BUILD=1 to measure an already-built `.next` directory
 * (e.g. right after `npm run build` in the same CI job) instead of rebuilding.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const CHUNKS_DIR = path.join(root, ".next/static/chunks");

/** Generous headroom above the current largest real chunk (~280 KB) — flags a genuinely runaway single bundle, not routine growth. */
const MAX_SINGLE_CHUNK_BYTES = 400 * 1024;
/** Generous headroom above the current real total (~2.3 MB) — flags a major regression (e.g. an accidentally-bundled heavy dependency), not routine growth. */
const MAX_TOTAL_BYTES = 4 * 1024 * 1024;

function formatKb(bytes: number): string {
  return `${(bytes / 1024).toFixed(1)} kB`;
}

if (!process.env.PERF_AUDIT_SKIP_BUILD) {
  console.log("perf:audit: running a production build to measure real output (set PERF_AUDIT_SKIP_BUILD=1 to reuse an existing .next build)...");
  execFileSync("npx", ["next", "build"], {
    cwd: root,
    stdio: "inherit",
    env: { ...process.env, NODE_ENV: "production" },
  });
}

if (!existsSync(CHUNKS_DIR)) {
  console.error(`perf:audit: ${CHUNKS_DIR} does not exist — the production build did not produce client chunks as expected.`);
  process.exit(1);
}

function collectJsFiles(dir: string, out: string[]): void {
  for (const entry of readdirSync(dir)) {
    const fullPath = path.join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      collectJsFiles(fullPath, out);
    } else if (entry.endsWith(".js")) {
      out.push(fullPath);
    }
  }
}

const files: string[] = [];
collectJsFiles(CHUNKS_DIR, files);

const sized = files
  .map((file) => ({ file: path.relative(root, file), bytes: statSync(file).size }))
  .sort((a, b) => b.bytes - a.bytes);

const totalBytes = sized.reduce((sum, f) => sum + f.bytes, 0);

console.log(`\nperf:audit: ${sized.length} client JS chunk(s), ${formatKb(totalBytes)} total.\n`);
console.log("Largest chunks:");
for (const entry of sized.slice(0, 10)) {
  console.log(`  ${formatKb(entry.bytes).padStart(10)}  ${entry.file}`);
}

const errors: string[] = [];
const oversizedChunks = sized.filter((entry) => entry.bytes > MAX_SINGLE_CHUNK_BYTES);
for (const entry of oversizedChunks) {
  errors.push(`${entry.file} is ${formatKb(entry.bytes)}, exceeding the ${formatKb(MAX_SINGLE_CHUNK_BYTES)} per-chunk budget.`);
}
if (totalBytes > MAX_TOTAL_BYTES) {
  errors.push(`Total client JS is ${formatKb(totalBytes)}, exceeding the ${formatKb(MAX_TOTAL_BYTES)} total budget.`);
}

console.log(`\nBudgets: per-chunk ${formatKb(MAX_SINGLE_CHUNK_BYTES)}, total ${formatKb(MAX_TOTAL_BYTES)}.`);

if (errors.length > 0) {
  console.error(`\nperf:audit found ${errors.length} budget violation(s):\n`);
  for (const error of errors) {
    console.error(`  - ${error}`);
  }
  console.error("\nIf this growth is expected and reviewed, raise the relevant constant in scripts/perf-audit.ts with a comment explaining why.");
  process.exit(1);
}

console.log("\nperf:audit: all chunks within budget.");
