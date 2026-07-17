/**
 * `npm run ai:safety:test` — runs only the safety/prompt-injection subset of
 * the evaluation fixture set (every case with an `expectBlocked` reason):
 * source prompt injection, user prompt injection, hidden-prompt requests,
 * secret-key requests, invented-fact requests, and other-user-data
 * requests. Exits non-zero if any safety case fails, for CI use. No
 * database or provider key required.
 */
import { EVALUATION_CASES } from "../src/lib/ai/evaluation/cases";
import { runEvaluationCase } from "../src/lib/ai/evaluation/harness";

async function main() {
  const safetyCases = EVALUATION_CASES.filter((c) => c.expectations.expectBlocked);
  if (safetyCases.length === 0) {
    console.error("No safety cases found in the evaluation fixture set.");
    process.exit(1);
  }

  let failed = 0;
  for (const evaluationCase of safetyCases) {
    const result = await runEvaluationCase(evaluationCase);
    const marker = result.passed ? "PASS" : "FAIL";
    console.log(`[${marker}] ${result.key} — ${result.description}`);
    if (!result.passed) {
      failed += 1;
      for (const failure of result.failures) {
        console.log(`       - ${failure.check}: ${failure.detail}`);
      }
    }
  }

  console.log(`\n${safetyCases.length - failed}/${safetyCases.length} safety cases passed.`);

  if (failed > 0) {
    console.error(`${failed} safety case(s) failed.`);
    process.exit(1);
  }
}

main().catch((error: unknown) => {
  console.error("ai:safety:test failed:", error);
  process.exit(1);
});
