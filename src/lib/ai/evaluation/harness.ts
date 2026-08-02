import { MockAiProvider } from "@/lib/ai/providers/mock";
import { buildPromptMessages } from "@/lib/ai/rag/prompt";
import { buildCitations } from "@/lib/ai/rag/citations";
import { assignEvidenceIds, collectEvidenceIds } from "@/lib/ai/rag/evidence";
import { buildDeterministicDeadlineAnswer, buildDeterministicEligibilityAnswer } from "@/lib/ai/rag/deterministic-answers";
import { hasAnyContext } from "@/lib/ai/rag/types";
import { classifyUserIntent } from "@/lib/ai/safety/intent-classifier";
import { validateAssistantOutput } from "@/lib/ai/safety/validate-output";
import { verifyCitations } from "@/lib/ai/safety/verify-citations";
import { EVALUATION_CASES, type EvaluationCase } from "./cases";

/**
 * Runs the full non-database pipeline every real request goes through —
 * pre-flight classification, the not-enough-info fast path, deterministic
 * deadline/eligibility templates, evidence-id assignment, prompt
 * construction, the mock provider, citation verification, and output
 * validation — against a fully synthetic fixture. Deliberately independent
 * of any seeded database content so `npm run ai:evaluate` produces the same
 * result in any environment, and deliberately mirrors
 * `src/lib/ai/assistant.ts` step for step (minus the DB-backed availability/
 * rate-limit checks, which have nothing to do with answer quality/safety).
 * See `docs/checkpoint-5/ai-evaluation.md`.
 */

export interface EvaluationCheckFailure {
  check: string;
  detail: string;
}

export interface EvaluationCaseResult {
  key: string;
  description: string;
  passed: boolean;
  finalText: string;
  failures: EvaluationCheckFailure[];
}

function containsCaseInsensitive(haystack: string, needle: string): boolean {
  return haystack.toLowerCase().includes(needle.toLowerCase());
}

export async function runEvaluationCase(evaluationCase: EvaluationCase): Promise<EvaluationCaseResult> {
  const failures: EvaluationCheckFailure[] = [];
  const { expectations } = evaluationCase;

  const classification = classifyUserIntent(evaluationCase.prompt);

  if (expectations.expectBlocked) {
    if (!classification.blocked) {
      failures.push({ check: "expectBlocked", detail: `expected pre-flight block "${expectations.expectBlocked}" but the message was not blocked` });
    } else if (classification.reason !== expectations.expectBlocked) {
      failures.push({
        check: "expectBlocked",
        detail: `expected block reason "${expectations.expectBlocked}" but got "${classification.reason}"`,
      });
    }
    const finalText = classification.refusalMessage ?? "";
    return { key: evaluationCase.key, description: evaluationCase.description, passed: failures.length === 0, finalText, failures };
  }

  if (classification.blocked) {
    failures.push({ check: "unexpected-block", detail: `message was unexpectedly blocked pre-flight (reason: "${classification.reason}")` });
    return { key: evaluationCase.key, description: evaluationCase.description, passed: false, finalText: "", failures };
  }

  if (!hasAnyContext(evaluationCase.retrieval)) {
    const finalText = "I do not have enough verified information to answer that.";
    if (expectations.expectNotEnoughInfo === false) {
      failures.push({ check: "expectNotEnoughInfo", detail: "retrieval had no context, so the not-enough-info fast path fired, but the case expected otherwise" });
    }
    return { key: evaluationCase.key, description: evaluationCase.description, passed: failures.length === 0, finalText, failures };
  }

  const deterministic =
    buildDeterministicDeadlineAnswer(evaluationCase.prompt, evaluationCase.retrieval.structuredFacts) ??
    buildDeterministicEligibilityAnswer(evaluationCase.prompt, evaluationCase.retrieval.structuredFacts);

  let finalText: string;
  let citations: ReturnType<typeof buildCitations>;

  if (deterministic) {
    finalText = deterministic.text;
    citations = buildCitations({ sources: [], structuredFacts: deterministic.usedFacts });
  } else {
    const evidenceRetrieval = assignEvidenceIds(evaluationCase.retrieval);
    const validEvidenceIds = collectEvidenceIds(evidenceRetrieval);
    const messages = buildPromptMessages(evaluationCase.prompt, evidenceRetrieval);
    const provider = new MockAiProvider();
    const generation = await provider.generate({ messages, maxOutputTokens: 700 });

    if (!generation.ok) {
      failures.push({ check: "provider-error", detail: generation.error });
      return { key: evaluationCase.key, description: evaluationCase.description, passed: false, finalText: "", failures };
    }

    const citationChecked = verifyCitations(generation.text, validEvidenceIds);
    const validated = validateAssistantOutput(citationChecked.text);
    finalText = validated.text;
    citations = buildCitations(evidenceRetrieval, citationChecked.citedEvidenceIds);
  }

  if (expectations.expectNotEnoughInfo && finalText !== "I do not have enough verified information to answer that.") {
    failures.push({ check: "expectNotEnoughInfo", detail: `expected the standard not-enough-information fallback, got: "${finalText}"` });
  }

  if (expectations.expectCitations && citations.length === 0) {
    failures.push({ check: "expectCitations", detail: "expected at least one citation but none were available for this fixture" });
  }

  for (const phrase of expectations.forbiddenPhrases ?? []) {
    if (containsCaseInsensitive(finalText, phrase)) {
      failures.push({ check: "forbiddenPhrase", detail: `answer contains forbidden phrase: "${phrase}"` });
    }
  }

  for (const phrase of expectations.requiredPhrases ?? []) {
    if (!containsCaseInsensitive(finalText, phrase)) {
      failures.push({ check: "requiredPhrase", detail: `answer is missing required phrase: "${phrase}"` });
    }
  }

  return { key: evaluationCase.key, description: evaluationCase.description, passed: failures.length === 0, finalText, failures };
}

export interface EvaluationRunSummary {
  total: number;
  passed: number;
  failed: number;
  results: EvaluationCaseResult[];
}

export async function runAllEvaluationCases(cases: readonly EvaluationCase[] = EVALUATION_CASES): Promise<EvaluationRunSummary> {
  const results: EvaluationCaseResult[] = [];
  for (const evaluationCase of cases) {
    results.push(await runEvaluationCase(evaluationCase));
  }
  const passed = results.filter((r) => r.passed).length;
  return { total: results.length, passed, failed: results.length - passed, results };
}
