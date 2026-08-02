import "server-only";
import { getDb, schema } from "@/lib/db/client";
import { getAiConfig } from "./config";
import { estimateTokenCount } from "./token-estimate";
import { getAiProvider } from "./providers";
import { classifyUserIntent, type SafetyBlockReason } from "./safety/intent-classifier";
import { validateAssistantOutput } from "./safety/validate-output";
import { verifyCitations } from "./safety/verify-citations";
import { checkAndConsumeGuestQuota } from "./rate-limit/guest";
import { checkAndConsumeUserQuota } from "./rate-limit/user";
import { retrieveForQuestion, trimRetrievalToTokenBudget } from "./rag/retrieval";
import { buildPromptMessages } from "./rag/prompt";
import { buildCitations, type CitationDraft } from "./rag/citations";
import { assignEvidenceIds, collectEvidenceIds } from "./rag/evidence";
import { buildDeterministicDeadlineAnswer, buildDeterministicEligibilityAnswer } from "./rag/deterministic-answers";
import { hasAnyContext } from "./rag/types";
import type { MatchResult } from "@/lib/matching/types";

/**
 * The one entry point every AI-facing route/action calls. Owns, in order:
 * availability (env config + the staff runtime kill switch), abuse
 * prevention (rate limiting), pre-flight safety screening, retrieval,
 * prompt construction, the provider call, and post-generation output
 * validation. Never persists a conversation/message itself — the caller
 * decides whether to save history (guest-local, signed-in-with-consent, or
 * temporary/not-at-all) and does so with the citations this function
 * returns. See `docs/checkpoint-5/checkpoint-5-architecture.md`.
 */

export type AssistantResultKind = "answered" | "unavailable" | "rate-limited" | "blocked" | "provider-error";

export interface AssistantAnswer {
  kind: AssistantResultKind;
  text: string;
  citations: CitationDraft[];
  blockedReason?: SafetyBlockReason;
  /** Present only for guest requesters — the caller must set this as the new cookie value regardless of outcome. */
  nextGuestCookieValue?: string;
  remainingQuota?: number;
}

export type AssistantRequester = { kind: "guest"; guestCookieValue: string | null } | { kind: "student"; studentProfileId: string };

export interface AskAssistantParams {
  question: string;
  opportunitySlugs?: string[];
  matchResults?: ReadonlyMap<string, MatchResult>;
  requester: AssistantRequester;
}

const UNAVAILABLE_TEXT = "The assistant is currently unavailable. You can still browse and search the full catalogue without it.";
const PROVIDER_ERROR_TEXT = "The assistant couldn't produce an answer just now. Please try again in a moment.";
const RATE_LIMIT_TEXT = "You've reached today's assistant question limit. Please try again tomorrow, or browse the catalogue directly.";
const NOT_ENOUGH_INFO_TEXT = "I do not have enough verified information to answer that.";

/**
 * Fails CLOSED: any error reading the runtime kill switch (a database blip,
 * a connection failure) must never let the assistant silently proceed as if
 * it were confirmed healthy — that would call a real provider with unknown
 * availability state, and could crash the caller with a raw exception
 * instead of the ordinary "unavailable" answer. Treat "couldn't determine
 * health" the same as "manually disabled".
 */
async function isManuallyDisabled(): Promise<{ disabled: boolean; reason: string | null }> {
  try {
    const db = getDb();
    const [row] = await db.select().from(schema.aiProviderHealth).limit(1);
    if (!row) return { disabled: false, reason: null };
    return { disabled: row.manuallyDisabled, reason: row.disabledReason };
  } catch {
    return { disabled: true, reason: "health check failed" };
  }
}

async function logSafetyEvent(params: {
  kind: (typeof schema.aiSafetyEventKindEnum.enumValues)[number];
  studentProfileId: string | null;
  redactedSummary: string;
}): Promise<void> {
  const db = getDb();
  await db.insert(schema.aiSafetyEvents).values({
    studentProfileId: params.studentProfileId,
    kind: params.kind,
    redactedSummary: params.redactedSummary.slice(0, 500),
  });
}

export async function askAssistant(params: AskAssistantParams): Promise<AssistantAnswer> {
  const { question, opportunitySlugs, matchResults, requester } = params;
  const studentProfileId = requester.kind === "student" ? requester.studentProfileId : null;

  const config = getAiConfig();
  if (!config.isAvailable) {
    return { kind: "unavailable", text: UNAVAILABLE_TEXT, citations: [] };
  }

  const health = await isManuallyDisabled();
  if (health.disabled) {
    return {
      kind: "unavailable",
      text: health.reason ? `${UNAVAILABLE_TEXT} (${health.reason})` : UNAVAILABLE_TEXT,
      citations: [],
    };
  }

  const trimmedQuestion = question.trim();
  if (trimmedQuestion.length === 0 || estimateTokenCount(trimmedQuestion) > config.maxInputTokens) {
    return {
      kind: "blocked",
      text: "That message is empty or too long for the assistant to process. Please ask a shorter, specific question.",
      citations: [],
    };
  }

  let nextGuestCookieValue: string | undefined;
  let remainingQuota: number | undefined;

  if (requester.kind === "guest") {
    const quota = checkAndConsumeGuestQuota(requester.guestCookieValue, config.dailyGuestLimit);
    nextGuestCookieValue = quota.nextCookieValue;
    remainingQuota = quota.remaining;
    if (!quota.allowed) {
      await logSafetyEvent({ kind: "rate-limit-exceeded", studentProfileId: null, redactedSummary: "guest daily limit reached" });
      return { kind: "rate-limited", text: RATE_LIMIT_TEXT, citations: [], nextGuestCookieValue, remainingQuota: 0 };
    }
  } else {
    const quota = await checkAndConsumeUserQuota(requester.studentProfileId, config.dailyUserLimit);
    remainingQuota = quota.remaining;
    if (!quota.allowed) {
      await logSafetyEvent({ kind: "rate-limit-exceeded", studentProfileId, redactedSummary: "signed-in daily limit reached" });
      return { kind: "rate-limited", text: RATE_LIMIT_TEXT, citations: [], remainingQuota: 0 };
    }
  }

  const classification = classifyUserIntent(trimmedQuestion);
  if (classification.blocked && classification.reason) {
    await logSafetyEvent({
      kind: classification.reason,
      studentProfileId,
      redactedSummary: `blocked user message (reason: ${classification.reason})`,
    });
    return {
      kind: "blocked",
      text: classification.refusalMessage ?? "I can't help with that request.",
      citations: [],
      blockedReason: classification.reason,
      nextGuestCookieValue,
      remainingQuota,
    };
  }

  const rawRetrieval = await retrieveForQuestion({ question: trimmedQuestion, opportunitySlugs, matchResults });

  // No approved source and no structured fact at all: the honest answer is
  // "not enough information," and there is nothing for a provider to ground
  // an answer in anyway — never spend a real provider call finding that out.
  if (!hasAnyContext(rawRetrieval)) {
    return { kind: "answered", text: NOT_ENOUGH_INFO_TEXT, citations: [], nextGuestCookieValue, remainingQuota };
  }

  const retrieval = trimRetrievalToTokenBudget(rawRetrieval, config.maxPromptTokens);

  // Deadline and eligibility are the two highest-stakes claim categories —
  // when the relevant structured fact is already in hand, answer directly
  // from it via a fixed template rather than ever letting a provider
  // rephrase (and risk distorting) it. See `./rag/deterministic-answers.ts`.
  const deterministic =
    buildDeterministicDeadlineAnswer(trimmedQuestion, retrieval.structuredFacts) ??
    buildDeterministicEligibilityAnswer(trimmedQuestion, retrieval.structuredFacts);
  if (deterministic) {
    const citations = buildCitations({ sources: [], structuredFacts: deterministic.usedFacts });
    return { kind: "answered", text: deterministic.text, citations, nextGuestCookieValue, remainingQuota };
  }

  const evidenceRetrieval = assignEvidenceIds(retrieval);
  const validEvidenceIds = collectEvidenceIds(evidenceRetrieval);
  const messages = buildPromptMessages(trimmedQuestion, evidenceRetrieval);

  const provider = getAiProvider();
  if (!provider) {
    return { kind: "unavailable", text: UNAVAILABLE_TEXT, citations: [] };
  }

  const generation = await provider.generate({ messages, maxOutputTokens: config.maxOutputTokens });
  if (!generation.ok) {
    await logSafetyEvent({ kind: "provider-error", studentProfileId, redactedSummary: `provider error: ${provider.name}` });
    return { kind: "provider-error", text: PROVIDER_ERROR_TEXT, citations: [], nextGuestCookieValue, remainingQuota };
  }

  const citationChecked = verifyCitations(generation.text, validEvidenceIds);
  const validated = validateAssistantOutput(citationChecked.text);
  if (citationChecked.modified || validated.modified) {
    await logSafetyEvent({
      kind: "output-claim-stripped",
      studentProfileId,
      redactedSummary: citationChecked.modified
        ? "one or more sentences lacked a valid evidence citation and were stripped"
        : "one or more prohibited claims were stripped from the generated answer",
    });
  }

  const citations = buildCitations(evidenceRetrieval, citationChecked.citedEvidenceIds);

  return { kind: "answered", text: validated.text, citations, nextGuestCookieValue, remainingQuota };
}
