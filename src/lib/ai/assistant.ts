import "server-only";
import { getDb, schema } from "@/lib/db/client";
import { getAiConfig } from "./config";
import { estimateTokenCount } from "./token-estimate";
import { getAiProvider } from "./providers";
import { classifyUserIntent, type SafetyBlockReason } from "./safety/intent-classifier";
import { validateAssistantOutput } from "./safety/validate-output";
import { checkAndConsumeGuestQuota } from "./rate-limit/guest";
import { checkAndConsumeUserQuota } from "./rate-limit/user";
import { retrieveForQuestion } from "./rag/retrieval";
import { buildPromptMessages } from "./rag/prompt";
import { buildCitations, type CitationDraft } from "./rag/citations";
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

async function isManuallyDisabled(): Promise<{ disabled: boolean; reason: string | null }> {
  const db = getDb();
  const [row] = await db.select().from(schema.aiProviderHealth).limit(1);
  if (!row) return { disabled: false, reason: null };
  return { disabled: row.manuallyDisabled, reason: row.disabledReason };
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

  const retrieval = await retrieveForQuestion({ question: trimmedQuestion, opportunitySlugs, matchResults });
  const messages = buildPromptMessages(trimmedQuestion, retrieval);

  const provider = getAiProvider();
  if (!provider) {
    return { kind: "unavailable", text: UNAVAILABLE_TEXT, citations: [] };
  }

  const generation = await provider.generate({ messages, maxOutputTokens: config.maxOutputTokens });
  if (!generation.ok) {
    await logSafetyEvent({ kind: "provider-error", studentProfileId, redactedSummary: `provider error: ${provider.name}` });
    return { kind: "provider-error", text: PROVIDER_ERROR_TEXT, citations: [], nextGuestCookieValue, remainingQuota };
  }

  const validated = validateAssistantOutput(generation.text);
  if (validated.modified) {
    await logSafetyEvent({
      kind: "output-claim-stripped",
      studentProfileId,
      redactedSummary: "one or more prohibited claims were stripped from the generated answer",
    });
  }

  const citations = buildCitations(retrieval);

  return { kind: "answered", text: validated.text, citations, nextGuestCookieValue, remainingQuota };
}
