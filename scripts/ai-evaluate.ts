/**
 * `npm run ai:evaluate` — runs the full Checkpoint 5 evaluation fixture set
 * (`src/lib/ai/evaluation/cases.ts`) against the mock provider and prints a
 * pass/fail report. Deliberately requires no database and no real provider
 * key: every case is self-contained, so this command works identically in
 * any environment (including CI). See `docs/checkpoint-5/ai-evaluation.md`.
 */
import { runAllEvaluationCases } from "../src/lib/ai/evaluation/harness";

async function main() {
  const summary = await runAllEvaluationCases();

  console.log(`AI evaluation: ${summary.passed}/${summary.total} passed.\n`);

  for (const result of summary.results) {
    const marker = result.passed ? "PASS" : "FAIL";
    console.log(`[${marker}] ${result.key} — ${result.description}`);
    if (!result.passed) {
      for (const failure of result.failures) {
        console.log(`       - ${failure.check}: ${failure.detail}`);
      }
    }
  }

  if (summary.failed > 0) {
    console.error(`\n${summary.failed} evaluation case(s) failed.`);
    process.exit(1);
  }

  console.log("\nAll evaluation cases passed.");
}

main().catch((error: unknown) => {
  console.error("ai:evaluate failed:", error);
  process.exit(1);
});
