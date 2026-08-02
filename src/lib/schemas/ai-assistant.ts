import { z } from "zod";

/**
 * Bounds every input `askAssistantAction` accepts before it's trusted for
 * retrieval scoping or prompt assembly. Without this, a caller could send an
 * arbitrarily large `opportunitySlugs`/`matchResults` array — each named
 * opportunity generates its own set of `StructuredFact`s
 * (`src/lib/ai/rag/structured-facts.ts`), so an unbounded array is an
 * unbounded prompt, independent of the token-budget trim in
 * `src/lib/ai/rag/retrieval.ts` (defense in depth: reject absurd input early
 * rather than relying solely on the trim to paper over it).
 */

const MAX_QUESTION_LENGTH = 4000;
const MAX_SLUG_LENGTH = 200;
const MAX_OPPORTUNITY_SLUGS = 10;
const MAX_MATCH_RESULTS = 10;
const MAX_REASON_TEXT_LENGTH = 500;
const MAX_REASONS_PER_LIST = 30;

const slugSchema = z.string().min(1).max(MAX_SLUG_LENGTH);

const matchReasonSchema = z.object({
  text: z.string().max(MAX_REASON_TEXT_LENGTH),
  source: z.enum(["eligibility-rule", "preference", "deadline", "verification"]),
});

const matchResultSchema = z.object({
  label: z.enum([
    "strong-potential-fit",
    "possible-fit",
    "needs-verification",
    "missing-information",
    "likely-not-a-fit",
    "deadline-risk",
    "not-enough-rule-data",
  ]),
  confidence: z.enum(["low", "medium", "high"]),
  positiveReasons: z.array(matchReasonSchema).max(MAX_REASONS_PER_LIST),
  warningReasons: z.array(matchReasonSchema).max(MAX_REASONS_PER_LIST),
  mismatchReasons: z.array(matchReasonSchema).max(MAX_REASONS_PER_LIST),
  missingInfoReasons: z.array(matchReasonSchema).max(MAX_REASONS_PER_LIST),
  deadlineNotes: z.array(z.string().max(MAX_REASON_TEXT_LENGTH)).max(MAX_REASONS_PER_LIST),
  verificationNotes: z.array(z.string().max(MAX_REASON_TEXT_LENGTH)).max(MAX_REASONS_PER_LIST),
  nextAction: z.string().max(MAX_REASON_TEXT_LENGTH),
  disclaimer: z.string().max(MAX_REASON_TEXT_LENGTH),
});

export const askAssistantActionInputSchema = z.object({
  question: z.string().min(1).max(MAX_QUESTION_LENGTH),
  scope: z.enum(["general", "opportunity", "comparison", "workspace", "matching"]).optional(),
  opportunitySlugs: z.array(slugSchema).max(MAX_OPPORTUNITY_SLUGS).optional(),
  matchResults: z
    .array(z.object({ opportunitySlug: slugSchema, match: matchResultSchema }))
    .max(MAX_MATCH_RESULTS)
    .optional(),
  conversationId: z.uuid().nullable().optional(),
  temporary: z.boolean().optional(),
});

export type AskAssistantActionValidatedInput = z.infer<typeof askAssistantActionInputSchema>;
